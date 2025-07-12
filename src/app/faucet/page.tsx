"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { ChainId } from "@/lib/contracts/chains";
import { getToken, getTokenAddress } from "@/lib/contracts/tokens";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import MintableABI from "@/lib/contracts/abis/Mintable.json";
import ImportantNotesWarning from "@/components/ImportantNotesWarning";

interface FaucetToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logo?: string;
}

const FAUCET_TOKENS: FaucetToken[] = [
  {
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
    address: getTokenAddress("WETH", ChainId.SEPOLIA),
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    address: getTokenAddress("WBTC", ChainId.SEPOLIA),
  },
];

const MINT_AMOUNTS = {
  WETH: "10", // 10 WETH
  WBTC: "0.5", // 0.5 WBTC
};

export default function FaucetPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [selectedToken, setSelectedToken] = useState<FaucetToken>(
    FAUCET_TOKENS[0]
  );
  const [isMinting, setIsMinting] = useState(false);

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const isSepoliaNetwork = chainId === ChainId.SEPOLIA;

  const handleMintToken = async () => {
    if (!isConnected || !address || !isSepoliaNetwork) {
      return;
    }

    setIsMinting(true);

    try {
      const mintAmount =
        MINT_AMOUNTS[selectedToken.symbol as keyof typeof MINT_AMOUNTS];
      const amount = parseUnits(mintAmount, selectedToken.decimals);

      await writeContract({
        address: selectedToken.address as `0x${string}`,
        abi: MintableABI.abi,
        functionName: "mint",
        args: [address, amount],
      });
    } catch (error) {
      console.error("Mint failed:", error);
    } finally {
      setIsMinting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Token Faucet
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Get test tokens for Sepolia network
            </p>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Please connect your wallet to use the faucet
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSepoliaNetwork) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Token Faucet
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Get test tokens for Sepolia network
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Wrong Network
                  </h3>
                </div>
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                Please switch to Sepolia network to use the faucet
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Token Faucet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Get test tokens for Sepolia network. Perfect for testing the Debt
            Purchasing Protocol.
          </p>
        </div>

        {/* Important Notes Warning */}
        <ImportantNotesWarning />

        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Select Token to Mint
            </h2>

            {/* Token Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {FAUCET_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setSelectedToken(token)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedToken.symbol === token.symbol
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {token.symbol}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {token.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {
                          MINT_AMOUNTS[
                            token.symbol as keyof typeof MINT_AMOUNTS
                          ]
                        }{" "}
                        {token.symbol}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        per request
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Token Info */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Token Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Symbol:
                  </span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedToken.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Name:
                  </span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {selectedToken.name}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Address:
                  </span>
                  <span className="ml-2 font-mono text-xs text-gray-900 dark:text-white break-all">
                    {selectedToken.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Mint Button */}
            <button
              onClick={handleMintToken}
              disabled={isMinting || isConfirming}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isMinting || isConfirming ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {isConfirming ? "Confirming..." : "Minting..."}
                </div>
              ) : (
                `Mint ${MINT_AMOUNTS[selectedToken.symbol as keyof typeof MINT_AMOUNTS]} ${selectedToken.symbol}`
              )}
            </button>

            {/* Transaction Status */}
            {hash && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm">
                  <span className="text-blue-800 dark:text-blue-200">
                    Transaction Hash:
                  </span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {hash}
                  </a>
                </div>
              </div>
            )}

            {isSuccess && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-green-400 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-green-800 dark:text-green-200 font-medium">
                    Successfully minted{" "}
                    {
                      MINT_AMOUNTS[
                        selectedToken.symbol as keyof typeof MINT_AMOUNTS
                      ]
                    }{" "}
                    {selectedToken.symbol}!
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-red-400 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-red-800 dark:text-red-200 font-medium">
                    Transaction failed: {error.message}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Usage Instructions */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
              How to use the Faucet
            </h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
              <li className="flex items-start">
                <span className="font-medium mr-2">1.</span>
                Make sure you&apos;re connected to Sepolia network
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">2.</span>
                Select the token you want to mint (WETH or WBTC)
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">3.</span>
                Click the mint button and confirm the transaction
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">4.</span>
                Use the minted tokens to test the Debt Purchasing Protocol
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
