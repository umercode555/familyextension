export const TBL={contacts:'contacts',items:'items',schedules:'schedules',queue:'instances',events:'events'};
export const FLD={
contacts:[['name','name'],['relation','relation'],['notes','notes'],['paused','paused'],['waName','wa_name'],['lastSent','last_sent'],['sentCount','sent_count'],['awaitingSince','awaiting_since'],['lastReply','last_reply'],['lastIncoming','last_incoming']],
items:[['kind','kind'],['title','title'],['contactId','contact_id'],['category','category'],['text','text'],['duration','duration'],['mime','mime'],['sentCount','sent_count'],['lastSent','last_sent'],['path','storage_path'],['filename','filename']],
schedules:[['contactId','contact_id'],['type','type'],['days','days'],['dates','dates'],['every','every_n'],['anchor','anchor'],['times','times'],['jitter','jitter'],['mode','mode'],['active','active'],['itemIds','item_ids'],['fixedByDate','fixed_by_date'],['created','created_ms']],
queue:[['scheduleId','schedule_id'],['contactId','contact_id'],['itemId','item_id'],['planned','planned_ms'],['status','status'],['snoozeUntil','snooze_until'],['doneAt','done_at']],
events:[['ts','ts'],['type','type'],['contactId','contact_id'],['title','title'],['detail','detail']]};
export const ORDER=['contacts','items','schedules','queue','events'];
export const DEF={days:[],dates:[],times:[],itemIds:[],fixedByDate:{},every:1,jitter:0,paused:false,active:true,sentCount:0,title:'',status:'pending',kind:'voice',type:'daily',mode:'rotate'};
export const J=JSON.stringify;
export const nv=(o,l)=>o[l]==null?(l in DEF?DEF[l]:null):o[l];
export const cols=(s,o)=>{const r={};for(const[l,c]of FLD[s])r[c]=nv(o,l);return r};
export const fromRow=(s,r)=>{const o={id:r.id};for(const[l,c]of FLD[s])o[l]=r[c]==null&&l in DEF?DEF[l]:r[c];return o};
export const extOf=m=>{m=m||'';return m.includes('ogg')||m.includes('opus')?'ogg':m.includes('mpeg')?'mp3':m.includes('mp4')||m.includes('m4a')||m.includes('aac')?'m4a':m.includes('wav')?'wav':m.includes('webm')?'webm':'bin'};
export const uuid=()=>'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const p2=n=>String(n).padStart(2,'0');
export const ymd=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
function rnd(str){let h=2166136261;for(const c of str)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296}
export function runsOn(s,d){const ds=ymd(d),t=s.type;if(t==='daily')return true;if(t==='weekdays')return(s.days||[]).includes(d.getDay());if(t==='dates')return(s.dates||[]).includes(ds);
 const a=new Date((s.anchor||ds)+'T00:00'),x=new Date(ds+'T00:00');if(t==='interval')return x>=a&&Math.round((x-a)/864e5)%(s.every||1)===0;if(t==='monthly')return x.getDate()===a.getDate();return false}
export function planFor(s,d){if(!runsOn(s,d))return[];const ds=ymd(d);return(s.times||[]).map((t,i)=>{const[h,m]=t.split(':').map(Number);const p=new Date(d);p.setHours(h,m,0,0);p.setMinutes(p.getMinutes()+Math.floor(rnd(s.id+ds+i)*(s.jitter||0)));return{key:`${s.id}|${ds}|${i}`,planned:+p,ds}})}
export const fmt=t=>new Date(t).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export const ago=t=>{if(!t)return'Not yet';const m=Math.floor((Date.now()-t)/6e4);return m<1?'Just now':m<60?m+' min ago':m<1440?Math.floor(m/60)+' h ago':Math.floor(m/1440)+' d ago'};
export const mmss=s=>s?Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'):'0:00';
// Genuine communication only: messages actually sent (approved on laptop), replies detected, or contact you marked manually.
export function streak(events,cid){const days=new Set(events.filter(e=>e.contactId===cid&&['sent','reply','outside'].includes(e.type)).map(e=>ymd(new Date(e.ts))));let n=0;const d=new Date();if(!days.has(ymd(d)))d.setDate(d.getDate()-1);while(days.has(ymd(d))){n++;d.setDate(d.getDate()-1)}return n}
export const MS=[3,7,15,30,100];
