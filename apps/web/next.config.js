const fs = require("fs");
const path = require("path");

const rootEnvPath = path.join(__dirname, "../../.env");

if (fs.existsSync(rootEnvPath)) {
  const envLines = fs.readFileSync(rootEnvPath, "utf8").split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const apiProxyBase = (
  process.env.INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@capture-ai/shared"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiProxyBase}/v1/:path*`
      },
      {
        source: "/health-api",
        destination: `${apiProxyBase}/health`
      }
    ];
  }
};

module.exports = nextConfig;
