const config = require('../config');
const packageModel = require('../models/Package');

class OvertimeScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.scanIntervalMs = (config.scheduler.scanIntervalMinutes || 5) * 60 * 1000;
  }

  runScan() {
    if (this.isRunning) {
      console.log(`[Scheduler] 上一次扫描仍在进行中，跳过本次扫描`);
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      const result = packageModel.scanAndMarkOvertime();
      const duration = new Date() - startTime;

      console.log(`[Scheduler] 超时扫描完成 - ${startTime.toLocaleString()}`);
      console.log(`  扫描包裹数: ${result.scanned}`);
      console.log(`  新增超时: ${result.newlyMarked}`);
      console.log(`  费用更新: ${result.updated}`);
      console.log(`  累计超时包裹: ${result.totalOvertime}`);
      console.log(`  耗时: ${duration}ms`);
      console.log('');

      return result;
    } catch (err) {
      console.error(`[Scheduler] 扫描发生错误: ${err.message}`);
      console.error(err.stack);
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      console.log('[Scheduler] 定时任务已在运行中');
      return;
    }

    console.log('');
    console.log('========================================');
    console.log('  超时扫描定时任务启动');
    console.log(`  扫描间隔: ${config.scheduler.scanIntervalMinutes} 分钟`);
    console.log(`  免费时长: ${config.locker.freeHours} 小时`);
    console.log(`  超时费率: ${config.locker.overtimeFeePerHour} 元/小时`);
    console.log('========================================');
    console.log('');

    this.runScan();

    this.intervalId = setInterval(() => {
      this.runScan();
    }, this.scanIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] 定时任务已停止');
    }
  }

  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      scanIntervalMinutes: config.scheduler.scanIntervalMinutes,
      lastScan: this.isRunning ? '进行中' : '已完成',
      totalOvertime: packageModel.findDeposited().filter(p => p.isOvertime).length
    };
  }
}

module.exports = new OvertimeScheduler();
