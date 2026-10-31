require('dotenv').config({path:require('node:path').join(__dirname,'../../.env'),quiet:true});
const {initializeDatabase}=require('../config/database');
const {runOnce}=require('./runner');
const {randomUUID}=require('node:crypto');
const owner=`worker-${process.pid}-${randomUUID()}`;
let stopping=false;
const abort=new AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopping=true;abort.abort();});
(async()=>{
 await initializeDatabase();
 while(!stopping){try{if(!await runOnce({owner,signal:abort.signal}))await new Promise(r=>setTimeout(r,750));}catch{console.error('[Worker] Database unavailable; retrying');await new Promise(r=>setTimeout(r,1500));}}
 process.exit(0);
})().catch(()=>{console.error('[Worker] Startup failed');process.exit(1);});
