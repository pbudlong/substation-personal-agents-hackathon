import { execute, getRun } from './service.mjs';
import { homePage, receiptPage } from './receipt.mjs';
import { THURSDAY_CATALOG_CSV } from './catalog.mjs';

const runRoute = /^\/runs\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const scopes = new Map([['/agent/pickup','pickup'],['/agent/quick','quick']]);
const common = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Accept','Referrer-Policy':'no-referrer'};
function json(data,status=200,headers={}){
  return Response.json(data,{status,headers:{...common,...headers}});
}
function html(page){
  return new Response(page,{headers:{...common,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'"}});
}
function shape(record,url){
  const location=new URL('/runs/'+record.run.id,url.origin).href;
  return {...record,runId:record.run.id,savedRunUrl:location,jsonUrl:location+'?format=json'};
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const wantsPage=url.searchParams.get('format')!=='json' && (request.headers.get('Accept')||'').includes('text/html');
    const scope=scopes.get(url.pathname);
    const saved=runRoute.exec(url.pathname);
    const allowed=scope?'GET, POST': 'GET';
    if(request.method!=='GET' && !(scope && request.method==='POST'))return json({error:'Method not supported'},405,{Allow:allowed});
    if(url.pathname==='/')return html(homePage());
    if(url.pathname==='/catalog/2026-11-19.csv')return new Response(THURSDAY_CATALOG_CSV,{headers:{...common,'Content-Type':'text/csv; charset=utf-8'}});
    if(!saved && !scope)return json({error:'No such route'},404);
    try{
      if(scope){
        const result=shape(await execute(scope,env),url);
        if(wantsPage) return new Response(null,{status:303,headers:{...common,Location:result.savedRunUrl}});
        return json(result,request.method==='POST'?201:200,{Location:result.savedRunUrl,'Content-Location':result.savedRunUrl});
      }
      const record=await getRun(env,saved[1]);
      if(!record)return json({error:'Saved run not found'},404);
      return wantsPage?html(receiptPage(record,url.origin)):json(shape(record,url));
    }catch{
      return json({error:scope?'Could not complete and save this investigation.':'The saved run could not be read. Try again.'},503);
    }
  }
};
