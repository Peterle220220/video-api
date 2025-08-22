const os = require('os');

let cpuUsageHistory = [];
let monitoringInterval = null;

// Get current CPU usage
function getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    return {
        idle: totalIdle / cpus.length,
        total: totalTick / cpus.length
    };
}

// Calculate CPU usage percentage
function calculateCPUUsage() {
    const startMeasure = getCPUUsage();

    return new Promise((resolve) => {
        setTimeout(() => {
            const endMeasure = getCPUUsage();
            const idleDifference = endMeasure.idle - startMeasure.idle;
            const totalDifference = endMeasure.total - startMeasure.total;
            const percentageCPU = 100 - (100 * idleDifference / totalDifference);

            resolve(Math.round(percentageCPU * 100) / 100);
        }, 100);
    });
}

// Start CPU monitoring
function startCPUMonitoring() {
    const interval = parseInt(process.env.CPU_MONITORING_INTERVAL) || 1000;

    monitoringInterval = setInterval(async () => {
        try {
            const cpuUsage = await calculateCPUUsage();
            const timestamp = new Date().toISOString();

            // Store in memory (keep last 100 readings)
            cpuUsageHistory.push({ timestamp, usage: cpuUsage });
            if (cpuUsageHistory.length > 100) {
                cpuUsageHistory.shift();
            }

            // Log high CPU usage
            if (cpuUsage > 80) {
                console.log(`🔥 High CPU Usage: ${cpuUsage}% at ${timestamp}`);
            }

        } catch (error) {
            console.error('CPU monitoring error:', error);
        }
    }, interval);

    console.log(`📊 CPU monitoring started (interval: ${interval}ms)`);
}

// Stop CPU monitoring
function stopCPUMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('📊 CPU monitoring stopped');
    }
}

// Get current CPU usage
async function getCurrentCPUUsage() {
    return await calculateCPUUsage();
}

// Get CPU usage history
function getCPUUsageHistory() {
    return cpuUsageHistory;
}

// Get system information
function getSystemInfo() {
    return {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        uptime: os.uptime()
    };
}

// Get memory usage
function getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100 * 100) / 100
    };
}

module.exports = {
    startCPUMonitoring,
    stopCPUMonitoring,
    getCurrentCPUUsage,
    getCPUUsageHistory,
    getSystemInfo,
    getMemoryUsage
};
