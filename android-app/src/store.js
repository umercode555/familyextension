import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system';
import {TBL,FLD,ORDER,cols,fromRow,nv,J,extOf,uuid} from './lib';
const K='kin_state_v1';
let S={cfg:{url:process.env.EXPO_PUBLIC_SUPABASE_URL||'',key:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||''},auth:null,st:'signedout',err:'',name:'',notify:true,rev:0,cur:{},d:{contacts:{},items:{},schedules:{},queue:{},events:{}}};
const subs=new Set();let t=null,busy=null,ready=false;
export const get=()=>S;
export const subscribe=f=>{subs.add(f);return()=>subs.delete(f)};
const emit=()=>{S={...S,rev:S.rev+1};subs.forEach(f=>f());clearTimeout(t);t=setTimeout(()=>AsyncStorage.setItem(K,JSON.stringify(S)).catch(()=>{}),400)};
export const list=s=>Object.values(S.d[s]).filter(x=>!x._del);
export const dirtyCount=()=>ORDER.reduce((n,s)=>n+Object.values(S.d[s]).filter(x=>x._d).length,0);
export async function init(){try{const j=await AsyncStorage.getItem(K);if(j){const v=JSON.parse(j);S={...S,...v,cfg:{url:v.cfg&&v.cfg.url||S.cfg.url,key:v.cfg&&v.cfg.key||S.cfg.key}}}}catch(e){}ready=true;emit();sync()}
const DIR=FS.documentDirectory+'audio/';
const rq=async(url,o)=>{let r;try{r=await fetch(url,o)}catch(e){const x=new Error('offline');x.net=1;throw x}if(!r.ok){const tx=await r.text().catch(()=>'');throw new Error(r.status+' '+tx.slice(0,200))}return r};
const isNet=e=>e.net||/network request failed|unable to resolve|failed to connect|timed out|offline/i.test(e.message||'');
// ---- auth
async function setAuth(j){S.auth={uid:j.user.id,email:j.user.email,access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(j.expires_in||3600)*1000}}
async function token(){const a=S.auth;if(!a)return null;if(a.exp-Date.now()>60000)return a;
 let r;try{r=await rq(S.cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:S.cfg.key,'Content-Type':'application/json'},body:J({refresh_token:a.refresh})})}catch(e){if(isNet(e))throw e;const x=new Error('Session expired. Sign in again.');x.auth=1;throw x}
 await setAuth(await r.json());emit();return S.auth}
