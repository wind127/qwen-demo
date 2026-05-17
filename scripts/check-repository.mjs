import { execFileSync } from "node:child_process";
import fs from "node:fs";

const forbiddenTrackedPathPatterns = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)build(\/|$)/,
  /(^|\/)\.idea(\/|$)/,
  /(^|\/)\.gradle(\/|$)/,
  /(^|\/)DerivedData(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)\.codex(\/|$)/,
  /(^|\/)AGENTS\.md$/,
  /(^|\/)local\.properties$/,
  /(^|\/)\.env(\.local)?$/,
  /对话记录/,
  /\.(zip|apk|aab|xcarchive|log)$/i
];

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /\b(?:DASHSCOPE_API_KEY|QWEN_API_KEY)\s*=\s*["']?[A-Za-z0-9_-]{16,}/,
  /\b(?:password|secret)\s*[:=]\s*["'][^"']{8,}["']/i,
  /BEGIN (?:RSA|OPENSSH|PRIVATE) KEY/
];

const allowlistedSecretFiles = new Set(["apps/server/.env.example"]);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function listTrackedFiles(ref) {
  const output = ref ? git(["ls-tree", "-r", "--name-only", ref]) : git(["ls-files"]);
  return output ? output.split(/\r?\n/) : [];
}

function readFileFromRef(ref, file) {
  return execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8" });
}

const ref = process.argv[2];
const trackedFiles = listTrackedFiles(ref);
const badPaths = trackedFiles.filter((file) => forbiddenTrackedPathPatterns.some((pattern) => pattern.test(file)));
const secretHits = [];

for (const file of trackedFiles) {
  if (allowlistedSecretFiles.has(file)) {
    continue;
  }

  let content = "";
  try {
    content = ref ? readFileFromRef(ref, file) : fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      secretHits.push(`${file} -> ${pattern}`);
    }
  }
}

if (badPaths.length > 0 || secretHits.length > 0) {
  console.error("Repository hygiene check failed.");
  if (badPaths.length > 0) {
    console.error("Forbidden tracked files:");
    for (const file of badPaths) {
      console.error(`- ${file}`);
    }
  }
  if (secretHits.length > 0) {
    console.error("Potential secret hits:");
    for (const hit of secretHits) {
      console.error(`- ${hit}`);
    }
  }
  process.exit(1);
}

console.log("Repository hygiene check passed.");
console.log(`- Target checked: ${ref ?? "working tree tracked files"}`);
console.log(`- Tracked files checked: ${trackedFiles.length}`);
console.log("- No tracked secrets, local configs, IDE files, build outputs, archives, logs, or conversation records found.");
