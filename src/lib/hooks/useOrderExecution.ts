import { useState } from 'react';
import { Address, encodeFunctionData } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { getAaveRouterAddress } from '../contracts';
import { AAVE_ROUTER_ABI, ERC20_ABI } from '../contracts/abis';
import { MarketOrder } from '../types';
import { orderApiService } from '../utils/order-api';
import { useAavePool } from './useContracts';

export interface ExecuteOrderOptions {
  // For full sale orders: whether to automatically liquidate the position after purchase
  autoLiquidate?: boolean;
  // Minimum profit expected (for full sale orders with auto-liquidation)
  minProfit?: bigint;
}

export function useOrderExecution() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const aavePool = useAavePool(chainId);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executingOrderId, setExecutingOrderId] = useState<string | null>(null);

  const executeOrder = async (order: MarketOrder, options: ExecuteOrderOptions = {}) => {
    if (!address || !chainId || !publicClient) {
      throw new Error('Wallet not connected');
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setIsExecuting(true);
    setExecutingOrderId(order.id);

    try {
      console.log('🔄 Executing order:', order.id, 'type:', order.type, 'options:', options);

      // Get the full order details with real signatures from backend
      const fullOrderData = await orderApiService.getOrderById(order.id);
      console.log('📄 Full order data:', fullOrderData);

      let txHash;
      if (order.type === 'full') {
        txHash = await executeFullSaleOrder(order, fullOrderData, routerAddress, options);
      } else {
        txHash = await executePartialSaleOrder(order, fullOrderData, routerAddress);
      }

      console.log('✅ Order execution transaction submitted:', txHash);
      console.log('⏳ Waiting for transaction confirmation...');

      // Wait for transaction to be confirmed
      await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000, // 60 second timeout
      });

      console.log('✅ Order executed successfully and confirmed:', order.id);
      return txHash;
    } finally {
      setIsExecuting(false);
      setExecutingOrderId(null);
    }
  };

  const executeFullSaleOrder = async (
    order: MarketOrder,
    fullOrderData: any,
    routerAddress: Address,
    options: ExecuteOrderOptions = {},
  ) => {
    if (order.type !== 'full' || !order.paymentToken || !order.percentOfEquity) {
      throw new Error('Invalid full sale order data');
    }

    const fullSellOrder = fullOrderData.fullSellOrder;
    if (!fullSellOrder) {
      throw new Error('Full sell order data not found');
    }

    console.log('💰 Executing full sale order with payment token:', order.paymentToken);
    console.log('🏦 Options:', options);

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

    // Check if auto-liquidation is requested
    if (options.autoLiquidate) {
      console.log('🔄 Auto-liquidation requested - preparing multicall transaction');
      return await executeFullSaleOrderWithLiquidation(
        fullSellOrderStruct,
        order,
        routerAddress,
        options.minProfit || BigInt(0),
      );
    } else {
      console.log('💰 Standard execution - ownership transfer only');
      return await executeFullSaleOrderStandard(fullSellOrderStruct, paymentAmount, routerAddress);
    }
  };

  const executeFullSaleOrderStandard = async (
    fullSellOrderStruct: any,
    paymentAmount: bigint,
    routerAddress: Address,
  ) => {
    // Check current allowance
    const currentAllowance = (await publicClient!.readContract({
      address: fullSellOrderStruct.token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, routerAddress],
    })) as bigint;

    console.log('📋 Current allowance:', currentAllowance.toString());

    // Approve token if needed
    if (currentAllowance < paymentAmount) {
      console.log('🔓 Approving payment token...');
      const approveTx = await writeContractAsync({
        address: fullSellOrderStruct.token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, paymentAmount],
      });
      console.log('✅ Approval transaction:', approveTx);
    }

    // Execute the full sale order
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: 'executeFullSaleOrder',
      args: [fullSellOrderStruct, BigInt(0)], // minProfit = 0 for standard execution
    });

    console.log('🎯 Full sale order executed (standard):', txHash);
    return txHash;
  };

  const executeFullSaleOrderWithLiquidation = async (
    fullSellOrderStruct: any,
    order: MarketOrder,
    routerAddress: Address,
    minProfit: bigint,
  ) => {
    const debtAddress = fullSellOrderStruct.title.debt;

    // Calculate payment amount
    const netEquity = order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase;
    const sellerPercentageBasisPoints = Math.floor(order.percentOfEquity! * 100);
    const paymentAmount = (netEquity * BigInt(sellerPercentageBasisPoints)) / BigInt(10000);

    console.log('🔄 Preparing multicall with auto-liquidation...');

    // Get current debt and collateral balances from the blockchain
    const debtBalances: { token: Address; amount: bigint }[] = [];
    const collateralBalances: { token: Address; amount: bigint }[] = [];

    // Get actual debt token balances (variable debt tokens)
    for (const debt of order.debtPosition.debts) {
      if (debt.balance > 0) {
        try {
          // Use the proper hook to get token addresses
          const { variableDebtTokenAddress } = await aavePool.getTokenAddresses(debt.token);

          // Get current variable debt balance
          const currentDebtBalance = (await publicClient!.readContract({
            address: variableDebtTokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [debtAddress],
          })) as bigint;

          if (currentDebtBalance > 0) {
            debtBalances.push({
              token: debt.token,
              amount: currentDebtBalance,
            });
          }
        } catch (error) {
          console.warn(`Failed to get debt balance for ${debt.token}:`, error);
          // Fallback to order data
          debtBalances.push({
            token: debt.token,
            amount: debt.balance,
          });
        }
      }
    }

    // Get actual collateral balances (aTokens)
    for (const collateral of order.debtPosition.collaterals) {
      if (collateral.balance > 0) {
        try {
          // Use the proper hook to get token addresses
          const { aTokenAddress } = await aavePool.getTokenAddresses(collateral.token);

          // Get current aToken balance
          const currentCollateralBalance = (await publicClient!.readContract({
            address: aTokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [debtAddress],
          })) as bigint;

          if (currentCollateralBalance > 0) {
            collateralBalances.push({
              token: collateral.token,
              amount: currentCollateralBalance,
            });
          }
        } catch (error) {
          console.warn(`Failed to get collateral balance for ${collateral.token}:`, error);
          // Fallback to order data
          collateralBalances.push({
            token: collateral.token,
            amount: collateral.balance,
          });
        }
      }
    }

    console.log('💳 Current debt balances:', debtBalances);
    console.log('💎 Current collateral balances:', collateralBalances);

    // Approve payment token for premium
    const paymentTokenAllowance = (await publicClient!.readContract({
      address: fullSellOrderStruct.token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, routerAddress],
    })) as bigint;

    if (paymentTokenAllowance < paymentAmount) {
      console.log('🔓 Approving payment token for premium...');
      const approveTx = await writeContractAsync({
        address: fullSellOrderStruct.token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, paymentAmount],
      });
      console.log('✅ Payment token approval:', approveTx);
    }

    // Approve debt tokens for repayment
    for (const debt of debtBalances) {
      const currentAllowance = (await publicClient!.readContract({
        address: debt.token,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, routerAddress],
      })) as bigint;

      if (currentAllowance < debt.amount) {
        console.log(`🔓 Approving ${debt.token} for debt repayment...`);
        const approveTx = await writeContractAsync({
          address: debt.token,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [routerAddress, debt.amount],
        });
        console.log(`✅ Debt token approval for ${debt.token}:`, approveTx);
      }
    }

    // Prepare multicall data using encodeFunctionData
    const multicallData: `0x${string}`[] = [];

    // 1. Execute full sale order
    const executeOrderData = encodeFunctionData({
      abi: AAVE_ROUTER_ABI,
      functionName: 'executeFullSaleOrder',
      args: [fullSellOrderStruct, minProfit],
    });
    multicallData.push(executeOrderData);

    // 2. Repay all debts
    for (const debt of debtBalances) {
      const repayData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'callRepay',
        args: [debtAddress, debt.token, debt.amount, 2], // 2 = variable interest rate mode
      });
      multicallData.push(repayData);
    }

    // 3. Withdraw all collateral
    for (const collateral of collateralBalances) {
      const withdrawData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'callWithdraw',
        args: [debtAddress, collateral.token, collateral.amount, address!],
      });
      multicallData.push(withdrawData);
    }

    console.log(`🔧 Prepared multicall with ${multicallData.length} operations:`);
    console.log('  1. Execute full sale order');
    console.log(`  2-${1 + debtBalances.length}. Repay ${debtBalances.length} debt token(s)`);
    console.log(
      `  ${2 + debtBalances.length}-${1 + debtBalances.length + collateralBalances.length}. Withdraw ${
        collateralBalances.length
      } collateral token(s)`,
    );

    // Execute the multicall
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: 'multicall',
      args: [multicallData],
    });

    console.log('🎯 Auto-liquidation multicall executed:', txHash);
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
