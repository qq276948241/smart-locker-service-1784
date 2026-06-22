class PackageService {
  constructor(store, notifier) {
    if (!store) throw new Error('PackageService requires a store instance');
    this.store = store;
    this.notifier = notifier;
  }

  _toTimestamp(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    return Date.now();
  }

  lookup({ pickupCode, phone }) {
    if (!this.store) {
      return { success: false, error: '服务未初始化' };
    }
    let pkg = null;
    if (pickupCode) {
      pkg = Array.from(this.store.packages.values()).find(
        p => p.pickupCode === pickupCode.toString() && p.status === 'deposited'
      );
    } else if (phone) {
      pkg = Array.from(this.store.packages.values()).find(
        p => p.recipientPhone === phone.toString() && p.status === 'deposited'
      );
    }
    if (!pkg) {
      return { success: false, error: '未找到待取包裹' };
    }
    const now = Date.now();
    const depositTs = this._toTimestamp(pkg.depositTime);
    const hoursElapsed = (now - depositTs) / (1000 * 60 * 60);
    const overdueHours = this.store.constructor.OVERDUE_HOURS || 24;
    const isOverdue = hoursElapsed > overdueHours;
    return {
      success: true,
      data: {
        packageId: pkg.id,
        lockerId: pkg.lockerId,
        packageSize: pkg.packageSize,
        courierName: pkg.courierName,
        depositTime: new Date(depositTs).toISOString(),
        hoursElapsed: Number(hoursElapsed.toFixed(1)),
        isOverdue,
        pickupCode: pkg.pickupCode,
        estimatedOverdueFee: isOverdue
          ? Math.min(Math.ceil(hoursElapsed - overdueHours), 50)
          : 0
      }
    };
  }

  deposit(params) {
    if (!this.store) {
      return { success: false, error: '服务未初始化' };
    }
    const result = this.store.depositPackage(params);
    if (result.success && this.notifier) {
      const pkg = this.store.packages.get(result.data.packageId);
      if (pkg) {
        this.notifier.sendDepositNotice(pkg).catch(err => {
          console.error('[PackageService] 投递通知发送失败:', err.message);
        });
      }
    }
    return result;
  }

  pickupByCode(pickupCode) {
    if (!this.store) {
      return { success: false, error: '服务未初始化' };
    }
    return this.store.pickupByCode(pickupCode);
  }

  pickupByPhone(phone) {
    if (!this.store) {
      return { success: false, error: '服务未初始化' };
    }
    return this.store.pickupByPhone(phone);
  }

  getOverduePackages() {
    if (!this.store) {
      return { success: false, error: '服务未初始化' };
    }
    return this.store.getOverduePackages();
  }
}

module.exports = PackageService;
