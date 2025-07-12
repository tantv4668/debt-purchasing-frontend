// Contract ABIs
import type { Abi } from "viem";
import AaveDebtABI from "./AaveDebt.json";
import AaveOracleABI from "./AaveOracle.json";
import AavePoolABI from "./AavePool.json";
import AaveRouterABI from "./AaveRouter.json";
import ChainlinkAggregatorABI from "./ChainlinkAggregator.json";
import ERC20ABI_RAW from "./ERC20.json";

// Export ABIs with proper typing
export const AAVE_ROUTER_ABI = AaveRouterABI as Abi;
export const AAVE_ORACLE_ABI = AaveOracleABI as Abi;
export const AAVE_POOL_ABI = AavePoolABI as Abi;
export const AAVE_DEBT_ABI = (AaveDebtABI as any).abi as Abi;
export const CHAINLINK_AGGREGATOR_ABI = ChainlinkAggregatorABI as Abi;
export const ERC20_ABI = (ERC20ABI_RAW as any).abi as Abi;

// ABI mapping for easier access
export const CONTRACT_ABIS = {
  aaveRouter: AAVE_ROUTER_ABI,
  aaveOracle: AAVE_ORACLE_ABI,
  aavePool: AAVE_POOL_ABI,
  aaveDebt: AAVE_DEBT_ABI,
  chainlinkAggregator: CHAINLINK_AGGREGATOR_ABI,
  erc20: ERC20_ABI,
} as const;

export type ContractName = keyof typeof CONTRACT_ABIS;
