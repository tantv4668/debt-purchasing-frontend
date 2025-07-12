import { useState } from "react";
import { Address, encodeFunctionData } from "viem";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useChainId,
} from "wagmi";
import { getAaveRouterAddress } from "../contracts";
import { AAVE_ROUTER_ABI, ERC20_ABI } from "../contracts/abis";
import { MarketOrder } from "../types";
import { orderApiService } from "../utils/order-api";
import { useAavePool } from "./useContracts";
import { decimalToWei } from "../utils/token-helpers";

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

  const executeOrder = async (
    order: MarketOrder,
    options: ExecuteOrderOptions = {}
  ) => {
    console.log("🚀 executeOrder called with order:", order);
    console.log("🚀 order.bonus:", order.bonus, typeof order.bonus);
    console.log("🚀 order.type:", order.type);
    console.log("🚀 order.paymentToken:", order.paymentToken);

    if (!address || !chainId || !publicClient) {
      throw new Error("Wallet not connected");
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setIsExecuting(true);
    setExecutingOrderId(order.id);

    try {
      console.log(
        "🔄 Executing order:",
        order.id,
        "type:",
        order.type,
        "options:",
        options
      );

      // Get the full order details with real signatures from backend
      const fullOrderData = await orderApiService.getOrderById(order.id);
      console.log("📄 Full order data:", fullOrderData);

      let txHash;
      if (order.type === "full") {
        txHash = await executeFullSaleOrder(
          order,
          fullOrderData,
          routerAddress,
          options
        );
      } else {
        txHash = await executePartialSaleOrder(
          order,
          fullOrderData,
          routerAddress
        );
      }

      console.log("✅ Order execution transaction submitted:", txHash);
      console.log("⏳ Waiting for transaction confirmation...");

      // Wait for transaction to be confirmed
      await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000, // 60 second timeout
      });

      console.log("✅ Order executed successfully and confirmed:", order.id);
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
    options: ExecuteOrderOptions = {}
  ) => {
    if (
      order.type !== "full" ||
      !order.paymentToken ||
      order.bonus === undefined ||
      order.bonus === null
    ) {
      throw new Error(
        "Invalid full sale order data - missing bonus, payment token, or invalid type"
      );
    }

    const fullSellOrder = fullOrderData.fullSellOrder;
    if (!fullSellOrder) {
      throw new Error("Full sell order data not found");
    }

    console.log(
      "💰 Executing full sale order with payment token:",
      order.paymentToken
    );
    console.log("🏦 Options:", options);

    // Calculate payment amount using new bonus logic
    // bonusAmount = totalDebtBase * bonus / 10000
    // sellerPayment = totalCollateralBase - totalDebtBase - bonusAmount

    const bonusAmount =
      (order.debtPosition.totalDebtBase * BigInt(order.bonus)) / BigInt(10000);
    const sellerPayment =
      order.debtPosition.totalCollateralBase -
      order.debtPosition.totalDebtBase -
      bonusAmount;

    console.log("💸 Payment calculation:", {
      totalCollateralBase: order.debtPosition.totalCollateralBase.toString(),
      totalDebtBase: order.debtPosition.totalDebtBase.toString(),
      bonus: `${order.bonus}%`,
      bonusAmount: bonusAmount.toString(),
      sellerPayment: sellerPayment.toString(),
    });

    // DEBUG: Uncomment below if debugging field issues
    // console.log("🔍 DEBUG fullSellOrder fields:", {
    //   debtNonce: fullSellOrder.debtNonce,
    //   startTime: fullSellOrder.startTime,
    //   endTime: fullSellOrder.endTime,
    //   triggerHF: fullSellOrder.triggerHF,
    //   bonus: fullSellOrder.bonus,
    //   token: fullSellOrder.token,
    //   debt: fullSellOrder.debt,
    //   v: fullSellOrder.v,
    //   r: fullSellOrder.r,
    //   s: fullSellOrder.s,
    // });

    // Validate required fields before BigInt conversion
    if (
      fullSellOrder.debtNonce === undefined ||
      fullSellOrder.debtNonce === null ||
      fullSellOrder.startTime === undefined ||
      fullSellOrder.startTime === null ||
      fullSellOrder.endTime === undefined ||
      fullSellOrder.endTime === null ||
      fullSellOrder.triggerHF === undefined ||
      fullSellOrder.triggerHF === null ||
      fullSellOrder.bonus === undefined ||
      fullSellOrder.bonus === null
    ) {
      throw new Error(
        "Missing required order fields: debtNonce, startTime, endTime, triggerHF, or bonus"
      );
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
      bonus: BigInt(fullSellOrder.bonus), // Use bonus instead of percentOfEquity
      v: fullSellOrder.v,
      r: fullSellOrder.r as `0x${string}`,
      s: fullSellOrder.s as `0x${string}`,
    };

    // DEBUG: Uncomment below if debugging struct issues
    // console.log("🔍 FINAL fullSellOrderStruct:", {
    //   title: {
    //     debt: fullSellOrderStruct.title.debt,
    //     debtNonce: fullSellOrderStruct.title.debtNonce?.toString(),
    //     startTime: fullSellOrderStruct.title.startTime?.toString(),
    //     endTime: fullSellOrderStruct.title.endTime?.toString(),
    //     triggerHF: fullSellOrderStruct.title.triggerHF?.toString(),
    //   },
    //   token: fullSellOrderStruct.token,
    //   bonus: fullSellOrderStruct.bonus?.toString(),
    //   v: fullSellOrderStruct.v,
    //   r: fullSellOrderStruct.r,
    //   s: fullSellOrderStruct.s,
    // });

    // Validate final struct has no undefined values
    if (
      !fullSellOrderStruct.title.debt ||
      !fullSellOrderStruct.token ||
      fullSellOrderStruct.v === undefined ||
      !fullSellOrderStruct.r ||
      !fullSellOrderStruct.s
    ) {
      throw new Error(
        "Final struct validation failed - undefined values found in debt, token, v, r, or s"
      );
    }

    console.log("📝 Executing with order struct:", {
      ...fullSellOrderStruct,
      title: {
        ...fullSellOrderStruct.title,
        debt: fullSellOrderStruct.title.debt,
        debtNonce: fullSellOrderStruct.title.debtNonce.toString(),
        startTime: fullSellOrderStruct.title.startTime.toString(),
        endTime: fullSellOrderStruct.title.endTime.toString(),
        triggerHF: fullSellOrderStruct.title.triggerHF.toString(),
      },
      bonus: fullSellOrderStruct.bonus.toString(),
    });

    // Check if auto-liquidation is requested
    if (options.autoLiquidate) {
      console.log(
        "🔄 Auto-liquidation requested - preparing multicall transaction"
      );
      return await executeFullSaleOrderWithLiquidation(
        fullSellOrderStruct,
        order,
        routerAddress,
        options.minProfit || BigInt(0)
      );
    } else {
      console.log("💰 Standard execution - ownership transfer only");
      return await executeFullSaleOrderStandard(
        fullSellOrderStruct,
        sellerPayment,
        routerAddress
      );
    }
  };

  const executeFullSaleOrderStandard = async (
    fullSellOrderStruct: any,
    paymentAmount: bigint,
    routerAddress: Address
  ) => {
    // Check current allowance
    const currentAllowance = (await publicClient!.readContract({
      address: fullSellOrderStruct.token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address!, routerAddress],
    })) as bigint;

    console.log("📋 Current allowance:", currentAllowance.toString());

    // Approve token if needed
    if (currentAllowance < paymentAmount) {
      console.log("🔓 Approving payment token...");

      // DEBUG: Uncomment below if debugging approval issues
      // console.log("🔍 APPROVAL PARAMETERS:", {
      //   tokenAddress: fullSellOrderStruct.token,
      //   routerAddress,
      //   paymentAmount: paymentAmount?.toString(),
      //   functionName: "approve",
      // });

      const approveTx = await writeContractAsync({
        address: fullSellOrderStruct.token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, paymentAmount],
      });
      console.log("✅ Approval transaction:", approveTx);
    }

    // DEBUG: Uncomment below if debugging contract call issues
    const minProfit = BigInt(0);
    // console.log("🔍 CONTRACT CALL PARAMETERS:", {
    //   address: routerAddress,
    //   functionName: "executeFullSaleOrder",
    //   args: ["fullSellOrderStruct (see above)", minProfit?.toString()],
    //   routerAddress,
    //   minProfit: minProfit?.toString(),
    // });

    // Execute the full sale order
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: "executeFullSaleOrder",
      args: [fullSellOrderStruct, minProfit], // minProfit = 0 for standard execution
    });

    console.log("🎯 Full sale order executed (standard):", txHash);
    return txHash;
  };

  const executeFullSaleOrderWithLiquidation = async (
    fullSellOrderStruct: any,
    order: MarketOrder,
    routerAddress: Address,
    minProfit: bigint
  ) => {
    const debtAddress = fullSellOrderStruct.title.debt;

    // Calculate payment amount using new bonus logic
    if (order.bonus === undefined || order.bonus === null) {
      throw new Error("Bonus is required for full sale order execution");
    }
    const bonusAmount =
      (order.debtPosition.totalDebtBase * BigInt(order.bonus)) / BigInt(10000);
    const paymentAmount =
      order.debtPosition.totalCollateralBase -
      order.debtPosition.totalDebtBase -
      bonusAmount;

    console.log("🔄 Preparing multicall with auto-liquidation...");

    // Get current debt and collateral balances from the blockchain
    const debtBalances: { token: Address; amount: bigint }[] = [];
    const collateralBalances: { token: Address; amount: bigint }[] = [];

    // Get actual debt token balances (variable debt tokens)
    for (const debt of order.debtPosition.debts) {
      if (debt.balance > 0) {
        try {
          // Use the proper hook to get token addresses
          const { variableDebtTokenAddress } = await aavePool.getTokenAddresses(
            debt.token
          );

          // Get current variable debt balance
          const currentDebtBalance = (await publicClient!.readContract({
            address: variableDebtTokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
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
          const { aTokenAddress } = await aavePool.getTokenAddresses(
            collateral.token
          );

          // Get current aToken balance
          const currentCollateralBalance = (await publicClient!.readContract({
            address: aTokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [debtAddress],
          })) as bigint;

          if (currentCollateralBalance > 0) {
            collateralBalances.push({
              token: collateral.token,
              amount: currentCollateralBalance,
            });
          }
        } catch (error) {
          console.warn(
            `Failed to get collateral balance for ${collateral.token}:`,
            error
          );
          // Fallback to order data
          collateralBalances.push({
            token: collateral.token,
            amount: collateral.balance,
          });
        }
      }
    }

    console.log("💳 Current debt balances:", debtBalances);
    console.log("💎 Current collateral balances:", collateralBalances);

    // Approve payment token for premium
    const paymentTokenAllowance = (await publicClient!.readContract({
      address: fullSellOrderStruct.token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address!, routerAddress],
    })) as bigint;

    if (paymentTokenAllowance < paymentAmount) {
      console.log("🔓 Approving payment token for premium...");
      const approveTx = await writeContractAsync({
        address: fullSellOrderStruct.token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, paymentAmount],
      });
      console.log("✅ Payment token approval:", approveTx);
    }

    // Approve debt tokens for repayment
    for (const debt of debtBalances) {
      const currentAllowance = (await publicClient!.readContract({
        address: debt.token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address!, routerAddress],
      })) as bigint;

      if (currentAllowance < debt.amount) {
        console.log(`🔓 Approving ${debt.token} for debt repayment...`);
        const approveTx = await writeContractAsync({
          address: debt.token,
          abi: ERC20_ABI,
          functionName: "approve",
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
      functionName: "executeFullSaleOrder",
      args: [fullSellOrderStruct, minProfit],
    });
    multicallData.push(executeOrderData);

    // 2. Repay all debts
    for (const debt of debtBalances) {
      const repayData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: "callRepay",
        args: [debtAddress, debt.token, debt.amount, 2], // 2 = variable interest rate mode
      });
      multicallData.push(repayData);
    }

    // 3. Withdraw all collateral
    for (const collateral of collateralBalances) {
      const withdrawData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: "callWithdraw",
        args: [debtAddress, collateral.token, collateral.amount, address!],
      });
      multicallData.push(withdrawData);
    }

    console.log(
      `🔧 Prepared multicall with ${multicallData.length} operations:`
    );
    console.log("  1. Execute full sale order");
    console.log(
      `  2-${1 + debtBalances.length}. Repay ${debtBalances.length} debt token(s)`
    );
    console.log(
      `  ${2 + debtBalances.length}-${1 + debtBalances.length + collateralBalances.length}. Withdraw ${
        collateralBalances.length
      } collateral token(s)`
    );

    // Execute the multicall
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: "multicall",
      args: [multicallData],
    });

    console.log("🎯 Auto-liquidation multicall executed:", txHash);
    return txHash;
  };

  const executePartialSaleOrder = async (
    order: MarketOrder,
    fullOrderData: any,
    routerAddress: Address
  ) => {
    if (order.type !== "partial" || !order.repayToken || !order.repayAmount) {
      throw new Error("Invalid partial sale order data");
    }

    const partialSellOrder = fullOrderData.partialSellOrder;
    if (!partialSellOrder) {
      throw new Error("Partial sell order data not found");
    }

    console.log(
      "🔧 Executing partial sale order with repay token:",
      order.repayToken
    );
    console.log("💰 Repay amount:", order.repayAmount);

    // Convert repay amount to wei using proper token decimals
    const repayAmountWei = decimalToWei(
      order.repayAmount,
      order.repayToken,
      chainId!
    );

    // Check current allowance for repay token
    const currentAllowance = (await publicClient!.readContract({
      address: order.repayToken,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address!, routerAddress],
    })) as bigint;

    console.log(
      "📋 Current repay token allowance:",
      currentAllowance.toString()
    );

    // Approve repay token if needed
    if (currentAllowance < repayAmountWei) {
      console.log("🔓 Approving repay token...");
      const approveTx = await writeContractAsync({
        address: order.repayToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, repayAmountWei],
      });
      console.log("✅ Repay token approval transaction:", approveTx);
    }

    // DEBUG: Uncomment below if debugging partial order field issues
    // console.log("🔍 DEBUG partialSellOrder fields:", {
    //   debtNonce: partialSellOrder.debtNonce,
    //   startTime: partialSellOrder.startTime,
    //   endTime: partialSellOrder.endTime,
    //   triggerHF: partialSellOrder.triggerHF,
    //   bonus: partialSellOrder.bonus,
    //   repayToken: partialSellOrder.repayToken,
    //   repayAmount: partialSellOrder.repayAmount,
    //   collateralOut: partialSellOrder.collateralOut,
    //   interestRateMode: partialSellOrder.interestRateMode,
    //   debt: partialSellOrder.debt,
    //   v: partialSellOrder.v,
    //   r: partialSellOrder.r,
    //   s: partialSellOrder.s,
    // });

    // Validate required fields before BigInt conversion
    if (
      partialSellOrder.debtNonce === undefined ||
      partialSellOrder.debtNonce === null ||
      partialSellOrder.startTime === undefined ||
      partialSellOrder.startTime === null ||
      partialSellOrder.endTime === undefined ||
      partialSellOrder.endTime === null ||
      partialSellOrder.triggerHF === undefined ||
      partialSellOrder.triggerHF === null ||
      partialSellOrder.bonus === undefined ||
      partialSellOrder.bonus === null
    ) {
      throw new Error(
        "Missing required partial order fields: debtNonce, startTime, endTime, triggerHF, or bonus"
      );
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
      collateralOut: partialSellOrder.collateralOut as Address, // Single address instead of array
      repayToken: partialSellOrder.repayToken as Address,
      repayAmount: decimalToWei(
        partialSellOrder.repayAmount,
        partialSellOrder.repayToken,
        chainId!
      ), // Convert decimal from DB to wei using proper token decimals
      bonus: BigInt(partialSellOrder.bonus),
      v: partialSellOrder.v,
      r: partialSellOrder.r as `0x${string}`,
      s: partialSellOrder.s as `0x${string}`,
    };

    console.log(
      "📝 Executing with partial order struct:",
      partialSellOrderStruct
    );

    // Execute the partial sale order
    const txHash = await writeContractAsync({
      address: routerAddress,
      abi: AAVE_ROUTER_ABI,
      functionName: "excutePartialSellOrder", // Note: keeping the typo from contract
      args: [partialSellOrderStruct],
    });

    console.log("🎯 Partial sale order executed:", txHash);
    return txHash;
  };

  return {
    executeOrder,
    isExecuting,
    executingOrderId,
  };
}
