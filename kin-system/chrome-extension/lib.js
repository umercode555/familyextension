const SYNCED=['contacts','items','schedules','queue','events'];
const DB={open(){return this._p||(this._p=new Promise((res,rej)=>{const r=indexedDB.open('kin',1);r.onupgradeneeded=()=>{for(const s of['contacts','items','schedules','events','queue','kv'])r.result.createObjectStore(s,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
async tx(s,m,f){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,m),q=f(t.objectStore(s));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})},
rawAll(s){return this.tx(s,'readonly',o=>o.getAll())},rawGet(s,id){return this.tx(s,'readonly',o=>o.get(id))},rawPut(s,v){return this.tx(s,'readwrite',o=>o.put(v)).then(()=>v)},rawDel(s,id){return this.tx(s,'readwrite',o=>o.delete(id))},
all(s){return this.rawAll(s).then(a=>SYNCED.includes(s)?a.filter(x=>!x._del):a)},
get(s,id){return this.rawGet(s,id).then(x=>x&&x._del?undefined:x)},
put(s,v){v.id=v.id||crypto.randomUUID();if(SYNCED.includes(s)){v._d=1;v._v=(v._v||0)+1}return this.rawPut(s,v)},
async del(s,id){if(!SYNCED.includes(s))return this.rawDel(s,id);const o=await this.rawGet(s,id);if(!o)return;await this.rawPut(s,{...o,_del:1,_d:1,_v:(o._v||0)+1});if(s==='items')await cancelFor(id);if(s==='contacts')await cancelContact(id)}};
async function cancelFor(id){for(const q of await DB.all('queue'))if(q.itemId===id&&(q.status==='pending'||q.status==='missed'))await DB.put('queue',{...q,status:'cancelled'});
 for(const s of await DB.all('schedules')){const fx=s.fixedByDate||{};if((s.itemIds||[]).includes(id)||Object.values(fx).includes(id)){const f={};for(const[k,v]of Object.entries(fx))if(v!==id)f[k]=v;await DB.put('schedules',{...s,itemIds:(s.itemIds||[]).filter(x=>x!==id),fixedByDate:f})}}}
async function cancelContact(id){for(const q of await DB.all('queue'))if(q.contactId===id&&(q.status==='pending'||q.status==='missed'))await DB.put('queue',{...q,status:'cancelled'})}
const p2=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
function rnd(str){let h=2166136261;for(const c of str)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296}
function runsOn(s,d){const ds=ymd(d);const t=s.type;
 if(t==='daily')return true;
 if(t==='weekdays')return(s.days||[]).includes(d.getDay());
 if(t==='dates')return(s.dates||[]).includes(ds);
 const a=new Date((s.anchor||ds)+'T00:00'),x=new Date(ds+'T00:00');
 if(t==='interval')return x>=a&&Math.round((x-a)/864e5)%(s.every||1)===0;
 if(t==='monthly')return x.getDate()===a.getDate();
 return false}
function planFor(s,d){if(!runsOn(s,d))return[];const ds=ymd(d);
 return(s.times||[]).map((t,i)=>{const[h,m]=t.split(':').map(Number);const p=new Date(d);p.setHours(h,m,0,0);p.setMinutes(p.getMinutes()+Math.floor(rnd(s.id+ds+i)*(s.jitter||0)));return{key:`${s.id}|${ds}|${i}`,planned:+p,ds}})}

async function logErr(src,e,ctx){try{const k=(await DB.get('kv','errors'))||{id:'errors',list:[]};
 k.list.unshift({ts:Date.now(),src,msg:(e&&e.message)||String(e),stack:((e&&e.stack)||'').split('\n').slice(0,6).join('\n'),ctx:ctx||''});k.list=k.list.slice(0,40);await DB.put('kv',k)}catch(_){}}
