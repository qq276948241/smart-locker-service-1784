const http = require('http');

function request(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== 智能快递柜 API 测试 ===\n');

  // 1. 健康检查
  console.log('1. 健康检查:');
  const health = await request('/api/health', 'GET');
  console.log('   状态:', health.status);
  console.log('   响应:', JSON.stringify(health.data).substring(0, 100));

  // 2. 格口统计
  console.log('\n2. 格口统计:');
  const lockerStats = await request('/api/lockers/stats', 'GET');
  console.log('   状态:', lockerStats.status);
  console.log('   总格口:', lockerStats.data.data.total);
  console.log('   可用:', lockerStats.data.data.available);
  console.log('   已占用:', lockerStats.data.data.occupied);

  // 3. 格口列表
  console.log('\n3. 格口列表:');
  const lockers = await request('/api/lockers', 'GET');
  console.log('   状态:', lockers.status);
  console.log('   格口数量:', lockers.data.data.length);
  console.log('   前3个:', JSON.stringify(lockers.data.data.slice(0, 3)));

  // 4. 投件测试
  console.log('\n4. 投件测试:');
  const storeData = {
    courierId: 'C001',
    courierName: '张快递',
    courierPhone: '13800138000',
    recipientName: '李用户',
    recipientPhone: '13900139000',
    size: 'small',
    expressCompany: '顺丰速运',
    trackingNumber: 'SF1234567890'
  };
  const storeResult = await request('/api/parcels/store', 'POST', storeData);
  console.log('   状态:', storeResult.status);
  console.log('   响应:', JSON.stringify(storeResult.data, null, 2).substring(0, 300));

  // 5. 取件测试（用取件码）
  console.log('\n5. 取件测试（取件码）:');
  if (storeResult.data.data && storeResult.data.data.pickupCode) {
    const pickupResult = await request('/api/parcels/pickup', 'POST', {
      pickupCode: storeResult.data.data.pickupCode
    });
    console.log('   状态:', pickupResult.status);
    console.log('   响应:', JSON.stringify(pickupResult.data, null, 2).substring(0, 300));
  }

  // 6. 投件测试（手机号取件场景）
  console.log('\n6. 投件测试（手机号取件场景）:');
  const storeResult2 = await request('/api/parcels/store', 'POST', {
    ...storeData,
    recipientPhone: '13700137000',
    size: 'medium'
  });
  console.log('   状态:', storeResult2.status);
  console.log('   取件码:', storeResult2.data.data?.pickupCode);

  // 7. 手机号查询待取包裹
  console.log('\n7. 手机号查询待取包裹:');
  const queryResult = await request('/api/parcels/pickup', 'POST', {
    phone: '13700137000'
  });
  console.log('   状态:', queryResult.status);
  console.log('   响应:', JSON.stringify(queryResult.data, null, 2).substring(0, 400));

  // 8. 投递记录统计
  console.log('\n8. 投递记录统计:');
  const stats = await request('/api/stats/records', 'GET');
  console.log('   状态:', stats.status);
  console.log('   汇总:', JSON.stringify(stats.data.data?.summary, null, 2).substring(0, 300));

  // 9. 总览统计
  console.log('\n9. 总览统计:');
  const overview = await request('/api/stats/overview', 'GET');
  console.log('   状态:', overview.status);
  console.log('   响应:', JSON.stringify(overview.data.data, null, 2).substring(0, 400));

  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
