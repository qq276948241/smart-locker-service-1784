const { NOTIFICATION_TYPES } = require('./notification');

const WARNING_HOURS_BEFORE = 2;
const OVERDUE_CHECK_INTERVAL_MS = 60 * 1000;
const WARNING_MIN_INTERVAL_MS = 60 * 60 * 1000;

class NotificationScheduler {
  constructor(store, notificationService, config) {
    if (!store) throw new Error('NotificationScheduler requires a store instance');
    if (!notificationService) throw new Error('NotificationScheduler requires a notificationService instance');
    this.store = store;
    this.notifier = notificationService;
    this.config = config || {};
    this.warningHoursBefore = this.config.WARNING_HOURS_BEFORE || WARNING_HOURS_BEFORE;
    this.checkInterval = this.config.CHECK_INTERVAL_MS || OVERDUE_CHECK_INTERVAL_MS;
    this.timer = null;
    this.lastWarningByPackage = new Map();
  }

  _toTimestamp(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    return Date.now();
  }

  start() {
    if (this.timer) return;
    console.log(`[Scheduler] 超时提醒定时任务已启动，检查间隔 ${this.checkInterval / 1000}s`);
    this.timer = setInterval(() => this._checkAndNotify(), this.checkInterval);
    this._checkAndNotify();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Scheduler] 定时任务已停止');
    }
  }

  async _checkAndNotify() {
    try {
      const overdueHours = this.config.OVERDUE_HOURS || 24;
      const now = Date.now();
      const packages = Array.from(this.store.packages.values())
        .filter(p => p.status === 'deposited');

      for (const pkg of packages) {
        const depositTs = this._toTimestamp(pkg.depositTime);
        const hoursElapsed = (now - depositTs) / (1000 * 60 * 60);
        const hoursLeft = overdueHours - hoursElapsed;

        if (hoursElapsed > overdueHours) {
          const lastNotified = this.lastWarningByPackage.get(pkg.id);
          if (!lastNotified || (now - lastNotified.time > WARNING_MIN_INTERVAL_MS)) {
            const fee = Math.min(Math.ceil(hoursElapsed - overdueHours) * (this.config.OVERDUE_FEE_PER_HOUR || 1), this.config.MAX_OVERDUE_FEE || 50);
            const notice = await this.notifier.sendOverdueNotice({ ...pkg, estimatedOverdueFee: fee });
            this.lastWarningByPackage.set(pkg.id, { type: NOTIFICATION_TYPES.OVERDUE, time: now });
            console.log(`[Scheduler] 已发送超时催取通知 → ${pkg.recipientPhone} 包裹${pkg.id}`);
          }
        } else if (hoursLeft <= this.warningHoursBefore && hoursLeft > 0) {
          const lastNotified = this.lastWarningByPackage.get(pkg.id);
          if (!lastNotified || lastNotified.type !== NOTIFICATION_TYPES.WARNING) {
            await this.notifier.sendWarningNotice(pkg, hoursLeft);
            this.lastWarningByPackage.set(pkg.id, { type: NOTIFICATION_TYPES.WARNING, time: now });
            console.log(`[Scheduler] 已发送临期提醒 → ${pkg.recipientPhone} 包裹${pkg.id} 剩余${hoursLeft.toFixed(1)}小时`);
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] 检查任务出错:', err.message);
    }
  }

  triggerManualReminder(packageId) {
    const pkg = this.store.packages.get(packageId);
    if (!pkg || pkg.status !== 'deposited') {
      return { success: false, error: '包裹不存在或已取走' };
    }
    return this.notifier.sendManualReminder(pkg).then(notice => ({
      success: true,
      data: notice
    }));
  }
}

module.exports = {
  NotificationScheduler,
  config: {
    WARNING_HOURS_BEFORE,
    OVERDUE_CHECK_INTERVAL_MS,
    WARNING_MIN_INTERVAL_MS
  }
};
