# brainstorm: 时间追踪与AI复盘APP

## Goal

构建一款时间追踪与复盘应用：在手机或电脑后台以低打扰方式记录用户在做什么以及持续时长；允许用户手工补齐脱离设备的时间；基于结构化时间数据生成统计图表，并由 AI 自动生成日报/周报/月报，支持用户在报告基础上写复盘日记。

## What I already know

- 用户希望应用可运行在手机或电脑上。
- 用户希望后台“无感”记录设备上的具体活动与耗时。
- 用户希望支持手工补录脱离手机/电脑的时间段。
- 用户希望有统计图表展示时间分布与趋势。
- 用户希望由 AI 生成日报、周报、月报，并支持复盘日记编辑。
- 用户已确认：MVP 采用“手机 + 电脑双端同步起步”。
- 用户已确认：自动追踪粒度采用“窗口/页面级”。
- 用户明确希望：浏览器场景可区分“工作 vs 娱乐”；Codex 场景可区分“具体项目花费时长”。
- 用户已确认：当前阶段只做“最小版 MVP”（不额外扩展稳健/高级能力）。
- 用户新增约束：不做中心化账号体系，倾向用户自配置存储实现多端同步（可基于 Cloudflare）。
- 用户已确认：同步时效选择“准实时”即可（非强实时）。
- 用户当前倾向：同步方案选 B（用户自配 R2 对象同步）。
- 用户新增关键要求：即使不配置同步功能，也必须可以单机本地完整可用。
- 用户已确认：AI 总结采用“云端模型 + 用户自填 API Key”。
- 用户已确认：所有资源记录都可由用户进行自由标签/分类标注（不局限浏览器）。
- 用户新增要求：分类标注交互必须足够便捷（低操作成本）。
- 用户新增要求：归类不应按“应用名”主导，而应按“实际资源实体”（如 URL、工程项目）主导。
- 用户新增要求：支持多窗口并行活动记录，能够体现并行占用时间。
- 用户已确认：并行活动时长采用“叠加口径”统计（日报总时长可超过 24h）。
- 用户已确认：方案 B 的同步对象格式选择 NDJSON 事件流。
- 用户明确：手机与电脑记录属于并行叠加，不应按“互斥冲突”处理。
- 用户已确认：编辑层冲突采用“最后编辑优先（LWW）”。
- 用户已确认：便捷标注交互入口采用“批量待办箱”。
- 用户已确认：开发活动按“工程根目录”归因；浏览器/文档活动读取“网页/文档标题”用于更细分类。
- 用户已确认：标题类信息采用“明文同步”，并以“同步是可选能力、单端体验优先”为原则。
- 用户已确认：R2 同步采用“按天 + 设备分片”，并提供“定时同步周期可配置”功能。
- 用户新增需求：PR4 需加入报告推送能力，可配置 Webhook 或钉钉/飞书机器人推送。
- 用户已确认：报告推送内容格式 MVP 先做“纯文本摘要”。
- 用户已确认：标签模型采用“单选主分类 + 多标签”。
- 当前仓库为 Trellis 初始化状态，暂无业务应用代码（无 `src/` 应用层实现）。
- 当前仓库已有的规范文档以 Electron + React + SQLite 为参考模板，但移动端尚未落地。

## Assumptions (temporary)

- 第一版（MVP）需包含双端可用与跨端数据同步的最小闭环能力。
- 同步机制优先满足“准实时 + 个人单账号跨设备一致性”，复杂协作冲突可后置。
- 后台记录需满足平台权限与隐私合规限制（可见、可控、可关闭）。
- 本地模式应与同步模式共享同一业务能力，避免出现“必须联网才可用”的产品断层。
- 原始追踪事件应采用追加写（append-only）模型，以“去重与有序合并”替代“覆盖式冲突合并”。

## Open Questions

- （当前无阻塞问题，进入实现前确认阶段）

## Code-Spec Depth Check

