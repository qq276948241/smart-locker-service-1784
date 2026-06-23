const express = require('express');
const router = express.Router();
const packageModel = require('../models/Package');
const lockerModel = require('../models/Locker');
const { formatResponse } = require('../utils');

router.get('/packages', (req, res) => {
  const { startTime, endTime } = req.query;
  
  if (!startTime || !endTime) {
    return res.status(400).json(formatResponse(false, null, '请提供 startTime 和 endTime 参数'));
  }

  const stats = packageModel.getStatistics(startTime, endTime);
  res.json(formatResponse(true, stats, '统计数据查询成功'));
});

router.get('/overview', (req, res) => {
  const lockerStats = lockerModel.getStats();
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  
  const todayStats = packageModel.getStatistics(todayStart, todayEnd);
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekStats = packageModel.getStatistics(weekStart.toISOString(), now.toISOString());
  
  const pendingPackages = packageModel.findAll({ status: 'deposited' });
  
  const overtimePackages = pendingPackages.filter(p => {
    const diffHours = (now - new Date(p.depositTime)) / (1000 * 60 * 60);
    return diffHours > 24;
  });

  res.json(formatResponse(true, {
    lockers: lockerStats,
    today: {
      deposited: todayStats.totalDeposited,
      pickedUp: todayStats.totalPickedUp
    },
    week: {
      deposited: weekStats.totalDeposited,
      pickedUp: weekStats.totalPickedUp,
      overtimeFee: weekStats.totalOvertimeFee
    },
    pending: {
      total: pendingPackages.length,
      overtime: overtimePackages.length
    }
  }, '概览数据查询成功'));
});

router.get('/packages/export', (req, res) => {
  const { startTime, endTime, format = 'json' } = req.query;
  
  if (!startTime || !endTime) {
    return res.status(400).json(formatResponse(false, null, '请提供 startTime 和 endTime 参数'));
  }

  const packages = packageModel.findAll({ startTime, endTime });
  
  if (format === 'csv') {
    const headers = ['运单号', '格口号', '格口大小', '快递员', '收件人', '手机号', '状态', '投递时间', '取件时间', '滞留费(元)', '滞留时长(小时)', '备注'];
    const rows = packages.map(p => [
      p.trackingNumber,
      p.lockerCode,
      p.lockerSize,
      p.courierName,
      p.recipientName || '',
      p.recipientPhone,
      p.status === 'deposited' ? '待取件' : '已取件',
      p.depositTime,
      p.pickupTime || '',
      p.overtimeFee,
      p.overtimeHours,
      p.remarks || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="packages_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } else {
    res.json(formatResponse(true, {
      count: packages.length,
      packages
    }));
  }
});

module.exports = router;
