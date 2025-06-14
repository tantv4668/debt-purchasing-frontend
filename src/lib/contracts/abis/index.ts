// Contract ABIs
import AaveDebtABI from './AaveDebt.json';
import AaveOracleABI from './AaveOracle.json';
import AavePoolABI from './AavePool.json';
import AaveRouterABI from './AaveRouter.json';
import ChainlinkAggregatorABI from './ChainlinkAggregator.json';

// Export ABIs with proper typing
export const AAVE_ROUTER_ABI = AaveRouterABI.abi || AaveRouterABI;
export const AAVE_ORACLE_ABI = AaveOracleABI;
export const AAVE_POOL_ABI = AavePoolABI;
export const AAVE_DEBT_ABI = AaveDebtABI.abi || AaveDebtABI;
export const CHAINLINK_AGGREGATOR_ABI = ChainlinkAggregatorABI;

// ABI mapping for easier access
export const CONTRACT_ABIS = {
  aaveRouter: AAVE_ROUTER_ABI,
  aaveOracle: AAVE_ORACLE_ABI,
  aavePool: AAVE_POOL_ABI,
  aaveDebt: AAVE_DEBT_ABI,
  chainlinkAggregator: CHAINLINK_AGGREGATOR_ABI,
} as const;

export type ContractName = keyof typeof CONTRACT_ABIS;
