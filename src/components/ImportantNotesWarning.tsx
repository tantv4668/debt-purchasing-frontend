import Link from "next/link";

export default function ImportantNotesWarning() {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-lg">⚠️</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            Important Notes
          </h3>
          <div className="space-y-3 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="flex items-start gap-2">
              <span className="font-medium text-yellow-800 dark:text-yellow-200">
                1.
              </span>
              <p>
                <strong>Price Updates:</strong> Prices are not updated
                frequently because oracles on Sepolia are incomplete for
                production use. The oracle is mocked and doesn't update prices
                regularly. To execute orders, set{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded text-xs">
                  triggerHF
                </code>{" "}
                higher than current{" "}
                <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded text-xs">
                  HF
                </code>
                .
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-yellow-800 dark:text-yellow-200">
                2.
              </span>
              <p>
                <strong>How to Use:</strong> Use the{" "}
                <Link
                  href="/faucet"
                  className="text-yellow-600 dark:text-yellow-400 underline hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  Faucet
                </Link>{" "}
                and perform borrowing to own tokens and create debt positions
                for testing the system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
