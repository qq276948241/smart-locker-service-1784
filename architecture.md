# 智能快递柜后台服务 - 系统架构文档

## 一、系统概述

本系统是一个基于 Express.js 的智能快递柜后台管理服务，为快递员投件、收件人取件提供完整的业务闭环，同时支持格口状态管理、投递记录统计、滞留费计算和短信通知等功能。

核心设计原则：

- **分层架构**：路由层 → 服务层 → 数据层，各层职责单一，互不侵入
- **领域驱动拆分**：按业务领域（快递员、格口、包裹、记录、通知）划分模块，而非技术维度
- **数据操作封装**：所有数据 CRUD 统一收敛在 models 层，路由层不直接操作存储结构
- **纯函数工具集**：utils 中的函数无副作用、无状态，便于测试和复用

---

## 二、目录结构

```
project4/
├── app.js                      # 应用入口（45行）
├── config/
│   └── index.js                # 全局常量配置
├── utils/
│   ├── common.js               # 通用纯函数工具
│   └── fee.js                  # 滞留费计算
├── models/
│   ├── index.js                # 数据层统一导出
│   ├── locker.js               # 格口数据操作
│   ├── package.js              # 包裹数据操作
│   ├── courier.js              # 快递员数据操作 + Token 管理
│   └── record.js               # 投递记录数据操作 + 统计
├── middleware/
│   └── auth.js                 # 快递员 Bearer Token 鉴权
├── services/
│   ├── notify.js               # 短信通知服务
│   └── overtimeReminder.js     # 超时催取定时任务
└── routes/
    ├── index.js                # 路由统一注册
    ├── courier.js              # /api/courier
    ├── locker.js               # /api/lockers
    ├── package.js              # /api/packages
    ├── record.js               # /api/records
    └── notify.js               # /api/notifications
```

---

## 三、各模块职责

### 3.1 应用入口 - app.js

[app.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/app.js) 是整个服务的启动入口，职责极简：

1. 加载 Express 中间件（bodyParser）
2. 初始化格口数据（`models.locker.initLockers()`）
3. 注册所有路由（`registerRoutes(app)`）
4. 启动超时催取定时任务（`startOvertimeReminder()`）
5. 全局错误兜底中间件
6. 监听端口启动 HTTP 服务

**不做任何业务逻辑**，仅做组装和启动。

### 3.2 配置中心 - config/index.js

[config/index.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/config/index.js) 集中管理所有业务常量，避免硬编码散落各处：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `PORT` | 3004 | 服务监听端口 |
| `LOCKER_CONFIG` | small×10 / medium×10 / large×5 | 格口规格和数量 |
| `OVERTIME_HOURS` | 24 | 免费存放时长 |
| `OVERTIME_FEE_PER_DAY` | 2 | 超时每天收费（元） |
| `TOKEN_EXPIRE_MS` | 86400000 | Token 有效期（24h） |
| `REMIND_CHECK_INTERVAL_MS` | 3600000 | 催取检查间隔（1h） |
| `MACHINE_LOCATION` | 北京市朝阳区建国路88号 | 柜机地址（通知用） |
| `VALID_STATUSES` | available / occupied / out_of_service | 合法的格口状态枚举 |

### 3.3 工具函数层 - utils/

无状态、无副作用的纯函数集合，不依赖任何运行时状态。

#### utils/common.js

[utils/common.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/utils/common.js) 提供通用工具函数：

| 函数 | 用途 | 调用方 |
|------|------|--------|
| `generatePickupCode()` | 生成 6位字母+4位数字 的取件码 | models/package |
| `hashPassword(password)` | SHA256 + salt 密码哈希 | models/courier |
| `generateToken()` | 生成 64位十六进制 Token | models/courier |
| `generateId(prefix)` | 生成带前缀的唯一 ID | models/package, models/record |
| `determineLockerSize(h,w,d)` | 根据包裹尺寸匹配最小合适格口 | routes/package |
| `isValidPhone(phone)` | 校验中国大陆手机号格式 | routes/courier |

