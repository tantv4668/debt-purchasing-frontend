import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { useChainId } from 'wagmi';
import { MarketOrder } from '../types';
import { orderApiService } from '../utils/order-api';

// Recalculate health factor from debt position data
const calculateHealthFactor = (debtPositionData: any): number => {
  if (!debtPositionData?.collaterals || !debtPositionData?.debts) {
    return 1.0; // Default HF if no data
  }

  // Calculate total collateral value weighted by liquidation threshold
  let totalCollateralWithThreshold = BigInt(0);
  let totalCollateralValue = BigInt(0);

  for (const collateral of debtPositionData.collaterals) {
    const collateralValueUSD = BigInt(collateral.balanceUSD || '0');
    totalCollateralValue += collateralValueUSD;

    // Apply liquidation threshold (assume 85% for most assets if not provided)
    const liquidationThreshold = BigInt(collateral.liquidationThreshold || '8500'); // 85% in basis points
    const weightedValue = (collateralValueUSD * liquidationThreshold) / BigInt(10000);
    totalCollateralWithThreshold += weightedValue;
  }

  // Calculate total debt value
  let totalDebtValue = BigInt(0);
  for (const debt of debtPositionData.debts) {
    totalDebtValue += BigInt(debt.balanceUSD || '0');
  }

  // Health Factor = (Total Collateral * Liquidation Threshold) / Total Debt
  // If no debt, health factor is effectively infinite (return very high number)
  if (totalDebtValue === BigInt(0)) {
    return 999.99;
  }

  // Calculate with 18 decimal precision then convert to float
  const healthFactorWei = (totalCollateralWithThreshold * BigInt(1e18)) / totalDebtValue;
  const healthFactor = Number(healthFactorWei) / 1e18;

  console.log('🧮 Health Factor Calculation:', {
    totalCollateralValue: totalCollateralValue.toString(),
    totalCollateralWithThreshold: totalCollateralWithThreshold.toString(),
    totalDebtValue: totalDebtValue.toString(),
    healthFactorWei: healthFactorWei.toString(),
    healthFactor: healthFactor.toFixed(6),
  });

  return healthFactor;
};

