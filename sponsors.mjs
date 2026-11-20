import {GTIN} from './catalog.mjs';
import {assessPickup,stamp} from './agent.mjs';

const jsonHeaders={'Content-Type':'application/json'};
async function api(url,options,ms=7500){
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(ms),redirect:'error'});
  if(!res.ok) throw Error('Service returned HTTP '+res.status);
  return res.json();
}
function configured(env,keys) {return keys.every(k=>typeof env[k]==='string' && env[k].length>0);}
export const hasSql=env=>configured(env,['SINGLESTORE_URL','SINGLESTORE_DATABASE','SINGLESTORE_USER','SINGLESTORE_PASSWORD']);
export async function sql(env,path,statement,args=[]){
  const host=new URL(env.SINGLESTORE_URL);
  if(host.protocol!=='https:' || !host.hostname.endsWith('.singlestore.com')) throw Error('Invalid SingleStore Data API origin');
  const auth=btoa(env.SINGLESTORE_USER+':'+env.SINGLESTORE_PASSWORD);
  const body=await api(host.origin+'/api/v2/'+path,{method:'POST',headers:{...jsonHeaders,Authorization:'Basic '+auth},body:JSON.stringify({database:env.SINGLESTORE_DATABASE,sql:statement,args})});
  if(body.error) throw Error('SingleStore rejected the SQL statement');
  return body;
}
export const CREATE_RUNS='CREATE TABLE IF NOT EXISTS substation_runs (run_id VARCHAR(36) NOT NULL PRIMARY KEY, record_json LONGTEXT NOT NULL)';
export async function saveSql(env,run){
  await sql(env,'exec',CREATE_RUNS);
  await sql(env,'exec','INSERT INTO substation_runs (run_id,record_json) VALUES (?,?)',[run.id,JSON.stringify(run)]);
  const saved=await readSql(env,run.id);
  if(JSON.stringify(saved)!==JSON.stringify(run)) throw Error('SingleStore readback mismatch');
  return {status:'verified',runId:run.id,table:'substation_runs',traceSteps:saved.trace.length};
}
export async function readSql(env,id){
  const result=await sql(env,'query/rows','SELECT record_json FROM substation_runs WHERE run_id=?',[id]);
  const raw=result.results?.[0]?.rows?.[0]?.record_json;
  return raw ? JSON.parse(raw) : null;
}
export function pickupAssessment(run,claim){
  const chosen=run.offers.find(o=>o.seller===run.decision.seller);
  const verified=assessPickup(chosen,new Date(run.finishedAt));
  const evidence=verified?'verified_same_store_window':chosen?.pickup?.level==='estimate'?'estimate':chosen?.availability?'stock_only':'missing';
  return {claim,evidence,pass:claim==='unconfirmed'||(claim==='confirmed'&&verified),receipt:'PICKUP_AUDIT claim='+claim+' evidence='+evidence};
}
export function agentEvents(run,{calibration=false,claim=run.decision.status==='pickup verified'?'confirmed':'unconfirmed'}={}){
  const session=run.id+(calibration?'-unsupported-control':'');
  const actor='substation-event-demo', shared={'[Agent] Session ID':session,'[Agent] Trace ID':session,'[Agent] Turn ID':1,'[Agent] Agent ID':'substation','[Agent] Env':'hackathon','[Agent] Runtime':'javascript',calibration};
  const event=(kind,id,time,fields)=>({event_type:'[Agent] '+kind,user_id:actor,insert_id:session+'-'+id,time:new Date(time).getTime(),event_properties:{...shared,...fields}});
  const base=run.startedAt, answer=run.finishedAt, message=session+'-request';
  const user=event('User Message','request',base,{'[Agent] Message ID':message,'$llm_message':{text:run.brief}});
  const calls=run.trace.filter(t=>!['Choose store follow-up','Save decision rationale'].includes(t.action)).map(t=>event('Tool Call',t.step,t.finishedAt,{
    '[Agent] Tool Name':t.action,'[Agent] Invocation ID':session+'-'+t.step,'[Agent] Parent Message ID':message,
    '[Agent] Tool Success':!t.response?.error,'[Agent] Latency Ms':Math.max(0,Date.parse(t.finishedAt)-Date.parse(t.startedAt)),
    '[Agent] Tool Input':{merchant:t.merchant,source:t.source},'[Agent] Tool Output':t.response
  }));
  const assessment=pickupAssessment(run,claim);
  const statement=calibration?'CONTROLLED TEST: this store guarantees pickup Friday evening.':JSON.stringify(run.decision);
  const response=event('AI Response','answer',answer,{'[Agent] Message ID':session+'-answer','[Agent] Parent Message ID':message,'[Agent] Latency Ms':run.investigationMs,'$llm_message':{text:statement+'\n'+assessment.receipt}});
  return [user,...calls,response,event('Session End','end',answer,{})];
}
export async function sendAmplitude(env,run,opts){
  const events=agentEvents(run,opts);
  const response=await api('https://api2.amplitude.com/2/httpapi',{method:'POST',headers:jsonHeaders,body:JSON.stringify({api_key:env.AMPLITUDE_API_KEY,events})});
  if(response.events_ingested!==events.length) throw Error('Event count did not match the submitted batch');
  return {status:'ingested',events:response.events_ingested,session:events[0].event_properties['[Agent] Session ID'],evaluator:'Awaiting Agent Analytics result'};
}
export async function queryCognee(env,offers,log,runId){
  const base=new URL(env.COGNEE_URL);
  if(base.protocol!=='https:')throw Error('Cognee requires HTTPS');
  const dataset='substation_'+runId.replaceAll('-','');
  const facts=offers.map(o=>({receiptId:o.id+'-'+runId,merchant:o.id,gtin:GTIN,storeId:o.storeId??null,itemPrice:o.price,source:o.source,observedAt:o.observedAt,pickup:o.pickup??null}));
  const form=new FormData();
  form.set('data',new Blob([JSON.stringify(facts)],{type:'text/plain'}),'offers.txt');
  form.set('datasetName',dataset);form.set('run_in_background','false');
  const headers={'X-Api-Key':env.COGNEE_API_KEY};
  await api(base.origin+'/api/v1/remember',{method:'POST',headers,body:form},40000);
  const query='Return the exact receipt IDs and store IDs linked to GTIN '+GTIN+' whose offers lack a verified Friday-evening pickup window in San Francisco.';
  const raw=await api(base.origin+'/api/v1/recall',{method:'POST',headers:{...headers,...jsonHeaders},body:JSON.stringify({query,datasets:[dataset],search_type:'GRAPH_COMPLETION',top_k:5,only_context:true})},22000);
  const context=JSON.stringify(raw);
  const targets=facts.filter(f=>context.includes(f.receiptId) && !f.pickup).map(f=>f.merchant);
  log('Query Cognee graph','cognee',base.origin,{query,dataset,context:context.slice(0,3500),followUp:targets});
  return {status:targets.length?'used':'no matching receipt',targets,dataset,query};
}
export function applyAirbyte(offers,feed,log){
  if(!feed || !Array.isArray(feed.records) || !feed.job || !feed.connector) return {status:'not connected'};
  const used=[];
  for(const message of feed.records){
    const rec=message.record, row=rec?.data;
    if(message.type!=='RECORD'||row?.gtin!==GTIN||!Number.isFinite(rec.emitted_at)||!Number.isFinite(Date.parse(row.observed_at))) continue;
    const offer=offers.find(o=>o.id===row.merchant && o.item===String(row.item_id));
    if(!offer || row.source!==offer.link || !Number.isFinite(Number(row.price_usd))||Number(row.price_usd)<=0) continue;
    if(offer.mode.startsWith('live') || Date.parse(offer.observedAt)>Date.parse(row.observed_at)) continue;
    Object.assign(offer,{price:Number(row.price_usd),source:row.source,observedAt:row.observed_at,mode:'dated participant feed via Airbyte'});
    const receipt={merchant:offer.id,observedAt:row.observed_at,ingestedAt:new Date(rec.emitted_at).toISOString(),job:feed.job,connector:feed.connector,row};
    used.push(receipt);log('Read Airbyte-synced offer',offer.id,row.source,receipt);
  }
  return {status:used.length?'used':'no eligible rows',used};
}
