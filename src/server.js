const app = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  ============================================
  🚀 智能快递柜后台服务启动成功
  📍 服务地址: http://localhost:${PORT}
  📋 API 文档:
     - GET  /api/health              健康检查
     - GET  /api/lockers             格口列表
     - GET  /api/lockers/stats       格口统计
     - POST /api/parcels/store       投件
     - POST /api/parcels/pickup      取件
     - GET  /api/stats/records       投递记录统计
  ============================================
  `);
});
