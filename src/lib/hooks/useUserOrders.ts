import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import { UserOrdersSummary, UserSellOrder } from '../types';
import { orderApiService } from '../utils/order-api';

// Convert backend order to frontend UserSellOrder format
const convertBackendOrderToUserSellOrder = (backendOrder: any): UserSellOrder => {
  const type = backendOrder.orderType === 'FULL' ? 'full' : 'partial';
  const status = backendOrder.status.toLowerCase() as 'active' | 'expired' | 'executed' | 'cancelled';

  const baseOrder = {
    id: backendOrder.id,
    debtAddress: backendOrder.debtAddress as Address,
    type,
    status,
    createdAt: new Date(backendOrder.createdAt),
    validUntil: new Date(backendOrder.endTime),
    triggerHealthFactor: parseFloat(backendOrder.triggerHF) / 1e18, // Convert from wei
    currentHealthFactor: 1.5, // Default, would need to be calculated from position data
  };

  if (type === 'full') {
    const fullOrder = backendOrder.fullSellOrder;
    return {
      ...baseOrder,
      type: 'full',
      percentOfEquity: parseInt(fullOrder.percentOfEquity) / 100, // Convert from basis points
      paymentToken: fullOrder.token as Address,
    };
  } else {
    const partialOrder = backendOrder.partialSellOrder;
    return {
      ...baseOrder,
      type: 'partial',
      repayToken: partialOrder.repayToken as Address,
      repayAmount: BigInt(partialOrder.repayAmount),
      bonus: parseInt(partialOrder.bonus) / 100, // Convert from basis points
      collateralTokens: partialOrder.collateralOut as Address[],
      collateralPercentages: partialOrder.percents.map((p: string) => parseInt(p) / 100),
    };
  }
};

export function useUserOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [orders, setOrders] = useState<UserSellOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setOrders([]);
      return;
    }

    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await orderApiService.getOrders({
          seller: address,
          chainId,
          limit: 50, // Fetch more orders for user
        });

        const convertedOrders = response.orders.map(convertBackendOrderToUserSellOrder);
        setOrders(convertedOrders);
      } catch (err) {
        console.error('Failed to fetch user orders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load orders');
        // Fallback to empty array on error
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [address, isConnected, chainId]);

  return { orders, isLoading, error };
}

export function useUserOrdersSummary(): UserOrdersSummary {
  const { orders } = useUserOrders();

  const summary = {
    totalOrders: orders.length,
    activeOrders: orders.filter(order => order.status === 'active').length,
    expiredOrders: orders.filter(order => order.status === 'expired').length,
    executedOrders: orders.filter(order => order.status === 'executed').length,
    totalPotentialValue: 0, // Would calculate based on position values
  };

  return summary;
}

export function useOrderActions() {
  const cancelOrder = async (orderId: string) => {
    // Implementation would call smart contract to increment debt nonce
    console.log('Cancelling order:', orderId);
    // This would call router.cancelDebtCurrentOrders(debtAddress)
    throw new Error('Cancel order not yet implemented - requires smart contract interaction');
  };

  const createSellOrder = async (orderData: Partial<UserSellOrder>) => {
    // Implementation would create and sign order according to EIP-712
    console.log('Creating sell order:', orderData);
    // This would involve signing the order and potentially storing it off-chain
    throw new Error('Create sell order moved to modal implementation');
  };

  return {
    cancelOrder,
    createSellOrder,
  };
}
