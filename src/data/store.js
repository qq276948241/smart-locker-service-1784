const { v4: uuidv4 } = require('uuid');
const { sendOverdueNotification } = require('../utils/notification');

const LOCKER_TYPES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
};

const LOCKER_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance'
};

const PACKAGE_STATUS = {
  DEPOSITED: 'deposited',
  PICKED_UP: 'picked_up',
  OVERDUE: 'overdue'
};

const FREE_HOURS = 24;
const OVERDUE_FEE_PER_DAY = 2;

const lockers = [];
const packages = [];

function initLockers() {
  const smallCount = 10;
  const mediumCount = 8;
  const largeCount = 5;
  let id = 1;

  for (let i = 0; i < smallCount; i++) {
    lockers.push({
      id: `S${String(id++).padStart(3, '0')}`,
      type: LOCKER_TYPES.SMALL,
      status: LOCKER_STATUS.AVAILABLE,
      packageId: null
    });
  }
  for (let i = 0; i < mediumCount; i++) {
    lockers.push({
      id: `M${String(id++).padStart(3, '0')}`,
      type: LOCKER_TYPES.MEDIUM,
      status: LOCKER_STATUS.AVAILABLE,
      packageId: null
    });
  }
  for (let i = 0; i < largeCount; i++) {
    lockers.push({
      id: `L${String(id++).padStart(3, '0')}`,
      type: LOCKER_TYPES.LARGE,
      status: LOCKER_STATUS.AVAILABLE,
      packageId: null
    });
  }
}

function getAllLockers() {
  return lockers;
}

function getLockerById(id) {
  return lockers.find(l => l.id === id);
}

function getLockersByStatus(status) {
  return lockers.filter(l => l.status === status);
}

function getLockersByType(type) {
  return lockers.filter(l => l.type === type);
}

function getAvailableLocker(type) {
  const available = lockers.filter(
    l => l.status === LOCKER_STATUS.AVAILABLE && (!type || l.type === type)
  );
  return available.length > 0 ? available[0] : null;
}

function updateLockerStatus(id, status, packageId = null) {
  const locker = getLockerById(id);
  if (locker) {
    locker.status = status;
    locker.packageId = packageId;
  }
  return locker;
}

function setLockerMaintenance(id, isMaintenance) {
  const locker = getLockerById(id);
  if (locker) {
    if (isMaintenance && locker.status === LOCKER_STATUS.AVAILABLE) {
      locker.status = LOCKER_STATUS.MAINTENANCE;
    } else if (!isMaintenance && locker.status === LOCKER_STATUS.MAINTENANCE) {
      locker.status = LOCKER_STATUS.AVAILABLE;
    }
  }
  return locker;
}

function addPackage(pkg) {
  const newPkg = {
    id: uuidv4(),
    ...pkg,
    status: PACKAGE_STATUS.DEPOSITED,
    depositedAt: new Date(),
    pickedUpAt: null,
    overdueFee: 0
  };
  packages.push(newPkg);
  return newPkg;
}

function getPackageById(id) {
  return packages.find(p => p.id === id);
}

function getPackageByPickupCode(code) {
  return packages.find(p => p.pickupCode === code && p.status !== PACKAGE_STATUS.PICKED_UP);
}

function getPackagesByPhone(phone) {
  return packages.filter(p => p.recipientPhone === phone && p.status !== PACKAGE_STATUS.PICKED_UP);
}

function getAllPackages() {
  return packages;
}

function updatePackageStatus(id, status) {
  const pkg = getPackageById(id);
  if (pkg) {
    pkg.status = status;
    if (status === PACKAGE_STATUS.PICKED_UP) {
      pkg.pickedUpAt = new Date();
    }
  }
  return pkg;
}

function calculateOverdueFee(pkg) {
  const now = new Date();
  const depositedAt = new Date(pkg.depositedAt);
  const diffMs = now - depositedAt;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= FREE_HOURS) {
    return 0;
  }

  const overdueHours = diffHours - FREE_HOURS;
  const overdueDays = Math.ceil(overdueHours / 24);
  return overdueDays * OVERDUE_FEE_PER_DAY;
}

