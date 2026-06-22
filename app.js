const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { sendDeliveryNotify, sendOvertimeRemindNotify, getNotifyLog, MACHINE_LOCATION } = require('./notify');

const app = express();
const PORT = 3002;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const LOCKER_CONFIG = {
  small: { count: 10, heightLimit: 30, widthLimit: 30, depthLimit: 30 },
  medium: { count: 10, heightLimit: 50, widthLimit: 50, depthLimit: 50 },
  large: { count: 5, heightLimit: 80, widthLimit: 80, depthLimit: 80 },
};

const OVERTIME_HOURS = 24;
const OVERTIME_FEE_PER_DAY = 2;
const TOKEN_EXPIRE_MS = 24 * 60 * 60 * 1000;
const REMIND_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const lockers = {};
const packages = {};
const deliveryRecords = [];
const couriers = {};
const activeTokens = {};

function initLockers() {
  Object.keys(LOCKER_CONFIG).forEach((size) => {
    for (let i = 1; i <= LOCKER_CONFIG[size].count; i++) {
      const id = `${size.toUpperCase()}-${String(i).padStart(2, '0')}`;
      lockers[id] = {
        id,
        size,
        status: 'available',
        packageId: null,
        heightLimit: LOCKER_CONFIG[size].heightLimit,
        widthLimit: LOCKER_CONFIG[size].widthLimit,
        depthLimit: LOCKER_CONFIG[size].depthLimit,
      };
    }
  });
}

initLockers();

function generatePickupCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase() + Math.floor(Math.random() * 9000 + 1000);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_locker_salt').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function determineLockerSize(height, width, depth) {
  const sizes = ['large', 'medium', 'small'];
  for (const size of sizes) {
    const cfg = LOCKER_CONFIG[size];
    if (height <= cfg.heightLimit && width <= cfg.widthLimit && depth <= cfg.depthLimit) {
      return size;
    }
  }
  return null;
}

function findAvailableLocker(size) {
  return Object.values(lockers).find((l) => l.size === size && l.status === 'available');
}

function calculateOvertimeFee(storedAt) {
  const now = Date.now();
  const storedTime = new Date(storedAt).getTime();
  const diffMs = now - storedTime;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= OVERTIME_HOURS) {
    return { isOverdue: false, days: 0, fee: 0 };
  }

  const days = Math.ceil((diffHours - OVERTIME_HOURS) / 24);
  return { isOverdue: true, days, fee: days * OVERTIME_FEE_PER_DAY };
}

function courierAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌，请先登录' });
  }

  const token = authHeader.substring(7);
  const tokenInfo = activeTokens[token];

  if (!tokenInfo) {
    return res.status(401).json({ code: 401, message: '无效的认证令牌' });
  }

  if (Date.now() - tokenInfo.createdAt > TOKEN_EXPIRE_MS) {
    delete activeTokens[token];
    return res.status(401).json({ code: 401, message: '认证令牌已过期，请重新登录' });
  }

  req.courier = couriers[tokenInfo.phone];
  req.courier.token = token;
  next();
}

app.post('/api/courier/register', (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ code: 400, message: '姓名、手机号、密码均为必填' });
  }

  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ code: 400, message: '手机号格式不正确' });
  }

  if (password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码长度至少6位' });
  }

  if (couriers[phone]) {
    return res.status(409).json({ code: 409, message: '该手机号已注册' });
  }

  couriers[phone] = {
    name,
    phone,
    passwordHash: hashPassword(password),
    registeredAt: new Date().toISOString(),
  };

  res.status(201).json({
    code: 0,
    message: '注册成功',
    data: { name, phone },
  });
});

app.post('/api/courier/login', (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ code: 400, message: '手机号和密码必填' });
  }

  const courier = couriers[phone];
  if (!courier || courier.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ code: 401, message: '手机号或密码错误' });
  }

  const token = generateToken();
  activeTokens[token] = {
    phone,
    createdAt: Date.now(),
  };

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      name: courier.name,
      phone: courier.phone,
    },
  });
});

app.post('/api/courier/logout', courierAuth, (req, res) => {
  const token = req.courier.token;
  delete activeTokens[token];
  res.json({ code: 0, message: '退出登录成功' });
});

