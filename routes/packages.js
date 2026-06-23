const express = require('express');
const router = express.Router();
const packageModel = require('../models/Package');
const { formatResponse, getSizeType } = require('../utils');

router.post('/deposit', (req, res) => {
  const { courierId, courierName, recipientPhone, recipientName, packageSize, trackingNumber, remarks } = req.body;
  
  if (!courierId || !courierName || !recipientPhone) {
    return res.status(400).json(formatResponse(false, null, '缺少必要参数：快递员ID、快递员姓名、收件人手机号'));
  }

  const size = getSizeType(packageSize);
  
  const result = packageModel.create({
    courierId,
    courierName,
    recipientPhone,
    recipientName,
    packageSize: size,
    trackingNumber,
    remarks
  });

  if (!result.success) {
    return res.status(400).json(formatResponse(false, null, result.message));
  }

  res.json(formatResponse(true, result.data, '投件成功，取件码已生成'));
});

router.post('/pickup/code', (req, res) => {
  const { pickupCode } = req.body;
  
  if (!pickupCode) {
    return res.status(400).json(formatResponse(false, null, '请输入取件码'));
  }

  const result = packageModel.pickupByCode(pickupCode);
  
  if (!result.success) {
    return res.status(400).json(formatResponse(false, null, result.message));
  }

  const message = result.data.overtime.isOvertime 
    ? `取件成功，超时${result.data.overtime.hours}小时，需支付滞留费${result.data.overtime.fee}元`
    : '取件成功';

  res.json(formatResponse(true, result.data, message));
});

router.post('/pickup/phone', (req, res) => {
  const { recipientPhone } = req.body;
  
  if (!recipientPhone) {
    return res.status(400).json(formatResponse(false, null, '请输入手机号'));
  }

  const result = packageModel.pickupByPhone(recipientPhone);
  
  if (!result.success) {
    return res.status(400).json(formatResponse(false, null, result.message));
  }

  const message = result.data.totalOvertimeFee > 0
    ? `成功取出${result.data.count}件包裹，超时费用共${result.data.totalOvertimeHours}小时，需支付滞留费${result.data.totalOvertimeFee}元`
    : `成功取出${result.data.count}件包裹`;

  res.json(formatResponse(true, result.data, message));
});

router.get('/', (req, res) => {
  const { status, recipientPhone, startTime, endTime } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (recipientPhone) filter.recipientPhone = recipientPhone;
  if (startTime) filter.startTime = startTime;
  if (endTime) filter.endTime = endTime;
  
  const packages = packageModel.findAll(filter);
  res.json(formatResponse(true, {
    count: packages.length,
    packages
  }));
});

router.get('/:id', (req, res) => {
  const pkg = packageModel.findById(req.params.id);
  if (!pkg) {
    return res.status(404).json(formatResponse(false, null, '包裹不存在'));
  }
  res.json(formatResponse(true, pkg));
});

router.get('/tracking/:trackingNumber', (req, res) => {
  const pkg = packageModel.findByTrackingNumber(req.params.trackingNumber);
  if (!pkg) {
    return res.status(404).json(formatResponse(false, null, '包裹不存在'));
  }
  res.json(formatResponse(true, pkg));
});

router.get('/phone/:recipientPhone', (req, res) => {
  const packages = packageModel.findByPhone(req.params.recipientPhone);
  res.json(formatResponse(true, {
    count: packages.length,
    packages
  }));
});

module.exports = router;