export async function signIn(url,key,email,password,signup){url=(url||'').trim().replace(/\/$/,'');key=(key||'').trim();if(!url||!key||!email||!password)return'Fill every field';
 let r;try{r=await rq(url+(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password'),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:J({email,password})})}catch(e){return isNet(e)?'No internet':e.message}
 const j=await r.json();if(!j.access_token)return'Account created. Confirm your email, or turn off "Confirm email" in Supabase Auth, then sign in.';
 if(S.auth&&S.auth.uid!==j.user.id){S.d={contacts:{},items:{},schedules:{},queue:{},events:{}};S.cur={}}
 S.cfg={url,key};await setAuth(j);S.st='syncing';emit();sync();return null}
export function signOut(){S.auth=null;S.st='signedout';emit()}
export function setPrefs(p){S={...S,...p};emit()}
// ---- mutations (local-first; dirty rows are pushed by sync)
export function put(s,o){o.id=o.id||uuid();o._d=1;o._v=(o._v||0)+1;S.d[s][o.id]=o;emit();sync();return o}
export function del(s,id){const o=S.d[s][id];if(!o)return;S.d[s][id]={...o,_del:1,_d:1,_v:(o._v||0)+1};
 if(s==='items'){if(o.uri)FS.deleteAsync(o.uri,{idempotent:true}).catch(()=>{});for(const q of list('queue'))if(q.itemId===id&&(q.status==='pending'||q.status==='missed'))put('queue',{...q,status:'cancelled'});
  for(const sc of list('schedules')){const fx=sc.fixedByDate||{};if((sc.itemIds||[]).includes(id)||Object.values(fx).includes(id)){const f={};for(const[k,v]of Object.entries(fx))if(v!==id)f[k]=v;put('schedules',{...sc,itemIds:(sc.itemIds||[]).filter(x=>x!==id),fixedByDate:f})}}}
 if(s==='contacts'){for(const i of list('items'))if(i.contactId===id)del('items',i.id);for(const sc of list('schedules'))if(sc.contactId===id)del('schedules',sc.id);for(const q of list('queue'))if(q.contactId===id&&(q.status==='pending'||q.status==='missed'))put('queue',{...q,status:'cancelled'})}
 emit();sync()}
export async function addAudio(contactId,src,{title,duration,mime}){const id=uuid(),ext=extOf(mime),dest=DIR+id+'.'+ext;await FS.makeDirectoryAsync(DIR,{intermediates:true}).catch(()=>{});await FS.copyAsync({from:src,to:dest});
 return put('items',{id,kind:'voice',title,contactId,category:'General',duration,mime,uri:dest,sentCount:0})}
// ---- sync
export function sync(){if(!S.auth||!ready)return Promise.resolve();return busy||(busy=run().finally(()=>{busy=null}))}
const setSt=(st,err)=>{if(S.st!==st||S.err!==(err||'')){S={...S,st,err:err||''};subs.forEach(f=>f())}};
async function run(){let a;try{a=await token()}catch(e){setSt(isNet(e)?'offline':'auth',e.message);return}
 try{setSt('syncing');await push(a);const ch=await pull(a);if(ch)emit();setSt('synced')}catch(e){setSt(isNet(e)?'offline':'error',e.message)}}
const H=a=>({apikey:S.cfg.key,Authorization:'Bearer '+a.access,'Content-Type':'application/json'});
async function push(a){const h=H(a),c=S.cfg;
 for(const s of ORDER)for(const r of Object.values(S.d[s]).filter(x=>x._d)){
  if(r._del){if(s==='items'&&r.path)try{await rq(`${c.url}/storage/v1/object/voice/${r.path}`,{method:'DELETE',headers:h})}catch(e){if(isNet(e))throw e}
   await rq(`${c.url}/rest/v1/${TBL[s]}?id=eq.${encodeURIComponent(r.id)}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:J({deleted_at:new Date().toISOString()})});delete S.d[s][r.id];continue}
  let path=r.path,filename=r.filename;
  if(s==='items'&&r.kind==='voice'&&r.uri&&!r.path){const ext=extOf(r.mime);path=`${a.uid}/${r.id}.${ext}`;filename=(r.title||'voice')+'.'+ext;
   const u=await FS.uploadAsync(`${c.url}/storage/v1/object/voice/${path}`,r.uri,{httpMethod:'POST',uploadType:FS.FileSystemUploadType.BINARY_CONTENT,headers:{apikey:c.key,Authorization:'Bearer '+a.access,'Content-Type':r.mime||'audio/mp4','x-upsert':'true'}});
   if(u.status<200||u.status>=300)throw new Error('upload '+u.status+' '+(u.body||'').slice(0,150))}
  const x={...r,path,filename},row=cols(s,x);let diff=null;if(r._b){diff={};for(const k in row)if(J(row[k])!==J(r._b[k]))diff[k]=row[k]}
  if(!diff)await rq(`${c.url}/rest/v1/${TBL[s]}?on_conflict=id`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates,return=minimal'},body:J({id:r.id,user_id:a.uid,...row})});
  else if(Object.keys(diff).length)await rq(`${c.url}/rest/v1/${TBL[s]}?id=eq.${encodeURIComponent(r.id)}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:J(diff)});
  const cur=S.d[s][r.id];if(cur){const n={...cur,_b:row};if(path&&!cur.path){n.path=path;n.filename=filename}if(cur._v===r._v)delete n._d;S.d[s][r.id]=n}}}
async function pull(a){const h=H(a),c=S.cfg;let changed=false;
 for(const s of ORDER){const cur=S.cur[s]||'1970-01-01T00:00:00+00:00';
  const rows=await(await rq(`${c.url}/rest/v1/${TBL[s]}?updated_at=gte.${encodeURIComponent(cur)}&order=updated_at.asc&limit=1000`,{headers:h})).json();let max=cur;
  for(const row of rows){if(row.updated_at>max)max=row.updated_at;const loc=S.d[s][row.id];
   if(row.deleted_at){if(loc){if(s==='items'&&loc.uri)FS.deleteAsync(loc.uri,{idempotent:true}).catch(()=>{});delete S.d[s][row.id];changed=true;
     if(s==='items')for(const q of list('queue'))if(q.itemId===row.id&&(q.status==='pending'||q.status==='missed'))put('queue',{...q,status:'cancelled'})}continue}
   const o=fromRow(s,row),b=cols(s,o);
   if(loc&&loc._d){if(!loc._b)continue;const m={...loc};for(const[l,col]of FLD[s])if(J(nv(loc,l))===J(loc._b[col]))m[l]=o[l];m._b=b;S.d[s][row.id]=m;changed=true;continue}
   if(loc&&J(cols(s,loc))===J(b)){if(!loc._b)S.d[s][row.id]={...loc,_b:b};continue}
   const n={...o,_b:b};if(s==='items'&&loc&&loc.uri&&loc.path===o.path&&loc.duration===o.duration&&loc.mime===o.mime)n.uri=loc.uri;
   S.d[s][row.id]=n;changed=true}
  S.cur={...S.cur,[s]:max}}
 for(const i of Object.values(S.d.items))if(!i._del&&i.path&&!i.uri&&i.kind==='voice'){
  try{await FS.makeDirectoryAsync(DIR,{intermediates:true}).catch(()=>{});const dest=DIR+i.id+'.'+extOf(i.mime);
   const r=await FS.downloadAsync(`${c.url}/storage/v1/object/authenticated/voice/${i.path}`,dest,{headers:{apikey:c.key,Authorization:'Bearer '+a.access}});
   if(r.status===200){S.d.items[i.id]={...S.d.items[i.id],uri:dest};changed=true}else await FS.deleteAsync(dest,{idempotent:true})}catch(e){if(isNet(e))throw e}}
 return changed}
