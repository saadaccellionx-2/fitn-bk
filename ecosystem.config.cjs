module.exports = {
  apps: [
    {
      name: "fitn-bk",
      script: "./bin/www",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",  
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
      auto_restart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,              // Wait 4 seconds before restarting
      exp_backoff_restart_delay: 100,   // Exponential backoff starting at 100ms
      listen_timeout: 10000,            // Wait 10 seconds for app to listen
      kill_timeout: 5000,               // Wait 5 seconds for graceful shutdown
      instance_var: "INSTANCE_ID",       // Better process identification
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Log rotation settings
      max_size: "100M",              // Rotate when log reaches 100MB
      retain: 30,                    // Keep 30 rotated log files
      compress: true,                // Compress rotated logs
      rotateInterval: "0 0 * * *",   // Daily rotation at midnight
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
