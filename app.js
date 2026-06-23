const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const { formatResponse } = require('./utils');

const lockerRoutes = require('./routes/lockers');
const packageRoutes = require('./routes/packages');
const statisticsRoutes = require('./routes/statistics');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.get('/', (req, res) => {
  res.json(formatResponse(true, {
    name: '智能快递柜后台服务',
    version: '1.0.0',
    endpoints: {
      lockers: '/api/lockers',
      packages: '/api/packages',
      statistics: '/api/statistics'
    }
  }, '服务运行正常'));
});

app.get('/health', (req, res) => {
  res.json(formatResponse(true, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));
});

app.use('/api/lockers', lockerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use((req, res) => {
  res.status(404).json(formatResponse(false, null, '接口不存在'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json(formatResponse(false, null, '服务器内部错误'));
});

app.listen(config.port, () => {
  console.log(`========================================`);
  console.log(`  智能快递柜后台服务已启动`);
  console.log(`  服务地址: http://localhost:${config.port}`);
  console.log(`  启动时间: ${new Date().toLocaleString()}`);
  console.log(`========================================`);
  console.log('');
  console.log('API 接口列表:');
  console.log('  格口管理:');
  console.log('    GET    /api/lockers              - 获取格口列表');
  console.log('    GET    /api/lockers/stats        - 获取格口统计');
  console.log('    GET    /api/lockers/:id          - 获取格口详情');
  console.log('    PUT    /api/lockers/:id/maintenance - 设置格口维护状态');
  console.log('');
  console.log('  包裹管理:');
  console.log('    POST   /api/packages/deposit     - 投件');
  console.log('    POST   /api/packages/pickup/code - 凭取件码取件');
  console.log('    POST   /api/packages/pickup/phone - 凭手机号取件');
  console.log('    GET    /api/packages             - 获取包裹列表');
  console.log('    GET    /api/packages/:id         - 获取包裹详情');
  console.log('');
  console.log('  统计查询:');
  console.log('    GET    /api/statistics/overview  - 获取概览数据');
  console.log('    GET    /api/statistics/packages  - 按时间段统计');
  console.log('    GET    /api/statistics/packages/export - 导出数据');
  console.log('');
  console.log(`========================================`);
});

module.exports = app;
