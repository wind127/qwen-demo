# 多端启动与演示 Runbook

日期：2026-05-15  
执行者：Codex

本文档是面试现场的统一执行手册，覆盖 Server、Web、Android、iOS 四端启动、演示流程、验收命令和常见排障。Android 是主展示端，Web 是完整备用闭环，iOS 展示原生工程结构与同一 API 合同接入能力。

## 0. 演示前准备

### 环境要求

- Node.js 与 pnpm：用于 Server、Web、shared、api-client。
- Android Studio / Android SDK：用于 Android 主展示端。
- Xcode：仅 macOS 环境需要，用于 iOS 真机构建或模拟器构建。
- 服务端端口：默认 `8787`。
- Web 端口：默认 `5173`，如端口被占用，以 Vite 终端输出为准。

### 一次性安装

```powershell
pnpm install
```

### 演示前快速检查

```powershell
pnpm check:contract
pnpm check:android
pnpm check:ios
pnpm test:android
```

`pnpm check:contract` 会输出 DTO、端点和 SSE 事件三类检查结果；如果出现字段或路径漂移，应先修复合同再进入现场演示。

如端口被旧进程占用，可先执行：

```powershell
pnpm clear:ports
```

## 1. Server 端

### 启动步骤

1. 可选：复制环境变量模板。

```powershell
copy apps\server\.env.example apps\server\.env
```

2. 如有真实千问 Key，只写入本地 `apps/server/.env`，不要提交。

```text
DASHSCOPE_API_KEY=
QWEN_MODEL=qwen-plus
```

3. 启动服务端。

```powershell
pnpm dev:server
```

4. 另开终端验证健康检查。

```powershell
Invoke-RestMethod http://localhost:8787/health
```

预期要点：

- `status` 为 `ok`。
- `modelMode` 为 `qwen` 表示真实模型模式。
- `modelMode` 为 `mock` 表示本地 mock fallback，可作为现场备用路径。

5. 验证 SSE 流式接口。

```powershell
$body = @{ message = "请用一句话介绍这个 Demo" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri http://localhost:8787/chat/stream -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
$response.Content.Contains("event: done")
```

预期返回 `True`。

### Server 演示流程

1. 展示 `GET /health` 返回内容，说明服务端统一暴露模型模式、版本和时间戳。
2. 展示 `POST /chat/stream` 返回 `conversation/message/delta/done` SSE 事件。
3. 说明无 Key 或模型失败时服务端会走 mock fallback，保证现场演示不中断。
4. 简要说明服务端是多端 API 合同源头，Android、iOS、Web 都复用同一套路由。

### Server 排障

| 现象 | 检查点 | 处理方式 |
| --- | --- | --- |
| `8787` 端口占用 | 是否已有旧 server 进程 | 执行 `pnpm clear:ports` 后重新 `pnpm dev:server`。 |
| health 不返回 `ok` | `.env`、依赖安装、终端报错 | 先确认 `pnpm install`，再看 server 终端错误。 |
| 真实模型回复慢 | 当前是否 `modelMode: qwen` | 准备 mock fallback 作为备用演示，不影响客户端闭环说明。 |

## 2. Web 端

### 启动步骤

1. 先确保 Server 已启动。

```powershell
pnpm dev:server
```

2. 启动 Web。

```powershell
pnpm dev:web
```

3. 打开浏览器。

```text
http://localhost:5173
```

如 Vite 自动切到其他端口，以终端输出为准。

4. 可选：覆盖 API 地址。

```powershell
$env:VITE_API_BASE_URL="http://localhost:8787"
pnpm dev:web
```

### Web 演示流程

1. 打开首页，展示会话列表和聊天区域。
2. 新建会话，输入问题并按 `Enter` 发送。
3. 展示 SSE 流式回复逐步落屏。
4. 展示 Markdown 和代码块渲染，点击代码块复制。
5. 使用搜索框筛选会话。
6. 对会话执行重命名、置顶、删除。
7. 清空当前会话消息。
8. 刷新页面，说明 localStorage 可以恢复本地历史。
9. 可选：关闭 Server 后发送一次，展示失败提示与重试入口。

