module.exports = {
  port: process.env.PORT || 3000,
  locker: {
    smallCount: 10,
    mediumCount: 10,
    largeCount: 5,
    freeHours: 24,
    overtimeFeePerHour: 1
  },
  pickupCode: {
    length: 6,
    expiresInHours: 72
  },
  scheduler: {
    scanIntervalMinutes: 5
  }
};
