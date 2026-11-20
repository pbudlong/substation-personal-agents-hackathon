import {investigate} from './agent.mjs';
import {hasSql,readSql,saveSql,sendAmplitude,queryCognee,applyAirbyte,readAirbyteSql} from './sponsors.mjs';
export async function getRun(env,id){
  if(hasSql(env)){
    try{const run=await readSql(env,id);if(run)return {run,backend:'SingleStore'};}catch{}
  }
  const raw=await env.BUCKET?.get('runs/'+id+'.json');
  if(!raw)return null;
  return {run:JSON.parse(await raw.text()),backend:env.LOCAL_STORAGE?'local filesystem':'Sites object storage'};
}
export async function execute(scope,env){
  const start=Date.now(), integrations={}, enrich=async(offers,log,id)=>{
    try{
      let feed;
      if(env.AIRBYTE_CONNECTION_ID&&env.AIRBYTE_JOB_ID&&hasSql(env))feed=await readAirbyteSql(env);
      else{const raw=await env.BUCKET?.get('feeds/airbyte.json');feed=raw?JSON.parse(await raw.text()):null;}
      integrations.airbyte=applyAirbyte(offers,feed,log);
    }catch(error){integrations.airbyte={status:'failed',reason:error.message};}
    if(scope!=='pickup'||!env.COGNEE_URL||!env.COGNEE_API_KEY){integrations.cognee={status:'not connected'};return;}
    try{
      const result=await queryCognee(env,offers,log,id);
      integrations.cognee=result;
      return result.targets;
    }catch(error){integrations.cognee={status:'failed',reason:error.message};}
  };
  const run=await investigate(scope,env,{enrich});
  run.integrations=integrations;
  if(env.AMPLITUDE_API_KEY){
    try{integrations.amplitude=await sendAmplitude(env,run);}catch(e){integrations.amplitude={status:'failed',reason:e.message};}
  }else integrations.amplitude={status:'not connected'};
  integrations.singleStore={status:hasSql(env)?'configured':'not connected'};
  let backend=null;
  if(hasSql(env)){
    try {
      // The record itself carries its ID and original evidence. Reopening verifies its actual stored bytes.
      integrations.singleStore={status:'saved',runId:run.id,table:'substation_runs'};
      await saveSql(env,run);backend='SingleStore';
    }catch(e){integrations.singleStore={status:'failed',reason:e.message};}
  }
  if(env.BUCKET){
    await env.BUCKET.put('runs/'+run.id+'.json',JSON.stringify(run));
    backend ||= env.LOCAL_STORAGE?'local filesystem':'Sites object storage';
  }
  if(!backend) throw Error('Run could not be saved. Check the durable store configuration.');
  return {run,backend,apiMs:Date.now()-start};
}
