const os = require('os');
const osUtils = require('os-utils');

let cpuHistory = [];
let isMonitoring = false;

async function getCurrentCPUUsage() {
    return new Promise((resolve) => {
        osUtils.cpuUsage((usage) => {
            const cpuPercent = Math.round(usage * 100);
            resolve(cpuPercent);
        });
    });
}

function getCPUUsageHistory() {
    return [...cpuHistory];
}

function getSystemInfo() {
    return {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime()
    };
}

function getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: Math.round((usedMemory / totalMemory) * 100)
    };
}

function startCPUMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    const interval = setInterval(async () => {
        try {
            const cpuUsage = await getCurrentCPUUsage();
            const timestamp = new Date().toISOString();
            
            // Add to history
            cpuHistory.push({ timestamp, usage: cpuUsage });
            
            // Keep only last 100 readings
            if (cpuHistory.length > 100) {
                cpuHistory = cpuHistory.slice(-100);
            }
            
            // Log high CPU usage
            if (cpuUsage > 80) {
                console.log(`⚠️ High CPU usage: ${cpuUsage}%`);
            }
            
        } catch (error) {
            console.error('Error monitoring CPU:', error);
        }
    }, 1000); // Monitor every second
    
    console.log('📊 CPU monitoring started');
}

module.exports = {
    getCurrentCPUUsage,
    getCPUUsageHistory,
    getSystemInfo,
    getMemoryUsage,
    startCPUMonitoring
};
