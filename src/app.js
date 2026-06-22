const express = require('express');
const { Store, config } = require('./store');
const { NotificationService, NOTIFICATION_TYPES } = require('./notification');
const { NotificationScheduler } = require('./scheduler');
const PackageService = require('./services/package.service');
const createLockerRoutes = require('./routes/lockers');
const createPackageRoutes = require('./routes/packages');
const createAdminRoutes = require('./routes/admin');
const createNotificationRoutes = require('./routes/notifications');
const createRecordRoutes = require('./routes/records');

const app = express();
app.use(express.json());

const store = new Store();
const notifier = new NotificationService({
  OVERDUE_HOURS: config.OVERDUE_HOURS,
  OVERDUE_FEE_PER_HOUR: config.OVERDUE_FEE_PER_HOUR,
  MAX_OVERDUE_FEE: config.MAX_OVERDUE_FEE
});
const packageService = new PackageService(store, notifier);
const scheduler = new NotificationScheduler(store, notifier, {
  OVERDUE_HOURS: config.OVERDUE_HOURS,
  OVERDUE_FEE_PER_HOUR: config.OVERDUE_FEE_PER_HOUR,
  MAX_OVERDUE_FEE: config.MAX_OVERDUE_FEE,
  WARNING_HOURS_BEFORE: 2,
  CHECK_INTERVAL_MS: 60 * 1000
});

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

app.use('/api/lockers', createLockerRoutes(store));
app.use('/api/packages', createPackageRoutes(packageService));
app.use('/api/admin', createAdminRoutes(store, scheduler));
app.use('/api/notifications', createNotificationRoutes(notifier));
app.use('/api/records', createRecordRoutes(store));

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
