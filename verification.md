# Verification

日期：2026-05-14  
最近更新：2026-05-15  
执行者：Codex

## 结果

- `pnpm check:contract`：通过，多端 API 合同检查通过；当前会校验 10 个 shared DTO 与 Android/iOS 字段、9 个 Server/Web/Android/iOS 端点和 `conversation/message/delta/done/error` SSE 事件集合。
- `pnpm check:android`：通过，Android 原生工程结构检查通过。
- `pnpm test:android`：通过，`:app:testDebugUnitTest` 成功。
- `pnpm dev:android`：通过，`:app:assembleDebug` 成功。
- `apps/android/gradlew.bat --no-daemon :app:assembleDebug :app:testDebugUnitTest`：通过，wrapper 直跑构建与 JVM 单测成功。
- `pnpm check:ios`：通过，iOS 原生工程结构检查通过；当前 Windows 环境无 xcodebuild。
- `pnpm test`：通过。
  - shared：2 tests passed
  - api-client：2 tests passed
  - server：10 tests passed
  - web：5 tests passed
- `pnpm build`：通过。
  - shared、api-client、server TypeScript 检查通过
  - web TypeScript 检查与 Vite build 通过
- Server health + `POST /chat/stream` smoke：通过，返回 `server health and stream smoke passed`。
- Skill 校验：`.codex/skills/android-native-demo-hardening` 通过 `quick_validate.py`。

## 2026-05-15 实际演示排障

- 服务端：`http://localhost:8787/health` 返回 `status: ok`、`modelMode: qwen`；`POST /chat/stream` 返回完整 SSE，并以 `event: done` 结束。
- Web：`http://localhost:5173` 返回 HTTP 200，可作为 Android 演示之外的备用闭环。
- Android 构建：`pnpm test:android` 与 `pnpm dev:android` 已修复并通过；脚本现在优先使用 `apps/android/gradlew.bat`，匹配项目 wrapper 的 Gradle `8.13`。
- Android Gradle 缓存：本机中文用户目录下 Gradle test worker 曾出现 `ClassNotFoundException: GradleWorkerMain`；演示脚本默认使用 `C:\Gradle\user-home` 作为 `GRADLE_USER_HOME`，并限制 `--max-workers=1`，避免现场构建受路径和并发影响。
- Android SDK 路径：模拟器曾因 `ANDROID_SDK_ROOT=C:\Android\Sdk` 与 AVD 实际路径 `D:\Android\Sdk` 不一致而报 `Broken AVD system path`；脚本现在优先读取 `apps/android/local.properties` 的 `sdk.dir` 并同步设置 `ANDROID_SDK_ROOT`、`ANDROID_HOME`。
- Android 网络：App 曾在服务端正常时显示“服务 离线”，原因是本地 Demo 使用 `http://10.0.2.2:8787`，Android 端需要允许本地 HTTP；已在 `AndroidManifest.xml` 增加 `android:usesCleartextTraffic="true"`，`pnpm check:android` 也会检查该配置。
- 模拟器实测：Pixel_7 AVD 已启动为 `device`，完成 `:app:installDebug`，打开 App 后服务状态显示在线，会话列表和 DataStore 缓存可见。
- Android 端到端发送：通过 App 输入 `android_demo_from_app` 并发送，服务端消息查询确认新增 user 消息与 assistant 回复，证明 Android -> Server -> SSE -> 本地状态链路可用于现场演示。
- 排障后回归：`pnpm check:contract`、`pnpm check:android`、`pnpm test:android`、`pnpm dev:android`、`pnpm test`、`pnpm build`、`pnpm check:ios` 均通过。
- 演示现场状态：`adb devices` 显示 `emulator-5554 device`；`GET /health` 返回 `status: ok`；`POST /chat/stream` 返回 HTTP 200 且包含 `event: done`；Web 首页返回 HTTP 200。

## 2026-05-15 文档同步

- 新增 [docs/demo-runbook.md](docs/demo-runbook.md)，集中维护 Server、Web、Android、iOS 的启动步骤、演示流程、验证命令和现场排障。
- README 已增加“多端演示总入口”和各端启动速查表。
- [docs/demo-showcase.md](docs/demo-showcase.md) 已同步为 Server -> Android -> Web -> iOS -> 架构/验证的现场讲解顺序。
- [docs/architecture.md](docs/architecture.md) 已同步各端运行入口、API 基础地址和架构角色。
- [docs/android-demo-guide.md](docs/android-demo-guide.md) 已补充指向统一 Runbook 的入口，继续作为 Android 主展示专项指南。
- [docs/spec/qianwen-app-demo-spec.md](docs/spec/qianwen-app-demo-spec.md) 与 [docs/development-log.md](docs/development-log.md) 已追加本轮 Runbook 修订记录。
- 文档引用检查通过；同步后执行 `pnpm check:contract`、`pnpm check:android`、`pnpm check:ios`、`pnpm test:android`，结果均通过。

