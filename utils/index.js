const moment = require('moment');
const config = require('../config');

function generatePickupCode(length = config.pickupCode.length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

function calculateOvertimeFee(depositTime, pickupTime = new Date()) {
  const depositMoment = moment(depositTime);
  const pickupMoment = moment(pickupTime);
  const diffHours = pickupMoment.diff(depositMoment, 'hours', true);
  const freeHours = config.locker.freeHours;
  
  if (diffHours <= freeHours) {
    return {
      hours: 0,
      fee: 0,
      isOvertime: false
    };
  }
  
  const overtimeHours = Math.ceil(diffHours - freeHours);
  return {
    hours: overtimeHours,
    fee: overtimeHours * config.locker.overtimeFeePerHour,
    isOvertime: true
  };
}

function getSizeType(packageSize) {
  const sizeMap = {
    'small': 'small',
    'medium': 'medium',
    'large': 'large',
    'S': 'small',
    'M': 'medium',
    'L': 'large'
  };
  return sizeMap[packageSize] || 'medium';
}

function formatResponse(success, data = null, message = '') {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  generatePickupCode,
  calculateOvertimeFee,
  getSizeType,
  formatResponse
};
