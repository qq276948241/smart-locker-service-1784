const express = require('express');
const router = express.Router();
const moment = require('moment');
const parcel = require('../models/Parcel');
const locker = require('../models/Locker');

router.get('/records', (req, res, next) => {
  try {
    let { startDate, endDate, groupBy } = req.query;

    if (!startDate || !endDate) {
      endDate = moment().format('YYYY-MM-DD');
      startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
    }

    const start = moment(startDate);
    const end = moment(endDate);

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({
        code: 400,
        message: '日期格式无效，请使用 YYYY-MM-DD 格式',
        data: null
      });
    }

    if (start.isAfter(end)) {
      return res.status(400).json({
        code: 400,
        message: '开始日期不能晚于结束日期',
        data: null
      });
    }

    const result = parcel.getStatsByDateRange(startDate, endDate);

    let groupedData = result.records;
    if (groupBy === 'day') {
      groupedData = result.summary.dailyStats;
    } else if (groupBy === 'size') {
      groupedData = result.summary.bySize;
    } else if (groupBy === 'company') {
      groupedData = result.summary.byCompany;
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        query: {
          startDate: start.format('YYYY-MM-DD'),
          endDate: end.format('YYYY-MM-DD'),
          days: end.diff(start, 'days') + 1
        },
        summary: {
          total: result.summary.total,
          stored: result.summary.stored,
          pickedUp: result.summary.pickedUp,
          overdue: result.summary.overdue,
          totalOverdueFee: result.summary.totalOverdueFee,
          bySize: result.summary.bySize,
          byCompany: result.summary.byCompany
        },
        dailyStats: result.summary.dailyStats,
        groupedData,
        records: groupBy ? undefined : result.records
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/overview', (req, res, next) => {
  try {
    const lockerStats = locker.getStats();

    const today = moment().format('YYYY-MM-DD');
    const todayStats = parcel.getStatsByDateRange(today, today);

    const weekStart = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const weekStats = parcel.getStatsByDateRange(weekStart, today);

    const storedParcels = parcel.findAll({ status: 'stored' });
    const overdueParcels = storedParcels.filter(p => {
      const info = parcel.calculateOverdueFee(p);
      return info.isOverdue;
    });

    res.json({
      code: 0,
      message: 'success',
      data: {
        lockers: lockerStats,
        today: {
          stored: todayStats.summary.total,
          pickedUp: todayStats.summary.pickedUp
        },
        thisWeek: {
          stored: weekStats.summary.total,
          pickedUp: weekStats.summary.pickedUp,
          totalOverdueFee: weekStats.summary.totalOverdueFee
        },
        current: {
          stored: storedParcels.length,
          overdue: overdueParcels.length,
          totalOverdueFee: overdueParcels.reduce((sum, p) => {
            return sum + parcel.calculateOverdueFee(p).fee;
          }, 0)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
