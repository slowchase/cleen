/* Cleen Daily v6 — Home, Tasks, and End of Day pages share one cleaner session. */
(async function(){'use strict';
const $=id=>document.getElementById(id),cfg=window.CLEEN_CONFIG||{},page=document.body.dataset.page;
let client,user=null,tasks=[],marked={},tab='task',products=[],instructions=[];
const notice=s=>{const e=$('notice');e.textContent=s;e.className='visible';clearTimeout(notice.timer);notice.timer=setTimeout(()=>e.className='',5500)};
if(!window.supabase?.createClient||!cfg.SUPABASE_URL||cfg.SUPABASE_URL.includes('YOUR_')||!cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_')||!cfg.CLEANER_LOGIN_EMAIL||cfg.CLEANER_LOGIN_EMAIL.includes('CLEANER_')){$('login').hidden=false;notice('Configure docs/config.js and check your internet connection.');return}
client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'cleen-daily-v3'}});
const get=async q=>{const {data,error}=await q;if(error)throw error;return data};
const elem=(tag,text,cls)=>{const x=document.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x};
function show(ok){$('login').hidden=ok;$('app').hidden=!ok;$('logout').hidden=!ok}
async function photoUrl(path){return(await get(client.storage.from('cleen-photos').createSignedUrl(path,1200))).signedUrl}
function setDate(){const d=$('date');if(d)d.textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
async function load(){try{setDate();if(page==='home'){
 const quotes=await get(client.from('cleen_verse').select('*').eq('id',1));const verse=quotes?.[0];$('verseBlock').hidden=!verse?.quote;if(verse?.quote){$('verseQuote').textContent=verse.quote;$('verseCitation').textContent=verse.citation||''}
 }else if(page==='tasks'){
 const [all,done,p,i]=await Promise.all([get(client.from('tasks').select('*').eq('status','published').order('created_at',{ascending:true})),get(client.from('task_completions').select('task_id,done').eq('user_id',user.id)),get(client.from('cleen_products').select('*')),get(client.from('cleen_instructions').select('*'))]);tasks=all;marked=Object.fromEntries(done.map(x=>[x.task_id,x.done]));products=p;instructions=i;render();
 }}catch(e){notice('Could not load Cleen Daily: '+e.message);console.error(e)}}
function updateCount(){const ordinary=tasks.filter(t=>(t.kind||'task')==='task');$('taskCount').textContent=`${ordinary.filter(x=>marked[x.id]).length}/${ordinary.length}`}
function confetti(wrap){
 // Pieces travel straight outward, never rotate, and individually cycle through a rainbow gradient.
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,distance=18+(i%3)*5;
  const bit=elem('i',null,'confetti-bit');bit.setAttribute('aria-hidden','true');
  bit.style.setProperty('--bit-x',`${Math.cos(angle)*distance}px`);
  bit.style.setProperty('--bit-y',`${Math.sin(angle)*distance}px`);
  bit.style.setProperty('--rainbow-offset',`${i*33}ms`);
  wrap.append(bit);
  bit.addEventListener('animationend',e=>{if(e.animationName==='tiny-confetti')bit.remove()});
  setTimeout(()=>bit.remove(),1200);
 }
}
function youtubeId(raw){
 try{
  const url=new URL(raw);
  const host=url.hostname.toLowerCase();
  let id='';
  if(host==='youtu.be'||host==='www.youtu.be')id=url.pathname.split('/')[1]||'';
  else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
   const parts=url.pathname.split('/').filter(Boolean);
   if(parts[0]==='watch')id=url.searchParams.get('v')||'';
   else if(['embed','shorts','live','v'].includes(parts[0]))id=parts[1]||'';
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null}
}
function appendVideo(parent,url,label){
 if(!url)return;
 const id=youtubeId(url);
 if(id){
  const container=elem('div',null,'video-instruction');
  const frame=elem('iframe');frame.src=`https://www.youtube-nocookie.com/embed/${id}`;
  frame.title=label||'YouTube video instructions';frame.loading='lazy';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  frame.setAttribute('allowfullscreen','');container.append(frame);parent.append(container);
  const source=elem('a','Watch on YouTube');source.href=url;source.target='_blank';source.rel='noopener noreferrer';parent.append(source);
 }else{
  const link=elem('a',label||'Video instructions');
  // Do not create navigation to javascript:, data:, or other unsafe schemes.
  try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return;link.href=parsed.href}
  catch{return}
  link.target='_blank';link.rel='noopener noreferrer';parent.append(link);
 }
}

