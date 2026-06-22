module.exports = {
  PORT: 3003,

  LOCKER_CONFIG: {
    small: { count: 10, heightLimit: 30, widthLimit: 30, depthLimit: 30 },
    medium: { count: 10, heightLimit: 50, widthLimit: 50, depthLimit: 50 },
    large: { count: 5, heightLimit: 80, widthLimit: 80, depthLimit: 80 },
  },

  OVERTIME_HOURS: 24,
  OVERTIME_FEE_PER_DAY: 2,
  TOKEN_EXPIRE_MS: 24 * 60 * 60 * 1000,
  REMIND_CHECK_INTERVAL_MS: 60 * 60 * 1000,
  REMIND_BEFORE_HOURS: 2,

  MACHINE_LOCATION: '北京市朝阳区建国路88号智柜驿站',

  VALID_STATUSES: ['available', 'occupied', 'out_of_service'],
};
