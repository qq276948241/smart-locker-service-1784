const express = require('express');
const router = express.Router();
const models = require('../models');
const { determineLockerSize } = require('../utils/common');
const { calculateOvertimeFee } = require('../utils/fee');
const { courierAuth } = require('../middleware/auth');
const notifyService = require('../services/notify');

router.post('/deliver', courierAuth, (req, res) => {
  const { recipientPhone, recipientName, packageHeight, packageWidth, packageDepth, trackingNumber } = req.body;

  const courierName = req.courier.name;
  const courierPhone = req.courier.phone;

  if (!recipientPhone || !recipientName) {
    return res.status(400).json({ code: 400, message: '收件人信息必填' });
  }
  if (packageHeight === undefined || packageWidth === undefined || packageDepth === undefined) {
    return res.status(400).json({ code: 400, message: '包裹尺寸(长宽高)必填' });
  }

  const size = determineLockerSize(packageHeight, packageWidth, packageDepth);
  if (!size) {
    return res.status(400).json({ code: 400, message: '包裹尺寸过大，没有适合的格口' });
  }

  const locker = models.locker.findAvailableLocker(size);
  if (!locker) {
    return res.status(503).json({ code: 503, message: `${size} 型号格口已满，请稍后再试` });
  }

  const pkg = models.package.createPackage({
    trackingNumber,
    courierName,
    courierPhone,
    recipientName,
    recipientPhone,
    dimensions: { height: packageHeight, width: packageWidth, depth: packageDepth },
    lockerId: locker.id,
    lockerSize: size,
  });

  models.locker.assignPackage(locker.id, pkg.id);

  models.record.createRecord({
    packageId: pkg.id,
    lockerId: locker.id,
    action: 'deliver',
    operatorName: courierName,
    operatorPhone: courierPhone,
    operatorRole: 'courier',
    timestamp: pkg.storedAt,
    details: {
      recipientName,
      recipientPhone,
      trackingNumber: pkg.trackingNumber,
      courierName,
      courierPhone,
    },
  });

  notifyService.sendDeliveryNotify(recipientPhone, recipientName, pkg.pickupCode, locker.id);

  res.status(201).json({
    code: 0,
    message: '投递成功',
    data: {
      packageId: pkg.id,
      lockerId: locker.id,
      lockerSize: size,
      pickupCode: pkg.pickupCode,
      storedAt: pkg.storedAt,
      recipientPhone,
      recipientName,
    },
  });
});

router.post('/pickup', (req, res) => {
  const { pickupCode, recipientPhone } = req.body;

  if (!pickupCode && !recipientPhone) {
    return res.status(400).json({ code: 400, message: '取件码或手机号至少提供一项' });
  }

  const targetPkg = models.package.findStoredPackage(pickupCode, recipientPhone);
  if (!targetPkg) {
    return res.status(404).json({ code: 404, message: '未找到待取包裹，请核对取件码或手机号' });
  }

  const { pkg, overtime, now } = models.package.markAsPicked(targetPkg.id);

  models.locker.releaseLocker(pkg.lockerId);

  models.record.createRecord({
    packageId: pkg.id,
    lockerId: pkg.lockerId,
    action: 'pickup',
    operatorName: pkg.recipientName,
    operatorPhone: pkg.recipientPhone,
    operatorRole: 'recipient',
    timestamp: now,
    details: {
      overtimeDays: overtime.days,
      overtimeFee: overtime.fee,
      isOverdue: overtime.isOverdue,
      courierName: pkg.courierName,
      courierPhone: pkg.courierPhone,
    },
  });

  res.json({
    code: 0,
    message: overtime.isOverdue ? '取件成功，请支付滞留费' : '取件成功',
    data: {
      packageId: pkg.id,
      lockerId: pkg.lockerId,
      trackingNumber: pkg.trackingNumber,
      pickedAt: now,
      overtimeInfo: overtime,
    },
  });
});

router.get('/query', (req, res) => {
  const { pickupCode, recipientPhone, packageId } = req.query;

  const pkg = models.package.queryPackage({ pickupCode, recipientPhone, packageId });
  if (!pkg) {
    return res.status(404).json({ code: 404, message: '未找到该包裹' });
  }

  const overtime = calculateOvertimeFee(pkg.storedAt);

  res.json({
    code: 0,
    message: 'success',
    data: {
      ...pkg,
      overtimeInfo: overtime,
    },
  });
});

module.exports = router;
