import { useMemo } from 'react';
import { Address } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { ChainId, getAaveRouterAddress } from '../contracts';
import { ERC20_ABI } from '../contracts/abis';
import { SUPPORTED_TOKENS } from '../contracts/tokens';

// Contract interaction types
export interface ContractConfig {
  address: Address;
  abi: any;
}

// Base contract hook - for advanced users who need direct contract access
export function useContract<T = any>(config: ContractConfig) {
  const { writeContract } = useWriteContract();

  return useMemo(() => {
    const read = async (functionName: string, args: any[] = []) => {
      const { readContract } = await import('wagmi/actions');
      const { config: wagmiConfig } = await import('../wagmi');

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

// Token Operations Hook - Simplified token operations for approvals
export function useTokenOperations(chainId: ChainId = ChainId.SEPOLIA) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const routerAddress = getAaveRouterAddress(chainId);

  return useMemo(() => {
    const getTokenAddress = (tokenSymbol: string) => {
      const token = SUPPORTED_TOKENS[tokenSymbol];
      if (!token || !token.addresses[chainId]) {
        throw new Error(`Token ${tokenSymbol} not supported on chain ${chainId}`);
      }
      return token.addresses[chainId] as Address;
    };

    const checkAllowance = async (tokenSymbol: string, spenderAddress?: Address) => {
      if (!address) throw new Error('Wallet not connected');
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol);

      const { readContract } = await import('wagmi/actions');
      const { config: wagmiConfig } = await import('../wagmi');

      const allowance = (await readContract(wagmiConfig, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, spender],
      })) as bigint;
      return allowance;
    };

    const approveToken = async (tokenSymbol: string, amount: bigint, spenderAddress?: Address) => {
      if (!address) throw new Error('Wallet not connected');
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol);

      return writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
      });
    };

    const approveMaxToken = async (tokenSymbol: string, spenderAddress?: Address) => {
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      return approveToken(tokenSymbol, maxAmount, spenderAddress);
    };

    return {
      checkAllowance,
      approveToken,
      approveMaxToken,
    };
  }, [address, chainId, routerAddress, writeContractAsync]);
}

// Multi-token operations hook - For batch operations
export function useMultiTokenOperations(chainId: ChainId = ChainId.SEPOLIA) {
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
            needsApproval: allowance < amount,
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

      const allApproved = approvalResults.every(r => r.success);
      return { allApproved, approvalResults };
    };

    return {
      checkMultipleAllowances,
      approveMultipleTokens,
    };
  }, [tokenOps]);
}

export default {
  useContract,
  useTokenOperations,
  useMultiTokenOperations,
};
