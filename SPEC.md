# SCASH 非托管钱包

**版本**: v2.0 (开发中)
**技术栈**: NestJS + EJS + PostgreSQL + Scash区块链
**状态**: 需求确认中

---

## 项目定位

这是一个基于 Scash 区块链的**非托管钱包**，核心功能是发红包，但本质是一个完整的钱包应用。用户完全掌控私钥，支持发送/接收 SCASH。

---

## 1. 项目概述

### 1.1 项目目标
基于 Telegram Mini App 的**非托管式 SCASH 钱包**，用户完全掌控私钥（助记词），支持发送/接收 SCASH，红包只是其核心功能之一。

### 1.2 核心特性
- 完全非托管钱包（助记词本地生成，签名在浏览器完成）
- 云端加密备份（用户密码加密助记词后上传，换设备可恢复）
- 观察钱包绑定（只接收，不泄露私钥）
- 红包功能（平分/拼手气）
- 封面商城（限量、永久、SCASH购买）

### 1.3 角色说明
| 角色 | 说明 |
|------|------|
| 发送者 | 创建红包并支付 gas |
| 领取者 | 领取红包 |
| 统筹账户 | 系统归集账户，负责红包资金托管和批量发放 |

---

## 2. 技术架构

### 2.1 技术选型
| 组件 | 技术 |
|------|------|
| 后端框架 | NestJS + TypeScript |
| 模板引擎 | EJS (服务端页面模板，JS 逻辑在客户端执行) |
| 数据库 | PostgreSQL + Prisma |
| 区块链 | Scash (Bitcoin架构) |
| 钱包库 | bitcoinjs-lib + bip39 + bip32 |
| DApp协议 | scash-dap (链上留言) |
| Telegram | Mini App + Bot API |
| 定时任务 | @nestjs/schedule |

### 2.2 架构图
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

### 2.3 数据流程
```
发送红包:
用户 → 构造交易(前端) → 签名(浏览器) → 广播(链上) → DAP留言(链上) → 元数据(后端)

领取红包:
用户点击 → Mini App → 后端验证 → 统筹账户转账(链上) → DAP留言(链上) → 更新状态(后端)
```

### 2.4 Scash 网络配置

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

### 2.5 环境变量配置

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

### 2.6 加密配置

#### 云端备份加密 (用户密码加密助记词)
```
算法: PBKDF2 + AES-256-GCM
PBKDF2 iterations: 100000
Salt: 随机生成 16 字节
```

### 2.7 UTXO 管理

#### UTXO 选择策略
```
策略: 最早 UTXO 策略 (FIFO - First In First Out)
优先使用最早的 UTXO
```

#### UTXO 确认规则
| UTXO 类型 | 最小确认数 | 说明 |
|-----------|-----------|------|
| 内存池 UTXO | 0 | 区块高度 = 0，可直接使用 |
| Coinbase UTXO | 100 | 挖矿奖励，需成熟后才能使用 |
| 普通 UTXO | 1 | 1 个确认即可使用 |

#### 交易大小估算
```typescript
// 保守估算（高于实际，确保手续费更容易上链）
// P2WPKH 输入: 180 vbytes
// P2WPKH 输出: 31 bytes
// 固定开销: 11 bytes

vsize = 11 + inputs * 180 + outputs * 31
```

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

#### 内存池 UTXO 预判机制
为解决高频发送时 UTXO 不足的问题，采用内存池预判：

```
UTXO 使用优先级:
1. 已确认 UTXO（按最早优先 FIFO）
2. 内存池 UTXO（当已确认 UTXO 不足时使用）

交易广播成功后：
- 预存所有输出到 UTXO 表（blockHeight = 0, isUnconfirmed = true）
- 标记已花费的输入 UTXO（isSpent = true）

ZMQ 监听新区块时：
- 确认预存的 UTXO（blockHeight 更新, isUnconfirmed = false）
```

#### 余额查询
```typescript
async getBalance(address: string, includeUnconfirmed: boolean): Promise<Big>
```
- `includeUnconfirmed = false`: 仅计算已确认 UTXO
- `includeUnconfirmed = true`: 包含内存池中未确认的 UTXO

