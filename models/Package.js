const { v4: uuidv4 } = require('uuid');
const { generatePickupCode, calculateOvertimeFee } = require('../utils');
const lockerModel = require('./Locker');
const config = require('../config');

class Package {
  constructor() {
    this.packages = [];
  }

  create(data) {
    const { courierId, courierName, recipientPhone, recipientName, packageSize, trackingNumber, remarks } = data;
    
    const size = packageSize || 'medium';
    const availableLocker = lockerModel.findAvailable(size);
    
    if (!availableLocker) {
      return {
        success: false,
        message: `没有可用的${size}格口`
      };
    }

    let pickupCode;
    do {
      pickupCode = generatePickupCode();
    } while (this.packages.some(p => p.pickupCode === pickupCode && p.status === 'deposited'));

    const pkg = {
      id: uuidv4(),
      trackingNumber: trackingNumber || uuidv4().substring(0, 12).toUpperCase(),
      lockerId: availableLocker.id,
      lockerCode: availableLocker.code,
      lockerSize: size,
      courierId,
      courierName,
      recipientPhone,
      recipientName,
      pickupCode,
      status: 'deposited',
      depositTime: new Date().toISOString(),
      pickupTime: null,
      overtimeFee: 0,
      overtimeHours: 0,
      remarks: remarks || '',
      createdAt: new Date().toISOString()
    };

    this.packages.push(pkg);
    lockerModel.occupy(availableLocker.id, pkg.id);

    return {
      success: true,
      data: {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        lockerCode: pkg.lockerCode,
        pickupCode: pkg.pickupCode,
        depositTime: pkg.depositTime,
        expiresAt: new Date(Date.now() + config.pickupCode.expiresInHours * 60 * 60 * 1000).toISOString()
      }
    };
  }

  findByPickupCode(pickupCode) {
    return this.packages.find(p => p.pickupCode === pickupCode && p.status === 'deposited');
  }

  findByPhone(recipientPhone) {
    return this.packages.filter(p => p.recipientPhone === recipientPhone && p.status === 'deposited');
  }

  findById(id) {
    return this.packages.find(p => p.id === id);
  }

  findByTrackingNumber(trackingNumber) {
    return this.packages.find(p => p.trackingNumber === trackingNumber);
  }

  findAll(filter = {}) {
    let result = [...this.packages];
    
    if (filter.status) {
      result = result.filter(p => p.status === filter.status);
    }
    if (filter.recipientPhone) {
      result = result.filter(p => p.recipientPhone === filter.recipientPhone);
    }
    if (filter.startTime) {
      result = result.filter(p => new Date(p.depositTime) >= new Date(filter.startTime));
    }
    if (filter.endTime) {
      result = result.filter(p => new Date(p.depositTime) <= new Date(filter.endTime));
    }
    
    return result.sort((a, b) => new Date(b.depositTime) - new Date(a.depositTime));
  }

  pickupByCode(pickupCode) {
    const pkg = this.findByPickupCode(pickupCode);
    if (!pkg) {
      return {
        success: false,
        message: '取件码无效或包裹已被取走'
      };
    }

    const overtime = calculateOvertimeFee(pkg.depositTime);
    
    pkg.status = 'picked_up';
    pkg.pickupTime = new Date().toISOString();
    pkg.overtimeFee = overtime.fee;
    pkg.overtimeHours = overtime.hours;

    lockerModel.release(pkg.lockerId);

    return {
      success: true,
      data: {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        lockerCode: pkg.lockerCode,
        pickupTime: pkg.pickupTime,
        overtime: overtime
      }
    };
  }

  pickupByPhone(recipientPhone) {
    const packages = this.findByPhone(recipientPhone);
    if (packages.length === 0) {
      return {
        success: false,
        message: '该手机号下没有待取包裹'
      };
    }

    const results = packages.map(pkg => {
      const overtime = calculateOvertimeFee(pkg.depositTime);
      
      pkg.status = 'picked_up';
      pkg.pickupTime = new Date().toISOString();
      pkg.overtimeFee = overtime.fee;
      pkg.overtimeHours = overtime.hours;

      lockerModel.release(pkg.lockerId);

      return {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        lockerCode: pkg.lockerCode,
        pickupTime: pkg.pickupTime,
        overtime: overtime
      };
    });

    const totalFee = results.reduce((sum, r) => sum + r.overtime.fee, 0);
    const totalOvertimeHours = results.reduce((sum, r) => sum + r.overtime.hours, 0);

    return {
      success: true,
      data: {
        count: results.length,
        packages: results,
        totalOvertimeFee: totalFee,
        totalOvertimeHours
      }
    };
  }

  getStatistics(startTime, endTime) {
    const filtered = this.findAll({ startTime, endTime });
    
    const deposited = filtered.filter(p => p.status === 'deposited' || p.status === 'picked_up');
    const pickedUp = filtered.filter(p => p.status === 'picked_up');
    const withOvertime = filtered.filter(p => p.overtimeFee > 0);
    
    const totalOvertimeFee = withOvertime.reduce((sum, p) => sum + p.overtimeFee, 0);
    const totalOvertimeHours = withOvertime.reduce((sum, p) => sum + p.overtimeHours, 0);

    const bySize = {
      small: deposited.filter(p => p.lockerSize === 'small').length,
      medium: deposited.filter(p => p.lockerSize === 'medium').length,
      large: deposited.filter(p => p.lockerSize === 'large').length
    };

    const byDate = {};
    deposited.forEach(p => {
      const date = new Date(p.depositTime).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { deposited: 0, pickedUp: 0 };
      }
      byDate[date].deposited++;
      if (p.status === 'picked_up') {
        byDate[date].pickedUp++;
      }
    });

    return {
      period: { startTime, endTime },
      totalDeposited: deposited.length,
      totalPickedUp: pickedUp.length,
      totalPending: deposited.length - pickedUp.length,
      totalOvertime: withOvertime.length,
      totalOvertimeFee,
      totalOvertimeHours,
      bySize,
      byDate
    };
  }
}

module.exports = new Package();
