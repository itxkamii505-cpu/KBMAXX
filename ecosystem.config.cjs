// pm2 process definition. Start with:  pm2 startOrReload ecosystem.config.cjs --update-env
module.exports = {
  apps: [
    {
      name: 'sms-gateway',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,            // single instance: state lives in memory
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '900M',
      kill_timeout: 10000,     // gives the server time to flush data on SIGTERM
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
        TZ: 'Asia/Karachi',
      },
    },
  ],
};
