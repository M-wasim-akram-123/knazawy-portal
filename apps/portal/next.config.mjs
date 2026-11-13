/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@knazawy/shared',
    '@knazawy/i18n',
    '@knazawy/design-system',
    '@knazawy/ui-shell',
    '@knazawy/api-client',
    '@knazawy/auth-client',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  async rewrites() {
    const apiTarget = process.env.API_REWRITE_TARGET ?? 'http://localhost:3001';
    return [{ source: '/v1/:path*', destination: `${apiTarget}/v1/:path*` }];
  },
};

export default nextConfig;
