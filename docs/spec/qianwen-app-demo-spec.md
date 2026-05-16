# 千问 App Demo SDD SPEC

日期：2026-05-14  
执行者：Codex

## 变更记录

- 2026-05-13：创建 SPEC v1。基于现有 TypeScript monorepo 继续打磨，明确 Web 作为完整端到端客户端，Android/iOS 替换为原生工程入口。
- 2026-05-14：追加原生端流式能力修订。Android 与 iOS 从普通 `POST /chat` 切换为消费 `POST /chat/stream` 的 SSE event，并在客户端状态层完成增量落屏。
- 2026-05-14：追加原生端测试策略修订。Android 增加 SSE 解析 JVM 单测模板，iOS 增加 XCTest target 与流式解析用例模板。
- 2026-05-14：追加多端会话管理一致性修订。Android 与 iOS 补齐搜索、重命名、置顶、删除会话，并新增多端 API 合同静态检查。
- 2026-05-14：追加 Android 主展示端增强修订。Android 状态层细分 service/list/send/cache/retry，SSE 支持 done/error/异常帧/中断/取消，DataStore 快照增加版本与保存时间，并补充 ViewModel JVM 单测和 Android 演示指南。
- 2026-05-15：追加多端演示 Runbook 修订。新增 `docs/demo-runbook.md`，统一 Server、Web、Android、iOS 的启动、演示、验证和排障步骤，并同步 README、showcase、architecture、Android guide 与验证记录入口。

## 项目目标

千问 App Demo 是一个多端 AI 聊天助手示例，目标是在本地可运行的前提下展示完整会话闭环、统一服务端协议、多端工程结构和后续扩展能力。

验收时必须满足：

- 服务端可本地启动并返回健康检查。
- Web 客户端可完成启动、新建会话、发送消息、接收回复、展示 Markdown 和代码块复制。
- Android 作为主展示端，使用原生技术栈完成会话管理、聊天流式回复、异常恢复、本地缓存和服务状态演示。
- iOS 使用原生技术栈，具备真实工程结构、核心页面、API 接入层和本地持久化基础。
- 真实千问 API 不可用时，服务端仍能通过 mock fallback 完成问答。
- 开发过程通过追加式文档记录，且沉淀至少一个可复用 Codex Skill。

## 多端范围

- 服务端：Fastify + TypeScript，提供统一 HTTP/SSE API、内存会话仓库、真实模型接入和 mock fallback。
- Web：沿用 Vite + React + TypeScript，作为完整端到端闭环客户端。
- Android：Kotlin + Jetpack Compose 原生主展示端，提供会话列表、聊天页、服务状态页、设置/API 地址页、SSE 取消/重试和本地缓存恢复。
- iOS：新增 Swift + SwiftUI 原生工程，提供会话列表、聊天页、服务状态页。

不再使用 Flutter、React Native、Ionic、Cordova、Capacitor 或 Expo 作为正式移动端入口。

## 原生客户端技术选型

- Android：
  - Kotlin
  - Jetpack Compose
  - ViewModel + StateFlow
  - OkHttp
  - kotlinx.serialization
  - DataStore Preferences 存储本地 JSON 快照
  - JUnit + kotlinx-coroutines-test
- iOS：
  - Swift
  - SwiftUI
  - ObservableObject / `@Published`
  - URLSession
  - UserDefaults 存储本地 JSON 快照
- Web：
  - Vite + React + TypeScript
  - localStorage 本地持久化
  - Fetch + ReadableStream 解析 SSE

## 服务端架构

服务端由三层组成：

1. Fastify 路由层：接收 HTTP 请求、返回 JSON 或 SSE。
2. Chat Store：内存保存 conversations 与 messages，Demo 重启后数据清空。
3. Model Provider：优先调用 DashScope / 千问 OpenAI-compatible 接口；无密钥或调用失败时返回 mock 回复。

## API 协议

基础地址默认：

- Web：`http://localhost:8787`
- Android Emulator：`http://10.0.2.2:8787`
- iOS Simulator：`http://localhost:8787`

演示入口：

- 统一 Runbook：`docs/demo-runbook.md`
- Android 专项指南：`docs/android-demo-guide.md`
- 快速展示顺序：`docs/demo-showcase.md`

接口清单：

- `GET /health`
- `GET /conversations`
- `POST /conversations`
- `PATCH /conversations/:id`
- `DELETE /conversations/:id`
- `GET /conversations/:id/messages`
- `DELETE /conversations/:id/messages`
- `POST /chat`
- `POST /chat/stream`

SSE event：

- `conversation`：返回当前会话。
- `message`：返回用户消息或助手占位消息。
- `delta`：返回助手消息增量文本。
- `done`：返回最终助手消息。
- `error`：返回错误状态与错误文本。

## 数据模型

Conversation：

- `id: string`
- `title: string`
- `pinned: boolean`
- `createdAt: string`
- `updatedAt: string`

ChatMessage：

- `id: string`
- `conversationId: string`
- `role: "system" | "user" | "assistant"`
- `content: string`
- `status: "pending" | "streaming" | "sent" | "error"`
- `createdAt: string`
- `updatedAt: string`
- `error?: string`

ChatRequest：

- `conversationId?: string`
- `message: string`

## 会话与消息流程

