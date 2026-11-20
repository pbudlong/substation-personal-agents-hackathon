import { createServer } from 'node:http';
import { localStore } from './local-store.mjs';
import worker from './worker.mjs';

const port=Number(process.env.PORT || 3000);
const env={...process.env,LOCAL_STORAGE:true,BUCKET:localStore(process.env.SUBSTATION_DATA_DIR || '.local')};
const server=createServer(async (incoming,outgoing)=>{
  try{
    const url=new URL(incoming.url,'http://'+(incoming.headers.host || 'localhost:'+port));
    const request=new Request(url,{method:incoming.method,headers:incoming.headers});
    const response=await worker.fetch(request,env);
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }catch{
    outgoing.writeHead(500,{'Content-Type':'application/json'});
    outgoing.end(JSON.stringify({error:'Request failed'}));
  }
});
server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log('Substation listening on port '+port));
