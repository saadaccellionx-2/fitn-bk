const Queue = require('bull');

// Redis connection configuration with retry strategy
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, max 5000ms
    const delay = Math.min(times * 50, 5000);
    console.log(`Redis connection retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect if error is READONLY
      return true;
    }
    // Don't reconnect on other errors
    return false;
  },
  // Connection timeout
  connectTimeout: 10000,
  // Lazy connect - don't connect immediately
  lazyConnect: false,
};

// Create Bull queue with error handling
let notificationQueue;

try {
  notificationQueue = new Queue('notifications', {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: true, // Auto-cleanup completed jobs
      attempts: 3, // Retry 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5s delay
      },
    },
    settings: {
      // Stalled interval - check for stalled jobs every 30 seconds
      stalledInterval: 30000,
      // Max stalled count before marking as failed
      maxStalledCount: 1,
    },
  });

  // Event listeners for monitoring and error handling
  notificationQueue.on('error', (error) => {
    // Log Redis connection errors but don't crash the app
    console.error(`❌ Bull Queue Redis Error: ${error.message}`);
    // Don't throw - let the app continue running
  });

  notificationQueue.on('waiting', (jobId) => {
    console.log(`📋 Queue job ${jobId} is waiting`);
  });

  notificationQueue.on('active', (job) => {
    console.log(`🔄 Queue job ${job.id} is now active`);
  });

  notificationQueue.on('completed', (job, result) => {
    console.log(`✅ Queue job ${job.id} completed successfully`);
  });

  notificationQueue.on('failed', (job, err) => {
    console.error(`❌ Queue job ${job?.id} failed:`, err.message);
  });

  notificationQueue.on('stalled', (jobId) => {
    console.warn(`⚠️  Queue job ${jobId} stalled`);
  });

  // Handle Redis connection events
  notificationQueue.on('redis:ready', () => {
    console.log('✅ Bull Queue Redis connection ready');
  });

  notificationQueue.on('redis:error', (error) => {
    console.error(`❌ Bull Queue Redis connection error: ${error.message}`);
  });

  console.log('✅ Notification queue initialized');
} catch (error) {
  console.error(`❌ Failed to initialize Bull queue: ${error.message}`);
  // Create a mock queue object to prevent app crashes
  notificationQueue = {
    add: () => Promise.resolve(),
    process: () => {},
    getWaitingCount: () => Promise.resolve(0),
    getActiveCount: () => Promise.resolve(0),
    getCompletedCount: () => Promise.resolve(0),
    getFailedCount: () => Promise.resolve(0),
    getDelayedCount: () => Promise.resolve(0),
    getFailed: () => Promise.resolve([]),
    clean: () => Promise.resolve([]),
    on: () => {},
  };
  console.warn('⚠️  Queue operations disabled due to initialization error');
}

module.exports = notificationQueue;

