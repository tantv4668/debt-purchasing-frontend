// Examples demonstrating the reusable contract system
import { parseUnits } from "viem";
import { ChainId } from "../../contracts";
import { useMultiTokenOperations, useTokenOperations } from "../useContracts";

// Example 1: Simple token approval for any spender
export function useTokenApprovalForSpender() {
  const tokenOps = useTokenOperations(ChainId.SEPOLIA);

  const approveTokenForSpecificSpender = async (
    tokenSymbol: string,
    spenderAddress: `0x${string}`,
    amount: string,
    decimals: number
  ) => {
    const amountBigInt = parseUnits(amount, decimals);

    // Check current allowance
    const allowance = await tokenOps.checkAllowance(
      tokenSymbol,
      spenderAddress
    );

    if (allowance >= amountBigInt) {
      return { success: true, txRequired: false, message: "Already approved" };
    }

    // Approve max amount for better UX
    await tokenOps.approveMaxToken(tokenSymbol, spenderAddress);
    return { success: true, txRequired: true, message: "Approval successful" };
  };

  return { approveTokenForSpecificSpender };
}

// Example 2: Batch token operations for DeFi protocols
export function useBatchTokenOperations() {
  const multiTokenOps = useMultiTokenOperations(ChainId.SEPOLIA);

  const prepareBatchSwap = async (
    swapTokens: Array<{ symbol: string; amount: string; decimals: number }>,
    routerAddress: `0x${string}`
  ) => {
    // Convert to proper format
    const tokens = swapTokens.map((token) => ({
      symbol: token.symbol,
      amount: parseUnits(token.amount, token.decimals),
    }));

    // Check all allowances at once
    const allowanceStatus = await multiTokenOps.checkMultipleAllowances(
      tokens,
      routerAddress
    );

    // Approve only tokens that need approval
    const tokensNeedingApproval = allowanceStatus.filter(
      (t) => t.needsApproval
    );

    if (tokensNeedingApproval.length > 0) {
      const approvalResult = await multiTokenOps.approveMultipleTokens(
        tokens,
        routerAddress
      );
      return {
        readyForSwap: approvalResult.allApproved,
        approvalResults: approvalResult.approvalResults,
        tokensApproved: tokensNeedingApproval.length,
      };
    }

    return {
      readyForSwap: true,
      approvalResults: [],
      tokensApproved: 0,
      message: "All tokens already approved",
    };
  };

  return { prepareBatchSwap };
}

// Example 3: Direct ERC20 interactions for specific token
export function useSpecificTokenContract(tokenAddress: `0x${string}`) {
  // Note: This example shows how you would use the generic useContract hook
  // to interact with ERC20 tokens directly
  const { useContract } = require("../useContracts");

  // You would set up the contract like this:
  // const erc20 = useContract({
  //   address: tokenAddress,
  //   abi: ERC20_ABI,
  // });

  const getTokenDetails = async () => {
    // Example implementation - you would use the actual contract instance
    console.log("Getting token details for", tokenAddress);
    return {
      name: "Example Token",
      symbol: "EXT",
      decimals: 18,
      totalSupply: BigInt(1000000),
    };
  };

  const transferToken = async (to: `0x${string}`, amount: bigint) => {
    console.log("Transferring token", { to, amount });
    // Return example transaction hash
    return "0x..." as `0x${string}`;
  };

  const checkBalance = async (account: `0x${string}`) => {
    console.log("Checking balance for", account);
    return BigInt(1000);
  };

  return {
    getTokenDetails,
    transferToken,
    checkBalance,
  };
}

// Example 4: Aave Router operations
export function useAavePositionManager() {
  // Note: This is a simplified example. In practice, you would use useContract
  // with the Aave Router ABI to interact with the router contract
  const { useContract } = require("../useContracts");

  // This example shows how you would set up the contract interaction
  const createPositionWithSupplyAndBorrow = async (
    userAddress: `0x${string}`,
    collateralToken: `0x${string}`,
    collateralAmount: bigint,
    borrowToken: `0x${string}`,
    borrowAmount: bigint,
    interestRateMode: 1 | 2 = 2
  ) => {
    // Example implementation - you would need to use the actual contract instance
    console.log("Creating position with supply and borrow", {
      userAddress,
      collateralToken,
      collateralAmount,
      borrowToken,
      borrowAmount,
      interestRateMode,
    });

    // Return example data
    return { debtAddress: "0x..." as `0x${string}`, userNonce: BigInt(0) };
  };

  return {
    createPositionWithSupplyAndBorrow,
  };
}

// Example 5: Generic contract interaction for any protocol
export function useGenericProtocolInteraction(
  protocolAddress: `0x${string}`,
  protocolABI: any
) {
  const { useContract } = require("../useContracts");
  const contract = useContract({
    address: protocolAddress,
    abi: protocolABI,
  });

  const readContractFunction = async (
    functionName: string,
    args: any[] = []
  ) => {
    return contract.read(functionName, args);
  };

  const writeContractFunction = async (
    functionName: string,
    args: any[] = []
  ) => {
    return contract.write(functionName, args);
  };

  return {
    readContractFunction,
    writeContractFunction,
    contractAddress: contract.address,
  };
}
