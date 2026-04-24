import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['./node_modules/astro/astro.js', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
