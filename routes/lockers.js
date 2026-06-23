const express = require('express');
const router = express.Router();
const { lockerService, send } = require('../services');

router.get('/sizes', (req, res) => {
  send(res, lockerService.getSizeOptions());
});

router.get('/', (req, res) => {
  send(res, lockerService.queryList(req.query));
});

router.get('/stats', (req, res) => {
  send(res, lockerService.getStats());
});

router.get('/available', (req, res) => {
  send(res, lockerService.getAvailableList(req.query.size));
});

router.get('/available/count', (req, res) => {
  send(res, lockerService.getAvailableCount());
});

router.get('/available/:size', (req, res) => {
  send(res, lockerService.findOneAvailable(req.params.size));
});

router.get('/:id', (req, res) => {
  send(res, lockerService.getById(req.params.id));
});

router.get('/code/:code', (req, res) => {
  send(res, lockerService.getByCode(req.params.code));
});

router.put('/:id/maintenance', (req, res) => {
  send(res, lockerService.setMaintenance(req.params.id, req.body.maintenance));
});

module.exports = router;
