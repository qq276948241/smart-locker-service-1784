const lockerModel = require('../models/Locker');
const { parseSize, getSizeName, VALID_SIZES, getAllSizeOptions } = require('../utils');

class LockerService {
  ok(data, message = '') {
    return { success: true, httpStatus: 200, data, message };
  }
  fail(httpStatus, data, message) {
    return { success: false, httpStatus, data, message };
  }

  getSizeOptions() {
    return this.ok({
      sizes: lockerModel.getSizeOptions(),
      validInputs: ['small/小/S', 'medium/中/M', 'large/大/L']
    });
  }

  queryList({ status, size }) {
    const filter = {};
    if (status) filter.status = status;

    if (size) {
      const normalized = parseSize(size);
      if (!normalized) {
        return this.fail(400, null, `尺寸参数无效，有效值为：${VALID_SIZES.join('、')}（或中文、首字母缩写）`);
      }
      filter.size = normalized;
    }

    const lockers = lockerModel.findAll(filter);
    const sizeInfo = size
      ? (parseSize(size) ? `${getSizeName(parseSize(size))}(${parseSize(size)})` : `invalid:${size}`)
      : 'all';

    return this.ok({
      count: lockers.length,
      filter: {
        status: status || 'all',
        size: sizeInfo
      },
      lockers
    });
  }

  getStats() {
    return this.ok(lockerModel.getStats());
  }

  getAvailableList(sizeQuery) {
    const normalized = sizeQuery ? parseSize(sizeQuery) : null;
    if (sizeQuery && !normalized) {
      return this.fail(400, null, '尺寸参数无效');
    }

    const available = lockerModel.findAllAvailable(normalized);
    return this.ok({
      size: normalized ? { key: normalized, name: getSizeName(normalized) } : 'all',
      count: available.length,
      lockers: available
    });
  }

  getAvailableCount() {
    const result = {};
    for (const s of VALID_SIZES) {
      result[s] = {
        name: getSizeName(s),
        count: lockerModel.countAvailable(s)
      };
    }
    return this.ok(result);
  }

  getById(id) {
    const locker = lockerModel.findById(id);
    if (!locker) return this.fail(404, null, '格口不存在');
    return this.ok(locker);
  }

  getByCode(code) {
    const locker = lockerModel.findByCode(code);
    if (!locker) return this.fail(404, null, '格口不存在');
    return this.ok(locker);
  }

  setMaintenance(id, maintenanceFlag) {
    const isMaintenance = maintenanceFlag !== undefined ? maintenanceFlag : true;
    const locker = lockerModel.setMaintenance(id, isMaintenance);
    if (!locker) return this.fail(404, null, '格口不存在');
    return this.ok(locker, `格口已${isMaintenance ? '设置为' : '取消'}维护状态`);
  }

  findOneAvailable(sizeParam) {
    const normalized = parseSize(sizeParam);
    if (!normalized) {
      return this.fail(400, null, `尺寸参数无效，有效值为：${VALID_SIZES.join('、')}`);
    }

    const locker = lockerModel.findAvailable(normalized);
    if (!locker) {
      const allAvailableCounts = VALID_SIZES.reduce((acc, s) => {
        acc[s] = { name: getSizeName(s), count: lockerModel.countAvailable(s) };
        return acc;
      }, {});
      return this.fail(404, {
        requestedSize: normalized,
        requestedSizeName: getSizeName(normalized),
        allAvailableCounts
      }, `${getSizeName(normalized)}(${normalized})没有可用格口`);
    }
    return this.ok(locker);
  }
}

module.exports = new LockerService();
