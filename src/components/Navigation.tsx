'use client';

// AppKit button will be used instead
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Positions', href: '/positions' },
    { name: 'Market', href: '/market' },
    { name: 'Orders', href: '/orders' },
  ];

  return (
    <header className='bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center space-x-4'>
            <Link href='/' className='flex items-center gap-3'>
              <span className='text-xl font-bold text-gray-900'>Debt Protocol</span>
            </Link>
            <nav className='hidden md:flex space-x-6 ml-8'>
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`font-medium transition-colors ${
                    pathname === item.href ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className='appkit-theme-adapter'>
            <appkit-button />
          </div>
        </div>
      </div>
    </header>
  );
}