### Web 验证命令

```powershell
pnpm --filter @qianwen/web test
pnpm --filter @qianwen/web build
```

### Web 排障

| 现象 | 检查点 | 处理方式 |
| --- | --- | --- |
| 页面能打开但无法发送 | Server health 是否正常 | 先执行 `Invoke-RestMethod http://localhost:8787/health`。 |
| Web 端口不是 `5173` | Vite 端口被占用 | 按 `pnpm dev:web` 终端输出打开实际地址。 |
| 浏览器历史干扰演示 | localStorage 已有旧数据 | 使用浏览器开发者工具清理 localStorage，或新建无痕窗口。 |

## 3. Android 端

Android 是二面主展示端。详细 Android 专项说明见 `docs/android-demo-guide.md`，本节保留现场执行主路径。

### 启动步骤：Android Studio

1. 先启动 Server。

```powershell
pnpm dev:server
```

2. Android Studio 打开工程目录。

```text
apps/android
```

3. 等待 Gradle 同步完成。
4. 选择 `app` 配置。
5. 启动 Android Emulator，推荐 Pixel_7 或 API 35/37 模拟器。
6. 点击 Run。

### 启动步骤：命令行备用

```powershell
pnpm check:android
pnpm test:android
pnpm dev:android
```

手动安装到当前模拟器：

```powershell
cd apps/android
.\gradlew.bat --max-workers=1 :app:installDebug
adb shell am start -n com.qianwen.demo/.MainActivity
```

### Android API 地址说明

Android Emulator 中的 `localhost` 指向模拟器自身，不是开发电脑。因此 Android 默认使用：

```text
http://10.0.2.2:8787
```

真机演示时，把 `apps/android/app/build.gradle.kts` 中的 `QWEN_API_BASE_URL` 改为电脑局域网 IP：

```text
http://192.168.x.x:8787
```

手机和电脑需要在同一局域网，并放行电脑的 `8787` 端口。

### Android 演示流程

1. 打开 App 首页，先展示顶部服务状态、列表状态和缓存状态。
2. 打开服务状态页，说明 `health`、`modelMode`、检查时间、API 地址和缓存保存时间。
3. 回到会话列表，点击新建会话。
4. 返回列表，用搜索框查找刚才的会话。
5. 对会话执行重命名。
6. 对会话执行置顶和取消置顶。
7. 删除一个非关键会话，展示列表刷新。
8. 进入聊天页，输入问题并发送。
9. 展示发送中状态和 SSE 流式回复逐步出现。
10. 发送过程中点击取消生成，说明 OkHttp Call 会随协程取消。
11. 对失败或取消后的输入使用重试入口。
12. 点击清空消息，展示当前会话消息清空。
13. 关闭并重启 App，展示 DataStore 恢复最近会话、消息和选中会话。
14. 可选：临时关闭 Server，再打开 App 或发送消息，展示离线缓存和失败保留输入。

### Android 验证命令

```powershell
pnpm check:android
pnpm test:android
pnpm dev:android
```

直接 Gradle：

```powershell
cd apps/android
.\gradlew.bat --no-daemon --max-workers=1 :app:testDebugUnitTest
.\gradlew.bat --max-workers=1 :app:assembleDebug
```

### Android 排障

| 现象 | 检查点 | 处理方式 |
| --- | --- | --- |
| App 显示服务离线 | Server health、`10.0.2.2`、HTTP 配置 | 确认 `Invoke-RestMethod http://localhost:8787/health` 正常；Manifest 已配置本地 HTTP。 |
| Gradle 版本过低 | 是否误用系统 Gradle | 使用 `pnpm dev:android` 或 `apps/android/gradlew.bat`。 |
| 模拟器启动失败 | `ANDROID_SDK_ROOT` 与 AVD 路径 | 以 `apps/android/local.properties` 的 `sdk.dir` 为准。 |
| `adb devices` 显示 offline | ADB 状态异常 | 执行 `adb kill-server`、`adb start-server`，必要时重启模拟器。 |
| 真机访问失败 | API 是否仍是 `10.0.2.2` | 改成电脑局域网 IP，并确认同一 Wi-Fi。 |

