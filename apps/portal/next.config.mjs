// Everything the page loads comes from this site; the API is reached through the /v1 proxy.
// Next.js inlines its start-up scripts, so 'unsafe-inline' stays until nonces are added, and
// development needs 'unsafe-eval' for fast refresh. The session token is in an httpOnly cookie,
// so even an injected script cannot read it.
const isDev = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

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
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
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
