const { LOCKER_CONFIG } = require('../config');

const lockers = {};

function initLockers() {
  Object.keys(LOCKER_CONFIG).forEach((size) => {
    for (let i = 1; i <= LOCKER_CONFIG[size].count; i++) {
      const id = `${size.toUpperCase()}-${String(i).padStart(2, '0')}`;
      lockers[id] = {
        id,
        size,
        status: 'available',
        packageId: null,
        heightLimit: LOCKER_CONFIG[size].heightLimit,
        widthLimit: LOCKER_CONFIG[size].widthLimit,
        depthLimit: LOCKER_CONFIG[size].depthLimit,
      };
    }
  });
}

function getAllLockers({ size, status } = {}) {
  let result = Object.values(lockers);
  if (size) result = result.filter((l) => l.size === size.toLowerCase());
  if (status) result = result.filter((l) => l.status === status.toLowerCase());
  return result;
}

function getLockerById(id) {
  return lockers[id ? id.toUpperCase() : id];
}

function updateLockerStatus(id, status) {
  const locker = getLockerById(id);
  if (!locker) return null;
  locker.status = status.toLowerCase();
  return locker;
}

function assignPackage(lockerId, packageId) {
  const locker = getLockerById(lockerId);
  if (!locker) return null;
  locker.status = 'occupied';
  locker.packageId = packageId;
  return locker;
}

function releaseLocker(lockerId) {
  const locker = getLockerById(lockerId);
  if (!locker) return null;
  locker.status = 'available';
  locker.packageId = null;
  return locker;
}

function findAvailableLocker(size) {
  return Object.values(lockers).find((l) => l.size === size && l.status === 'available');
}

function getLockerSummary() {
  const all = Object.values(lockers);
  return {
    total: all.length,
    available: all.filter((l) => l.status === 'available').length,
    occupied: all.filter((l) => l.status === 'occupied').length,
    outOfService: all.filter((l) => l.status === 'out_of_service').length,
  };
}

module.exports = {
  initLockers,
  getAllLockers,
  getLockerById,
  updateLockerStatus,
  assignPackage,
  releaseLocker,
  findAvailableLocker,
  getLockerSummary,
};
