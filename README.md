# 千问 App 多端 Demo

一个面向 Android 客户端面试展示的千问聊天 Demo。项目包含 **Android 原生主展示端**、Web 备用端、iOS 原生工程和 Fastify 服务端，统一使用同一套 HTTP/SSE API 合同。

## 演示截图

| Android 原生主展示端 | Web 备用端 |
| --- | --- |
| ![Android 千问聊天页](docs/screenshots/qwen-android-chat.png) | ![Web 千问聊天页](docs/screenshots/qwen-web-chat.png) |

## 核心亮点

- Android：Kotlin + Jetpack Compose + ViewModel + StateFlow，支持会话管理、SSE 流式回复、取消/重试、服务状态和 DataStore 本地恢复。
- Server：Fastify + TypeScript，提供 `health`、会话、消息、普通聊天和 `chat/stream` 流式接口。
- Web：Vite + React + TypeScript，保留完整聊天闭环、Markdown、代码块复制和本地历史。
- iOS：SwiftUI 原生工程，接入同一 API 合同，包含会话、聊天、状态页和 SSE 解析基础。
- Contract：`pnpm check:contract` 校验 DTO、路由和 `conversation/message/delta/done/error` SSE 事件集合，避免多端协议漂移。

## 目录结构

```text
apps/
  android/      Kotlin + Jetpack Compose 原生主展示端
  ios/          SwiftUI 原生客户端
  server/       Fastify API 服务端
  web/          Vite React Web 客户端
packages/
  shared/       多端共享 DTO 和类型约束
  api-client/   Web API client 与 SSE 解析
docs/
  screenshots/  演示截图
  demo-runbook.md
  android-demo-guide.md
```

## 快速开始

安装依赖：

```bash
pnpm install
```

启动服务端：

```bash
Copy-Item apps/server/.env.example apps/server/.env
pnpm dev:server
```

未配置真实 Key 时，服务端会自动使用 mock fallback，保证 Demo 可运行。健康检查：

```bash
Invoke-RestMethod http://localhost:8787/health
```

启动 Web：

```bash
pnpm dev:web
```

启动 Android：

```bash
pnpm dev:android
```

或用 Android Studio 打开 `apps/android`，选择 Pixel 7 等模拟器运行 `app`。Android Emulator 默认通过 `http://10.0.2.2:8787` 访问宿主机服务端。

## 验证命令

```bash
pnpm check:contract
pnpm check:android
pnpm test:android
pnpm test
pnpm build
```

Windows 环境下 iOS 做源码结构检查：

```bash
pnpm check:ios
```

macOS + Xcode 环境可执行：

```bash
xcodebuild -project apps/ios/QianwenApp.xcodeproj -scheme QianwenApp -sdk iphonesimulator build
xcodebuild -project apps/ios/QianwenApp.xcodeproj -scheme QianwenAppTests -sdk iphonesimulator test
```

## 环境变量

服务端读取 `apps/server/.env`：

```text
DASHSCOPE_API_KEY=
QWEN_API_KEY=
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
PORT=8787
WEB_ORIGIN=http://localhost:5173
```

`DASHSCOPE_API_KEY` 和 `QWEN_API_KEY` 都为空时会进入 mock fallback。请不要提交真实 `.env` 或 API Key。

## 文档

- [多端演示 Runbook](docs/demo-runbook.md)
- [Android 演示指南](docs/android-demo-guide.md)
- [架构说明](docs/architecture.md)
- [验证记录](verification.md)
- [SPEC](docs/spec/qianwen-app-demo-spec.md)

## 服务端接口

- `GET /health`
- `GET /conversations`
- `POST /conversations`
- `PATCH /conversations/:id`
- `DELETE /conversations/:id`
- `GET /conversations/:id/messages`
- `DELETE /conversations/:id/messages`
- `POST /chat`
- `POST /chat/stream`
