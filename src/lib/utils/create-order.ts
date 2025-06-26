import { WalletClient } from 'viem';
import { getContractAddress } from '../contracts/addresses';
import { ChainId } from '../contracts/chains';
import { CreateFullSellOrderParams, CreatePartialSellOrderParams } from '../types';
import { CreateOrderRequest, orderApiService } from './order-api';
import { getCurrentDebtNonce, signFullSellOrder, signPartialSellOrder } from './order-signing';

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
    const contractAddress = getContractAddress(this.chainId as ChainId, 'aaveRouter');

    // Get current debt nonce
    const debtNonce = await getCurrentDebtNonce(params.debtAddress);

    // Convert times to unix timestamps
    const now = Math.floor(Date.now() / 1000);
    const startTime = now;
    const endTime = now + params.validityPeriodHours * 3600;

    // Convert values to correct format
    const triggerHF = (params.triggerHealthFactor * 1e18).toString(); // Convert to wei
    const percentOfEquity = (params.equityPercentage * 100).toString(); // Convert to basis points

    // Create unsigned order
    const unsignedOrder = {
      debt: params.debtAddress,
      debtNonce,
      startTime,
      endTime,
      triggerHF,
      token: params.paymentToken,
      percentOfEquity,
    };

    // Sign the order
    const signedOrder = await signFullSellOrder(this.chainId, contractAddress, unsignedOrder, this.walletClient);

    // Create API request
    const orderRequest: CreateOrderRequest = {
      orderType: 'FULL',
      chainId: this.chainId,
      contractAddress,
      seller: this.seller,
      fullSellOrder: signedOrder,
    };

    // Submit to backend
    return await orderApiService.createOrder(orderRequest);
  }

  async createPartialSellOrder(params: CreatePartialSellOrderParams) {
    const contractAddress = getContractAddress(this.chainId as ChainId, 'aaveRouter');

    // Get current debt nonce
    const debtNonce = await getCurrentDebtNonce(params.debtAddress);

    // Convert times to unix timestamps
    const now = Math.floor(Date.now() / 1000);
    const startTime = now;
    const endTime = now + params.validityPeriodHours * 3600;

    // Convert values to correct format
    const triggerHF = (params.triggerHealthFactor * 1e18).toString(); // Convert to wei
    const percents = params.collateralPercentages.map(p => (p * 100).toString()); // Convert to basis points
    const bonus = (params.buyerBonus * 100).toString(); // Convert to basis points

    // Parse repay amount (assuming it's a string representation of the amount)
    const repayAmount = params.repayAmount;

    // Create unsigned order
    const unsignedOrder = {
      debt: params.debtAddress,
      debtNonce,
      startTime,
      endTime,
      triggerHF,
      interestRateMode: 2, // Variable rate (typical for Aave)
      collateralOut: params.collateralTokens,
      percents,
      repayToken: params.repayToken,
      repayAmount,
      bonus,
    };

    // Sign the order
    const signedOrder = await signPartialSellOrder(this.chainId, contractAddress, unsignedOrder, this.walletClient);

    // Create API request
    const orderRequest: CreateOrderRequest = {
      orderType: 'PARTIAL',
      chainId: this.chainId,
      contractAddress,
      seller: this.seller,
      partialSellOrder: signedOrder,
    };

    // Submit to backend
    return await orderApiService.createOrder(orderRequest);
  }
}

// Factory function for easier usage
export function createOrderService(options: CreateOrderServiceOptions): CreateOrderService {
  return new CreateOrderService(options);
}
