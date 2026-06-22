const express = require('express');
const router = express.Router();
const {
  LOCKER_STATUS,
  LOCKER_TYPES,
  getAllLockers,
  getLockerById,
  getLockersByStatus,
  getLockersByType,
  setLockerMaintenance
} = require('../data/store');

router.get('/', (req, res) => {
  const { status, type } = req.query;

  let result = getAllLockers();

  if (status) {
    const validStatuses = Object.values(LOCKER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值，有效值为: ${validStatuses.join(', ')}`
      });
    }
    result = getLockersByStatus(status);
  }

  if (type) {
    const validTypes = Object.values(LOCKER_TYPES);
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `无效的类型值，有效值为: ${validTypes.join(', ')}`
      });
    }
    result = result.filter(l => l.type === type);
  }

  res.json({
    success: true,
    data: result,
    total: result.length
  });
});

router.get('/stats', (req, res) => {
  const allLockers = getAllLockers();
  const stats = {
    total: allLockers.length,
    available: getLockersByStatus(LOCKER_STATUS.AVAILABLE).length,
    occupied: getLockersByStatus(LOCKER_STATUS.OCCUPIED).length,
    maintenance: getLockersByStatus(LOCKER_STATUS.MAINTENANCE).length,
    byType: {
      small: getLockersByType(LOCKER_TYPES.SMALL).length,
      medium: getLockersByType(LOCKER_TYPES.MEDIUM).length,
      large: getLockersByType(LOCKER_TYPES.LARGE).length
    }
  };

  res.json({
    success: true,
    data: stats
  });
});

router.get('/:id', (req, res) => {
  const locker = getLockerById(req.params.id);

  if (!locker) {
    return res.status(404).json({
      success: false,
      message: '格口不存在'
    });
  }

  res.json({
    success: true,
    data: locker
  });
});

router.put('/:id/maintenance', (req, res) => {
  const { maintenance } = req.body;

  if (typeof maintenance !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'maintenance 参数必须为布尔值'
    });
  }

  const locker = getLockerById(req.params.id);

  if (!locker) {
    return res.status(404).json({
      success: false,
      message: '格口不存在'
    });
  }

  if (maintenance && locker.status === LOCKER_STATUS.OCCUPIED) {
    return res.status(400).json({
      success: false,
      message: '格口被占用，无法设置为维护状态'
    });
  }

  const updated = setLockerMaintenance(req.params.id, maintenance);

  res.json({
    success: true,
    data: updated,
    message: maintenance ? '已设置为维护状态' : '已恢复为可用状态'
  });
});

module.exports = router;
