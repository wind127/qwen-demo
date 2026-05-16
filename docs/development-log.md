# 千问 App Demo 追加式开发记录

## 2026-05-13 09:20 - SDD 原生化打磨启动

- 阶段：项目扫描与 SPEC。
- 操作：阅读根配置、README、架构说明、验证记录、服务端、Web、Expo mobile 代码。
- 决策：继续复用现有服务端、Web、shared types、api-client；完整闭环继续由 Web 承担。
- 原因：Web 已经具备端到端能力，继续打磨风险最低，符合“继续完善现有项目”的要求。
- 影响：移动端不再以 Expo React Native 作为正式交付入口，后续替换为 Android/iOS 原生工程。
- 验证结果：确认当前 Expo mobile 与新要求冲突；确认服务端和 Web 已有可复用 API 协议与测试基础。

## 2026-05-13 09:25 - SPEC v1 创建

- 阶段：SPEC。
- 操作：新增 `docs/spec/qianwen-app-demo-spec.md`。
- 决策：在 SPEC 中固化统一 API、数据模型、多端范围、原生技术选型、错误处理、持久化、流式回复和验收标准。
- 原因：满足 Spec-Driven Development 要求，后续实现按 SPEC 执行。
- 影响：后续若发现 SPEC 不准确，只在“变更记录”追加修订说明。
- 验证结果：SPEC 覆盖用户要求的全部章节。

## 2026-05-13 09:45 - 移动端原生化

- 阶段：代码实现。
- 操作：删除 `apps/mobile` Expo React Native 正式入口，新增 `apps/android` 与 `apps/ios`。
- 决策：Android 使用 Kotlin + Jetpack Compose + ViewModel + DataStore；iOS 使用 Swift + SwiftUI + ObservableObject + UserDefaults。
- 原因：用户明确禁止 Flutter、React Native、Ionic、Cordova、Capacitor 等跨端壳方案。
- 影响：根脚本移除 `dev:mobile` 和 `@qianwen/mobile` 测试，新增 Android/iOS 原生结构检查脚本。
- 验证结果：Android/iOS 原生源码、API 接入层、页面结构和本地持久化基础已创建；实际构建待本机 Android Gradle/Xcode 环境支持。

## 2026-05-13 10:05 - Web 重试与服务端测试补齐

- 阶段：代码实现。
- 操作：Web 发送失败后保留 prompt 并提供“重试”按钮；服务端测试新增空消息 400 与缺失会话 404。
- 决策：Web 继续作为完整闭环端，失败重试只重放最后一次失败 prompt，不改变服务端 API。
- 原因：满足“消息错误态、重试”和“API 协议保持兼容”的要求。
- 影响：用户在服务端离线或流式请求失败后可以直接重试。
- 验证结果：待执行 `pnpm test` 与 `pnpm build`。

## 2026-05-13 10:15 - Skill 沉淀

- 阶段：工程方法沉淀。
- 操作：新增 `.codex/skills/spec-driven-native-app/SKILL.md` 与 `.codex/skills/multi-client-api-contract/SKILL.md`。
- 决策：Skill 只记录可复用流程，不写项目流水账或业务代码。
- 原因：满足将程序性开发方法沉淀为 Codex Skill 的要求。
- 影响：后续多端原生 App 与统一 API 合同类任务可复用。
- 验证结果：两个 Skill 均包含 YAML frontmatter 的 `name` 与 `description`。

## 2026-05-13 10:35 - 本地验证与脚本修复

- 阶段：质量验证。
- 操作：执行 `pnpm test`、`pnpm build`、`pnpm check:android`、`pnpm check:ios`、health/Web/stream smoke、Skill 校验。
- 决策：将 Android/iOS PowerShell 检查脚本输出改为 ASCII。
- 原因：Windows PowerShell 对 UTF-8 无 BOM 中文脚本字符串解析不稳定，导致脚本解析失败。
- 影响：检查脚本在当前 Windows 环境稳定执行，同时项目文档仍可使用中文。
- 验证结果：`pnpm test`、`pnpm build`、`pnpm check:android`、`pnpm check:ios` 均通过；health、Web 首页和 stream smoke 通过；两个 Skill 均通过 `quick_validate.py`。

## 2026-05-13 22:52 - 原生端 dev 入口补齐

- 阶段：代码实现。
- 操作：新增 `pnpm dev:android` 与 `pnpm dev:ios`，并新增对应 PowerShell 脚本。
- 决策：在保留 `check` 的同时增加可执行入口，`dev` 脚本先运行结构检查，再尝试调用系统工具链。
- 原因：满足“Android 相关说明或脚本”的要求，并为后续有工具链环境的同学提供直接入口。
- 影响：当前环境无 Gradle/Xcode 时命令会明确失败并输出下一步指引，不会静默通过。
- 验证结果：`pnpm check:android`、`pnpm check:ios` 通过；`pnpm dev:android`、`pnpm dev:ios` 在当前环境按预期以非 0 退出并输出工具链缺失指引。

