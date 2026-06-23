const express = require('express');
const router = express.Router();
const { statisticsService, send } = require('../services');

router.get('/packages', (req, res) => {
  send(res, statisticsService.getPackagesStats(req.query));
});

router.get('/overview', (req, res) => {
  send(res, statisticsService.getOverview());
});

router.get('/packages/export', (req, res) => {
  send(res, statisticsService.exportPackages(req.query));
});

module.exports = router;
