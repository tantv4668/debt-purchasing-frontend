/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    // Enable source maps for debugging
    productionBrowserSourceMaps: false,
  }),
  
  // Optimize compilation performance
  experimental: {
    // Reduce memory usage
    workerThreads: false,
    // Enable faster refresh
    optimizePackageImports: ['wagmi', 'viem'],
  },

  // Webpack optimizations (only when not using Turbopack)
  webpack: (config, { dev, isServer }) => {
    // Skip webpack customizations when using Turbopack
    if (process.env.TURBOPACK) {
      return config;
    }
    // Fix node.js module resolution
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      punycode: false,
    };
    
    // Externalize problematic packages
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Ignore punycode deprecation warnings
    if (dev) {
      const originalEmit = config.infrastructureLogging?.level || 'error';
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    
    // Optimize chunk splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          wagmi: {
            test: /[\\/]node_modules[\\/](wagmi|@wagmi|viem)[\\/]/,
            name: 'wagmi',
            priority: 20,
            chunks: 'all',
          },
          rainbow: {
            test: /[\\/]node_modules[\\/]@rainbow-me[\\/]/,
            name: 'rainbow',
            priority: 20,
            chunks: 'all',
          },
        },
      };
    }
    
    // Enable webpack cache for faster rebuilds (PERFORMANCE BOOST!)
    if (dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }
    
    return config;
  },

  // Image optimization
  images: {
    domains: ['raw.githubusercontent.com'], // For token logos
    formats: ['image/webp', 'image/avif'],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
    // SWC minification is enabled by default in Next.js 13+
  },

  // Output optimizations
  output: 'standalone',
  
  // Disable x-powered-by header
  poweredByHeader: false,
};

module.exports = nextConfig; 