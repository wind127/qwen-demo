import { buildApp } from "./app";
import { getServerConfig } from "./env";

const { port, host } = getServerConfig();
const app = buildApp();

try {
  await app.listen({ port, host });
  console.log(`千问服务端已启动：http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
