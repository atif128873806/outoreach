import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "better-sqlite3",
    "nodemailer",
    "node-cron",
    "pg",
    "@electric-sql/pglite",
  ],
};

export default nextConfig;
