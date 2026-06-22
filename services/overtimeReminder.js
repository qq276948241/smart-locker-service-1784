const { OVERTIME_HOURS, REMIND_CHECK_INTERVAL_MS } = require('../config');
const models = require('../models');
const notifyService = require('../services/notify');

function startOvertimeReminder() {
  setInterval(() => {
    const now = Date.now();
    const remindBeforeMs = (OVERTIME_HOURS - 2) * 60 * 60 * 1000;

    models.package.getStoredPackages().forEach((pkg) => {
      const storedTime = new Date(pkg.storedAt).getTime();
      const elapsedMs = now - storedTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= OVERTIME_HOURS - 2 && elapsedHours < OVERTIME_HOURS && !pkg.remindedAt) {
        models.package.updateRemindedAt(pkg.id);
        notifyService.sendOvertimeRemindNotify(pkg.recipientPhone, pkg.recipientName, pkg.lockerId, Math.floor(elapsedHours));
      }
    });
  }, REMIND_CHECK_INTERVAL_MS);

  console.log(`  [定时任务] 超时催取提醒已启动，每${REMIND_CHECK_INTERVAL_MS / 60000}分钟检查一次`);
}

module.exports = {
  startOvertimeReminder,
};
