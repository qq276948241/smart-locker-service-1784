const express = require('express');
const bodyParser = require('body-parser');
const { PORT } = require('./config');
const models = require('./models');
const { registerRoutes } = require('./routes');
const { startOvertimeReminder } = require('./services/overtimeReminder');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

models.locker.initLockers();

registerRoutes(app);

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
