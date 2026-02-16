const express = require('express');
const notificationQueue = require('../queue/notificationQueue');
const router = express.Router();

/**
 * GET /api/v1/admin/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      notificationQueue.getWaitingCount(),
      notificationQueue.getActiveCount(),
      notificationQueue.getCompletedCount(),
      notificationQueue.getFailedCount(),
      notificationQueue.getDelayedCount(),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching queue statistics',
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/queue/retry-failed
 * Retry all failed jobs
 */
router.post('/queue/retry-failed', async (req, res) => {
  try {
    const failedJobs = await notificationQueue.getFailed();
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        console.error(`Error retrying job ${job.id}:`, error.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Retried ${retriedCount} failed jobs`,
      retried: retriedCount,
      total: failedJobs.length,
    });
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrying failed jobs',
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/admin/queue/clean
 * Clean completed and failed jobs older than threshold
 * Query param: olderThan (default: 86400000 = 24 hours in ms)
 */
router.post('/queue/clean', async (req, res) => {
  try {
    const olderThan = parseInt(req.body.olderThan) || 86400000; // Default 24 hours
    const threshold = Date.now() - olderThan;

    // Clean completed jobs
    await notificationQueue.clean(threshold, 'completed');
    
    // Clean failed jobs
    await notificationQueue.clean(threshold, 'failed');

    return res.status(200).json({
      success: true,
      message: `Cleaned jobs older than ${olderThan}ms`,
      olderThan,
    });
  } catch (error) {
    console.error('Error cleaning queue:', error);
    return res.status(500).json({
      success: false,
      message: 'Error cleaning queue',
      error: error.message,
    });
  }
});

module.exports = router;

