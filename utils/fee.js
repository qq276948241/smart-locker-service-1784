const { OVERTIME_HOURS, OVERTIME_FEE_PER_DAY } = require('../config');

function calculateOvertimeFee(storedAt) {
  const now = Date.now();
  const storedTime = new Date(storedAt).getTime();
  const diffMs = now - storedTime;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= OVERTIME_HOURS) {
    return { isOverdue: false, days: 0, fee: 0 };
  }

  const days = Math.ceil((diffHours - OVERTIME_HOURS) / 24);
  return { isOverdue: true, days, fee: days * OVERTIME_FEE_PER_DAY };
}

module.exports = {
  calculateOvertimeFee,
};
