/**
 * GreenWaveCoin — PM2 Ecosystem Configuration
 * =============================================
 * Use this file to manage the backend coordinator with PM2 for
 * production deployments without Docker.
 *
 * Usage:
 *   npm install -g pm2
 *   cd backend && npm run build
 *   pm2 start ecosystem.config.js
 *   pm2 save          # persist across reboots
 *   pm2 startup       # auto-start on boot
 *   pm2 logs gwc-coordinator
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'gwc-coordinator',
      script: './backend/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/coordinator-error.log',
      out_file: './logs/coordinator-out.log',
      merge_logs: true,
    },
  ],
};