## 4. iOS 端

iOS 端用于展示 Swift + SwiftUI 原生工程、同一 API 合同接入、SSE 解析和 UserDefaults 本地持久化。当前 Windows 环境只能做源码结构检查；完整运行需要 macOS + Xcode。

### 启动步骤：macOS + Xcode

1. 先启动 Server。

```bash
pnpm dev:server
```

2. 打开 Xcode 工程。

```text
apps/ios/QianwenApp.xcodeproj
```

3. 选择 `QianwenApp` scheme。
4. 选择 iPhone Simulator。
5. 点击 Run。

iOS Simulator 可以直接访问宿主机：

```text
http://localhost:8787
```

真机演示时，需要把 iOS API base URL 改为电脑局域网 IP，例如：

```text
http://192.168.x.x:8787
```

### iOS 命令行验证

Windows 源码结构检查：

```powershell
pnpm check:ios
```

macOS 构建：

```bash
xcodebuild -project apps/ios/QianwenApp.xcodeproj -scheme QianwenApp -sdk iphonesimulator build
```

macOS 测试：

```bash
xcodebuild -project apps/ios/QianwenApp.xcodeproj -scheme QianwenAppTests -sdk iphonesimulator test
```

### iOS 演示流程

1. 打开会话列表，展示 SwiftUI 原生页面结构。
2. 点击新建会话。
3. 使用搜索框筛选会话。
4. 对会话执行重命名、置顶、删除。
5. 进入聊天页发送消息。
6. 展示 SSE 流式回复逐步落屏。
7. 清空当前会话消息。
8. 打开状态页，展示 health 和模型模式。
9. 重启 App，说明 UserDefaults 快照用于本地恢复。

### iOS 排障

| 现象 | 检查点 | 处理方式 |
| --- | --- | --- |
| Windows 无法运行 iOS | 当前是否有 Xcode | Windows 只执行 `pnpm check:ios`；真实构建转到 macOS。 |
| Simulator 无法访问服务端 | Server 是否运行、端口是否正确 | iOS Simulator 使用 `http://localhost:8787`。 |
| 真机访问失败 | API 是否仍是 localhost | 改为电脑局域网 IP，并确认同一网络。 |

## 5. 推荐面试演示顺序

1. 用 `GET /health` 证明 Server 已在线。
2. 打开 Android Studio 运行 Android，作为主展示端完成会话管理和聊天流式全流程。
3. 展示 Android 服务状态页，讲清楚 `10.0.2.2`、模型模式、缓存时间和弱网处理。
4. 切到 Web，快速证明同一服务端合同也支撑 Web 完整闭环和 Markdown/代码块能力。
5. 打开 iOS 工程，说明 SwiftUI 原生实现、API 层和 SSE 解析结构；如在 macOS，现场运行 Simulator。
6. 打开 `docs/architecture.md`，说明统一合同、客户端状态管理和本地持久化设计。
7. 打开 `verification.md`，展示本地验证命令与通过结果。

## 6. 全量提交前验证

```powershell
pnpm check:contract
pnpm check:android
pnpm test:android
pnpm check:ios
pnpm test
pnpm build
```

当前 Windows 环境不能执行 `xcodebuild`，iOS 以 `pnpm check:ios` 和源码结构验收；macOS 环境再补跑 Xcode build/test。

## 7. 生成提交包

```powershell
pnpm package:submission
```

默认产物为 `qwen-demo-submission-code-docs.zip`。脚本会排除 `.env`、`apps/android/local.properties`、`.idea`、`node_modules`、`dist`、Android/iOS build 目录、`.codex` 运行日志和对话记录，避免把真实 Key、本机路径或过期对话记录混入提交材料。最终提交时，对话记录请使用二面前导出的最新版本单独附上。
