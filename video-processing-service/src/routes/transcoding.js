const express = require('express');
const { getCurrentCPUUsage, getCPUUsageHistory, getSystemInfo, getMemoryUsage } = require('../utils/cpuMonitor');
const transcodingService = require('../services/transcodingService');

const router = express.Router();

// Get transcoding job status
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobStatus = await transcodingService.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get current CPU usage
        const cpuUsage = await getCurrentCPUUsage();

        res.json({
            job: jobStatus,
            currentCPUUsage: cpuUsage,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all active transcoding jobs
router.get('/jobs', async (req, res) => {
    try {
        const activeJobs = await transcodingService.getActiveJobs();
        const cpuUsage = await getCurrentCPUUsage();
        const systemInfo = getSystemInfo();
        const memoryUsage = getMemoryUsage();

        res.json({
            activeJobs,
            systemMetrics: {
                cpuUsage,
                memoryUsage,
                systemInfo
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting active jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel transcoding job
router.delete('/cancel/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        await transcodingService.cancelJob(jobId);

        res.json({
            success: true,
            message: 'Job cancelled successfully',
            jobId: jobId
        });

    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get system metrics
router.get('/metrics', async (req, res) => {
    try {
        const cpuUsage = await getCurrentCPUUsage();
        const cpuHistory = getCPUUsageHistory();
        const systemInfo = getSystemInfo();
        const memoryUsage = getMemoryUsage();

        res.json({
            cpu: {
                current: cpuUsage,
                history: cpuHistory.slice(-20) // Last 20 readings
            },
            memory: memoryUsage,
            system: systemInfo,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test CPU-intensive operation
router.post('/test-cpu', async (req, res) => {
    try {
        const { duration = 30 } = req.body; // Default 30 seconds

        console.log(`🔥 Starting CPU test for ${duration} seconds`);

        // Start CPU-intensive operation
        const startTime = Date.now();
        const cpuUsageHistory = [];

        const interval = setInterval(async () => {
            const cpuUsage = await getCurrentCPUUsage();
            cpuUsageHistory.push({ timestamp: new Date().toISOString(), usage: cpuUsage });

            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`📊 CPU Test - Elapsed: ${elapsed.toFixed(1)}s, CPU: ${cpuUsage}%`);

            if (elapsed >= duration) {
                clearInterval(interval);
                console.log('✅ CPU test completed');
            }
        }, 1000);

        // Simulate CPU-intensive work
        const cpuIntensiveWork = () => {
            let result = 0;
            for (let i = 0; i < 1000000; i++) {
                result += Math.sqrt(i) * Math.sin(i);
            }
            return result;
        };

        // Run CPU-intensive work in background
        const workInterval = setInterval(() => {
            cpuIntensiveWork();
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed >= duration) {
                clearInterval(workInterval);
            }
        }, 100);

        res.json({
            success: true,
            message: `CPU test started for ${duration} seconds`,
            startTime: new Date().toISOString(),
            duration: duration
        });

    } catch (error) {
        console.error('Error starting CPU test:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
