import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { UserOrdersSummary, UserSellOrder } from '../types';

// Mock data for development - replace with real API/contract calls
const generateMockUserOrders = (userAddress: Address): UserSellOrder[] => {
  const now = new Date();

  return [
    {
      id: 'order-1',
      debtAddress: '0x1234567890123456789012345678901234567890' as Address,
      type: 'full',
      status: 'active',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      validUntil: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      triggerHealthFactor: 1.5,
      currentHealthFactor: 1.8,
      percentOfEquity: 90,
      paymentToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address, // WBTC
    },
    {
      id: 'order-2',
      debtAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      type: 'partial',
      status: 'active',
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      validUntil: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      triggerHealthFactor: 1.3,
      currentHealthFactor: 1.4,
      repayToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // USDC
      repayAmount: BigInt('2000000000'), // 2000 USDC
      bonus: 2,
      collateralTokens: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address], // WETH
      collateralPercentages: [100],
    },
    {
      id: 'order-3',
      debtAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address,
      type: 'full',
      status: 'expired',
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      validUntil: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // expired 1 day ago
      triggerHealthFactor: 1.4,
      currentHealthFactor: 2.1,
      percentOfEquity: 85,
      paymentToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // USDC
    },
  ];
};

export function useUserOrders() {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<UserSellOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // In real implementation, this would fetch from subgraph or contract events
      const mockOrders = generateMockUserOrders(address);
      setOrders(mockOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

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
  };

  const createSellOrder = async (orderData: Partial<UserSellOrder>) => {
    // Implementation would create and sign order according to EIP-712
    console.log('Creating sell order:', orderData);
    // This would involve signing the order and potentially storing it off-chain
  };

  return {
    cancelOrder,
    createSellOrder,
  };
}
