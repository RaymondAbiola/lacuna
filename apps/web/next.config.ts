import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Next writes AGENTS.md and CLAUDE.md into the app by default; this repo
  // keeps its own docs.
  agentRules: false,
  transpilePackages: ["@lacuna/core", "@lacuna/engine"],
  // better-sqlite3 is a native module and must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default config;
