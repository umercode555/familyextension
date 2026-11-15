// Supabase two-way sync (REST). Local-first: every local write is marked dirty (_d) and pushed; remote changes are pulled by updated_at cursor.
const TBL={contacts:'contacts',items:'items',schedules:'schedules',queue:'instances',events:'events'};
const FLD={
contacts:[['name','name'],['relation','relation'],['notes','notes'],['paused','paused'],['waName','wa_name'],['lastSent','last_sent'],['sentCount','sent_count'],['awaitingSince','awaiting_since'],['lastReply','last_reply'],['lastIncoming','last_incoming']],
items:[['kind','kind'],['title','title'],['contactId','contact_id'],['category','category'],['text','text'],['duration','duration'],['mime','mime'],['sentCount','sent_count'],['lastSent','last_sent'],['path','storage_path'],['filename','filename']],
schedules:[['contactId','contact_id'],['type','type'],['days','days'],['dates','dates'],['every','every_n'],['anchor','anchor'],['times','times'],['jitter','jitter'],['mode','mode'],['active','active'],['itemIds','item_ids'],['fixedByDate','fixed_by_date'],['created','created_ms']],
queue:[['scheduleId','schedule_id'],['contactId','contact_id'],['itemId','item_id'],['planned','planned_ms'],['status','status'],['snoozeUntil','snooze_until'],['doneAt','done_at']],
events:[['ts','ts'],['type','type'],['contactId','contact_id'],['title','title'],['detail','detail']]};
const ORDER=['contacts','items','schedules','queue','events'];
const DEF={days:[],dates:[],times:[],itemIds:[],fixedByDate:{},every:1,jitter:0,paused:false,active:true,sentCount:0,title:'',status:'pending',kind:'voice',type:'daily',mode:'rotate'};
const J=JSON.stringify;
const nv=(o,l)=>o[l]==null?(l in DEF?DEF[l]:null):o[l];
const colsOf=(s,o)=>{const r={};for(const[l,c]of FLD[s])r[c]=nv(o,l);return r};
const fromRow=(s,r)=>{const o={id:r.id};for(const[l,c]of FLD[s])o[l]=r[c]==null&&l in DEF?DEF[l]:r[c];return o};
const extOf=m=>{m=m||'';return m.includes('ogg')||m.includes('opus')?'ogg':m.includes('mpeg')?'mp3':m.includes('mp4')||m.includes('m4a')||m.includes('aac')?'m4a':m.includes('wav')?'wav':m.includes('webm')?'webm':'bin'};
async function rq(url,o){let r;try{r=await fetch(url,o)}catch(e){const x=new Error('offline');x.net=1;throw x}if(!r.ok){const t=await r.text().catch(()=>'');const x=new Error(r.status+' '+t.slice(0,200));x.status=r.status;throw x}return r}
async function saveAuth(c,j){const n={id:'auth',uid:j.user.id,email:j.user.email,access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(j.expires_in||3600)*1000};await DB.put('kv',n);return n}
async function token(){const a=await DB.get('kv','auth');if(!a)return null;if(a.exp-Date.now()>60000)return a;const c=await DB.get('kv','cfg');
 let r;try{r=await rq(c.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:J({refresh_token:a.refresh})})}catch(e){if(e.net)throw e;const x=new Error('Session expired. Sign in again.');x.auth=1;throw x}
 return saveAuth(c,await r.json())}
