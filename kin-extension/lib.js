const DB={open(){return this._p||(this._p=new Promise((res,rej)=>{const r=indexedDB.open('kin',1);r.onupgradeneeded=()=>{for(const s of['contacts','items','schedules','events','queue','kv'])r.result.createObjectStore(s,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
async tx(s,m,f){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,m),q=f(t.objectStore(s));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})},
all(s){return this.tx(s,'readonly',o=>o.getAll())},get(s,id){return this.tx(s,'readonly',o=>o.get(id))},
put(s,v){v.id=v.id||crypto.randomUUID();return this.tx(s,'readwrite',o=>o.put(v)).then(()=>v)},del(s,id){return this.tx(s,'readwrite',o=>o.delete(id))}};
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
