import {GTIN, PRODUCT, BRIEFS, MERCHANTS, CAPTURES, LOCAL_CAPTURE, CART_CAPTURE, RAYBAN_PICKUP} from './catalog.mjs';

export const stamp = () => new Date().toISOString();
export function matched(product, merchant) {
  if (!product) return false;
  const gtin = product.gtin13 || product.gtin || product.upc || product.gtin14;
  if (gtin) return String(gtin).replace(/^0(?=\d{13}$)/,'') === GTIN;
  return String(product.sku) === merchant.item && merchant.id !== 'rayban';
}
function productsIn(node) {
  if (Array.isArray(node)) return node.flatMap(productsIn);
  if (!node || typeof node !== 'object') return [];
  const type = [node['@type']].flat();
  return [...(type.includes('Product') ? [node] : []), ...productsIn(node['@graph']), ...productsIn(node.hasVariant)];
}
export function pageOffer(html, merchant) {
  const blocks = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    let records;
    try { records = productsIn(JSON.parse(block[1])); } catch { continue; }
    for (const product of records.filter(p=>matched(p, merchant))) {
      for (const offer of [product.offers || []].flat()) {
        const price = Number(offer.price);
        if (offer.priceCurrency === 'USD' && price > 0 && (!offer.sku || String(offer.sku) === merchant.item)) {
          return {price, gtin:GTIN, evidence:'Exact product structured offer, USD ' + price, availability:offer.availability || null};
        }
      }
    }
  }
  return null;
}
async function timedFetch(url, options={}) {
  return fetch(url,{...options,signal:AbortSignal.timeout(4500),redirect:'follow'});
}
export async function lookup(merchant, env, log) {
  const now = stamp();
  if (merchant.id === 'bestbuy' && env.BESTBUY_API_KEY) {
    const base='https://api.bestbuy.com/v1/products/'+merchant.item+'.json';
    try {
      const res=await timedFetch(base+'?apiKey='+encodeURIComponent(env.BESTBUY_API_KEY));
      if(!res.ok) throw Error('HTTP '+res.status);
      const row=await res.json();
      if(!matched(row,merchant) || !(row.salePrice>0)) throw Error('No exact-priced product');
      const fact={...merchant,gtin:GTIN,price:Number(row.salePrice),mode:'live merchant API',observedAt:now,source:base,evidence:'SKU '+row.sku+'; salePrice '+row.salePrice};
      log('Product API',merchant.id,base,{sku:row.sku,salePrice:row.salePrice},now);
      return fact;
    } catch(e){log('Product API',merchant.id,base,{error:e.message},now);}
  }
  try {
    const res=await timedFetch(merchant.link,{headers:{Accept:'text/html'}});
    if(!res.ok) throw Error('HTTP '+res.status);
    const fact=pageOffer(await res.text(),merchant);
    log('Read product page',merchant.id,merchant.link,fact || {result:'No exact-priced structured offer'},now);
    if(fact) return {...merchant,...fact,mode:'live merchant page',observedAt:now,source:merchant.link};
  } catch(e){log('Read product page',merchant.id,merchant.link,{error:e.name==='TimeoutError'?'Timed out':e.message},now);}
  const fact={...merchant,...CAPTURES[merchant.id],gtin:GTIN,mode:'dated merchant capture',source:merchant.link};
  log('Read dated catalog',merchant.id,merchant.link,{price:fact.price,gtin:GTIN,observedAt:fact.observedAt,evidence:fact.evidence});
  return fact;
}
export async function investigateStore(offer, env, log){
  if(offer.id==='bestbuy' && env.BESTBUY_API_KEY){
    const base='https://api.bestbuy.com/v1/products/6642579/stores.json?postalCode=94123';
    try{
      const res=await timedFetch(base+'&apiKey='+encodeURIComponent(env.BESTBUY_API_KEY));
      if(!res.ok) throw Error('HTTP '+res.status);
      const data=await res.json();
      if(!Array.isArray(data.stores)) throw Error('No inventory response');
      const row=data.stores.find(s=>String(s.storeID)===offer.storeId);
      log('Check SKU at local store',offer.id,base,{storeId:offer.storeId,found:!!row,minPickupHours:row?.minPickupHours??null,lowStock:row?.lowStock??null});
      if(!row) return {level:'unknown',reason:'Current API results omit the Harrison store. Earlier capture superseded.',source:base,observedAt:stamp(),mode:'live merchant API'};
      return {level:'estimate',source:base,observedAt:stamp(),mode:'live merchant API',storeId:offer.storeId,reason:'Store-level API returned this SKU. Minimum preparation hours: '+(row.minPickupHours??'unknown')+'. Exact evening collection remains unconfirmed.'};
    } catch(e){log('Check SKU at local store',offer.id,base,{error:e.message});}
  }
  if(offer.storeLink){
    const started=stamp();
    try{
      const res=await timedFetch(offer.storeLink);
      log('Read store directory',offer.id,offer.storeLink,{http:res.status,scope:'Store directory; no exact-SKU pickup promise'},started);
      await res.body?.cancel();
    }catch(e){log('Read store directory',offer.id,offer.storeLink,{error:e.message},started);}
  }
  if(offer.id==='bestbuy'){
    log('Read SKU-localized pickup capture',offer.id,offer.link,LOCAL_CAPTURE);
    return {...LOCAL_CAPTURE,level:'estimate',reason:LOCAL_CAPTURE.evidence+' Wait for the ready notice before traveling. Availability can change.'};
  }
  if(offer.id==='rayban'){
    log('Read localized store-search capture',offer.id,offer.link,RAYBAN_PICKUP);
    return {...RAYBAN_PICKUP};
  }
  log('Check location evidence',offer.id,offer.storeLink || offer.link,{exactStoreWindow:false,reason:'No dated SKU-and-store collection window in available merchant records.'});
  return {level:'unknown',source:offer.storeLink || offer.link,observedAt:stamp(),mode:'evidence check',reason:'No store-specific, exact-item pickup window in the available evidence.'};
}
export function assessPickup(offer, asOf=new Date()){
  const p=offer?.pickup;
  if (!p || p.level!=='verified' || !p.storeId || p.storeId!==offer.storeId || p.gtin!==GTIN || !p.source || !p.observedAt || p.mode!=='live authorized merchant feed') return false;
  const when=Number(asOf), observed=Date.parse(p.observedAt), ready=Date.parse(p.readyAt), until=Date.parse(p.until);
  const eveningStart=Date.parse('2026-11-20T17:00:00-08:00'), eveningEnd=Date.parse('2026-11-20T21:00:00-08:00');
  return observed<=when && when-observed<=30*60000 && ready<=until && Math.max(when,ready,eveningStart)<Math.min(until,eveningEnd);
}
export function decide(offers,scope, asOf=new Date()) {
  const priced=offers.filter(o=>o.gtin===GTIN && Number.isFinite(o.price));
  const rank=o=>scope==='quick'?0:assessPickup(o,asOf)?2:o.pickup?.level==='estimate' && (!o.pickup.closesAt || Date.parse(o.pickup.closesAt)>Number(asOf))?1:0;
  const purchaseOrder=(a,b)=>rank(b)-rank(a) || (a.total!=null && b.total!=null?a.total-b.total:a.price-b.price) || a.id.localeCompare(b.id);
  const chosen=priced.sort(purchaseOrder)[0];
  if(!chosen) return {status:'no priced offer',seller:null,itemPrice:null,payableTotal:null,reason:'No matched listing returned an item price.'};
  const confirmed=assessPickup(chosen,asOf);
  const ties=priced.filter(o=>o.price===chosen.price).map(o=>o.seller);
  return {status:scope==='quick'?'advertised price':confirmed?'pickup verified':'pickup unconfirmed',seller:chosen.seller,
    store:scope==='pickup'?chosen.store??null:null,itemPrice:chosen.price,payableTotal:chosen.total??null,
    cartQuote:scope==='pickup'?chosen.cartQuote??null:null,currency:'USD',merchantLink:chosen.link,
    ties:scope==='quick'?ties:[],pickup:scope==='pickup'?chosen.pickup:null,
    reason:scope==='quick'?'Lowest among independently priced exact listings. '+(offers.some(o=>o.price==null)?'At least one seller has no independently established price.':'All three listings priced.'):chosen.pickup?.reason??'No verified collection window.',
    priceSource:{url:chosen.source,observedAt:chosen.observedAt,mode:chosen.mode}};
}
export async function investigate(scope,env={}, options={}) {
  const t=Date.now(), trace=[], id=crypto.randomUUID();
  const log=(action,merchant,source,response,startedAt=stamp())=>trace.push({step:trace.length+1,action,merchant,source,startedAt,finishedAt:stamp(),response});
  const merchants=options.merchants??MERCHANTS;
  const offers=await Promise.all(merchants.map(merchant=>lookup(merchant,env,log)));
  const priorities=options.enrich?await options.enrich(offers,log,id):[];
  if(scope==='pickup'){
    const check=async offer=>{
      if(assessPickup(offer)){log('Accept verified collection window',offer.id,offer.pickup.source,{store:offer.store,window:[offer.pickup.readyAt,offer.pickup.until]});return;}
      log('Choose store follow-up',offer.id,offer.link,{because:'Product evidence lacks a verified exact-store evening window',next:'check store-specific evidence'});
      offer.pickup=await investigateStore(offer,env,log);
    };
    const first=offers.find(o=>priorities?.includes(o.id));
    if(first){
      log('Follow graph-selected receipt',first.id,first.link,{next:'store-specific lookup'});
      await check(first);
    }
    await Promise.all(offers.filter(o=>o!==first).map(check));
    const local=offers.find(o=>o.id==='bestbuy' && o.price===CART_CAPTURE.item && o.storeId===CART_CAPTURE.storeId);
    if(local){
      local.cartQuote={...CART_CAPTURE};
      log('Inspect cart quote',local.id,CART_CAPTURE.source,CART_CAPTURE);
    }
  }
  const decision=decide(offers,scope);
  log('Save decision rationale','substation',null,{seller:decision.seller,status:decision.status,reason:decision.reason});
  return {id,scope,brief:BRIEFS[scope],product:PRODUCT,gtin:GTIN,postalCode:'94123',date:'2026-11-20',startedAt:new Date(t).toISOString(),finishedAt:stamp(),investigationMs:Date.now()-t,offers,decision,trace};
}