async function signIn(url,key,email,password,signup){url=(url||'').trim().replace(/\/$/,'');key=(key||'').trim();
 if(!url||!key||!email||!password)return{error:'Fill every field'};
 let r;try{r=await rq(url+(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password'),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:J({email,password})})}catch(e){return{error:e.net?'No internet':e.message}}
 const j=await r.json();if(!j.access_token)return{error:'Account created. Confirm the email, or turn off "Confirm email" in Supabase Auth, then sign in.'};
 const prev=await DB.get('kv','auth');const prevCfg=await DB.get('kv','cfg');
 if(prev&&prev.uid&&prev.uid!==j.user.id||prevCfg&&prevCfg.uid&&prevCfg.uid!==j.user.id){for(const s of SYNCED)for(const x of await DB.rawAll(s))await DB.rawDel(s,x.id);for(const s of ORDER)await DB.rawDel('kv','cur_'+s)}
 await DB.put('kv',{id:'cfg',url,key,uid:j.user.id});await saveAuth({url,key},j);
 for(const s of SYNCED)for(const x of await DB.rawAll(s))if(!x._b&&!x._d)await DB.rawPut(s,{...x,_d:1,_v:(x._v||0)+1});
 sync();return{ok:1}}
async function signOut(){await DB.rawDel('kv','auth');await DB.put('kv',{id:'status',s:'signedout',ts:Date.now()})}
const setStatus=(s,x)=>DB.put('kv',{id:'status',s,x:x||'',ts:Date.now()});
let _sy=null;
function sync(){return _sy||(_sy=run().finally(()=>{_sy=null}))}
async function run(){const c=await DB.get('kv','cfg');if(!c||!c.url)return;let a;
 try{a=await token()}catch(e){await setStatus(e.net?'offline':'auth',e.message);return}
 if(!a){await setStatus('signedout');return}
 try{await setStatus('syncing');await push(c,a);const ch=await pull(c,a);if(ch)await DB.put('kv',{id:'rev',v:Date.now()});await setStatus('synced')}
 catch(e){await setStatus(e.net?'offline':'error',String(e.message||e));if(!e.net&&typeof logErr==='function')logErr('sync',e)}}
async function push(c,a){const h={apikey:c.key,Authorization:'Bearer '+a.access,'Content-Type':'application/json'};
 for(const s of ORDER)for(const r of (await DB.rawAll(s)).filter(x=>x._d)){
  if(r._del){if(s==='items'&&r.path)try{await rq(`${c.url}/storage/v1/object/voice/${r.path}`,{method:'DELETE',headers:h})}catch(e){if(e.net)throw e}
   await rq(`${c.url}/rest/v1/${TBL[s]}?id=eq.${encodeURIComponent(r.id)}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:J({deleted_at:new Date().toISOString()})});await DB.rawDel(s,r.id);continue}
  if(s==='items'&&r.blob&&!r.path){const ext=extOf(r.mime||r.blob.type);r.path=`${a.uid}/${r.id}.${ext}`;r.filename=(r.title||'voice')+'.'+ext;
   await rq(`${c.url}/storage/v1/object/voice/${r.path}`,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+a.access,'Content-Type':r.mime||r.blob.type||'application/octet-stream','x-upsert':'true'},body:r.blob})}
  const row=colsOf(s,r);let diff=null;if(r._b){diff={};for(const k in row)if(J(row[k])!==J(r._b[k]))diff[k]=row[k]}
  if(!diff)await rq(`${c.url}/rest/v1/${TBL[s]}?on_conflict=id`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates,return=minimal'},body:J({id:r.id,user_id:a.uid,...row})});
  else if(Object.keys(diff).length)await rq(`${c.url}/rest/v1/${TBL[s]}?id=eq.${encodeURIComponent(r.id)}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:J(diff)});
  const cur=await DB.rawGet(s,r.id);if(cur){const n={...cur,_b:row};if(r.path&&!cur.path){n.path=r.path;n.filename=r.filename}if(cur._v===r._v)delete n._d;await DB.rawPut(s,n)}}}
async function pull(c,a){const h={apikey:c.key,Authorization:'Bearer '+a.access};let changed=false;
 for(const s of ORDER){const ck='cur_'+s,cur=(await DB.get('kv',ck))||{id:ck,v:'1970-01-01T00:00:00+00:00'};
  const rows=await(await rq(`${c.url}/rest/v1/${TBL[s]}?updated_at=gte.${encodeURIComponent(cur.v)}&order=updated_at.asc&limit=1000`,{headers:h})).json();let max=cur.v;
  for(const row of rows){if(row.updated_at>max)max=row.updated_at;const loc=await DB.rawGet(s,row.id);
   if(row.deleted_at){if(loc){await DB.rawDel(s,row.id);changed=true;if(s==='items')await cancelFor(row.id)}continue}
   const o=fromRow(s,row),b=colsOf(s,o);
   if(loc&&loc._d){if(!loc._b)continue;const m={...loc};for(const[l,col]of FLD[s])if(J(nv(loc,l))===J(loc._b[col]))m[l]=o[l];m._b=b;await DB.rawPut(s,m);changed=true;continue}
   if(loc&&J(colsOf(s,loc))===J(b)){if(!loc._b)await DB.rawPut(s,{...loc,_b:b});continue}
   const n={...o,_b:b};
   if(s==='items'&&loc&&loc.blob&&loc.path===o.path&&loc.duration===o.duration&&loc.mime===o.mime)n.blob=loc.blob;
   await DB.rawPut(s,n);changed=true}
  await DB.put('kv',{id:ck,v:max})}
 for(const i of await DB.rawAll('items'))if(!i._del&&i.path&&!i.blob&&i.kind==='voice'){
  try{const r=await rq(`${c.url}/storage/v1/object/authenticated/voice/${i.path}`,{headers:h});const cur=await DB.rawGet('items',i.id);if(cur&&!cur.blob)await DB.rawPut('items',{...cur,blob:await r.blob()});changed=true}catch(e){if(e.net)throw e}}
 return changed}
