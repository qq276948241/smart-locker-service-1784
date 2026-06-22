const express = require('express');
const router = express.Router();
const locker = require('../models/Locker');

router.get('/', (req, res, next) => {
  try {
    const { size, status } = req.query;
    const filters = {};
    if (size) filters.size = size;
    if (status) filters.status = status;

    const lockers = locker.findAll(filters);
    res.json({
      code: 0,
      message: 'success',
      data: lockers
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', (req, res, next) => {
  try {
    const stats = locker.getStats();
    res.json({
      code: 0,
      message: 'success',
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const result = locker.findById(parseInt(id));
    if (!result) {
      return res.status(404).json({
        code: 404,
        message: '格口不存在',
        data: null
      });
    }
    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/out-of-service', (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        code: 400,
        message: '请提供维修原因',
        data: null
      });
    }

    const result = locker.setOutOfService(parseInt(id), reason);
    if (!result) {
      return res.status(404).json({
        code: 404,
        message: '格口不存在',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '格口已设为维修中',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/available', (req, res, next) => {
  try {
    const { id } = req.params;
    const result = locker.setAvailable(parseInt(id));
    if (!result) {
      return res.status(404).json({
        code: 404,
        message: '格口不存在或状态不允许',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '格口已恢复可用',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
