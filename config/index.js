module.exports = {
  port: process.env.PORT || 3000,
  locker: {
    smallCount: 10,
    mediumCount: 10,
    largeCount: 5,
    freeHours: 24,
    overtimeFeePerHour: {
      small: 1,
      medium: 2,
      large: 3
    }
  },
  pickupCode: {
    length: 6,
    expiresInHours: 72
  },
  scheduler: {
    scanIntervalMinutes: 5
  }
};