#### 统筹账户 UTXO
- 归集账户的 UTXO 使用独立接口查询
- 与普通 UTXO 一样，优先使用最早的 UTXO（FIFO）

---

## 3. 钱包系统

### 3.1 钱包类型
| 类型 | 创建方式 | 发送 | 接收 | 云备份 |
|------|----------|------|------|--------|
| 完整钱包 | 生成/导入助记词 | ✅ | ✅ | ✅ |
| 观察钱包 | 仅绑定地址 | ❌ | ✅ | ❌ |

**观察钱包说明**: 只能接收红包/转账，无法发送（无私钥）。

**重要**: 完整钱包的明文助记词永远不离开前端。为实现 Telegram 账号绑定与跨设备恢复，后端仅保存用户密码加密后的助记词密文，不接触明文。

### 3.2 BIP32 派生路径
```
m/84'/0'/0'/0/0  (第一个地址，用于主地址)
m/84'/0'/0'/0/n  (找零地址，n >= 1)
```

### 3.3 云端加密备份
**重要**: 所有助记词操作（生成、加密、解密）都在浏览器前端完成。后端只存储与 Telegram 账号绑定的加密备份数据，永远不接触明文助记词。

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

**安全特性**:
- 服务器只存储密文，永远看不到明文助记词
- 密码不上传、不保存
- 每次恢复需要密码 + 密文
- AES-GCM 提供认证加密，防止密文篡改

### 3.4 本地存储
- `localStorage`: 钱包缓存（仅存非敏感信息；若存敏感字段必须使用 AES-256-GCM 加密）
- `sessionStorage`: 敏感操作临时存储（会话结束即清除）
- 禁止存储明文助记词、私钥、密码

---

## 4. 红包系统

### 4.1 红包类型
| 类型 | 英文名 | 分发方式 |
|------|--------|----------|
| 平分红包 | EQUAL | 每人平均分配 |
| 拼手气红包 | RANDOM | 随机金额（二倍均值法） |

### 4.2 红包创建流程
```
1. 用户在 Mini App 填写:
   - 红包类型 (EQUAL / RANDOM)
   - 总金额 (SCASH)
   - 红包份数
   - 祝福语 (可选)
   - 封面 (可选)

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
       "senderTelegramId": "123456789",
       "senderTelegramUsername": "username",
       "senderAddress": "scash1...",
       "fundingTxid": "txid...",
       "amount": "100.00000000",
       "count": 10,
       "strategy": "EQUAL",
       "expiredAt": 1234567890,
       "timestamp": 1234567890
     }
   }

6. 上传红包元数据到后端

7. 生成红包卡片/分享链接
```

### 4.3 红包领取流程
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

### 4.4 红包过期处理
```
过期时间:
- 测试模式: 3 分钟
- 正式模式: 24 小时

过期后:
- 未领取金额 → 退回发送者地址
- 状态更新为 REFUNDED
- DAP 链上留言:
  {
    "type": "RED_PACKET",
    "data": {
      "action": "REFUND",
      "packetHash": "xxx",
      "fundingTxid": "txid...",
      "senderTelegramId": "123456789",
      "senderAddress": "scash1...",
      "refundAmount": "50.00000000",
      "timestamp": 1234567890
    }
  }
```

### 4.5 手续费计算
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

### 4.6 Gas 费率配置
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

### 4.7 最小红包金额
防止被视为粉尘攻击 (dust)，最小金额根据链上 dust limit 确定。

---

## 5. 封面商城

### 5.1 封面属性
| 属性 | 说明 |
|------|------|
| id | 唯一标识 |
| name | 封面名称 |
| imageUrl | 封面图片 URL |
| price | 价格 (SCASH) |
| quantity | 限量份数 |
| sold | 已售份数 |
| creator | 创作者 (平台) |

### 5.2 购买流程
```
1. 用户选择封面 → 构造链上转账交易（用户 → 平台地址）
2. 用户在浏览器签名并广播交易
3. 后端监听链上转账，验证 txid 确认
4. 解锁封面使用权 (关联到用户账户)
5. 永久拥有
```

