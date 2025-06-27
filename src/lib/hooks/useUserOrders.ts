import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { UserOrdersSummary, UserSellOrder } from '../types';
import { orderApiService } from '../utils/order-api';
import { signCancelOrderMessage } from '../utils/order-signing';

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
    // Check if we have the full nested structure or just the basic order data
    const fullOrder = backendOrder.fullSellOrder;

    if (fullOrder) {
      // Full structure with nested data
      return {
        ...baseOrder,
        type: 'full',
        percentOfEquity: parseInt(fullOrder.percentOfEquity) / 100, // Convert from basis points
        paymentToken: fullOrder.token as Address,
      };
    } else {
      // Basic order data without nested structure - use placeholder values
      console.warn('Full sell order missing nested data for order:', backendOrder.id);
      return {
        ...baseOrder,
        type: 'full',
        percentOfEquity: 0, // Placeholder - would need to fetch full order details
        paymentToken: '0x0000000000000000000000000000000000000000' as Address, // Placeholder
      };
    }
  } else {
    // Check if we have the full nested structure or just the basic order data
    const partialOrder = backendOrder.partialSellOrder;

    if (partialOrder) {
      // Full structure with nested data
      return {
        ...baseOrder,
        type: 'partial',
        repayToken: partialOrder.repayToken as Address,
        repayAmount: BigInt(partialOrder.repayAmount),
        bonus: parseInt(partialOrder.bonus) / 100, // Convert from basis points
        collateralTokens: partialOrder.collateralOut as Address[],
        collateralPercentages: partialOrder.percents.map((p: string) => parseInt(p) / 100),
      };
    } else {
      // Basic order data without nested structure - use placeholder values
      console.warn('Partial sell order missing nested data for order:', backendOrder.id);
      return {
        ...baseOrder,
        type: 'partial',
        repayToken: '0x0000000000000000000000000000000000000000' as Address, // Placeholder
        repayAmount: BigInt(0), // Placeholder
        bonus: 0, // Placeholder
        collateralTokens: [], // Placeholder
        collateralPercentages: [], // Placeholder
      };
    }
  }
};

export function useUserOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [orders, setOrders] = useState<UserSellOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!isConnected || !address) {
      setOrders([]);
      return;
    }

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

  useEffect(() => {
    fetchOrders();
  }, [address, isConnected, chainId]);

  return { orders, isLoading, error, refetch: fetchOrders };
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
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const cancelOrder = async (orderId: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    console.log('🔄 useOrderActions.cancelOrder called:', { orderId, address });

    try {
      // Sign the cancel message
      const { message, signature } = await signCancelOrderMessage(orderId, walletClient);

      const cancelRequest = {
        seller: address,
        message,
        signature,
      };

      const result = await orderApiService.cancelOrder(orderId, cancelRequest);
      console.log('📥 cancelOrder API result:', result);

      if (!result.success) {
        console.error('❌ API returned error:', result.error);
        throw new Error(result.error || 'Failed to cancel order');
      }

      console.log('✅ Order cancelled successfully:', result.message);
      return result;
    } catch (error) {
      console.error('❌ useOrderActions.cancelOrder error:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);

      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack?.split('\n').slice(0, 5));
      }

      throw error;
    }
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
