const express = require('express');
const router = express.Router();
const models = require('../models');
const { calculateOvertimeFee } = require('../utils/fee');
const { VALID_STATUSES } = require('../config');

router.get('/', (req, res) => {
  const { size, status } = req.query;
  const lockers = models.locker.getAllLockers({ size, status });
  const summary = models.locker.getLockerSummary();

  res.json({
    code: 0,
    message: 'success',
    data: {
      summary,
      lockers,
    },
  });
});

router.get('/:id', (req, res) => {
  const locker = models.locker.getLockerById(req.params.id);
  if (!locker) {
    return res.status(404).json({ code: 404, message: '格口不存在' });
  }

  let packageInfo = null;
  if (locker.packageId) {
    const pkg = models.package.queryPackage({ packageId: locker.packageId });
    if (pkg) {
      const overtime = calculateOvertimeFee(pkg.storedAt);
      packageInfo = { ...pkg, overtimeInfo: overtime };
    }
  }

  res.json({
    code: 0,
    message: 'success',
    data: {
      locker,
      package: packageInfo,
    },
  });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status.toLowerCase())) {
    return res.status(400).json({ code: 400, message: `无效的状态，可选值: ${VALID_STATUSES.join(', ')}` });
  }

  const locker = models.locker.getLockerById(req.params.id);
  if (!locker) {
    return res.status(404).json({ code: 404, message: '格口不存在' });
  }

  if (status.toLowerCase() === 'available' && locker.packageId) {
    return res.status(400).json({ code: 400, message: '该格口有包裹在存放中，无法设为可用' });
  }

  const updated = models.locker.updateLockerStatus(req.params.id, status);
  res.json({
    code: 0,
    message: '状态更新成功',
    data: updated,
  });
});

module.exports = router;
