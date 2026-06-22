const express = require('express');
const router = express.Router();
const moment = require('moment');
const {
  PACKAGE_STATUS,
  LOCKER_TYPES,
  getPackagesByTimeRange,
  getAllPackages,
  calculateOverdueFee
} = require('../data/store');

function isValidDate(dateString) {
  return moment(dateString, moment.ISO_8601, true).isValid();
}

router.get('/packages', (req, res) => {
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: '请提供 startTime 和 endTime 参数'
    });
  }

  if (!isValidDate(startTime) || !isValidDate(endTime)) {
    return res.status(400).json({
      success: false,
      message: '时间格式不正确，请使用 ISO 8601 格式 (如: 2024-01-01T00:00:00Z)'
    });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return res.status(400).json({
      success: false,
      message: 'startTime 必须早于 endTime'
    });
  }

  const packages = getPackagesByTimeRange(startTime, endTime);

  const totalCount = packages.length;
  const pickedUpCount = packages.filter(p => p.status === PACKAGE_STATUS.PICKED_UP).length;
  const pendingCount = packages.filter(p => p.status === PACKAGE_STATUS.DEPOSITED).length;

  let totalOverdueFee = 0;
  let overdueCount = 0;
  packages.forEach(p => {
    const fee = calculateOverdueFee(p);
    if (fee > 0) {
      overdueCount++;
      totalOverdueFee += fee;
    }
  });

  const byType = {};
  Object.values(LOCKER_TYPES).forEach(type => {
    byType[type] = packages.filter(p => p.packageSize === type).length;
  });

  const byDate = {};
  packages.forEach(p => {
    const dateStr = moment(p.depositedAt).format('YYYY-MM-DD');
    if (!byDate[dateStr]) {
      byDate[dateStr] = { total: 0, pickedUp: 0, pending: 0 };
    }
    byDate[dateStr].total++;
    if (p.status === PACKAGE_STATUS.PICKED_UP) {
      byDate[dateStr].pickedUp++;
    } else {
      byDate[dateStr].pending++;
    }
  });

  const records = packages.map(p => ({
    packageId: p.id,
    lockerId: p.lockerId,
    lockerType: p.packageSize,
    courierName: p.courierName,
    courierPhone: p.courierPhone,
    recipientName: p.recipientName,
    recipientPhone: p.recipientPhone,
    pickupCode: p.pickupCode,
    status: p.status,
    depositedAt: p.depositedAt,
    pickedUpAt: p.pickedUpAt,
    overdueFee: calculateOverdueFee(p)
  }));

  res.json({
    success: true,
    data: {
      timeRange: {
        startTime: start,
        endTime: end
      },
      summary: {
        totalCount,
        pickedUpCount,
        pendingCount,
        overdueCount,
        totalOverdueFee,
        pickupRate: totalCount > 0 ? `${((pickedUpCount / totalCount) * 100).toFixed(2)}%` : '0%'
      },
      byType,
      byDate,
      records
    }
  });
});

router.get('/overview', (req, res) => {
  const allPackages = getAllPackages();

  const today = moment().startOf('day');
  const weekAgo = moment().subtract(7, 'days').startOf('day');
  const monthAgo = moment().subtract(30, 'days').startOf('day');

  const todayPackages = allPackages.filter(p => moment(p.depositedAt).isSame(today, 'day'));
  const weekPackages = allPackages.filter(p => moment(p.depositedAt).isAfter(weekAgo));
  const monthPackages = allPackages.filter(p => moment(p.depositedAt).isAfter(monthAgo));

  const pendingPackages = allPackages.filter(p => p.status === PACKAGE_STATUS.DEPOSITED);
  let totalOverdueFee = 0;
  let overdueCount = 0;
  pendingPackages.forEach(p => {
    const fee = calculateOverdueFee(p);
    if (fee > 0) {
      overdueCount++;
      totalOverdueFee += fee;
    }
  });

  res.json({
    success: true,
    data: {
      today: {
        deposited: todayPackages.length,
        pickedUp: todayPackages.filter(p => p.status === PACKAGE_STATUS.PICKED_UP).length
      },
      last7Days: {
        deposited: weekPackages.length,
        pickedUp: weekPackages.filter(p => p.status === PACKAGE_STATUS.PICKED_UP).length
      },
      last30Days: {
        deposited: monthPackages.length,
        pickedUp: monthPackages.filter(p => p.status === PACKAGE_STATUS.PICKED_UP).length
      },
      pending: {
        total: pendingPackages.length,
        overdue: overdueCount,
        totalOverdueFee
      }
    }
  });
});

module.exports = router;