1. 客户端启动后请求 `GET /health` 和 `GET /conversations`。
2. 用户新建会话时调用 `POST /conversations`。
3. 用户选择会话时调用 `GET /conversations/:id/messages`，本地有缓存时可先展示缓存。
4. Web 发送消息调用 `POST /chat/stream` 并逐步处理 SSE event。
5. Android/iOS 调用 `POST /chat/stream`，按 SSE event 增量更新助手消息内容与状态。
6. 清空会话调用 `DELETE /conversations/:id/messages`。
7. 删除会话调用 `DELETE /conversations/:id`。

## UI 页面清单

Web：

- 左侧会话列表
- 搜索会话
- 新建会话
- 聊天主面板
- 消息输入框
- 清空会话
- 删除/重命名/置顶
- 错误提示与重试入口

Android：

- ConversationListScreen：会话列表、新建会话、进入状态页。
- 会话搜索、重命名、置顶、删除。
- ChatScreen：消息列表、输入框、发送、SSE 流式状态、取消生成、失败重试、清空、错误提示。
- StatusScreen：服务端 health、模型模式、检查时间、缓存状态与 API 地址。
- SettingsScreen：模拟器 `10.0.2.2`、真机局域网 IP、DataStore 缓存说明。

iOS：

- ConversationListView：会话列表、新建会话、进入状态页。
- 会话搜索、重命名、置顶、删除。
- ChatView：消息列表、输入框、发送、清空、错误提示。
- StatusView：服务端 health 与模型模式。

## 客户端状态管理方案

- Web：React state 保存运行态，localStorage 保存 conversations、messagesByConversation、selectedConversationId。
- Android：ViewModel 暴露 StateFlow，显式建模 `ServiceStatus`、`ConversationListStatus`、`SendStatus`、`CacheStatus` 和 `RetryDraft`；Repository 负责 API 与 DataStore 快照。
- iOS：ObservableObject ViewModel 保存页面状态，Store 负责 API 与 UserDefaults 快照。

## 错误处理方案

- 服务端参数错误返回 400。
- 会话不存在返回 404。
- 模型调用失败时优先回退到 mock 回复。
- 客户端展示明确错误信息。
- Web 发送失败后保留最后一次 prompt，提供重试按钮。
- Native 发送失败后保留输入框文本并展示错误；Android 提供重试入口，发送中可取消并避免重复发送。

## 本地持久化方案

- Web：localStorage。
- Android：DataStore Preferences 中保存带版本和保存时间的 JSON 快照，恢复 conversations、messagesByConversation 和 selectedConversationId。
- iOS：UserDefaults 中保存 JSON 快照。

服务端继续使用内存存储，满足 Demo 本地运行；数据库持久化不纳入本轮。

## 流式回复方案

- Web：完整支持 `POST /chat/stream`，使用 ReadableStream 解析 `text/event-stream`。
- Android：支持 `POST /chat/stream`，使用 OkHttp `source.readUtf8Line()` 逐行解析 SSE event；收到 `done/error` 视为终止事件，异常帧转为本地错误事件，连接中断且未收到终止事件则进入失败重试状态。
- iOS：支持 `POST /chat/stream`，使用 URLSession `bytes.lines` 逐行解析 SSE event。
- 服务端：统一提供真实模型 stream 与 mock stream。

## 测试策略

- Server：Vitest 覆盖 health、conversation CRUD、messages 查询/清空、chat、chat/stream、参数错误和 404。
- Web：Vitest + Testing Library 覆盖新建、发送、流式、错误重试、本地持久化、会话操作。
- Shared/API client：保持类型与 SSE parser 单元测试。
- Contract：`pnpm check:contract` 检查 shared DTO 字段、服务端路由、Web API client、Android/iOS 原生模型、客户端路径和 `conversation/message/delta/done/error` SSE 事件集合是否对齐。
- Android：`ChatSseParser` JVM 单测覆盖 delta/message/done/error/multiline/malformed/comment；`QianwenViewModelTest` 覆盖离线缓存恢复、发送失败保留输入、重复发送拦截和取消生成；有 Android SDK/Gradle 后执行 unit test 与 assemble。
- iOS：新增 `QianwenAppTests` XCTest 模板；Windows 环境无法执行 Xcode build，先做源码结构与 SwiftUI/API 层验收，macOS 环境执行 test/build。

## 验收标准

- `pnpm test` 通过。
- `pnpm build` 通过。
- `pnpm check:contract` 通过。
- `pnpm check:android` 与 `pnpm test:android` 通过。
- `GET /health` 返回 `status: "ok"`。
- Android 可以完整演示新建会话、搜索、重命名、置顶、删除、聊天、SSE、取消、重试、清空、服务状态和本地缓存恢复。
- Web 可以完整完成一次聊天闭环。
- Android/iOS 不再依赖 React Native/Expo，具备原生目录与 API 接入层。
- `docs/demo-runbook.md` 覆盖 Server、Web、Android、iOS 的启动、演示、验证和排障步骤。
- `docs/development-log.md` 追加记录本轮过程。
- `.codex/skills` 至少包含一个有效 `SKILL.md`。
- `pnpm package:submission` 可以生成默认不含对话记录、真实 `.env`、`local.properties`、IDE 目录和构建产物的代码文档提交包。

## 分阶段实现计划

1. 生成 SPEC 与追加式开发日志。
2. 移除 Expo/React Native 正式入口，新增 Android/iOS 原生工程结构。
3. 补充 Web 发送失败重试。
4. 补充 Server/Web 测试。
5. 更新 README、架构、验证记录。
6. 沉淀 Codex Skill。
7. 执行测试、构建和 HTTP smoke，记录结果。
8. Android 主展示端增强：补强状态、SSE、缓存、取消/重试、ViewModel 单测和演示指南。
