import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAirbyte} from './sponsors.mjs';
import {decide} from './agent.mjs';
import {GTIN,MERCHANTS,CAPTURES} from './catalog.mjs';
const row={merchant:'target',item_id:'94901810',gtin:GTIN,price_usd:'379.99',source:MERCHANTS[1].link,observed_at:'2026-11-19T21:40:00-08:00',observed_precision:'minute'};
const feed=data=>({job:'real-job-id-at-runtime',connectionId:'connection',connector:'file to SingleStore',records:[{type:'RECORD',record:{data,emitted_at:Date.parse('2026-11-20T21:00:00Z')},synced_at:'2026-11-20T21:00:01Z'}]});
const offers=()=>MERCHANTS.map(m=>({...m,...CAPTURES[m.id],gtin:GTIN,mode:'dated merchant capture',source:m.link}));
test('a synced historical offer informs the decision without replacing newer prices',()=>{
  const candidates=offers(),trace=[];
  const status=applyAirbyte(candidates,feed(row),(...t)=>trace.push(t));
  assert.equal(status.status,'used');
  assert.equal(candidates[1].price,284.99);
  const result=decide(candidates,'quick');
  assert.equal(result.seller,'Best Buy');
  assert.match(result.reason,/379\.99.*older.*284\.99/);
  assert.equal(result.syncedCatalog[0].row.source,row.source);
  assert.equal(result.syncedCatalog[0].observedAt,row.observed_at);
  assert.equal(result.syncedCatalog[0].syncedAt,'2026-11-20T21:00:01Z');
  assert.equal(trace[0][0],'Compare Airbyte-synced offer');
});
test('a mismatched source or impossible collection time cannot affect a decision',()=>{
  for(const changed of [{...row,source:'https://example.invalid'},{...row,gtin:'different'},{...row,observed_at:'2099-01-01T00:00:00Z'}]){
    const candidates=offers();
    assert.equal(applyAirbyte(candidates,feed(changed),()=>{}).used.length,0);
    assert.equal(decide(candidates,'quick').syncedCatalog,undefined);
  }
});
