importScripts('lib.js');
self.addEventListener('error',e=>logErr('background',e.error||e.message));self.addEventListener('unhandledrejection',e=>logErr('background',e.reason));
const WA='https://web.whatsapp.com/';
const sget=async()=>({notify:true,autoOpen:true,...(await DB.get('kv','settings')||{})});
const addEv=(type,contactId,title,detail)=>DB.put('events',{ts:Date.now(),type,contactId,title:title||'',detail:detail||''});
const arm=()=>{chrome.alarms.create('tick',{periodInMinutes:1});tick()};
chrome.runtime.onInstalled.addListener(arm);chrome.runtime.onStartup.addListener(()=>{arm();startOpen()});
async function startOpen(){const set=await sget();if(set.autoOpen&&!(await chrome.tabs.query({url:WA+'*'})).length)chrome.tabs.create({url:WA,active:false})}
chrome.alarms.onAlarm.addListener(a=>a.name==='tick'&&tick());
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('app.html')}));
chrome.notifications.onClicked.addListener(async()=>{const t=await chrome.tabs.query({url:WA+'*'});t[0]?chrome.tabs.update(t[0].id,{active:true}):chrome.tabs.create({url:WA})});
const quiet=s=>s.quietUntil&&Date.now()<s.quietUntil;
function pick(s,items,q,ds){const fx=s.fixedByDate&&s.fixedByDate[ds];if(fx&&items.find(i=>i.id===fx))return fx;
 const pool=items.filter(i=>(s.itemIds||[]).includes(i.id));if(!pool.length)return null;const pend={};
 q.filter(x=>x.status==='pending'||x.status==='missed').forEach(x=>pend[x.itemId]=(pend[x.itemId]||0)+1);
 pool.sort((a,b)=>((a.sentCount||0)+(pend[a.id]||0))-((b.sentCount||0)+(pend[b.id]||0))||(a.lastSent||0)-(b.lastSent||0));return pool[0].id}
let busy=false;
async function tick(){if(busy)return;busy=true;try{
 const now=Date.now(),set=await sget(),ss=await DB.all('schedules'),cs=await DB.all('contacts'),items=await DB.all('items'),q=await DB.all('queue');let fresh=0;
 for(const s of ss){if(!s.active)continue;const c=cs.find(x=>x.id===s.contactId);if(!c||c.paused)continue;
  for(let off=-3;off<=0;off++){const d=new Date();d.setDate(d.getDate()+off);
   for(const p of planFor(s,d)){if(p.planned>now||p.planned<(s.created||0)||q.some(x=>x.id===p.key))continue;
    const itemId=pick(s,items,q,p.ds);if(!itemId)continue;const miss=now-p.planned>3*36e5;
    const row={id:p.key,scheduleId:s.id,contactId:c.id,itemId,planned:p.planned,status:miss?'missed':'pending'};
    await DB.put('queue',row);q.push(row);fresh++;if(miss)await addEv('missed',c.id,c.name,'Scheduled '+new Date(p.planned).toLocaleString())}}}
 const waiting=q.filter(x=>x.status==='pending'||x.status==='missed').length;
 if(fresh&&!quiet(set)){
  if(set.notify)chrome.notifications.create('kin',{type:'basic',iconUrl:'icon.png',title:'A little reminder',message:waiting+' message'+(waiting>1?'s are':' is')+' waiting for your approval.'});
  if(set.autoOpen&&!(await chrome.tabs.query({url:WA+'*'})).length)chrome.tabs.create({url:WA,active:false})}
}catch(e){await logErr('tick',e)}finally{busy=false}}
const toURL=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
const H={
 async wantOpen(){const o=await DB.get('kv','open');if(!o)return{};await DB.del('kv','open');return Date.now()-o.ts<12e4?o:{}},
 async err({src,msg,ctx}){await logErr(src,{message:msg},ctx);return{ok:1}},
 async queue(){const set=await sget();if(quiet(set))return{list:[]};const[q,cs,items]=await Promise.all(['queue','contacts','items'].map(s=>DB.all(s)));
  const list=q.filter(x=>(x.status==='pending'||x.status==='missed')&&!(x.snoozeUntil>Date.now())).sort((a,b)=>a.planned-b.planned)
   .map(x=>{const it=items.find(i=>i.id===x.itemId);return{...x,contact:cs.find(c=>c.id===x.contactId),item:it&&{id:it.id,title:it.title,kind:it.kind,text:it.text,duration:it.duration}}}).filter(x=>x.contact&&x.item);return{list}},
 async audio({id}){const i=await DB.get('items',id);return{url:await toURL(i.blob),mime:i.mime||i.blob.type,name:(i.title||'voice').replace(/[^\w ]/g,'')+'.'+((i.mime||'').includes('ogg')?'ogg':(i.mime||'').includes('mpeg')?'mp3':(i.mime||'').includes('mp4')?'m4a':(i.mime||'').includes('wav')?'wav':'webm')}},
 async done({id,status,until}){const x=await DB.get('queue',id);if(!x)return;const c=await DB.get('contacts',x.contactId),it=await DB.get('items',x.itemId);
  if(status==='sent'){x.status='done';x.doneAt=Date.now();it.sentCount=(it.sentCount||0)+1;it.lastSent=Date.now();await DB.put('items',it);
   c.lastSent=Date.now();c.sentCount=(c.sentCount||0)+1;c.awaitingSince=Date.now();await DB.put('contacts',c);await addEv('sent',c.id,it.title,it.kind)}
  else if(status==='skipped'){x.status='skipped';await addEv('skipped',c.id,it.title)}
  else{x.snoozeUntil=until;await addEv('rescheduled',c.id,it.title,'Until '+new Date(until).toLocaleString())}
  await DB.put('queue',x);return{ok:1}},
 async link({contactId,waName}){if(!waName||/^(contact info|click here)/i.test(waName))return{error:'bad name'};const c=await DB.get('contacts',contactId);c.waName=waName;c.linkedAt=Date.now();await DB.put('contacts',c);return{ok:1}},
 async contacts(){return{list:await DB.all('contacts')}},
 async watch(){return{list:(await DB.all('contacts')).filter(c=>c.waName&&c.awaitingSince&&!c.paused)}},
 async reply({contactId,preview}){const c=await DB.get('contacts',contactId);if(!c||!c.awaitingSince)return;c.lastReply=Date.now();c.awaitingSince=null;c.lastIncoming=(preview||'').slice(0,140);await DB.put('contacts',c);
  await addEv('reply',c.id,c.name,c.lastIncoming);const s=await sget();if(s.notify&&!quiet(s))chrome.notifications.create('kinr'+Date.now(),{type:'basic',iconUrl:'icon.png',title:c.name+' replied',message:c.lastIncoming||'Open the conversation'});return{ok:1}}};
chrome.runtime.onMessage.addListener((m,_,r)=>{if(!H[m.t])return;H[m.t](m).then(r).catch(e=>{logErr('bg:'+m.t,e);r({error:String(e)})});return true});
