const NOTIFICATION_TYPES = {
  DEPOSIT: 'deposit',
  WARNING: 'warning',
  OVERDUE: 'overdue',
  MANUAL: 'manual_reminder'
};

const CHANNELS = {
  SMS: 'sms',
  APP: 'app_push'
};

class NotificationService {
  constructor(config) {
    this.notifications = [];
    this.config = config || {};
    this.enableConsole = this.config.enableConsole !== false;
  }

  _toTimestamp(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const t = new Date(val).getTime();
      return isNaN(t) ? Date.now() : t;
    }
    return Date.now();
  }

  _buildMessage(type, pkg) {
    const sizeMap = { small: '小', medium: '中', large: '大' };
    const sizeLabel = sizeMap[pkg.packageSize] || pkg.packageSize;

    switch (type) {
      case NOTIFICATION_TYPES.DEPOSIT:
        return `【智能快递柜】您的${sizeLabel}号包裹已放入${pkg.lockerId}号柜，取件码：${pkg.pickupCode}，请在24小时内免费取件。超时每小时收${this.config.OVERDUE_FEE_PER_HOUR || 1}元，封顶${this.config.MAX_OVERDUE_FEE || 50}元。`;

      case NOTIFICATION_TYPES.WARNING:
        const hoursLeft = (pkg.hoursLeft !== undefined) ? Number(pkg.hoursLeft).toFixed(1) : '即将';
        return `【智能快递柜】温馨提醒：您的${sizeLabel}号包裹在${pkg.lockerId}号柜还有${hoursLeft}小时即将超时，请尽快取件，取件码：${pkg.pickupCode}。`;

      case NOTIFICATION_TYPES.OVERDUE:
        return `【智能快递柜】您的${sizeLabel}号包裹在${pkg.lockerId}号柜已超时，取件码：${pkg.pickupCode}，目前滞留费已产生${pkg.estimatedOverdueFee || 0}元，请尽快取件。`;

      case NOTIFICATION_TYPES.MANUAL:
        return `【智能快递柜】管理员提醒：请尽快取走您的${sizeLabel}号柜${pkg.lockerId}号包裹，取件码：${pkg.pickupCode}。`;

      default:
        return '';
    }
  }

  _sendSMS(phone, message) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.enableConsole) {
          console.log(`[SMS → ${phone}] ${message}`);
        }
        resolve({ success: true, channel: CHANNELS.SMS });
      }, 50);
    });
  }

  async send(type, pkg, extra = {}) {
    const now = Date.now();
    const message = this._buildMessage(type, { ...pkg, ...extra });
    const result = await this._sendSMS(pkg.recipientPhone, message);

    const notification = {
      id: `N${now}${Math.floor(Math.random() * 1000)}`,
      packageId: pkg.id || pkg.packageId,
      recipientPhone: pkg.recipientPhone,
      type,
      channel: result.channel,
      message,
      timestamp: now,
      success: result.success
    };
    this.notifications.push(notification);

    return notification;
  }

  async sendDepositNotice(pkg) {
    return this.send(NOTIFICATION_TYPES.DEPOSIT, pkg);
  }

  async sendWarningNotice(pkg, hoursLeft) {
    return this.send(NOTIFICATION_TYPES.WARNING, pkg, { hoursLeft });
  }

  async sendOverdueNotice(pkg) {
    return this.send(NOTIFICATION_TYPES.OVERDUE, pkg);
  }

  async sendManualReminder(pkg) {
    return this.send(NOTIFICATION_TYPES.MANUAL, pkg);
  }

  queryNotifications({ packageId, phone, type, startTime, endTime } = {}) {
    const start = startTime ? this._toTimestamp(startTime) : 0;
    const end = endTime ? this._toTimestamp(endTime) : Date.now();
    return this.notifications
      .filter(n => {
        if (packageId && n.packageId !== packageId) return false;
        if (phone && n.recipientPhone !== phone) return false;
        if (type && n.type !== type) return false;
        const ts = this._toTimestamp(n.timestamp);
        return ts >= start && ts <= end;
      })
      .sort((a, b) => this._toTimestamp(b.timestamp) - this._toTimestamp(a.timestamp))
      .map(n => ({ ...n, timestamp: new Date(this._toTimestamp(n.timestamp)).toISOString() }));
  }

  getNotificationStats({ startTime, endTime } = {}) {
    const list = this.queryNotifications({ startTime, endTime });
    const stats = {
      total: list.length,
      byType: {},
      byDate: {}
    };
    for (const n of list) {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      const date = n.timestamp.slice(0, 10);
      if (!stats.byDate[date]) stats.byDate[date] = { total: 0 };
      stats.byDate[date].total++;
    }
    return stats;
  }
}

module.exports = {
  NotificationService,
  NOTIFICATION_TYPES,
  CHANNELS
};