**格口分配算法**（`determineLockerSize`）：遍历顺序为 `small → medium → large`，优先分配能装下包裹的最小格口，避免"大材小用"。例如 10cm 小件只会分到 small（30cm 限制），不会浪费 large（80cm 限制）。

#### utils/fee.js

[utils/fee.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/utils/fee.js) 封装滞留费计算逻辑：

```
存放时长 ≤ 24h  →  免费
存放时长 > 24h  →  超出天数 × ¥2/天（向上取整）
```

返回结构：`{ isOverdue: boolean, days: number, fee: number }`

### 3.4 数据操作层 - models/

所有数据存储和 CRUD 操作的唯一入口。每个 model 模块内部维护自己的内存存储对象，对外暴露纯函数接口。路由层和中间件层**绝不直接操作这些存储对象**。

#### models/index.js

[models/index.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/index.js) 统一导出四个 model，其他模块通过 `const models = require('../models')` 引入后使用 `models.locker.xxx()` / `models.package.xxx()` 的方式调用。

#### models/locker.js

[models/locker.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/locker.js) 管理格口数据：

| 函数 | 作用 |
|------|------|
| `initLockers()` | 启动时根据 LOCKER_CONFIG 初始化全部 25 个格口 |
| `getAllLockers({size, status})` | 按条件筛选格口列表 |
| `getLockerById(id)` | 按 ID 查询单个格口 |
| `updateLockerStatus(id, status)` | 更新格口状态 |
| `assignPackage(lockerId, packageId)` | 投件时占用格口（status→occupied） |
| `releaseLocker(lockerId)` | 取件时释放格口（status→available） |
| `findAvailableLocker(size)` | 找到指定规格的可用格口 |
| `getLockerSummary()` | 返回格口总数/可用/占用/维护的汇总 |

格口 ID 格式：`{SIZE大写}-{两位序号}`，如 `SMALL-01`、`MEDIUM-10`、`LARGE-05`。

#### models/package.js

[models/package.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/package.js) 管理包裹数据：

| 函数 | 作用 |
|------|------|
| `isPickupCodeExists(code)` | 检查取件码是否已存在（防重复） |
| `createUniquePickupCode()` | 循环生成取件码直到唯一（最多 100 次） |
| `createPackage(data)` | 创建包裹记录（含取件码、快递员信息） |
| `findStoredPackage(pickupCode, phone)` | 查找待取包裹（供取件接口使用） |
| `queryPackage({pickupCode, phone, packageId})` | 通用查询（供包裹查询接口使用） |
| `markAsPicked(packageId)` | 标记已取件 + 计算滞留费 |
| `getStoredPackages()` | 获取所有 stored 状态包裹（供催取定时任务使用） |
| `updateRemindedAt(packageId)` | 标记已发送催取通知（防重复发送） |

#### models/courier.js

[models/courier.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/courier.js) 管理快递员账户和 Token：

| 函数 | 作用 |
|------|------|
| `registerCourier({name, phone, password})` | 注册（密码哈希存储） |
| `loginCourier({phone, password})` | 登录校验 + 生成 Token |
| `logoutCourier(token)` | 登出（删除 Token） |
| `validateToken(token)` | 校验 Token 有效性和过期时间 |
| `getCourierByPhone(phone)` | 按手机号查询快递员 |

Token 存储在 `activeTokens` 对象中，结构为 `{phone, createdAt}`，校验时检查 `Date.now() - createdAt < TOKEN_EXPIRE_MS`。

#### models/record.js

[models/record.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/record.js) 管理投递记录和统计：

| 函数 | 作用 |
|------|------|
| `createRecord(data)` | 写入一条投递/取件记录 |
| `getRecords({startTime, endTime, action, page, pageSize})` | 分页查询 + 实时统计 |
| `getDailyStats({startTime, endTime})` | 按日维度聚合统计 |

`getRecords` 返回的 `statistics` 字段实时计算，包含：投递数、取件数、总滞留费、逾期取件数、逾期率。

### 3.5 中间件层 - middleware/auth.js

[middleware/auth.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/middleware/auth.js) 提供 `courierAuth` 中间件：