### 5.3 封面使用
- 发送红包时可选择封面
- 封面信息存储在红包元数据中
- 分享卡片使用选定封面图片

---

## 6. 数据库设计

### 6.1 ER 图
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

### 6.2 表结构

#### User 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| telegramId | String | Telegram 用户 ID |
| username | String? | Telegram username |
| firstName | String? | 名 |
| lastName | String? | 姓 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### Wallet 钱包表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| userId | Int | 用户 ID (唯一) |
| address | String | 地址 |
| encryptedMnemonic | String? | 加密助记词 |
| salt | String? | PBKDF2 Salt |
| isWatchOnly | Boolean | 是否观察钱包 |
| createdAt | DateTime | 创建时间 |

#### Utxo UTXO 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| txid | String | 交易 ID |
| vout | Int | 输出索引 |
| address | String | 地址 |
| scriptPubKey | String | 脚本 |
| amount | Decimal | 金额 |
| blockHeight | Int | 区块高度 |
| isSpent | Boolean | 是否已花费 |
| spentByTxid | String? | 花费交易 ID |
| isUnconfirmed | Boolean | 是否未确认 |
| isCoinbase | Boolean | 是否 coinbase |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### RedPacket 红包表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| packetHash | String | 红包哈希 (唯一) |
| senderId | Int | 发送者 ID |
| type | Enum | EQUAL / RANDOM |
| totalAmount | Decimal | 总金额 |
| remainingAmount | Decimal | 剩余金额 |
| count | Int | 份数 |
| remainingCount | Int | 剩余份数 |
| message | String? | 祝福语 |
| coverId | Int? | 封面 ID |
| chatId | String | 群组/用户 ID |
| fundingTxid | String | 资金交易 ID |
| status | Enum | ACTIVE / COMPLETED / EXPIRED / REFUNDED |
| expiredAt | DateTime | 过期时间 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### RedPacketClaim 领取记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| redPacketId | Int | 红包 ID |
| userId | Int | 领取者 ID |
| amount | Decimal | 领取金额 |
| txid | String? | 转账交易 ID |
| status | Enum | PENDING / COMPLETED / FAILED |
| claimedAt | DateTime | 领取时间 |
| updatedAt | DateTime | 更新时间 |

#### PendingTransfer 待处理转账表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| userId | Int | 用户 ID |
| type | Enum | REDPACKET_CLAIM / REFUND |
| amount | Decimal | 金额 |
| claimId | Int? | 领取记录 ID |
| txid | String? | 交易 ID |
| status | Enum | PENDING / PROCESSING / COMPLETED / FAILED |
| errorMessage | String? | 错误信息 |
| retryCount | Int | 重试次数 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |
| processedAt | DateTime? | 处理时间 |

#### Cover 封面表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| name | String | 名称 |
| imageUrl | String | 图片 URL |
| price | Decimal | 价格 (SCASH) |
| quantity | Int | 限量份数 |
| sold | Int | 已售 |
| isActive | Boolean | 是否上架 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### UserCover 用户封面表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| userId | Int | 用户 ID |
| coverId | Int | 封面 ID |
| purchasedAt | DateTime | 购买时间 |

#### BlockSync 区块同步表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| lastBlockHeight | Int | 最后区块高度 |
| lastBlockHash | String | 最后区块哈希 |
| updatedAt | DateTime | 更新时间 |

---

## 7. API 设计

### 7.1 钱包 API

#### POST /api/wallet/create
创建钱包（前端生成助记词并加密，后端只存储加密数据）
```typescript
// Request - 前端生成助记词后，用密码加密并上传加密数据
{
  address: string,
  encryptedMnemonic: string,
  salt: string,
  iv: string,
  authTag: string
}

// Response
{
  success: boolean,
  address: string
}
```

