import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    workerThreads: false,
    webpackMemoryOptimizations: true,
    // Limitar memoria del compilador
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'date-fns',
    ],
  },
  productionBrowserSourceMaps: false,
  // Reducir compilación paralela para ahorrar memoria
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
