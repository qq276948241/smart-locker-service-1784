const express = require('express');
const router = express.Router();
const lockerModel = require('../models/Locker');
const { formatResponse, parseSize, getSizeName, getAllSizeOptions, VALID_SIZES } = require('../utils');

router.get('/sizes', (req, res) => {
  const sizeOptions = lockerModel.getSizeOptions();
  res.json(formatResponse(true, {
    sizes: sizeOptions,
    validInputs: ['small/小/S', 'medium/中/M', 'large/大/L']
  }));
});

router.get('/', (req, res) => {
  const { status, size } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (size) {
    const normalized = parseSize(size);
    if (!normalized) {
      return res.status(400).json(formatResponse(false, null, `尺寸参数无效，有效值为：${VALID_SIZES.join('、')}（或中文、首字母缩写）`));
    }
    filter.size = normalized;
  }
  
  const lockers = lockerModel.findAll(filter);
  res.json(formatResponse(true, {
    count: lockers.length,
    filter: {
      status: status || 'all',
      size: size ? (parseSize(size) ? `${getSizeName(parseSize(size))}(${parseSize(size)})` : `invalid:${size}`) : 'all'
    },
    lockers
  }));
});

router.get('/stats', (req, res) => {
  const stats = lockerModel.getStats();
  res.json(formatResponse(true, stats));
});

router.get('/available', (req, res) => {
  const { size } = req.query;
  const normalized = size ? parseSize(size) : null;
  
  if (size && !normalized) {
    return res.status(400).json(formatResponse(false, null, `尺寸参数无效`));
  }

  const available = lockerModel.findAllAvailable(normalized);
  res.json(formatResponse(true, {
    size: normalized ? { key: normalized, name: getSizeName(normalized) } : 'all',
    count: available.length,
    lockers: available
  }));
});

router.get('/available/count', (req, res) => {
  const result = {};
  for (const size of VALID_SIZES) {
    result[size] = {
      name: getSizeName(size),
      count: lockerModel.countAvailable(size)
    };
  }
  res.json(formatResponse(true, result));
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
  const normalized = parseSize(size);
  if (!normalized) {
    return res.status(400).json(formatResponse(false, null, `尺寸参数无效，有效值为：${VALID_SIZES.join('、')}`));
  }
  
  const locker = lockerModel.findAvailable(normalized);
  if (!locker) {
    return res.status(404).json(formatResponse(false, {
      requestedSize: normalized,
      requestedSizeName: getSizeName(normalized),
      allAvailableCounts: VALID_SIZES.reduce((acc, s) => {
        acc[s] = { name: getSizeName(s), count: lockerModel.countAvailable(s) };
        return acc;
      }, {})
    }, `${getSizeName(normalized)}(${normalized})没有可用格口`));
  }
  res.json(formatResponse(true, locker));
});

module.exports = router;