function render(){if(page!=='tasks')return;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));updateCount();const list=$('list');list.replaceChildren();const shown=tasks.filter(t=>(t.kind||'task')===tab);if(!shown.length){list.append(elem('p','Nothing posted here yet.','quiet'));return}
 for(const t of shown){const article=elem('article',null,'item');const row=elem('div',null,'item-top');const wrap=elem('span',null,'check-wrap');const ck=elem('input');ck.type='checkbox';ck.checked=!!marked[t.id];ck.setAttribute('aria-label',`Mark ${t.title} complete`);wrap.append(ck);
 const title=elem('button',t.title,'item-title');title.type='button';const badge=elem('span',tab==='quality'?(t.issue_status||'open'):tab==='buy'?`Qty ${t.quantity||1}`:(t.room||''),'item-tag');const details=elem('div',null,'item-details');details.hidden=true;
 const description=[t.description,t.use_text&&`Use: ${t.use_text}`,t.store&&`Store: ${t.store}`,t.cleaning_type&&`Type: ${t.cleaning_type}`,t.due_date&&`Due: ${t.due_date}`].filter(Boolean);for(const line of description)details.append(elem('p',line));
 if(t.photo_path){const img=elem('img');img.alt=t.title;img.className=t.photo_size==='full'?'':'small';photoUrl(t.photo_path).then(x=>img.src=x).catch(console.warn);details.append(img)}
 const product=products.find(x=>x.id===t.product_id);if(product)details.append(elem('p',`Product: ${product.name} — ${product.use_text}`));const instruction=instructions.find(x=>x.id===t.instruction_id);if(instruction){details.append(elem('p',instruction.body));if(instruction.video_link)appendVideo(details,instruction.video_link,'Video instructions')}if(t.video_link&&t.video_link!==instruction?.video_link)appendVideo(details,t.video_link,'Video link')
 row.append(wrap,title,badge);title.addEventListener('click',()=>details.hidden=!details.hidden);
 ck.addEventListener('change',async()=>{const checked=ck.checked;ck.disabled=true;try{await get(client.from('task_completions').upsert({task_id:t.id,user_id:user.id,done:checked,updated_at:new Date().toISOString()},{onConflict:'task_id,user_id'}));marked[t.id]=checked;updateCount();if(checked)confetti(wrap)}catch(e){ck.checked=!checked;notice(e.message)}finally{ck.disabled=false}});
 article.append(row,details);list.append(article)
 }}
async function upload(file){if(file.size>15*1024*1024)throw Error('Photo must be 15MB or smaller.');let blob=file,ext=file.name.split('.').pop()?.toLowerCase()||'jpg';if('createImageBitmap'in window&&!/heic|heif/.test(file.type)){try{const bmp=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close();const out=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.82));if(out){blob=out;ext='jpg'}}catch(e){console.warn(e)}}const path=`${user.id}/${crypto.randomUUID()}.${ext}`;await get(client.storage.from('cleen-photos').upload(path,blob,{contentType:blob.type||'image/jpeg'}));return path}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:cfg.CLEANER_LOGIN_EMAIL,password:$('password').value});if(error)throw error;$('password').value=''}catch(err){notice(err.message)}finally{button.disabled=false}});
$('logout').addEventListener('click',()=>client.auth.signOut());
if(page==='tasks')document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render()}));
if(page==='report')$('reportForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const f=$('reportPhoto').files[0];const path=f?await upload(f):null;await get(client.from('reports').insert({user_id:user.id,notes:$('reportNotes').value.trim(),photo_path:path,photo_description:$('photoDescription').value.trim()}));$('reportForm').reset();notice('Report submitted.')}catch(err){notice(err.message)}finally{button.disabled=false}});
client.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==user?.id){user=session?.user||null;show(!!user);if(user)setTimeout(load,0)}});
try{const {data:{session}}=await client.auth.getSession();user=session?.user||null;show(!!user);if(user)await load()}catch(e){notice(e.message);show(false)}
})();
