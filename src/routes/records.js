const express = require('express');

function createRecordRoutes(store) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { startTime, endTime } = req.query;
    res.json({ success: true, data: store.queryRecords(startTime, endTime) });
  });

  router.get('/stats', (req, res) => {
    const { startTime, endTime } = req.query;
    res.json({ success: true, data: store.getRecordsStats(startTime, endTime) });
  });

  return router;
}

module.exports = createRecordRoutes;
