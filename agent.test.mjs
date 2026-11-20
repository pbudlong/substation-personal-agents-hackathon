import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker from './worker.mjs';
import {localStore} from './local-store.mjs';

const origin='https://substation-test.invalid';
test('a new run survives a fresh store handle and readback performs no merchant calls',async t=>{
  const path=await mkdtemp(join(tmpdir(),'substation-run-'));
  t.after(()=>rm(path,{recursive:true,force:true}));
  const env=()=>({LOCAL_STORAGE:true,BUCKET:localStore(path)});
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:503});});
  const response=await worker.fetch(new Request(origin+'/agent/pickup?format=json',{method:'POST'}),env());
  assert.equal(response.status,201);
  const result=await response.json();
  assert.deepEqual(result.run.offers.map(o=>o.seller),['Best Buy','Target','Ray-Ban']);
  assert.equal(result.run.decision.status,'pickup unconfirmed');
  assert.equal(result.run.decision.cartQuote.quotedTotal,312.76);
  assert.equal(result.run.decision.payableTotal,null);
  assert.equal(result.run.id,result.runId);
  assert.equal(response.headers.get('location'),result.savedRunUrl);
  assert.ok(calls>=3);
  const before=calls;
  const reopened=await worker.fetch(new Request(result.jsonUrl),env());
  assert.equal(reopened.status,200);
  assert.deepEqual((await reopened.json()).run,result.run);
  const human=await worker.fetch(new Request(result.savedRunUrl,{headers:{Accept:'text/html'}}),env());
  assert.match(await human.text(),/Estimated cart total/);
  assert.equal(calls,before);
});
test('a missing record and an unsupported method are distinguishable',async()=>{
  const env={BUCKET:{get:async()=>null}};
  const get=path=>worker.fetch(new Request(origin+path),env);
  assert.equal((await get('/runs/00000000-0000-4000-8000-000000000000')).status,404);
  assert.equal((await get('/runs/a/b')).status,404);
  const response=await worker.fetch(new Request(origin+'/agent/pickup',{method:'DELETE'}),env);
  assert.equal(response.status,405);
  assert.equal(response.headers.get('allow'),'GET, POST');
});
test('no saved receipt is advertised if writing the record fails',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const res=await worker.fetch(new Request(origin+'/agent/pickup'),{BUCKET:{get:async()=>null,put:async()=>{throw Error('Unavailable');}}});
  assert.equal(res.status,503);
  assert.equal(res.headers.has('location'),false);
});
