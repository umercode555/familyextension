(()=>{
const bg=m=>new Promise(r=>chrome.runtime.sendMessage(m,r));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const host=document.createElement('div');document.documentElement.appendChild(host);
const R=host.attachShadow({mode:'open'});
R.innerHTML=`<style>
:host{all:initial}*{box-sizing:border-box;font-family:"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif}
.w{--bg:#fff;--tx:#111b21;--sub:#667781;--ln:#e9edef;--ac:#00a884;--chip:#f0f2f5}
.w.d{--bg:#202c33;--tx:#e9edef;--sub:#8696a0;--ln:#2a3942;--ac:#00a884;--chip:#111b21}
#card{position:fixed;right:24px;bottom:24px;width:min(360px,94vw);background:var(--bg);color:var(--tx);border-radius:18px;box-shadow:0 12px 40px rgba(11,20,26,.35);z-index:99999;overflow:hidden;display:none;animation:up .35s cubic-bezier(.2,.9,.3,1.2)}
@keyframes up{from{transform:translateY(30px);opacity:0}}
.hd{background:linear-gradient(135deg,#008069,#00a884);color:#fff;padding:14px 18px;font-weight:600;font-size:15px;display:flex;justify-content:space-between}
.bd{padding:16px 18px;font-size:14px;line-height:1.45}.nm{font-size:18px;font-weight:600;margin-bottom:6px}
.bub{background:var(--chip);border-radius:12px;padding:10px 12px;margin:10px 0;font-size:14px}.bub b{display:block;margin-bottom:6px}
audio{width:100%;height:36px}.meta{color:var(--sub);font-size:12.5px;margin-top:6px}
.row{display:flex;gap:8px;padding:0 18px 16px;flex-wrap:wrap}
button{border:0;border-radius:20px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;background:var(--chip);color:var(--tx);transition:.15s}
button:hover{filter:brightness(.95)}button.p{background:var(--ac);color:#fff;margin-left:auto}button:disabled{opacity:.5}
.ok{padding:30px;text-align:center;font-size:16px;font-weight:600}.ok i{display:block;font-size:42px;color:var(--ac);font-style:normal;animation:pop .5s}
@keyframes pop{from{transform:scale(.2);opacity:0}}
#pill{position:fixed;left:84px;bottom:18px;z-index:99998;background:var(--ac);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.4);display:none}
#lk{position:fixed;left:84px;bottom:66px;width:min(300px,90vw);z-index:99999;background:var(--bg);color:var(--tx);border-radius:16px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.35);display:none;font-size:14px}
select{width:100%;padding:9px;border-radius:8px;border:1px solid var(--ln);margin:10px 0;background:var(--chip);color:var(--tx)}
</style><div class="w" id="w"><div id="card"></div><button id="pill"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>Link this chat to Kin</button><div id="lk"></div></div>`;
const $=s=>R.querySelector(s),W=$('#w');
const dark=()=>document.body.classList.contains('dark')||matchMedia('(prefers-color-scheme:dark)').matches&&!document.body.classList.contains('light');
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const dur=s=>s?Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'):'';
const click=e=>{if(!e)return;for(const t of['mousedown','mouseup','click'])e.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}))};
const hn=()=>{const h=document.querySelector('#main header');if(!h)return '';const e=h.querySelector('span[dir="auto"][title]')||h.querySelector('span[dir="auto"]');const n=e?(e.getAttribute('title')||e.textContent||'').trim():'';return /^(contact info|click here)/i.test(n)?'':n};
const titleOf=()=>{const n=hn();return n?[n]:[]};
const rows=n=>[...document.querySelectorAll('#pane-side span[title]')].filter(e=>e.getAttribute('title')===n);
const rowEl=e=>e.closest('[role="listitem"],[role="row"],[data-testid="cell-frame-container"]')||e.parentElement.parentElement.parentElement;
const composer=()=>document.querySelector('#main footer [contenteditable="true"]');
async function waitFor(f,ms=6000){const t=Date.now();while(Date.now()-t<ms){const v=f();if(v)return v;await sleep(150)}return null}
async function openChat(name){
 if(titleOf().includes(name))return null;
 let r=rows(name);
 if(!r.length){const s=document.querySelector('#side [contenteditable="true"]');if(s){s.focus();document.execCommand('insertText',false,name);await sleep(1500);r=rows(name)}}
 if(r.length!==1){const s=document.querySelector('#side [contenteditable="true"]');if(s){s.focus();document.execCommand('selectAll');document.execCommand('delete')}return r.length?'Several chats match "'+name+'". Nothing was sent.':'Could not find chat "'+name+'". Nothing was sent.'}
 click(rowEl(r[0]));
 return await waitFor(()=>titleOf().includes(name))?null:'Could not confirm it was '+name+'’s chat. Nothing was sent.'}
