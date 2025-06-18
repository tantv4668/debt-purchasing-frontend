// Examples demonstrating the reusable contract system
import { parseUnits } from 'viem';
import { ChainId } from '../../contracts';
import { useAaveRouterContract, useERC20Contract, useMultiTokenOperations, useTokenOperations } from '../useContracts';

// Example 1: Simple token approval for any spender
export function useTokenApprovalForSpender() {
  const tokenOps = useTokenOperations(ChainId.SEPOLIA);

  const approveTokenForSpecificSpender = async (
    tokenSymbol: string,
    spenderAddress: `0x${string}`,
    amount: string,
    decimals: number,
  ) => {
    const amountBigInt = parseUnits(amount, decimals);

    // Check current allowance
    const allowance = await tokenOps.checkAllowance(tokenSymbol, spenderAddress);

    if (allowance >= amountBigInt) {
      return { success: true, txRequired: false, message: 'Already approved' };
    }

    // Approve max amount for better UX
    await tokenOps.approveMaxToken(tokenSymbol, spenderAddress);
    return { success: true, txRequired: true, message: 'Approval successful' };
  };

  return { approveTokenForSpecificSpender };
}

// Example 2: Batch token operations for DeFi protocols
export function useBatchTokenOperations() {
  const multiTokenOps = useMultiTokenOperations(ChainId.SEPOLIA);

  const prepareBatchSwap = async (
    swapTokens: Array<{ symbol: string; amount: string; decimals: number }>,
    routerAddress: `0x${string}`,
  ) => {
    // Convert to proper format
    const tokens = swapTokens.map(token => ({
      symbol: token.symbol,
      amount: parseUnits(token.amount, token.decimals),
    }));

    // Check all allowances at once
    const allowanceStatus = await multiTokenOps.checkMultipleAllowances(tokens, routerAddress);

    // Approve only tokens that need approval
    const tokensNeedingApproval = allowanceStatus.filter(t => t.needsApproval);

    if (tokensNeedingApproval.length > 0) {
      const approvalResult = await multiTokenOps.approveMultipleTokens(tokens, routerAddress);
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
      message: 'All tokens already approved',
    };
  };

  return { prepareBatchSwap };
}

// Example 3: Direct ERC20 interactions for specific token
export function useSpecificTokenContract(tokenAddress: `0x${string}`) {
  const erc20 = useERC20Contract(tokenAddress);

  const getTokenDetails = async () => {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      erc20.name(),
      erc20.symbol(),
      erc20.decimals(),
      erc20.totalSupply(),
    ]);

    return { name, symbol, decimals, totalSupply };
  };

  const transferToken = async (to: `0x${string}`, amount: bigint) => {
    return erc20.transfer(to, amount);
  };

  const checkBalance = async (account: `0x${string}`) => {
    return erc20.balanceOf(account);
  };

  return {
    getTokenDetails,
    transferToken,
    checkBalance,
    approve: erc20.approve,
    allowance: erc20.allowance,
  };
}

// Example 4: Aave Router operations
export function useAavePositionManager() {
  const aaveRouter = useAaveRouterContract(ChainId.SEPOLIA);

  const createPositionWithSupplyAndBorrow = async (
    userAddress: `0x${string}`,
    collateralToken: `0x${string}`,
    collateralAmount: bigint,
    borrowToken: `0x${string}`,
    borrowAmount: bigint,
    interestRateMode: 1 | 2 = 2,
  ) => {
    // Get user's nonce to predict debt address
    const userNonce = await aaveRouter.userNonces(userAddress);
    const debtAddress = await aaveRouter.predictDebtAddress(userAddress, userNonce);

    // Create position with multicall
    const multicallData = [
      // Create debt position
      '0x...', // createDebt encoded data
      // Supply collateral
      '0x...', // callSupply encoded data
      // Borrow asset
      '0x...', // callBorrow encoded data
    ];

    await aaveRouter.multicall(multicallData as `0x${string}`[]);

    return { debtAddress, userNonce };
  };

  return {
    createPositionWithSupplyAndBorrow,
    createDebt: aaveRouter.createDebt,
    callSupply: aaveRouter.callSupply,
    callBorrow: aaveRouter.callBorrow,
    multicall: aaveRouter.multicall,
    userNonces: aaveRouter.userNonces,
    predictDebtAddress: aaveRouter.predictDebtAddress,
  };
}

// Example 5: Generic contract interaction for any protocol
export function useGenericProtocolInteraction(protocolAddress: `0x${string}`, protocolABI: any) {
  const { useContract } = require('../useContracts');
  const contract = useContract({
    address: protocolAddress,
    abi: protocolABI,
  });

  const readContractFunction = async (functionName: string, args: any[] = []) => {
    return contract.read(functionName, args);
  };

  const writeContractFunction = async (functionName: string, args: any[] = []) => {
    return contract.write(functionName, args);
  };

  return {
    readContractFunction,
    writeContractFunction,
    contractAddress: contract.address,
  };
}