1. 从请求头 `Authorization: Bearer xxx` 提取 Token
2. 调用 `models.courier.validateToken(token)` 校验有效性
3. 校验通过：将快递员信息挂载到 `req.courier`，调用 `next()`
4. 校验失败：返回 401 + 错误信息

当前需要鉴权的接口：`POST /api/packages/deliver`、`POST /api/courier/logout`、`GET /api/courier/profile`。

### 3.6 服务层 - services/

#### services/notify.js

[services/notify.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/services/notify.js) 封装短信通知逻辑：

| 函数 | 触发场景 | 通知内容 |
|------|----------|----------|
| `sendDeliveryNotify(phone, name, code, lockerId)` | 投件成功 | 取件码 + 柜机地址 |
| `sendOvertimeRemindNotify(phone, name, lockerId, hours)` | 即将超时 | 催取提醒 + 滞留费说明 |
| `getNotifyLog({phone, type})` | 通知记录查询 | 按条件筛选已发通知 |

当前为模拟短信实现（console.log + 内存日志），生产环境可替换为真实短信 SDK。

#### services/overtimeReminder.js

[services/overtimeReminder.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/services/overtimeReminder.js) 是一个后台定时任务：

- 每 60 分钟扫描一次所有 `stored` 状态的包裹
- 存放时长达到 22 小时（24h - 2h 提前量）且未发送过催取通知 → 发送催取短信
- 通过 `pkg.remindedAt` 字段防止同一包裹重复发送

### 3.7 路由层 - routes/

按业务领域拆分，每个路由文件对应一组 RESTful 接口。路由层负责：参数校验 → 调用 models/services → 组装响应。不包含业务计算逻辑。

| 路由文件 | 挂载路径 | 说明 |
|----------|----------|------|
| [routes/courier.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/courier.js) | `/api/courier` | 快递员注册/登录/登出/个人信息 |
| [routes/locker.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/locker.js) | `/api/lockers` | 格口查询/状态管理 |
| [routes/package.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/package.js) | `/api/packages` | 投件/取件/包裹查询 |
| [routes/record.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/record.js) | `/api/records` | 投递记录查询/统计 |
| [routes/notify.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/notify.js) | `/api/notifications` | 通知记录查询 |

[routes/index.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/routes/index.js) 的 `registerRoutes(app)` 统一完成所有路由的挂载。

---

## 四、API 接口清单

### 4.1 快递员接口 `/api/courier`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/register` | 否 | 注册（name, phone, password） |
| POST | `/login` | 否 | 登录（phone, password）→ 返回 Token |
| POST | `/logout` | 是 | 登出（销毁 Token） |
| GET | `/profile` | 是 | 查询当前快递员信息 |

### 4.2 格口接口 `/api/lockers`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/` | 否 | 查询所有格口（支持 ?size=&status= 筛选） |
| GET | `/:id` | 否 | 查询单个格口详情（含包裹+滞留费） |
| PUT | `/:id/status` | 否 | 更新格口状态（available/occupied/out_of_service） |

### 4.3 包裹接口 `/api/packages`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/deliver` | 是 | 快递员投件 |
| POST | `/pickup` | 否 | 收件人取件 |
| GET | `/query` | 否 | 查询包裹（?pickupCode= / ?recipientPhone= / ?packageId=） |

### 4.4 记录接口 `/api/records`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/` | 否 | 分页查询记录 + 统计（?startTime=&endTime=&action=&page=&pageSize=） |
| GET | `/daily` | 否 | 按日维度统计（?startTime=&endTime=） |

### 4.5 通知接口 `/api/notifications`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/` | 否 | 查询通知记录（?phone=&type=） |

---

## 五、投件到取件的完整生命周期

这是系统最核心的业务流程，涉及四个 model 和两个 service 的协作：

