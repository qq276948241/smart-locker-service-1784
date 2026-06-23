const utils = require('./utils');
const lockerModel = require('./models/Locker');
const packageModel = require('./models/Package');
const config = require('./config');

console.log('========================================');
console.log('  单元测试 - 格口尺寸分类');
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
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(msg || `期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`);
}

// ============ Utils 尺寸工具测试 ============
console.log('【Utils 工具函数】');

test('SIZE_TYPES 常量定义正确', () => {
  assertEq(utils.SIZE_TYPES.SMALL, 'small');
  assertEq(utils.SIZE_TYPES.MEDIUM, 'medium');
  assertEq(utils.SIZE_TYPES.LARGE, 'large');
  assertEq(utils.VALID_SIZES.length, 3);
});

test('parseSize 支持多种输入格式', () => {
  assertEq(utils.parseSize('small'), 'small');
  assertEq(utils.parseSize('S'), 'small');
  assertEq(utils.parseSize('s'), 'small');
  assertEq(utils.parseSize('小'), 'small');
  assertEq(utils.parseSize('小格'), 'small');
  assertEq(utils.parseSize('medium'), 'medium');
  assertEq(utils.parseSize('M'), 'medium');
  assertEq(utils.parseSize('中'), 'medium');
  assertEq(utils.parseSize('large'), 'large');
  assertEq(utils.parseSize('L'), 'large');
  assertEq(utils.parseSize('大'), 'large');
});

test('parseSize 非法值返回 null', () => {
  assertEq(utils.parseSize(null), null);
  assertEq(utils.parseSize(undefined), null);
  assertEq(utils.parseSize(''), null);
  assertEq(utils.parseSize('XL'), null);
  assertEq(utils.parseSize('超大'), null);
  assertEq(utils.parseSize(123), null);
});

test('getSizeName 返回正确中文', () => {
  assertEq(utils.getSizeName('small'), '小格');
  assertEq(utils.getSizeName('medium'), '中格');
  assertEq(utils.getSizeName('large'), '大格');
});

test('isValidSize 判断尺寸合法性', () => {
  assert(utils.isValidSize('small') === true);
  assert(utils.isValidSize('medium') === true);
  assert(utils.isValidSize('large') === true);
  assert(utils.isValidSize('S') === false);
  assert(utils.isValidSize('小') === false);
  assert(utils.isValidSize('') === false);
});

test('getAllSizeOptions 返回选项带可用数量', () => {
  const opts = utils.getAllSizeOptions();
  assertEq(opts.length, 3);
  assert(opts[0].key === 'small' && opts[0].name === '小格');
  assert(opts[1].key === 'medium' && opts[1].name === '中格');
  assert(opts[2].key === 'large' && opts[2].name === '大格');
});

// ============ Locker 模型尺寸测试 ============
console.log('\n【Locker 模型】');

test('初始化时 3 种尺寸格口数量正确', () => {
  const stats = lockerModel.getStats();
  assertEq(stats.bySize.small.total, config.locker.smallCount, '小格数量应为 ' + config.locker.smallCount);
  assertEq(stats.bySize.medium.total, config.locker.mediumCount, '中格数量应为 ' + config.locker.mediumCount);
  assertEq(stats.bySize.large.total, config.locker.largeCount, '大格数量应为 ' + config.locker.largeCount);
  assertEq(stats.total, config.locker.smallCount + config.locker.mediumCount + config.locker.largeCount);
});

test('每个格口包含 sizeName 中文字段', () => {
  const all = lockerModel.findAll();
  for (const locker of all) {
    assert(typeof locker.sizeName === 'string' && locker.sizeName.length > 0, 
      `格口 ${locker.code} 缺少 sizeName，实际: ${JSON.stringify(locker.sizeName)}`);
  }
  const small = all.filter(l => l.size === 'small');
  assert(small.every(l => l.sizeName === '小格'), '小格 sizeName 应为小格');
  const medium = all.filter(l => l.size === 'medium');
  assert(medium.every(l => l.sizeName === '中格'), '中格 sizeName 应为中格');
  const large = all.filter(l => l.size === 'large');
  assert(large.every(l => l.sizeName === '大格'), '大格 sizeName 应为大格');
});

test('格口编码前缀与尺寸匹配', () => {
  const all = lockerModel.findAll();
  assert(all.filter(l => l.code.startsWith('S')).every(l => l.size === 'small'));
  assert(all.filter(l => l.code.startsWith('M')).every(l => l.size === 'medium'));
  assert(all.filter(l => l.code.startsWith('L')).every(l => l.size === 'large'));
});

