const crypto = require('crypto');

const MACHINE_LOCATION = '北京市朝阳区建国路88号智柜驿站';

const notifyLog = [];

function generateMessageId() {
  return 'MSG' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sendSms(phone, content) {
  const record = {
    id: generateMessageId(),
    type: 'sms',
    phone,
    content,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };
  notifyLog.push(record);
  console.log(`[短信通知] => ${phone}: ${content}`);
  return record;
}

function sendDeliveryNotify(recipientPhone, recipientName, pickupCode, lockerId) {
  const content = `【智能快递柜】${recipientName}您好，您有一个包裹已存入${lockerId}号格口，取件码：${pickupCode}，柜机地址：${MACHINE_LOCATION}，请24小时内取件，超时将收取滞留费。`;
  return sendSms(recipientPhone, content);
}

function sendOvertimeRemindNotify(recipientPhone, recipientName, lockerId, overdueHours) {
  const content = `【智能快递柜】${recipientName}您好，您在${lockerId}号格口的包裹已存放超${overdueHours}小时，请尽快取件，超时将按每天2元收取滞留费。柜机地址：${MACHINE_LOCATION}`;
  return sendSms(recipientPhone, content);
}

function getNotifyLog(filters) {
  let result = [...notifyLog];
  if (filters) {
    if (filters.phone) result = result.filter((n) => n.phone === filters.phone);
    if (filters.type) result = result.filter((n) => n.type === filters.type);
  }
  return result;
}

module.exports = {
  sendDeliveryNotify,
  sendOvertimeRemindNotify,
  getNotifyLog,
  MACHINE_LOCATION,
};
