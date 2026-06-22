const express = require('express');

function createNotificationRoutes(notifier) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { packageId, phone, type, startTime, endTime } = req.query;
    const list = notifier.queryNotifications({ packageId, phone, type, startTime, endTime });
    res.json({ success: true, data: list });
  });

  router.get('/stats', (req, res) => {
    const { startTime, endTime } = req.query;
    res.json({ success: true, data: notifier.getNotificationStats({ startTime, endTime }) });
  });

  return router;
}

module.exports = createNotificationRoutes;
