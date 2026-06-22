const LOCKER_SIZES = ['small', 'medium', 'large'];
const OVERDUE_HOURS = 24;
const OVERDUE_FEE_PER_HOUR = 1;
const MAX_OVERDUE_FEE = 50;

class Store {
  constructor() {
    this.lockers = [];
    this.packages = new Map();
    this.records = [];
    this._initLockers();
  }

  _initLockers() {
    const counts = { small: 10, medium: 6, large: 4 };
    let id = 1;
    for (const size of LOCKER_SIZES) {
      for (let i = 0; i < counts[size]; i++) {
        this.lockers.push({
          id: `L${String(id).padStart(3, '0')}`,
          size: size,
          status: 'available',
          currentPackageId: null
        });
        id++;
      }
    }
  }

  generatePickupCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  findAvailableLocker(packageSize) {
    const priority = packageSize === 'small'
      ? ['small', 'medium', 'large']
      : packageSize === 'medium'
        ? ['medium', 'large']
        : ['large'];

    for (const size of priority) {
      const locker = this.lockers.find(l => l.size === size && l.status === 'available');
      if (locker) return locker;
    }
    return null;
  }

  depositPackage({ courierId, courierName, recipientPhone, packageSize }) {
    const locker = this.findAvailableLocker(packageSize);
    if (!locker) {
      return { success: false, error: '没有可用格口' };
    }

    const pickupCode = this.generatePickupCode();
    const packageId = `P${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const now = Date.now();

    const pkg = {
      id: packageId,
      courierId,
      courierName,
      recipientPhone,
      packageSize,
      lockerId: locker.id,
      pickupCode,
      depositTime: now,
      status: 'deposited'
    };

    this.packages.set(packageId, pkg);

    locker.status = 'occupied';
    locker.currentPackageId = packageId;

    const record = {
      id: `R${now}${Math.floor(Math.random() * 1000)}`,
      packageId,
      lockerId: locker.id,
      courierId,
      courierName,
      recipientPhone,
      packageSize,
      action: 'deposit',
      timestamp: now,
      overdueFee: 0
    };
    this.records.push(record);

    return {
      success: true,
      data: {
        packageId,
        lockerId: locker.id,
        pickupCode,
        depositTime: new Date(now).toISOString()
      }
    };
  }

  _calculateOverdueFee(depositTime, pickupTime) {
    const hoursElapsed = (pickupTime - depositTime) / (1000 * 60 * 60);
    if (hoursElapsed <= OVERDUE_HOURS) return 0;
    const overdueHours = Math.ceil(hoursElapsed - OVERDUE_HOURS);
    return Math.min(overdueHours * OVERDUE_FEE_PER_HOUR, MAX_OVERDUE_FEE);
  }

  pickupByCode(pickupCode) {
    const pkg = Array.from(this.packages.values()).find(
      p => p.pickupCode === pickupCode && p.status === 'deposited'
    );
    if (!pkg) return { success: false, error: '取件码无效或包裹已取走' };
    return this._doPickup(pkg);
  }

  pickupByPhone(phone) {
    const pkg = Array.from(this.packages.values()).find(
      p => p.recipientPhone === phone && p.status === 'deposited'
    );
    if (!pkg) return { success: false, error: '该手机号下没有待取包裹' };
    return this._doPickup(pkg);
  }

  _doPickup(pkg) {
    const now = Date.now();
    const overdueFee = this._calculateOverdueFee(pkg.depositTime, now);

    pkg.status = 'picked';
    pkg.pickupTime = now;
    pkg.overdueFee = overdueFee;

    const locker = this.lockers.find(l => l.id === pkg.lockerId);
    if (locker) {
      locker.status = 'available';
      locker.currentPackageId = null;
    }

    const record = {
      id: `R${now}${Math.floor(Math.random() * 1000)}`,
      packageId: pkg.id,
      lockerId: pkg.lockerId,
      courierId: pkg.courierId,
      courierName: pkg.courierName,
      recipientPhone: pkg.recipientPhone,
      packageSize: pkg.packageSize,
      action: 'pickup',
      timestamp: now,
      overdueFee
    };
    this.records.push(record);

    return {
      success: true,
      data: {
        packageId: pkg.id,
        lockerId: pkg.lockerId,
        pickupTime: new Date(now).toISOString(),
        depositTime: new Date(pkg.depositTime).toISOString(),
        overdueFee
      }
    };
  }

  getLockerStatus() {
    return this.lockers.map(l => ({
      id: l.id,
      size: l.size,
      status: l.status,
      currentPackageId: l.currentPackageId
    }));
  }

  getLockerStats() {
    const stats = {
      total: this.lockers.length,
      available: 0,
      occupied: 0,
      bySize: {
        small: { total: 0, available: 0, occupied: 0 },
        medium: { total: 0, available: 0, occupied: 0 },
        large: { total: 0, available: 0, occupied: 0 }
      }
    };
    for (const locker of this.lockers) {
      stats.bySize[locker.size].total++;
      if (locker.status === 'available') {
        stats.available++;
        stats.bySize[locker.size].available++;
      } else {
        stats.occupied++;
        stats.bySize[locker.size].occupied++;
      }
    }
    return stats;
  }

  queryRecords(startTime, endTime) {
    const start = startTime ? new Date(startTime).getTime() : 0;
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    return this.records
      .filter(r => r.timestamp >= start && r.timestamp <= end)
      .map(r => ({
        ...r,
        timestamp: new Date(r.timestamp).toISOString()
      }));
  }

  getRecordsStats(startTime, endTime) {
    const records = this.queryRecords(startTime, endTime);
    const stats = {
      totalRecords: records.length,
      depositCount: 0,
      pickupCount: 0,
      totalOverdueFee: 0,
      bySize: {
        small: { deposit: 0, pickup: 0 },
        medium: { deposit: 0, pickup: 0 },
        large: { deposit: 0, pickup: 0 }
      },
      byDate: {}
    };

    for (const r of records) {
      if (r.action === 'deposit') {
        stats.depositCount++;
        stats.bySize[r.packageSize].deposit++;
      } else {
        stats.pickupCount++;
        stats.bySize[r.packageSize].pickup++;
        stats.totalOverdueFee += r.overdueFee;
      }
      const date = r.timestamp.slice(0, 10);
      if (!stats.byDate[date]) {
        stats.byDate[date] = { deposit: 0, pickup: 0, overdueFee: 0 };
      }
      if (r.action === 'deposit') {
        stats.byDate[date].deposit++;
      } else {
        stats.byDate[date].pickup++;
        stats.byDate[date].overdueFee += r.overdueFee;
      }
    }

    return stats;
  }

  getOverduePackages() {
    const now = Date.now();
    return Array.from(this.packages.values())
      .filter(p => p.status === 'deposited')
      .map(p => {
        const hoursElapsed = (now - p.depositTime) / (1000 * 60 * 60);
        const isOverdue = hoursElapsed > OVERDUE_HOURS;
        return {
          packageId: p.id,
          lockerId: p.lockerId,
          recipientPhone: p.recipientPhone,
          packageSize: p.packageSize,
          depositTime: new Date(p.depositTime).toISOString(),
          hoursElapsed: Number(hoursElapsed.toFixed(1)),
          isOverdue,
          estimatedOverdueFee: isOverdue
            ? Math.min(Math.ceil(hoursElapsed - OVERDUE_HOURS) * OVERDUE_FEE_PER_HOUR, MAX_OVERDUE_FEE)
            : 0
        };
      });
  }
}

module.exports = {
  Store,
  config: {
    LOCKER_SIZES,
    OVERDUE_HOURS,
    OVERDUE_FEE_PER_HOUR,
    MAX_OVERDUE_FEE
  }
};