app.get('/api/courier/profile', courierAuth, (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      name: req.courier.name,
      phone: req.courier.phone,
      registeredAt: req.courier.registeredAt,
    },
  });
});

app.get('/api/notifications', (req, res) => {
  const { phone, type } = req.query;
  const logs = getNotifyLog({ phone, type });
  res.json({
    code: 0,
    message: 'success',
    data: { total: logs.length, notifications: logs },
  });
});

app.get('/api/lockers', (req, res) => {
  const { size, status } = req.query;
  let result = Object.values(lockers);

  if (size) {
    result = result.filter((l) => l.size === size.toLowerCase());
  }
  if (status) {
    result = result.filter((l) => l.status === status.toLowerCase());
  }

  const summary = {
    total: Object.keys(lockers).length,
    available: Object.values(lockers).filter((l) => l.status === 'available').length,
    occupied: Object.values(lockers).filter((l) => l.status === 'occupied').length,
    outOfService: Object.values(lockers).filter((l) => l.status === 'out_of_service').length,
  };

  res.json({
    code: 0,
    message: 'success',
    data: {
      summary,
      lockers: result,
    },
  });
});

app.get('/api/lockers/:id', (req, res) => {
  const locker = lockers[req.params.id.toUpperCase()];
  if (!locker) {
    return res.status(404).json({ code: 404, message: '格口不存在' });
  }

  let packageInfo = null;
  if (locker.packageId && packages[locker.packageId]) {
    const pkg = packages[locker.packageId];
    const overtime = calculateOvertimeFee(pkg.storedAt);
    packageInfo = {
      ...pkg,
      overtimeInfo: overtime,
    };
  }

  res.json({
    code: 0,
    message: 'success',
    data: {
      locker,
      package: packageInfo,
    },
  });
});

app.put('/api/lockers/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'occupied', 'out_of_service'];
  if (!status || !validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ code: 400, message: '无效的状态，可选值: available, occupied, out_of_service' });
  }

  const locker = lockers[req.params.id.toUpperCase()];
  if (!locker) {
    return res.status(404).json({ code: 404, message: '格口不存在' });
  }

  if (status.toLowerCase() === 'available' && locker.packageId) {
    return res.status(400).json({ code: 400, message: '该格口有包裹在存放中，无法设为可用' });
  }

  locker.status = status.toLowerCase();
  res.json({
    code: 0,
    message: '状态更新成功',
    data: locker,
  });
});

app.post('/api/packages/deliver', courierAuth, (req, res) => {
  const { recipientPhone, recipientName, packageHeight, packageWidth, packageDepth, trackingNumber } = req.body;

  const courierName = req.courier.name;
  const courierPhone = req.courier.phone;

  if (!recipientPhone || !recipientName) {
    return res.status(400).json({ code: 400, message: '收件人信息必填' });
  }
  if (packageHeight === undefined || packageWidth === undefined || packageDepth === undefined) {
    return res.status(400).json({ code: 400, message: '包裹尺寸(长宽高)必填' });
  }

  const size = determineLockerSize(packageHeight, packageWidth, packageDepth);
  if (!size) {
    return res.status(400).json({ code: 400, message: '包裹尺寸过大，没有适合的格口' });
  }

  const locker = findAvailableLocker(size);
  if (!locker) {
    return res.status(503).json({ code: 503, message: `${size} 型号格口已满，请稍后再试` });
  }

  const packageId = 'PKG' + Date.now() + Math.floor(Math.random() * 1000);
  const pickupCode = generatePickupCode();
  const now = new Date().toISOString();

  const pkg = {
    id: packageId,
    trackingNumber: trackingNumber || 'NO-TRACKING-' + Date.now(),
    courierName,
    courierPhone,
    recipientName,
    recipientPhone,
    dimensions: { height: packageHeight, width: packageWidth, depth: packageDepth },
    lockerId: locker.id,
    lockerSize: size,
    pickupCode,
    storedAt: now,
    pickedAt: null,
    status: 'stored',
    overtimeFee: 0,
    remindedAt: null,
  };

  packages[packageId] = pkg;
  locker.status = 'occupied';
  locker.packageId = packageId;

  deliveryRecords.push({
    id: 'REC' + Date.now() + Math.floor(Math.random() * 1000),
    packageId,
    lockerId: locker.id,
    action: 'deliver',
    operatorName: courierName,
    operatorPhone: courierPhone,
    operatorRole: 'courier',
    timestamp: now,
    details: {
      recipientName,
      recipientPhone,
      trackingNumber: pkg.trackingNumber,
      courierName,
      courierPhone,
    },
  });

  sendDeliveryNotify(recipientPhone, recipientName, pickupCode, locker.id);

  res.status(201).json({
    code: 0,
    message: '投递成功',
    data: {
      packageId,
      lockerId: locker.id,
      lockerSize: size,
      pickupCode,
      storedAt: now,
      recipientPhone,
      recipientName,
    },
  });
});

