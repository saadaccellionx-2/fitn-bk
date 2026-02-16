const mongoose = require('mongoose')

mongoose.set('strictQuery', true);

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URI).then(() => {
    console.log(`✅ Database Connected : ${process.env.DATABASE_URI}`)
    
    // Start notification worker (integrated into main process)
    require('../workers/notificationWorker');
    
    // Check Redis connection (optional, won't fail if Redis is unavailable)
    checkRedisConnection();
}).catch(err => {
    console.error('❌ Database Connection Error', err)
})

// Check Redis connection status
async function checkRedisConnection() {
    try {
        const Redis = require('ioredis');
        const redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: () => null, // Disable auto-retry for connection check
            connectTimeout: 5000, // Increased timeout to 5 seconds
            lazyConnect: false,
        };

        const redis = new Redis(redisConfig);

        redis.on('connect', () => {
            const redisUrl = `${redisConfig.password ? 'redis://:***@' : 'redis://'}${redisConfig.host}:${redisConfig.port}`;
            console.log(`✅ Redis Connected : ${redisUrl}`);
        });

        redis.on('error', (err) => {
            // Log error with more context but don't crash the app
            console.error(`❌ Redis Connection Error : ${err.message}`);
            console.error(`   Host: ${redisConfig.host}:${redisConfig.port}`);
            console.error(`   Error Code: ${err.code || 'N/A'}`);
            console.error(`   Error Type: ${err.constructor.name}`);
            
            // Only quit if it's a critical error
            if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
                console.warn('   ⚠️  Redis connection failed, but app will continue without queue functionality');
            }
            
            // Don't quit immediately - let Bull handle reconnection
            // redis.quit();
        });

        redis.on('ready', () => {
            const redisUrl = `${redisConfig.password ? 'redis://:***@' : 'redis://'}${redisConfig.host}:${redisConfig.port}`;
            console.log(`✅ Redis Ready : ${redisUrl}`);
        });

        redis.on('close', () => {
            console.warn('⚠️  Redis connection closed');
        });

        redis.on('reconnecting', (delay) => {
            console.log(`🔄 Redis reconnecting in ${delay}ms...`);
        });

        // Test connection with ping (with timeout)
        const pingPromise = redis.ping();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
        );

        Promise.race([pingPromise, timeoutPromise])
            .then(() => {
                // Connection successful, already logged by 'ready' event
                console.log('✅ Redis ping successful');
            })
            .catch((err) => {
                // Error already logged by 'error' event, but log ping failure separately
                if (err.message === 'Redis ping timeout') {
                    console.warn('⚠️  Redis ping timeout - Redis may be slow or unavailable');
                } else {
                    console.warn(`⚠️  Redis ping failed: ${err.message}`);
                }
            });
    } catch (err) {
        // ioredis not available or other error
        console.error(`❌ Redis check failed: ${err.message}`);
        console.error(`   Stack: ${err.stack}`);
        console.warn('⚠️  App will continue without Redis queue functionality');
    }
}