const { generateId } = require('../utils/common');

const deliveryRecords = [];

function createRecord(data) {
  const { packageId, lockerId, action, operatorName, operatorPhone, operatorRole, details } = data;

  const record = {
    id: generateId('REC'),
    packageId,
    lockerId,
    action,
    operatorName,
    operatorPhone,
    operatorRole,
    timestamp: data.timestamp || new Date().toISOString(),
    details,
  };

  deliveryRecords.push(record);
  return record;
}

function getRecords({ startTime, endTime, action, page = 1, pageSize = 20 } = {}) {
  let records = [...deliveryRecords];

  if (startTime) {
    const start = new Date(startTime).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() >= start);
  }
  if (endTime) {
    const end = new Date(endTime).getTime();
    records = records.filter((r) => new Date(r.timestamp).getTime() <= end);
  }
  if (action) {
    records = records.filter((r) => r.action === action.toLowerCase());
  }

  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = records.length;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 20;
  const startIdx = (pageNum - 1) * size;
  const pagedRecords = records.slice(startIdx, startIdx + size);

  const deliverCount = records.filter((r) => r.action === 'deliver').length;
  const pickupCount = records.filter((r) => r.action === 'pickup').length;
  const totalOvertimeFee = records
    .filter((r) => r.action === 'pickup' && r.details.overtimeFee)
    .reduce((sum, r) => sum + r.details.overtimeFee, 0);
  const overduePickupCount = records.filter((r) => r.action === 'pickup' && r.details.isOverdue).length;

  return {
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
    records: pagedRecords,
    statistics: {
      deliverCount,
      pickupCount,
      totalOvertimeFee,
      overduePickupCount,
      overdueRate: pickupCount > 0 ? parseFloat((overduePickupCount / pickupCount * 100).toFixed(2)) : 0,
    },
  };
}

function getDailyStats({ startTime, endTime } = {}) {
  const start = startTime ? new Date(startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endTime ? new Date(endTime) : new Date();

  let records = deliveryRecords.filter((r) => {
    const t = new Date(r.timestamp);
    return t >= start && t <= end;
  });

  const dailyStats = {};
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    dailyStats[dateStr] = { date: dateStr, deliverCount: 0, pickupCount: 0, overtimeFee: 0 };
    current.setDate(current.getDate() + 1);
  }

  records.forEach((r) => {
    const dateStr = r.timestamp.split('T')[0];
    if (dailyStats[dateStr]) {
      if (r.action === 'deliver') {
        dailyStats[dateStr].deliverCount++;
      } else if (r.action === 'pickup') {
        dailyStats[dateStr].pickupCount++;
        dailyStats[dateStr].overtimeFee += r.details.overtimeFee || 0;
      }
    }
  });

  const result = Object.values(dailyStats);

  return {
    period: {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    dailyStats: result,
    summary: {
      totalDeliver: result.reduce((s, d) => s + d.deliverCount, 0),
      totalPickup: result.reduce((s, d) => s + d.pickupCount, 0),
      totalOvertimeFee: result.reduce((s, d) => s + d.overtimeFee, 0),
    },
  };
}

module.exports = {
  createRecord,
  getRecords,
  getDailyStats,
};
