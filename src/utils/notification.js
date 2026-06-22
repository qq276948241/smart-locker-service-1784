function sendSms(phone, content) {
  const timestamp = new Date().toLocaleString('zh-CN');
  console.log(`[${timestamp}] [短信通知] 发送至 ${phone}: ${content}`);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        messageId: `SMS${Date.now()}`,
        phone,
        content,
        sentAt: new Date()
      });
    }, 100);
  });
}

function sendPickupNotification(recipientPhone, pickupCode, lockerId) {
  const content = `【智能快递柜】您有一个包裹已投递到${lockerId}号格口，取件码：${pickupCode}，请在24小时内取件，超时将收取滞留费。`;
  return sendSms(recipientPhone, content);
}

function sendOverdueNotification(recipientPhone, pickupCode, lockerId, overdueFee, overdueHours) {
  const content = `【智能快递柜】您的包裹（${lockerId}号格口，取件码：${pickupCode}）已超时${overdueHours}小时未取，当前滞留费¥${overdueFee}，请尽快取件，滞留费将随时间累计。`;
  return sendSms(recipientPhone, content);
}

module.exports = {
  sendSms,
  sendPickupNotification,
  sendOverdueNotification
};
