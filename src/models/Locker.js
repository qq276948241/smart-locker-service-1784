const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class Locker {
  constructor() {
    this.lockers = this._initializeLockers();
  }

  _initializeLockers() {
    const lockers = [];
    const { smallSize, mediumSize, largeSize } = config.locker;

    let id = 1;
    for (let i = 0; i < smallSize.count; i++) {
      lockers.push({
        id: id++,
        code: `S${String(i + 1).padStart(2, '0')}`,
        size: smallSize.name,
        status: 'available',
        currentParcelId: null
      });
    }
    for (let i = 0; i < mediumSize.count; i++) {
      lockers.push({
        id: id++,
        code: `M${String(i + 1).padStart(2, '0')}`,
        size: mediumSize.name,
        status: 'available',
        currentParcelId: null
      });
    }
    for (let i = 0; i < largeSize.count; i++) {
      lockers.push({
        id: id++,
        code: `L${String(i + 1).padStart(2, '0')}`,
        size: largeSize.name,
        status: 'available',
        currentParcelId: null
      });
    }
    return lockers;
  }

  findAvailable(size) {
    return this.lockers.find(l => l.size === size && l.status === 'available');
  }

  findById(id) {
    return this.lockers.find(l => l.id === id);
  }

  findByCode(code) {
    return this.lockers.find(l => l.code === code);
  }

  findAll(filters = {}) {
    let result = [...this.lockers];
    if (filters.size) {
      result = result.filter(l => l.size === filters.size);
    }
    if (filters.status) {
      result = result.filter(l => l.status === filters.status);
    }
    return result;
  }

  occupy(lockerId, parcelId) {
    const locker = this.findById(lockerId);
    if (locker && locker.status === 'available') {
      locker.status = 'occupied';
      locker.currentParcelId = parcelId;
      locker.occupiedAt = new Date();
      return locker;
    }
    return null;
  }

  release(lockerId) {
    const locker = this.findById(lockerId);
    if (locker && locker.status === 'occupied') {
      locker.status = 'available';
      locker.currentParcelId = null;
      locker.occupiedAt = null;
      return locker;
    }
    return null;
  }

  setOutOfService(lockerId, reason) {
    const locker = this.findById(lockerId);
    if (locker) {
      locker.status = 'out_of_service';
      locker.outOfServiceReason = reason;
      locker.outOfServiceAt = new Date();
      return locker;
    }
    return null;
  }

  setAvailable(lockerId) {
    const locker = this.findById(lockerId);
    if (locker && locker.status === 'out_of_service') {
      locker.status = 'available';
      locker.outOfServiceReason = null;
      locker.outOfServiceAt = null;
      return locker;
    }
    return null;
  }

  getStats() {
    const stats = {
      total: this.lockers.length,
      available: 0,
      occupied: 0,
      outOfService: 0,
      bySize: {
        small: { total: 0, available: 0, occupied: 0 },
        medium: { total: 0, available: 0, occupied: 0 },
        large: { total: 0, available: 0, occupied: 0 }
      }
    };

    this.lockers.forEach(locker => {
      stats[locker.status]++;
      stats.bySize[locker.size].total++;
      if (locker.status === 'available') {
        stats.bySize[locker.size].available++;
      } else if (locker.status === 'occupied') {
        stats.bySize[locker.size].occupied++;
      }
    });

    return stats;
  }
}

module.exports = new Locker();
