import { useState } from 'react';
import { Address } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { getAaveRouterAddress } from '../contracts';
import { AAVE_ROUTER_ABI, ERC20_ABI } from '../contracts/abis';
import { MarketOrder } from '../types';
import { orderApiService } from '../utils/order-api';

export function useOrderExecution() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isExecuting, setIsExecuting] = useState(false);
  const [executingOrderId, setExecutingOrderId] = useState<string | null>(null);

  const executeOrder = async (order: MarketOrder) => {
    if (!address || !chainId || !publicClient) {
      throw new Error('Wallet not connected');
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setIsExecuting(true);
    setExecutingOrderId(order.id);

    try {
      console.log('🔄 Executing order:', order.id, 'type:', order.type);

      // Get the full order details with real signatures from backend
      const fullOrderData = await orderApiService.getOrderById(order.id);
      console.log('📄 Full order data:', fullOrderData);

      if (order.type === 'full') {
        await executeFullSaleOrder(order, fullOrderData, routerAddress);
      } else {
        await executePartialSaleOrder(order, fullOrderData, routerAddress);
      }

      console.log('✅ Order executed successfully:', order.id);
    } finally {
      setIsExecuting(false);
      setExecutingOrderId(null);
    }
  };

  const executeFullSaleOrder = async (order: MarketOrder, fullOrderData: any, routerAddress: Address) => {
    if (order.type !== 'full' || !order.paymentToken || !order.percentOfEquity) {
      throw new Error('Invalid full sale order data');
    }

    const fullSellOrder = fullOrderData.fullSellOrder;
    if (!fullSellOrder) {
      throw new Error('Full sell order data not found');
    }

    console.log('💰 Executing full sale order with payment token:', order.paymentToken);
    console.log('🏦 Debt position data:', {
      totalCollateral: order.debtPosition.totalCollateralBase.toString(),
      totalDebt: order.debtPosition.totalDebtBase.toString(),
      netEquity: (order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase).toString(),
      sellerPercentage: order.percentOfEquity,
    });

    // Calculate the premium amount using real debt position data
    const netEquity = order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase;
    const sellerPercentageBasisPoints = Math.floor(order.percentOfEquity * 100); // Convert to basis points
    const premiumValue = (netEquity * BigInt(sellerPercentageBasisPoints)) / BigInt(10000);

    // For demo purposes, assume 1:1 conversion with USD value
    // In production, you would use oracle prices to convert between tokens
    const paymentAmount = premiumValue;

    console.log('💸 Payment calculation:', {
      netEquity: netEquity.toString(),
      sellerPercentage: `${order.percentOfEquity}%`,
      sellerPercentageBasisPoints,
      premiumValue: premiumValue.toString(),
      paymentAmount: paymentAmount.toString(),
    });

    // Check current allowance
    const currentAllowance = (await publicClient!.readContract({
      address: order.paymentToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, routerAddress],
    })) as bigint;

    console.log('📋 Current allowance:', currentAllowance.toString());

    // Approve token if needed
    if (currentAllowance < paymentAmount) {
      console.log('🔓 Approving payment token...');
      const approveTx = await writeContractAsync({
        address: order.paymentToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, paymentAmount],
      });
      console.log('✅ Approval transaction:', approveTx);
    }

    // Construct the order struct using real signature from backend
    const fullSellOrderStruct = {
      title: {
        debt: fullSellOrder.debt as Address,
        debtNonce: BigInt(fullSellOrder.debtNonce),
        startTime: BigInt(fullSellOrder.startTime),
        endTime: BigInt(fullSellOrder.endTime),
        triggerHF: BigInt(fullSellOrder.triggerHF),
      },
      token: fullSellOrder.token as Address,
      percentOfEquity: BigInt(fullSellOrder.percentOfEquity),
      v: fullSellOrder.v,
      r: fullSellOrder.r as `0x${string}`,
      s: fullSellOrder.s as `0x${string}`,
    };

    console.log('📝 Executing with order struct:', {
      ...fullSellOrderStruct,
      title: {
        ...fullSellOrderStruct.title,
        debt: fullSellOrderStruct.title.debt,
        debtNonce: fullSellOrderStruct.title.debtNonce.toString(),
        startTime: fullSellOrderStruct.title.startTime.toString(),
        endTime: fullSellOrderStruct.title.endTime.toString(),
        triggerHF: fullSellOrderStruct.title.triggerHF.toString(),
      },
      percentOfEquity: fullSellOrderStruct.percentOfEquity.toString(),
    });

    // Execute the full sale order
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: 'executeFullSaleOrder',
      args: [fullSellOrderStruct, BigInt(0)], // minProfit = 0 for now
    });

    console.log('🎯 Full sale order executed:', txHash);
    return txHash;
  };

  const executePartialSaleOrder = async (order: MarketOrder, fullOrderData: any, routerAddress: Address) => {
    if (order.type !== 'partial' || !order.repayToken || !order.repayAmount) {
      throw new Error('Invalid partial sale order data');
    }

    const partialSellOrder = fullOrderData.partialSellOrder;
    if (!partialSellOrder) {
      throw new Error('Partial sell order data not found');
    }

    console.log('🔧 Executing partial sale order with repay token:', order.repayToken);
    console.log('💰 Repay amount:', order.repayAmount.toString());

    // Check current allowance for repay token
    const currentAllowance = (await publicClient!.readContract({
      address: order.repayToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, routerAddress],
    })) as bigint;

    console.log('📋 Current repay token allowance:', currentAllowance.toString());

    // Approve repay token if needed
    if (currentAllowance < order.repayAmount) {
      console.log('🔓 Approving repay token...');
      const approveTx = await writeContractAsync({
        address: order.repayToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, order.repayAmount],
      });
      console.log('✅ Repay token approval transaction:', approveTx);
    }

    // Construct the order struct using real signature from backend
    const partialSellOrderStruct = {
      title: {
        debt: partialSellOrder.debt as Address,
        debtNonce: BigInt(partialSellOrder.debtNonce),
        startTime: BigInt(partialSellOrder.startTime),
        endTime: BigInt(partialSellOrder.endTime),
        triggerHF: BigInt(partialSellOrder.triggerHF),
      },
      interestRateMode: partialSellOrder.interestRateMode,
      collateralOut: partialSellOrder.collateralOut as Address[],
      percents: partialSellOrder.percents.map((p: string) => BigInt(p)),
      repayToken: partialSellOrder.repayToken as Address,
      repayAmount: BigInt(partialSellOrder.repayAmount),
      bonus: BigInt(partialSellOrder.bonus),
      v: partialSellOrder.v,
      r: partialSellOrder.r as `0x${string}`,
      s: partialSellOrder.s as `0x${string}`,
    };

    console.log('📝 Executing with partial order struct:', partialSellOrderStruct);

    // Execute the partial sale order
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: 'excutePartialSellOrder', // Note: keeping the typo from contract
      args: [partialSellOrderStruct],
    });

    console.log('🎯 Partial sale order executed:', txHash);
    return txHash;
  };

  return {
    executeOrder,
    isExecuting,
    executingOrderId,
  };
}
