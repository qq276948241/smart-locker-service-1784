const express = require('express');
const router = express.Router();
const {
  LOCKER_STATUS,
  LOCKER_TYPES,
  PACKAGE_STATUS,
  FREE_HOURS,
  OVERDUE_FEE_PER_DAY,
  getAvailableLocker,
  updateLockerStatus,
  addPackage,
  getPackageByPickupCode,
  getPackagesByPhone,
  getPackageById,
  updatePackageStatus,
  calculateOverdueFee
} = require('../data/store');
const { generatePickupCode } = require('../utils/pickupCode');
const { sendPickupNotification } = require('../utils/notification');

router.post('/deposit', async (req, res) => {
  const { courierName, courierPhone, recipientPhone, recipientName, packageSize } = req.body;

  if (!courierName || !courierPhone || !recipientPhone) {
    return res.status(400).json({
      success: false,
      message: '快递员姓名、快递员手机号、收件人手机号为必填项'
    });
  }

  if (packageSize && !Object.values(LOCKER_TYPES).includes(packageSize)) {
    return res.status(400).json({
      success: false,
      message: `无效的包裹尺寸，有效值为: ${Object.values(LOCKER_TYPES).join(', ')}`
    });
  }

  const locker = getAvailableLocker(packageSize);

  if (!locker) {
    return res.status(409).json({
      success: false,
      message: packageSize ? `暂无${packageSize}类型的空闲格口` : '暂无空闲格口'
    });
  }

  const pickupCode = generatePickupCode();

  const pkg = addPackage({
    courierName,
    courierPhone,
    recipientPhone,
    recipientName: recipientName || null,
    packageSize: packageSize || locker.type,
    lockerId: locker.id,
    pickupCode
  });

  updateLockerStatus(locker.id, LOCKER_STATUS.OCCUPIED, pkg.id);

  let notificationSent = false;
  try {
    await sendPickupNotification(recipientPhone, pickupCode, locker.id);
    notificationSent = true;
  } catch (err) {
    console.error('发送取件通知失败:', err.message);
  }

  res.json({
    success: true,
    message: '投递成功',
    data: {
      packageId: pkg.id,
      lockerId: locker.id,
      lockerType: locker.type,
      pickupCode,
      recipientPhone,
      freeHours: FREE_HOURS,
      depositedAt: pkg.depositedAt,
      notificationSent
    }
  });
});

router.post('/pickup', (req, res) => {
  const { pickupCode, phone } = req.body;

  if (!pickupCode && !phone) {
    return res.status(400).json({
      success: false,
      message: '请提供取件码或手机号'
    });
  }

  let packages = [];

  if (pickupCode) {
    const pkg = getPackageByPickupCode(pickupCode);
    if (pkg) {
      packages = [pkg];
    }
  } else if (phone) {
    packages = getPackagesByPhone(phone);
  }

  if (packages.length === 0) {
    return res.status(404).json({
      success: false,
      message: '未找到待取件的包裹'
    });
  }

  const results = packages.map(pkg => {
    const overdueFee = calculateOverdueFee(pkg);
    return {
      packageId: pkg.id,
      lockerId: pkg.lockerId,
      lockerType: pkg.packageSize,
      recipientName: pkg.recipientName,
      recipientPhone: pkg.recipientPhone,
      depositedAt: pkg.depositedAt,
      overdueFee,
      overdueFeePerDay: OVERDUE_FEE_PER_DAY,
      freeHours: FREE_HOURS
    };
  });

  res.json({
    success: true,
    data: results,
    count: results.length
  });
});

router.post('/confirm-pickup', (req, res) => {
  const { packageId } = req.body;

  if (!packageId) {
    return res.status(400).json({
      success: false,
      message: '请提供包裹ID'
    });
  }

  const pkg = getPackageById(packageId);

  if (!pkg) {
    return res.status(404).json({
      success: false,
      message: '包裹不存在'
    });
  }

  if (pkg.status === PACKAGE_STATUS.PICKED_UP) {
    return res.status(400).json({
      success: false,
      message: '该包裹已被取走'
    });
  }

  const overdueFee = calculateOverdueFee(pkg);
  pkg.overdueFee = overdueFee;

  updatePackageStatus(packageId, PACKAGE_STATUS.PICKED_UP);
  updateLockerStatus(pkg.lockerId, LOCKER_STATUS.AVAILABLE, null);

  res.json({
    success: true,
    message: overdueFee > 0 ? `取件成功，请支付滞留费 ¥${overdueFee}` : '取件成功',
    data: {
      packageId: pkg.id,
      lockerId: pkg.lockerId,
      pickedUpAt: pkg.pickedUpAt,
      depositedAt: pkg.depositedAt,
      overdueFee,
      freeHours: FREE_HOURS
    }
  });
});

module.exports = router;