const sendBtn=()=>{const e=document.querySelector('[aria-label="Send"],[data-icon="send"]');return e&&(e.closest('button,[role="button"]')||e)};
async function sendItem(it){
 const c=it.contact;if(!c.waName)return 'Link '+c.name+' to a WhatsApp chat first (use “Link this chat” in WhatsApp).';
 if(!document.querySelector('#pane-side'))return 'WhatsApp is still loading.';
 const e=await openChat(c.waName);if(e)return e;
 const box=await waitFor(composer);if(!box)return 'Message box not found. Nothing was sent.';
 if(!titleOf().includes(c.waName))return 'Chat changed. Nothing was sent.';
 box.focus();
 if(it.item.kind==='text'){document.execCommand('insertText',false,it.item.text);}
 else{const r=await bg({t:'audio',id:it.item.id});if(!r||r.error)return 'Recording was deleted or is not downloaded yet. Nothing was sent.';const b=await (await fetch(r.url)).blob();const dt=new DataTransfer();dt.items.add(new File([b],r.name,{type:r.mime}));
  box.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))}
 const sb=await waitFor(sendBtn,8000);if(!sb)return 'Send button did not appear. Nothing was sent.';
 if(!titleOf().includes(c.waName))return 'Chat changed. Nothing was sent.';
 click(sb);await sleep(1500);
 cnt[c.waName]=document.querySelectorAll('#main .message-in').length;return null}
function report(err,it){const d={titles:titleOf(),pane:!!document.querySelector('#pane-side'),main:!!document.querySelector('#main'),composer:!!composer(),send:!!sendBtn(),search:!!document.querySelector('#side [contenteditable="true"]'),w:innerWidth};
 return `Kin v${chrome.runtime.getManifest().version}\n${navigator.userAgent}\n${new Date().toString()}\nERROR: ${err}\nLinked name: ${it.contact.waName||'none'} | item: ${it.item.kind}\nDOM: ${JSON.stringify(d)}`}
const lg=(s,e)=>{try{bg({t:'err',src:s,msg:e.message||String(e),ctx:(e.stack||'').slice(0,400)})}catch(_){}};
let list=[],busy=false,okUntil=0,cur=null,lastKey='';
const cnt={};
async function poll(){if(busy||Date.now()<okUntil)return;if(document.querySelector('#pane-side')){const w=await bg({t:'wantOpen'});if(w&&w.name){busy=true;try{await openChat(w.name)}catch(e){}busy=false}}const r=await bg({t:'queue'});list=(r&&r.list)||[];draw();pillDraw()}
function draw(){const c=$('#card');W.className='w'+(dark()?' d':'');
 if(!list.length){c.style.display='none';lastKey='';return}
 const it=list[0],key=it.id+list.length;if(key===lastKey)return;lastKey=key;c.style.display='block';
 const miss=it.status==='missed',when=new Date(it.planned).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'});
 c.innerHTML=`<div class="hd"><span>${miss?'A gentle heads-up':'A little reminder'}</span><span>${list.length>1?list.length+' waiting':''}</span></div>
 <div class="bd"><div class="nm">${miss?'You missed '+esc(it.contact.name)+'’s message':'Time to check in with '+esc(it.contact.name)}</div>
 ${miss?'<div>Would you like to send it now, skip it, or reschedule?</div>':''}
 <div class="bub"><b>${esc(it.item.title)}</b>${it.item.kind==='text'?esc(it.item.text):'<audio controls id="au"></audio>'}</div>
 <div class="meta">Contact: ${esc(it.contact.name)} · Scheduled: ${when}${it.item.duration?' · '+dur(it.item.duration):''}</div><div id="err" class="meta"></div></div>
 <div class="row"><button id="sk">Skip</button><button id="rs">Later</button>${list.length>1?'<button id="all">Approve all</button>':''}<button class="p" id="sn">Send now</button></div>
 <div class="row" id="rsr" style="display:none;padding-top:0"><button data-h="1">In 1 hour</button><button data-h="t">Tonight 8 PM</button><button data-h="24">Tomorrow</button></div>`;
 if(it.item.kind==='voice'){bg({t:'audio',id:it.item.id}).then(r=>{const a=$('#au');if(a&&r.url)a.src=r.url})}
 $('#sk').onclick=()=>fin(it,'skipped');$('#rs').onclick=()=>{$('#rsr').style.display='flex'};
 $('#rsr').onclick=e=>{const h=e.target.dataset.h;if(!h)return;let u=Date.now()+36e5;if(h==='24')u=Date.now()+864e5;if(h==='t'){const d=new Date();d.setHours(20,0,0,0);if(d<=Date.now())d.setDate(d.getDate()+1);u=+d}fin(it,'snoozed',u)};
 $('#sn').onclick=()=>go(it);const a=$('#all');if(a)a.onclick=async()=>{for(const x of [...list]){if(!await go(x,true))break}}}
