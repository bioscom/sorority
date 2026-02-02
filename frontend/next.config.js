/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'], // allow both localhost and 127.0.0.1
  webpack: (config, { isServer }) => {
    // your custom webpack config here
    return config;
  },
  turbopack: {}, // disables automatic Turbopack for custom webpack

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/media/**',},
      { protocol: 'https', hostname: 'api.yourdomain.com' },
    ],
  },
};

module.exports = nextConfig;