#### POST /api/wallet/import
导入钱包（前端加密助记词后上传，后端不接触明文助记词）
```typescript
// Request - 助记词在前端用密码加密后，只上传加密数据和地址
{
  address: string,
  encryptedMnemonic: string,
  salt: string,
  iv: string,
  authTag: string
}

// Response
{ success: boolean, address: string }
```

#### POST /api/wallet/bind
绑定观察钱包
```typescript
// Request
{ address: string }

// Response
{ success: boolean }
```

#### POST /api/wallet/backup
云端加密备份（密码在前端加密，不上传）
```typescript
// Request
// 加密操作在前端完成，后端只存储加密结果
{
  address: string,
  encryptedMnemonic: string,
  salt: string,
  iv: string,
  authTag: string
}

// Response
{
  success: boolean
}
```

#### POST /api/wallet/recover
从云端获取加密备份（前端本地解密恢复）
```typescript
// Request
{ address?: string }

// Response
{
  success: boolean,
  backup?: {
    encryptedMnemonic: string,
    salt: string,
    iv: string,
    authTag: string
  }
}
```

#### GET /api/wallet/balance
查询余额
```typescript
// Response
{ success: boolean, balance: string, utxos: Utxo[] }
```

### 7.2 红包 API

#### POST /api/redpacket/create
创建红包
```typescript
// Request
{
  type: "EQUAL" | "RANDOM",
  totalAmount: string,
  count: number,
  message?: string,
  coverId?: number,
  txid: string,
  feeReserve: string
}

// Response
{
  success: boolean,
  packetId: string,
  expiredAt: string
}
```

#### GET /api/redpacket/:id
获取红包详情
```typescript
// Response
{
  success: boolean,
  redPacket: RedPacket,
  claims: RedPacketClaim[],
  canClaim: boolean
}
```

#### POST /api/redpacket/:id/claim
领取红包
```typescript
// Response
{
  success: boolean,
  amount?: string,
  message?: string
}
```

#### GET /api/redpacket/user/packets
获取用户红包列表
```typescript
// Query: ?type=sent|received
// Response
{ success: boolean, packets: RedPacket[] }
```

### 7.3 封面 API

#### POST /api/cover/create
创建封面（管理员）
```typescript
// Request
{
  name: string,
  imageUrl: string,
  price: string,
  quantity: number  // 限量份数
}

// Response
{ success: boolean, coverId: number }
```

#### GET /api/cover/list
获取封面列表
```typescript
// Response
{
  success: boolean,
  covers: Cover[]
}
```

#### POST /api/cover/purchase
购买封面
```typescript
// Request
{ coverId: number, txid: string }

// Response
{ success: boolean }
```

#### GET /api/cover/my
获取已购封面
```typescript
// Response
{ success: boolean, covers: Cover[] }
```

### 7.4 UTXO API (内部)

#### GET /api/utxo/select
选择 UTXO
```typescript
// Request
{ address: string, amount: string, feeRate: number }

// Response
{ success: boolean, utxos: Utxo[], totalAmount: string }
```

---

## 8. Mini App 页面

### 8.1 页面列表
| 路径 | 说明 |
|------|------|
| `/` | 首页/入口 |
| `/wallet` | 钱包页面 |
| `/wallet/create` | 创建钱包 |
| `/wallet/import` | 导入钱包 |
| `/wallet/recover` | 恢复钱包 |
| `/redpacket/create` | 创建红包 |
| `/redpacket/[id]` | 红包详情/领取 |
| `/redpacket/list` | 红包记录 |
| `/cover/shop` | 封面商城 |
| `/cover/my` | 我的封面 |

### 8.2 入口方式
1. **Bot 按钮**: `BotStartButton` 或 `KeyboardButton`
2. **分享链接**: `t.me/botname/app/redpacket/[id]`
3. **分享卡片**: 点击图片打开 Mini App

### 8.3 分享机制
```typescript
// 分享红包卡片
{
  type: "photo",
  photo: "file_id",  // 红包卡片图片
  caption: "祝你红包多多，财运连连！",
  reply_markup: {
    inline_keyboard: [[
      { text: "🎉 抢红包", web_app: { url: "https://app.domain/redpacket/123" } }
    ]]
  }
}
```