// Convert backend order to frontend MarketOrder format
const convertBackendOrderToMarketOrder = async (backendOrder: any): Promise<MarketOrder> => {
  const type = backendOrder.orderType === 'FULL' ? 'full' : 'partial';

  // Parse health factor from string (in wei) to number
  const triggerHealthFactor = parseFloat(backendOrder.triggerHF) / 1e18;

  // Fetch debt position data to get real collateral/debt amounts
  let debtPositionData;
  let realCurrentHealthFactor = triggerHealthFactor;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'}/api/positions/${backendOrder.debtAddress}`,
    );
    if (response.ok) {
      const result = await response.json();
      debtPositionData = result.data;

      // Recalculate health factor from position data for accuracy
      realCurrentHealthFactor = calculateHealthFactor(debtPositionData);

      console.log('📊 Position data for', backendOrder.debtAddress, ':', {
        backendHF: debtPositionData.healthFactor
          ? (parseFloat(debtPositionData.healthFactor) / 1e18).toFixed(6)
          : 'N/A',
        recalculatedHF: realCurrentHealthFactor.toFixed(6),
        triggerHF: triggerHealthFactor.toFixed(6),
      });
    }
  } catch (error) {
    console.error('Failed to fetch debt position data for', backendOrder.debtAddress, ':', error);
  }

  const baseOrder = {
    id: backendOrder.id,
    seller: backendOrder.seller as Address,
    type,
    triggerHealthFactor,
    currentHealthFactor: realCurrentHealthFactor,
    validUntil: new Date(backendOrder.endTime),
    // Update isActive based on recalculated health factor
    isActive: realCurrentHealthFactor <= triggerHealthFactor,
    canExecuteReason:
      realCurrentHealthFactor <= triggerHealthFactor
        ? 'YES'
        : `NO - HF too high (${realCurrentHealthFactor.toFixed(3)} > ${triggerHealthFactor.toFixed(3)})`,
    // Map real debt position data
    debtPosition: {
      address: backendOrder.debtAddress as Address,
      owner: backendOrder.seller as Address,
      nonce: BigInt(backendOrder.debtNonce || 0),
      // Use real values from backend API or defaults
      totalCollateralBase: debtPositionData?.totalCollateralBase
        ? BigInt(debtPositionData.totalCollateralBase)
        : BigInt('2000000000000'),
      totalDebtBase: debtPositionData?.totalDebtBase ? BigInt(debtPositionData.totalDebtBase) : BigInt('1000000000000'),
      availableBorrowsBase: debtPositionData?.availableBorrowsBase
        ? BigInt(debtPositionData.availableBorrowsBase)
        : BigInt('500000000000'),
      currentLiquidationThreshold: debtPositionData?.currentLiquidationThreshold
        ? BigInt(debtPositionData.currentLiquidationThreshold)
        : BigInt(8500),
      ltv: debtPositionData?.ltv ? BigInt(debtPositionData.ltv) : BigInt(8000),
      healthFactor: BigInt(Math.floor(realCurrentHealthFactor * 1e18)),
      collaterals:
        debtPositionData?.collaterals?.map((c: any) => ({
          token: c.token as Address,
          symbol: c.symbol || 'UNKNOWN',
          name: c.name || 'Unknown Token',
          decimals: c.decimals || 18,
          balance: BigInt(c.balance || '0'),
          balanceUSD: BigInt(c.balanceUSD || '0'),
        })) || [],
      debts:
        debtPositionData?.debts?.map((d: any) => ({
          token: d.token as Address,
          symbol: d.symbol || 'UNKNOWN',
          name: d.name || 'Unknown Token',
          decimals: d.decimals || 18,
          balance: BigInt(d.balance || '0'),
          balanceUSD: BigInt(d.balanceUSD || '0'),
        })) || [],
    },
  };

  if (type === 'full') {
    const fullOrder = backendOrder.fullSellOrder;
    if (!fullOrder) {
      throw new Error(`Full sell order data missing for order ${backendOrder.id}`);
    }

    // Calculate estimated profit for full sale
    const netEquity = baseOrder.debtPosition.totalCollateralBase - baseOrder.debtPosition.totalDebtBase;
    const buyerPercentage = (10000 - parseInt(fullOrder.percentOfEquity)) / 100; // Buyer gets remaining percentage
    const estimatedProfit = (netEquity * BigInt(Math.floor(buyerPercentage))) / BigInt(100);

    return {
      ...baseOrder,
      type: 'full',
      percentOfEquity: parseInt(fullOrder.percentOfEquity) / 100, // Convert from basis points to percentage
      paymentToken: fullOrder.token as Address,
      estimatedProfit,
    };
  } else {
    const partialOrder = backendOrder.partialSellOrder;
    if (!partialOrder) {
      throw new Error(`Partial sell order data missing for order ${backendOrder.id}`);
    }

    // Calculate estimated profit for partial sale (bonus percentage of repay amount)
    const repayAmount = BigInt(partialOrder.repayAmount);
    const bonusPercentage = parseInt(partialOrder.bonus) / 100; // Convert from basis points
    const estimatedProfit = (repayAmount * BigInt(Math.floor(bonusPercentage))) / BigInt(100);

    return {
      ...baseOrder,
      type: 'partial',
      repayToken: partialOrder.repayToken as Address,
      repayAmount,
      bonus: bonusPercentage,
      collateralTokens: partialOrder.collateralOut as Address[],
      estimatedProfit,
    };
  }
};

export function useMarketOrders() {
  const chainId = useChainId();
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketOrders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all active orders
      const response = await orderApiService.getOrders({
        chainId,
        status: 'ACTIVE',
        limit: 100,
      });

      if (!response.orders || response.orders.length === 0) {
        setError('No orders available at the moment.');
        setOrders([]);
        return;
      }

      const convertedOrdersPromises = response.orders.map(async order => {
        try {
          return await convertBackendOrderToMarketOrder(order);
        } catch (err) {
          console.error('Failed to convert order:', order.id, err);
          return null;
        }
      });

      const convertedOrdersResults = await Promise.all(convertedOrdersPromises);
      const convertedOrders = convertedOrdersResults.filter((order): order is MarketOrder => order !== null);

      setOrders(convertedOrders);

      if (convertedOrders.length === 0 && response.orders.length > 0) {
        setError('Unable to process order data.');
      }
    } catch (err) {
      console.error('Failed to fetch market orders:', err);

      setError('Unable to connect to the server. Please check your connection and try again.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketOrders();

    // Refresh orders every 30 seconds to check for health factor changes
    const interval = setInterval(fetchMarketOrders, 30000);
    return () => clearInterval(interval);
  }, [chainId]);

  return { orders, isLoading, error, refetch: fetchMarketOrders };
}
