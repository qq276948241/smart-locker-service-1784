const express = require('express');
const router = express.Router();
const models = require('../models');

router.get('/', (req, res) => {
  const { startTime, endTime, action, page, pageSize } = req.query;
  const result = models.record.getRecords({ startTime, endTime, action, page, pageSize });

  res.json({
    code: 0,
    message: 'success',
    data: result,
  });
});

router.get('/daily', (req, res) => {
  const { startTime, endTime } = req.query;
  const result = models.record.getDailyStats({ startTime, endTime });

  res.json({
    code: 0,
    message: 'success',
    data: result,
  });
});

module.exports = router;