---

## 9. DAP 链上留言

### 9.1 JSON 格式设计

所有红包相关的链上留言统一使用以下格式：

```json
{
  "type": "RED_PACKET",
  "data": {
    // 具体数据内容
  }
}
```

### 9.2 操作类型定义

#### 创建红包 (CREATE)
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "CREATE",
    "packetHash": "abc123...",
    "senderTelegramId": "123456789",
    "senderTelegramUsername": "username",
    "senderAddress": "scash1...",
    "fundingTxid": "txid_of_funding_transaction",
    "amount": "100.00000000",
    "count": 10,
    "strategy": "EQUAL",
    "expiredAt": 1234567890,
    "timestamp": 1234567890
  }
}
```

#### 领取红包 (CLAIM)
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "CLAIM",
    "packetHash": "abc123...",
    "fundingTxid": "txid_of_funding_transaction",
    "claimerTelegramId": "987654321",
    "claimerTelegramUsername": "claimer",
    "claimerAddress": "scash1...",
    "amount": "10.00000000",
    "timestamp": 1234567890
  }
}
```

#### 红包过期退款 (REFUND)
```json
{
  "type": "RED_PACKET",
  "data": {
    "action": "REFUND",
    "packetHash": "abc123...",
    "fundingTxid": "txid_of_funding_transaction",
    "senderTelegramId": "123456789",
    "senderAddress": "scash1...",
    "refundAmount": "50.00000000",
    "timestamp": 1234567890
  }
}
```

### 9.3 字段说明

| 字段 | 说明 |
|------|------|
| packetHash | 红包唯一标识哈希 |
| fundingTxid | 创建红包时的资金交易 ID（用于区块链浏览器解析） |
| senderAddress | 发送者钱包地址 |
| claimerAddress | 领取者钱包地址 |
| strategy | 分发策略：EQUAL（平分）/ RANDOM（拼手气） |
| expiredAt | 过期时间戳 |
| timestamp | 操作时间戳 |

---

## 10. 安全考虑

### 10.1 钱包安全
- 助记词明文仅在浏览器内存中，不允许落盘持久化
- 签名操作在浏览器完成，私钥不离开用户设备
- 云端备份使用 PBKDF2 + AES-256-GCM 加密
- 密码仅用于前端本地加解密，不上传、不存储

### 10.2 Telegram 鉴权与防重放
- 每次请求校验 Telegram Mini App `initData` 签名（HMAC）
- 校验 `auth_date` 时效（建议 5 分钟）
- 使用一次性 nonce + 过期时间防重放
- 服务端会话绑定 `telegramId`，业务接口禁止前端自传 userId

### 10.3 XSS 防护
- DAP 解析数据展示时使用 `innerText`
- 所有用户输入进行转义处理
- CSP 配置禁用内联脚本

### 10.4 交易安全
- UTXO 余额校验
- 找零地址验证
- 交易广播前二次确认

### 10.5 幂等与并发安全
- 红包领取接口使用幂等键（`packetHash + telegramId`）
- 数据库唯一约束：同一用户对同一红包仅允许一条成功领取记录
- 领取、扣减余额、写入领取记录必须放在同一事务内
- 重试任务必须按状态机迁移，禁止重复打款

---

## 11. 待确认/待开发

### 已确认
- [x] DAP JSON 格式：`{ type: "RED_PACKET", data: { action, ... } }`
- [x] 封面限量：创建时单独设定
- [x] Gas 费率：优先获取链上智能手续费，获取失败使用稳妥金额
- [x] 最小红包金额：防止粉尘攻击即可

### 待开发
- [x] UTXO 索引服务 (UtxoSyncService)
- [x] 启动补同步 + ZMQ 实时同步
- [x] 调度任务（过期退款、批量转账）(SchedulerService)
- [ ] 红包卡片图片生成
- [ ] 前端 UI 组件

---

## 12. 参考

- [ScashDAP 协议](https://www.npmjs.com/package/scash-dap)
- [BitcoinJS Lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [Telegram Mini App](https://core.telegram.org/bots/webapps)
