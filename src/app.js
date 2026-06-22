const express = require('express');
const { Store, config } = require('./store');
const { NotificationService, NOTIFICATION_TYPES } = require('./notification');
const { NotificationScheduler } = require('./scheduler');

const app = express();
const store = new Store();
const notifier = new NotificationService({
  OVERDUE_HOURS: config.OVERDUE_HOURS,
  OVERDUE_FEE_PER_HOUR: config.OVERDUE_FEE_PER_HOUR,
  MAX_OVERDUE_FEE: config.MAX_OVERDUE_FEE
});
store.setNotificationService(notifier);

const scheduler = new NotificationScheduler(store, notifier, {
  OVERDUE_HOURS: config.OVERDUE_HOURS,
  OVERDUE_FEE_PER_HOUR: config.OVERDUE_FEE_PER_HOUR,
  MAX_OVERDUE_FEE: config.MAX_OVERDUE_FEE,
  WARNING_HOURS_BEFORE: 2,
  CHECK_INTERVAL_MS: 60 * 1000
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: '智能快递柜后台服务',
    version: '1.0.0',
    config: {
      overdueHours: config.OVERDUE_HOURS,
      overdueFeePerHour: config.OVERDUE_FEE_PER_HOUR,
      maxOverdueFee: config.MAX_OVERDUE_FEE,
      lockerSizes: config.LOCKER_SIZES
    },
    notification: {
      warningHoursBefore: 2,
      supportedTypes: Object.values(NOTIFICATION_TYPES)
    }
  });
});

app.get('/api/lockers', (req, res) => {
  const status = req.query.status;
  let lockers = store.getLockerStatus();
  if (status) {
    lockers = lockers.filter(l => l.status === status);
  }
  res.json({ success: true, data: lockers });
});

app.get('/api/lockers/stats', (req, res) => {
  res.json({ success: true, data: store.getLockerStats() });
});

app.get('/api/lockers/:id', (req, res) => {
  const locker = store.getLockerStatus().find(l => l.id === req.params.id);
  if (!locker) {
    return res.status(404).json({ success: false, error: '格口不存在' });
  }
  res.json({ success: true, data: locker });
});

app.post('/api/packages/deposit', (req, res) => {
  const { courierId, courierName, recipientPhone, packageSize } = req.body;

  if (!courierId || !courierName || !recipientPhone || !packageSize) {
    return res.status(400).json({
      success: false,
      error: '缺少必填字段: courierId, courierName, recipientPhone, packageSize'
    });
  }

  if (!config.LOCKER_SIZES.includes(packageSize)) {
    return res.status(400).json({
      success: false,
      error: `packageSize 必须是以下之一: ${config.LOCKER_SIZES.join(', ')}`
    });
  }

  if (!/^1\d{10}$/.test(recipientPhone)) {
    return res.status(400).json({
      success: false,
      error: '手机号格式不正确'
    });
  }

  const result = store.depositPackage({ courierId, courierName, recipientPhone, packageSize });
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/api/packages/pickup-by-code', (req, res) => {
  const { pickupCode } = req.body;
  if (!pickupCode) {
    return res.status(400).json({ success: false, error: '缺少 pickupCode' });
  }
  const result = store.pickupByCode(pickupCode.toString());
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/api/packages/pickup-by-phone', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: '缺少 phone' });
  }
  const result = store.pickupByPhone(phone.toString());
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.get('/api/packages/overdue', (req, res) => {
  res.json({ success: true, data: store.getOverduePackages() });
});

app.post('/api/admin/packages/:packageId/remind', async (req, res) => {
  const { adminId } = req.body || {};
  if (!adminId) {
    return res.status(400).json({ success: false, error: '缺少 adminId' });
  }
  try {
    const result = await scheduler.triggerManualReminder(req.params.packageId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({
      success: true,
      data: {
        notificationId: result.data.id,
        packageId: result.data.packageId,
        recipientPhone: result.data.recipientPhone,
        timestamp: new Date(result.data.timestamp).toISOString()
      }
    });
  } catch (err) {
    console.error('手动催取件失败:', err);
    res.status(500).json({ success: false, error: '催取件失败: ' + err.message });
  }
});

app.post('/api/admin/packages/remind-all', async (req, res) => {
  const { adminId, onlyOverdue } = req.body || {};
  if (!adminId) {
    return res.status(400).json({ success: false, error: '缺少 adminId' });
  }
  try {
    const overdueList = store.getOverduePackages();
    const targets = onlyOverdue ? overdueList.filter(p => p.isOverdue) : overdueList;
    const results = [];
    for (const p of targets) {
      const r = await scheduler.triggerManualReminder(p.packageId);
      if (r.success) {
        results.push({
          packageId: p.packageId,
          notificationId: r.data.id,
          recipientPhone: r.data.recipientPhone
        });
      }
    }
    res.json({
      success: true,
      data: {
        total: targets.length,
        sent: results.length,
        results
      }
    });
  } catch (err) {
    console.error('批量催取件失败:', err);
    res.status(500).json({ success: false, error: '批量催取件失败: ' + err.message });
  }
});

app.get('/api/notifications', (req, res) => {
  const { packageId, phone, type, startTime, endTime } = req.query;
  const list = notifier.queryNotifications({ packageId, phone, type, startTime, endTime });
  res.json({ success: true, data: list });
});

app.get('/api/notifications/stats', (req, res) => {
  const { startTime, endTime } = req.query;
  res.json({ success: true, data: notifier.getNotificationStats({ startTime, endTime }) });
});

app.get('/api/records', (req, res) => {
  const { startTime, endTime } = req.query;
  res.json({ success: true, data: store.queryRecords(startTime, endTime) });
});

app.get('/api/records/stats', (req, res) => {
  const { startTime, endTime } = req.query;
  res.json({ success: true, data: store.getRecordsStats(startTime, endTime) });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`智能快递柜服务已启动，运行在 http://localhost:${PORT}`);
  console.log('格口总数:', store.getLockerStats().total);
  scheduler.start();
});

module.exports = app;