```
┌─────────────────────────────────────────────────────────────────┐
│                    投件到取件完整生命周期                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 快递员注册/登录                                               │
│     POST /api/courier/register                                  │
│     POST /api/courier/login  ──→  获得 Bearer Token             │
│                                                                 │
│  ② 快递员投件  POST /api/packages/deliver                       │
│     ┌──────────────────────────────────────────────────┐        │
│     │ 1. courierAuth 中间件校验 Token                    │        │
│     │    → 从 req.courier 获取快递员姓名+手机号           │        │
│     │ 2. determineLockerSize() 匹配最小合适格口          │        │
│     │    small(30) → medium(50) → large(80)             │        │
│     │ 3. models.locker.findAvailableLocker(size)        │        │
│     │    找到该规格下第一个可用格口                        │        │
│     │ 4. models.package.createPackage()                 │        │
│     │    生成唯一取件码 + 创建包裹记录                     │        │
│     │ 5. models.locker.assignPackage()                  │        │
│     │    格口状态 → occupied，绑定 packageId              │        │
│     │ 6. models.record.createRecord(action='deliver')   │        │
│     │    写入投递记录（含快递员信息）                      │        │
│     │ 7. notifyService.sendDeliveryNotify()             │        │
│     │    发短信给收件人（取件码+柜机地址）                  │        │
│     └──────────────────────────────────────────────────┘        │
│                                                                 │
│  ③ 等待取件期间（后台定时任务）                                    │
│     ┌──────────────────────────────────────────────────┐        │
│     │ overtimeReminder 每60分钟扫描 stored 包裹         │        │
│     │ 存放22h且未提醒 → sendOvertimeRemindNotify()      │        │
│     │ 标记 pkg.remindedAt 防重复                        │        │
│     └──────────────────────────────────────────────────┘        │
│                                                                 │
│  ④ 收件人取件  POST /api/packages/pickup                         │
│     ┌──────────────────────────────────────────────────┐        │
│     │ 1. findStoredPackage(pickupCode / phone)          │        │
│     │    按取件码或手机号查找 stored 状态包裹             │        │
│     │ 2. models.package.markAsPicked()                  │        │
│     │    计算滞留费 + 更新包裹状态 → picked              │        │
│     │ 3. models.locker.releaseLocker()                  │        │
│     │    格口状态 → available，清除 packageId             │        │
│     │ 4. models.record.createRecord(action='pickup')    │        │
│     │    写入取件记录（含滞留费+快递员追溯）              │        │
│     └──────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 状态流转

#### 包裹状态

```
stored ──取件──→ picked
```

- `stored`：已投件待取，格口被占用
- `picked`：已取件，格口已释放

#### 格口状态

```
available ──投件──→ occupied ──取件──→ available
available ──维护──→ out_of_service ──恢复──→ available
```

- `available`：空闲可分配
- `occupied`：有包裹占用
- `out_of_service`：维护停用

#### 快递员 Token 状态

```
注册 → 登录(生成Token) → 使用Token操作 → 登出(销毁Token)
                                      → Token过期(24h自动失效)
