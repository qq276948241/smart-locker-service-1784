const lockerModel = require('./locker');
const packageModel = require('./package');
const courierModel = require('./courier');
const recordModel = require('./record');

module.exports = {
  locker: lockerModel,
  package: packageModel,
  courier: courierModel,
  record: recordModel,
};
