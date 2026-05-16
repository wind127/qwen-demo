# Demo 快速展示

日期：2026-05-13  
最近更新：2026-05-15  
执行者：Codex

## 展示截图

### Android 主展示端：千问风格聊天页

![Android 千问风格聊天页](screenshots/qwen-android-chat.png)

### Web 备用端：底部固定胶囊输入框

![Web 千问风格固定输入框](screenshots/qwen-web-chat.png)

## 建议讲解顺序

详细启动与演示步骤见 [多端演示 Runbook](demo-runbook.md)。现场讲解按“Server 证明在线 -> Android 主展示 -> Web 备用闭环 -> iOS 原生结构 -> 架构与验证”的顺序最稳。

1. 先执行 `Invoke-RestMethod http://localhost:8787/health`，说明 Server 是多端合同源头，当前 `modelMode` 可显示真实千问或 mock fallback。
2. 优先打开 Android Studio 中的 [apps/android](../apps/android)，说明这是二面主展示端，技术栈是 Kotlin + Jetpack Compose + ViewModel + StateFlow。
3. 按 [Android 演示指南](android-demo-guide.md) 跑通新建会话、搜索、重命名、置顶、删除、进入聊天、发送消息和 SSE 流式回复。
4. 演示发送中取消、服务端离线失败、输入保留与重试入口，说明弱网和异常恢复意识。
5. 打开服务状态页，说明 `http://10.0.2.2:8787`、health check、模型模式、检查时间和 DataStore 缓存恢复。
6. 打开 Web 页面，说明 Web 闭环仍可用，并展示 Markdown 和代码块复制作为多端补充能力。
7. 打开 iOS 工程 [apps/ios/QianwenApp.xcodeproj](../apps/ios/QianwenApp.xcodeproj)，说明 SwiftUI 原生工程、URLSession SSE 和 UserDefaults 快照。
8. 打开 [架构说明](architecture.md)，说明 Server、Web、Android、iOS、shared、api-client 的分层和合同检查。
9. 打开 [验证记录](../verification.md)，说明本地测试、Android 构建、Android JVM 单测和多端合同检查结果。

## 现场执行顺序

1. 保持服务端运行在 `http://localhost:8787`，先用 `Invoke-RestMethod http://localhost:8787/health` 证明服务在线。
2. 用 Android Studio 打开 [apps/android](../apps/android)，选择 Pixel_7 或其他模拟器运行 `app`。
3. 如果现场要用命令行备用路径，执行 `pnpm test:android`、`pnpm dev:android`，它们会优先使用 wrapper、`local.properties` SDK 路径和稳定的 Gradle 缓存。
4. App 首页先展示服务在线、本地缓存时间和会话列表，再进入会话完成发送和 SSE 流式回复。
5. Android 演示完成后，再切到 Web 说明同一服务端合同也能支撑 Web 完整闭环。

## 各端演示入口

| 端 | 启动入口 | 演示动作 |
| --- | --- | --- |
| Server | `pnpm dev:server` | health、stream smoke、模型模式、mock fallback。 |
| Android | Android Studio 打开 [apps/android](../apps/android) | 主流程：会话管理、SSE、取消/重试、清空、服务状态、本地缓存。 |
| Web | `pnpm dev:web` 后访问 `http://localhost:5173` | 会话管理、Markdown、代码块复制、localStorage 恢复。 |
| iOS | Xcode 打开 [apps/ios/QianwenApp.xcodeproj](../apps/ios/QianwenApp.xcodeproj) | SwiftUI 原生结构、会话管理、SSE、UserDefaults 恢复。 |