## 2026-05-14 11:45 - Android/iOS 流式回复接入

- 阶段：代码实现与验证。
- 操作：Android 端将 `QianwenApiClient` 从整包字符串拆分改为逐行 SSE 解析，并在 `QianwenViewModel` 中按 `conversation/message/delta/done/error` 事件增量更新消息；iOS 端将 `URLSession.data` 占位实现改为 `URLSession.bytes` 流式解析，并在 `QianwenStore` 中增量落屏和状态更新。
- 决策：原生端与 Web 统一消费 `POST /chat/stream`，减少多端行为差异。
- 原因：满足多端一致的会话流式体验，并消除“仅预留入口”的未完状态。
- 影响：Android/iOS 可复用服务端统一 SSE 协议，后续新增事件时只需扩展事件映射层。
- 验证结果：`pnpm test`、`pnpm build`、`pnpm check:android`、`pnpm check:ios` 通过；本地启动服务与 Web 后，`GET /health` 返回 `status: ok` 且 `modelMode: qwen`，`POST /chat/stream` smoke 返回 `event: done`，Web 首页返回 HTTP 200。

## 2026-05-14 12:20 - 原生流式测试模板补齐

- 阶段：代码实现与验证。
- 操作：Android 新增 `ChatSseParser` 纯解析器与 JVM 单测 `ChatSseParserTest`；iOS 在 `QianwenApiClient.swift` 内抽出 `ChatSseParser`，并新增 `QianwenAppTests/ChatSseParserTests.swift` 与 `QianwenAppTests` target 配置。
- 决策：解析逻辑下沉到可测试层，避免只能通过 UI 联调验证流式正确性。
- 原因：提升多端流式协议演进时的回归效率，满足“可复用模板”目标。
- 影响：Android 在具备 Gradle 环境后可直接运行 `:app:testDebugUnitTest`；iOS 在 macOS + Xcode 下可直接运行 `QianwenAppTests`。
- 验证结果：`pnpm test`、`pnpm build`、`pnpm check:android`、`pnpm check:ios` 通过；当前 Windows 环境无法执行 Android Gradle 单测和 iOS XCTest 实跑。

## 2026-05-14 13:40 - Windows 本机工具链安装

- 阶段：环境准备与验证。
- 操作：安装 Android Command-line Tools 到 `C:\Android\Sdk`，安装 SDK 组件 `platform-tools`、`platforms;android-35`、`build-tools;35.0.0`，安装 Gradle `8.10.2` 到 `C:\Gradle\gradle-8.10.2`，设置用户级 `ANDROID_HOME`、`ANDROID_SDK_ROOT` 与 PATH。
- 决策：在 `dev-android.ps1` 中增加 Gradle 显式回退路径与 SDK 环境变量兜底，新增 `test-android.ps1` 与根脚本 `pnpm test:android`。
- 原因：确保当前终端未刷新 PATH 时仍可直接构建和执行 Android 单测。
- 影响：`pnpm dev:android` 与 `pnpm test:android` 在本机可直接成功；iOS 仍因 Windows 无法安装 Xcode 仅做源码级验收。
- 验证结果：`pnpm dev:android` 成功生成 debug 构建，`pnpm test:android` 成功通过 `:app:testDebugUnitTest`，并再次通过 `pnpm test`、`pnpm build`、`pnpm check:android`、`pnpm check:ios`。

## 2026-05-14 14:20 - 多端会话管理与合同检查

- 阶段：代码实现与验证。
- 操作：初始化 Git 仓库并提交基线；Android/iOS 补齐会话搜索、重命名、置顶、删除；补强 Web API client、Server、Android、iOS SSE 解析与错误事件测试；新增 `pnpm check:contract` 静态合同检查。
- 决策：服务端继续作为 API 合同源头，不改变现有路由路径；原生端只镜像既有 `PATCH /conversations/:id` 与 `DELETE /conversations/:id` 能力。
- 原因：让 Web、Android、iOS 的核心会话管理行为一致，并降低多端 DTO 与流式事件漂移风险。
- 影响：原生端会话列表能力与 Web 对齐；后续修改合同需同步更新共享 DTO、客户端模型和合同检查脚本。
- 验证结果：`pnpm --filter @qianwen/api-client test`、`pnpm --filter @qianwen/server test`、`pnpm check:contract`、`pnpm check:android`、`pnpm check:ios`、`pnpm test:android`、`pnpm build` 与本机 HTTP smoke 均通过。

## 2026-05-14 23:10 - Android 主展示端增强

