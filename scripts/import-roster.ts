import './env';
import {existsSync,readFileSync} from 'node:fs';
import {createDatabase} from '../src/lib/database';
import {GatheringService} from '../src/lib/service';
async function main(){const url=process.argv.slice(2).find(a=>!a.startsWith('--'))||process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL diperlukan.');const source=process.argv.find(a=>a.startsWith('--source='))?.slice('--source='.length)||'data/roster-source.json';if(!existsSync(source))throw new Error('Daftar peserta privat belum disiapkan. Gunakan --source=PATH_JSON; contoh sintetis ada di examples/roster.example.json.');const database=createDatabase(url,process.env.DATABASE_AUTH_TOKEN||undefined);try{console.log(await new GatheringService(database).importRoster(JSON.parse(readFileSync(source,'utf8')),process.argv.includes('--refresh-official')));}finally{await database.client.close();}}
main().catch(e=>{console.error(e.message);process.exit(1);});
