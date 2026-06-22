module.exports = {
  port: process.env.PORT || 3000,
  locker: {
    totalLockers: 20,
    smallSize: { count: 8, name: 'small' },
    mediumSize: { count: 8, name: 'medium' },
    largeSize: { count: 4, name: 'large' }
  },
  pickup: {
    freeHours: 24,
    overdueFeePerDay: 1,
    maxOverdueDays: 7
  },
  pickupCode: {
    length: 6
  }
};
