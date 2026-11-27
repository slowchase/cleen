/* Cleen Admin v6. Plain browser scripts support opening index.html via file://. */
(async function () {
'use strict';
const $=id=>document.getElementById(id);
const cfg=window.CLEEN_CONFIG||{};
const badConfig=!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_URL.includes('YOUR_')||cfg.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_');
if(badConfig||!window.supabase?.createClient||!window.JSZip){$('setup').hidden=false;$('setupMessage').textContent=badConfig?'Enter your Supabase URL and publishable key in admin/config.js.':'A browser library did not load. Internet access is required.';return}

// Both accounts' login emails stay in Edge Function secrets, not the public website.
async function cleenPasswordLogin(role,password){
 const response=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,'')}/functions/v1/cleen-login`,{
   method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify({role,password})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload.access_token||!payload.refresh_token)throw Error(payload.error||'Sign-in failed. Check your password and try again.');
 return payload;
}

const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'cleen-admin-v3'}});
const BUCKET='cleen-photos';const typeNames={task:'Task',quality:'Quality',buy:'To Buy'};
let user=null,authorized=false,page='home',kind='task',category='cleaning',historyTab='completed',editing=null,oldPhoto=null,photoRemoved=false,items=[],categories=[],products=[],instructions=[],routines=[],reports=[],completions=[],verse=null,queueTabs={task:'draft',quality:'draft',buy:'draft'},newFile=null;
const notify=(s,error=false)=>{const el=$('toast');el.textContent=s;el.className='visible'+(error?' error':'');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.className='',6500)};
function go(name){page=name;document.querySelectorAll('.page').forEach(x=>x.hidden=x.dataset.page!==name);$('back').style.visibility=name==='home'?'hidden':'visible';if(name==='create')renderQueues();if(name==='history')renderHistory();if(name==='published')renderPublished();if(name==='routines')void dueRoutines();window.scrollTo(0,0)}
function showAdmin(ok){authorized=ok;$('login').hidden=ok;$('workspace').hidden=!ok;$('logout').hidden=!ok;if(ok)go('home')}
async function result(q){const {data,error}=await q;if(error)throw error;return data}
async function checkRole(){if(!user){showAdmin(false);return}try{const row=await result(sb.from('members').select('role').eq('user_id',user.id).single());if(row?.role!=='admin')throw Error('Signed-in user is not an admin.');showAdmin(true);await refresh()}catch(e){showAdmin(false);notify('Admin role check failed: '+e.message,true);console.error(e)}}
async function loadTable(table,order='created_at'){return await result(sb.from(table).select('*').order(order,{ascending:false}))}
async function refresh(){try{[items,categories,products,instructions,routines,reports,completions]=await Promise.all([loadTable('tasks'),loadTable('cleen_categories','sort_order'),loadTable('cleen_products'),loadTable('cleen_instructions'),loadTable('cleen_routines'),loadTable('reports'),loadTable('task_completions','updated_at')]);const rows=await result(sb.from('cleen_verse').select('*').eq('id',1));verse=rows?.[0]||null;renderAll();await dueRoutines()}catch(e){notify('Could not load Cleen v3 data: '+e.message+' — run migrate-v3.sql.',true);console.error(e)}}
const dom=(tag,txt,cls)=>{const el=document.createElement(tag);if(txt!==undefined&&txt!==null)el.textContent=txt;if(cls)el.className=cls;return el};
const btn=(label,fn,cls='link')=>{const el=dom('button',label,cls);el.type='button';el.addEventListener('click',fn);return el};
function safeDate(s){return s?new Date(s+'T12:00:00').toLocaleDateString():''}
function fillSelect(id,cat,selected=''){const sel=$(id);const first=dom('option','select');first.value='';sel.replaceChildren(first);for(const entry of categories.filter(c=>c.category_type===cat)){const opt=dom('option',entry.name);opt.value=entry.name;sel.append(opt)}sel.value=selected}
function renderSelects(){fillSelect('cleaningType','cleaning');fillSelect('taskRoom','room');fillSelect('qualityRoom','room');fillSelect('concernType','concern');fillSelect('routineCleaning','cleaning');fillSelect('routineRoom','room');for(const [id,arr] of [['productRef',products],['instructionRef',instructions]]){const sel=$(id);sel.replaceChildren(new Option('None',''));for(const a of arr)sel.append(new Option(a.name,a.id))}}
function renderAll(){renderSelects();renderQueues();renderProducts();renderInstructions();renderCategories();renderRoutines();renderPublished();renderHistory();$('verseQuote').value=verse?.quote||'';$('verseCitation').value=verse?.citation||''}
function switchKind(k){kind=k;editing=null;oldPhoto=null;newFile=null;photoRemoved=false;$('itemForm').reset();$('itemPhotoPreview').hidden=true;$('photoPrompt').hidden=false;document.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x.dataset.kind===kind));$('taskFields').hidden=k!=='task';$('qualityFields').hidden=k!=='quality';$('buyFields').hidden=k!=='buy';$('advanced').hidden=k==='buy';$('buyQuantity').value=1;renderQueues()}
async function signedPhoto(path){if(!path)return null;const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(path,900);if(error)throw error;return data.signedUrl}
function photoPreview(file){if(!file){$('itemPhotoPreview').hidden=true;$('photoPrompt').hidden=false;return}const src=URL.createObjectURL(file);$('itemPhotoPreview').src=src;$('itemPhotoPreview').hidden=false;$('photoPrompt').hidden=true;$('itemPhotoPreview').onload=()=>URL.revokeObjectURL(src)}
async function uploadPhoto(file){const clean=await compressImage(file);const path=`${user.id}/${crypto.randomUUID()}.${clean.ext}`;const {error}=await sb.storage.from(BUCKET).upload(path,clean.blob,{contentType:clean.blob.type});if(error)throw error;return path}
async function compressImage(file){if(file.size>15*1024*1024)throw Error('Maximum original image size is 15 MB.');if(!file.type.startsWith('image/'))throw Error('Please choose an image.');if(!('createImageBitmap' in window)||file.type.includes('heic')||file.type.includes('heif'))return {blob:file,ext:file.name.split('.').pop()?.toLowerCase()||'jpg'};try{const bmp=await createImageBitmap(file);const scale=Math.min(1,1700/Math.max(bmp.width,bmp.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bmp.width*scale);canvas.height=Math.round(bmp.height*scale);canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.81));if(!blob)return {blob:file,ext:file.name.split('.').pop()||'jpg'};return {blob,ext:'jpg'}}catch(e){console.warn('Compression not available',e);return {blob:file,ext:file.name.split('.').pop()?.toLowerCase()||'jpg'}}}
function formPayload(status){const common={title:$('itemTitle').value.trim(),kind,status,photo_size:document.querySelector('input[name="photo_size"]:checked').value,due_date:$('dueDate').value||null,product_id:$('productRef').value||null,instruction_id:$('instructionRef').value||null,video_link:$('videoLink').value.trim(),updated_at:new Date().toISOString()};if(!common.title)throw Error('Please enter a title.');if(kind==='task')Object.assign(common,{cleaning_type:$('cleaningType').value,room:$('taskRoom').value,description:$('taskDescription').value.trim(),concern_type:'',store:'',use_text:''});if(kind==='quality')Object.assign(common,{concern_type:$('concernType').value,room:$('qualityRoom').value,description:$('qualityDescription').value.trim(),issue_status:document.querySelector('input[name="issue_status"]:checked').value,cleaning_type:'',store:'',use_text:''});if(kind==='buy')Object.assign(common,{store:$('buyStore').value.trim(),use_text:$('buyUse').value.trim(),description:$('buyDescription').value.trim(),quantity:Math.max(1,Number($('buyQuantity').value)||1),photo_size:document.querySelector('input[name="photo_size"]:checked').value,cleaning_type:'',room:'',concern_type:'',due_date:null,product_id:null,instruction_id:null,video_link:''});return common}
async function saveItem(status){const buttons=[$('saveDraft')];buttons.forEach(b=>b.disabled=true);let uploaded=null;try{const payload=formPayload(status);if(newFile){uploaded=await uploadPhoto(newFile);payload.photo_path=uploaded}else if(photoRemoved)payload.photo_path=null;else if(!editing)payload.photo_path=null;if(editing)await result(sb.from('tasks').update(payload).eq('id',editing));else await result(sb.from('tasks').insert({...payload,created_by:user.id}));notify(status==='published'?'Item posted to Cleen Daily.':'Draft saved.');switchKind(kind);await refresh()}catch(e){notify(e.message,true)}finally{buttons.forEach(b=>b.disabled=false)}}
async function editItem(item){switchKind(item.kind||'task');editing=item.id;oldPhoto=item.photo_path;photoRemoved=false;$('itemTitle').value=item.title||'';$('taskDescription').value=item.description||'';$('qualityDescription').value=item.description||'';$('buyDescription').value=item.description||'';$('cleaningType').value=item.cleaning_type||'';$('taskRoom').value=item.room||'';$('qualityRoom').value=item.room||'';$('concernType').value=item.concern_type||'';$('buyStore').value=item.store||'';$('buyUse').value=item.use_text||'';$('buyQuantity').value=item.quantity||1;$('dueDate').value=item.due_date||'';$('productRef').value=item.product_id||'';$('instructionRef').value=item.instruction_id||'';$('videoLink').value=item.video_link||'';document.querySelector(`input[name="photo_size"][value="${item.photo_size||'small'}"]`).checked=true;document.querySelector(`input[name="issue_status"][value="${item.issue_status||'open'}"]`).checked=true;if(item.photo_path){try{$('itemPhotoPreview').src=await signedPhoto(item.photo_path);$('itemPhotoPreview').hidden=false;$('photoPrompt').hidden=true}catch(e){notify(e.message,true)}}go('create')}
async function updateItem(id,changes){try{await result(sb.from('tasks').update({...changes,updated_at:new Date().toISOString()}).eq('id',id));await refresh();notify('Updated.')}catch(e){notify(e.message,true)}}
function renderQueues(){
 const root=$('queues');root.replaceChildren();
 for(const type of ['task','quality','buy']){
  const group=dom('section',null,'queue-group');
  group.append(dom('div',typeNames[type]+' Quick Preview','queue-heading'));
  const choices=dom('div',null,'status-tabs');
  for(const state of ['draft','published']){
   const count=items.filter(t=>(t.kind||'task')===type&&t.status===state).length;
   const b=btn(`${state==='draft'?'Draft':'Published'} (${count})`,()=>{queueTabs[type]=state;renderQueues()},queueTabs[type]===state?'active':'');choices.append(b);
  }
  group.append(choices);
  const visible=items.filter(t=>(t.kind||'task')===type&&t.status===queueTabs[type]);
  for(const item of visible){
   const row=dom('div',null,'queue-item');
   const name=btn(item.title,()=>editItem(item),'item-name');
   row.append(name,dom('span',item.status.toUpperCase(),'status-pill'));
   row.append(btn('Edit',()=>editItem(item)));
   row.append(btn(item.status==='draft'?'Post':'Unpost',()=>updateItem(item.id,{status:item.status==='draft'?'published':'draft'})));
   const del=btn('×',()=>deleteQueueItem(item),'queue-delete');
   del.setAttribute('aria-label',`Delete ${typeNames[type]}: ${item.title}`);
   del.title='Delete permanently';row.append(del);
   group.append(row);
  }
  root.append(group);
 }
}
async function deleteQueueItem(item){
 if(!confirm(`Permanently delete ${typeNames[item.kind||'task'].toLowerCase()} “${item.title}”?\n\nThis also removes any completion records. Its uploaded photo is retained in Storage for your photo backup.`))return;
 try{
  // Guard with SELECT after the DELETE so a restrictive RLS policy cannot appear to succeed.
  const deleted=await result(sb.from('tasks').delete().eq('id',item.id).select('id'));
  if(!deleted?.length)throw Error('Deletion was blocked by database permissions.');
  if(editing===item.id)switchKind(kind);
  notify('Deleted.');await refresh();
 }catch(e){notify('Could not delete: '+e.message,true)}
}
async function clearPublishedTasks(){
 const live=items.filter(t=>t.status==='published');
 if(!live.length){notify('There are no published items to clear.');return}
 if(!confirm(`Clear ${live.length} published item${live.length===1?'':'s'} from Cleen Daily?\n\nTasks, Quality, and To Buy items will return to drafts. No items or photos will be deleted.`))return;
 const control=$('clearPublishedTasks');control.disabled=true;
 try{
  const ids=live.map(x=>x.id);
  // Supabase PostgREST supports IN; all selected records are admin-owned under RLS.
  const updated=await result(sb.from('tasks').update({status:'draft',updated_at:new Date().toISOString()}).in('id',ids).eq('status','published').select('id'));
  if(updated?.length!==ids.length)throw Error(`Updated ${updated?.length||0} of ${ids.length}. Reload and retry.`);
  for(const key of Object.keys(queueTabs))queueTabs[key]='draft';
  await refresh();notify(`${ids.length} item${ids.length===1?'':'s'} returned to drafts.`);
 }catch(e){await refresh();notify('Could not clear all published items: '+e.message,true)}
 finally{control.disabled=false}
}

function showModal(element){$('modalBody').replaceChildren(element);$('modal').showModal()}
async function preview(){
 const root=$('fullListBody');root.replaceChildren();
 if(verse?.quote){const v=dom('section',null,'preview-verse');v.append(dom('p',verse.quote),dom('p',verse.citation||'','citation'));root.append(v)}
 // Preview the complete posted daily list, including any unsaved editor entry as an explicitly labeled draft.
 let unsaved=null;
 if(page==='create'&&$('itemTitle').value.trim()){
  try{unsaved={...formPayload('draft'),id:editing||'unsaved',photo_path:!photoRemoved?oldPhoto:null,preview_unsaved:true};}
  catch(e){notify('Previewing published items only: '+e.message)}
 }
 for(const k of ['task','quality','buy']){
  const section=dom('section',null,'preview-section');
  const entries=items.filter(t=>(t.kind||'task')===k&&t.status==='published'&&t.id!==editing);
  if(unsaved?.kind===k)entries.push(unsaved);
  else if(editing){const original=items.find(x=>x.id===editing);if(original?.status==='published'&&(original.kind||'task')===k){/* Original excluded while live editor shows its revision. */}}
  const heading=dom('div',null,'preview-section-head');heading.append(dom('h3',typeNames[k]),dom('span',`${entries.length} item${entries.length===1?'':'s'}`,'preview-count'));section.append(heading);
  if(!entries.length)section.append(dom('p','Nothing posted yet.','preview-empty'));
  for(const t of entries){const row=dom('article',null,'preview-entry');const title=dom('div',null,'preview-entry-title');title.append(dom('span','□  '+t.title));if(t.preview_unsaved)title.append(dom('span',editing?'Editing preview · not saved':'Unsaved draft','preview-draft-indicator'));row.append(title);
   const metadata=[t.room,t.cleaning_type,t.concern_type,t.store&&`Store: ${t.store}`,t.quantity&&k==='buy'&&`Qty ${t.quantity}`,t.due_date&&`Due: ${safeDate(t.due_date)}`].filter(Boolean).join(' · ');
   if(metadata)row.append(dom('p',metadata,'preview-entry-meta'));
   if(t.description)row.append(dom('p',t.description,'preview-entry-desc'));
   if(t.use_text)row.append(dom('p','Use: '+t.use_text,'preview-entry-desc'));
   const img=dom('img');img.alt=t.title;img.className=t.photo_size==='full'?'':'small';
   if(t.preview_unsaved&&newFile){img.src=URL.createObjectURL(newFile);img.onload=()=>URL.revokeObjectURL(img.src);row.append(img)}
   else if(t.photo_path){signedPhoto(t.photo_path).then(url=>{if($('fullListModal').open){img.src=url;row.append(img)}}).catch(console.warn)}
   section.append(row);
  }
  root.append(section);
 }
 $('fullListModal').showModal();
}
function setQueueCollapsed(collapsed){
 $('queuePanel').classList.toggle('collapsed',collapsed);
 document.querySelector('.editor-layout').classList.toggle('queue-collapsed',collapsed);
 $('openQueue').hidden=!collapsed;
 $('collapseQueue').setAttribute('aria-expanded',String(!collapsed));
}

function renderProducts(){const root=$('productList');root.replaceChildren();for(const p of products){const r=dom('div',null,'editable-row');const name=dom('span',null,'grow');name.append(dom('span',p.name),dom('small',p.use_text));r.append(name,btn('Edit',()=>{$('productId').value=p.id;$('productName').value=p.name;$('productUse').value=p.use_text}),btn('×',()=>removeRow('cleen_products',p.id,'product')));root.append(r)}}
function renderInstructions(){const root=$('instructionList');root.replaceChildren();for(const p of instructions){const r=dom('div',null,'editable-row');const name=dom('span',null,'grow');name.append(dom('span',p.name),dom('small',p.video_link||p.body));r.append(name,btn('Edit',()=>{$('instructionId').value=p.id;$('instructionName').value=p.name;$('instructionVideo').value=p.video_link;$('instructionBody').value=p.body}),btn('×',()=>removeRow('cleen_instructions',p.id,'instruction')));root.append(r)}}
function renderCategories(){document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category===category));const root=$('categoryList');root.replaceChildren();for(const p of categories.filter(c=>c.category_type===category)){const r=dom('div',null,'editable-row');r.append(dom('span',p.name,'grow'),btn('Edit',()=>{$('categoryId').value=p.id;$('categoryName').value=p.name;$('categoryForm').querySelector('button[type=submit]').textContent='Save Item / Category'}),btn('×',()=>removeRow('cleen_categories',p.id,'category')));root.append(r)}}
function renderRoutines(){const root=$('routineList');root.replaceChildren();for(const p of routines){const r=dom('div',null,'editable-row');const label=dom('span',null,'grow');label.append(dom('span',p.title),dom('small',`${p.room||'General'} · every ${p.interval_days} days · next ${safeDate(p.next_due)}`));r.append(label,btn('Edit',()=>{$('routineId').value=p.id;$('routineTitle').value=p.title;$('routineDescription').value=p.description;$('routineCleaning').value=p.cleaning_type;$('routineRoom').value=p.room;$('routineDays').value=p.interval_days;$('routineNext').value=p.next_due}),btn('×',()=>removeRow('cleen_routines',p.id,'routine')));root.append(r)}}
async function removeRow(table,id,name){if(!confirm(`Delete this ${name}?`))return;try{await result(sb.from(table).delete().eq('id',id));notify('Deleted.');await refresh()}catch(e){notify(e.message,true)}}
async function saveRecord(form,table,idField,fields){const id=$(idField).value;const data={};for(const [column,element] of Object.entries(fields))data[column]=$(element).value.trim();try{if(id)await result(sb.from(table).update(data).eq('id',id));else await result(sb.from(table).insert(data));form.reset();$(idField).value='';notify('Saved.');await refresh()}catch(e){notify(e.message,true)}}
function groupList(kind,status,root){const section=dom('section',null,'section-group');section.append(dom('h2',typeNames[kind]+' ('+items.filter(t=>(t.kind||'task')===kind&&t.status===status).length+')'));for(const x of items.filter(t=>(t.kind||'task')===kind&&t.status===status)){const div=dom('div',null,'view-card');div.append(btn(x.title,()=>editItem(x)));div.append(dom('span',[x.room,x.store,x.issue_status==='resolved'?'Resolved':''].filter(Boolean).join(' · '),'subtle'));div.append(btn('Unpost',()=>updateItem(x.id,{status:'draft'})));div.append(btn('Archive',()=>{if(confirm('Archive this item?'))void updateItem(x.id,{status:'archived'})}));section.append(div)}root.append(section)}
function renderPublished(){const root=$('publishedList');root.replaceChildren();for(const k of ['task','quality','buy'])groupList(k,'published',root)}
async function renderHistory(){const root=$('historyList');root.replaceChildren();document.querySelectorAll('[data-history]').forEach(b=>b.classList.toggle('active',b.dataset.history===historyTab));if(historyTab==='completed'){const done=completions.filter(c=>c.done);if(!done.length)root.append(dom('p','No completed tasks yet.','subtle'));for(const c of done){const it=items.find(t=>t.id===c.task_id);if(!it)continue;const r=dom('div',null,'editable-row');r.append(dom('span',it.title,'grow'),dom('small',new Date(c.updated_at).toLocaleString()));root.append(r)}}else if(historyTab==='archive'){for(const it of items.filter(t=>t.status==='archived')){const r=dom('div',null,'editable-row');r.append(dom('span',it.title,'grow'),btn('Restore to Draft',()=>updateItem(it.id,{status:'draft'})));root.append(r)}}else{for(const report of reports){const row=dom('div',null,'report-entry');row.append(dom('p',new Date(report.created_at).toLocaleString()),dom('p',report.notes||'(No notes)'),dom('p',report.photo_description||''));if(report.photo_path){const img=dom('img');signedPhoto(report.photo_path).then(src=>img.src=src).catch(console.warn);row.append(img)}root.append(row)}}}
function datesAgoOrToday(s){return s<=new Date().toISOString().slice(0,10)}
async function dueRoutines(){if(!authorized||!routines.length)return;let generated=0;const today=new Date().toISOString().slice(0,10);for(const r of routines.filter(r=>r.active&&datesAgoOrToday(r.next_due))){try{let date=r.next_due;let n=0;while(date<=today&&n<100){const exists=items.some(t=>t.routine_id===r.id&&t.due_date===date);if(!exists){const t={title:r.title,description:r.description,room:r.room,cleaning_type:r.cleaning_type,due_date:date,kind:'task',status:'draft',created_by:user.id,routine_id:r.id,photo_path:null};const added=await result(sb.from('tasks').insert(t).select().single());items.unshift(added);generated++}const dt=new Date(date+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+r.interval_days);date=dt.toISOString().slice(0,10);n++}if(n===100)notify('One routine is over 100 cycles overdue; review its schedule.',true);else await result(sb.from('cleen_routines').update({next_due:date}).eq('id',r.id))}catch(e){notify('Routine '+r.title+': '+e.message,true)}}if(generated){notify(`${generated} due routine item(s) added to drafts.`);routines=await loadTable('cleen_routines');renderQueues();renderRoutines()}}
async function listAllFiles(prefix=''){
 const paths=[];let offset=0;
 while(true){
  const entries=await result(sb.storage.from(BUCKET).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}}));
  for(const f of entries||[]){const path=prefix?prefix+'/'+f.name:f.name;
   if(f.id)paths.push(path);else if(f.name&&f.name!=='.emptyFolderPlaceholder')paths.push(...await listAllFiles(path));
  }
  if(!entries||entries.length<100)break;offset+=100;
 }
 return paths;
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=dom('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function archivePhotos(includeRecords){const zip=new JSZip();const paths=await listAllFiles();const manifest=[];for(let i=0;i<paths.length;i++){const path=paths[i];notify(`Downloading photo ${i+1} of ${paths.length}...`);const file=await result(sb.storage.from(BUCKET).download(path));zip.file('photos/'+path,file);const references=[...items.filter(t=>t.photo_path===path).map(t=>({type:'item',id:t.id,title:t.title})),...reports.filter(r=>r.photo_path===path).map(r=>({type:'report',id:r.id,description:r.photo_description,notes:r.notes,created_at:r.created_at}))];manifest.push({path,references})}zip.file('photo-manifest.json',JSON.stringify(manifest,null,2));if(includeRecords){zip.file('tasks.json',JSON.stringify(items,null,2));zip.file('reports.json',JSON.stringify(reports,null,2));zip.file('completions.json',JSON.stringify(completions,null,2))}const blob=await zip.generateAsync({type:'blob'});saveBlob(blob,`cleen-${includeRecords?'archive':'all-photos'}-${new Date().toISOString().slice(0,10)}.zip`);notify('ZIP downloaded. Confirm it opens before deleting any cloud photos.');return paths}
async function downloadGallery(){
 // Reports are the end-of-day gallery source. Unlike the all-photos backup,
 // task, quality, and shopping reference photos are deliberately excluded.
 const photos=reports.filter(r=>r.photo_path);
 if(!photos.length){notify('No cleaner report photos to export yet.');return}
 const zip=new JSZip();const manifest=[];let succeeded=0;
 for(let i=0;i<photos.length;i++){
  const report=photos[i];const path=report.photo_path;
  const date=(report.created_at||'undated').slice(0,10);
  const ext=(path.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
  const entry=`gallery/${date}/${date}-${String(i+1).padStart(3,'0')}-${report.id}.${ext}`;
  try{
   notify(`Exporting gallery photo ${i+1} of ${photos.length}...`);
   const file=await result(sb.storage.from(BUCKET).download(path));
   zip.file(entry,file);succeeded++;
   manifest.push({file:entry,date,submitted_at:report.created_at,description:report.photo_description||'',notes:report.notes||'',report_id:report.id});
  }catch(e){console.warn('Gallery photo unavailable:',path,e);manifest.push({file:null,date,report_id:report.id,error:'Photo could not be retrieved'});}
 }
 if(!succeeded)throw Error('None of the gallery photos could be retrieved from Storage.');
 zip.file('gallery-manifest.json',JSON.stringify({exported_at:new Date().toISOString(),photos:manifest},null,2));
 zip.file('README.txt','Cleen Photo Gallery\n\nThis export contains only cleaner end-of-day report photos, organized by submission date.\nDates, descriptions, and notes are recorded in gallery-manifest.json.\n');
 const blob=await zip.generateAsync({type:'blob'});
 saveBlob(blob,`cleen-photo-gallery-${new Date().toISOString().slice(0,10)}.zip`);
 notify(`Gallery exported: ${succeeded} photo(s).${succeeded<photos.length?' Some missing files were skipped.':''}`);
}
async function clearAllPhotos(){if(!confirm('Permanently delete ALL Cleen photos from Supabase Storage? This affects tasks, quality, shopping and reports. Download a ZIP backup first.'))return;const check=prompt('Type DELETE ALL PHOTOS to confirm irreversible removal:');if(check!=='DELETE ALL PHOTOS'){notify('Photo deletion canceled.');return}try{const paths=await listAllFiles();let removed=0;for(let i=0;i<paths.length;i+=100){await result(sb.storage.from(BUCKET).remove(paths.slice(i,i+100)));removed+=Math.min(100,paths.length-i)}await result(sb.from('tasks').update({photo_path:null}).not('photo_path','is',null)); // Admin RLS protects this operation.
// V1 reports have no admin UPDATE policy, so use RPC defined in migration below.
await result(sb.rpc('cleen_clear_report_photo_paths'));
notify(`${removed} photos deleted and photo references cleared.`);await refresh()}catch(e){notify('Photo clearing was incomplete: '+e.message+'. Check storage and references.',true)}}
function addHandlers(){document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));$('back').addEventListener('click',()=>go(['products','instructions','categories','routines'].includes(page)?'settings':'home'));$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const tokens=await cleenPasswordLogin('admin',$('password').value);const {data,error}=await sb.auth.setSession({access_token:tokens.access_token,refresh_token:tokens.refresh_token});if(error)throw error;user=data.user;$('password').value='';await checkRole()}catch(err){notify(err.message,true)}finally{b.disabled=false}});$('logout').addEventListener('click',async()=>{await sb.auth.signOut();user=null;showAdmin(false);notify('Signed out.')});document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>switchKind(b.dataset.kind)));$('itemPhoto').addEventListener('change',e=>{newFile=e.target.files?.[0]||null;photoRemoved=false;photoPreview(newFile)});$('removePhoto').addEventListener('click',()=>{newFile=null;photoRemoved=true;$('itemPhoto').value='';photoPreview(null)});$('itemForm').addEventListener('submit',e=>e.preventDefault());$('clearForm').addEventListener('click',()=>switchKind(kind));$('saveDraft').addEventListener('click',()=>saveItem('draft'));$('previewItem').addEventListener('click',()=>void preview());$('closeFullList').addEventListener('click',()=>$('fullListModal').close());$('openQueue').addEventListener('click',()=>setQueueCollapsed(false));$('collapseQueue').addEventListener('click',()=>setQueueCollapsed(true));$('clearPublishedTasks').addEventListener('click',()=>void clearPublishedTasks());$('addFromRoutine').addEventListener('click',()=>{
 const c=dom('div',null,'modal-content');c.append(dom('h2','Add from Routine'));
 if(!routines.length)c.append(dom('p','No routines saved yet. Create one under Settings → Routines.'));
 for(const r of routines){const b=btn(r.title+' · '+r.room,()=>{
  $('modal').close();switchKind('task');$('itemTitle').value=r.title;
  $('taskDescription').value=r.description;$('cleaningType').value=r.cleaning_type;
  $('taskRoom').value=r.room;$('itemPhoto').value='';newFile=null;oldPhoto=null;
  photoPreview(null);notify('Routine loaded into draft editor. Select Add to keep it as a draft.');
 },'rect full');c.append(b)}showModal(c);
 });
$('verseForm').addEventListener('submit',async e=>{e.preventDefault();try{await result(sb.from('cleen_verse').upsert({id:1,quote:$('verseQuote').value.trim(),citation:$('verseCitation').value.trim(),updated_at:new Date().toISOString()}));verse={quote:$('verseQuote').value,citation:$('verseCitation').value};notify('Verse saved for the cleaner homepage.')}catch(err){notify(err.message,true)}});$('versePreview').addEventListener('click',()=>{const c=dom('div',null,'modal-content');c.append(dom('h2','Bible Verse'),dom('p',$('verseQuote').value),dom('p',$('verseCitation').value));showModal(c)});
$('productForm').addEventListener('submit',e=>{e.preventDefault();void saveRecord(e.currentTarget,'cleen_products','productId',{name:'productName',use_text:'productUse'})});$('cancelProduct').addEventListener('click',()=>$('productForm').reset());$('instructionForm').addEventListener('submit',e=>{e.preventDefault();void saveRecord(e.currentTarget,'cleen_instructions','instructionId',{name:'instructionName',video_link:'instructionVideo',body:'instructionBody'})});$('viewInstructions').addEventListener('click',()=>$('instructionList').hidden=!$('instructionList').hidden);document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;$('categoryForm').reset();$('categoryId').value='';renderCategories()}));$('categoryForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('categoryId').value;try{const body={category_type:category,name:$('categoryName').value.trim()};if(id)await result(sb.from('cleen_categories').update({name:body.name}).eq('id',id));else await result(sb.from('cleen_categories').insert(body));$('categoryForm').reset();$('categoryId').value='';$('categoryForm').querySelector('button[type=submit]').textContent='Add Item / Category';notify('Category saved.');await refresh()}catch(err){notify(err.message,true)}});$('cancelCategory').addEventListener('click',()=>{$('categoryForm').reset();$('categoryId').value=''});
$('routineForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('routineId').value;const body={title:$('routineTitle').value.trim(),description:$('routineDescription').value.trim(),cleaning_type:$('routineCleaning').value,room:$('routineRoom').value,interval_days:Number($('routineDays').value),next_due:$('routineNext').value};try{if(id)await result(sb.from('cleen_routines').update(body).eq('id',id));else await result(sb.from('cleen_routines').insert(body));$('routineForm').reset();$('routineId').value='';notify('Routine saved.');await refresh()}catch(err){notify(err.message,true)}});$('cancelRoutine').addEventListener('click',()=>$('routineForm').reset());$('routineNext').value=new Date().toISOString().slice(0,10);document.querySelectorAll('[data-history]').forEach(b=>b.addEventListener('click',()=>{historyTab=b.dataset.history;renderHistory()}));$('previewCleaner').addEventListener('click',()=>{const c=dom('div',null,'modal-content');c.append(dom('h2','Cleen Daily Preview'));if(verse?.quote)c.append(dom('p',verse.quote+' — '+verse.citation));for(const k of ['task','quality','buy']){c.append(dom('h2',typeNames[k]));for(const t of items.filter(x=>(x.kind||'task')===k&&x.status==='published'))c.append(dom('p','□ '+t.title))}showModal(c)});$('downloadPhotos').addEventListener('click',()=>archivePhotos(false).catch(e=>notify(e.message,true)));$('downloadGallery').addEventListener('click',()=>downloadGallery().catch(e=>notify(e.message,true)));$('downloadGalleryHistory').addEventListener('click',()=>downloadGallery().catch(e=>notify(e.message,true)));$('downloadArchive').addEventListener('click',()=>archivePhotos(true).catch(e=>notify(e.message,true)));$('clearPhotos').addEventListener('click',clearAllPhotos)}
addHandlers();go('home');$('workspace').hidden=true;$('login').hidden=false;
sb.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==user?.id){user=session?.user||null;if(!user){showAdmin(false)}else setTimeout(()=>{void checkRole()},0)}});
try{const {data:{session},error}=await sb.auth.getSession();if(error)throw error;if(session?.user){user=session.user;await checkRole()}}catch(e){notify('Session restore failed: '+e.message,true)}
})();