function getPackagesByTimeRange(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return packages.filter(p => {
    const depositedAt = new Date(p.depositedAt);
    return depositedAt >= start && depositedAt <= end;
  });
}

let checkInterval = null;
let isCheckRunning = false;
const notifiedPackages = new Set();

function getOverdueHours(pkg) {
  const now = new Date();
  const depositedAt = new Date(pkg.depositedAt);
  const diffMs = now - depositedAt;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > FREE_HOURS ? Math.floor(diffHours - FREE_HOURS) : 0;
}

async function checkOverduePackages() {
  if (isCheckRunning) return;
  isCheckRunning = true;

  const now = new Date();
  const results = {
    scanned: 0,
    markedOverdue: 0,
    notified: 0,
    errors: 0
  };

  try {
    for (const pkg of packages) {
      if (pkg.status === PACKAGE_STATUS.PICKED_UP) continue;

      results.scanned++;

      const overdueFee = calculateOverdueFee(pkg);
      if (overdueFee > 0) {
        if (pkg.status !== PACKAGE_STATUS.OVERDUE) {
          pkg.status = PACKAGE_STATUS.OVERDUE;
          pkg.overdueFee = overdueFee;
          pkg.markedOverdueAt = now;
          results.markedOverdue++;
          console.log(`[定时检查] 包裹 ${pkg.id} 已标记为超时，滞留费: ¥${overdueFee}`);
        }

        const overdueHours = getOverdueHours(pkg);
        const notifyKey = `${pkg.id}-${Math.floor(overdueHours / 24)}`;
        if (!notifiedPackages.has(notifyKey)) {
          try {
            await sendOverdueNotification(
              pkg.recipientPhone,
              pkg.pickupCode,
              pkg.lockerId,
              overdueFee,
              overdueHours
            );
            notifiedPackages.add(notifyKey);
            results.notified++;
          } catch (err) {
            results.errors++;
            console.error(`[定时检查] 发送超时通知失败，包裹 ${pkg.id}:`, err.message);
          }
        }
      }
    }

    if (results.scanned > 0) {
      console.log(
        `[定时检查] 完成: 扫描${results.scanned}个, ` +
        `标记超时${results.markedOverdue}个, ` +
        `发送通知${results.notified}个, ` +
        `失败${results.errors}个`
      );
    }
  } catch (err) {
    console.error('[定时检查] 执行出错:', err);
  } finally {
    isCheckRunning = false;
  }

  return results;
}

function startOverdueChecker(intervalMinutes = 5) {
  if (checkInterval) {
    console.log('[定时检查] 任务已在运行中');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  checkInterval = setInterval(() => {
    checkOverduePackages();
  }, intervalMs);

  console.log(`[定时检查] 任务已启动，间隔 ${intervalMinutes} 分钟`);

  setTimeout(() => {
    checkOverduePackages();
  }, 2000);
}

function stopOverdueChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[定时检查] 任务已停止');
  }
}

function getOverdueCheckerStatus() {
  return {
    running: checkInterval !== null,
    isCheckRunning,
    notifiedCount: notifiedPackages.size
  };
}

initLockers();

module.exports = {
  LOCKER_TYPES,
  LOCKER_STATUS,
  PACKAGE_STATUS,
  FREE_HOURS,
  OVERDUE_FEE_PER_DAY,
  getAllLockers,
  getLockerById,
  getLockersByStatus,
  getLockersByType,
  getAvailableLocker,
  updateLockerStatus,
  setLockerMaintenance,
  addPackage,
  getPackageById,
  getPackageByPickupCode,
  getPackagesByPhone,
  getAllPackages,
  updatePackageStatus,
  calculateOverdueFee,
  getPackagesByTimeRange,
  getOverdueHours,
  checkOverduePackages,
  startOverdueChecker,
  stopOverdueChecker,
  getOverdueCheckerStatus
};
