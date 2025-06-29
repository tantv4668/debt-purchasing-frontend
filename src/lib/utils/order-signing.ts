import { Hex, WalletClient, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { FullSellOrderData, PartialSellOrderData } from './order-api';

// Type hashes that match EXACTLY with both orderHelpers.ts and testUtils.ts
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

// EIP-712 Domain constants (matching orderHelpers.ts)
const DOMAIN_NAME = 'AaveRouter';
const DOMAIN_VERSION = '1';

// Log the type hashes to verify they match backend (orderHelpers.ts and testUtils.ts)
console.log('🔍 FRONTEND TYPE HASH VERIFICATION:');
console.log('  - FULL_SELL_ORDER_TYPE_HASH:', FULL_SELL_ORDER_TYPE_HASH);
console.log('  - PARTIAL_SELL_ORDER_TYPE_HASH:', PARTIAL_SELL_ORDER_TYPE_HASH);
console.log('  - ORDER_TITLE_TYPE_HASH:', ORDER_TITLE_TYPE_HASH);
console.log('  ✅ These should match exactly with orderHelpers.ts and testUtils.ts');

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

/**
 * Sign full sell order - Supports both local accounts (raw signing) and external wallets (EIP-712)
 */
async function signFullSellOrderInternal(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  console.log('🚀 ===== SIGNING FULL SELL ORDER =====');

  console.log('📋 Type Hashes (matches orderHelpers.ts and testUtils.ts):');
  console.log('  - FULL_SELL_ORDER_TYPE_HASH:', FULL_SELL_ORDER_TYPE_HASH);
  console.log('  - ORDER_TITLE_TYPE_HASH:', ORDER_TITLE_TYPE_HASH);

  console.log('📊 Order Data:');
  console.log('  - debt:', order.debt);
  console.log('  - debtNonce:', order.debtNonce);
  console.log('  - startTime:', order.startTime);
  console.log('  - endTime:', order.endTime);
  console.log('  - triggerHF:', order.triggerHF);
  console.log('  - token:', order.token);
  console.log('  - percentOfEquity:', order.percentOfEquity);

  // Try local account raw signing first (testUtils.ts approach)
  if ('sign' in account && typeof account.sign === 'function') {
    console.log('🔧 Using LOCAL ACCOUNT raw signing (testUtils.ts approach)...');
    return await signFullSellOrderRaw(chainId, contractAddress, order, account);
  }

  // Use EIP-712 structured signing for external wallets (MetaMask compatible)
  console.log('🔧 Using EXTERNAL WALLET EIP-712 signing (MetaMask compatible)...');
  return await signFullSellOrderEIP712(chainId, contractAddress, order, walletClient, account);
}

/**
 * Raw signing for local accounts (testUtils.ts approach)
 */
async function signFullSellOrderRaw(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  // Create title hash - EXACT MATCH with testUtils.ts and orderHelpers.ts
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

  console.log('🔨 Title Hash:', titleHash);

  // Create struct hash (same as contract logic) - EXACT MATCH with testUtils.ts and orderHelpers.ts
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

  console.log('🔨 Struct Hash:', structHash);

  const signature = await account.sign({ hash: structHash });
  console.log('✅ Raw Signature:', signature);

  // Parse signature
  const r = signature.slice(0, 66) as Hex;
  const s = ('0x' + signature.slice(66, 130)) as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  console.log('🔍 Parsed Signature:');
  console.log('  - v:', v);
  console.log('  - r:', r);
  console.log('  - s:', s);

  return { v, r, s };
}

/**
 * EIP-712 structured signing for external wallets (MetaMask compatible)
 */
async function signFullSellOrderEIP712(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  // EIP-712 Domain
  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: BigInt(chainId),
    verifyingContract: contractAddress as Hex,
  };

  // OrderTitle type for EIP-712
  const orderTitleType = {
    OrderTitle: [
      { name: 'debt', type: 'address' },
      { name: 'debtNonce', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'triggerHF', type: 'uint256' },
    ],
  };

  // FullSellOrder type for EIP-712
  const fullSellOrderType = {
    FullSellOrder: [
      { name: 'chainId', type: 'uint256' },
      { name: 'contract', type: 'address' },
      { name: 'title', type: 'OrderTitle' },
      { name: 'token', type: 'address' },
      { name: 'percentOfEquity', type: 'uint256' },
    ],
    ...orderTitleType,
  };

  // Message data
  const message = {
    chainId: BigInt(chainId),
    contract: contractAddress as Hex,
    title: {
      debt: order.debt as Hex,
      debtNonce: BigInt(order.debtNonce),
      startTime: BigInt(order.startTime),
      endTime: BigInt(order.endTime),
      triggerHF: BigInt(order.triggerHF),
    },
    token: order.token as Hex,
    percentOfEquity: BigInt(order.percentOfEquity),
  };

  console.log('📋 EIP-712 Domain:', domain);
  console.log('📋 EIP-712 Types:', fullSellOrderType);
  console.log('📋 EIP-712 Message:', message);

  try {
    const signature = await walletClient.signTypedData({
      account,
      domain,
      types: fullSellOrderType,
      primaryType: 'FullSellOrder',
      message,
    });

    console.log('✅ EIP-712 Signature:', signature);

    // Parse signature
    const r = signature.slice(0, 66) as Hex;
    const s = ('0x' + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    console.log('🔍 Parsed EIP-712 Signature:');
    console.log('  - v:', v);
    console.log('  - r:', r);
    console.log('  - s:', s);

    return { v, r, s };
  } catch (error: any) {
    console.error('❌ EIP-712 signing failed:', error);
    throw new Error(
      `EIP-712 signing failed: ${error.message}\n\n` +
        `This could be due to:\n` +
        `1. Wallet rejection by user\n` +
        `2. Wallet doesn't support EIP-712\n` +
        `3. Invalid message structure\n\n` +
        `Please try again or use a different wallet.`,
    );
  }
}

/**
 * Sign partial sell order - Supports both local accounts (raw signing) and external wallets (EIP-712)
 */
async function signPartialSellOrderInternal(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  console.log('🚀 ===== SIGNING PARTIAL SELL ORDER =====');

  console.log('📋 Type Hashes (matches orderHelpers.ts and testUtils.ts):');
  console.log('  - PARTIAL_SELL_ORDER_TYPE_HASH:', PARTIAL_SELL_ORDER_TYPE_HASH);
  console.log('  - ORDER_TITLE_TYPE_HASH:', ORDER_TITLE_TYPE_HASH);

  console.log('📊 Order Data:');
  console.log('  - debt:', order.debt);
  console.log('  - debtNonce:', order.debtNonce);
  console.log('  - startTime:', order.startTime);
  console.log('  - endTime:', order.endTime);
  console.log('  - triggerHF:', order.triggerHF);
  console.log('  - interestRateMode:', order.interestRateMode);
  console.log('  - collateralOut:', order.collateralOut);
  console.log('  - percents:', order.percents);
  console.log('  - repayToken:', order.repayToken);
  console.log('  - repayAmount:', order.repayAmount);
  console.log('  - bonus:', order.bonus);

  // Try local account raw signing first (testUtils.ts approach)
  if ('sign' in account && typeof account.sign === 'function') {
    console.log('🔧 Using LOCAL ACCOUNT raw signing (testUtils.ts approach)...');
    return await signPartialSellOrderRaw(chainId, contractAddress, order, account);
  }

  // Use EIP-712 structured signing for external wallets (MetaMask compatible)
  console.log('🔧 Using EXTERNAL WALLET EIP-712 signing (MetaMask compatible)...');
  return await signPartialSellOrderEIP712(chainId, contractAddress, order, walletClient, account);
}

/**
 * Raw signing for local accounts (testUtils.ts approach)
 */
async function signPartialSellOrderRaw(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  // Create title hash - EXACT MATCH with testUtils.ts and orderHelpers.ts
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

  console.log('🔨 Title Hash:', titleHash);

  // Create struct hash (same as contract logic) - EXACT MATCH with testUtils.ts and orderHelpers.ts
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

  console.log('🔨 Struct Hash:', structHash);

  const signature = await account.sign({ hash: structHash });
  console.log('✅ Raw Signature:', signature);

  // Parse signature
  const r = signature.slice(0, 66) as Hex;
  const s = ('0x' + signature.slice(66, 130)) as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  console.log('🔍 Parsed Signature:');
  console.log('  - v:', v);
  console.log('  - r:', r);
  console.log('  - s:', s);

  return { v, r, s };
}

/**
 * EIP-712 structured signing for external wallets (MetaMask compatible)
 */
async function signPartialSellOrderEIP712(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
  account: any,
): Promise<{ v: number; r: Hex; s: Hex }> {
  // EIP-712 Domain
  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: BigInt(chainId),
    verifyingContract: contractAddress as Hex,
  };

  // OrderTitle type for EIP-712
  const orderTitleType = {
    OrderTitle: [
      { name: 'debt', type: 'address' },
      { name: 'debtNonce', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'triggerHF', type: 'uint256' },
    ],
  };

  // PartialSellOrder type for EIP-712
  const partialSellOrderType = {
    PartialSellOrder: [
      { name: 'chainId', type: 'uint256' },
      { name: 'contract', type: 'address' },
      { name: 'title', type: 'OrderTitle' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'collateralOut', type: 'address[]' },
      { name: 'percents', type: 'uint256[]' },
      { name: 'repayToken', type: 'address' },
      { name: 'repayAmount', type: 'uint256' },
      { name: 'bonus', type: 'uint256' },
    ],
    ...orderTitleType,
  };

  // Message data
  const message = {
    chainId: BigInt(chainId),
    contract: contractAddress as Hex,
    title: {
      debt: order.debt as Hex,
      debtNonce: BigInt(order.debtNonce),
      startTime: BigInt(order.startTime),
      endTime: BigInt(order.endTime),
      triggerHF: BigInt(order.triggerHF),
    },
    interestRateMode: BigInt(order.interestRateMode),
    collateralOut: order.collateralOut as Hex[],
    percents: order.percents.map(p => BigInt(p)),
    repayToken: order.repayToken as Hex,
    repayAmount: BigInt(order.repayAmount),
    bonus: BigInt(order.bonus),
  };

  console.log('📋 EIP-712 Domain:', domain);
  console.log('📋 EIP-712 Types:', partialSellOrderType);
  console.log('📋 EIP-712 Message:', message);

  try {
    const signature = await walletClient.signTypedData({
      account,
      domain,
      types: partialSellOrderType,
      primaryType: 'PartialSellOrder',
      message,
    });

    console.log('✅ EIP-712 Signature:', signature);

    // Parse signature
    const r = signature.slice(0, 66) as Hex;
    const s = ('0x' + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    console.log('🔍 Parsed EIP-712 Signature:');
    console.log('  - v:', v);
    console.log('  - r:', r);
    console.log('  - s:', s);

    return { v, r, s };
  } catch (error: any) {
    console.error('❌ EIP-712 signing failed:', error);
    throw new Error(
      `EIP-712 signing failed: ${error.message}\n\n` +
        `This could be due to:\n` +
        `1. Wallet rejection by user\n` +
        `2. Wallet doesn't support EIP-712\n` +
        `3. Invalid message structure\n\n` +
        `Please try again or use a different wallet.`,
    );
  }
}

export async function signFullSellOrder(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
): Promise<FullSellOrderData> {
  console.log('🚀 ===== STARTING FULL SELL ORDER SIGNING =====');
  console.log('📥 Input Parameters:');
  console.log('  - chainId:', chainId);
  console.log('  - contractAddress:', contractAddress);
  console.log('  - order:', order);

  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not found');
  }

  console.log('👤 Account Address:', account.address);

  // Auto-detect signing method and use appropriate approach
  const { v, r, s } = await signFullSellOrderInternal(chainId, contractAddress, order, walletClient, account);

  const result = {
    ...order,
    v,
    r,
    s,
  };

  console.log('✅ Final Signed Order:', result);
  console.log('🏁 ===== FULL SELL ORDER SIGNING COMPLETE =====');

  return result;
}

