import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Address } from "viem";
import { getAaveRouterAddress } from "../contracts";
import { AAVE_ROUTER_ABI } from "../contracts/abis";
import { logger } from "../utils/logger";

export interface CancelOrderParams {
  debt: Address;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: number;
}

export interface OrderTitle {
  debt: Address;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: number;
}

export function useOrderCancellation() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  );

  // Cancel a specific order
  const cancelOrder = async (params: CancelOrderParams) => {
    if (!address || !chainId || !publicClient) {
      throw new Error("Wallet not connected");
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setIsCancelling(true);
    setCancellingOrderId(`${params.debt}-${params.debtNonce}`);

    try {
      logger.info("🚫 Cancelling order:", params);

      // Construct the OrderTitle struct
      const orderTitle: OrderTitle = {
        debt: params.debt,
        debtNonce: params.debtNonce,
        startTime: params.startTime,
        endTime: params.endTime,
        triggerHF: params.triggerHF,
      };

      // Call the contract's cancelOrder function
      const txHash = await writeContractAsync({
        address: routerAddress,
        abi: AAVE_ROUTER_ABI,
        functionName: "cancelOrder",
        args: [orderTitle],
      });

      logger.info("✅ Order cancellation transaction submitted:", txHash);
      logger.info("⏳ Waiting for transaction confirmation...");

      // Wait for transaction to be confirmed
      await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000, // 60 second timeout
      });

      logger.info("✅ Order cancelled successfully and confirmed");
      return txHash;
    } catch (error) {
      logger.error("❌ Order cancellation failed:", error);
      throw error;
    } finally {
      setIsCancelling(false);
      setCancellingOrderId(null);
    }
  };

  // Cancel all orders for a debt position
  const cancelAllOrders = async (debtAddress: Address) => {
    if (!address || !chainId || !publicClient) {
      throw new Error("Wallet not connected");
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setIsCancelling(true);
    setCancellingOrderId(`all-${debtAddress}`);

    try {
      logger.info("🚫 Cancelling all orders for debt position:", debtAddress);

      // Call the contract's cancelDebtCurrentOrders function
      const txHash = await writeContractAsync({
        address: routerAddress,
        abi: AAVE_ROUTER_ABI,
        functionName: "cancelDebtCurrentOrders",
        args: [debtAddress],
      });

      logger.info("✅ Cancel all orders transaction submitted:", txHash);
      logger.info("⏳ Waiting for transaction confirmation...");

      // Wait for transaction to be confirmed
      await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000, // 60 second timeout
      });

      logger.info("✅ All orders cancelled successfully and confirmed");
      return txHash;
    } catch (error) {
      logger.error("❌ Cancel all orders failed:", error);
      throw error;
    } finally {
      setIsCancelling(false);
      setCancellingOrderId(null);
    }
  };

  return {
    cancelOrder,
    cancelAllOrders,
    isCancelling,
    cancellingOrderId,
  };
}
