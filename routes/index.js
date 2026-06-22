const courierRoutes = require('./courier');
const lockerRoutes = require('./locker');
const packageRoutes = require('./package');
const recordRoutes = require('./record');
const notifyRoutes = require('./notify');

function registerRoutes(app) {
  app.use('/api/courier', courierRoutes);
  app.use('/api/lockers', lockerRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/records', recordRoutes);
  app.use('/api/notifications', notifyRoutes);
}

module.exports = {
  registerRoutes,
};
