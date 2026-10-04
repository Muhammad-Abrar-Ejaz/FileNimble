import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ['api', 'job', 'jobs', 'result', 'results', 'download', 'downloads', 'admin', 'internal', 'test', '__test'].map(prefix => ({
      source: `/${prefix}/:path*`,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    }));
  },
};

export default nextConfig;
