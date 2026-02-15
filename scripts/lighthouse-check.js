import { execSync } from 'child_process';

try {
  execSync('npx lhci autorun', { stdio: 'inherit' });
} catch (error) {
  console.error('Lighthouse CI failed.');
  process.exit(1);
}
