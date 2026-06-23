const { formatResponse } = require('../utils');

function send(res, result) {
  if (result.isFile) {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }
  res.status(result.httpStatus || 200).json(
    formatResponse(result.success, result.data, result.message)
  );
}

module.exports = {
  lockerService: require('./LockerService'),
  packageService: require('./PackageService'),
  statisticsService: require('./StatisticsService'),
  send
};
