import { spawn } from 'node:child_process';
const service=process.env.NULLGE_SERVICE;
const commands={
  console:['apps/console/node_modules/next/dist/bin/next','start','apps/console','--hostname','::','--port',process.env.PORT || '8080'],
  api:['apps/api/dist/main.js'],
  worker:['apps/worker/dist/main.js'],
};
if (!commands[service]) throw new Error('NULLGE_SERVICE must be console, api, or worker.');
const child=spawn(process.execPath,commands[service],{stdio:'inherit',env:{...process.env,API_HOST:process.env.API_HOST || '::'}});
process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGINT'));
child.on('exit',(code)=>{process.exitCode=code || 0;});
