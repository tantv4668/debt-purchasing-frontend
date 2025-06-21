'use client';

// AppKit button will be used instead
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

export default function Navigation() {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Positions & Orders', href: '/positions' },
    { name: 'Market', href: '/market' },
  ];

  // Don't show navigation on home page
  if (pathname === '/') {
    return null;
  }

  return (
    <header className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center space-x-4'>
            <Link href='/' className='flex items-center gap-3'>
              <div className='w-8 h-8 rounded-full flex items-center justify-center logo-gradient'>
                <span className='text-white font-bold text-sm'>DP</span>
              </div>
              <span className='text-xl font-bold text-gray-900 dark:text-white'>Debt Protocol</span>
            </Link>
            <nav className='hidden md:flex space-x-6 ml-8'>
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`font-medium transition-colors ${
                    pathname === item.href
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className='flex items-center gap-4'>
            <ThemeToggle />
            <div className='appkit-theme-adapter'>
              <appkit-button />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