- 阶段：代码实现与文档维护。
- 操作：增强 Android ViewModel 状态模型，新增 service/list/send/cache/retry 状态；将输入草稿收敛到 ViewModel；增强 OkHttp SSE done/error/异常帧/中断/取消处理；DataStore 快照增加版本与保存时间；Compose UI 展示服务、列表、缓存、流式、取消、失败重试等状态。
- 决策：不改变服务端 API 和多端 DTO，Android 内部新增 `QianwenRepositoryContract` 作为可测试边界。
- 原因：二面展示需要体现 Android 原生客户端深度，而不是只证明多端工程存在。
- 影响：Android 可以作为主展示端演示会话管理、SSE 流式回复、弱网失败保留输入、本地缓存恢复和服务状态页。
- 验证结果：阶段内先执行 `pnpm test:android`，`:app:testDebugUnitTest` 通过。

## 2026-05-14 23:35 - Android 测试与 Skill 沉淀

- 阶段：测试与工程方法沉淀。
- 操作：新增 `QianwenViewModelTest`，覆盖离线缓存恢复、发送失败保留输入、重复发送拦截和取消生成；扩展 `ChatSseParserTest` 覆盖 malformed frame 与 SSE comment；新增 `.codex/skills/android-native-demo-hardening/SKILL.md`。
- 决策：使用 `kotlinx-coroutines-test` 做 JVM 单测，不引入 Robolectric 或大型测试框架。
- 原因：保持 Android 官方协程测试生态，同时避免增加面试 Demo 的维护面。
- 影响：ViewModel 状态流转可在本地快速回归；Android 打磨流程可复用于后续同类任务。
- 验证结果：`android-native-demo-hardening` 通过 skill `quick_validate.py` 校验。

## 2026-05-15 14:45 - 多端演示 Runbook 同步

- 阶段：文档维护与交付准备。
- 操作：新增 `docs/demo-runbook.md`，按 Server、Web、Android、iOS 分别补充启动步骤、演示流程、验证命令和现场排障；同步更新 README、demo-showcase、architecture、Android guide、SPEC、verification、testing log 和 operations log。
- 决策：把详细执行步骤集中到统一 Runbook，各专项文档只保留入口、角色和差异点。
- 原因：面试现场需要快速切换多端演示，分散文档容易出现端口、API 地址和启动命令不一致。
- 影响：后续展示时可先打开 Runbook，再按 Android 主展示、Web 备用闭环、iOS 原生结构的顺序讲解，降低现场遗漏风险。
- 验证结果：文档引用检查通过；`pnpm check:contract`、`pnpm check:android`、`pnpm check:ios`、`pnpm test:android` 均通过。

## 2026-05-15 21:20 - 千问真实 UI 对齐

- 阶段：UI 优化与演示排障。
- 操作：参考用户提供的千问 Web 与 Android 端截图，调整 Web 侧边栏、模型标题、消息气泡、助手操作按钮和底部输入框；重写 Android Compose 视觉层为移动端千问聊天形态。
- 决策：只改客户端展示层，不改变服务端 API、DTO、SSE 协议、Repository 或 ViewModel 状态模型。
- 原因：当前 Demo 功能完整但视觉仍像工程 Demo，需要更接近真实千问产品以提升二面展示可信度。
- 影响：Web 输入框固定在聊天视口底部，不再随消息增多被整页滚动带走；Android 端从表单式状态卡片改成真实聊天 App 观感，同时保留主展示端能力。
- 验证结果：`pnpm --filter @qianwen/web test`、`pnpm --filter @qianwen/web build`、`pnpm test:android`、`pnpm dev:android`、`pnpm check:contract`、`pnpm check:android`、`pnpm test`、`pnpm build`、`pnpm check:ios` 均通过；Web 和 Android 均完成截图确认。

## 2026-05-15 22:55 - 面试交付风险收口

- 阶段：交付准备与合同检查增强。
- 操作：补充 `.gitignore` 的 IDE 目录规则；新增 `scripts/package-submission.ps1` 与 `pnpm package:submission`；将 `pnpm check:contract` 从 token 检查升级为 DTO 字段、端点路径、SSE 事件集合检查；归档最新 Android/Web 截图到 `docs/screenshots`。
- 决策：对话记录单独处理，本轮提交包默认不包含对话记录，避免把旧版记录误打入最终代码文档包。
- 原因：二面提交材料最容易出问题的是本机配置、真实 Key、构建产物、旧截图和协议漂移；这些风险可以通过脚本和文档收口。
- 影响：后续只需执行 `pnpm package:submission` 即可得到干净的代码文档包；合同漂移能在本地检查阶段更早暴露。
- 验证结果：`pnpm check:contract` 已通过，输出 10 个 DTO、9 个端点和 5 类 SSE 事件检查结果。
