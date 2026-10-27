import type { NextConfig } from "next";

// Server actions reject requests whose Origin differs from the Host. Behind
// proxies that rewrite the host (GitHub Codespaces, some load balancers) list
// the public origin here, or add more with ALLOWED_ORIGINS="a.example.com,b.example.com".
const allowedOrigins = [
  "localhost:3100",
  "*.app.github.dev",
  ...(process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "60mb", allowedOrigins } },
};

export default nextConfig;
