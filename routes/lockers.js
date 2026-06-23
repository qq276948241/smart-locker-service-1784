const express = require('express');
const router = express.Router();
const lockerModel = require('../models/Locker');
const { formatResponse } = require('../utils');

router.get('/', (req, res) => {
  const { status, size } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (size) filter.size = size;
  
  const lockers = lockerModel.findAll(filter);
  res.json(formatResponse(true, {
    count: lockers.length,
    lockers
  }));
});

router.get('/stats', (req, res) => {
  const stats = lockerModel.getStats();
  res.json(formatResponse(true, stats));
});

router.get('/:id', (req, res) => {
  const locker = lockerModel.findById(req.params.id);
  if (!locker) {
    return res.status(404).json(formatResponse(false, null, '格口不存在'));
  }
  res.json(formatResponse(true, locker));
});

router.get('/code/:code', (req, res) => {
  const locker = lockerModel.findByCode(req.params.code);
  if (!locker) {
    return res.status(404).json(formatResponse(false, null, '格口不存在'));
  }
  res.json(formatResponse(true, locker));
});

router.put('/:id/maintenance', (req, res) => {
  const { maintenance } = req.body;
  const isMaintenance = maintenance !== undefined ? maintenance : true;
  
  const locker = lockerModel.setMaintenance(req.params.id, isMaintenance);
  if (!locker) {
    return res.status(404).json(formatResponse(false, null, '格口不存在'));
  }
  
  res.json(formatResponse(true, locker, `格口已${isMaintenance ? '设置为' : '取消'}维护状态`));
});

router.get('/available/:size', (req, res) => {
  const { size } = req.params;
  const locker = lockerModel.findAvailable(size);
  if (!locker) {
    return res.status(404).json(formatResponse(false, null, `没有可用的${size}格口`));
  }
  res.json(formatResponse(true, locker));
});

module.exports = router;
