import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const failures = [];

const files = {
  shared: "packages/shared/src/index.ts",
  apiClient: "packages/api-client/src/index.ts",
  serverApp: "apps/server/src/app.ts",
  serverModel: "apps/server/src/model.ts",
  androidModels: "apps/android/app/src/main/java/com/qianwen/demo/data/QianwenModels.kt",
  androidApi: "apps/android/app/src/main/java/com/qianwen/demo/data/QianwenApiClient.kt",
  androidParser: "apps/android/app/src/main/java/com/qianwen/demo/data/ChatSseParser.kt",
  iosModels: "apps/ios/QianwenApp/Models.swift",
  iosApi: "apps/ios/QianwenApp/QianwenApiClient.swift"
};

function readFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing contract file: ${relativePath}`);
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function createTsSource(relativePath) {
  return ts.createSourceFile(relativePath, readFile(relativePath), ts.ScriptTarget.Latest, true);
}

function findTsNode(source, predicate) {
  let found = null;
  function visit(node) {
    if (predicate(node)) {
      found = node;
      return;
    }
    if (!found) {
      ts.forEachChild(node, visit);
    }
  }
  visit(source);
  return found;
}

function getTsInterfaceFields(source, name) {
  const node = findTsNode(
    source,
    (candidate) => ts.isInterfaceDeclaration(candidate) && candidate.name.text === name
  );
  if (!node) {
    fail(`Missing shared TypeScript interface: ${name}`);
    return new Map();
  }

  return new Map(
    node.members
      .filter(ts.isPropertySignature)
      .map((member) => {
        const fieldName = member.name.getText(source).replace(/^["']|["']$/g, "");
        return [
          fieldName,
          {
            optional: Boolean(member.questionToken),
            type: member.type?.getText(source) ?? "unknown"
          }
        ];
      })
  );
}

function getTsUnionLiterals(source, name) {
  const node = findTsNode(
    source,
    (candidate) => ts.isTypeAliasDeclaration(candidate) && candidate.name.text === name
  );
  if (!node || !ts.isUnionTypeNode(node.type)) {
    fail(`Missing shared union type: ${name}`);
    return [];
  }

  return node.type.types
    .filter(ts.isLiteralTypeNode)
    .map((typeNode) => typeNode.literal)
    .filter(ts.isStringLiteral)
    .map((literal) => literal.text);
}

function unique(values) {
  return Array.from(new Set(values));
}

function getSharedStreamTypes(sharedText) {
  const match = sharedText.match(/export type ChatStreamEvent\s*=\s*([\s\S]*?);\s*\r?\n\s*export const/);
  if (!match) {
    fail("Missing shared ChatStreamEvent union block.");
    return [];
  }

  return unique(Array.from(match[1].matchAll(/type:\s*"([^"]+)"/g)).map((item) => item[1]));
}

function readBalancedBlock(text, startIndex, openChar, closeChar) {
  let depth = 0;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex + 1, index);
      }
    }
  }
  return null;
}

function getKotlinDataClassFields(text, className) {
  const marker = `data class ${className}`;
  const classIndex = text.indexOf(marker);
  if (classIndex < 0) {
    fail(`Missing Android data class: ${className}`);
    return new Map();
  }

  const openIndex = text.indexOf("(", classIndex);
  const block = openIndex >= 0 ? readBalancedBlock(text, openIndex, "(", ")") : null;
  if (block == null) {
    fail(`Cannot read Android data class parameters: ${className}`);
    return new Map();
  }

  const fields = new Map();
  const regex = /(?:override\s+)?val\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=,\n)]+)/g;
  for (const match of block.matchAll(regex)) {
    fields.set(match[1], {
      optional: match[2].includes("?"),
      type: match[2].trim()
    });
  }
  return fields;
}

function getSwiftStructFields(text, structName) {
  const marker = `struct ${structName}`;
  const structIndex = text.indexOf(marker);
  if (structIndex < 0) {
    fail(`Missing iOS struct: ${structName}`);
    return new Map();
  }

  const openIndex = text.indexOf("{", structIndex);
  const block = openIndex >= 0 ? readBalancedBlock(text, openIndex, "{", "}") : null;
  if (block == null) {
    fail(`Cannot read iOS struct body: ${structName}`);
    return new Map();
  }

  const fields = new Map();
  const regex = /\b(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^\n=]+)/g;
  for (const match of block.matchAll(regex)) {
    const typeText = match[2].trim();
    fields.set(match[1], {
      optional: typeText.endsWith("?"),
      type: typeText
    });
  }
  return fields;
}

function compareFields(sourceName, nativeName, sharedFields, nativeFields, options = {}) {
  const ignored = new Set(options.ignoreFields ?? []);
  for (const [fieldName, field] of sharedFields.entries()) {
    if (ignored.has(fieldName)) {
      continue;
    }

    const nativeField = nativeFields.get(fieldName);
    check(Boolean(nativeField), `${sourceName} -> ${nativeName} missing field: ${fieldName}`);
    if (nativeField) {
      check(
        nativeField.optional === field.optional,
        `${sourceName} -> ${nativeName} optional mismatch for ${fieldName}: shared=${field.optional}, native=${nativeField.optional}`
      );
    }
  }
}

function checkContains(fileLabel, content, token) {
  check(content.includes(token), `${fileLabel} missing token: ${token}`);
}

const sharedText = readFile(files.shared);
const apiClientText = readFile(files.apiClient);
const serverText = readFile(files.serverApp);
const serverModelText = readFile(files.serverModel);
const androidModelsText = readFile(files.androidModels);
const androidApiText = readFile(files.androidApi);
const androidParserText = readFile(files.androidParser);
const iosModelsText = readFile(files.iosModels);
const iosApiText = readFile(files.iosApi);

const sharedSource = createTsSource(files.shared);
const dtoNames = [
  "Conversation",
  "ChatMessage",
  "HealthResponse",
  "CreateConversationRequest",
  "CreateConversationResponse",
  "UpdateConversationRequest",
  "ConversationsResponse",
  "MessagesResponse",
  "ChatRequest",
  "ChatResponse"
];

const sharedDtos = new Map(dtoNames.map((name) => [name, getTsInterfaceFields(sharedSource, name)]));
for (const dtoName of dtoNames) {
  compareFields(
    `shared ${dtoName}`,
    `Android ${dtoName}`,
    sharedDtos.get(dtoName),
    getKotlinDataClassFields(androidModelsText, dtoName)
  );
  compareFields(
    `shared ${dtoName}`,
    `iOS ${dtoName}`,
    sharedDtos.get(dtoName),
    getSwiftStructFields(iosModelsText, dtoName)
  );
}

const roleValues = getTsUnionLiterals(sharedSource, "MessageRole");
const statusValues = getTsUnionLiterals(sharedSource, "MessageStatus");
check(JSON.stringify(roleValues) === JSON.stringify(["system", "user", "assistant"]), "MessageRole values drifted.");
check(
  JSON.stringify(statusValues) === JSON.stringify(["pending", "streaming", "sent", "error"]),
  "MessageStatus values drifted."
);

const streamTypes = getSharedStreamTypes(sharedText);
const expectedStreamTypes = ["conversation", "message", "delta", "done", "error"];
check(JSON.stringify(streamTypes) === JSON.stringify(expectedStreamTypes), "ChatStreamEvent types drifted.");

const streamPayloadFields = {
  conversation: ["conversation"],
  message: ["message"],
  delta: ["messageId", "conversationId", "delta"],
  done: ["message"],
  error: ["messageId", "conversationId", "error"]
};
const androidStreamClasses = {
  conversation: "StreamConversationEvent",
  message: "StreamMessageEvent",
  delta: "StreamDeltaEvent",
  done: "StreamDoneEvent",
  error: "StreamErrorEvent"
};
const iosStreamStructs = androidStreamClasses;

for (const eventType of expectedStreamTypes) {
  const androidFields = getKotlinDataClassFields(androidModelsText, androidStreamClasses[eventType]);
  const iosFields = getSwiftStructFields(iosModelsText, iosStreamStructs[eventType]);
  for (const field of streamPayloadFields[eventType]) {
    check(androidFields.has(field), `Android ${androidStreamClasses[eventType]} missing field: ${field}`);
    check(iosFields.has(field), `iOS ${iosStreamStructs[eventType]} missing field: ${field}`);
  }
  checkContains("Android SSE parser", androidParserText, `"${eventType}"`);
  checkContains("iOS SSE parser", iosApiText, `case "${eventType}"`);
  checkContains("Server SSE", serverText, `type: "${eventType}"`);
}

const routeChecks = [
  { name: "health", server: 'app.get("/health"', api: '"/health"', android: 'get("/health")', ios: 'path: "/health"' },
  { name: "listConversations", server: 'app.get("/conversations"', api: '"/conversations"', android: 'get("/conversations")', ios: 'path: "/conversations"' },
  { name: "createConversation", server: 'app.post<{ Body: CreateConversationRequest }>("/conversations"', api: '"/conversations"', android: 'post("/conversations"', ios: 'path: "/conversations", method: "POST"' },
  { name: "updateConversation", server: 'app.patch<{ Params: { id: string }; Body: UpdateConversationRequest }>("/conversations/:id"', api: '`/conversations/${conversationId}`', android: 'patch("/conversations/$conversationId"', ios: 'path: "/conversations/\\(conversationId)"' },
  { name: "deleteConversation", server: 'app.delete<{ Params: { id: string } }>("/conversations/:id"', api: '`/conversations/${conversationId}`', android: 'delete("/conversations/$conversationId")', ios: 'path: "/conversations/\\(conversationId)", method: "DELETE"' },
  { name: "getMessages", server: 'app.get<{ Params: { id: string } }>("/conversations/:id/messages"', api: '`/conversations/${conversationId}/messages`', android: 'get("/conversations/$conversationId/messages")', ios: 'path: "/conversations/\\(conversationId)/messages", method: "GET"' },
  { name: "clearMessages", server: 'app.delete<{ Params: { id: string } }>("/conversations/:id/messages"', api: '`/conversations/${conversationId}/messages`', android: 'delete("/conversations/$conversationId/messages")', ios: 'path: "/conversations/\\(conversationId)/messages", method: "DELETE"' },
  { name: "chat", server: 'app.post<{ Body: ChatRequest }>("/chat"', api: '"/chat"', android: 'post("/chat"', ios: 'path: "/chat", method: "POST"' },
  { name: "streamChat", server: 'app.post<{ Body: ChatRequest }>("/chat/stream"', api: "/chat/stream", android: '"$baseUrl/chat/stream"', ios: 'appendingPathComponent("chat/stream")' }
];

for (const route of routeChecks) {
  checkContains(`Server route ${route.name}`, serverText, route.server);
  checkContains(`Web api-client ${route.name}`, apiClientText, route.api);
  checkContains(`Android api-client ${route.name}`, androidApiText, route.android);
  checkContains(`iOS api-client ${route.name}`, iosApiText, route.ios);
}

checkContains("Server model fallback", serverModelText, "forceMock");
checkContains("Server model fallback", serverModelText, "mock");
checkContains("Server health mode", serverText, "modelMode: modelProvider.mode");

if (failures.length > 0) {
  console.error("Multi-client API contract check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Multi-client API contract check passed.");
console.log(`- DTO alignment checked: ${dtoNames.length} shared models against Android and iOS.`);
console.log(`- Endpoint alignment checked: ${routeChecks.length} routes across Server/Web/Android/iOS.`);
console.log(`- SSE events checked: ${expectedStreamTypes.join(", ")}.`);