app.post('/api/packages/pickup', (req, res) => {
  const { pickupCode, recipientPhone } = req.body;

  if (!pickupCode && !recipientPhone) {
    return res.status(400).json({ code: 400, message: '取件码或手机号至少提供一项' });
  }

  let targetPkg = null;

  if (pickupCode) {
    targetPkg = Object.values(packages).find((p) => p.pickupCode === pickupCode && p.status === 'stored');
  }

  if (!targetPkg && recipientPhone) {
    targetPkg = Object.values(packages).find((p) => p.recipientPhone === recipientPhone && p.status === 'stored');
  }

  if (!targetPkg) {
    return res.status(404).json({ code: 404, message: '未找到待取包裹，请核对取件码或手机号' });
  }

  const overtime = calculateOvertimeFee(targetPkg.storedAt);
  const now = new Date().toISOString();

  targetPkg.pickedAt = now;
  targetPkg.status = 'picked';
  targetPkg.overtimeFee = overtime.fee;

  const locker = lockers[targetPkg.lockerId];
  if (locker) {
    locker.status = 'available';
    locker.packageId = null;
  }

  deliveryRecords.push({
    id: 'REC' + Date.now() + Math.floor(Math.random() * 1000),
    packageId: targetPkg.id,
    lockerId: targetPkg.lockerId,
    action: 'pickup',
    operatorName: targetPkg.recipientName,
    operatorPhone: targetPkg.recipientPhone,
    operatorRole: 'recipient',
    timestamp: now,
    details: {
      overtimeDays: overtime.days,
      overtimeFee: overtime.fee,
      isOverdue: overtime.isOverdue,
      courierName: targetPkg.courierName,
      courierPhone: targetPkg.courierPhone,
    },
  });

  res.json({
    code: 0,
    message: overtime.isOverdue ? '取件成功，请支付滞留费' : '取件成功',
    data: {
      packageId: targetPkg.id,
      lockerId: targetPkg.lockerId,
      trackingNumber: targetPkg.trackingNumber,
      pickedAt: now,
      overtimeInfo: overtime,
    },
  });
});

app.get('/api/packages/query', (req, res) => {
  const { pickupCode, recipientPhone, packageId } = req.query;

  let pkg = null;

  if (packageId) {
    pkg = packages[packageId];
  } else if (pickupCode) {
    pkg = Object.values(packages).find((p) => p.pickupCode === pickupCode);
  } else if (recipientPhone) {
    pkg = Object.values(packages).find((p) => p.recipientPhone === recipientPhone && p.status === 'stored');
  }

  if (!pkg) {
    return res.status(404).json({ code: 404, message: '未找到该包裹' });
  }

  const overtime = calculateOvertimeFee(pkg.storedAt);

  res.json({
    code: 0,
    message: 'success',
    data: {
      ...pkg,
      overtimeInfo: overtime,
    },
  });
});

app.get('/api/records', (req, res) => {
  const { startTime, endTime, action, page = 1, pageSize = 20 } = req.query;

  let records = [...deliveryRecords];

  if (startTime) {
    const start = new Date(startTime).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() >= start);
  }
  if (endTime) {
    const end = new Date(endTime).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() <= end);
  }
  if (action) {
    records = records.filter((r) => r.action === action.toLowerCase());
  }

  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = records.length;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 20;
  const startIdx = (pageNum - 1) * size;
  const pagedRecords = records.slice(startIdx, startIdx + size);

  const deliverCount = records.filter((r) => r.action === 'deliver').length;
  const pickupCount = records.filter((r) => r.action === 'pickup').length;
  const totalOvertimeFee = records
    .filter((r) => r.action === 'pickup' && r.details.overtimeFee)
    .reduce((sum, r) => sum + r.details.overtimeFee, 0);
  const overduePickupCount = records.filter((r) => r.action === 'pickup' && r.details.isOverdue).length;

  res.json({
    code: 0,
    message: 'success',
    data: {
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
      records: pagedRecords,
      statistics: {
        deliverCount,
        pickupCount,
        totalOvertimeFee,
        overduePickupCount,
        overdueRate: pickupCount > 0 ? parseFloat((overduePickupCount / pickupCount * 100).toFixed(2)) : 0,
      },
    },
  });
});

