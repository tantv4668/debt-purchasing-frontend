import { Hex, WalletClient, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { FullSellOrderData, PartialSellOrderData } from './order-api';

// Type hashes that match the contract logic
const FULL_SELL_ORDER_TYPE_HASH = keccak256(
  Buffer.from(
    'FullSellOrder(uint256 chainId,address contract,OrderTitle title,address token,uint256 percentOfEquity)',
    'utf8',
  ),
);

const PARTIAL_SELL_ORDER_TYPE_HASH = keccak256(
  Buffer.from(
    'PartialSellOrder(uint256 chainId,address contract,OrderTitle title,uint256 interestRateMode,address[] collateralOut,uint256[] percents,address repayToken,uint256 repayAmount,uint256 bonus)',
    'utf8',
  ),
);

const ORDER_TITLE_TYPE_HASH = keccak256(
  Buffer.from('OrderTitle(address debt,uint256 debtNonce,uint256 startTime,uint256 endTime,uint256 triggerHF)', 'utf8'),
);

interface FullSellOrderUnsigned {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  token: string;
  percentOfEquity: string;
}

interface PartialSellOrderUnsigned {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  interestRateMode: number;
  collateralOut: string[];
  percents: string[];
  repayToken: string;
  repayAmount: string;
  bonus: string;
}

export async function signFullSellOrder(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
): Promise<FullSellOrderData> {
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not found');
  }

  // Create title hash
  const titleHash = keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, address, uint256, uint256, uint256, uint256'), [
      ORDER_TITLE_TYPE_HASH,
      order.debt as Hex,
      BigInt(order.debtNonce),
      BigInt(order.startTime),
      BigInt(order.endTime),
      BigInt(order.triggerHF),
    ]),
  );

  // Create struct hash
  const structHash = keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, uint256, address, bytes32, address, uint256'), [
      FULL_SELL_ORDER_TYPE_HASH,
      BigInt(chainId),
      contractAddress as Hex,
      titleHash,
      order.token as Hex,
      BigInt(order.percentOfEquity),
    ]),
  );

  // Sign the struct hash
  const signature = await walletClient.signMessage({
    account,
    message: { raw: structHash },
  });

  // Parse signature
  const r = signature.slice(0, 66) as Hex;
  const s = ('0x' + signature.slice(66, 130)) as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  return {
    ...order,
    v,
    r,
    s,
  };
}

export async function signPartialSellOrder(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
): Promise<PartialSellOrderData> {
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not found');
  }

  // Create title hash
  const titleHash = keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, address, uint256, uint256, uint256, uint256'), [
      ORDER_TITLE_TYPE_HASH,
      order.debt as Hex,
      BigInt(order.debtNonce),
      BigInt(order.startTime),
      BigInt(order.endTime),
      BigInt(order.triggerHF),
    ]),
  );

  // Create struct hash
  const structHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'bytes32, uint256, address, bytes32, uint256, address[], uint256[], address, uint256, uint256',
      ),
      [
        PARTIAL_SELL_ORDER_TYPE_HASH,
        BigInt(chainId),
        contractAddress as Hex,
        titleHash,
        BigInt(order.interestRateMode),
        order.collateralOut as Hex[],
        order.percents.map(p => BigInt(p)),
        order.repayToken as Hex,
        BigInt(order.repayAmount),
        BigInt(order.bonus),
      ],
    ),
  );

  // Sign the struct hash
  const signature = await walletClient.signMessage({
    account,
    message: { raw: structHash },
  });

  // Parse signature
  const r = signature.slice(0, 66) as Hex;
  const s = ('0x' + signature.slice(66, 130)) as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  return {
    ...order,
    v,
    r,
    s,
  };
}

// Helper function to get current debt nonce (mock for now, should call contract)
export async function getCurrentDebtNonce(debtAddress: string): Promise<number> {
  // TODO: Implement actual contract call to get current debt nonce
  // For now, return 0 as default
  return 0;
}

// Export types for use in other files
export type { FullSellOrderUnsigned, PartialSellOrderUnsigned };
