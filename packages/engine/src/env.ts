import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Walks up to the repo root .env so the same code works from src via tsx and
// from a built dist. Kept out of the package barrel because it imports node
// builtins and the barrel is consumed by the browser.
export function loadRootEnv(fromUrl: string): string | undefined {
  let dir = dirname(fileURLToPath(fromUrl));

  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env`);
  return value;
}