- [x] Target code-spec files identified
  - `packages/core/src/types.ts`
  - `packages/core/src/classification.ts`
  - `packages/core/src/event-log.ts`
  - `packages/sync-r2/src/types.ts`
  - `packages/sync-r2/src/scheduler.ts`
  - `apps/desktop/src/*` and `apps/mobile/src/*` (scaffold)
- [x] Concrete contracts defined
  - `ActivityEvent`:
    - `eventId: string`
    - `deviceId: string`
    - `resourceKind: 'web' | 'document' | 'project' | 'app' | 'manual'`
    - `resourceKey: string`
    - `resourceTitle?: string`
    - `startedAt: number` (ms)
    - `endedAt: number` (ms)
    - `source: 'auto' | 'manual'`
  - `Annotation`:
    - `primaryCategory?: string`
    - `tags: string[]`
    - `note?: string`
    - `updatedAt: number`
    - `updatedByDeviceId: string`
  - `SyncObjectPath`:
    - `YYYY-MM-DD/<device-id>.ndjson`
  - `SyncSettings`:
    - `enabled: boolean`
    - `bucket: string`
    - `accountId: string`
    - `accessKeyId: string`
    - `secretAccessKey: string`
    - `region: string`
    - `syncIntervalMinutes: 1 | 5 | 15 | 30 | 60`
- [x] Validation and error matrix defined
  - invalid event interval (`endedAt <= startedAt`) -> reject event
  - duplicate `eventId` on merge -> ignore duplicate (idempotent)
  - invalid R2 path -> block sync and surface config error
  - invalid sync interval -> fallback to default `5`
  - annotation update race -> LWW by `updatedAt` then `updatedByDeviceId` lexical tiebreak
- [x] Good/Base/Bad cases defined
  - Good:
    - desktop + mobile append distinct events; merge yields combined timeline
    - user updates primaryCategory on desktop; mobile later update overwrites (LWW)
  - Base:
    - no sync configured; all record/stat/report features work locally
  - Bad:
    - malformed NDJSON line in sync file; skip bad line, keep rest and raise warning
    - missing R2 credential fields; disable sync tick and show actionable error

## Requirements (evolving)

- 支持手机端与电脑端双端使用，并在同一账号下同步时间记录与复盘数据。
- 支持在“未配置同步”时单机本地完整使用核心功能（记录、统计、复盘、AI 总结）。
- 支持窗口/页面级自动记录设备内活动及其时间消耗（不仅是应用级）。
- 支持以“资源实体”为中心的归因模型：优先 URL/页面、工程项目，其次才回退到应用级。
- 归因规则细化：开发活动以工程根目录为主键；浏览器/文档活动提取标题作为分类特征。
- 标题类信息在同步对象中可使用明文，以保证跨端分类质量（同步功能保持可选）。
- 支持手工录入设备外活动时间。
- 支持所有资源记录的用户自由标签/分类标注，并提供便捷标注交互。
- 支持基于用户标签体系输出分类统计（例如工作/娱乐/学习/项目等）。
- 标签模型采用“单选主分类 + 多标签”：每条记录必须有 0..1 个主分类，可附加多个标签。
- 便捷标注交互以“批量待办箱”为主入口：聚合未分类片段进行集中处理。
- 支持多窗口并行活动追踪，并在时间轴中保留并行关系信息。
- 并行活动统计采用叠加口径，并在报表中明确区分“自然时长”与“并行叠加时长”语义。
- 支持 Codex 场景按“项目维度”统计时长分布。
- 同步数据采用 NDJSON 事件流作为跨端交换格式。
- R2 对象分片采用“按天 + 设备”规则（示例：`YYYY-MM-DD/<device-id>.ndjson`）。
- 同步核心采用“append-only + event_id 幂等去重 + 时间有序合并”，不做原始事件覆盖写。
- 对同一可编辑字段（分类/备注）在多端并发修改时，采用最后编辑优先（LWW）。
- 支持按天查看时间分布并进行分类统计。
- 支持 AI 生成阶段性总结（日报/周报/月报）。
- 支持在 AI 报告基础上编辑个人复盘内容。
- 支持将日报/周报/月报按配置推送到外部渠道（Generic Webhook、钉钉机器人、飞书机器人）。
- 推送内容格式 MVP 采用纯文本摘要，优先保证渠道兼容性与可达性。
- 不依赖中心化账号体系，支持用户通过自配置存储完成多端同步（优先考虑 Cloudflare 生态）。
- 同步时效以准实时为目标（例如分钟级批量上报/拉取）。
- 支持用户配置定时同步周期（例如 1 分钟 / 5 分钟 / 15 分钟）。
- AI 调用采用用户自填 API Key 的云端模型方式（应用不托管平台账号体系）。

