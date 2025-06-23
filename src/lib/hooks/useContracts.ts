import { useMemo } from 'react';
import { Address } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { ChainId, getAaveRouterAddress } from '../contracts';
import { AAVE_POOL_ABI, ERC20_ABI } from '../contracts/abis';
import { AAVE_POOL_EXTENSIONS, CONTRACT_DEFAULTS } from '../contracts/config';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import {
  getMaxApprovalAmount,
  getTokenAddress,
  getWagmiActions,
  needsApproval,
  safeContractCall,
  validateWalletConnection,
} from '../utils/contract-helpers';

// Complete Aave Pool ABI
const AAVE_POOL_COMPLETE_ABI = [...AAVE_POOL_ABI, ...AAVE_POOL_EXTENSIONS] as const;

// Contract interaction types
export interface ContractConfig {
  address: Address;
  abi: any;
}

export interface DebtPositionData {
  debtAddress: Address;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  healthFactor: bigint;
  ltv: bigint;
  liquidationThreshold: bigint;
  isActive: boolean;
}

// Base contract hook
export function useContract<T = any>(config: ContractConfig) {
  const { writeContract } = useWriteContract();

  return useMemo(() => {
    const read = async (functionName: string, args: any[] = []) => {
      const { readContract, wagmiConfig } = await getWagmiActions();
      return readContract(wagmiConfig, {
        address: config.address,
        abi: config.abi,
        functionName,
        args,
      });
    };

    const write = async (functionName: string, args: any[] = []) => {
      return writeContract({
        address: config.address,
        abi: config.abi,
        functionName,
        args,
      });
    };

    return { read, write, address: config.address, abi: config.abi };
  }, [config.address, config.abi, writeContract]);
}

// Token Operations Hook
export function useTokenOperations(chainId: ChainId = CONTRACT_DEFAULTS.CHAIN_ID) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const routerAddress = getAaveRouterAddress(chainId);

  return useMemo(() => {
    const checkAllowance = async (tokenSymbol: string, spenderAddress?: Address): Promise<bigint> => {
      const userAddress = validateWalletConnection(address);
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol, chainId, SUPPORTED_TOKENS);

      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          return readContract(wagmiConfig, {
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [userAddress, spender],
          }) as Promise<bigint>;
        },
        'ERC20',
        'allowance',
        [userAddress, spender],
      );
    };

    const approveToken = async (tokenSymbol: string, amount: bigint, spenderAddress?: Address) => {
      validateWalletConnection(address);
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol, chainId, SUPPORTED_TOKENS);

      return writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
      });
    };

    const approveMaxToken = async (tokenSymbol: string, spenderAddress?: Address) => {
      return approveToken(tokenSymbol, getMaxApprovalAmount(), spenderAddress);
    };

    return { checkAllowance, approveToken, approveMaxToken };
  }, [address, chainId, routerAddress, writeContractAsync]);
}

// Multi-token operations hook
export function useMultiTokenOperations(chainId: ChainId = CONTRACT_DEFAULTS.CHAIN_ID) {
  const tokenOps = useTokenOperations(chainId);

  return useMemo(() => {
    const checkMultipleAllowances = async (
      tokens: Array<{ symbol: string; amount: bigint }>,
      spenderAddress?: Address,
    ) => {
      const results = await Promise.all(
        tokens.map(async ({ symbol, amount }) => {
          const allowance = await tokenOps.checkAllowance(symbol, spenderAddress);
          return {
            symbol,
            amount,
            allowance,
            needsApproval: needsApproval(allowance, amount),
          };
        }),
      );
      return results;
    };

    const approveMultipleTokens = async (
      tokens: Array<{ symbol: string; amount: bigint }>,
      spenderAddress?: Address,
    ) => {
      const allowanceCheck = await checkMultipleAllowances(tokens, spenderAddress);
      const tokensNeedingApproval = allowanceCheck.filter(t => t.needsApproval);

      if (tokensNeedingApproval.length === 0) {
        return { allApproved: true, approvalResults: [] };
      }

      const approvalResults = [];
      for (const token of tokensNeedingApproval) {
        try {
          await tokenOps.approveMaxToken(token.symbol, spenderAddress);
          approvalResults.push({ symbol: token.symbol, success: true });
        } catch (error) {
          approvalResults.push({ symbol: token.symbol, success: false, error });
        }
      }

      return {
        allApproved: approvalResults.every(r => r.success),
        approvalResults,
      };
    };

    return { checkMultipleAllowances, approveMultipleTokens };
  }, [tokenOps]);
}

export default {
  useContract,
  useTokenOperations,
  useMultiTokenOperations,
};
