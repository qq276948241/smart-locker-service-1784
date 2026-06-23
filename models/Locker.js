const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { SIZE_TYPES, SIZE_NAMES, isValidSize, getSizeName, parseSize, getAllSizeOptions } = require('../utils');

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
        size: SIZE_TYPES.SMALL,
        sizeName: SIZE_NAMES[SIZE_TYPES.SMALL],
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    for (let i = 0; i < mediumCount; i++) {
      lockers.push({
        id: uuidv4(),
        code: `M${String(i + 1).padStart(3, '0')}`,
        size: SIZE_TYPES.MEDIUM,
        sizeName: SIZE_NAMES[SIZE_TYPES.MEDIUM],
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    for (let i = 0; i < largeCount; i++) {
      lockers.push({
        id: uuidv4(),
        code: `L${String(i + 1).padStart(3, '0')}`,
        size: SIZE_TYPES.LARGE,
        sizeName: SIZE_NAMES[SIZE_TYPES.LARGE],
        status: 'available',
        currentPackageId: null,
        createdAt: new Date().toISOString()
      });
    }

    return lockers;
  }

  normalizeSize(sizeInput) {
    return parseSize(sizeInput);
  }

  findAll(filter = {}) {
    let result = [...this.lockers];
    
    if (filter.status) {
      result = result.filter(l => l.status === filter.status);
    }
    if (filter.size) {
      const normalizedSize = this.normalizeSize(filter.size);
      if (normalizedSize) {
        result = result.filter(l => l.size === normalizedSize);
      }
    }
    
    return result;
  }

  findById(id) {
    return this.lockers.find(l => l.id === id);
  }

  findByCode(code) {
    return this.lockers.find(l => l.code === code);
  }

  findAvailable(sizeInput) {
    const size = this.normalizeSize(sizeInput);
    if (!size) return null;
    return this.lockers.find(l => l.status === 'available' && l.size === size);
  }

  findAllAvailable(sizeInput) {
    const size = this.normalizeSize(sizeInput);
    let result = this.lockers.filter(l => l.status === 'available');
    if (size) {
      result = result.filter(l => l.size === size);
    }
    return result;
  }

  countAvailable(sizeInput) {
    const size = this.normalizeSize(sizeInput);
    let result = this.lockers.filter(l => l.status === 'available');
    if (size) {
      result = result.filter(l => l.size === size);
    }
    return result.length;
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

  getSizeOptions() {
    return getAllSizeOptions().map(opt => ({
      ...opt,
      total: this.lockers.filter(l => l.size === opt.key).length,
      available: this.lockers.filter(l => l.size === opt.key && l.status === 'available').length
    }));
  }

  getStats() {
    const buildSizeStats = (size) => ({
      key: size,
      name: getSizeName(size),
      total: this.lockers.filter(l => l.size === size).length,
      available: this.lockers.filter(l => l.size === size && l.status === 'available').length,
      occupied: this.lockers.filter(l => l.size === size && l.status === 'occupied').length,
      maintenance: this.lockers.filter(l => l.size === size && l.status === 'maintenance').length
    });

    return {
      total: this.lockers.length,
      available: this.lockers.filter(l => l.status === 'available').length,
      occupied: this.lockers.filter(l => l.status === 'occupied').length,
      maintenance: this.lockers.filter(l => l.status === 'maintenance').length,
      bySize: {
        small: buildSizeStats(SIZE_TYPES.SMALL),
        medium: buildSizeStats(SIZE_TYPES.MEDIUM),
        large: buildSizeStats(SIZE_TYPES.LARGE)
      },
      sizeOptions: this.getSizeOptions()
    };
  }
}

module.exports = new Locker();
