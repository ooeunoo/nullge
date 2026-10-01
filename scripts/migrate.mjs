import { spawnSync } from 'node:child_process';
for (const action of ['migrate', 'bootstrap']) {
  if (
    spawnSync(process.execPath, ['packages/database/dist/cli.js', action], {
      stdio: 'inherit',
      env: process.env,
    }).status !== 0
  )
    process.exit(1);
}
