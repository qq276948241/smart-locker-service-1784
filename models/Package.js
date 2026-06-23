const { v4: uuidv4 } = require('uuid');
const { generatePickupCode, calculateOvertimeFee, parseSize, getSizeName, SIZE_TYPES, getAllSizeOptions, getOvertimeFeeRate } = require('../utils');
const lockerModel = require('./Locker');
const config = require('../config');

class Package {
  constructor() {
    this.packages = [];
  }

  create(data) {
    const { courierId, courierName, recipientPhone, recipientName, packageSize, trackingNumber, remarks } = data;
    
    const normalizedSize = parseSize(packageSize);
    const size = normalizedSize || SIZE_TYPES.MEDIUM;
    const sizeName = getSizeName(size);
    
    if (packageSize && !normalizedSize) {
      const validOptions = getAllSizeOptions().map(o => `${o.key}/${o.name}/${o.alias}`).join('、');
      return {
        success: false,
        message: `包裹尺寸无效，有效值为：${validOptions}`,
        errorCode: 'INVALID_SIZE'
      };
    }

    const availableLocker = lockerModel.findAvailable(size);
    
    if (!availableLocker) {
      return {
        success: false,
        message: `${sizeName}(${size})没有可用格口，请稍后再试或更换其他尺寸`,
        errorCode: 'NO_LOCKER_AVAILABLE',
        data: {
          requestedSize: size,
          requestedSizeName: sizeName,
          availableBySize: lockerModel.getSizeOptions()
        }
      };
    }

    let pickupCode;
    do {
      pickupCode = generatePickupCode();
    } while (this.packages.some(p => p.pickupCode === pickupCode && p.status === 'deposited'));

    const now = new Date().toISOString();
    const pkg = {
      id: uuidv4(),
      trackingNumber: trackingNumber || uuidv4().substring(0, 12).toUpperCase(),
      lockerId: availableLocker.id,
      lockerCode: availableLocker.code,
      lockerSize: size,
      lockerSizeName: sizeName,
      courierId,
      courierName,
      recipientPhone,
      recipientName,
      pickupCode,
      status: 'deposited',
      isOvertime: false,
      depositTime: now,
      overtimeStartTime: null,
      lastScanTime: now,
      pickupTime: null,
      overtimeFee: 0,
      overtimeHours: 0,
      remarks: remarks || '',
      createdAt: now
    };

    this.packages.push(pkg);
    lockerModel.occupy(availableLocker.id, pkg.id);

    return {
      success: true,
      data: {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        lockerCode: pkg.lockerCode,
        lockerSize: pkg.lockerSize,
        lockerSizeName: pkg.lockerSizeName,
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

  findDeposited() {
    return this.packages.filter(p => p.status === 'deposited');
  }

  scanAndMarkOvertime() {
    const now = new Date();
    const freeHours = config.locker.freeHours;
    let newlyMarked = 0;
    let updated = 0;

    const deposited = this.findDeposited();
    for (const pkg of deposited) {
      const depositTime = new Date(pkg.depositTime);
      const diffHours = (now - depositTime) / (1000 * 60 * 60);

      if (diffHours > freeHours) {
        const overtimeHours = Math.ceil(diffHours - freeHours);
        const feePerHour = getOvertimeFeeRate(pkg.lockerSize);
        const overtimeFee = overtimeHours * feePerHour;
        const overtimeStart = new Date(depositTime.getTime() + freeHours * 60 * 60 * 1000).toISOString();

        if (!pkg.isOvertime) {
          pkg.isOvertime = true;
          pkg.overtimeStartTime = overtimeStart;
          newlyMarked++;
        }

        if (pkg.overtimeHours !== overtimeHours || pkg.overtimeFee !== overtimeFee) {
          pkg.overtimeHours = overtimeHours;
          pkg.overtimeFee = overtimeFee;
          updated++;
        }

        pkg.lastScanTime = now.toISOString();
      } else {
        pkg.lastScanTime = now.toISOString();
      }
    }

    return {
      scanned: deposited.length,
      newlyMarked,
      updated,
      totalOvertime: this.findDeposited().filter(p => p.isOvertime).length
    };
  }

  _completePickup(pkg) {
    let overtime;
    if (pkg.isOvertime && pkg.overtimeHours > 0) {
      overtime = {
        hours: pkg.overtimeHours,
        fee: pkg.overtimeFee,
        isOvertime: true,
        feePerHour: getOvertimeFeeRate(pkg.lockerSize)
      };
    } else {
      overtime = calculateOvertimeFee(pkg.depositTime, new Date(), pkg.lockerSize);
      pkg.overtimeFee = overtime.fee;
      pkg.overtimeHours = overtime.hours;
    }

    pkg.status = 'picked_up';
    pkg.pickupTime = new Date().toISOString();

    lockerModel.release(pkg.lockerId);

    return {
      id: pkg.id,
      trackingNumber: pkg.trackingNumber,
      lockerCode: pkg.lockerCode,
      lockerSize: pkg.lockerSize,
      lockerSizeName: pkg.lockerSizeName,
      pickupTime: pkg.pickupTime,
      overtime
    };
  }

  pickupByCode(pickupCode) {
    const pkg = this.findByPickupCode(pickupCode);
    if (!pkg) {
      return {
        success: false,
        message: '取件码无效或包裹已被取走'
      };
    }
    return {
      success: true,
      data: this._completePickup(pkg)
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

    const list = packages.map(pkg => {
      let overtime;
      if (pkg.isOvertime && pkg.overtimeHours > 0) {
        overtime = {
          hours: pkg.overtimeHours,
          fee: pkg.overtimeFee,
          isOvertime: true,
          feePerHour: getOvertimeFeeRate(pkg.lockerSize)
        };
      } else {
        overtime = calculateOvertimeFee(pkg.depositTime, new Date(), pkg.lockerSize);
      }
      return {
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        lockerCode: pkg.lockerCode,
        lockerSize: pkg.lockerSize,
        lockerSizeName: pkg.lockerSizeName,
        courierName: pkg.courierName,
        recipientName: pkg.recipientName,
        depositTime: pkg.depositTime,
        feePerHour: overtime.feePerHour,
        overtime: {
          hours: overtime.hours,
          fee: overtime.fee,
          isOvertime: overtime.isOvertime
        }
      };
    });

    const totalFee = list.reduce((sum, r) => sum + r.overtime.fee, 0);
    const totalOvertimeHours = list.reduce((sum, r) => sum + r.overtime.hours, 0);
    const overtimeCount = list.filter(r => r.overtime.isOvertime).length;

    if (packages.length === 1) {
      const onlyPkg = packages[0];
      const completed = this._completePickup(onlyPkg);
      return {
        success: true,
        data: {
          mode: 'single_auto',
          count: 1,
          packages: [completed],
          totalOvertimeFee: completed.overtime.fee,
          totalOvertimeHours: completed.overtime.hours
        }
      };
    }

    return {
      success: true,
      data: {
        mode: 'multi_select',
        count: list.length,
        packages: list,
        overtimeCount,
        totalOvertimeFee: totalFee,
        totalOvertimeHours
      }
    };
  }

  pickupById(packageId) {
    const pkg = this.findById(packageId);
    if (!pkg) {
      return {
        success: false,
        errorCode: 'NOT_FOUND',
        message: '包裹不存在'
      };
    }
    if (pkg.status !== 'deposited') {
      return {
        success: false,
        errorCode: 'ALREADY_PICKED',
        message: '包裹已被取走'
      };
    }
    return {
      success: true,
      data: this._completePickup(pkg)
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
      small: {
        key: SIZE_TYPES.SMALL,
        name: getSizeName(SIZE_TYPES.SMALL),
        count: deposited.filter(p => p.lockerSize === SIZE_TYPES.SMALL).length
      },
      medium: {
        key: SIZE_TYPES.MEDIUM,
        name: getSizeName(SIZE_TYPES.MEDIUM),
        count: deposited.filter(p => p.lockerSize === SIZE_TYPES.MEDIUM).length
      },
      large: {
        key: SIZE_TYPES.LARGE,
        name: getSizeName(SIZE_TYPES.LARGE),
        count: deposited.filter(p => p.lockerSize === SIZE_TYPES.LARGE).length
      }
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