```

### 5.2 数据一致性保障

投件和取件是涉及多 model 联动修改的关键操作，系统通过以下方式保证一致性：

| 操作 | 联动修改 | 一致性要求 |
|------|----------|-----------|
| 投件 | package.create + locker.assign + record.create + notify.send | 格口必须从 available → occupied，包裹必须关联到格口 |
| 取件 | package.markPicked + locker.release + record.create | 格口必须从 occupied → available，包裹状态必须变为 picked |

当前为内存同步执行，操作原子性有保障。如迁移到数据库，需引入事务机制。

---

## 六、模块间依赖关系图

```
                        ┌──────────┐
                        │  app.js  │ (入口)
                        └────┬─────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
        │  routes/*  │  │ models  │  │  services/   │
        │ (5个路由)  │  │ (index) │  │ overtimeReminder│
        └──┬───┬──┬─┘  └────┬────┘  └──────┬──────┘
           │   │  │          │               │
     ┌─────┘   │  └──────────┼───────────────┘
     │         │             │
┌────▼──┐ ┌───▼───┐   ┌────▼────┐
│middleware│ │utils/*│   │models/*│
│  auth   │ │common │   │locker  │
│         │ │ fee   │   │package │
└────┬────┘ └───────┘   │courier │
     │                   │record  │
     │                   └────────┘
     │                        ▲
     └────────────────────────┘
       (auth 调用 models.courier.validateToken)
```

**依赖方向**：routes → middleware / utils / models / services，models → utils / config，services → models / config。**不存在反向依赖或循环依赖**。

---

## 七、记录追溯体系

每条 `deliveryRecord` 包含操作者信息，实现全链路可追溯：

### 投件记录

```json
{
  "action": "deliver",
  "operatorName": "王快递",
  "operatorPhone": "13800138001",
  "operatorRole": "courier",
  "details": {
    "courierName": "王快递",
    "courierPhone": "13800138001",
    "recipientName": "张三",
    "recipientPhone": "13900139001",
    "trackingNumber": "SF1234567890"
  }
}
```

### 取件记录

```json
{
  "action": "pickup",
  "operatorName": "张三",
  "operatorPhone": "13900139001",
  "operatorRole": "recipient",
  "details": {
    "overtimeDays": 2,
    "overtimeFee": 4,
    "isOverdue": true,
    "courierName": "王快递",
    "courierPhone": "13800138001"
  }
}
```

取件记录中同时保留了快递员信息（`details.courierName/courierPhone`），可直接追溯"谁投的件"。

---

## 八、关键算法说明

### 8.1 格口分配 - 最小适配优先

[utils/common.js - determineLockerSize](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/utils/common.js#L20-L29)

遍历顺序 `small → medium → large`，优先匹配能装下包裹的最小规格：

- 10×10×10cm → small（30cm 限制）✓ 不浪费大格口
- 40×40×40cm → medium（50cm 限制）✓ small 装不下自动升级
- 70×70×70cm → large（80cm 限制）✓ 中小都装不下才用大
- 100×100×100cm → 返回 null ✓ 超出所有格口上限

### 8.2 取件码唯一性保障

[models/package.js - createUniquePickupCode](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/models/package.js#L10-L17)

生成取件码后立即扫描已有包裹检查碰撞，重复则重新生成，最多重试 100 次。取件码格式为 6 位大写字母 + 4 位数字（约 21.7 亿种组合），实际碰撞概率极低。

### 8.3 滞留费计算

[utils/fee.js - calculateOvertimeFee](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/utils/fee.js#L3-L14)

```
存放 ≤ 24h → 免费
存放 > 24h → 向上取整(超出小时数 / 24) × ¥2
```

例：存放 25h → 超出 1h → 1 天 → ¥2；存放 49h → 超出 25h → 2 天 → ¥4。

---

## 九、测试验证

[test-api.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo4/project4/test-api.js) 覆盖 49 项自动化测试：

| 测试模块 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| 快递员注册/登录 | 9 | 注册、重复注册、参数校验、密码错误 |
| Token 鉴权 | 4 | 有效/无效/缺失 Token、未鉴权投件 |
| 格口管理 | 6 | 查询、筛选、状态变更、不存在格口 |
| 投件 | 5 | 小/中/大件、超大件、缺参、鉴权保护 |
| 通知 | 2 | 全量查询、按手机号查询 |
| 包裹查询 | 2 | 取件码查询、手机号查询 |
| 取件 | 4 | 取件码取件、手机号取件、错误取件码、缺参 |
| 记录统计 | 7 | 全量、筛选、时段、分页、按日统计 |
| 登出 | 3 | 登出、旧 Token 失效、重新登录 |
| Bug 修复验证 | 4 | 格口分配优先级（小/中/大件）、取件码唯一 |

---

## 十、迁移数据库指引

当前所有数据存储在内存中（`models/` 模块内的闭包变量），服务重启即丢失。如需持久化，只需修改 models 层的内部实现：

| Model | 内存存储 | 替换为 |
|-------|----------|--------|
| locker | `const lockers = {}` | 数据库格口表 |
| package | `const packages = {}` | 数据库包裹表 |
| courier | `const couriers = {}` | 数据库快递员表 |
| record | `const deliveryRecords = []` | 数据库记录表 |
| activeTokens (courier) | `const activeTokens = {}` | Redis / 数据库 Token 表 |
| notifyLog (notify) | `const notifyLog = []` | 数据库通知表 |

**路由层和中间件层无需修改**，因为它们只依赖 models 暴露的函数接口，不关心内部存储方式。投件/取件的多表联动操作需引入数据库事务保证原子性。
