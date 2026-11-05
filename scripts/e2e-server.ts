import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {createDatabase} from '../src/lib/database';
import {GatheringService} from '../src/lib/service';
import {Pool} from 'pg';
async function main(){
let testUrl=`file:data/e2e-${Date.now()}.db`;
if(process.env.UT_TEST_POSTGRES_URL){
  const url=new URL(process.env.UT_TEST_POSTGRES_URL);
  if(url.hostname!=='127.0.0.1'||url.port!=='55432')throw new Error('Cluster E2E PostgreSQL harus lokal.');
  const admin=new Pool({connectionString:url.toString()});const name=`ut_e2e_${Date.now()}`;
  try{await admin.query(`CREATE DATABASE ${name}`);}finally{await admin.end();}
  url.pathname=`/${name}`;testUrl=url.toString();
}
const testDB=createDatabase(testUrl);
await new GatheringService(testDB).importRoster([...Array.from({length:60},(_,i)=>({nrp:String(i+1).padStart(6,'0'),fullName:`Penjelajah Uji ${i+1}`,company:'UT',plannedSize:3,tableNumber:String(i%34+1),source:'excel',drawEnabled:true})),{nrp:'99000001',fullName:'Peserta UTS Uji',company:'UTS',plannedSize:1,tableNumber:'7',source:'uts',drawEnabled:false}]);
await testDB.client.close();
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, APP_BASE_URL: 'http://127.0.0.1:3100', DATABASE_URL: testUrl,
    DATABASE_AUTH_TOKEN: '', ADMIN_PASSWORD: 'e2e-space-password', SESSION_SECRET: 'e2e-only-secret-at-least-thirty-two-characters-long' },
});
child.on('exit', code => process.exit(code || 0));
process.on('SIGTERM', () => child.kill()); process.on('SIGINT', () => child.kill());

}
main().catch(e=>{console.error(e);process.exit(1);});
