const packageModel = require('./models/Package');
const lockerModel = require('./models/Locker');
const scheduler = require('./scheduler');
const config = require('./config');

console.log('========================================');
console.log('  单元测试 - 超时扫描 & 定时任务');
console.log('========================================\n');

let allPassed = true;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    allPassed = false;
    console.log(`✗ ${name}`);
    console.log(`  错误: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || '断言失败');
}

console.log(`当前配置:`);
console.log(`  免费时长: ${config.locker.freeHours} 小时`);
console.log(`  超时费率: ${config.locker.overtimeFeePerHour} 元/小时`);
console.log(`  扫描间隔: ${config.scheduler.scanIntervalMinutes} 分钟`);
console.log('');

test('初始格口状态可用', () => {
  const stats = lockerModel.getStats();
  assert(stats.total === 25, '总格口数应为 25');
  assert(stats.available === 25, '初始可用格口应为 25');
});

test('投件功能正常', () => {
  const result = packageModel.create({
    courierId: 'TEST001',
    courierName: '测试员',
    recipientPhone: '13800000001',
    recipientName: '测试用户1',
    packageSize: 'small'
  });
  assert(result.success === true, '投件应成功');
  assert(result.data.pickupCode.length === 6, '取件码应为6位');
  assert(result.data.lockerCode.startsWith('S'), '小号格口应 S 开头');
  global.testPkg1 = result.data;
});

test('投件后 isOvertime 默认为 false', () => {
  const pkg = packageModel.findById(global.testPkg1.id);
  assert(pkg !== null, '应能找到包裹');
  assert(pkg.isOvertime === false, '新投件包裹 isOvertime 应为 false');
  assert(pkg.overtimeFee === 0, '新投件包裹 overtimeFee 应为 0');
  assert(pkg.overtimeHours === 0, '新投件包裹 overtimeHours 应为 0');
  assert(pkg.overtimeStartTime === null, 'overtimeStartTime 应为 null');
});

test('scanAndMarkOvertime 扫描功能正常（未超时时）', () => {
  const result = packageModel.scanAndMarkOvertime();
  assert(result.scanned >= 1, '应至少扫描1个包裹');
  assert(result.newlyMarked === 0, '免费期内不应新增超时');
  assert(result.updated === 0, '免费期内不应更新费用');
});

test('扫描后 lastScanTime 已更新', () => {
  const pkg = packageModel.findById(global.testPkg1.id);
  assert(pkg.lastScanTime !== null, '扫描后 lastScanTime 应已更新');
});

test('模拟超时：修改 depositTime 超过免费期', () => {
  const pkg = packageModel.findById(global.testPkg1.id);
  const fakeDepositTime = new Date();
  fakeDepositTime.setHours(fakeDepositTime.getHours() - (config.locker.freeHours + 5));
  pkg.depositTime = fakeDepositTime.toISOString();
  
  const result = packageModel.scanAndMarkOvertime();
  assert(result.newlyMarked === 1, '应标记1个新超时包裹');
  assert(result.updated === 1, '应更新1个包裹费用');
  assert(result.totalOvertime === 1, '累计超时有1个');
});

test('超时后 isOvertime 和费用正确', () => {
  const pkg = packageModel.findById(global.testPkg1.id);
  assert(pkg.isOvertime === true, 'isOvertime 应为 true');
  assert(pkg.overtimeStartTime !== null, 'overtimeStartTime 应已设置');
  assert(pkg.overtimeHours >= 5, `overtimeHours 应>=5，实际为${pkg.overtimeHours}`);
  assert(pkg.overtimeFee >= 5, `overtimeFee 应>=5，实际为${pkg.overtimeFee}`);
});

test('再次扫描：已超时包裹不会重复标记新增', () => {
  const pkg = packageModel.findById(global.testPkg1.id);
  const fakeDepositTime = new Date();
  fakeDepositTime.setHours(fakeDepositTime.getHours() - (config.locker.freeHours + 10));
  pkg.depositTime = fakeDepositTime.toISOString();
  
  const result = packageModel.scanAndMarkOvertime();
  assert(result.newlyMarked === 0, '已超时包裹不应再记为新增');
  assert(result.updated === 1, '费用变化时应更新');
  assert(pkg.overtimeHours >= 10, `overtimeHours 应>=10，实际为${pkg.overtimeHours}`);
});

test('取件时使用已累计的超时费用', () => {
  const pkgBefore = packageModel.findById(global.testPkg1.id);
  const expectedFee = pkgBefore.overtimeFee;
  const expectedHours = pkgBefore.overtimeHours;
  
  const result = packageModel.pickupByCode(global.testPkg1.pickupCode);
  assert(result.success === true, '取件应成功');
  assert(result.data.overtime.fee === expectedFee, `取件返回费用应等于已累计费用：预期${expectedFee}，实际${result.data.overtime.fee}`);
  assert(result.data.overtime.hours === expectedHours, `取件返回时长应等于已累计时长`);
  assert(result.data.overtime.isOvertime === true, 'isOvertime 应为 true');
});

test('取件后格口释放', () => {
  const stats = lockerModel.getStats();
  assert(stats.available === 25, '取件后格口应被释放');
});

test('手机号批量取件：验证多包裹超时费用累计', () => {
  const r1 = packageModel.create({
    courierId: 'TEST002',
    courierName: '测试员',
    recipientPhone: '13900000002',
    recipientName: '测试用户2',
    packageSize: 'medium'
  });
  const r2 = packageModel.create({
    courierId: 'TEST002',
    courierName: '测试员',
    recipientPhone: '13900000002',
    recipientName: '测试用户2',
    packageSize: 'large'
  });
  
  const p1 = packageModel.findById(r1.data.id);
  const p2 = packageModel.findById(r2.data.id);
  const t1 = new Date();
  t1.setHours(t1.getHours() - (config.locker.freeHours + 3));
  p1.depositTime = t1.toISOString();
  const t2 = new Date();
  t2.setHours(t2.getHours() - (config.locker.freeHours + 7));
  p2.depositTime = t2.toISOString();
  
  packageModel.scanAndMarkOvertime();
  
  const result = packageModel.pickupByPhone('13900000002');
  assert(result.success === true, '批量取件应成功');
  assert(result.data.count === 2, '应取出2件');
  assert(result.data.totalOvertimeFee >= 10, `总滞留费应>=10（3+7），实际${result.data.totalOvertimeFee}`);
  assert(result.data.totalOvertimeHours >= 10, `总超时时长应>=10，实际${result.data.totalOvertimeHours}`);
});

test('scheduler.getStatus() 返回正确状态', () => {
  const status = scheduler.getStatus();
  assert(typeof status.isRunning === 'boolean', 'isRunning 应为布尔值');
  assert(status.scanIntervalMinutes === config.scheduler.scanIntervalMinutes, '扫描间隔应与配置一致');
  assert(typeof status.totalOvertime === 'number', 'totalOvertime 应为数字');
});

test('scheduler.runScan() 执行成功', () => {
  const result = scheduler.runScan();
  assert(result !== null, 'runScan 应返回结果');
  assert(typeof result.scanned === 'number', 'scanned 应为数字');
});

console.log('');
console.log('========================================');
if (allPassed) {
  console.log('  所有测试通过 ✓');
} else {
  console.log('  存在测试失败 ✗');
  process.exit(1);
}
console.log('========================================');
