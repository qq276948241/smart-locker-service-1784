const express = require('express');

const lockersRouter = require('./routes/lockers');
const packagesRouter = require('./routes/packages');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '智能快递柜后台服务 API',
    version: '1.0.0',
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
      }
    }
  });
});

app.use('/api/lockers', lockersRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/stats', statsRouter);

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

app.listen(PORT, () => {
  console.log(`智能快递柜后台服务已启动: http://localhost:${PORT}`);
});

module.exports = app;
