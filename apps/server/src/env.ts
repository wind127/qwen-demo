import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { config } from "dotenv";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const projectRoot = resolve(serverRoot, "../..");

config({ path: resolve(projectRoot, ".env"), quiet: true });
config({ path: resolve(serverRoot, ".env"), override: true, quiet: true });

export function getServerConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY;
  const webOrigin = parseWebOrigin(process.env.WEB_ORIGIN);

  return {
    apiKey,
    baseURL: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: process.env.QWEN_MODEL ?? "qwen-plus",
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    webOrigin,
    modelMode: apiKey ? ("qwen" as const) : ("mock" as const)
  };
}

function parseWebOrigin(value: string | undefined) {
  if (!value) {
    return true;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    return true;
  }

  return [...new Set([...origins, ...createLocalNetworkOrigins(origins)])];
}

function createLocalNetworkOrigins(origins: string[]) {
  const localOrigins: string[] = [];

  for (const origin of origins) {
    const url = tryParseUrl(origin);
    if (!url || !["localhost", "127.0.0.1"].includes(url.hostname)) {
      continue;
    }

    localOrigins.push(`${url.protocol}//127.0.0.1:${url.port}`);
    localOrigins.push(`${url.protocol}//localhost:${url.port}`);

    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === "IPv4" && !address.internal) {
          localOrigins.push(`${url.protocol}//${address.address}:${url.port}`);
        }
      }
    }
  }

  return localOrigins;
}

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
