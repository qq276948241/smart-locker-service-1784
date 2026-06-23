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

    const data = result.data;
    if (data.mode === 'single_auto') {
      const single = data.packages[0];
      const message = single.overtime.isOvertime
        ? `取件成功，${single.lockerSizeName}${single.lockerCode}超时${single.overtime.hours}小时，需支付滞留费${single.overtime.fee}元（${single.overtime.feePerHour}元/小时）`
        : '取件成功';
      return this.ok(data, message);
    }

    const tip = data.overtimeCount > 0
      ? `其中${data.overtimeCount}件已超时，累计滞留费${data.totalOvertimeFee}元`
      : '暂无超时包裹';
    const message = `该手机号下有${data.count}件待取包裹，请选择要取哪一件：${tip}；请选择其中一个包裹ID调用 POST /api/packages/:id/pickup 接口取件`;
    return this.fail(300, data, message);
  }

  pickupById(packageId) {
    if (!packageId) {
      return this.fail(400, null, '缺少包裹ID');
    }

    const result = packageModel.pickupById(packageId);
    if (!result.success) {
      const statusCode = result.errorCode === 'NOT_FOUND' ? 404 : 400;
      return this.fail(statusCode, null, result.message);
    }

    const pkg = result.data;
    const message = pkg.overtime.isOvertime
      ? `取件成功，${pkg.lockerSizeName}${pkg.lockerCode}超时${pkg.overtime.hours}小时，需支付滞留费${pkg.overtime.fee}元（${pkg.overtime.feePerHour}元/小时）`
      : '取件成功';
    return this.ok(pkg, message);
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
