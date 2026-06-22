const express = require('express');

function createLockerRoutes(store) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const status = req.query.status;
    let lockers = store.getLockerStatus();
    if (status) {
      lockers = lockers.filter(l => l.status === status);
    }
    res.json({ success: true, data: lockers });
  });

  router.get('/stats', (req, res) => {
    res.json({ success: true, data: store.getLockerStats() });
  });

  router.get('/:id', (req, res) => {
    const locker = store.getLockerStatus().find(l => l.id === req.params.id);
    if (!locker) {
      return res.status(404).json({ success: false, error: '格口不存在' });
    }
    res.json({ success: true, data: locker });
  });

  return router;
}

module.exports = createLockerRoutes;
