class PackageService {
  constructor(store, notifier) {
    this.store = store;
    this.notifier = notifier;
  }

  deposit(params) {
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
    return this.store.pickupByCode(pickupCode);
  }

  pickupByPhone(phone) {
    return this.store.pickupByPhone(phone);
  }

  getOverduePackages() {
    return this.store.getOverduePackages();
  }
}

module.exports = PackageService;
