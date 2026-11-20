const $ = id => document.getElementById(id);
let data;
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sources={bbListing:'Best Buy listing',targetListing:'Target listing',rbListing:'Ray-Ban listing',targetStore:'Target store hours',bbStore:'Best Buy store',bbQuote:'Best Buy cart capture',bbPickup:'Best Buy pickup capture',rbPrice:'Ray-Ban price capture',rbPickup:'Ray-Ban pickup capture'};
let ids=[],now=0,end=0,anim=0,prior=0;
function time(s){s=Math.round(s);return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s'}
function pause(){if(anim)cancelAnimationFrame(anim);anim=0;$('play').textContent=now>=end?'Replay':'Play'}
function panel(id){const r=data.runs[id], t=r.elapsedSeconds;
const checks=r.accuracyChecks.map(c=>'<li><strong>'+safe(c.field)+'</strong> · '+safe(c.status)+'<br>'+safe(c.basis)+'<br><span class="refs">'+c.sources.map(s=>'<a href="'+safe(data.sources[s])+'">'+safe(sources[s])+'</a>').join(' · ')+'</span></li>').join('');
return '<article><header><small>'+safe(r.task==='quick'?'Price comparison':'Friday pickup')+'</small><h2>'+ (r.path==='standard'?'Muse directly':'Muse with Substation')+'</h2><div class="result">'+safe(r.recommendation)+'</div><div class="timing"><div><small>First useful</small><strong>'+time(t.firstUsefulAt)+'</strong></div><div><small>Three prices</small><strong>'+time(t.threeStoreFactsAt)+'</strong></div><div><small>Final reply</small><strong>'+time(t.finalAt)+'</strong></div></div></header><section><p><b>'+r.coverage.addressed+'/'+r.coverage.total+' fields addressed</b><br>'+safe(r.factualSummary)+'</p><p class="muted">'+safe(r.freshness)+'</p>'+(r.receiptVerification?'<a href="'+safe(r.receiptVerification.source)+'">Open saved Substation run</a>':'')+'</section><figure class="frame"><figcaption id="cap'+id+'"></figcaption><div id="empty'+id+'" class="empty">Prompt sent · awaiting first sampled frame</div><img id="pic'+id+'" alt="Sampled Muse conversation in WhatsApp" hidden></figure><details class="detail"><summary>Review accuracy checks</summary><ul>'+checks+'</ul></details><details class="detail"><summary>Read the final reply</summary><p>'+safe(r.finalReply)+'</p></details><details class="detail"><summary>Read the prompt</summary><p>'+safe(r.prompt)+'</p></details></article>'}
function draw(){for(const id of ids){const r=data.runs[id],frames=r.frames;let index=frames.findLastIndex(f=>f.offset<=now+.001);const pic=$('pic'+id);$('empty'+id).hidden=index>=0;pic.hidden=index<0;if(index>=0&&pic.dataset.index!==String(index)){pic.src=frames[index].img;pic.dataset.index=index}const isFinal=now>=r.elapsedSeconds.finalAt-.001;$('cap'+id).textContent=index<0?'No sample yet':(isFinal?'Final reply observed at ':'Sample at ')+time(frames[index].offset)}$('clock').textContent=time(now);$('scrub').value=String(now)}
function choose(task){pause();ids=task==='quick'?['Q-S','Q-R']:['C-S','C-R'];end=Math.max(...ids.map(k=>data.runs[k].elapsedSeconds.finalAt));now=end;$('scrub').max=String(end);$('panels').innerHTML=ids.map(panel).join('');$('brief').textContent=task==='quick'?'For regular matte-black Ray-Ban Meta Wayfarer Gen 2 glasses with clear lenses, which retailer has the lowest advertised price?':'Where could the shopper pick up the same glasses Friday evening near 94123, and what would they pay?';for(const t of ['quick','pickup'])$(t).setAttribute('aria-pressed',String(t===task));draw();pause()}
function tick(clock){if(prior)now=Math.min(end,now+(clock-prior)/1000*Number($('speed').value));prior=clock;draw();if(now>=end){pause();return}anim=requestAnimationFrame(tick)}
$('quick').onclick=()=>choose('quick');$('pickup').onclick=()=>choose('pickup');$('finish').onclick=()=>{now=end;pause();draw()};$('scrub').oninput=e=>{now=Number(e.target.value);pause();draw()};$('play').onclick=()=>{if(anim){pause();return}if(now>=end)now=0;prior=0;draw();$('play').textContent='Pause';anim=requestAnimationFrame(tick)};
init();

async function init() {
  try {
    const response = await fetch('/demo/trials.json');
    if (!response.ok) throw new Error();
    data = await response.json();
    choose('pickup');
    document.getElementById('replay-controls').disabled = false;
  } catch {
    document.getElementById('brief').textContent = 'The replay could not load. Reload to try again or open either saved run above.';
  }
}
