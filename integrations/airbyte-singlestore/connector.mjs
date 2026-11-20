import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';

const emit=message=>process.stdout.write(JSON.stringify(message)+'\n');
const args=process.argv.slice(2), command=args[0];
const flag=name=>args[args.indexOf(name)+1];
const specification={documentationUrl:'https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol',supportsIncremental:true,supported_destination_sync_modes:['append'],connectionSpecification:{type:'object',additionalProperties:false,required:['url','database','username','password'],properties:{url:{type:'string',title:'SingleStore HTTPS server'},database:{type:'string',title:'Database'},username:{type:'string',title:'Database username'},password:{type:'string',title:'Database password',airbyte_secret:true}}}};
const TABLE='substation_airbyte_catalog';
const CREATE='CREATE TABLE IF NOT EXISTS '+TABLE+' (record_id VARCHAR(64) NOT NULL PRIMARY KEY, record_json LONGTEXT NOT NULL, airbyte_emitted_at BIGINT NOT NULL, airbyte_synced_at VARCHAR(30) NOT NULL)';
export async function sql(config,statement,parameters=[],fetcher=fetch){
  const base=new URL(config.url);
  if(base.protocol!=='https:'||!base.hostname.endsWith('.singlestore.com'))throw Error('Use the SingleStore HTTPS server.');
  const path=statement.startsWith('SELECT')?'query/rows':'exec';
  const response=await fetcher(base.origin+'/api/v2/'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Basic '+Buffer.from(config.username+':'+config.password).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify({database:config.database,sql:statement,args:parameters})});
  if(!response.ok)throw Error('SingleStore Data API returned HTTP '+response.status);
  const result=await response.json();
  if(result.error)throw Error('SingleStore rejected the catalog query.');
  return result;
}
export async function write(config,lines,{execute=sql,output=emit,now=()=>new Date().toISOString()}={}){
  let count=0,ready=false;
  for await(const line of lines){
    if(!line.trim())continue;
    const message=JSON.parse(line);
    if(message.type==='RECORD'){
      const r=message.record, d=r?.data;
      if(!d||!Number.isFinite(r.emitted_at))throw Error('Invalid Airbyte record.');
      if(!ready){await execute(config,CREATE);ready=true;}
      const id=createHash('sha256').update(JSON.stringify([r.stream,r.namespace??null,d.merchant,d.item_id,d.gtin,d.observed_at])).digest('hex');
      const syncedAt=now();
      await execute(config,'INSERT INTO '+TABLE+' (record_id,record_json,airbyte_emitted_at,airbyte_synced_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), airbyte_emitted_at=VALUES(airbyte_emitted_at), airbyte_synced_at=VALUES(airbyte_synced_at)',[id,JSON.stringify(message),r.emitted_at,syncedAt]);
      const saved=await execute(config,'SELECT record_json FROM '+TABLE+' WHERE record_id=?',[id]);
      if(saved.results?.[0]?.rows?.[0]?.record_json!==JSON.stringify(message))throw Error('Catalog readback did not match the Airbyte record.');
      count++;
    }else if(message.type==='STATE'){
      // All preceding records have committed and passed readback before this acknowledgement.
      output(message);
    }
  }
  output({type:'LOG',log:{level:'INFO',message:'Committed and read back '+count+' Airbyte catalog record(s) in '+TABLE+'.'}});
  return count;
}
async function main(){
  if(command==='spec'){emit({type:'SPEC',spec:specification});return;}
  const config=JSON.parse(readFileSync(flag('--config'),'utf8'));
  if(command==='check'){
    try{const result=await sql(config,'SELECT 1 AS connected');if(result.results?.[0]?.rows?.[0]?.connected!==1)throw Error('Read-only check did not return the expected result.');emit({type:'CONNECTION_STATUS',connectionStatus:{status:'SUCCEEDED'}});}
    catch(error){emit({type:'CONNECTION_STATUS',connectionStatus:{status:'FAILED',message:error.message}});}
    return;
  }
  if(command==='write'){
    const catalog=JSON.parse(readFileSync(flag('--catalog'),'utf8'));
    if(catalog.streams.some(s=>s.destination_sync_mode!=='append'))throw Error('The catalog connector supports append mode.');
    await write(config,createInterface({input:process.stdin,crlfDelay:Infinity}));return;
  }
  throw Error('Supported commands: spec, check, write.');
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(error=>{emit({type:'TRACE',trace:{type:'ERROR',emitted_at:Date.now(),error:{message:error.message,internal_message:error.message,failure_type:'system_error'}}});process.exitCode=1;});
