const { getOvertimeFeeRate, calculateOvertimeFee, SIZE_TYPES } = require('./utils');
const config = require('./config');

console.log('========================================');
console.log('  单元测试 - 尺寸费率 & 多包裹手机号取件');
console.log('========================================');
console.log('');
console.log(`当前费率配置: 小格=${config.locker.overtimeFeePerHour.small}元/小时, 中格=${config.locker.overtimeFeePerHour.medium}元/小时, 大格=${config.locker.overtimeFeePerHour.large}元/小时`);
console.log('');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
    passed++;
  } catch (e) {
    console.log(`\u2717 ${name}`);
    console.log(`    错误: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

// 【测试 1-6：尺寸费率工具函数】
console.log('【Utils - 按尺寸费率】');

test('getOvertimeFeeRate 小格返回 1', () => {
  assert(getOvertimeFeeRate(SIZE_TYPES.SMALL) === 1);
});

test('getOvertimeFeeRate 中格返回 2', () => {
  assert(getOvertimeFeeRate(SIZE_TYPES.MEDIUM) === 2);
});

test('getOvertimeFeeRate 大格返回 3', () => {
  assert(getOvertimeFeeRate(SIZE_TYPES.LARGE) === 3);
});

test('calculateOvertimeFee 小格超时 3 小时 = 3元', () => {
  const now = new Date();
  const depositTime = new Date(now - (24 + 3) * 60 * 60 * 1000);
  const res = calculateOvertimeFee(depositTime, now, SIZE_TYPES.SMALL);
  assert(res.isOvertime === true);
  assert(res.hours === 3);
  assert(res.fee === 3);
  assert(res.feePerHour === 1);
});

test('calculateOvertimeFee 中格超时 3 小时 = 6元', () => {
  const now = new Date();
  const depositTime = new Date(now - (24 + 3) * 60 * 60 * 1000);
  const res = calculateOvertimeFee(depositTime, now, SIZE_TYPES.MEDIUM);
  assert(res.isOvertime === true);
  assert(res.hours === 3);
  assert(res.fee === 6);
  assert(res.feePerHour === 2);
});

test('calculateOvertimeFee 大格超时 3 小时 = 9元', () => {
  const now = new Date();
  const depositTime = new Date(now - (24 + 3) * 60 * 60 * 1000);
  const res = calculateOvertimeFee(depositTime, now, SIZE_TYPES.LARGE);
  assert(res.isOvertime === true);
  assert(res.hours === 3);
  assert(res.fee === 9);
  assert(res.feePerHour === 3);
});

// 【测试 7-14：Package 模型 - 按尺寸超时计费】
console.log('');
console.log('【Package 模型 - 按尺寸超时计费】');

const packageModel = require('./models/Package');
const lockerModel = require('./models/Locker');

// 重置：把所有 deposited 包裹标记为 picked_up + 释放所有占用格口
packageModel.findAll({ status: 'deposited' }).forEach(p => {
  p.status = 'picked_up';
  if (p.lockerId) lockerModel.release(p.lockerId);
});
// 强制所有被 occupied 的格口释放一遍（防止数据不一致）
lockerModel.lockers.forEach(l => {
  if (l.status !== 'available') {
    l.status = 'available';
    l.packageId = null;
  }
});

test('投小格包裹 + 超时 3 小时 scan 后 overtimeFee=3', () => {
  const depositRes = packageModel.create({
    courierId: 'c001', courierName: '张快递', recipientPhone: '13900000001',
    recipientName: '张三', packageSize: SIZE_TYPES.SMALL
  });
  assert(depositRes.success === true);
  const pkg = packageModel.findById(depositRes.data.id);
  // 设为 27h 差 1s → 超时 2h59m59s → ceil = 3h
  pkg.depositTime = new Date(Date.now() - (24 + 3) * 60 * 60 * 1000 + 1000).toISOString();

  packageModel.scanAndMarkOvertime();
  assert(pkg.isOvertime === true);
  assert(pkg.overtimeHours === 3);
  assert(pkg.overtimeFee === 3);
});

test('投中格包裹 + 超时 5 小时 scan 后 overtimeFee=10', () => {
  const depositRes = packageModel.create({
    courierId: 'c001', courierName: '张快递', recipientPhone: '13900000002',
    recipientName: '李四', packageSize: SIZE_TYPES.MEDIUM
  });
  assert(depositRes.success === true);
  const pkg = packageModel.findById(depositRes.data.id);
  pkg.depositTime = new Date(Date.now() - (24 + 5) * 60 * 60 * 1000 + 1000).toISOString();

  packageModel.scanAndMarkOvertime();
  assert(pkg.isOvertime === true);
  assert(pkg.overtimeHours === 5);
  assert(pkg.overtimeFee === 10);
});

test('投大格包裹 + 超时 2 小时 scan 后 overtimeFee=6', () => {
  const depositRes = packageModel.create({
    courierId: 'c001', courierName: '张快递', recipientPhone: '13900000003',
    recipientName: '王五', packageSize: SIZE_TYPES.LARGE
  });
  assert(depositRes.success === true);
  const pkg = packageModel.findById(depositRes.data.id);
  pkg.depositTime = new Date(Date.now() - (24 + 2) * 60 * 60 * 1000 + 1000).toISOString();

  packageModel.scanAndMarkOvertime();
  assert(pkg.isOvertime === true);
  assert(pkg.overtimeHours === 2);
  assert(pkg.overtimeFee === 6);
});

// 【测试 10-14：多包裹手机号取件流程】
console.log('');
console.log('【Package 模型 - 多包裹手机号取件】');

const TEST_PHONE = '13811112222';

// 清掉该手机号已存包裹
packageModel.findAll({ recipientPhone: TEST_PHONE, status: 'deposited' }).forEach(p => {
  p.status = 'picked_up';
  lockerModel.release(p.lockerId);
});

test('手机号仅 1 件包裹时，pickupByPhone 返回 mode=single_auto', () => {
  const dep = packageModel.create({
    courierId: 'c002', courierName: '李快递', recipientPhone: TEST_PHONE,
    recipientName: '单包裹', packageSize: SIZE_TYPES.SMALL
  });
  assert(dep.success === true);

  const res = packageModel.pickupByPhone(TEST_PHONE);
  assert(res.success === true);
  assert(res.data.mode === 'single_auto');
  assert(res.data.count === 1);
  assert(res.data.packages[0].status === undefined || res.data.packages[0].lockerCode);
});

// 再投 3 个包裹（小/中/大）到同一个手机号
const pkgIds = [];
for (let i = 0; i < 3; i++) {
  const sizes = [SIZE_TYPES.SMALL, SIZE_TYPES.MEDIUM, SIZE_TYPES.LARGE];
  const dep = packageModel.create({
    courierId: 'c003', courierName: '王快递', recipientPhone: TEST_PHONE,
    recipientName: `多包裹用户${i}`, packageSize: sizes[i]
  });
  if (dep.success) {
    pkgIds.push(dep.data.id);
    const pkg = packageModel.findById(dep.data.id);
    const extraHours = 5 + i * 3; // 小=5 中=8 大=11
    pkg.depositTime = new Date(Date.now() - (24 + extraHours) * 60 * 60 * 1000 + 1000).toISOString();
  }
}

test('同一手机号 3 件包裹时，pickupByPhone 返回 mode=multi_select（不直接取件）', () => {
  assert(pkgIds.length === 3);

  const res = packageModel.pickupByPhone(TEST_PHONE);
  assert(res.success === true);
  assert(res.data.mode === 'multi_select');
  assert(res.data.count === 3);
  assert(res.data.packages.length === 3);

  // 检查三个包裹都还在 deposited 状态（没有被取）
  pkgIds.forEach(id => {
    const p = packageModel.findById(id);
    assert(p.status === 'deposited', `包裹 ${id} 应该仍在 deposited 状态，但实际是 ${p.status}`);
  });
});

test('multi_select 列表中每件包含正确的尺寸费率和超时费用', () => {
  const res = packageModel.pickupByPhone(TEST_PHONE);
  assert(res.data.mode === 'multi_select');

  const smallPkg = res.data.packages.find(p => p.lockerSize === SIZE_TYPES.SMALL);
  const mediumPkg = res.data.packages.find(p => p.lockerSize === SIZE_TYPES.MEDIUM);
  const largePkg = res.data.packages.find(p => p.lockerSize === SIZE_TYPES.LARGE);

  assert(smallPkg.overtime.isOvertime === true);
  assert(smallPkg.feePerHour === 1);
  assert(smallPkg.overtime.fee === 5 * 1, `小格超时费应为 5 元，实际为 ${smallPkg.overtime.fee}`);

  assert(mediumPkg.feePerHour === 2);
  assert(mediumPkg.overtime.fee === 8 * 2, `中格超时费应为 16 元，实际为 ${mediumPkg.overtime.fee}`);

  assert(largePkg.feePerHour === 3);
  assert(largePkg.overtime.fee === 11 * 3, `大格超时费应为 33 元，实际为 ${largePkg.overtime.fee}`);

  const expectedTotal = 5 + 16 + 33;
  assert(res.data.totalOvertimeFee === expectedTotal, `总计应为 ${expectedTotal}，实际 ${res.data.totalOvertimeFee}`);
});

test('pickupById 取走多包裹列表中的中格包裹，状态正确更新', () => {
  const mediumPkg = packageModel.findAll({ recipientPhone: TEST_PHONE, status: 'deposited' })
    .find(p => p.lockerSize === SIZE_TYPES.MEDIUM);
  assert(mediumPkg != null);
  assert(mediumPkg.status === 'deposited');

  const res = packageModel.pickupById(mediumPkg.id);
  assert(res.success === true);
  assert(res.data.lockerSize === SIZE_TYPES.MEDIUM);
  assert(res.data.lockerSizeName === '中格');
  assert(res.data.overtime.isOvertime === true);
  assert(res.data.overtime.hours === 8);
  assert(res.data.overtime.fee === 16);
  assert(res.data.overtime.feePerHour === 2);

  const recheck = packageModel.findById(mediumPkg.id);
  assert(recheck.status === 'picked_up');
});

test('pickupById 对已取走的包裹返回 ALREADY_PICKED', () => {
  const picked = packageModel.findAll({ recipientPhone: TEST_PHONE, status: 'picked_up' })[0];
  const res = packageModel.pickupById(picked.id);
  assert(res.success === false);
  assert(res.errorCode === 'ALREADY_PICKED');
});

test('pickupById 不存在的 ID 返回 NOT_FOUND 404', () => {
  const res = packageModel.pickupById('non-existent-id-123');
  assert(res.success === false);
  assert(res.errorCode === 'NOT_FOUND');
});

// 【测试 15：取件码取件返回按尺寸的 feePerHour】
console.log('');
console.log('【取件码取件 - 尺寸费率验证】');

test('取件码取大格超时包裹返回 feePerHour=3', () => {
  const dep = packageModel.create({
    courierId: 'c004', courierName: '赵快递', recipientPhone: '13912340000',
    packageSize: SIZE_TYPES.LARGE
  });
  assert(dep.success === true);
  const pkg = packageModel.findById(dep.data.id);
  pkg.depositTime = new Date(Date.now() - (24 + 4) * 60 * 60 * 1000 + 1000).toISOString();
  packageModel.scanAndMarkOvertime();

  const res = packageModel.pickupByCode(pkg.pickupCode);
  assert(res.success === true);
  assert(res.data.overtime.isOvertime === true);
  assert(res.data.overtime.hours === 4);
  assert(res.data.overtime.fee === 12);
  assert(res.data.overtime.feePerHour === 3);
});

console.log('');
console.log('========================================');
console.log(`  通过: ${passed} 个, 失败: ${failed} 个`);
console.log(failed === 0 ? `  所有 ${passed} 个测试全部通过 \u2713` : '  存在测试失败 \u2717');
console.log('========================================');

process.exit(failed === 0 ? 0 : 1);
