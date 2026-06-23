const packageModel = require('../models/Package');
const { getAllSizeOptions } = require('../utils');

class PackageService {
  ok(data, message = '') {
    return { success: true, httpStatus: 200, data, message };
  }
  fail(httpStatus, data, message) {
    return { success: false, httpStatus, data, message };
  }

  deposit(payload) {
    const { courierId, courierName, recipientPhone } = payload;

    if (!courierId || !courierName || !recipientPhone) {
      return this.fail(400, {
        required: ['courierId', 'courierName', 'recipientPhone'],
        optional: ['recipientName', 'packageSize', 'trackingNumber', 'remarks'],
        sizeOptions: getAllSizeOptions()
      }, '缺少必要参数：快递员ID、快递员姓名、收件人手机号');
    }

    const result = packageModel.create(payload);

    if (!result.success) {
      const statusCode = result.errorCode === 'NO_LOCKER_AVAILABLE' ? 503 : 400;
      return this.fail(
        statusCode,
        result.data || { errorCode: result.errorCode, sizeOptions: getAllSizeOptions() },
        result.message
      );
    }

    return this.ok(
      result.data,
      `投件成功！已分配${result.data.lockerSizeName}格口${result.data.lockerCode}，取件码：${result.data.pickupCode}`
    );
  }

  pickupByCode(pickupCode) {
    if (!pickupCode) {
      return this.fail(400, null, '请输入取件码');
    }

    const result = packageModel.pickupByCode(pickupCode);
    if (!result.success) {
      return this.fail(400, null, result.message);
    }

    const message = result.data.overtime.isOvertime
      ? `取件成功，超时${result.data.overtime.hours}小时，需支付滞留费${result.data.overtime.fee}元`
      : '取件成功';

    return this.ok(result.data, message);
  }

  pickupByPhone(recipientPhone) {
    if (!recipientPhone) {
      return this.fail(400, null, '请输入手机号');
    }

    const result = packageModel.pickupByPhone(recipientPhone);
    if (!result.success) {
      return this.fail(400, null, result.message);
    }

    const message = result.data.totalOvertimeFee > 0
      ? `成功取出${result.data.count}件包裹，超时费用共${result.data.totalOvertimeHours}小时，需支付滞留费${result.data.totalOvertimeFee}元`
      : `成功取出${result.data.count}件包裹`;

    return this.ok(result.data, message);
  }

  queryList({ status, recipientPhone, startTime, endTime }) {
    const filter = {};
    if (status) filter.status = status;
    if (recipientPhone) filter.recipientPhone = recipientPhone;
    if (startTime) filter.startTime = startTime;
    if (endTime) filter.endTime = endTime;

    const packages = packageModel.findAll(filter);
    return this.ok({ count: packages.length, packages });
  }

  getById(id) {
    const pkg = packageModel.findById(id);
    if (!pkg) return this.fail(404, null, '包裹不存在');
    return this.ok(pkg);
  }

  getByTrackingNumber(trackingNumber) {
    const pkg = packageModel.findByTrackingNumber(trackingNumber);
    if (!pkg) return this.fail(404, null, '包裹不存在');
    return this.ok(pkg);
  }

  getByPhone(recipientPhone) {
    const packages = packageModel.findByPhone(recipientPhone);
    return this.ok({ count: packages.length, packages });
  }
}

module.exports = new PackageService();
