const express = require('express');

const lockersRouter = require('./routes/lockers');
const packagesRouter = require('./routes/packages');
const statsRouter = require('./routes/stats');
const {
  startOverdueChecker,
  stopOverdueChecker,
  getOverdueCheckerStatus,
  checkOverduePackages
} = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '智能快递柜后台服务 API',
    version: '1.1.0',
    endpoints: {
      lockers: {
        list: 'GET /api/lockers',
        stats: 'GET /api/lockers/stats',
        detail: 'GET /api/lockers/:id',
        maintenance: 'PUT /api/lockers/:id/maintenance'
      },
      packages: {
        deposit: 'POST /api/packages/deposit',
        pickup: 'POST /api/packages/pickup',
        confirmPickup: 'POST /api/packages/confirm-pickup'
      },
      stats: {
        packages: 'GET /api/stats/packages?startTime=&endTime=',
        overview: 'GET /api/stats/overview'
      },
      overdueChecker: {
        status: 'GET /api/overdue-checker/status',
        start: 'POST /api/overdue-checker/start',
        stop: 'POST /api/overdue-checker/stop',
        run: 'POST /api/overdue-checker/run'
      }
    }
  });
});

app.use('/api/lockers', lockersRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/stats', statsRouter);

app.get('/api/overdue-checker/status', (req, res) => {
  res.json({
    success: true,
    data: getOverdueCheckerStatus()
  });
});

app.post('/api/overdue-checker/start', (req, res) => {
  const { intervalMinutes } = req.body;
  startOverdueChecker(intervalMinutes);
  res.json({
    success: true,
    data: getOverdueCheckerStatus(),
    message: '定时检查任务已启动'
  });
});

app.post('/api/overdue-checker/stop', (req, res) => {
  stopOverdueChecker();
  res.json({
    success: true,
    data: getOverdueCheckerStatus(),
    message: '定时检查任务已停止'
  });
});

app.post('/api/overdue-checker/run', async (req, res) => {
  const result = await checkOverduePackages();
  res.json({
    success: true,
    data: result,
    message: '手动执行检查完成'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const server = app.listen(PORT, () => {
  console.log(`智能快递柜后台服务已启动: http://localhost:${PORT}`);
  startOverdueChecker(5);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在优雅关闭...');
  stopOverdueChecker();
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在优雅关闭...');
  stopOverdueChecker();
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

module.exports = app;
