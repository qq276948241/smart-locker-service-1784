const express = require('express');
const router = express.Router();
const { packageService, send } = require('../services');

router.post('/deposit', (req, res) => {
  send(res, packageService.deposit(req.body));
});

router.post('/pickup/code', (req, res) => {
  send(res, packageService.pickupByCode(req.body.pickupCode));
});

router.post('/pickup/phone', (req, res) => {
  send(res, packageService.pickupByPhone(req.body.recipientPhone));
});

router.post('/:id/pickup', (req, res) => {
  send(res, packageService.pickupById(req.params.id));
});

router.get('/', (req, res) => {
  send(res, packageService.queryList(req.query));
});

router.get('/:id', (req, res) => {
  send(res, packageService.getById(req.params.id));
});

router.get('/tracking/:trackingNumber', (req, res) => {
  send(res, packageService.getByTrackingNumber(req.params.trackingNumber));
});

router.get('/phone/:recipientPhone', (req, res) => {
  send(res, packageService.getByPhone(req.params.recipientPhone));
});

module.exports = router;
