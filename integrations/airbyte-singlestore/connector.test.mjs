import test from 'node:test';
import assert from 'node:assert/strict';
import {write} from './connector.mjs';
const record={type:'RECORD',record:{stream:'substation_catalog',emitted_at:1795212000000,data:{gtin:'8056262721391',merchant:'target',item_id:'94901810',observed_at:'2026-11-19T21:40:00-08:00'}}};
const state={type:'STATE',state:{type:'STREAM',stream:{stream_descriptor:{name:'substation_catalog'},stream_state:{done:true}}}};
test('state is acknowledged after exact destination readback',async()=>{
  const saved=new Map(),outputs=[];let committed=false;
  const execute=async(_config,statement,args)=>{
    if(statement.startsWith('INSERT'))saved.set(args[0],args[1]);
    if(statement.startsWith('SELECT')){committed=true;return {results:[{rows:[{record_json:saved.get(args[0])}]}]};}
  };
  assert.equal(await write({},[JSON.stringify(record),JSON.stringify(state)],{execute,output:message=>{if(message.type==='STATE')assert.equal(committed,true);outputs.push(message);}}),1);
  assert.deepEqual(outputs[0],state);
  assert.equal([...saved.values()][0],JSON.stringify(record));
});
test('write failure never acknowledges state',async()=>{
  const outputs=[];
  await assert.rejects(write({},[JSON.stringify(record),JSON.stringify(state)],{execute:async()=>{throw Error('unavailable');},output:m=>outputs.push(m)}),/unavailable/);
  assert.equal(outputs.length,0);
});
