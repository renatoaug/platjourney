// pm2 process file: `npx pm2 start ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'platjourney',
      script: 'apps/server/src/index.ts',
      interpreter: 'bun',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'platjourney-ai',
      script: 'uv',
      args: 'run platjourney-ai',
      interpreter: 'none',
      cwd: `${__dirname}/services/ai`,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
    },
  ],
}