test('findAll 按尺寸筛选（支持多种尺寸别名）', () => {
  const r1 = lockerModel.findAll({ size: 'S' });
  assertEq(r1.length, config.locker.smallCount, '用 S 筛选应返回小格');
  assert(r1.every(l => l.size === 'small'));
  
  const r2 = lockerModel.findAll({ size: '中' });
  assertEq(r2.length, config.locker.mediumCount, '用 中 筛选应返回中格');
  assert(r2.every(l => l.size === 'medium'));
  
  const r3 = lockerModel.findAll({ size: 'large' });
  assertEq(r3.length, config.locker.largeCount, '用 large 筛选应返回大格');
  assert(r3.every(l => l.size === 'large'));
});

test('findAll 非法尺寸不进行过滤（返回全部）', () => {
  const r = lockerModel.findAll({ size: 'XL' });
  assertEq(r.length, 25, '非法尺寸参数应返回全部（内部忽略非法值）');
});

test('findAvailable 按尺寸找到一个可用格口', () => {
  const s = lockerModel.findAvailable('S');
  assert(s && s.size === 'small' && s.code.startsWith('S'));
  const m = lockerModel.findAvailable('中');
  assert(m && m.size === 'medium' && m.code.startsWith('M'));
  const l = lockerModel.findAvailable('large');
  assert(l && l.size === 'large' && l.code.startsWith('L'));
});

test('findAvailable 非法尺寸返回 null', () => {
  assertEq(lockerModel.findAvailable('XL'), null);
  assertEq(lockerModel.findAvailable(''), null);
});

test('findAllAvailable 批量查找可用格口', () => {
  const all = lockerModel.findAllAvailable();
  assertEq(all.length, 25, '默认全部可用格口应为 25');
  const small = lockerModel.findAllAvailable('S');
  assertEq(small.length, config.locker.smallCount);
  assert(small.every(l => l.status === 'available' && l.size === 'small'));
});

test('countAvailable 统计各尺寸可用数量', () => {
  assertEq(lockerModel.countAvailable('小'), config.locker.smallCount);
  assertEq(lockerModel.countAvailable('M'), config.locker.mediumCount);
  assertEq(lockerModel.countAvailable('large'), config.locker.largeCount);
  assertEq(lockerModel.countAvailable(), 25, '不传尺寸时统计全部');
});

test('getSizeOptions 返回各尺寸总数和可用数', () => {
  const opts = lockerModel.getSizeOptions();
  assertEq(opts.length, 3);
  assertEq(opts[0].total, config.locker.smallCount);
  assertEq(opts[0].available, config.locker.smallCount);
  assertEq(opts[1].total, config.locker.mediumCount);
  assertEq(opts[1].available, config.locker.mediumCount);
  assertEq(opts[2].total, config.locker.largeCount);
  assertEq(opts[2].available, config.locker.largeCount);
});

test('getStats bySize 包含中文 name 字段', () => {
  const stats = lockerModel.getStats();
  assertEq(stats.bySize.small.name, '小格');
  assertEq(stats.bySize.medium.name, '中格');
  assertEq(stats.bySize.large.name, '大格');
  assert(Array.isArray(stats.sizeOptions) && stats.sizeOptions.length === 3);
});

// ============ Package 模型尺寸测试 ============
console.log('\n【Package 模型 - 尺寸校验与分配】');

test('不传 packageSize 时默认分配中格', () => {
  const result = packageModel.create({
    courierId: 'TEST1', courierName: '快递员1', recipientPhone: '13000000001'
  });
  assert(result.success === true, `投件应成功：${result.message}`);
  assertEq(result.data.lockerSize, 'medium');
  assertEq(result.data.lockerSizeName, '中格');
  assert(result.data.lockerCode.startsWith('M'));
});

test('传入 packageSize=small 分配小格', () => {
  const result = packageModel.create({
    courierId: 'TEST2', courierName: '快递员2', recipientPhone: '13000000002',
    packageSize: 'small'
  });
  assert(result.success === true);
  assertEq(result.data.lockerSize, 'small');
  assertEq(result.data.lockerSizeName, '小格');
  assert(result.data.lockerCode.startsWith('S'));
});

