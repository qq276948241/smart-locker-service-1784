const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class Locker {
  constructor() {
    this.lockers = this.initLockers();
  }

  initLockers() {
    const lockers = [];
    const { smallCount, mediumCount, largeCount } = config.locker;

    for (let i = 0; i < smallCount; i++) {
      lockers.push({
        id: uuidv4(),
        code: `S${String(i + 1).padStart(3, '0')}`,
        size: 'small',
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    for (let i = 0; i < mediumCount; i++) {
      lockers.push({
        id: uuidv4(),
        code: `M${String(i + 1).padStart(3, '0')}`,
        size: 'medium',
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    for (let i = 0; i < largeCount; i++) {
      lockers.push({
        id: uuidv4(),
        code: `L${String(i + 1).padStart(3, '0')}`,
        size: 'large',
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    return lockers;
  }

  findAll(filter = {}) {
    let result = [...this.lockers];
    
    if (filter.status) {
      result = result.filter(l => l.status === filter.status);
    }
    if (filter.size) {
      result = result.filter(l => l.size === filter.size);
    }
    
    return result;
  }

  findById(id) {
    return this.lockers.find(l => l.id === id);
  }

  findByCode(code) {
    return this.lockers.find(l => l.code === code);
  }

  findAvailable(size) {
    return this.lockers.find(l => l.status === 'available' && l.size === size);
  }

  occupy(lockerId, packageId) {
    const locker = this.findById(lockerId);
    if (!locker) return null;
    
    locker.status = 'occupied';
    locker.currentPackageId = packageId;
    locker.updatedAt = new Date().toISOString();
    
    return locker;
  }

  release(lockerId) {
    const locker = this.findById(lockerId);
    if (!locker) return null;
    
    locker.status = 'available';
    locker.currentPackageId = null;
    locker.updatedAt = new Date().toISOString();
    
    return locker;
  }

  setMaintenance(lockerId, isMaintenance = true) {
    const locker = this.findById(lockerId);
    if (!locker) return null;
    
    locker.status = isMaintenance ? 'maintenance' : 'available';
    locker.updatedAt = new Date().toISOString();
    
    return locker;
  }

  getStats() {
    return {
      total: this.lockers.length,
      available: this.lockers.filter(l => l.status === 'available').length,
      occupied: this.lockers.filter(l => l.status === 'occupied').length,
      maintenance: this.lockers.filter(l => l.status === 'maintenance').length,
      bySize: {
        small: {
          total: this.lockers.filter(l => l.size === 'small').length,
          available: this.lockers.filter(l => l.size === 'small' && l.status === 'available').length,
          occupied: this.lockers.filter(l => l.size === 'small' && l.status === 'occupied').length
        },
        medium: {
          total: this.lockers.filter(l => l.size === 'medium').length,
          available: this.lockers.filter(l => l.size === 'medium' && l.status === 'available').length,
          occupied: this.lockers.filter(l => l.size === 'medium' && l.status === 'occupied').length
        },
        large: {
          total: this.lockers.filter(l => l.size === 'large').length,
          available: this.lockers.filter(l => l.size === 'large' && l.status === 'available').length,
          occupied: this.lockers.filter(l => l.size === 'large' && l.status === 'occupied').length
        }
      }
    };
  }
}

module.exports = new Locker();
