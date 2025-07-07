import { ChainId } from "./chains";

export interface ContractAddresses {
  aaveRouter: string;
  poolAddressesProvider: string;
  poolProxy: string;
  poolConfiguratorProxy: string;
  aclManager: string;
  aaveOracle: string;
  oracleManager: string;
}

export const CONTRACT_ADDRESSES: Record<ChainId, ContractAddresses> = {
  [ChainId.MAINNET]: {
    aaveRouter: "0x0000000000000000000000000000000000000000", // To be deployed
    poolAddressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
    poolProxy: "0x87870Bace4E8d77e0e1C8FD1aB0b77D0aE0e6E72",
    poolConfiguratorProxy: "0x64b761D848206f447Fe2dd461b0c635Ec39EbB27",
    aclManager: "0xc2aaCf6553D20d1e9d78E365AAba8032af9c85b0",
    aaveOracle: "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
    oracleManager: "0x0000000000000000000000000000000000000000", // To be added
  },
  [ChainId.SEPOLIA]: {
    aaveRouter: "0x7E9dB2C6CB9900036DDA8780e44A0103dD73bB4a",
    poolAddressesProvider: "0x2dd7e9422f8aeda720b4d5836f9101794252b798",
    poolProxy: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    poolConfiguratorProxy: "0xa254b63ab427b00a57d6a31a9cb71f20ffa351da",
    aclManager: "0x184082cc3af56e9aaf72d15f72e2ba5ecdec4804",
    aaveOracle: "0xad0e73a1df939550038cefeccd728b18bc5683b7",
    oracleManager: "0x559dc45423cbd15fdef88dca332f56478cea080a",
  },
};

// Helper function to get all contract addresses for a chain
export function getContractAddresses(chainId: ChainId): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`Contract addresses not found for chain ${chainId}`);
  }
  return addresses;
}

// Helper function to get a specific contract address
export function getContractAddress(
  chainId: ChainId,
  contractName: keyof ContractAddresses
): string {
  const addresses = getContractAddresses(chainId);
  const address = addresses[contractName];

  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `Contract ${contractName} not deployed on chain ${chainId}`
    );
  }

  return address;
}
