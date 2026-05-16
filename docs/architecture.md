# 架构说明

日期：2026-05-14  
最近更新：2026-05-15  
执行者：Codex

## 分层

1. `packages/shared`
   - 定义 `Conversation`、`ChatMessage`、`ChatStreamEvent` 等统一 DTO。
   - 提供会话标题生成等轻量共享逻辑。
2. `packages/api-client`
   - 封装 Web 使用的 health、conversations、messages、chat、chat/stream。
   - 统一 SSE 解析逻辑。
3. `apps/server`
   - Fastify 提供 HTTP 和 SSE 接口。
   - 内存仓库存储会话与消息。
   - 配置真实密钥时接入千问；不可用时自动切换 mock 回复。
4. `apps/web`
   - 完整端到端聊天体验，保留 Web 闭环和 Markdown/代码块能力。
   - 支持流式回复、本地持久化、加载态、错误态、失败重试。
5. `apps/android`
   - Kotlin + Jetpack Compose 原生主展示端。
   - 会话列表、搜索、重命名、置顶、删除、聊天页、服务状态页、设置页。
   - ViewModel + StateFlow 明确区分 service/list/send/cache/error/retry 状态。
   - OkHttp 接入统一 API 和 SSE，支持 done/error/异常帧/连接中断/取消。
   - DataStore 保存带版本和时间戳的本地快照，用于恢复最近会话与消息。
6. `apps/ios`
   - Swift + SwiftUI 原生客户端。
   - 会话列表、搜索、重命名、置顶、删除、聊天页、服务状态页。
   - URLSession 接入统一 API，UserDefaults 保存本地快照。

## 数据流

```text
Web / Android / iOS
  -> API Client / Native API Layer
  -> Fastify Server
  -> Chat Store
  -> Qwen Model Provider 或 Mock Provider
  -> JSON / SSE Response
  -> Client State / Local Persistence
```

Android 主展示端内部数据流：

```text
Compose UI
  -> QianwenViewModel(StateFlow)
  -> QianwenRepositoryContract
  -> QianwenApiClient(OkHttp JSON/SSE)
  -> Fastify Server
  -> ChatSseParser
  -> StateFlow 增量落屏
  -> DataStore LocalSnapshot
```

## 运行入口

详细启动和演示步骤统一维护在 [docs/demo-runbook.md](demo-runbook.md)，架构文档只保留端到端边界：

| 端 | 本地入口 | API 基础地址 | 架构角色 |
| --- | --- | --- | --- |
| Server | `pnpm dev:server` | `http://localhost:8787` | 多端 API 合同源头，提供 JSON 与 SSE。 |
| Web | `pnpm dev:web` | `http://localhost:8787` | 完整备用闭环，展示 Markdown、代码块和 localStorage。 |
| Android | Android Studio 打开 `apps/android` 或 `pnpm dev:android` | `http://10.0.2.2:8787` | 主展示端，展示 Compose、StateFlow、OkHttp SSE、DataStore。 |
| iOS | Xcode 打开 `apps/ios/QianwenApp.xcodeproj` 或 macOS 执行 `pnpm dev:ios` | `http://localhost:8787` | SwiftUI 原生端，展示 URLSession SSE 与 UserDefaults。 |

Android Emulator 使用 `10.0.2.2` 映射开发电脑 `localhost`；iOS Simulator 和 Web 可以直接使用 `localhost`。真机演示时，Android/iOS 都需要改成电脑局域网 IP。

## 协议边界

服务端 API 是多端唯一事实来源。Web 通过 `packages/api-client` 复用 TypeScript DTO；Android/iOS 在各自原生语言中镜像同名模型字段。

流式能力由 Web、Android、iOS 统一消费 `POST /chat/stream`。Web 通过 `packages/api-client` 解析 SSE；Android 使用 OkHttp 流读取；iOS 使用 URLSession bytes 流读取。

Android 将 `QianwenRepositoryContract` 作为 ViewModel 的依赖边界，便于用 JVM 单测验证离线缓存恢复、发送失败保留输入、重复发送拦截和取消生成等客户端状态流转。

`scripts/check-contract.ps1` 调用 `scripts/check-contract.mjs`，通过 TypeScript AST 读取 shared DTO 字段，再对照 Android Kotlin data class、iOS Swift struct、Server 路由、Web API client、Android/iOS 客户端路径和 SSE 事件集合，避免多端协议字段或端点路径漂移。

## 设计取舍

- Android 作为当前二面主展示端，优先体现原生 Compose、状态管理、SSE 网络流和本地持久化能力。
- Android 本地演示使用 `http://10.0.2.2:8787` 访问宿主机服务端，因此 Manifest 明确允许本地 HTTP，真机演示则切换到电脑局域网 IP。
- Web 闭环继续保留，避免破坏已有稳定演示路径和 Markdown/代码块能力。
- Android/iOS 均改为原生工程，避免跨端壳方案与验收要求冲突。
- 服务端继续使用内存存储，满足 Demo 本地运行；生产级数据库不纳入本轮。
- Windows 环境无法执行 iOS 构建，iOS 以源码结构与 API 层完整性验收。
- Android 当前使用 DataStore JSON 快照而非 Room，便于 Demo 保持轻量；后续若需要分页、检索和大历史，再迁移到 Room。
