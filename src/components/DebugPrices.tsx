'use client';

import { useState } from 'react';
import { usePriceTokens } from '../lib/hooks/usePriceTokens';
import { directBackendApiClient } from '../lib/utils/price-api';

export default function DebugPrices() {
  const [testResults, setTestResults] = useState<any>(null);
  const [istesting, setIsTesting] = useState(false);
  const { priceTokens, isLoading, error, refreshPrices } = usePriceTokens();

  const runConnectionTest = async () => {
    setIsTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    try {
      // Test 1: Frontend health check
      console.log('Testing frontend health check...');
      const healthResponse = await fetch('/api/health');
      const healthData = await healthResponse.json();
      results.tests.frontendHealth = {
        success: healthResponse.ok,
        data: healthData,
      };

      // Test 2: Frontend price proxy
      console.log('Testing frontend price proxy...');
      const proxyResponse = await fetch('/api/prices?limit=5');
      const proxyData = await proxyResponse.json();
      results.tests.frontendPriceProxy = {
        success: proxyResponse.ok,
        data: proxyData,
      };

      // Test 3: Direct backend connection
      console.log('Testing direct backend connection...');
      try {
        const directData = await directBackendApiClient.fetchPriceTokens({ limit: 5 });
        results.tests.directBackend = {
          success: true,
          data: directData,
        };
      } catch (err) {
        results.tests.directBackend = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    } catch (err) {
      results.error = err instanceof Error ? err.message : 'Unknown error';
    }

    setTestResults(results);
    setIsTesting(false);
  };

  return (
    <div className='bg-white rounded-lg shadow p-6 mb-6'>
      <h2 className='text-xl font-bold mb-4'>🔧 Price API Debug Panel</h2>

      {/* Current Status */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
        <div className='bg-gray-50 p-4 rounded-lg'>
          <h3 className='font-medium text-gray-900 mb-2'>Loading State</h3>
          <p className={`text-sm ${isLoading ? 'text-orange-600' : 'text-green-600'}`}>
            {isLoading ? '🔄 Loading...' : '✅ Ready'}
          </p>
        </div>

        <div className='bg-gray-50 p-4 rounded-lg'>
          <h3 className='font-medium text-gray-900 mb-2'>Error State</h3>
          <p className={`text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
            {error ? `❌ ${error}` : '✅ No errors'}
          </p>
        </div>

        <div className='bg-gray-50 p-4 rounded-lg'>
          <h3 className='font-medium text-gray-900 mb-2'>Tokens Loaded</h3>
          <p className={`text-sm ${priceTokens.length > 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {priceTokens.length > 0 ? `✅ ${priceTokens.length} tokens` : '⚠️ No tokens'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className='flex gap-3 mb-6'>
        <button
          onClick={refreshPrices}
          disabled={isLoading}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50'
        >
          {isLoading ? '🔄 Refreshing...' : '🔄 Refresh Prices'}
        </button>

        <button
          onClick={runConnectionTest}
          disabled={isLoading || istesting}
          className='bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50'
        >
          {istesting ? '🧪 Testing...' : '🧪 Run Connection Test'}
        </button>
      </div>

      {/* Loaded Tokens */}
      {priceTokens.length > 0 && (
        <div className='mb-6'>
          <h3 className='font-medium text-gray-900 mb-3'>📊 Current Price Data</h3>
          <div className='bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
              {priceTokens.slice(0, 12).map(token => (
                <div key={token.id} className='bg-white p-3 rounded border'>
                  <div className='font-medium text-sm text-gray-900'>{token.symbol}</div>
                  <div className='text-green-600 text-sm font-mono'>${parseFloat(token.priceUSD).toLocaleString()}</div>
                  <div className='text-xs text-gray-500'>
                    {new Date(parseInt(token.lastUpdatedAt) * 1000).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className='mb-6'>
          <h3 className='font-medium text-gray-900 mb-3'>🧪 Connection Test Results</h3>
          <div className='bg-gray-50 rounded-lg p-4'>
            <pre className='text-xs overflow-x-auto whitespace-pre-wrap'>{JSON.stringify(testResults, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='font-medium text-blue-900 mb-2'>💡 Troubleshooting</h3>
        <ul className='text-sm text-blue-800 space-y-1'>
          <li>
            • Make sure your backend is running on <code>http://localhost:3002</code>
          </li>
          <li>
            • Check that the backend <code>/api/prices</code> endpoint is working
          </li>
          <li>
            • Set <code>NEXT_PUBLIC_BACKEND_URL=http://localhost:3002</code> in your <code>.env.local</code>
          </li>
          <li>• Check browser console for detailed error messages</li>
          <li>• Run the connection test to see detailed diagnostics</li>
        </ul>
      </div>
    </div>
  );
}
