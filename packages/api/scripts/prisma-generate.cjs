const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://knazawy:knazawy@localhost:5432/knazawy?schema=public';
}

const result = spawnSync('npx prisma generate', {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
