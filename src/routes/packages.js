const express = require('express');
const { config } = require('../store');

function createPackageRoutes(packageService) {
  const router = express.Router();

  router.post('/deposit', (req, res) => {
    const { courierId, courierName, recipientPhone, packageSize } = req.body;

    if (!courierId || !courierName || !recipientPhone || !packageSize) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: courierId, courierName, recipientPhone, packageSize'
      });
    }

    if (!config.LOCKER_SIZES.includes(packageSize)) {
      return res.status(400).json({
        success: false,
        error: `packageSize 必须是以下之一: ${config.LOCKER_SIZES.join(', ')}`
      });
    }

    if (!/^1\d{10}$/.test(recipientPhone)) {
      return res.status(400).json({
        success: false,
        error: '手机号格式不正确'
      });
    }

    const result = packageService.deposit({ courierId, courierName, recipientPhone, packageSize });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.post('/pickup-by-code', (req, res) => {
    const { pickupCode } = req.body;
    if (!pickupCode) {
      return res.status(400).json({ success: false, error: '缺少 pickupCode' });
    }
    const result = packageService.pickupByCode(pickupCode.toString());
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.post('/pickup-by-phone', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: '缺少 phone' });
    }
    const result = packageService.pickupByPhone(phone.toString());
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.get('/overdue', (req, res) => {
    res.json({ success: true, data: packageService.getOverduePackages() });
  });

  return router;
}

module.exports = createPackageRoutes;
