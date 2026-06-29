module.exports = {
  apps: [
    {
      name: 'whatsapp-saas-backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5005,
        FEATURE_RECOVERY: 'true',
        FEATURE_SUBSCRIPTIONS: 'true',
        FEATURE_DELIVERY: 'true',
        FEATURE_MONITORING: 'true',
        FEATURE_MULTI_GATEWAY: 'true'
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
