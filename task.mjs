import {writeFile,mkdir} from 'node:fs/promises';
import {execute,getRun} from './service.mjs';
import {localStore} from './local-store.mjs';
import {pickupAssessment,sendAmplitude} from './sponsors.mjs';
const env={...process.env,LOCAL_STORAGE:true,BUCKET:localStore()};
const scope=process.argv.includes('quick')?'quick':'pickup';
const result=await execute(scope,env);
const saved=await getRun(env,result.run.id);
if(!saved||saved.run.id!==result.run.id||saved.run.trace.length!==result.run.trace.length)throw Error('Reopen failed');
const qa={supported:pickupAssessment(result.run,'unconfirmed'),unsupported:pickupAssessment(result.run,'confirmed')};
if(scope==='pickup' && env.AMPLITUDE_API_KEY && process.argv.includes('--calibrate')) {
  qa.controlDelivery=await sendAmplitude(env,result.run,{calibration:true,claim:'confirmed'});
}
await mkdir('.local/receipts',{recursive:true});
await writeFile('.local/receipts/'+scope+'.json',JSON.stringify({...result,reopenedFrom:saved.backend,qa},null,2));
console.log(JSON.stringify({id:result.run.id,backend:saved.backend,apiMs:result.apiMs,seller:result.run.decision.seller,price:result.run.decision.itemPrice,quote:result.run.decision.cartQuote?.quotedTotal,integrations:result.run.integrations,qa},null,2));
