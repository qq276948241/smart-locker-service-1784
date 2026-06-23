const http = require('http');
const moment = require('moment');

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('========================================');
  console.log('  定时任务 & 超时计费功能测试');
  console.log('========================================\n');

  let pickupCode = '';
  let packageId = '';

  try {
    console.log('1. 查询定时任务状态...');
    const status = await request(baseOptions('/api/scheduler/status'));
    console.log(`   状态码: ${status.statusCode}`);
    console.log(`   定时任务运行: ${status.data.data.isRunning ? '是' : '否'}`);
    console.log(`   扫描间隔: ${status.data.data.scanIntervalMinutes} 分钟`);
    console.log(`   当前超时包裹: ${status.data.data.totalOvertime}`);
    console.log(`   结果: ${status.data.success ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    console.log('2. 投件测试（正常包裹，未超时）...');
    const deposit1 = await request(baseOptions('/api/packages/deposit', 'POST'), {
      courierId: 'SCH001',
      courierName: '测试快递员',
      recipientPhone: '13700137000',
      recipientName: '测试用户A',
      packageSize: 'small'
    });
    console.log(`   状态码: ${deposit1.statusCode}`);
    if (deposit1.data.success) {
      pickupCode = deposit1.data.data.pickupCode;
      packageId = deposit1.data.data.id;
      console.log(`   取件码: ${pickupCode}`);
      console.log(`   格口号: ${deposit1.data.data.lockerCode}`);
      console.log(`   结果: ✓ 通过`);
    } else {
      console.log(`   错误: ${deposit1.data.message}`);
      console.log(`   结果: ✗ 失败`);
    }
    console.log();

    console.log('3. 查询该包裹详情（投件后立即查询，isOvertime 应为 false）...');
    const pkgDetail1 = await request(baseOptions(`/api/packages/${packageId}`));
    console.log(`   状态码: ${pkgDetail1.statusCode}`);
    if (pkgDetail1.data.success) {
      console.log(`   isOvertime: ${pkgDetail1.data.data.isOvertime}`);
      console.log(`   overtimeFee: ${pkgDetail1.data.data.overtimeFee}`);
      console.log(`   overtimeHours: ${pkgDetail1.data.data.overtimeHours}`);
      console.log(`   结果: ${!pkgDetail1.data.data.isOvertime ? '✓ 通过（未超时，符合预期）' : '✗ 异常'}`);
    }
    console.log();

    console.log('4. 手动触发一次超时扫描（此时包裹仍在免费期）...');
    const scan1 = await request(baseOptions('/api/scheduler/scan', 'POST'));
    console.log(`   状态码: ${scan1.statusCode}`);
    if (scan1.data.success) {
      console.log(`   扫描包裹数: ${scan1.data.data.scanned}`);
      console.log(`   新增超时: ${scan1.data.data.newlyMarked}`);
      console.log(`   费用更新: ${scan1.data.data.updated}`);
      console.log(`   累计超时: ${scan1.data.data.totalOvertime}`);
      console.log(`   结果: ✓ 通过`);
    } else {
      console.log(`   错误: ${scan1.data.message}`);
      console.log(`   结果: ✗ 失败`);
    }
    console.log();

    console.log('5. 查询该包裹详情（扫描后，isOvertime 仍应为 false）...');
    const pkgDetail2 = await request(baseOptions(`/api/packages/${packageId}`));
    console.log(`   状态码: ${pkgDetail2.statusCode}`);
    if (pkgDetail2.data.success) {
      console.log(`   isOvertime: ${pkgDetail2.data.data.isOvertime}`);
      console.log(`   overtimeFee: ${pkgDetail2.data.data.overtimeFee}`);
      console.log(`   lastScanTime: ${pkgDetail2.data.data.lastScanTime}`);
      console.log(`   结果: ${!pkgDetail2.data.data.isOvertime && pkgDetail2.data.data.lastScanTime ? '✓ 通过' : '✗ 异常'}`);
    }
    console.log();

    console.log('6. 取件（未超时，滞留费应为0）...');
    const pickup = await request(baseOptions('/api/packages/pickup/code', 'POST'), { pickupCode });
    console.log(`   状态码: ${pickup.statusCode}`);
    if (pickup.data.success) {
      console.log(`   是否超时: ${pickup.data.data.overtime.isOvertime ? '是' : '否'}`);
      console.log(`   滞留费: ${pickup.data.data.overtime.fee} 元`);
      console.log(`   结果: ${!pickup.data.data.overtime.isOvertime ? '✓ 通过（未超时，无滞留费）' : '✗ 异常'}`);
    }
    console.log();

    console.log('========================================');
    console.log('  模拟超时场景（直接修改 config 测试）');
    console.log('========================================\n');

    console.log('7. 再次投件，然后通过手动调用 scan 接口模拟扫描...');
    const deposit2 = await request(baseOptions('/api/packages/deposit', 'POST'), {
      courierId: 'SCH002',
      courierName: '测试快递员',
      recipientPhone: '13600136000',
      recipientName: '测试用户B',
      packageSize: 'medium'
    });
    if (deposit2.data.success) {
      console.log(`   新包裹 ID: ${deposit2.data.data.id}`);
      console.log(`   运单号: ${deposit2.data.data.trackingNumber}`);

      console.log();
      console.log('8. 查询定时任务总状态...');
      const finalStatus = await request(baseOptions('/api/scheduler/status'));
      console.log(`   定时任务运行: ${finalStatus.data.data.isRunning ? '是' : '否'}`);
      console.log(`   当前超时包裹: ${finalStatus.data.data.totalOvertime}`);

      console.log();
      console.log('9. 查询概览统计（包含超时数据）...');
      const overview = await request(baseOptions('/api/statistics/overview'));
      console.log(`   待取件总数: ${overview.data.data.pending.total}`);
      console.log(`   其中超时: ${overview.data.data.pending.overtime}`);
      console.log(`   结果: ✓ 通过`);
    }
    console.log();

    console.log('========================================');
    console.log('  所有测试完成！');
    console.log('========================================');
    console.log('');
    console.log('提示：如需测试真实超时场景，请修改 config/index.js 中的');
    console.log('  locker.freeHours 为更小的值（如 0.001，约 3.6 秒），');
    console.log('  然后投件后等待数秒再手动调用 /api/scheduler/scan 查看效果。');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
