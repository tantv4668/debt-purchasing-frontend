import { WalletClient, parseUnits } from "viem";
import { getContractAddress } from "../contracts/addresses";
import { ChainId } from "../contracts/chains";
import {
  CreateFullSellOrderParams,
  CreatePartialSellOrderParams,
} from "../types";
import { CreateOrderRequest, orderApiService } from "./order-api";
import {
  getCurrentDebtNonce,
  signFullSellOrder,
  signPartialSellOrder,
} from "./order-signing";
import { getTokenDecimalsByAddress } from "./token-helpers";

interface CreateOrderServiceOptions {
  chainId: number;
  walletClient: WalletClient;
  seller: string;
}

export class CreateOrderService {
  private chainId: number;
  private walletClient: WalletClient;
  private seller: string;

  constructor(options: CreateOrderServiceOptions) {
    this.chainId = options.chainId;
    this.walletClient = options.walletClient;
    this.seller = options.seller;
  }

  async createFullSellOrder(params: CreateFullSellOrderParams) {
    const contractAddress = getContractAddress(
      this.chainId as ChainId,
      "aaveRouter"
    );

    // Get current debt nonce from debt position data
    const debtNonce = params.debtNonce || 0;

    // Convert times to unix timestamps
    const now = Math.floor(Date.now() / 1000);
    const startTime = now;
    const endTime = now + params.validityPeriodHours * 3600;

    // Convert values to correct format
    // Use parseUnits to avoid scientific notation for triggerHF
    const triggerHF = parseUnits(
      params.triggerHealthFactor.toString(),
      18
    ).toString(); // Convert to wei
    const bonus = params.bonus.toString(); // Already in basis points from frontend modal

    // Create unsigned order
    const unsignedOrder = {
      debt: params.debtAddress,
      debtNonce,
      startTime,
      endTime,
      triggerHF,
      token: params.paymentToken,
      bonus, // Changed from percentOfEquity
    };

    // Sign the order
    const signedOrder = await signFullSellOrder(
      this.chainId,
      contractAddress,
      unsignedOrder,
      this.walletClient
    );

    // Create API request
    const orderRequest: CreateOrderRequest = {
      orderType: "FULL",
      chainId: this.chainId,
      contractAddress,
      seller: this.seller,
      fullSellOrder: signedOrder,
    };

    // Submit to backend
    return await orderApiService.createOrder(orderRequest);
  }

  async createPartialSellOrder(params: CreatePartialSellOrderParams) {
    const contractAddress = getContractAddress(
      this.chainId as ChainId,
      "aaveRouter"
    );

    // Get current debt nonce from debt position data
    const debtNonce = params.debtNonce || 0;

    // Convert times to unix timestamps
    const now = Math.floor(Date.now() / 1000);
    const startTime = now;
    const endTime = now + params.validityPeriodHours * 3600;

    // Convert values to correct format
    // Use parseUnits to avoid scientific notation for triggerHF
    const triggerHF = parseUnits(
      params.triggerHealthFactor.toString(),
      18
    ).toString(); // Convert to wei
    const bonus = params.buyerBonus.toString(); // Already in basis points from frontend modal

    // Keep repay amount as decimal string for backend (frontend will convert to wei when calling contract)
    const repayAmountDecimal = params.repayAmount;

    // Create unsigned order
    const unsignedOrder = {
      debt: params.debtAddress,
      debtNonce,
      startTime,
      endTime,
      triggerHF,
      interestRateMode: 2, // Variable rate (typical for Aave)
      collateralOut: params.collateralToken,
      repayToken: params.repayToken,
      repayAmount: repayAmountDecimal,
      bonus,
    };

    // For contract calls, we need to convert decimal to wei
    const tokenDecimals = getTokenDecimalsByAddress(
      params.repayToken,
      this.chainId
    );
    // Use parseUnits to avoid scientific notation (1e+21) that BigInt cannot parse
    const repayAmountWei = parseUnits(
      params.repayAmount,
      tokenDecimals
    ).toString();

    // Sign the order (use wei format for contract signing)
    const orderForSigning = { ...unsignedOrder, repayAmount: repayAmountWei };
    const signedOrder = await signPartialSellOrder(
      this.chainId,
      contractAddress,
      orderForSigning,
      this.walletClient
    );

    // Create API request (use wei format for signature verification)
    const orderRequest: CreateOrderRequest = {
      orderType: "PARTIAL",
      chainId: this.chainId,
      contractAddress,
      seller: this.seller,
      partialSellOrder: signedOrder, // Keep wei format for signature verification
    };

    // Submit to backend
    return await orderApiService.createOrder(orderRequest);
  }
}

// Factory function for easier usage
export function createOrderService(
  options: CreateOrderServiceOptions
): CreateOrderService {
  return new CreateOrderService(options);
}
