const express = require('express');
const router = express.Router();
const locker = require('../models/Locker');
const parcel = require('../models/Parcel');

router.post('/store', (req, res, next) => {
  try {
    const {
      courierId,
      courierName,
      courierPhone,
      recipientName,
      recipientPhone,
      size,
      expressCompany,
      trackingNumber
    } = req.body;

    if (!['small', 'medium', 'large'].includes(size)) {
      return res.status(400).json({
        code: 400,
        message: '包裹尺寸必须是 small、medium 或 large',
        data: null
      });
    }

    if (!recipientPhone || !/^1[3-9]\d{9}$/.test(recipientPhone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的收件人手机号',
        data: null
      });
    }

    if (!courierId || !courierName) {
      return res.status(400).json({
        code: 400,
        message: '请提供快递员信息',
        data: null
      });
    }

    const availableLocker = locker.findAvailable(size);
    if (!availableLocker) {
      return res.status(409).json({
        code: 409,
        message: `没有可用的${size}格口`,
        data: null
      });
    }

    const newParcel = parcel.create({
      courierId,
      courierName,
      courierPhone,
      recipientName,
      recipientPhone,
      size,
      lockerId: availableLocker.id,
      lockerCode: availableLocker.code,
      expressCompany,
      trackingNumber
    });

    locker.occupy(availableLocker.id, newParcel.id);

    res.status(201).json({
      code: 0,
      message: '投件成功',
      data: {
        parcelId: newParcel.id,
        lockerCode: newParcel.lockerCode,
        pickupCode: newParcel.pickupCode,
        pickupDeadline: newParcel.pickupDeadline,
        size: newParcel.size
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pickup', (req, res, next) => {
  try {
    const { pickupCode, phone, parcelId, feePaid } = req.body;

    let targetParcel = null;

    if (pickupCode) {
      targetParcel = parcel.findByPickupCode(pickupCode);
      if (!targetParcel) {
        return res.status(404).json({
          code: 404,
          message: '取件码无效或包裹已被取走',
          data: null
        });
      }
    } else if (phone && parcelId) {
      const userParcels = parcel.findByPhone(phone);
      targetParcel = userParcels.find(p => p.id === parcelId);
      if (!targetParcel) {
        return res.status(404).json({
          code: 404,
          message: '未找到该手机号对应的包裹',
          data: null
        });
      }
    } else if (phone) {
      const userParcels = parcel.findByPhone(phone);
      if (userParcels.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '该手机号暂无待取包裹',
          data: null
        });
      }
      if (userParcels.length > 1) {
        return res.json({
          code: 1,
          message: '该手机号有多个待取包裹，请选择要取的包裹',
          data: userParcels.map(p => ({
            parcelId: p.id,
            lockerCode: p.lockerCode,
            size: p.size,
            expressCompany: p.expressCompany,
            storedAt: p.storedAt,
            overdueFee: parcel.calculateOverdueFee(p).fee
          }))
        });
      }
      targetParcel = userParcels[0];
    } else {
      return res.status(400).json({
        code: 400,
        message: '请提供取件码或手机号',
        data: null
      });
    }

    const overdueInfo = parcel.calculateOverdueFee(targetParcel);
    if (overdueInfo.isOverdue && !feePaid) {
      return res.status(402).json({
        code: 402,
        message: '包裹已超时，请先支付滞留费',
        data: {
          parcelId: targetParcel.id,
          lockerCode: targetParcel.lockerCode,
          overdueDays: overdueInfo.days,
          overdueFee: overdueInfo.fee,
          freeHours: 24,
          feePerDay: 1
        }
      });
    }

    const pickedParcel = parcel.pickup(targetParcel.id, feePaid !== false);
    locker.release(targetParcel.lockerId);

    res.json({
      code: 0,
      message: '取件成功',
      data: {
        parcelId: pickedParcel.id,
        lockerCode: pickedParcel.lockerCode,
        pickedUpAt: pickedParcel.pickedUpAt,
        isOverdue: pickedParcel.isOverdue,
        overdueDays: pickedParcel.overdueDays || 0,
        overdueFee: pickedParcel.overdueFee || 0,
        paid: pickedParcel.paid
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { status, recipientPhone, size } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (recipientPhone) filters.recipientPhone = recipientPhone;
    if (size) filters.size = size;

    const parcels = parcel.findAll(filters);
    res.json({
      code: 0,
      message: 'success',
      data: parcels
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const result = parcel.findById(id);
    if (!result) {
      return res.status(404).json({
        code: 404,
        message: '包裹不存在',
        data: null
      });
    }

    const overdueInfo = parcel.calculateOverdueFee(result);

    res.json({
      code: 0,
      message: 'success',
      data: {
        ...result,
        currentOverdue: overdueInfo
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
