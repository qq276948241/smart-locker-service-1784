const express = require('express');
const router = express.Router();
const notifyService = require('../services/notify');

router.get('/', (req, res) => {
  const { phone, type } = req.query;
  const logs = notifyService.getNotifyLog({ phone, type });

  res.json({
    code: 0,
    message: 'success',
    data: { total: logs.length, notifications: logs },
  });
});

module.exports = router;
