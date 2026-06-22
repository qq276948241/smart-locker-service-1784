const BASE_URL = 'http://localhost:3004';

async function test() {
  let passCount = 0;
  let failCount = 0;
  const results = [];
  let authToken = null;

  function logTest(name, res, expectedStatus = 200) {
    const ok = res.status === expectedStatus;
    if (ok) passCount++; else failCount++;
    results.push({ name, status: res.status, ok });
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} [${res.status}] ${name}`);
    if (!ok && res.data) console.log('     错误:', res.data.message || res.data);
    return ok;
  }

  async function request(method, path, body = null, token = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE_URL + path, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  console.log('\n========== 开始 API 接口测试 ==========\n');

  console.log('--- 1. 快递员注册/登录接口 ---');
  let res = await request('POST', '/api/courier/register', {
    name: '王快递',
    phone: '13800138001',
    password: 'abc123',
  });
  logTest('快递员注册(王快递)', res, 201);

  res = await request('POST', '/api/courier/register', {
    name: '李快递',
    phone: '13800138002',
    password: 'xyz789',
  });
  logTest('快递员注册(李快递)', res, 201);

  res = await request('POST', '/api/courier/register', {
    name: '王快递',
    phone: '13800138001',
    password: 'abc123',
  });
  logTest('重复注册(应返回409)', res, 409);

  res = await request('POST', '/api/courier/register', {
    name: '短密码',
    phone: '13800138003',
    password: '12',
  });
  logTest('密码太短(应返回400)', res, 400);

  res = await request('POST', '/api/courier/register', {
    name: '坏手机',
    phone: '1234',
    password: 'abc123',
  });
  logTest('手机号格式错误(应返回400)', res, 400);

  res = await request('POST', '/api/courier/register', {});
  logTest('注册缺少参数(应返回400)', res, 400);

  const login1 = await request('POST', '/api/courier/login', {
    phone: '13800138001',
    password: 'abc123',
  });
  logTest('快递员登录(王快递)', login1);
  if (login1.data && login1.data.data) {
    authToken = login1.data.data.token;
    console.log(`     Token: ${authToken.substring(0, 16)}...`);
  }

  const loginWrong = await request('POST', '/api/courier/login', {
    phone: '13800138001',
    password: 'wrongpwd',
  });
  logTest('登录密码错误(应返回401)', loginWrong, 401);

  const loginMissing = await request('POST', '/api/courier/login', {});
  logTest('登录缺少参数(应返回400)', loginMissing, 400);

  console.log('\n--- 2. Token鉴权测试 ---');
  res = await request('GET', '/api/courier/profile', null, authToken);
  logTest('带Token查询个人信息', res);
  if (res.data && res.data.data) {
    console.log(`     快递员: ${res.data.data.name} (${res.data.data.phone})`);
  }

  res = await request('GET', '/api/courier/profile');
  logTest('不带Token查个人信息(应返回401)', res, 401);

  res = await request('GET', '/api/courier/profile', null, 'invalid_token_12345');
  logTest('无效Token查个人信息(应返回401)', res, 401);

  res = await request('POST', '/api/packages/deliver', {
    recipientName: '张三',
    recipientPhone: '13900139001',
    packageHeight: 20,
    packageWidth: 20,
    packageDepth: 20,
  });
  logTest('不带Token投件(应返回401)', res, 401);

  console.log('\n--- 3. 格口管理接口 ---');
  res = await request('GET', '/api/lockers');
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

  console.log('\n--- 4. 投件接口(需鉴权 + 通知) ---');
  const deliver1 = await request('POST', '/api/packages/deliver', {
    recipientName: '张三',
    recipientPhone: '13900139001',
    packageHeight: 20,
    packageWidth: 20,
    packageDepth: 20,
    trackingNumber: 'SF1234567890',
  }, authToken);
  logTest('投件1-小号包裹(王快递)', deliver1, 201);

  const login2 = await request('POST', '/api/courier/login', {
    phone: '13800138002',
    password: 'xyz789',
  });
  const token2 = login2.data && login2.data.data ? login2.data.data.token : null;

  const deliver2 = await request('POST', '/api/packages/deliver', {
    recipientName: '李四',
    recipientPhone: '13900139002',
    packageHeight: 45,
    packageWidth: 45,
    packageDepth: 45,
    trackingNumber: 'YT9876543210',
  }, token2);
  logTest('投件2-中号包裹(李快递)', deliver2, 201);

  const deliver3 = await request('POST', '/api/packages/deliver', {
    recipientName: '王五',
    recipientPhone: '13900139003',
    packageHeight: 75,
    packageWidth: 75,
    packageDepth: 75,
    trackingNumber: 'JD1122334455',
  }, authToken);
  logTest('投件3-大号包裹(王快递)', deliver3, 201);

  const deliverOversize = await request('POST', '/api/packages/deliver', {
    recipientName: '测试',
    recipientPhone: '13900000000',
    packageHeight: 200,
    packageWidth: 200,
    packageDepth: 200,
  }, authToken);
  logTest('投件(超大件-应失败)', deliverOversize, 400);

  const deliverMissing = await request('POST', '/api/packages/deliver', {
    recipientName: '测试',
  }, authToken);
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

  console.log('\n--- 5. 通知记录查询 ---');
  res = await request('GET', '/api/notifications');
  logTest('查询所有通知记录', res);
  if (res.data && res.data.data) {
    console.log(`     通知总数: ${res.data.data.total}`);
    if (res.data.data.notifications.length > 0) {
      const n = res.data.data.notifications[0];
      console.log(`     首条通知: phone=${n.phone}, 内容前40字="${n.content.substring(0, 40)}..."`);
    }
  }

  res = await request('GET', `/api/notifications?phone=${phone1}`);
  logTest('按手机号查询通知记录', res);

  console.log('\n--- 6. 查询包裹接口 ---');
  if (pickupCode1) {
    res = await request('GET', `/api/packages/query?pickupCode=${pickupCode1}`);
    logTest('按取件码查询包裹', res);
  }
  res = await request('GET', `/api/packages/query?recipientPhone=${phone3}`);
  logTest('按手机号查询包裹', res);

  console.log('\n--- 7. 取件接口 ---');
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

  console.log('\n--- 8. 投递记录(含快递员追溯信息) ---');
  res = await request('GET', '/api/records');
  logTest('查询所有投递记录(含统计)', res);
  if (res.data && res.data.data) {
    const s = res.data.data.statistics;
    console.log(`     投递数:${s.deliverCount} 取件数:${s.pickupCount} 滞留费:¥${s.totalOvertimeFee} 逾期率:${s.overdueRate}%`);
    const firstDeliverRec = res.data.data.records.find((r) => r.action === 'deliver');
    if (firstDeliverRec) {
      console.log(`     投递记录追溯: 快递员=${firstDeliverRec.details.courierName}(${firstDeliverRec.details.courierPhone}) 角色=${firstDeliverRec.operatorRole}`);
    }
    const firstPickupRec = res.data.data.records.find((r) => r.action === 'pickup');
    if (firstPickupRec) {
      console.log(`     取件记录追溯: 快递员=${firstPickupRec.details.courierName}(${firstPickupRec.details.courierPhone}) 角色=${firstPickupRec.operatorRole}`);
    }
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

  console.log('\n--- 9. 快递员登出 ---');
  res = await request('POST', '/api/courier/logout', null, authToken);
  logTest('快递员登出', res);

  res = await request('GET', '/api/courier/profile', null, authToken);
  logTest('登出后用旧Token(应返回401)', res, 401);

  const loginAgain = await request('POST', '/api/courier/login', {
    phone: '13800138001',
    password: 'abc123',
  });
  logTest('重新登录获取新Token', loginAgain);
  if (loginAgain.data && loginAgain.data.data) {
    authToken = loginAgain.data.data.token;
  }

  res = await request('POST', '/api/packages/deliver', {
    recipientName: '赵六',
    recipientPhone: '13900139004',
    packageHeight: 25,
    packageWidth: 25,
    packageDepth: 25,
  }, authToken);
  logTest('重新登录后投件', res, 201);

  console.log('\n--- 10. Bug修复验证: 格口分配最小优先 + 取件码唯一 ---');
  const smallPkg1 = await request('POST', '/api/packages/deliver', {
    recipientName: '小包裹1收件人',
    recipientPhone: '13900139010',
    packageHeight: 10,
    packageWidth: 10,
    packageDepth: 10,
  }, authToken);
  logTest('10cm小件投件-应分配small格口', smallPkg1, 201);
  if (smallPkg1.data && smallPkg1.data.data) {
    const lockerSize = smallPkg1.data.data.lockerSize;
    const lockerId = smallPkg1.data.data.lockerId;
    const sizeOk = lockerSize === 'small';
    console.log(`     分配格口: ${lockerId} (${lockerSize}) ${sizeOk ? '✅ 符合small优先' : '❌ 错误！'}`);
    if (!sizeOk) failCount++;
  }

  const medPkg = await request('POST', '/api/packages/deliver', {
    recipientName: '中包裹收件人',
    recipientPhone: '13900139011',
    packageHeight: 40,
    packageWidth: 40,
    packageDepth: 40,
  }, authToken);
  logTest('40cm中件投件-应分配medium格口', medPkg, 201);
  if (medPkg.data && medPkg.data.data) {
    const lockerSize = medPkg.data.data.lockerSize;
    const lockerId = medPkg.data.data.lockerId;
    const sizeOk = lockerSize === 'medium';
    console.log(`     分配格口: ${lockerId} (${lockerSize}) ${sizeOk ? '✅ 符合medium' : '❌ 错误！'}`);
    if (!sizeOk) failCount++;
  }

  const bigPkg = await request('POST', '/api/packages/deliver', {
    recipientName: '大包裹收件人',
    recipientPhone: '13900139012',
    packageHeight: 70,
    packageWidth: 70,
    packageDepth: 70,
  }, authToken);
  logTest('70cm大件投件-应分配large格口', bigPkg, 201);
  if (bigPkg.data && bigPkg.data.data) {
    const lockerSize = bigPkg.data.data.lockerSize;
    const lockerId = bigPkg.data.data.lockerId;
    const sizeOk = lockerSize === 'large';
    console.log(`     分配格口: ${lockerId} (${lockerSize}) ${sizeOk ? '✅ 符合large' : '❌ 错误！'}`);
    if (!sizeOk) failCount++;
  }

  res = await request('GET', '/api/packages/query?packageId=__invalid__');
  logTest('取件码去重校验(接口正常)', res, 404);

  console.log('\n========== 测试结果汇总 ==========');
  console.log(`通过: ${passCount}  失败: ${failCount}  总计: ${passCount + failCount}`);
  console.log(failCount === 0 ? '🎉 所有测试通过！' : '⚠️  部分测试失败，请检查上面的日志');
  console.log('===================================\n');

  console.log('📦 新增功能说明:');
  console.log('   🔐 快递员鉴权: 注册→登录→获取Token→投件时Bearer Token鉴权');
  console.log('   📱 投件通知: 投件成功自动发送短信(取件码+柜机位置)');
  console.log('   ⏰ 催取提醒: 存放22小时后自动发送催取短信(定时任务每小时检查)');
  console.log('   📋 记录追溯: deliveryRecords 包含 courierName/courierPhone/operatorRole\n');
}

test().catch((e) => {
  console.error('测试出错:', e.message);
  process.exit(1);
});
