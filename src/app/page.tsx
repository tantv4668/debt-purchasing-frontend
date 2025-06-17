'use client';

// AppKit button will be used instead
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800'>
      {/* Header */}
      <header className='p-4 md:p-8 bg-white/95 backdrop-blur-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto flex justify-between items-center'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg'>
              DP
            </div>
            <h1 className='text-2xl font-bold text-gray-900'>Debt Protocol</h1>
          </div>
          <appkit-button />
        </div>
      </header>

      {/* Main Content */}
      <main className='p-8 md:p-16 text-center'>
        <div className='max-w-4xl mx-auto text-white'>
          <h2 className='text-4xl md:text-6xl font-bold mb-6 leading-tight'>
            Trade Debt Positions on
            <span className='text-yellow-400'> Aave V3</span>
          </h2>

          <p className='text-xl md:text-2xl mb-12 opacity-90 leading-relaxed'>
            Avoid liquidations by selling your debt positions. Help others while earning profits. Revolutionary DeFi
            marketplace for debt trading.
          </p>

          <div className='flex flex-col sm:flex-row gap-6 justify-center mb-16'>
            <Link
              href='/dashboard'
              className='px-8 py-4 bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl font-semibold text-lg hover:bg-white/30 transition-all'
            >
              Launch App →
            </Link>
            <button className='px-8 py-4 bg-transparent text-white border-2 border-white/50 rounded-xl font-semibold text-lg hover:border-white transition-all'>
              Learn More
            </button>
          </div>

          {/* Features */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8 mb-16'>
            <div className='bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20'>
              <div className='text-5xl mb-4'>🛡️</div>
              <h3 className='text-xl font-bold mb-4'>Liquidation Protection</h3>
              <p className='opacity-80 leading-relaxed'>
                Create sale orders that execute automatically when your Health Factor drops below safe levels.
              </p>
            </div>

            <div className='bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20'>
              <div className='text-5xl mb-4'>📈</div>
              <h3 className='text-xl font-bold mb-4'>Profitable Trading</h3>
              <p className='opacity-80 leading-relaxed'>
                Buy distressed positions at discount, help sellers avoid liquidation, and earn profits.
              </p>
            </div>

            <div className='bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20'>
              <div className='text-5xl mb-4'>👥</div>
              <h3 className='text-xl font-bold mb-4'>Community Driven</h3>
              <p className='opacity-80 leading-relaxed'>
                Win-win marketplace where the community helps each other avoid losses while earning returns.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className='bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20'>
            <h3 className='text-2xl font-bold mb-8'>Protocol Stats</h3>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-8'>
              <div>
                <div className='text-3xl font-bold text-yellow-400'>$0M</div>
                <div className='opacity-80'>Total Volume</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-green-400'>0</div>
                <div className='opacity-80'>Positions Saved</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-blue-400'>0</div>
                <div className='opacity-80'>Active Orders</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-orange-400'>0</div>
                <div className='opacity-80'>Users Protected</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className='p-8 text-center border-t border-white/20 text-white opacity-80'>
        <p>&copy; 2025 Debt Purchasing Protocol. Built with ❤️ for DeFi.</p>
      </footer>
    </div>
  );
}
