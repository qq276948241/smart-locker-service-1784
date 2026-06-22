const express = require('express');
const router = express.Router();
const { isValidPhone } = require('../utils/common');
const models = require('../models');
const { courierAuth } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ code: 400, message: '姓名、手机号、密码均为必填' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ code: 400, message: '手机号格式不正确' });
  }
  if (password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码长度至少6位' });
  }

  const courier = models.courier.registerCourier({ name, phone, password });
  if (!courier) {
    return res.status(409).json({ code: 409, message: '该手机号已注册' });
  }

  res.status(201).json({
    code: 0,
    message: '注册成功',
    data: { name, phone },
  });
});

router.post('/login', (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ code: 400, message: '手机号和密码必填' });
  }

  const result = models.courier.loginCourier({ phone, password });
  if (!result) {
    return res.status(401).json({ code: 401, message: '手机号或密码错误' });
  }

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token: result.token,
      name: result.courier.name,
      phone: result.courier.phone,
    },
  });
});

router.post('/logout', courierAuth, (req, res) => {
  models.courier.logoutCourier(req.courier.token);
  res.json({ code: 0, message: '退出登录成功' });
});

router.get('/profile', courierAuth, (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      name: req.courier.name,
      phone: req.courier.phone,
      registeredAt: req.courier.registeredAt,
    },
  });
});

module.exports = router;
