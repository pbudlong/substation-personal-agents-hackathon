import test from 'node:test';
import assert from 'node:assert/strict';
import {sendAmplitude} from './sponsors.mjs';

const run={id:'edge-request-check',startedAt:'2026-11-20T20:00:00Z',finishedAt:'2026-11-20T20:00:01Z',brief:'test',trace:[],offers:[],decision:{status:'pickup unconfirmed'}};
test('sponsor requests work with Worker redirect modes and reject redirects',async t=>{
  let redirect=false;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    if(!['follow','manual'].includes(options.redirect)) throw Error('Unsupported Worker redirect mode');
    assert.equal(options.redirect,'manual');
    if(redirect) return new Response(null,{status:302,headers:{Location:'https://different-service.invalid'}});
    return Response.json({events_ingested:JSON.parse(options.body).events.length});
  });
  assert.equal((await sendAmplitude({AMPLITUDE_API_KEY:'test-only'},run)).status,'ingested');
  redirect=true;
  await assert.rejects(sendAmplitude({AMPLITUDE_API_KEY:'test-only'},run),/HTTP 302/);
});
