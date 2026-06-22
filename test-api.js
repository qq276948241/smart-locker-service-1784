const BASE_URL = 'http://localhost:3001';

async function test() {
  let passCount = 0;
  let failCount = 0;
  const results = [];

  function logTest(name, res, expectedStatus = 200) {
    const ok = res.status === expectedStatus;
    if (ok) passCount++; else failCount++;
    results.push({ name, status: res.status, ok });
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} [${res.status}] ${name}`);
    if (!ok && res.data) console.log('     错误:', res.data.message || res.data);
    return ok;
  }

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE_URL + path, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  console.log('\n========== 开始 API 接口测试 ==========\n');

  console.log('--- 1. 格口管理接口 ---');
  let res = await request('GET', '/api/lockers');
  logTest('查询所有格口状态', res);
  if (res.data && res.data.data) {
    console.log(`     总计:${res.data.data.summary.total} 可用:${res.data.data.summary.available} 占用:${res.data.data.summary.occupied}`);
  }

  res = await request('GET', '/api/lockers/SMALL-01');
  logTest('查询单个格口详情(SMALL-01)', res);

  res = await request('GET', '/api/lockers/INVALID-99');
  logTest('查询不存在的格口(应返回404)', res, 404);

  res = await request('PUT', '/api/lockers/SMALL-01/status', { status: 'out_of_service' });
  logTest('设置格口为维护状态', res);

  res = await request('PUT', '/api/lockers/SMALL-01/status', { status: 'available' });
  logTest('恢复格口为可用状态', res);

  res = await request('GET', '/api/lockers?size=small&status=available');
  logTest('按条件筛选格口(small+available)', res);

  console.log('\n--- 2. 投件接口 ---');
  const deliver1 = await request('POST', '/api/packages/deliver', {
    courierName: '王快递',
    courierPhone: '13800138001',
    recipientName: '张三',
    recipientPhone: '13900139001',
    packageHeight: 20,
    packageWidth: 20,
    packageDepth: 20,
    trackingNumber: 'SF1234567890',
  });
  logTest('投件1(小号包裹)', deliver1, 201);

  const deliver2 = await request('POST', '/api/packages/deliver', {
    courierName: '李快递',
    courierPhone: '13800138002',
    recipientName: '李四',
    recipientPhone: '13900139002',
    packageHeight: 45,
    packageWidth: 45,
    packageDepth: 45,
    trackingNumber: 'YT9876543210',
  });
  logTest('投件2(中号包裹)', deliver2, 201);

  const deliver3 = await request('POST', '/api/packages/deliver', {
    courierName: '赵快递',
    courierPhone: '13800138003',
    recipientName: '王五',
    recipientPhone: '13900139003',
    packageHeight: 75,
    packageWidth: 75,
    packageDepth: 75,
    trackingNumber: 'JD1122334455',
  });
  logTest('投件3(大号包裹)', deliver3, 201);

  const deliverOversize = await request('POST', '/api/packages/deliver', {
    courierName: '测试员',
    courierPhone: '13800000000',
    recipientName: '测试',
    recipientPhone: '13900000000',
    packageHeight: 200,
    packageWidth: 200,
    packageDepth: 200,
  });
  logTest('投件(超大件-应失败)', deliverOversize, 400);

  const deliverMissing = await request('POST', '/api/packages/deliver', {
    courierName: '测试员',
  });
  logTest('投件(缺少参数-应失败)', deliverMissing, 400);

  let pickupCode1 = null, pickupCode2 = null;
  let locker1 = null, locker2 = null, locker3 = null;
  let phone1 = '13900139001', phone3 = '13900139003';
  if (deliver1.data && deliver1.data.data) {
    pickupCode1 = deliver1.data.data.pickupCode;
    locker1 = deliver1.data.data.lockerId;
    console.log(`     包裹1: 格口=${locker1}, 取件码=${pickupCode1}, 收件人手机=${phone1}`);
  }
  if (deliver2.data && deliver2.data.data) {
    pickupCode2 = deliver2.data.data.pickupCode;
    locker2 = deliver2.data.data.lockerId;
    console.log(`     包裹2: 格口=${locker2}, 取件码=${pickupCode2}`);
  }
  if (deliver3.data && deliver3.data.data) {
    locker3 = deliver3.data.data.lockerId;
    console.log(`     包裹3: 格口=${locker3}, 收件人手机=${phone3}`);
  }

  res = await request('GET', `/api/lockers/${locker1}`);
  logTest('投递后查询格口状态(应为占用)', res);

  console.log('\n--- 3. 查询包裹接口 ---');
  if (pickupCode1) {
    res = await request('GET', `/api/packages/query?pickupCode=${pickupCode1}`);
    logTest('按取件码查询包裹', res);
  }
  res = await request('GET', `/api/packages/query?recipientPhone=${phone3}`);
  logTest('按手机号查询包裹', res);

  console.log('\n--- 4. 取件接口 ---');
  const pickup1 = await request('POST', '/api/packages/pickup', { pickupCode: pickupCode1 });
  logTest('取件1(凭取件码)', pickup1);

  const pickup2 = await request('POST', '/api/packages/pickup', { recipientPhone: '13900139002' });
  logTest('取件2(凭手机号)', pickup2);

  const pickupWrong = await request('POST', '/api/packages/pickup', { pickupCode: 'WRONG123' });
  logTest('取件(错误取件码-应失败)', pickupWrong, 404);

  const pickupEmpty = await request('POST', '/api/packages/pickup', {});
  logTest('取件(无参数-应失败)', pickupEmpty, 400);

  res = await request('GET', `/api/lockers/${locker1}`);
  logTest('取件后查询格口状态(应为可用)', res);

  console.log('\n--- 5. 记录与统计接口 ---');
  res = await request('GET', '/api/records');
  logTest('查询所有投递记录(含统计)', res);
  if (res.data && res.data.data && res.data.data.statistics) {
    const s = res.data.data.statistics;
    console.log(`     投递数:${s.deliverCount} 取件数:${s.pickupCount} 滞留费:¥${s.totalOvertimeFee} 逾期率:${s.overdueRate}%`);
  }

  res = await request('GET', '/api/records?action=deliver');
  logTest('筛选投递操作记录', res);

  res = await request('GET', '/api/records?action=pickup');
  logTest('筛选取件操作记录', res);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  res = await request('GET', `/api/records?startTime=${yesterday.toISOString()}&endTime=${tomorrow.toISOString()}`);
  logTest('按时间段查询记录(近2天)', res);

  res = await request('GET', '/api/records?page=1&pageSize=2');
  logTest('分页查询记录(每页2条)', res);

  res = await request('GET', '/api/records/daily');
  logTest('按日统计汇总(默认近7天)', res);
  if (res.data && res.data.data && res.data.data.summary) {
    const s = res.data.data.summary;
    console.log(`     总投递:${s.totalDeliver} 总取件:${s.totalPickup} 总滞留费:¥${s.totalOvertimeFee}`);
  }

  res = await request('GET', `/api/records/daily?startTime=${yesterday.toISOString()}&endTime=${tomorrow.toISOString()}`);
  logTest('按时间段按日统计', res);

  console.log('\n========== 测试结果汇总 ==========');
  console.log(`通过: ${passCount}  失败: ${failCount}  总计: ${passCount + failCount}`);
  console.log(failCount === 0 ? '🎉 所有测试通过！' : '⚠️  部分测试失败，请检查上面的日志');
  console.log('===================================\n');

  console.log('📦 滞留费计费规则说明:');
  console.log('   - 免费存放时间: 24小时');
  console.log('   - 超过24小时后，每24小时收取 ¥2 滞留费');
  console.log('   - 不满24小时按1天计算\n');
}

test().catch((e) => {
  console.error('测试出错:', e.message);
  process.exit(1);
});