## Acceptance Criteria (evolving)

- [ ] 用户在手机端与电脑端对同一日期数据的查看结果一致（允许可解释的秒级差异）。
- [ ] 用户在未配置同步时，依然可在单机端完成记录、统计、复盘与报告生成闭环。
- [ ] 用户可在单日时间轴中看到自动记录与手工补录条目。
- [ ] 用户可查看窗口/页面级记录明细（例如页面标题或活动窗口标识）。
- [ ] 用户可基于自定义标签体系（含工作/娱乐等）查看对应时长汇总。
- [ ] 每条记录可设置一个主分类并附加多个标签，统计可按主分类和标签维度聚合。
- [ ] 用户可在 3 步以内完成一段资源活动的分类修正，并可复用于后续同类活动。
- [ ] 用户可在“批量待办箱”中一次性处理当日未分类片段，并批量应用分类规则。
- [ ] 用户可在开发活动中按工程项目查看时长占比，不依赖应用名作为主分类键。
- [ ] 浏览器/文档活动可展示标题维度信息，并用于分类统计与标注修正。
- [ ] 启用同步后，标题信息可在另一端被用于分类统计；未启用同步时，本地体验不受影响。
- [ ] 用户可在同一时段看到并行活动记录（例如多个窗口/标签），且可区分其并行占用时长。
- [ ] 日报/周报中可展示并行叠加时长（允许超过 24h）并给出口径说明。
- [ ] 同步对象可被解析为 NDJSON 事件流，并可在另一端成功增量合并。
- [ ] R2 对象按“日期 + 设备”规则落盘，且另一端可按该规则增量拉取。
- [ ] 同一批事件重复同步不会产生重复记录（event_id 幂等去重生效）。
- [ ] 同一条目被手机与电脑先后修改时，最终结果与“最后编辑时间”一致。
- [ ] 用户可查看至少一种图表（例如分类饼图或时段柱状图）来理解时间分配。
- [ ] 用户可触发并查看 AI 生成的当日总结。
- [ ] 用户可保存对 AI 总结的手工补充与反思内容。
- [ ] 用户可配置至少一个推送目标（Webhook / 钉钉 / 飞书），并成功收到报告推送。
- [ ] 推送消息在 Webhook / 钉钉 / 飞书渠道均可按纯文本格式成功送达。
- [ ] 同步配置后，双端数据在准实时窗口内（分钟级）收敛一致。
- [ ] 用户可在设置中修改定时同步周期，并在下一周期生效。
- [ ] 用户可在设置中配置/更新 API Key，并基于该 Key 成功生成日报内容。

## Technical Approach

- 架构模式：Local-first + Optional Sync
- 本地数据：设备端本地事件库（append-only）
- 同步数据：用户自配 Cloudflare R2，NDJSON 事件流
- 分片规则：按天 + 设备（`YYYY-MM-DD/<device-id>.ndjson`）
- 合并策略：`event_id` 幂等去重 + 时间有序合并
- 编辑冲突：LWW（最后编辑优先）
- 分类策略：资源实体优先（URL/标题、工程根目录），应用名仅作回退信息；所有资源支持用户自由标签/分类
- 并行统计：叠加口径（可超过 24h）
- AI 报告：云端模型 + 用户自填 API Key
- 报告推送：统一 Push Adapter（Webhook / 钉钉 / 飞书机器人）
- 推送载荷：MVP 纯文本摘要（后续再扩展 Markdown 卡片）

## Decision (ADR-lite)

