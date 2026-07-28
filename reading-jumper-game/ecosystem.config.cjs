module.exports = {
  apps: [{
    name: 'zyb-reading-jumper',
    script: 'server/index.mjs',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 8081,
    },
  }],
};
