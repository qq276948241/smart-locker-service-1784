const models = require('../models');

function courierAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌，请先登录' });
  }

  const token = authHeader.substring(7);
  const result = models.courier.validateToken(token);

  if (!result) {
    return res.status(401).json({ code: 401, message: '无效的认证令牌或已过期，请重新登录' });
  }

  req.courier = result.courier;
  req.courier.token = result.token;
  next();
}

module.exports = {
  courierAuth,
};
