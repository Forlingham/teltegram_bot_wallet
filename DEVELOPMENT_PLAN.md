# SCASH 钱包开发计划（分步执行）

更新时间：2026-04-12

本计划用于按阶段推进开发，避免需求漂移和返工。默认每一步完成后进行一次自测，再进入下一步。

---

## 总体目标

- 以 `SPEC.md` 为唯一需求基线
- 先完成基础设施与安全底座，再实现业务闭环
- 保证“明文助记词不离开前端，后端仅存加密密文”

---

## Phase 1 - 项目骨架与基础设施

目标：建立可持续迭代的后端基础。

范围：
- NestJS 模块骨架（wallet/redpacket/cover/blockchain/utxo/auth/common）
- Prisma 接入与 PostgreSQL 连接
- `.env` 配置读取与校验
- 全局异常过滤、统一响应结构、基础日志
- 健康检查接口（如 `/health`）

验收标准：
- 服务可启动
- 数据库连接正常
- 健康检查返回成功

---

## Phase 2 - 认证与会话安全

目标：先把安全和身份打通，避免后续返工。

范围：
- Telegram Mini App `initData` 验签
- `auth_date` 时效校验（防过期）
- nonce 防重放
- 服务端会话绑定 `telegramId`
- 受保护 API 的 Guard/中间件

验收标准：
- 未登录请求被拒绝
- 合法 `initData` 可通过
- 重放请求被识别并阻断

---

## Phase 3 - 钱包与云备份 API

目标：完成钱包主流程（不涉及明文助记词落地）。

范围：
- `/api/wallet/create`
- `/api/wallet/import`
- `/api/wallet/bind`
- `/api/wallet/backup`
- `/api/wallet/recover`（仅返回密文备份）
- `/api/wallet/balance`

验收标准：
- 创建/导入/绑定流程可用
- 后端仅保存加密数据，不返回/存储明文助记词
- 可查询余额（先基于当前 UTXO 数据源）

---

## Phase 4 - UTXO 同步与余额引擎

目标：构建红包业务依赖的链上资金基础能力。

范围：
- 启动时区块补同步（从 `BlockSync.lastBlockHeight + 1`）
- 运行时 ZMQ 实时同步（新区块 + 新交易）
- UTXO 入库、花费标记、确认状态更新
- UTXO 选择策略（FIFO + 未确认兜底）
- 余额统计（confirmed/unconfirmed）

验收标准：
- 重启后可续同步
- 新交易/新区块可实时反映到 UTXO
- 余额与选币结果稳定

---

## Phase 5 - 红包核心闭环

目标：实现创建、领取、过期退款完整流程。

范围：
- `/api/redpacket/create`
- `/api/redpacket/:id`
- `/api/redpacket/:id/claim`
- `/api/redpacket/user/packets`
- 过期退款调度任务
- PendingTransfer 扫描与重试
- 幂等与并发安全（`packetHash + telegramId`）

验收标准：
- 红包创建后可领取
- 同一用户不可重复成功领取
- 过期后可退款并更新状态
- 重试机制不出现重复打款

---

## Phase 6 - 封面商城

目标：完成封面资产化与红包挂载。

范围：
- `/api/cover/create`（管理员）
- `/api/cover/list`
- `/api/cover/purchase`
- `/api/cover/my`
- 购买后用户资产绑定（UserCover）
- 红包创建时封面关联

验收标准：
- 可查看、购买、查询已购封面
- 限量逻辑正确
- 红包可正确引用封面元数据

---

## Phase 7 - Mini App 页面与联调

目标：端到端可演示版本。

范围：
- 钱包页面（创建/导入/恢复/余额）
- 红包页面（创建/详情/领取/记录）
- 封面商城页面（列表/购买/我的）
- 分享链路与卡片打开 Mini App
- 统一错误提示与加载状态

验收标准：
- 主流程可在 Telegram Mini App 内完整跑通
- 移动端适配正常
- 核心异常路径有明确提示

---

## 每阶段固定执行项

- 更新 Prisma migration
- 补最少必要测试（单测/集成）
- 记录接口变更
- 完成后打一个里程碑 tag（可选）

---

## 当前执行顺序

1. 先做 Phase 1（项目骨架与基础设施）
2. Phase 1 自测通过后进入 Phase 2
3. 按顺序推进到 Phase 7