app.get('/api/records/daily', (req, res) => {
  const { startTime, endTime } = req.query;

  const start = startTime ? new Date(startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endTime ? new Date(endTime) : new Date();

  let records = deliveryRecords.filter((r) => {
    const t = new Date(r.timestamp);
    return t >= start && t <= end;
  });

  const dailyStats = {};
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    dailyStats[dateStr] = { date: dateStr, deliverCount: 0, pickupCount: 0, overtimeFee: 0 };
    current.setDate(current.getDate() + 1);
  }

  records.forEach((r) => {
    const dateStr = r.timestamp.split('T')[0];
    if (dailyStats[dateStr]) {
      if (r.action === 'deliver') {
        dailyStats[dateStr].deliverCount++;
      } else if (r.action === 'pickup') {
        dailyStats[dateStr].pickupCount++;
        dailyStats[dateStr].overtimeFee += r.details.overtimeFee || 0;
      }
    }
  });

  const result = Object.values(dailyStats);

  res.json({
    code: 0,
    message: 'success',
    data: {
      period: {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      dailyStats: result,
      summary: {
        totalDeliver: result.reduce((s, d) => s + d.deliverCount, 0),
        totalPickup: result.reduce((s, d) => s + d.pickupCount, 0),
        totalOvertimeFee: result.reduce((s, d) => s + d.overtimeFee, 0),
      },
    },
  });
});

function startOvertimeReminder() {
  setInterval(() => {
    const now = Date.now();
    const remindBeforeMs = (OVERTIME_HOURS - 2) * 60 * 60 * 1000;

    Object.values(packages).forEach((pkg) => {
      if (pkg.status !== 'stored') return;

      const storedTime = new Date(pkg.storedAt).getTime();
      const elapsedMs = now - storedTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= OVERTIME_HOURS - 2 && elapsedHours < OVERTIME_HOURS && !pkg.remindedAt) {
        pkg.remindedAt = new Date().toISOString();
        sendOvertimeRemindNotify(pkg.recipientPhone, pkg.recipientName, pkg.lockerId, Math.floor(elapsedHours));
      }
    });
  }, REMIND_CHECK_INTERVAL_MS);

  console.log(`  [定时任务] 超时催取提醒已启动，每${REMIND_CHECK_INTERVAL_MS / 60000}分钟检查一次`);
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  智能快递柜后台服务已启动`);
  console.log(`  监听端口: ${PORT}`);
  console.log(`  基础地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`  API 接口列表:`);
  console.log(`  [POST]   /api/courier/register    - 快递员注册`);
  console.log(`  [POST]   /api/courier/login       - 快递员登录`);
  console.log(`  [POST]   /api/courier/logout      - 快递员退出登录🔒`);
  console.log(`  [GET]    /api/courier/profile      - 快递员个人信息🔒`);
  console.log(`  [GET]    /api/lockers              - 查询所有格口状态`);
  console.log(`  [GET]    /api/lockers/:id          - 查询单个格口详情`);
  console.log(`  [PUT]    /api/lockers/:id/status   - 更新格口状态`);
  console.log(`  [POST]   /api/packages/deliver     - 快递员投件🔒`);
  console.log(`  [POST]   /api/packages/pickup      - 收件人取件`);
  console.log(`  [GET]    /api/packages/query       - 查询包裹信息`);
  console.log(`  [GET]    /api/records              - 查询投递记录(分页+统计)`);
  console.log(`  [GET]    /api/records/daily        - 按日统计汇总`);
  console.log(`  [GET]    /api/notifications        - 通知发送记录`);
  console.log(`  🔒 = 需要Bearer Token鉴权\n`);

  startOvertimeReminder();
});
