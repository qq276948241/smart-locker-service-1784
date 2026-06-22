const express = require('express');

function createAdminRoutes(store, scheduler) {
  const router = express.Router();

  router.post('/packages/:packageId/remind', async (req, res) => {
    const { adminId } = req.body || {};
    if (!adminId) {
      return res.status(400).json({ success: false, error: '缺少 adminId' });
    }
    try {
      const result = await scheduler.triggerManualReminder(req.params.packageId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({
        success: true,
        data: {
          notificationId: result.data.id,
          packageId: result.data.packageId,
          recipientPhone: result.data.recipientPhone,
          timestamp: new Date(result.data.timestamp).toISOString()
        }
      });
    } catch (err) {
      console.error('手动催取件失败:', err);
      res.status(500).json({ success: false, error: '催取件失败: ' + err.message });
    }
  });

  router.post('/packages/remind-all', async (req, res) => {
    const { adminId, onlyOverdue } = req.body || {};
    if (!adminId) {
      return res.status(400).json({ success: false, error: '缺少 adminId' });
    }
    try {
      const overdueList = store.getOverduePackages();
      const targets = onlyOverdue ? overdueList.filter(p => p.isOverdue) : overdueList;
      const results = [];
      for (const p of targets) {
        const r = await scheduler.triggerManualReminder(p.packageId);
        if (r.success) {
          results.push({
            packageId: p.packageId,
            notificationId: r.data.id,
            recipientPhone: r.data.recipientPhone
          });
        }
      }
      res.json({
        success: true,
        data: {
          total: targets.length,
          sent: results.length,
          results
        }
      });
    } catch (err) {
      console.error('批量催取件失败:', err);
      res.status(500).json({ success: false, error: '批量催取件失败: ' + err.message });
    }
  });

  return router;
}

module.exports = createAdminRoutes;