**Context**
需要在“隐私可控、无中心化账号、双端同步、MVP 复杂度”之间取平衡，并优先保障单端体验。

**Decision**
采用方案 B（用户自配 R2）+ NDJSON 事件流 + 按天设备分片 + 准实时定时同步。

**Consequences**
- 优点：部署轻、免费可起步、去中心化账号诉求满足、单端可离线闭环。
- 代价：统计聚合更多在客户端完成；后续若规模扩大，可能需要引入服务端查询层。
- 代价：新增外部推送渠道适配与失败重试逻辑，PR4 复杂度上升。

## Definition of Done (team quality bar)

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (explicit)

- 企业级团队协作、组织报表与多租户权限。
- 复杂商业化能力（订阅计费、发票系统）。
- 第三方平台深度集成（如日历双向同步、企业 IM 自动写入）在 MVP 外。
- 中心化托管账号/账号平台（账号注册、密码找回、集中式用户库）在 MVP 外。
- 企业级 IM 集成能力（组织通讯录、审批流、OAuth 企业应用）在 MVP 外。

## Technical Notes

- 新建任务：`.trellis/tasks/03-27-time-tracker-ai-recap/`
- 已检查：
  - `.trellis/workflow.md`
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/guides/index.md`
- 约束：当前仓库无实际业务代码，属于从 0 到 1 的产品与技术方案定义阶段。

## Research Notes

### What similar tools do

- ActivityWatch 采用本地优先与窗口标题级采集，支持浏览器扩展；同步能力走“用户自选文件同步工具”路线（非中心化账户）。
- Toggl/RescueTime 等主流产品通常采用中心化云账户实现跨端一致性与报表。

### Constraints from our product choices

- 已明确“去中心化账号体系 + 双端同步起步 + 窗口/页面级追踪”，意味着需要在隐私、部署复杂度、同步一致性之间取平衡。
- MVP 需要“最小闭环”，不能引入过重运维步骤。
- 已明确“本地可用优先”：同步是增强能力，不是核心功能前置依赖。

### Cloudflare capability notes (verified)

- D1: SQLite 语义、Worker/HTTP API 访问，单库上限 10GB（Paid）/500MB（Free）。
- R2: S3 兼容对象存储，强一致模型，适合事件归档与跨端对象同步。
- Workers KV: 最终一致，不适合作为强一致主记录源。
- Durable Objects: 单线程、强一致，适合做冲突协调或顺序写入网关。

### Feasible approaches here

**Approach A: User-managed Cloudflare Worker + D1 (+R2 archive)**

- How it works:
  - 用户在自己的 Cloudflare 账号部署一份 Worker（模板化一键部署）。
  - 设备端通过用户配置的 endpoint + token 同步结构化事件到 D1。
  - 可选把原始事件批量归档到 R2（降低 D1 历史压力）。
- Pros:
  - 满足“非中心化账号体系”（你不托管账号）。
  - 查询能力强，适合日报/周报/月报和项目维度统计。
  - R2 可作为低成本长时归档。
- Cons:
  - 首次配置成本高于纯本地方案。
  - 需要设计 token 与设备撤销策略。

**Approach B: User-managed R2 object-only sync** (User-leaning)

- How it works:
  - 各端写入按天/按设备切分的 NDJSON 对象到 R2。
  - 客户端拉取并本地合并后再做统计与 AI 汇总。
- Pros:
  - 架构简单、成本低。
  - 完全去中心化，用户可直管对象数据。
- Cons:
  - 查询与聚合成本转移到客户端，MVP 统计逻辑更复杂。
  - 冲突处理、幂等与回放复杂度较高。

**Approach C: Local-first + sync folder bridge (ActivityWatch-like)**

- How it works:
  - 各端只维护本地数据库，再把“同步中间文件”交给外部同步层（可接入 Cloudflare R2 工具链）。
- Pros:
  - 隐私心智清晰，最贴近“本地优先”。
- Cons:
  - 双端一致性与冲突可观测性较弱。
  - 与你要的“窗口/页面级 + 项目级统计 + AI 汇总”闭环集成成本更高。
