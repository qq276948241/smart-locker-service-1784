const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
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

function baseOptions(path, method = 'GET') {
  return {
    hostname: 'localhost',
    port: 3000,
    path,
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

async function runTests() {
  console.log('========================================');
  console.log('  智能快递柜 API 接口测试');
  console.log('========================================\n');

  let pickupCode = '';
  let trackingNumber = '';

  try {
    console.log('1. 测试健康检查接口...');
    const health = await request(baseOptions('/health'));
    console.log(`   状态码: ${health.statusCode}`);
    console.log(`   结果: ${health.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('2. 测试格口统计接口...');
    const lockerStats = await request(baseOptions('/api/lockers/stats'));
    console.log(`   状态码: ${lockerStats.statusCode}`);
    console.log(`   总格口数: ${lockerStats.data.data.total}`);
    console.log(`   可用格口: ${lockerStats.data.data.available}`);
    console.log(`   结果: ${lockerStats.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('3. 测试格口列表接口...');
    const lockers = await request(baseOptions('/api/lockers?status=available&size=small'));
    console.log(`   状态码: ${lockers.statusCode}`);
    console.log(`   可用小号格口数: ${lockers.data.data.count}`);
    console.log(`   结果: ${lockers.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('4. 测试投件接口...');
    const depositData = {
      courierId: 'COURIER001',
      courierName: '张快递',
      recipientPhone: '13800138000',
      recipientName: '李四',
      packageSize: 'small',
      remarks: '请尽快取件'
    };
    const deposit = await request(baseOptions('/api/packages/deposit', 'POST'), depositData);
    console.log(`   状态码: ${deposit.statusCode}`);
    if (deposit.data.success) {
      console.log(`   格口号: ${deposit.data.data.lockerCode}`);
      console.log(`   取件码: ${deposit.data.data.pickupCode}`);
      pickupCode = deposit.data.data.pickupCode;
      trackingNumber = deposit.data.data.trackingNumber;
      console.log(`   运单号: ${trackingNumber}`);
      console.log(`   结果: ✓ 通过`);
    } else {
      console.log(`   错误: ${deposit.data.message}`);
      console.log(`   结果: ✗ 失败`);
    }
    console.log();

    console.log('5. 测试投件后格口状态...');
    const lockerStats2 = await request(baseOptions('/api/lockers/stats'));
    console.log(`   状态码: ${lockerStats2.statusCode}`);
    console.log(`   可用格口: ${lockerStats2.data.data.available}`);
    console.log(`   已占用: ${lockerStats2.data.data.occupied}`);
    console.log(`   结果: ${lockerStats2.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('6. 测试查询手机号待取件...');
    const pending = await request(baseOptions('/api/packages/phone/13800138000'));
    console.log(`   状态码: ${pending.statusCode}`);
    console.log(`   待取件数: ${pending.data.data.count}`);
    console.log(`   结果: ${pending.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('7. 测试凭取件码取件...');
    const pickup = await request(baseOptions('/api/packages/pickup/code', 'POST'), { pickupCode });
    console.log(`   状态码: ${pickup.statusCode}`);
    if (pickup.data.success) {
      console.log(`   格口号: ${pickup.data.data.lockerCode}`);
      console.log(`   是否超时: ${pickup.data.data.overtime.isOvertime ? '是' : '否'}`);
      console.log(`   滞留费: ${pickup.data.data.overtime.fee} 元`);
      console.log(`   结果: ✓ 通过`);
    } else {
      console.log(`   错误: ${pickup.data.message}`);
      console.log(`   结果: ✗ 失败`);
    }
    console.log();

    console.log('8. 测试取件后格口状态...');
    const lockerStats3 = await request(baseOptions('/api/lockers/stats'));
    console.log(`   状态码: ${lockerStats3.statusCode}`);
    console.log(`   可用格口: ${lockerStats3.data.data.available}`);
    console.log(`   已占用: ${lockerStats3.data.data.occupied}`);
    console.log(`   结果: ${lockerStats3.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('9. 测试手机号批量取件（先投2件）...');
    await request(baseOptions('/api/packages/deposit', 'POST'), {
      courierId: 'COURIER001',
      courierName: '张快递',
      recipientPhone: '13900139000',
      recipientName: '王五',
      packageSize: 'medium'
    });
    await request(baseOptions('/api/packages/deposit', 'POST'), {
      courierId: 'COURIER002',
      courierName: '李快递',
      recipientPhone: '13900139000',
      recipientName: '王五',
      packageSize: 'large'
    });
    
    const pickupByPhone = await request(baseOptions('/api/packages/pickup/phone', 'POST'), { 
      recipientPhone: '13900139000' 
    });
    console.log(`   状态码: ${pickupByPhone.statusCode}`);
    if (pickupByPhone.data.success) {
      console.log(`   取出件数: ${pickupByPhone.data.data.count}`);
      console.log(`   总滞留费: ${pickupByPhone.data.data.totalOvertimeFee} 元`);
      console.log(`   结果: ✓ 通过`);
    } else {
      console.log(`   错误: ${pickupByPhone.data.message}`);
      console.log(`   结果: ✗ 失败`);
    }
    console.log();

    console.log('10. 测试概览统计接口...');
    const overview = await request(baseOptions('/api/statistics/overview'));
    console.log(`   状态码: ${overview.statusCode}`);
    console.log(`   今日投递: ${overview.data.data.today.deposited}`);
    console.log(`   今日取件: ${overview.data.data.today.pickedUp}`);
    console.log(`   待取件总数: ${overview.data.data.pending.total}`);
    console.log(`   结果: ${overview.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('11. 测试按时间段统计接口...');
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    
    const stats = await request(baseOptions(`/api/statistics/packages?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`));
    console.log(`   状态码: ${stats.statusCode}`);
    console.log(`   总投递数: ${stats.data.data.totalDeposited}`);
    console.log(`   总取件数: ${stats.data.data.totalPickedUp}`);
    console.log(`   按尺寸统计 - 小:${stats.data.data.bySize.small} 中:${stats.data.data.bySize.medium} 大:${stats.data.data.bySize.large}`);
    console.log(`   结果: ${stats.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('12. 测试运单号查询...');
    const byTracking = await request(baseOptions(`/api/packages/tracking/${trackingNumber}`));
    console.log(`   状态码: ${byTracking.statusCode}`);
    console.log(`   运单号: ${byTracking.data.data.trackingNumber}`);
    console.log(`   状态: ${byTracking.data.data.status}`);
    console.log(`   结果: ${byTracking.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('========================================');
    console.log('  所有测试完成！');
    console.log('========================================');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