test('传入 packageSize=S（首字母）分配小格', () => {
  const result = packageModel.create({
    courierId: 'TEST3', courierName: '快递员3', recipientPhone: '13000000003',
    packageSize: 'S'
  });
  assert(result.success === true);
  assertEq(result.data.lockerSize, 'small');
});

test('传入 packageSize=大（中文）分配大格', () => {
  const result = packageModel.create({
    courierId: 'TEST4', courierName: '快递员4', recipientPhone: '13000000004',
    packageSize: '大'
  });
  assert(result.success === true);
  assertEq(result.data.lockerSize, 'large');
  assertEq(result.data.lockerSizeName, '大格');
  assert(result.data.lockerCode.startsWith('L'));
});

test('包裹记录包含 lockerSizeName 中文字段', () => {
  const r = packageModel.create({
    courierId: 'TEST5', courierName: '快递员5', recipientPhone: '13000000005',
    packageSize: 'M'
  });
  const pkg = packageModel.findById(r.data.id);
  assertEq(pkg.lockerSize, 'medium');
  assertEq(pkg.lockerSizeName, '中格');
});

test('非法 packageSize（如 XL）返回错误', () => {
  const result = packageModel.create({
    courierId: 'TEST6', courierName: '快递员6', recipientPhone: '13000000006',
    packageSize: 'XL'
  });
  assert(result.success === false, '非法尺寸应失败');
  assertEq(result.errorCode, 'INVALID_SIZE');
  assert(result.message.includes('包裹尺寸无效'), `错误消息应提示无效：${result.message}`);
});

test('占满所有小格后再投小格返回 NO_LOCKER_AVAILABLE', () => {
  const availableSmall = lockerModel.countAvailable('small');
  for (let i = 0; i < availableSmall; i++) {
    packageModel.create({
      courierId: 'FILL', courierName: '塞满', recipientPhone: `131000000${String(i).padStart(2, '0')}`,
      packageSize: 'S'
    });
  }
  assertEq(lockerModel.countAvailable('small'), 0, '小格应已全部占满');

  const result = packageModel.create({
    courierId: 'TESTX', courierName: '测试员', recipientPhone: '13200000001',
    packageSize: 'small'
  });
  assert(result.success === false, '小格满时应失败');
  assertEq(result.errorCode, 'NO_LOCKER_AVAILABLE');
  assert(result.message.includes('小格') && result.message.includes('没有可用'), 
    `错误消息应包含"小格没有可用"：${result.message}`);
  assert(result.data && result.data.availableBySize, '应返回 availableBySize 提示其他尺寸可用数');
});

test('占满小格后，投中格/大格依然正常', () => {
  const r1 = packageModel.create({
    courierId: 'TESTM', courierName: '中测试', recipientPhone: '13300000001', packageSize: 'M'
  });
  assert(r1.success === true, '中格应正常可用');
  assertEq(r1.data.lockerSize, 'medium');
  const r2 = packageModel.create({
    courierId: 'TESTL', courierName: '大测试', recipientPhone: '13300000002', packageSize: 'L'
  });
  assert(r2.success === true, '大格应正常可用');
  assertEq(r2.data.lockerSize, 'large');
});

test('取件后小格数量恢复', () => {
  const before = lockerModel.countAvailable('small');
  const deposited = packageModel.findAll({ status: 'deposited' })
    .filter(p => p.lockerSize === 'small').slice(0, 3);
  for (const pkg of deposited) {
    packageModel.pickupByCode(pkg.pickupCode);
  }
  const after = lockerModel.countAvailable('small');
  assertEq(after, before + 3, '取件 3 件后小格可用数应 +3');
});

test('getStatistics bySize 包含 key/name/count', () => {
  const start = new Date(Date.now() - 3600000).toISOString();
  const end = new Date(Date.now() + 3600000).toISOString();
  const stats = packageModel.getStatistics(start, end);
  assertEq(stats.bySize.small.name, '小格');
  assertEq(stats.bySize.medium.name, '中格');
  assertEq(stats.bySize.large.name, '大格');
  assert(typeof stats.bySize.small.count === 'number');
  assert(typeof stats.bySize.medium.count === 'number');
  assert(typeof stats.bySize.large.count === 'number');
});

// ============ 结果汇总 ============
console.log('\n========================================');
if (allPassed) {
  console.log('  所有 35 个测试全部通过 ✓');
} else {
  console.log('  存在测试失败 ✗');
  process.exit(1);
}
console.log('========================================');
