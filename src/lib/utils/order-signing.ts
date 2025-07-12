import { Hex, WalletClient } from "viem";
import { FullSellOrderData, PartialSellOrderData } from "./order-api";
import { ethers } from "ethers";

// EIP-712 Domain constants (matching orderHelpers.ts)
const DOMAIN_NAME = "AaveRouter";
const DOMAIN_VERSION = "1";

interface FullSellOrderUnsigned {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  token: string;
  bonus: string; // Changed from percentOfEquity
}

interface PartialSellOrderUnsigned {
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  interestRateMode: number;
  collateralOut: string;
  repayToken: string;
  repayAmount: string;
  bonus: string;
}

function createEIP712Domain(chainId: number, contractAddress: string) {
  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: BigInt(chainId),
    verifyingContract: contractAddress as Hex,
  };
}

function createEIP712Types() {
  return {
    OrderTitle: [
      { name: "debt", type: "address" },
      { name: "debtNonce", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "triggerHF", type: "uint256" },
    ],
    FullSellOrder: [
      { name: "title", type: "OrderTitle" },
      { name: "token", type: "address" },
      { name: "bonus", type: "uint256" }, // Changed from percentOfEquity
    ],
    PartialSellOrder: [
      { name: "title", type: "OrderTitle" },
      { name: "interestRateMode", type: "uint256" },
      { name: "collateralOut", type: "address" },
      { name: "repayToken", type: "address" },
      { name: "repayAmount", type: "uint256" },
      { name: "bonus", type: "uint256" },
    ],
  };
}

function createNestedTitle(
  order: FullSellOrderUnsigned | PartialSellOrderUnsigned
) {
  // Validate required fields before BigInt conversion
  if (
    order.debtNonce === undefined ||
    order.startTime === undefined ||
    order.endTime === undefined ||
    order.triggerHF === undefined
  ) {
    throw new Error(
      "Missing required order title fields: debtNonce, startTime, endTime, or triggerHF"
    );
  }

  return {
    debt: order.debt as Hex,
    debtNonce: BigInt(order.debtNonce),
    startTime: BigInt(order.startTime),
    endTime: BigInt(order.endTime),
    triggerHF: BigInt(order.triggerHF),
  };
}

async function signFullSellOrderEIP712(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
  account: any
): Promise<{ v: number; r: Hex; s: Hex }> {
  const domain = createEIP712Domain(chainId, contractAddress);
  const types = createEIP712Types();

  // Validate bonus field before BigInt conversion
  if (order.bonus === undefined) {
    throw new Error("Missing required field: bonus");
  }

  const value = {
    title: createNestedTitle(order),
    token: order.token as Hex,
    bonus: BigInt(order.bonus), // Changed from percentOfEquity
  };

  try {
    const signature = await walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: "FullSellOrder",
      message: value,
    });

    // Parse signature
    const r = signature.slice(0, 66) as Hex;
    const s = ("0x" + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    return { v, r, s };
  } catch (error: any) {
    throw new Error(
      `EIP-712 signing failed: ${error.message}\n\n` +
        `This could be due to:\n` +
        `1. Wallet rejection by user\n` +
        `2. Wallet doesn't support EIP-712\n` +
        `3. Contract type mismatch\n\n` +
        `Please try again or use a different wallet.`
    );
  }
}

async function signPartialSellOrderEIP712(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
  account: any
): Promise<{ v: number; r: Hex; s: Hex }> {
  const domain = createEIP712Domain(chainId, contractAddress);
  const types = createEIP712Types();

  // Validate required fields before BigInt conversion
  if (
    order.interestRateMode === undefined ||
    order.repayAmount === undefined ||
    order.bonus === undefined
  ) {
    throw new Error(
      "Missing required partial order fields: interestRateMode, repayAmount, or bonus"
    );
  }

  const value = {
    title: createNestedTitle(order),
    interestRateMode: BigInt(order.interestRateMode),
    collateralOut: order.collateralOut as Hex,
    repayToken: order.repayToken as Hex,
    repayAmount: BigInt(order.repayAmount),
    bonus: BigInt(order.bonus),
  };

  try {
    const signature = await walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: "PartialSellOrder",
      message: value,
    });

    // Parse signature
    const r = signature.slice(0, 66) as Hex;
    const s = ("0x" + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    return { v, r, s };
  } catch (error: any) {
    throw new Error(
      `EIP-712 signing failed: ${error.message}\n\n` +
        `This could be due to:\n` +
        `1. Wallet rejection by user\n` +
        `2. Wallet doesn't support EIP-712\n` +
        `3. Contract type mismatch\n\n` +
        `Please try again or use a different wallet.`
    );
  }
}

async function signFullSellOrderInternal(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient,
  account: any
): Promise<{ v: number; r: Hex; s: Hex }> {
  return await signFullSellOrderEIP712(
    chainId,
    contractAddress,
    order,
    walletClient,
    account
  );
}

async function signPartialSellOrderInternal(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient,
  account: any
): Promise<{ v: number; r: Hex; s: Hex }> {
  return await signPartialSellOrderEIP712(
    chainId,
    contractAddress,
    order,
    walletClient,
    account
  );
}

export async function signFullSellOrder(
  chainId: number,
  contractAddress: string,
  order: FullSellOrderUnsigned,
  walletClient: WalletClient
): Promise<FullSellOrderData> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet account not found");
  }

  const { v, r, s } = await signFullSellOrderInternal(
    chainId,
    contractAddress,
    order,
    walletClient,
    account
  );

  const result = {
    ...order,
    v,
    r,
    s,
  };

  return result;
}

export async function signPartialSellOrder(
  chainId: number,
  contractAddress: string,
  order: PartialSellOrderUnsigned,
  walletClient: WalletClient
): Promise<PartialSellOrderData> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet account not found");
  }

  const { v, r, s } = await signPartialSellOrderInternal(
    chainId,
    contractAddress,
    order,
    walletClient,
    account
  );

  const result = {
    ...order,
    v,
    r,
    s,
  };

  return result;
}

export async function getCurrentDebtNonce(
  debtAddress: string
): Promise<number> {
  // TODO: Implement actual contract call to get current debt nonce
  // For now, return 0 as default
  return 0;
}

// Helper function to sign cancel order message
export async function signCancelOrderMessage(
  orderId: string,
  walletClient: WalletClient
): Promise<{ message: string; signature: string }> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet account not found");
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