## 2026-05-15 UI 对齐修复

- Web：参考千问 Web 端真实界面，将深色侧边栏改为浅色工作台侧边栏，主聊天区改为模型选择标题、居中消息流、浅蓝用户气泡、助手操作按钮和底部胶囊输入框。
- Web：修复“消息增多后输入框跟着滚动到页面底部并消失”的问题；现在 `html/body/#root` 锁定高度，页面不滚动，只允许消息区滚动，输入框固定在聊天 grid 最后一行。
- Android：参考千问 Android 端真实界面，重写 Compose 视觉层为白底聊天 App：顶部“千问”标题、左侧菜单、右侧状态入口、右侧用户气泡、左侧助手气泡、助手操作按钮、底部工具胶囊和圆角语音/文字输入框。
- Android：保留原有主展示能力，包括会话列表、搜索、重命名、置顶、删除、服务状态、清空消息、SSE 流式、取消/重试和本地缓存恢复。
- 视觉验证：使用 Edge headless 截图确认 Web 输入框固定可见，最终截图已归档到 `docs/screenshots/qwen-web-chat.png`。
- 视觉验证：安装新版 Android debug 包到 Pixel_7 AVD 并截图确认新界面生效，最终截图已归档到 `docs/screenshots/qwen-android-chat.png`。
- 回归验证：`pnpm --filter @qianwen/web test`、`pnpm --filter @qianwen/web build`、`pnpm test:android`、`pnpm dev:android`、`pnpm check:contract`、`pnpm check:android`、`pnpm test`、`pnpm build`、`pnpm check:ios` 均通过。

## 2026-05-15 交付风险收口

- `.gitignore` 已补充 `.idea/` 与 `apps/android/.idea/`，防止 Android Studio / IntelliJ 本机配置进入提交。
- 新增 `scripts/package-submission.ps1` 与 `pnpm package:submission`，用于生成默认不含对话记录、真实 `.env`、`local.properties`、IDE 目录、依赖目录和构建产物的代码文档提交包。
- `scripts/check-contract.ps1` 已升级为调用 `scripts/check-contract.mjs`，从关键字存在检查增强为 DTO 字段、端点路径和 SSE 事件集合检查。
- 最新 Android 与 Web 实测截图已归档到 `docs/screenshots/qwen-android-chat.png` 和 `docs/screenshots/qwen-web-chat.png`，并同步到 `docs/demo-showcase.md`。
- `pnpm package:submission` 已通过，生成 `qwen-demo-submission-code-docs.zip`；包内抽查 `bad=0`，未包含对话记录、`.env`、`local.properties`、`.idea`、`node_modules`、`dist/build` 或 `.log`。

## 本轮验证重点

- Android 已作为主展示端补强 Compose UI、ViewModel + StateFlow 状态模型、OkHttp SSE、取消/重试和 DataStore 本地恢复。
- Android `ChatSseParserTest` 覆盖 delta、message、done、error、multiline、malformed frame 和 SSE comment。
- Android `QianwenViewModelTest` 覆盖离线缓存恢复、发送失败保留输入、重复发送拦截和取消生成。
- 多端公共 API 未新增路由，`pnpm check:contract` 继续通过。
- iOS 原生工程结构检查继续通过，未受 Android 改动影响。
- Web、Server、shared 构建与测试保持通过，未破坏现有闭环。

## 备注

- 当前 Windows 环境仍无法执行 iOS Xcode build；iOS 继续以源码结构与合同静态检查验收。
- Smoke 首次尝试使用 `tsx -e` 顶层 `await`，因 CJS 输出限制失败；改为 async IIFE 后同等 health + stream smoke 通过。
- 未提交真实 API Key、`.env`、`local.properties`、`.idea` 或 build 产物。
- 当前服务端处于真实 `qwen` 模式，现场演示依赖网络和额度；如遇外部服务波动，可临时移除本机真实 Key 或使用 mock fallback 作为备用演示路径。
