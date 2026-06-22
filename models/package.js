const { generatePickupCode, generateId } = require('../utils/common');
const { calculateOvertimeFee } = require('../utils/fee');

const packages = {};

function isPickupCodeExists(code) {
  return Object.values(packages).some((p) => p.pickupCode === code);
}

function createUniquePickupCode() {
  let code;
  let attempts = 0;
  do {
    code = generatePickupCode();
    attempts++;
  } while (isPickupCodeExists(code) && attempts < 100);
  return code;
}

function createPackage(data) {
  const { trackingNumber, courierName, courierPhone, recipientName, recipientPhone, dimensions, lockerId, lockerSize } = data;

  const packageId = generateId('PKG');
  const pickupCode = createUniquePickupCode();
  const now = new Date().toISOString();

  const pkg = {
    id: packageId,
    trackingNumber: trackingNumber || 'NO-TRACKING-' + Date.now(),
    courierName,
    courierPhone,
    recipientName,
    recipientPhone,
    dimensions,
    lockerId,
    lockerSize,
    pickupCode,
    storedAt: now,
    pickedAt: null,
    status: 'stored',
    overtimeFee: 0,
    remindedAt: null,
  };

  packages[packageId] = pkg;
  return pkg;
}

function findStoredPackage(pickupCode, recipientPhone) {
  if (pickupCode) {
    return Object.values(packages).find((p) => p.pickupCode === pickupCode && p.status === 'stored');
  }
  if (recipientPhone) {
    return Object.values(packages).find((p) => p.recipientPhone === recipientPhone && p.status === 'stored');
  }
  return null;
}

function queryPackage({ pickupCode, recipientPhone, packageId }) {
  if (packageId) return packages[packageId];
  if (pickupCode) return Object.values(packages).find((p) => p.pickupCode === pickupCode);
  if (recipientPhone) return Object.values(packages).find((p) => p.recipientPhone === recipientPhone && p.status === 'stored');
  return null;
}

function markAsPicked(packageId) {
  const pkg = packages[packageId];
  if (!pkg) return null;

  const overtime = calculateOvertimeFee(pkg.storedAt);
  const now = new Date().toISOString();

  pkg.pickedAt = now;
  pkg.status = 'picked';
  pkg.overtimeFee = overtime.fee;

  return { pkg, overtime, now };
}

function getStoredPackages() {
  return Object.values(packages).filter((p) => p.status === 'stored');
}

function updateRemindedAt(packageId) {
  if (packages[packageId]) {
    packages[packageId].remindedAt = new Date().toISOString();
  }
}

module.exports = {
  createPackage,
  findStoredPackage,
  queryPackage,
  markAsPicked,
  getStoredPackages,
  updateRemindedAt,
};