async function fin(it,status,until){await bg({t:'done',id:it.id,status,until});lastKey='';poll()}
async function go(it,quiet){if(busy)return false;busy=true;const b=$('#sn');if(b){b.disabled=true;b.textContent='Sending…'}
 let err;try{err=await sendItem(it)}catch(x){err='Unexpected: '+x.message;lg('send',x)}busy=false;
 if(err){const rp=report(err,it);try{bg({t:'err',src:'send',msg:err,ctx:rp})}catch(_){}const e=$('#err');if(e){e.innerHTML=esc(err)+'<br><button id="cp" style="margin-top:8px">Copy error report</button>';$('#cp').onclick=async()=>{try{await navigator.clipboard.writeText(rp)}catch(_){const t=document.createElement('textarea');t.value=rp;document.body.append(t);t.select();document.execCommand('copy');t.remove()}$('#cp').textContent='Copied ✓'}};if(b){b.disabled=false;b.textContent='Try again'}return false}
 await bg({t:'done',id:it.id,status:'sent'});
 $('#card').innerHTML='<div class="ok"><i><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i>Sent to '+esc(it.contact.name)+'</div>';okUntil=Date.now()+1800;lastKey='';setTimeout(poll,1900);await sleep(1900);return true}
function pillDraw(){const p=$('#pill');p.style.display=document.querySelector('#main header')?'block':'none'}
$('#pill').onclick=async()=>{const lk=$('#lk');if(lk.style.display==='block'){lk.style.display='none';return}
 const name=titleOf()[0];const {list:cs}=await bg({t:'contacts'});
 lk.innerHTML=`<b>Open chat:</b> ${esc(name)}<select id="ct">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}${c.waName?' (linked)':''}</option>`).join('')}</select><button class="p" id="yes" style="margin:0">Yes, this is them. Remember.</button>`;
 lk.style.display='block';W.className='w'+(dark()?' d':'');
 $('#yes').onclick=async()=>{await bg({t:'link',contactId:$('#ct').value,waName:name});lk.style.display='none'}};
async function watch(){if(!document.querySelector('#pane-side'))return;const {list:cs}=await bg({t:'watch'});
 for(const c of cs){const open=titleOf().includes(c.waName);
  if(open){const n=document.querySelectorAll('#main .message-in').length;if(cnt[c.waName]===undefined)cnt[c.waName]=n;
   if(n>cnt[c.waName]){const m=[...document.querySelectorAll('#main .message-in .copyable-text')].pop();cnt[c.waName]=n;bg({t:'reply',contactId:c.id,preview:m?m.innerText:''})}}
  else{const r=rows(c.waName);if(r.length===1){const row=rowEl(r[0]);if(row.querySelector('[aria-label*="nread"]')){const ls=row.innerText.split('\n').map(x=>x.trim()).filter(Boolean);bg({t:'reply',contactId:c.id,preview:ls[ls.length-2]||''})}}}}}
setInterval(()=>poll().catch(e=>lg('poll',e)),4000);setInterval(()=>watch().catch(e=>lg('watch',e)),15000);poll().catch(e=>lg('poll',e));
})();
