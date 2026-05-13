import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const parsedApiUrl = (() => {
  if (!apiUrl) return null;
  try { return new URL(apiUrl); } catch { return null; }
})();

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/recycle-bin", destination: "/archive", permanent: false }];
  },
  images: {
    remotePatterns: parsedApiUrl
      ? [
          {
            protocol: parsedApiUrl.protocol.replace(":", "") as "http" | "https",
            hostname: parsedApiUrl.hostname,
            port: parsedApiUrl.port || "",
            pathname: "/**",
          },
        ]
      : [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
