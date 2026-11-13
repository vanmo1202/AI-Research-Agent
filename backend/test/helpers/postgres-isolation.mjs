import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
if(!/^researchos_(?:migration_test|test_)/.test(process.env.PGDATABASE||''))throw Error('Tests require an isolated researchos test database');
// node --test preloads this module in the coordinator and each test subprocess.
// Child application/reader processes inherit the same schema; separate test files do not.
if(process.env.NODE_TEST_CONTEXT&&!process.env.PGSCHEMA){
 const schema='test_'+randomUUID().replaceAll('-','');
 const client=new pg.Client({password:process.env.PGPASSWORD_FILE?readFileSync(process.env.PGPASSWORD_FILE,'utf8').trim():process.env.PGPASSWORD});
 await client.connect();await client.query(`CREATE SCHEMA "${schema}"`);await client.end();
 process.env.PGSCHEMA=schema;
}
process.env.RESEARCH_LOAD_ENV='false';
