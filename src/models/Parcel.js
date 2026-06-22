const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config');

class Parcel {
  constructor() {
    this.parcels = [];
  }

  generatePickupCode() {
    const length = config.pickupCode.length;
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  create(data) {
    const parcel = {
      id: uuidv4(),
      courierId: data.courierId,
      courierName: data.courierName,
      courierPhone: data.courierPhone,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      size: data.size,
      lockerId: data.lockerId,
      lockerCode: data.lockerCode,
      pickupCode: this.generatePickupCode(),
      status: 'stored',
      storedAt: new Date(),
      pickupDeadline: moment().add(config.pickup.freeHours, 'hours').toDate(),
      pickedUpAt: null,
      overdueFee: 0,
      paid: false,
      expressCompany: data.expressCompany,
      trackingNumber: data.trackingNumber
    };
    this.parcels.push(parcel);
    return parcel;
  }

  findById(id) {
    return this.parcels.find(p => p.id === id);
  }

  findByPickupCode(code) {
    return this.parcels.find(p => p.pickupCode === code && p.status === 'stored');
  }

  findByPhone(phone) {
    return this.parcels.filter(p => p.recipientPhone === phone && p.status === 'stored');
  }

  findByLockerId(lockerId) {
    return this.parcels.find(p => p.lockerId === lockerId && p.status === 'stored');
  }

  findAll(filters = {}) {
    let result = [...this.parcels];
    if (filters.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (filters.recipientPhone) {
      result = result.filter(p => p.recipientPhone === filters.recipientPhone);
    }
    if (filters.size) {
      result = result.filter(p => p.size === filters.size);
    }
    return result;
  }

  findByDateRange(startDate, endDate) {
    const start = moment(startDate).startOf('day').toDate();
    const end = moment(endDate).endOf('day').toDate();
    return this.parcels.filter(p => p.storedAt >= start && p.storedAt <= end);
  }

  pickup(id, feePaid = true) {
    const parcel = this.findById(id);
    if (parcel && parcel.status === 'stored') {
      const { fee, days, isOverdue } = this.calculateOverdueFee(parcel);
      parcel.status = 'picked_up';
      parcel.pickedUpAt = new Date();
      parcel.overdueFee = fee;
      parcel.overdueDays = days;
      parcel.isOverdue = isOverdue;
      parcel.paid = feePaid;
      return parcel;
    }
    return null;
  }

  calculateOverdueFee(parcel) {
    const now = moment();
    const deadline = moment(parcel.pickupDeadline);
    const diffHours = now.diff(deadline, 'hours');

    if (diffHours <= 0) {
      return { fee: 0, days: 0, isOverdue: false };
    }

    const days = Math.min(Math.ceil(diffHours / 24), config.pickup.maxOverdueDays);
    const fee = days * config.pickup.overdueFeePerDay;

    return { fee, days, isOverdue: true };
  }

  getStatsByDateRange(startDate, endDate) {
    const records = this.findByDateRange(startDate, endDate);
    const stats = {
      total: records.length,
      stored: records.filter(r => r.status === 'stored').length,
      pickedUp: records.filter(r => r.status === 'picked_up').length,
      overdue: records.filter(r => r.isOverdue && r.status === 'stored').length,
      totalOverdueFee: records.reduce((sum, r) => sum + (r.overdueFee || 0), 0),
      bySize: {
        small: records.filter(r => r.size === 'small').length,
        medium: records.filter(r => r.size === 'medium').length,
        large: records.filter(r => r.size === 'large').length
      },
      byCompany: {},
      dailyStats: {}
    };

    records.forEach(r => {
      const company = r.expressCompany || 'unknown';
      stats.byCompany[company] = (stats.byCompany[company] || 0) + 1;

      const day = moment(r.storedAt).format('YYYY-MM-DD');
      if (!stats.dailyStats[day]) {
        stats.dailyStats[day] = { stored: 0, pickedUp: 0, total: 0 };
      }
      stats.dailyStats[day].total++;
      if (r.status === 'stored') {
        stats.dailyStats[day].stored++;
      } else if (r.status === 'picked_up') {
        stats.dailyStats[day].pickedUp++;
      }
    });

    return {
      summary: stats,
      records
    };
  }
}

module.exports = new Parcel();