export async function signPartialSellOrder(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
): Promise<PartialSellOrderData> {
  console.log('🚀 ===== STARTING PARTIAL SELL ORDER SIGNING =====');
  console.log('📥 Input Parameters:');
  console.log('  - chainId:', chainId);
  console.log('  - contractAddress:', contractAddress);
  console.log('  - order:', order);

  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not found');
  }

  console.log('👤 Account Address:', account.address);

  // Auto-detect signing method and use appropriate approach
  const { v, r, s } = await signPartialSellOrderInternal(chainId, contractAddress, order, walletClient, account);

  const result = {
    ...order,
    v,
    r,
    s,
  };

  console.log('✅ Final Signed Order:', result);
  console.log('🏁 ===== PARTIAL SELL ORDER SIGNING COMPLETE =====');

  return result;
}

// Helper function to get current debt nonce (mock for now, should call contract)
export async function getCurrentDebtNonce(debtAddress: string): Promise<number> {
  // TODO: Implement actual contract call to get current debt nonce
  // For now, return 0 as default
  return 0;
}

// Helper function to sign cancel order message
export async function signCancelOrderMessage(
  orderId: string,
  walletClient: WalletClient,
): Promise<{ message: string; signature: string }> {
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not found');
  }

  const message = `Cancel order: ${orderId}`;
  const signature = await walletClient.signMessage({
    account,
    message,
  });

  return { message, signature };
}

// Export types for use in other files
export type { FullSellOrderUnsigned, PartialSellOrderUnsigned };
