#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

if (!process.env.CHROMATIC_PROJECT_TOKEN) {
  console.log('Skipping Chromatic visual audit: CHROMATIC_PROJECT_TOKEN is not set.');
  process.exit(0);
}

const buildResult = spawnSync('npm', ['run', 'build-storybook'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const result = spawnSync(
  'chromatic',
  [
    '--project-token',
    process.env.CHROMATIC_PROJECT_TOKEN,
    '--storybook-build-dir',
    'storybook-static',
    '--exit-zero-on-changes',
  ],
  {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  }
);

process.exit(result.status ?? 1);
