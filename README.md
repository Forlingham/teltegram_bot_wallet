# SCASH 非托管钱包

**基于 Scash 区块链的非托管式钱包，核心功能是发红包**

![Version](https://img.shields.io/badge/version-v2.0-blue)
![Status](https://img.shields.io/badge/status-开发完成-green)
![Tech](https://img.shields.io/badge/技术栈-NestJS|EJS|PostgreSQL|Scash-green)

---

## 项目简介

SCASH 是一个基于 Telegram Mini App 的**非托管式 SCASH 钱包**。用户完全掌控私钥（助记词），支持发送/接收 SCASH，红包只是其核心功能之一。

### 核心特性

| 特性 | 说明 |
|------|------|
| 完全非托管 | 助记词本地生成，签名在浏览器完成，私钥从不离开设备 |
| 云端加密备份 | 用户密码加密助记词后上传，换设备可恢复 |
| 观察钱包绑定 | 只接收，不泄露私钥 |
| 红包功能 | 平分/拼手气两种模式，自定义有效期 |
| 刻字上链 | 将文字/JSON 永久刻入 SCASH 区块链 |
| 收发功能 | 发送/接收 SCASH，扫码转账 |

### 角色说明

| 角色 | 说明 |
|------|------|
| 发送者 | 创建红包并支付 gas |
| 领取者 | 领取红包 |
| 统筹账户 | 系统归集账户，负责红包资金托管和批量发放 |

---

## 技术架构

### 技术选型

| 组件 | 技术 |
|------|------|
| 后端框架 | NestJS + TypeScript |
| 模板引擎 | EJS (服务端页面模板，JS 逻辑在客户端执行) |
| 数据库 | PostgreSQL + Prisma |
| 区块链 | Scash (Bitcoin 架构) |
| 钱包库 | bitcoinjs-lib + bip39 + bip32 |
| DApp 协议 | scash-dap (链上留言) |
| Telegram | Mini App + Bot API |
| 定时任务 | @nestjs/schedule |

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Telegram                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Mini App │  │ Bot     │  │ 链接    │  │ 分享卡片 │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │
                     ┌──────▼──────┐
                     │   NestJS    │
                     ├─────────────┤
                     │ Controllers  │
                     │ - Pages     │
                     │ - API       │
                     ├─────────────┤
                     │ Modules     │
                     │ - Wallet    │
                     │ - Redpacket │
                     │ - Cover     │
                     │ - Blockchain│
                     ├─────────────┤
                     │ EJS Views   │
                     └──────┬──────┘
                            │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
 ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
 │ PostgreSQL  │     │ Scash Node  │     │  UTXO Index │
 │ (Prisma)    │     │ (RPC/ZMQ)   │     │  (内存)      │
 └─────────────┘     └─────────────┘     └──────────────┘
```

### 数据流程

```
发送红包:
用户 → 构造交易(前端) → 签名(浏览器) → 广播(链上) → DAP留言(链上) → 元数据(后端)

领取红包:
用户点击 → Mini App → 后端验证 → 统筹账户转账(链上) → DAP留言(链上) → 更新状态(后端)
```

### Scash 网络配置

#### Regtest (开发环境)
```typescript
{
  messagePrefix: "\x18Scash Signed Message:\n",
  bech32: "bcrt",
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x7d,
  wif: 0x80,
}
```

#### Mainnet (生产环境)
```typescript
{
  messagePrefix: "\x18Scash Signed Message:\n",
  bech32: "scash",
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x7d,
  wif: 0x80,
}
```

#### 地址前缀
| 环境 | 前缀 | 示例 |
|------|------|------|
| Regtest | `bcrt1` | `bcrt1q...` |
| Mainnet | `scash1` | `scash1q...` |

### BIP32 派生路径
```
m/84'/0'/0'/0/0  (第一个地址，用于主地址)
m/84'/0'/0'/0/n  (找零地址，n >= 1)
```

---

## 钱包系统

### 钱包类型

| 类型 | 创建方式 | 发送 | 接收 | 云备份 |
|------|----------|------|------|--------|
| 完整钱包 | 生成/导入助记词 | ✅ | ✅ | ✅ |
| 观察钱包 | 仅绑定地址 | ❌ | ✅ | ❌ |

**观察钱包说明**: 只能接收红包/转账，无法发送（无私钥）。

### 云端加密备份

> **重要**: 所有助记词操作（生成、加密、解密）都在浏览器前端完成。后端只存储与 Telegram 账号绑定的加密备份数据，永远不接触明文助记词。

**流程**:
```
首次绑定/导入:
助记词 → PBKDF2(密码, Salt, 100000) → AES-256-GCM 加密 → 上传 { salt, iv, authTag, ciphertext }

换设备恢复:
下载 { salt, iv, authTag, ciphertext } → PBKDF2(密码, Salt, 100000) → 解密 → 恢复助记词
```

**存储格式**:
```json
{
  "salt": "随机16字节hex",
  "iv": "随机16字节hex",
  "authTag": "16字节hex",
  "ciphertext": "加密助记词hex"
}
```

### UTXO 管理

#### UTXO 选择策略
- **策略**: 最早 UTXO 策略 (FIFO - First In First Out)
- 优先使用最早的 UTXO

#### UTXO 确认规则
| UTXO 类型 | 最小确认数 | 说明 |
|-----------|-----------|------|
| 内存池 UTXO | 0 | 区块高度 = 0，可直接使用 |
| Coinbase UTXO | 100 | 挖矿奖励，需成熟后才能使用 |
| 普通 UTXO | 1 | 1 个确认即可使用 |

#### UTXO 同步策略
```
启动时同步:
1. 从 BlockSync 表读取 lastBlockHeight
2. 从 lastBlockHeight + 1 继续同步到最新区块
3. 同步完成后启动 ZMQ 监听

运行时同步 (ZMQ):
4. ZMQ 监听新区块 (hashblock)
   - 解析新区块，更新 UTXO 表中对应 UTXO 的 blockHeight
   - isUnconfirmed = false
   - 更新 BlockSync 表

5. ZMQ 监听新交易 (rawtx)
   - 监听内存池中的新交易
   - 预存交易输出到 UTXO 表（blockHeight = 0, isUnconfirmed = true）
   - 标记已花费的输入 UTXO（isSpent = true）

仅在服务启动时执行一次区块补同步，运行时默认只使用 ZMQ 实时同步
```

---

## 红包系统

### 红包类型
| 类型 | 英文名 | 分发方式 |
|------|--------|----------|
| 平分红包 | EQUAL | 每人平均分配 |
| 拼手气红包 | RANDOM | 随机金额（二倍均值法） |

### 红包有效期
| 选项 | 秒数 | 说明 |
|------|------|------|
| 3分钟 | 180 | 仅开发环境 |
| 24小时 | 86400 | 默认 |
| 7天 | 604800 | - |
| 永久 | 31536000 | - |

### 红包创建流程
```
1. 用户在 Mini App 填写:
   - 红包类型 (EQUAL / RANDOM)
   - 总金额 (SCASH)
   - 红包份数
   - 祝福语 (可选)
   - 封面 (可选)
   - 有效期 (可选，默认24小时)

2. 前端构造交易:
   - 输入: 用户 UTXO
   - 输出: 统筹账户地址 (金额 = 红包总额 + 手续费储备)

3. 用户在浏览器签名交易

4. 广播交易到链上

5. DAP 链上留言:
   {
     "type": "RED_PACKET",
     "data": {
       "action": "CREATE",
       "packetHash": "xxx",
       "senderAddress": "scash1...",
       "senderTelegramUsername": "username",
       "fundingTxid": "txid...",
       "amount": "100.00000000",
       "count": 10,
       "strategy": "EQUAL",
       "blessMessage": "祝你红包多多，财运连连！"
     }
   }

6. 上传红包元数据到后端 (packetHash, senderAddress, expireSeconds 等)

7. 生成红包卡片/分享链接
```

### 红包创建 API 请求体
```typescript
{
  type: "EQUAL" | "RANDOM",       // 红包类型
  totalAmount: string,             // 总金额 (SCASH)
  count: number,                   // 份数
  message?: string,                // 祝福语
  coverId?: number,                // 封面 ID
  txid: string,                   // 资金交易 ID
  packetHash: string,              // 红包哈希 (前端生成)
  senderAddress: string,           // 发送者地址
  feeReserve: string,             // 手续费储备
  expireSeconds?: number          // 有效期（秒），默认 86400
}
```

### 红包领取流程
```
1. 用户点击红包卡片/链接 → Mini App 打开

2. 后端验证:
   - 红包是否有效
   - 用户是否已领取
   - 红包是否过期

3. 有完整钱包:
   - 后端构造统筹账户 → 用户地址的交易
   - 广播到链上
   - DAP 链上留言

4. 有观察钱包:
   - 观察钱包只能接收转账（不泄露私钥）
   - 后端构造统筹账户 → 观察钱包地址的交易
   - 广播到链上
   - DAP 链上留言

5. 无钱包用户（未创建/未绑定）:
   - 红包领取资格保留到用户 ID
   - 记录到 PendingTransfer 待处理队列
   - 用户后续创建/绑定钱包后，自动触发转账
   - 定时任务扫描待处理队列并处理

6. DAP 链上留言:
   {
     "type": "RED_PACKET",
     "data": {
       "action": "CLAIM",
       "packetHash": "xxx",
       "fundingTxid": "txid...",
       "claimerTelegramId": "987654321",
       "claimerTelegramUsername": "claimer",
       "claimerAddress": "scash1...",
       "amount": "10.50000000",
       "timestamp": 1234567890
     }
   }

7. 更新后端状态
```

### 红包过期处理
```
过期时间: 由用户创建时选择 (3分钟/24小时/7天/永久)

过期后:
- 未领取金额 → 退回发送者地址
- 状态更新为 REFUNDED (有剩余) 或 EXPIRED (已领完)
- DAP 链上留言

定时任务: 每 30 秒检查一次过期红包
```

### 手续费计算
```typescript
// 交易大小估算 (P2WPKH)
// P2WPKH 输入: 148 bytes
// P2WPKH 输出: 31 bytes
// 固定开销: 11 bytes

vsize = 11 + inputs * 148 + outputs * 31

// 统筹账户手续费储备 (每人)
const FEE_RESERVE = 0.0023 SCASH

// 示例: 10人红包（1个输入 → 1个统筹账户输出 + 1个找零输出）
// 交易大小: 11 + 1 * 148 + 2 * 31 = 221 bytes
// 手续费(10 sat/vB): 221 * 10 / 100000000 = 0.0000221 SCASH
// 统筹账户转账储备: 10 * 0.0023 = 0.023 SCASH
// 总计: 红包金额 + 手续费 + 统筹储备
```

### Gas 费率配置
```typescript
// 优先级: 链上智能手续费 > 稳妥默认值
async function getFeeRate(): Promise<number> {
  try {
    // 1. 尝试获取链上智能手续费
    const smartFee = await rpc.estimatesmartfee(6);
    if (smartFee.feerate) {
      return Math.ceil(smartFee.feerate * 100000); // sat/vB
    }
  } catch (e) {
    // 获取失败，使用默认值
  }

  // 2. 稳妥默认值 (10 sat/vB)
  return 10;
}
```

---

## 刻字上链

将文字、JSON 或任何内容永久刻入 SCASH 区块链。一旦上链，不可篡改，永久可查。

### 功能特点
- 支持 Text / JSON 格式
- 费用按字节计算（DAP 上链按字节收费）
- 内容永久保存在区块链上

### 费用估算
```typescript
const NETWORK_FEE_SAT = 10000n; // 0.0001 SCASH (固定网络手续费)
// DAP 上链费用 = 内容字节数 × 单价
// 总费用 = 网络手续费 + DAP 上链费用
```

---

## 数据库设计

### ER 图
```
User (1) ────── (1) Wallet
  │
  │
  ├───── (∞) Utxo
  │
  ├───── (∞) RedPacket (发送)
  │
  ├───── (∞) RedPacketClaim (领取)
  │
  ├───── (∞) PendingTransfer (待处理转账)
  │
  └───── (∞) UserCover (拥有的封面)

RedPacket (1) ────── (∞) RedPacketClaim

Cover (1) ────── (∞) UserCover
```

### 核心表结构

#### User 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| telegramId | String | Telegram 用户 ID |
| username | String? | Telegram username |
| firstName | String? | 名 |
| lastName | String? | 姓 |

#### Wallet 钱包表
| 字段 | 类型 | 说明 |
|------|------|------|
| address | String | 地址 |
| encryptedMnemonic | String? | 加密助记词 |
| salt | String? | PBKDF2 Salt |
| isWatchOnly | Boolean | 是否观察钱包 |

#### Utxo UTXO 表
| 字段 | 类型 | 说明 |
|------|------|------|
| txid | String | 交易 ID |
| vout | Int | 输出索引 |
| address | String | 地址 |
| amount | Decimal | 金额 |
| blockHeight | Int | 区块高度 |
| isSpent | Boolean | 是否已花费 |
| isUnconfirmed | Boolean | 是否未确认 |
| isCoinbase | Boolean | 是否 coinbase |

#### RedPacket 红包表
| 字段 | 类型 | 说明 |
|------|------|------|
| packetHash | String | 红包哈希 (唯一) |
| type | Enum | EQUAL / RANDOM |
| totalAmount | Decimal | 总金额 |
| remainingAmount | Decimal | 剩余金额 |
| count | Int | 份数 |
| remainingCount | Int | 剩余份数 |
| status | Enum | ACTIVE / COMPLETED / EXPIRED / REFUNDED |
| expiredAt | DateTime | 过期时间 |

---

## API 概览

### 钱包 API

| 接口 | 说明 |
|------|------|
| `POST /api/wallet/create` | 创建钱包（前端加密助记词后上传） |
| `POST /api/wallet/import` | 导入钱包 |
| `POST /api/wallet/bind` | 绑定观察钱包 |
| `POST /api/wallet/backup` | 云端加密备份 |
| `POST /api/wallet/recover` | 从云端恢复钱包 |
| `GET /api/wallet/balance` | 查询余额 |

### 红包 API

| 接口 | 说明 |
|------|------|
| `POST /api/redpacket/create` | 创建红包 |
| `GET /api/redpacket/:id` | 获取红包详情 |
| `POST /api/redpacket/:id/claim` | 领取红包 |
| `GET /api/redpacket/user/packets` | 获取用户红包列表 |

#### POST /api/redpacket/create
```typescript
// Request
{
  type: "EQUAL" | "RANDOM",
  totalAmount: string,
  count: number,
  message?: string,
  coverId?: number,
  txid: string,
  packetHash: string,
  senderAddress: string,
  feeReserve: string,
  expireSeconds?: number  // 可选，默认 86400
}

// Response
{
  success: boolean,
  packetId: string,
  expiredAt: string
}
```

### 封面 API

| 接口 | 说明 |
|------|------|
| `POST /api/cover/create` | 创建封面（管理员） |
| `GET /api/cover/list` | 获取封面列表 |
| `POST /api/cover/purchase` | 购买封面 |
| `GET /api/cover/my` | 获取已购封面 |

### 刻字 API

| 接口 | 说明 |
|------|------|
| `POST /api/redpacket/dap/outputs` | 计算 DAP 上链输出和费用 |

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/wallet` | 钱包首页 |
| `/wallet/create` | 创建钱包 |
| `/wallet/import` | 导入钱包 |
| `/wallet/recover` | 恢复钱包 |
| `/wallet/bind` | 绑定观察钱包 |
| `/wallet/send` | 发送 SCASH |
| `/wallet/receive` | 接收 SCASH（显示收款二维码） |
| `/wallet/inscribe` | 刻字上链 |
| `/wallet/settings` | 设置 |
| `/wallet/history` | 交易历史 |
| `/wallet/redpacket` | 红包首页 |
| `/wallet/redpacket/create` | 创建红包 |
| `/wallet/about` | 关于 |

---

## 安全特性

### 钱包安全
- 助记词明文仅在浏览器内存中，不允许落盘持久化
- 签名操作在浏览器完成，私钥不离开用户设备
- 云端备份使用 PBKDF2 + AES-256-GCM 加密
- 密码仅用于前端本地加解密，不上传、不存储

### Telegram 鉴权与防重放
- 每次请求校验 Telegram Mini App `initData` 签名（HMAC）
- 校验 `auth_date` 时效（建议 5 分钟）
- 使用一次性 nonce + 过期时间防重放
- 服务端会话绑定 `telegramId`，业务接口禁止前端自传 userId

### 交易安全
- UTXO 余额校验
- 找零地址验证
- 交易广播前二次确认

### 幂等与并发安全
- 红包领取接口使用幂等键（`packetHash + telegramId`）
- 数据库唯一约束：同一用户对同一红包仅允许一条成功领取记录
- 领取、扣减余额、写入领取记录必须放在同一事务内

---

## 环境变量配置

```env
# 数据库
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public"

# 环境配置：development | production
NODE_ENV="development"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_bot_token"

# Scash Node RPC
SCASH_RPC_URL="http://127.0.0.1:18443"
SCASH_RPC_USER="scash"
SCASH_RPC_PASS="scash"

# ZMQ 配置
ZMQ_BLOCK_URL="tcp://127.0.0.1:28444"
ZMQ_TX_URL="tcp://127.0.0.1:28445"

# 服务端口
PORT=5000

# 统筹账户助记词 (24词)
COORDINATION_ACCOUNT_MNEMONIC="word1 word2 ... word24"
```

| 变量 | 说明 | 必填 |
|------|------|------|
| DATABASE_URL | PostgreSQL 连接字符串 | 是 |
| NODE_ENV | 运行环境 | 是 |
| TELEGRAM_BOT_TOKEN | Telegram Bot Token | 是 |
| SCASH_RPC_URL | Scash RPC 地址 | 是 |
| SCASH_RPC_USER | RPC 用户名 | 是 |
| SCASH_RPC_PASS | RPC 密码 | 是 |
| ZMQ_BLOCK_URL | ZMQ 区块监听地址 | 是 |
| ZMQ_TX_URL | ZMQ 交易监听地址 | 是 |
| PORT | 服务端口 | 否，默认 5000 |
| COORDINATION_ACCOUNT_MNEMONIC | 统筹账户 24 词助记词 | 是 |

---

## DAP 链上留言

所有红包相关的链上留言统一使用以下格式：

```json
{
  "type": "RED_PACKET",
  "data": {
    // 具体数据内容
  }
}
```

### 操作类型

| 操作 | action | 说明 |
|------|--------|------|
| 创建红包 | CREATE | 创建新红包 |
| 领取红包 | CLAIM | 领取红包 |
| 红包退款 | REFUND | 过期未领自动退款 |

### CREATE 消息格式
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "CREATE",
    "packetHash": "xxx",
    "senderAddress": "scash1...",
    "senderTelegramUsername": "username",
    "amount": "100.00000000",
    "count": 10,
    "strategy": "EQUAL",
    "blessMessage": "祝你红包多多，财运连连！"
  }
}
```

### CLAIM 消息格式
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "CLAIM",
    "packetHash": "xxx",
    "claimerTelegramId": "987654321",
    "claimerTelegramUsername": "claimer",
    "claimerAddress": "scash1...",
    "amount": "10.00000000"
  }
}
```

### REFUND 消息格式
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "REFUND",
    "packetHash": "xxx",
    "senderTelegramId": "123456789",
    "senderAddress": "scash1...",
    "refundAmount": "50.00000000"
  }
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| packetHash | 红包唯一标识哈希 |
| senderAddress | 发送者钱包地址 |
| claimerAddress | 领取者钱包地址 |
| strategy | 分发策略：EQUAL（平分）/ RANDOM（拼手气） |
| blessMessage | 祝福语 |

---

## 参考链接

- [ScashDAP 协议](https://www.npmjs.com/package/scash-dap)
- [BitcoinJS Lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [Telegram Mini App](https://core.telegram.org/bots/webapps)

---

## 许可证

MIT License
