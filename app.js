import {dragScrollDelta} from './drag-scroll.mjs';
import {setupColorPickers} from './color-picker.mjs';
import {setupTextEditors,readTextStyles} from './text-editors.mjs';
import {textStyle,fontCss,fitText,bandLabelLayout,layoutPeriodLabels} from './presentation.mjs';
import {setupTimePickers} from './time-picker.mjs';
import {uid,clone,hm,minutes,overlaps,localDate,durationFor,makeDay,newProject,issuesFor,validatePlacement,layoutAppointments,validateProject,upgradeDefaultPeriods,ensureStays,switchStay,createStay,copyScheduleDay,transferAppointment,syncSharedRoster,removeSchedulePatient,isPatientEnabled,visibleColumns,setPatientEnabled,removeSchedule,TIME_GUTTER,addCalendarDays,stayDates,timeMarkIsClear,expandDayCanvas,clampedDropStart,updateProcedureTemplate,removeInstructor,instructorColor,exportEndTime,procedureDurationError,moveVisiblePatient,workdayEnd} from './domain.mjs';
import {dateLabel,renderScheduleImage,downloadBlob} from './export.mjs';
import {procedurePools,resolveSettings,saveWeekdaySettings,checkSettings,planDay,emptyAutofill,normalizeGroups,COMMON_GROUP,estimateLoad,describeLoad,describeCause} from './autofill.mjs';

const paths={lock:'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4z',unlock:'M6 10V7a6 6 0 0 1 11-3M4 10h16v12H4z',sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',repeat:'M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6',down:'m6 9 6 6 6-6',up:'m6 15 6-6 6 6',plus:'M12 5v14M5 12h14',chevron:'m9 5 7 7-7 7',left:'m15 5-7 7 7 7',close:'m6 6 12 12M6 18 18 6',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',settings:'M4 7h16M7 4v6M4 17h16M16 14v6',calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2M17 21v-8H7v8M7 3v5h9V3',undo:'M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5',redo:'M21 10H10a6 6 0 0 0 0 12M21 10l-5-5M21 10l-5 5',grip:'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',copy:'M9 9h12v12H9zM15 9V3H3v12h6',clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',panel:'M3 3h18v18H3zM8 3v18',info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',band:'M3 6h18v12H3zM3 12h18',check:'m5 12 4 4L19 6',flower:'M5 6h14v4H5zM5 14h9v4H5z',mouse:'M5 3 19 12l-7 1-3 7z',image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M8 7h.01',more:'M5 12h.01M12 12h.01M19 12h.01',minus:'M5 12h14'};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette=['#f7df88','#bddcc2','#f3b5ac','#a8d9ee','#d7cef0','#d8dfe8','#f4cda3','#dce7b8','#ffffff','#edf0f3'];
const STORAGE='ritm.project.v1';
const desktop=window.ritmDesktop;
let windowMaximized=false;
function syncWindowControls(state){windowMaximized=!!state.maximized;const maximize=document.querySelector('[data-window-command="maximize"]');if(maximize){maximize.setAttribute('aria-label',windowMaximized?'Восстановить размер':'Развернуть');maximize.title=windowMaximized?'Восстановить размер':'Развернуть';maximize.innerHTML=windowGlyph(windowMaximized?'restore':'maximize');}}
function windowGlyph(type){const p={minimize:'M3 8.5h10',maximize:'M3.5 3.5h9v9h-9z',restore:'M5.5 3.5v-2h9v9h-2M2.5 5.5h9v9h-9z',close:'m3.5 3.5 9 9m0-9-9 9'};return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="${p[type]}"/></svg>`;}
function windowControls(){return desktop?`<div class="window-controls" role="group" aria-label="Управление окном"><button type="button" class="window-control" data-window-command="minimize" aria-label="Свернуть" title="Свернуть">${windowGlyph('minimize')}</button><button type="button" class="window-control" data-window-command="maximize" aria-label="${windowMaximized?'Восстановить размер':'Развернуть'}" title="${windowMaximized?'Восстановить размер':'Развернуть'}">${windowGlyph(windowMaximized?'restore':'maximize')}</button><button type="button" class="window-control window-close" data-window-command="close" aria-label="Закрыть окно" title="Закрыть окно">${windowGlyph('close')}</button></div>`:'';}
if(desktop?.window){desktop.window.getState().then(syncWindowControls);desktop.window.onState(syncWindowControls);document.addEventListener('click',e=>{const button=e.target.closest('[data-window-command]');if(button)desktop.window.command(button.dataset.windowCommand);});}

document.documentElement.classList.toggle('desktop-app',!!desktop);
let loadError='',loadWarning='',project;
try {const loaded=desktop?desktop.storage.load():{data:localStorage.getItem(STORAGE)};if(loaded.error)throw Error(loaded.error);loadWarning=loaded.warning||'';project=loaded.data?upgradeDefaultPeriods(validateProject(JSON.parse(loaded.data))):newProject();}catch{project=newProject(false);loadError='Не удалось открыть локальное сохранение. Оно не перезаписано. Откройте резервный файл проекта.';}
project=ensureStays(project);
let recovery=!!loadError,saved=!loadError;
const ui={date:project.stays.find(s=>s.id===project.currentStayId)?.viewDate|| (project.days[localDate()]?localDate():Object.keys(project.days).sort().at(-1)||localDate()),selection:{type:'day'},applyProcedureToDay:false,search:'',sidebarTab:'patients',instructorSearch:'',zoom:1,left:true,right:true,mobileLeft:false,inspectorOverlay:false,library:true,undo:[],redo:[]};
if(!project.days[ui.date])project.days[ui.date]=makeDay(ui.date,project.patients);
const root=document.querySelector('#app'),modal=document.querySelector('#modal');
const day=()=>project.days[ui.date];
const ppm=()=>1.4*ui.zoom;
// Zoom scales columns on screen only: the saved width and the PNG stay as they are.
const colOffsets=()=>{let x=0;return visibleColumns(day()).map(c=>{const width=c.width*ui.zoom,r={...c,x,width};x+=width;return r;});};
const button=(action,label,ico,cls='btn',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${ico?icon(ico):''}${label?`<span>${label}</span>`:''}</button>`;
const ib=(action,title,ico,extra='')=>button(action,'',ico,'icon-btn',`title="${title}" aria-label="${title}" ${extra}`);
let toastTimer;
function toast(message,error=false){const el=document.querySelector('#toast');el.textContent=message;el.className=`visible ${error?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',error?6500:3500);}
function persist(){if(recovery){saved=false;return;}try{project.stays.find(s=>s.id===project.currentStayId).viewDate=ui.date;const text=JSON.stringify(project);if(desktop){const result=desktop.storage.save(text);if(!result.ok)throw Error(result.error);}else localStorage.setItem(STORAGE,text);saved=true;}catch{saved=false;toast('Не удалось выполнить автосохранение. Сохраните отдельный файл проекта.',true);}}
function transact(fn,message){const before=clone(project),previousDate=ui.date,previousSelection=clone(ui.selection);try{fn();syncSharedRoster(project);validateProject(project);}catch(e){project=before;ui.date=previousDate;ui.selection=previousSelection;toast(e.message||'Не удалось применить изменение',true);return false;}ui.undo.push(before);if(ui.undo.length>80)ui.undo.shift();ui.redo=[];persist();render();if(message)toast(message);return true;}
function undo(){if(!ui.undo.length)return;ui.redo.push(clone(project));project=ui.undo.pop();if(!project.days[ui.date])ui.date=Object.keys(project.days)[0];ui.selection={type:'day'};persist();render();}
function redo(){if(!ui.redo.length)return;ui.undo.push(clone(project));project=ui.redo.pop();if(!project.days[ui.date])ui.date=Object.keys(project.days)[0];ui.selection={type:'day'};persist();render();}
function select(type,id,extra={}){if(ui.selection.type!==type||ui.selection.id!==id)ui.applyProcedureToDay=false;ui.selection={type,id,...extra};ui.right=true;ui.mobileLeft=false;ui.inspectorOverlay=true;render();}
function selectedTextRecord(key){if(ui.selection.type==='day'&&key==='scheduleName')return project.stays.find(s=>s.id===project.currentStayId);if(ui.selection.type==='patient')return project.patients.find(p=>p.id===ui.selection.id);return getSelection();}
function setupEditorUI(container,inspector=false){
  setupTimePickers(container);
  setupColorPickers(container,{getPresets:()=>project.colorPresets||palette,addPreset:color=>{const colors=project.colorPresets||palette;if(colors.includes(color))return;ui.undo.push(clone(project));ui.redo=[];project.colorPresets=[...colors,color];persist();},removePreset:color=>{ui.undo.push(clone(project));ui.redo=[];project.colorPresets=(project.colorPresets||palette).filter(value=>value!==color);persist();}});
  setupTextEditors(container,{getStyle:key=>inspector?textStyle(selectedTextRecord(key),key==='scheduleName'?'name':key,key==='scheduleName'?{fontSize:22,bold:true}:key==='name'&&ui.selection.type==='band'?{fontSize:11,bold:true}:key==='name'?{fontSize:11}:key==='house'?{fontSize:10}:{}):{},openKey:inspector?ui.textFormatOpen||'':'',getAlignment:key=>inspector&&ui.selection.type==='appointment'&&key==='text'?getSelection().align:null,onAlignmentChange:(key,value)=>{ui.textFormatOpen=key;updateField('align',value);},onChange:inspector?(key,style)=>{ui.textFormatOpen=key;transact(()=>{const record=selectedTextRecord(key),name=key==='scheduleName'?'name':key;if(ui.selection.type==='procedure'){updateProcedureTemplate(project,ui.date,record.id,{textStyles:{...record.textStyles,[name]:style}},{applyToDay:ui.applyProcedureToDay});return;}record.textStyles??={};record.textStyles[name]=style;if(ui.selection.type==='appointment'&&key==='text'){record.fontSize=style.fontSize;record.bold=style.bold;record.italic=style.italic;record.fontFamily=style.fontFamily;}});}:null});
}
function moveDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').valueOf()))return;ui.selection={type:'day'};if(!project.days[date])transact(()=>{project.days[date]=applyTemplate(makeDay(date,project.patients));ui.date=date;});else{ui.date=date;render();}}
function getSelection(){const s=ui.selection;if(s.type==='day')return day();if(s.type==='appointment')return day().appointments.find(a=>a.id===s.id);if(s.type==='procedure')return project.procedures.find(p=>p.id===s.id);if(s.type==='patient')return day().columns.find(c=>c.patientId===s.id)||project.patients.find(p=>p.id===s.id);if(s.type==='band')return day().bands.find(b=>b.id===s.id);if(s.type==='instructor')return project.instructors.find(i=>i.id===s.id);}
function sidebar(){if(ui.sidebarTab==='instructors')return instructorsSidebar();const patients=project.patients.filter(p=>!p.archived),filtered=patients.filter(p=>(p.name+' '+p.house).toLowerCase().includes(ui.search.toLowerCase()));
  return `<div class="sidebar-inner">${staySelector()}${directoryTabs()}<div class="side-title"><h2>Пациенты <span class="count">${patients.length}</span></h2>${ib('add-patient','Добавить пациента','plus')}</div><div class="search">${icon('search')}<input id="patient-search" aria-label="Поиск пациентов" placeholder="Найти пациента или домик" value="${esc(ui.search)}"></div><div class="patient-list">${filtered.map(p=>`<div class="patient-item ${isPatientEnabled(day(),p.id)?'':'patient-disabled'} ${ui.selection.type==='patient'&&ui.selection.id===p.id?'selected':''}"><input type="checkbox" class="patient-day-toggle" data-patient-toggle="${p.id}" ${isPatientEnabled(day(),p.id)?'checked':''} aria-label="Включить ${esc(p.name)} в выбранном дне" title="Участие в выбранном дне"><button type="button" class="patient-select" data-action="select-patient" data-id="${p.id}" aria-label="${esc(p.name)}"><div class="patient-details"><div class="patient-name">${esc(p.name)}</div><div class="patient-house">Домик ${esc(p.house||'—')}</div></div></button>${button('remove-patient','','trash','icon-btn patient-trash',`data-id="${p.id}" title="Удалить пациента" aria-label="Удалить пациента"`)}</div>`).join('')||`<div class="inspector-empty">${ui.search.trim()?'Пациенты не найдены':'В расписании пока нет пациентов'}</div>`}</div><div class="side-bottom">${button('batch-patients','Добавить списком','users','btn ghost')}</div></div>`;
}
function emptySchedule(d){
  if(project.patients.some(p=>!p.archived))return `<section class="empty-schedule"><div class="empty-schedule-content"><div class="empty-schedule-icon">${icon('users')}</div><h2>Выберите пациентов на этот день</h2><div class="empty-schedule-actions">${button('enable-all-patients','Включить всех пациентов','check','btn primary')}</div></div></section>`;
  return `<section class="empty-schedule" aria-label="Начало работы с расписанием"><div class="empty-schedule-content"><div class="empty-schedule-icon">${icon('users')}</div><h2>Добавьте первого пациента</h2><div class="empty-schedule-actions">${button('add-patient','Добавить пациента','plus','btn primary')}</div><div class="empty-schedule-details"><span>${icon('clock')}${hm(d.start)}</span><span>Шаг ${d.step} минут</span>${d.bands.map(b=>`<button data-action="select-band" data-id="${b.id}">${icon('band')}${esc(b.name)} ${hm(b.start)}–${hm(b.start+b.duration)}</button>`).join('')}</div></div></section>`;
}
const measureContext=document.createElement('canvas').getContext('2d');
function displayPeriods(d,scale){return layoutPeriodLabels(measureContext,d.bands,scale,d.start,d.end,TIME_GUTTER);}
function gutterBands(d,scale){return displayPeriods(d,scale).map(({band:b,label:l,top})=>
  `<button type="button" class="gutter-band ${ui.selection.type==='band'&&ui.selection.id===b.id?'selected':''}" data-action="select-band" data-id="${b.id}" title="${esc(b.name)} · ${hm(b.start)}–${hm(b.start+b.duration)}" style="top:${top}px;height:${l.height}px;background:${b.color}"><strong style="${fontCss(l.style)};line-height:${l.lineHeight}px">${l.lines.map(esc).join('<br>')}</strong><span style="font-size:${l.timeSize}px">${hm(b.start)}–${hm(b.start+b.duration)}</span></button>`).join('');}
// Shown only on screen: the PNG is drawn separately and does not include it.
function workdayLine(d,scale,height){
  const end=workdayEnd(d);
  if(end<d.start||end>d.end)return '';
  return `<div class="workday-end" title="Конец рабочего дня: ${hm(end)}" style="top:${Math.min(height-2,(end-d.start)*scale)}px"></div>`;
}
function schedule(){
  const d=day(),columns=visibleColumns(d);if(!columns.length)return emptySchedule(d);
  // The grid reaches at least the end of the working day, so its line is always in view.
  d.end=Math.max(d.end,Math.min(1440,workdayEnd(d)));
  const scale=ppm(),h=(d.end-d.start)*scale,offsets=colOffsets(),w=TIME_GUTTER+offsets.reduce((s,c)=>s+c.width,0),dt=new Date(d.date+'T12:00:00');let labels='';
  for(let m=Math.ceil(d.start/30)*30;m<d.end;m+=30)if(timeMarkIsClear(m,displayPeriods(d,scale),scale))labels+=`<div class="time-label ${m%60===0?'hour':''}" style="top:${(m-d.start)*scale}px"><span>${hm(m)}</span></div>`;
  const headers=offsets.map(c=>{const p=project.patients.find(p=>p.id===c.patientId),style=textStyle(p,'name',{fontSize:11}),fit=fitText(measureContext,c.name,c.width-21,35,style);return `<div class="column-header ${ui.selection.type==='patient'&&ui.selection.id===c.patientId?'selected':''}" style="width:${c.width}px;background:${c.headerColor}" data-action="select-patient" data-id="${c.patientId}" data-patient="${c.patientId}" role="button" tabindex="0"><span class="name" style="${fontCss({...style,fontSize:fit.fontSize})};line-height:${fit.lineHeight}px">${fit.lines.map(esc).join('<br>')}</span><span class="house" style="${fontCss({...textStyle(p,'house',{fontSize:10}),fontSize:Math.min(13,textStyle(p,'house',{fontSize:10}).fontSize)})};line-height:15px">Домик ${esc(c.house||'—')}</span></div>`;}).join('');
  const lanes=offsets.map(c=>`<div class="patient-lane" data-lane="${c.patientId}" style="left:${c.x}px;width:${c.width}px;background-color:${c.color};background-size:100% ${60*scale}px,100% ${d.step*scale}px;background-position:0 -${(d.start%60)*scale}px,0 -${(d.start%d.step)*scale}px"></div>`).join('');
  const bands=d.bands.map(b=>`<div data-action="select-band" data-id="${b.id}" data-band="${b.id}" class="period-band ${ui.selection.type==='band'&&ui.selection.id===b.id?'selected':''}" style="top:${(b.start-d.start)*scale}px;height:${b.duration*scale}px;background:${b.color}" title="${esc(b.name)} · ${hm(b.start)}–${hm(b.start+b.duration)}"></div>`).join('');
  const blocks=offsets.map(col=>layoutAppointments(d.appointments.filter(a=>a.patientId===col.patientId)).map(a=>{const width=(col.width-8)/a.tracks-2,style=textStyle(a,'text'),fit=fitText(measureContext,a.text,width-18,Math.max(8,a.duration*scale-24),style);return `<div class="appointment-group ${ui.selection.type==='appointment'&&ui.selection.id===a.id?'is-selected':''}" data-col="${col.patientId}"><div class="appointment ${ui.selection.type==='appointment'&&ui.selection.id===a.id?'selected':''} ${a.status==='cancelled'?'cancelled':''}" data-appointment="${a.id}" tabindex="0" role="button" aria-label="${esc(a.text)} ${hm(a.start)}–${hm(a.start+a.duration)}" title="${esc(a.text)} · ${hm(a.start)}–${hm(a.start+a.duration)}" style="left:${col.x+4+a.track*(width+2)}px;top:${(a.start-d.start)*scale+1}px;width:${width}px;height:${Math.max(6,a.duration*scale-2)}px;background:${a.color};color:${a.textColor};text-align:${a.align}"><span class="resize-handle top" data-resize="top"></span><div class="appointment-name" style="${fontCss({...style,fontSize:fit.fontSize})};line-height:${fit.lineHeight}px">${fit.lines.map(esc).join('<br>')}</div>${a.duration*scale>30?`<div class="appointment-time">${hm(a.start)}–${hm(a.start+a.duration)}</div>`:''}<span class="resize-handle bottom" data-resize="bottom"></span></div>${button('delete-selection','','trash','appointment-delete',`data-select-type="appointment" data-id="${a.id}" title="Удалить назначение" aria-label="Удалить назначение" style="left:${col.x+4+a.track*(width+2)+width-22}px;top:${(a.start-d.start)*scale+3}px"`)}${button('toggle-lock','',a.locked?'lock':'unlock','appointment-lock',`data-id="${a.id}" aria-label="${a.locked?'Снять блокировку':'Установить блокировку'}" aria-pressed="${!!a.locked}" title="${a.locked?'Снять блокировку':'Установить блокировку'}" style="left:${col.x+6+a.track*(width+2)}px;top:${(a.start-d.start)*scale+3}px"`)}</div>`;}).join('')).join('');
  const hours=Array.from({length:Math.max(0,Math.ceil(d.end/60)-Math.ceil(d.start/60))},(_,i)=>`<div class="hour-gridline" style="top:${((Math.ceil(d.start/60)+i)*60-d.start)*scale}px"></div>`).join('');
  return `<div class="schedule-table" style="width:${Math.max(w,260)}px"><div class="schedule-header"><div class="date-corner" data-action="day-settings"><strong>${dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</strong><span>${dt.toLocaleDateString('ru-RU',{weekday:'long'})}</span></div>${headers}</div><div class="timeline" style="height:${h}px"><div class="time-axis">${labels}${gutterBands(d,scale)}</div><div class="lanes" id="lanes">${hours}${lanes}${bands}${blocks}${workdayLine(d,scale,h)}</div></div></div>`;
}
// An inspector field saves when it loses focus, and saving redraws everything. Pressing
// the mouse elsewhere would replace the clicked element or lose the typed text, so save
// first and redraw only after the click has landed on the element the user aimed at.
let holdRender=false,renderPending=false,tabbing=false;
function inspectorEdit(el){return el?.closest?.('.inspector')&&!el.closest('.color-popup,.time-popup')&&el.matches('input:not([type=checkbox]):not([type=hidden]):not(.time-input),textarea')?el:null;}
function releaseRender(){
  holdRender=false;if(!renderPending)return;
  const active=document.activeElement;
  if(tabbing&&active?.closest?.('.inspector'))return;
  tabbing=false;
  if(document.querySelector('#app :popover-open')||(active?.closest?.('#app')&&active.matches('input:not([type=checkbox]),textarea,select')))return;
  render();
}
document.addEventListener('pointerdown',e=>{const el=inspectorEdit(document.activeElement);if(!el||el===e.target)return;holdRender=true;el.blur();if(!renderPending)holdRender=false;},true);
// Tab saves too: keep the redraw back so focus can reach the next field.
document.addEventListener('keydown',e=>{if(e.key==='Tab'&&inspectorEdit(document.activeElement)){holdRender=true;tabbing=true;setTimeout(releaseRender,0);}},true);
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{if(holdRender)setTimeout(releaseRender,0);},true);
window.addEventListener('blur',()=>{if(holdRender)setTimeout(releaseRender,0);});
for(const type of ['toggle','focusout'])document.addEventListener(type,()=>{if(renderPending&&!holdRender)setTimeout(releaseRender,0);},true);
function render(){if(holdRender){renderPending=true;return;}renderPending=false;inspectorEdit(document.activeElement)?.blur();const prev=document.querySelector('.schedule-scroll'),sx=prev?.scrollLeft||0,sy=prev?.scrollTop||0,inspectorY=document.querySelector('.inspector')?.scrollTop||0,patientsY=document.querySelector('.patient-list')?.scrollTop||0,libraryX=document.querySelector('.procedure-list')?.scrollLeft||0;const d=day(),dt=new Date(d.date+'T12:00:00');
  root.innerHTML=`<div class="app-shell ${ui.left?'':'left-closed'} ${ui.right?'':'right-closed'} ${ui.inspectorOverlay?'inspector-open':''} ${ui.mobileLeft?'mobile-left':''}"><header class="app-top"><div class="titlebar-identity"><div class="brand-mark"><img src="./desktop/icon.svg" alt="" draggable="false"></div><span class="window-title">Расписание процедур</span>${ib('help','Подсказки','info')}</div><div class="top-actions">${button('open-project','Открыть','upload')}${button('save-project','Сохранить проект','save')}${button('export','Сохранить PNG','download','btn primary')}</div>${windowControls()}</header><aside class="sidebar" aria-label="Справочники">${sidebar()}</aside><main class="workspace"><div class="workspace-heading"><div><h1 style="${fontCss(textStyle(project.stays.find(s=>s.id===project.currentStayId),'name',{fontSize:22,bold:true}))}">${esc(project.stays.find(s=>s.id===project.currentStayId).name)}</h1><div class="workspace-subtitle">${esc(dt.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}))} <span style="padding:0 4px">·</span> ${visibleColumns(d).length} из ${d.columns.length} пациентов</div></div><div class="autofill-actions">${button('autofill','Автозаполнение','sparkles','btn autofill-btn')}${ib('autofill-repeat','Повторить с теми же условиями','repeat','data-autofill-repeat')}</div></div>${project.demo?`<div class="demo-notice">${icon('info')}Демонстрационный день · пациенты и назначения вымышлены<button data-action="new-project">Начать с пустого расписания</button></div>`:''}<div class="toolbar">${ib('toggle-left','Панель пациентов','panel')}${ib('prev-day','Предыдущий день','left')}<input type="date" class="date-input" id="date-picker" value="${d.date}" aria-label="Дата расписания">${ib('next-day','Следующий день','chevron')}${button('saved-days','Дни','calendar','btn ghost')}<span class="toolbar-spacer"></span><select class="zoom-select" id="zoom" aria-label="Масштаб">${[.5,.75,1,1.25,1.5,2].map(z=>`<option value="${z}" ${z===ui.zoom?'selected':''}>${z*100}%</option>`).join('')}</select>${button('clear-day','Очистить расписание','trash','btn ghost','title="Очистить расписание" aria-label="Очистить расписание"')}${button('copy-day','Копировать день','copy','btn ghost','title="Копировать день" aria-label="Копировать день"')}${ib('toggle-right','Инспектор','settings')}</div>${dayTabs()}<div class="schedule-frame"><div class="schedule-scroll">${schedule()}</div></div><section class="library ${ui.library?'':'collapsed'}" aria-label="Библиотека процедур"><div class="library-head">${ib('toggle-library',ui.library?'Свернуть библиотеку':'Развернуть библиотеку',ui.library?'down':'up',`aria-expanded="${ui.library}" aria-controls="procedure-list"`)}<h2>Библиотека процедур</h2>${button('add-procedure','Процедура','plus','text-btn library-add-procedure')}</div>${ui.library?`<div class="procedure-list" id="procedure-list">${project.procedures.map(p=>`<div class="procedure-card ${ui.selection.type==='procedure'&&ui.selection.id===p.id?'selected':''}" data-procedure="${p.id}" role="button" tabindex="0" style="background:${p.color};color:${p.textColor}"><strong title="${esc(p.name)}" style="${fontCss(textStyle(p,'name',{fontSize:11}))}">${esc(p.name)}</strong><small>${durationFor(p,d)} мин</small>${p.instructors?.length?`<small class="procedure-instructor" title="${esc(p.instructors.map(w=>instructorName(w.instructorId)).join(', '))}">${p.instructors.length>1?`<span class="instructor-dots">${p.instructors.slice(1).map(w=>`<i style="background:${esc(w.color)}"></i>`).join('')}</span>`:''}${esc(instructorName(p.instructors[0].instructorId))}${p.instructors.length>1?` +${p.instructors.length-1}`:''}</small>`:''}<span class="card-grip">${icon('grip')}</span><span class="procedure-card-actions">${button('duplicate','','copy','card-action',`data-select-type="procedure" data-id="${p.id}" title="Дублировать процедуру" aria-label="Дублировать процедуру"`)}${button('delete-selection','','trash','card-action card-delete',`data-select-type="procedure" data-id="${p.id}" title="Удалить процедуру" aria-label="Удалить процедуру"`)}</span></div>`).join('')||'<span class="empty-library">Нет процедур</span>'}</div>`:'<div id="procedure-list" hidden></div>'}</section></main><aside class="inspector" aria-label="Инспектор свойств"><div class="inspector-inner">${inspector()}</div></aside></div>`;
  setupEditorUI(root,true);
  const next=document.querySelector('.schedule-scroll');next.scrollLeft=sx;next.scrollTop=sy;document.querySelector('.inspector').scrollTop=inspectorY;document.querySelector('.patient-list').scrollTop=patientsY;if(document.querySelector('.procedure-list'))document.querySelector('.procedure-list').scrollLeft=libraryX;
  next.onscroll=()=>{if(next.isConnected&&day().end<1440&&next.scrollHeight-next.scrollTop-next.clientHeight<24){day().end=Math.min(1440,day().end+60);persist();render();}};
  const tabs=document.querySelector('.day-tabs'),active=tabs.querySelector('.day-tab.active'),tabRect=active?.getBoundingClientRect(),tabsRect=tabs.getBoundingClientRect();if(tabRect&&tabRect.right>tabsRect.right)tabs.scrollLeft=tabRect.left-tabsRect.left-tabs.clientWidth/2+tabRect.width/2;
}
const field=(label,key,value,type='text',extra='')=>`<label class="field"><span class="field-label">${label}</span><input type="${type}" data-field="${key}" value="${esc(value)}" ${extra}></label>`;
const selectField=(label,key,value,options)=>`<label class="field"><span class="field-label">${label}</span><select data-field="${key}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const colorField=(label,key,value)=>`<label class="field"><span class="field-label">${label}</span><input type="color" data-field="${key}" value="${esc(value)}"></label>`;
const section=(title,body)=>`<section class="inspector-section"><div class="section-title">${title}</div>${body}</section>`;
function inspector(){const s=ui.selection,o=getSelection(),d=day();if(!o){ui.selection={type:'day'};return inspector();}const labels={day:'Настройки дня',patient:'Пациент',procedure:'Вид процедуры',appointment:'Процедура',band:'Общий период',cell:'Область',instructor:'Инструктор'};let content='';
  if(s.type==='day'){
    content=section('Расписание',`${field('Название','scheduleName',project.stays.find(s=>s.id===project.currentStayId).name)}`)+section('Сетка',`${field('Начало сетки','start',hm(d.start),'time')}${field('Конец рабочего дня','workEnd',hm(workdayEnd(d)),'time')}${selectField('Шаг сетки','step',d.step,[[1,'1 минута'],[5,'5 минут'],[10,'10 минут'],[15,'15 минут']])}`)
      +section('Общие периоды',`<div class="period-list">${d.bands.map(b=>`<button class="period-row" data-action="select-band" data-id="${b.id}"><span class="dot" style="background:${b.color}"></span>${esc(b.name)}<span>${hm(b.start)}–${hm(b.start+b.duration)}</span></button>`).join('')}</div><div style="margin-top:10px">${button('add-band','Добавить период','plus','btn ghost')}</div>`);
  }
  if(s.type==='appointment'){
    const own=project.procedures.find(p=>p.id===o.procedureId),workers=[...(own?.instructors||[]).map(w=>w.instructorId),...(o.instructorId&&!(own?.instructors||[]).some(w=>w.instructorId===o.instructorId)?[o.instructorId]:[])];
    content=section('Назначение',`<div class="selected-summary"><span class="selection-icon" style="background:${o.color}">${icon('flower')}</span><div><strong>${esc(o.text)}</strong><small>${o.duration} минут · ${o.status==='cancelled'?'отменено':'запланировано'}</small></div></div>${selectField('Пациент','patientId',o.patientId,visibleColumns(d).map(c=>[c.patientId,c.name]))}${workers.length?selectField('Инструктор','instructorId',o.instructorId||'',[['','Не выбран'],...workers.map(id=>[id,instructorName(id)])]):''}${field('Текст блока','text',o.text)}<div class="field-grid main-colors">${colorField('Фон','color',o.color)}${colorField('Текст','textColor',o.textColor)}</div>`)
      +section('Время',`<div class="field-grid">${field('Начало','start',hm(o.start),'time')}${field('Конец','end',hm(o.start+o.duration),'time')}</div>${field('Длительность, мин','duration',o.duration,'number',`min="${d.step}" max="720" step="${d.step}"`)}`)
      +section('Дополнительно',`<label class="checkbox-field appointment-lock-field"><input type="checkbox" data-field="locked" ${o.locked?'checked':''}>Блокировка</label>${selectField('Статус','status',o.status,[['planned','Запланировано'],['cancelled','Отменено · зачеркнуть']])}`)
      +`<div class="inspector-actions">${button('duplicate','Дублировать','copy')}${button('transfer-appointment','В другой день…','calendar')}${button('delete-selection','Удалить назначение','trash','btn danger')}</div>`;
  }
  if(s.type==='procedure')content=section('Процедура',`${field('Название','name',o.name)}<div class="field-grid main-colors">${colorField('Фон','color',o.color)}${colorField('Текст','textColor',o.textColor)}</div>${procedureInstructorsField(o)}${field('Длительность по умолчанию, мин','duration',o.duration??55,'number',`min="${d.step}" max="480" step="${d.step}"`)}<label class="checkbox-field procedure-sync"><input type="checkbox" id="apply-procedure-day" ${ui.applyProcedureToDay?'checked':''}>Применять к процедурам текущего дня</label>`)
    +`<div class="inspector-actions">${button('place-procedure','Назначить без перетаскивания','plus')}${button('delete-selection','Удалить из библиотеки','trash','btn danger')}</div>`;
  if(s.type==='instructor')content=section('Инструктор',field('ФИО','name',o.name,'text','maxlength="140" data-plain-text'))+`<div class="inspector-actions">${button('remove-instructor','Удалить инструктора','trash','btn danger',`data-id="${o.id}"`)}</div>`;
  if(s.type==='patient'){
    const p=project.patients.find(p=>p.id===s.id),col=d.columns.find(c=>c.patientId===s.id);
    content=section('Карточка пациента',`${field('ФИО','name',o.name)}${field('Домик','house',o.house)}${col?`<div class="field-grid main-colors">${colorField('Заголовок','headerColor',col.headerColor)}${colorField('Фон колонки','color',col.color)}</div>`:''}`)
      +(col?section('Колонка',`<div class="column-order">${button('patient-left','Левее','left')}${button('patient-right','Правее','chevron')}</div>${field('Ширина, px','width',col.width,'number','min="100" max="320" step="8"')}`):'')
      +`<div class="inspector-actions">${button('delete-selection','Удалить из расписания','trash','btn danger')}</div>`;
  }
  if(s.type==='band')content=section('Общий период',`${field('Название','name',o.name)}${colorField('Цвет полосы','color',o.color)}<div class="field-grid">${field('Начало','start',hm(o.start),'time')}${field('Конец','end',hm(o.start+o.duration),'time')}</div>${field('Длительность, мин','duration',o.duration,'number',`min="${d.step}" step="${d.step}"`)}`)
    +`<div class="inspector-actions">${button('delete-selection','Удалить полосу','trash','btn danger')}</div>`;
  return `<div class="inspector-header"><h2>Инспектор</h2><span>${labels[s.type]}</span>${ib('toggle-right','Закрыть инспектор','close')}</div><form id="inspector-form">${content}</form>`;
}
function updateField(key,raw){const s=ui.selection;if(key==='scheduleName'){if(String(raw).trim())transact(()=>project.stays.find(s=>s.id===project.currentStayId).name=String(raw).trim());return;}const existing=getSelection();if(!existing)return;const o=clone(existing);let value=key==='instructorId'?(raw||null):raw;
  if(['width','duration','fontSize','step','defaultDuration'].includes(key)){value=Number(raw);if(value!==null&&(!Number.isFinite(value)||!Number.isInteger(value))){toast('Укажите целое число',true);render();return;}}
  if(['start','end','workEnd'].includes(key)){value=minutes(raw);if(!Number.isFinite(value)){toast('Укажите корректное время',true);render();return;}}
  if(['name','text'].includes(key)&&!String(value).trim()){toast('Название не может быть пустым',true);render();return;}
  if(key==='end'&&s.type!=='day')o.duration=value-o.start;else o[key]=value;
  if(s.type==='patient'&&key==='width'&&(value<100||value>320)){toast('Ширина колонки должна быть от 100 до 320',true);render();return;}
  if(s.type==='procedure'&&key==='duration'){const error=procedureDurationError(value,day().step);if(error){toast(error,true);render();return;}}
  if(s.type==='appointment'&&key==='instructorId'){const own=project.procedures.find(p=>p.id===o.procedureId);if(own)o.color=instructorColor(own,value);}
  if(s.type==='appointment'){const error=validatePlacement(day(),o);if(error){toast(error,true);render();return;}}
  if(s.type==='band'){const error=validatePlacement({...day(),disabledPatientIds:[]},o);if(error){toast(error,true);render();return;}}
  if(s.type==='day'){
    if(workdayEnd(o)<=o.start){toast('Конец рабочего дня должен быть позже начала сетки',true);render();return;}
    if(o.start<0||o.start>=1440||o.end>1440||o.defaultDuration<=0||o.defaultDuration>480){toast('Укажите корректное начало сетки',true);render();return;}
  }
  transact(()=>{
    if(s.type==='day')project.days[ui.date]=o;
    if(s.type==='appointment')Object.assign(day().appointments.find(a=>a.id===s.id),o);
    if(s.type==='procedure')updateProcedureTemplate(project,ui.date,s.id,{[key]:value},{applyToDay:ui.applyProcedureToDay});
    if(s.type==='patient'){const p=project.patients.find(p=>p.id===s.id),c=day().columns.find(c=>c.patientId===s.id);if(['name','house'].includes(key))p[key]=value;if(c)c[key]=value;}
    if(s.type==='instructor')Object.assign(project.instructors.find(i=>i.id===s.id),{[key]:value});
    if(s.type==='band')Object.assign(day().bands.find(b=>b.id===s.id),o);

  });
}
function openModal(title,body,footer='',cls=''){modal.className=cls;modal.innerHTML=`<div class="modal-head"><h2>${title}</h2>${ib('close-modal','Закрыть','close')}</div>${body}<div class="modal-footer">${footer||button('close-modal','Готово',null,'btn primary')}</div>`;setupEditorUI(modal);if(!modal.open)modal.showModal();}
function confirmAction(title,text,label,onConfirm){openModal(title,`<div class="modal-body"><p>${text}</p></div>`,`${button('close-modal','Отмена')}${button('confirm-modal',label,null,'btn danger')}`);modal.querySelector('[data-action="confirm-modal"]').onclick=()=>{modal.close();onConfirm();};}

const helpPages=[
  {title:'Создайте расписание',text:'Нажмите + рядом с «Расписания». Введите название и даты заезда. По умолчанию — 28 дней.',image:'schedule',alt:'Кнопка плюс в списке расписаний'},
  {title:'Добавьте пациентов',text:'Нажмите + рядом с «Пациенты». Укажите имя и домик. Галочка включает пациента в выбранном дне. Если её снять, процедуры пациента в этом дне удалятся. Колонки в таблице можно менять местами, перетаскивая заголовок.',image:'patients',alt:'Список пациентов с кнопкой добавления и галочками'},
  {title:'Добавьте инструкторов',text:'Откройте вкладку «Инструктора» рядом с пациентами. Добавляйте по одному через + или сразу списком. Справочник общий для всех расписаний.',image:'instructors',alt:'Вкладка инструкторов с кнопкой добавления'},
  {title:'Подготовьте процедуры',text:'Внизу нажмите «+ Процедура». Задайте название и длительность: она должна быть кратна шагу сетки. При наведении на карточку появляются кнопки «Дублировать» и «Удалить».',image:'library',alt:'Библиотека процедур и кнопка добавления'},
  {title:'Укажите инструкторов процедуры',text:'Выберите карточку и справа в «Инструкторы» нажмите +. У процедуры может быть несколько инструкторов, у каждого свой цвет. Цвет первого совпадает с фоном процедуры.',image:'procedure',alt:'Список инструкторов и их цветов в инспекторе процедуры'},
  {title:'Расставьте карточки как удобно',text:'Перетащите карточку вдоль библиотеки: соседние плавно сдвинутся, порядок сохранится. Если вынести карточку на сетку, процедура поставится в расписание.',image:'library-drag',alt:'Карточка перетаскивается вдоль библиотеки, соседние сдвигаются'},
  {title:'Заполните нужный день',text:'Выберите вкладку дня. Перетащите процедуру из библиотеки в колонку пациента на нужное время. Потяните край блока, чтобы изменить длительность.',image:'days',alt:'Вкладки дней и процедуры на временной сетке'},
  {title:'Настройте через инспектор',text:'Нажмите на пациента, процедуру или полосу периода. Справа меняйте текст, оформление, время и инструктора. При наведении на блок появляются замочек и корзинка. Esc снимает выделение и открывает настройки дня: начало сетки и конец рабочего дня.',image:'inspector',alt:'Свойства выбранной процедуры в инспекторе'},
  {title:'Заполните день автоматически',text:'«Автозаполнение» само расставит выбранные процедуры всем пациентам дня с учётом инструкторов, обеда и ваших условий. Понравившееся закрепляйте замочком, остальное пересоставляйте кнопкой ↻. Подробности — по значку ⓘ внутри окна автозаполнения.',image:'autofill-button',alt:'Кнопка автозаполнения и кнопка повтора'},
  {title:'Сохраните результат в PNG',text:'Нажмите «Сохранить PNG» вверху. Конец времени подставится по последней процедуре, при необходимости поменяйте. Проверьте изображение и сохраните. Готовое расписание — PNG-файл.',image:'export',alt:'Окно экспорта расписания с предварительным просмотром'}
];
const autofillPages=[
  {title:'Что делает автозаполнение',image:'autofill-result',alt:'Составленное автоматически расписание дня',text:'Составляет расписание открытого дня: ставит каждому включённому пациенту все отмеченные процедуры и следит, чтобы никто не оказался в двух местах сразу.',list:['Перебирает много вариантов и берёт лучший: сначала всё поставлено, затем меньше выхода за конец дня, раньше окончание и меньше окон.','Ручное редактирование ничем не ограничено: правила действуют только для генератора.']},
  {title:'Как с ним работать',image:'autofill-button',alt:'Кнопка автозаполнения и кнопка повтора',text:'Работа идёт по кругу: настроить, составить, закрепить удачное, составить снова.',list:['<b>Автозаполнение</b> открывает эти настройки. Они запоминаются для каждого дня недели: в следующий понедельник вернутся настройки понедельника.','<b>↻</b> сразу строит новый вариант с теми же настройками, без окна.','<b>Ctrl+Z</b> отменяет результат одним шагом.']},
  {title:'Режим и рабочее время',image:'autofill-day',alt:'Блок с режимом, временем и периодами',text:'Верхний блок задаёт общие условия дня.',list:['<b>Весь набор</b> заменяет все назначения дня без замочка. <b>На свободное место</b> — об этом отдельный шаг.','<b>Начало</b> — раньше ничего не ставится. <b>Конец дня</b> задаётся в настройках дня в инспекторе и отмечен в таблице полоской. Это ориентир: что не влезло, уходит позже него, но не дальше 24:00.','<b>Слот</b> — шаг для процедур по сетке: при 60 минутах это 09:00, 10:00 и так далее.','<b>Не ставить на</b> — периоды, которые нельзя занимать. После них слоты считаются заново: например, с 13:30.']},
  {title:'Какие процедуры и кто работает',image:'autofill-procedures',alt:'Таблица процедур и инструкторов',text:'Здесь вы отмечаете, что будет в этот день и кто сегодня на месте. Оценка нагрузки сверху и под названием сразу показывает, сколько сеансов нужно и сколько помещается.',list:['<b>Галочка у названия</b> — процедура нужна всем включённым пациентам. Нет спорта сегодня — снимите её.','<b>Галочка у инструктора</b> — он сегодня работает. Несколько инструкторов работают параллельно, пациенту нужна одна такая процедура.','<b>С и до</b> — когда инструктор занят этой процедурой: например, массаж до 14:00, а АФК после. Что не влезло в «до», не ставится и попадает в итог.','Инструктор никогда не вернётся к прежней процедуре: цепочки «массаж, АФК, массаж» не будет. Без полей «с» и «до» порядок выбирает генератор.']},
  {title:'Условия для каждой процедуры',image:'autofill-rules',alt:'Таблица процедур с настроенными условиями',text:'Остальные колонки уточняют, как ставить процедуру.',list:['<b>Макс.</b> — сколько пациентов может быть на ней одновременно у всех инструкторов. Кушеток две — укажите 2, и третьего пациента поставят на другое время или процедуру.','<b>По сетке</b> — старт только на слотах. Без галочки — любое время по шагу с указанным перерывом. Галочка в заголовке меняет сразу все строки.','<b>Пациенты</b>: «Поодиночке» — один пациент у инструктора; «Совместно» — любые пациенты, до указанного числа; «По группам» — только с одинаковым номером в выбранной группе.']},
  {title:'Связки: две процедуры подряд',image:'autofill-links',alt:'Блок связок процедур',text:'Связка не даёт разорвать процедуры, которые должны идти друг за другом, например АФК · кушетка и АФК · тренажёр.',list:['Нажмите + и выберите две процедуры. Порядок любой: кушетка, затем тренажёр, или наоборот.','Обе идут у одного инструктора, между ними ничего не встанет, обед их не разрывает.','<b>Инструктор может вести обе сразу</b> — один инструктор одновременно ведёт одного пациента на кушетке и другого на тренажёре.','Если половина закреплена замочком, вторая встанет рядом. Нет места — итог сообщит.']},
  {title:'Группы: кто с кем может идти',image:'autofill-groups',alt:'Таблица групп с номерами пациентов',text:'Группа — это набор номеров. Пациенты с одинаковым номером могут идти вместе, с разными — нет. Без номера пациент идёт один.',list:['Нажмите + и назовите группу, например «Спорт». «Общая» есть всегда.','У каждого пациента в каждой группе свой номер: можно идти вместе на спорт, но отдельно на эрготерапию.','В строке процедуры выберите «По группам» и нужную группу.','Одинаковый номер разрешает, но не обязывает: если раздельно день заканчивается раньше, генератор поставит раздельно.']},
  {title:'Замочек: закрепите удачное',image:'autofill-locks',alt:'Расписание с закреплёнными блоками',text:'Наведите курсор на блок и нажмите замочек. Закреплённый замочек виден всегда.',list:['Такой блок генератор не двигает. Он занимает время пациента и инструктора и считается выполненной процедурой.','Понравилось, как встали массажи? Закрепите их и нажмите ↻: остальное составится заново вокруг них.','Для ручного редактирования замочек ничего не запрещает.']},
  {title:'На свободное место: по частям',image:'autofill-partial',alt:'Окно автозаполнения в режиме «На свободное место»',text:'Этот режим ставит процедуры партиями: сначала АФК, потом массаж, потом психолога. Замочки между шагами не нужны.',list:['Переключите режим вверху и отметьте только то, что ставите сейчас. У этого режима свои галочки.','Остальные назначения остаются на месте и занимают время.','Повторный запуск переставит заново только выбранную процедуру. Замочки по-прежнему в приоритете.']},
  {title:'Если что-то не поместилось',image:'autofill-report',alt:'Итог автозаполнения со списком непоставленных процедур',text:'Генератор старается поставить всё. Если рабочего дня не хватает, процедуры уходят за конец дня: таблица расширится, а итог покажет сколько таких.',list:['Если не хватило даже суток или времени инструктора, появится список: что не поставлено, у кого и что помешало, например занятый инструктор, поле «до» или лимит «Макс.».','Под каждой причиной написано, что можно поменять.','Остальное можно поправить вручную: блоки перетаскиваются как обычно.']}
];
let helpDeck={pages:helpPages,title:'Как работать с программой',cls:'tutorial-dialog',done:null};
function showHelp(page=0){
  const {pages,title,cls,done}=helpDeck,index=Math.max(0,Math.min(pages.length-1,page)),step=pages[index];
  const dots=pages.map((p,i)=>`<button type="button" data-action="help-page" data-page="${i}" aria-label="Шаг ${i+1}: ${p.title}" aria-current="${i===index?'step':'false'}" class="help-dot ${i===index?'active':''}"></button>`).join('');
  const last=index===pages.length-1,finish=done?button('help-done','К настройкам',null,'btn primary'):button('close-modal','Готово',null,'btn primary');
  openModal(title,`<div class="modal-body tutorial-body" data-help-page="${index}"><figure class="tutorial-image"><img src="./assets/tutorial/${step.image}.png" alt="${step.alt}"></figure><div class="tutorial-copy" aria-live="polite"><span class="tutorial-step">ШАГ ${index+1} ИЗ ${pages.length}</span><h3>${step.title}</h3><p>${step.text}</p>${step.list?`<ul>${step.list.map(item=>`<li>${item}</li>`).join('')}</ul>`:''}</div></div>`,`<div class="help-dots" aria-label="Шаги обучения">${dots}</div><button type="button" class="btn" data-action="help-page" data-page="${index-1}" ${index===0?'disabled':''}>Назад</button>${last?finish:`<button type="button" class="btn primary" data-action="help-page" data-page="${index+1}">Далее ${icon('chevron')}</button>`}`,cls);
  modal.querySelector('.tutorial-body').scrollTop=0;
  if(done){modal.querySelector('.modal-head [data-action="close-modal"]').dataset.action='help-done';modal.oncancel=e=>{e.preventDefault();leaveHelp();};}
}
function leaveHelp(){const done=helpDeck.done;modal.oncancel=null;done?.();}
function showAutofillTutorial(done){helpDeck={pages:autofillPages,title:'Как пользоваться автозаполнением',cls:'tutorial-dialog tutorial-long',done};showHelp(0);}

function newPatient(){openModal('Новый пациент',`<form id="add-patient-form" class="modal-body"><label class="field"><span class="field-label">ФИО</span><input name="name" required maxlength="140" autocomplete="off" placeholder="Фамилия Имя Отчество" autofocus></label><label class="field"><span class="field-label">Домик</span><input name="house" maxlength="60" placeholder="Например, 7 или 4А"></label><div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button class="btn primary" form="add-patient-form" type="submit">Добавить в расписание</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim(),house=f.get('house').trim();if(!name)return;const id=uid(),textStyles=readTextStyles(e.target);modal.close();ui.selection={type:'patient',id};transact(()=>{project.patients.push({id,name,house,archived:false,textStyles});});};}
function addProcedure(){openModal('Новый вид процедуры',`<form id="add-procedure-form" class="modal-body" novalidate><label class="field"><span class="field-label">Название</span><input name="name" required maxlength="100" placeholder="Например, массаж" autofocus></label><label class="field"><span class="field-label">Длительность, мин</span><input name="duration" type="number" required min="${day().step}" max="480" step="${day().step}" value="${Math.ceil(50/day().step)*day().step}"></label><label class="field"><span class="field-label">Цвет</span><input name="color" type="color" value="#f7df88"></label><div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button class="btn primary" form="add-procedure-form" type="submit">Создать</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim();if(!name)return;const duration=Number(f.get('duration')),durationError=procedureDurationError(duration,day().step);if(durationError){modal.querySelector('#modal-error').textContent=durationError;return;}const id=uid(),textStyles=readTextStyles(e.target);modal.close();ui.applyProcedureToDay=false;ui.selection={type:'procedure',id};transact(()=>project.procedures.push({id,name,color:f.get('color'),textColor:'#26332f',duration,note:'',textStyles,instructors:[]}));};}
function addBand(){const d=day(),start=780;openModal('Добавить общую полосу',`<form id="add-band-form" class="modal-body"><label class="field"><span class="field-label">Название</span><input name="name" value="Новый период" required maxlength="100"></label><div class="field-grid"><label class="field"><span class="field-label">Начало</span><input type="time" name="start" value="${hm(start)}" required></label><label class="field"><span class="field-label">Конец</span><input type="time" name="end" value="${hm(start+30)}" required></label></div><label class="field"><span class="field-label">Цвет</span><input type="color" name="color" value="#e2e6ec"></label><div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button class="btn primary" form="add-band-form" type="submit">Добавить полосу</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),start=minutes(f.get('start')),end=minutes(f.get('end')),name=f.get('name').trim();if(!name||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start%d.step||end%d.step){modal.querySelector('#modal-error').textContent=`Укажите начало и конец с шагом ${d.step} минут`;return;}const id=uid(),textStyles=readTextStyles(e.target);modal.close();ui.selection={type:'band',id};transact(()=>d.bands.push({id,name,start,duration:end-start,color:f.get('color'),textStyles}),'Общая полоса добавлена');};}

function makeAppointment(procedure,patientId,start,instructorId=procedure.instructors?.[0]?.instructorId||null){const style=textStyle(procedure,'name');return {id:uid(),procedureId:procedure.id,instructorId,locked:false,patientId,start,duration:durationFor(procedure,day()),text:procedure.name,color:instructorColor(procedure,instructorId),textColor:procedure.textColor,fontSize:style.fontSize,bold:style.bold,italic:style.italic,fontFamily:style.fontFamily,textStyles:{text:clone(style)},align:'center',status:'planned'};}
function placeForm(procedureId=null,cell=null){if(!visibleColumns(day()).length){toast('Сначала включите пациента в этом дне',true);return;}if(!project.procedures.length){toast('Сначала создайте вид процедуры',true);return;}openModal('Назначить процедуру',`<form id="place-form" class="modal-body"><label class="field"><span class="field-label">Процедура</span><select name="procedure">${project.procedures.map(p=>`<option value="${p.id}" ${p.id===procedureId?'selected':''}>${esc(p.name)} · ${durationFor(p,day())} мин</option>`).join('')}</select></label><label class="field"><span class="field-label">Пациент</span><select name="patient">${visibleColumns(day()).map(c=>`<option value="${c.patientId}" ${c.patientId===cell?.patientId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label class="field"><span class="field-label">Начало</span><input name="start" type="time" value="${hm(cell?.start??day().start)}" required></label><div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button class="btn primary" form="place-form" type="submit">Назначить</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),p=project.procedures.find(p=>p.id===f.get('procedure')),a=makeAppointment(p,f.get('patient'),minutes(f.get('start'))),error=validatePlacement(day(),a);if(error){modal.querySelector('#modal-error').textContent=error;return;}modal.close();ui.selection={type:'appointment',id:a.id};transact(()=>day().appointments.push(a),'Процедура добавлена');};}
function requestPatientRemoval(id){const patient=project.patients.find(p=>p.id===id&&!p.archived);if(!patient)return;const count=Object.values(project.days).reduce((n,d)=>n+d.appointments.filter(a=>a.patientId===id).length,0);confirmAction('Удалить пациента из расписания?',`${esc(patient.name)}. Пациент будет удалён из всех ${Object.keys(project.days).length} дней этого расписания. Его назначения: ${count}. Действие можно отменить. Другие расписания сохранятся.`,'Удалить из расписания',()=>{ui.selection={type:'day'};transact(()=>removeSchedulePatient(project,id),'Пациент удалён');});}
function deleteSelection(){const s=clone(ui.selection),o=getSelection();if(!o)return;
  const remove=()=>{ui.selection={type:'day'};transact(()=>{if(s.type==='appointment')day().appointments=day().appointments.filter(a=>a.id!==s.id);if(s.type==='procedure')project.procedures=project.procedures.filter(p=>p.id!==s.id);if(s.type==='band')day().bands=day().bands.filter(b=>b.id!==s.id);if(s.type==='patient')removeSchedulePatient(project,s.id);},'Удалено');};
  if(s.type==='patient')requestPatientRemoval(s.id);else if(s.type==='procedure')confirmAction('Удалить вид процедуры?',`«${esc(o.name)}» исчезнет из библиотеки. Размещённые назначения сохранятся.`,'Удалить вид',remove);else remove();
}
function selectFromButton(el){const {selectType:type,id}=el.dataset;if(type&&(ui.selection.type!==type||ui.selection.id!==id))select(type,id);}
function clearDay(){const count=day().appointments.length;if(!count){toast('В этом дне нет процедур');return;}if(ui.selection.type==='appointment')ui.selection={type:'day'};transact(()=>{day().appointments=[];},`Расписание дня очищено, процедур: ${count}. Отменить — Ctrl+Z`);}
function duplicateProcedure(){const source=getSelection(),next={...clone(source),id:uid(),name:`${source.name} (копия)`};ui.applyProcedureToDay=false;ui.selection={type:'procedure',id:next.id};transact(()=>project.procedures.splice(project.procedures.findIndex(p=>p.id===source.id)+1,0,next),'Копия процедуры добавлена');}
function duplicate(){if(ui.selection.type==='procedure'){duplicateProcedure();return;}const a=getSelection();if(ui.selection.type!=='appointment')return;const next={...clone(a),id:uid(),start:a.start+a.duration};const error=validatePlacement(day(),next);if(error){toast(error,true);return;}ui.selection={type:'appointment',id:next.id};transact(()=>day().appointments.push(next),'Копия добавлена после исходной процедуры');}
async function saveProject(){try{const result=await downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`Расписание-проект-${ui.date}.json`);if(!result?.canceled)toast(desktop?'Файл проекта сохранён':'Файл проекта подготовлен для скачивания');}catch(error){toast('Не удалось сохранить проект: '+error.message,true);}}
function copyDay(){
  openModal('Копировать расписание дня',`<form id="copy-day-form" class="modal-body"><label class="field"><span class="field-label">Откуда копировать</span><select name="source">${Object.keys(project.days).sort().map(date=>`<option value="${date}" ${date===ui.date?'selected':''}>${esc(dateLabel(date))} · процедур: ${project.days[date].appointments.length}</option>`).join('')}</select></label><label class="field"><span class="field-label">На какую дату</span><input name="date" type="date" required value="${addCalendarDays(ui.date,7)}"><span class="copy-weekday" id="copy-target-weekday"></span></label><button type="button" class="text-btn copy-next-week" id="copy-next-week">${icon('calendar')}Через неделю от исходного дня</button><div class="copy-summary" id="copy-summary" aria-live="polite"></div><div class="copy-warning" id="copy-warning" hidden><p id="copy-warning-text"></p><label class="checkbox-field"><input name="replace" type="checkbox">Заменить содержимое выбранного дня</label></div><div id="modal-error" class="error-text"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="copy-day-form" class="btn primary">Копировать</button>`);
  const form=modal.querySelector('form'),source=form.querySelector('[name=source]'),date=form.querySelector('[name=date]'),ack=form.querySelector('[name=replace]'),submit=modal.querySelector('[type=submit]');
  const needsConfirmation=()=>{const target=project.days[date.value];return !!target&&target.appointments.length>0;};
  const update=()=>{
    const target=project.days[date.value],valid=!!date.value&&date.value!==source.value,warning=needsConfirmation();
    form.querySelector('#copy-target-weekday').textContent=date.value?new Date(date.value+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long'}):'';
    form.querySelector('#copy-summary').textContent=target?'Выбранный день уже существует. Его расписание будет заменено копией.':'Для копии будет создан новый день.';
    form.querySelector('#copy-warning').hidden=!warning;form.querySelector('#copy-warning-text').textContent=warning?`В выбранном дне уже есть записи: процедур — ${target.appointments.length}.`:'';
    form.querySelector('#modal-error').textContent=date.value===source.value?'Выберите другой день для копии':'';submit.disabled=!valid||(warning&&!ack.checked);
  };
  const reset=()=>{ack.checked=false;update();};source.onchange=reset;date.oninput=reset;date.onchange=reset;ack.onchange=update;
  form.querySelector('#copy-next-week').onclick=()=>{date.value=addCalendarDays(source.value,7);reset();};update();
  form.onsubmit=e=>{e.preventDefault();if(!date.value||source.value===date.value||(needsConfirmation()&&!ack.checked)){update();return;}const success=transact(()=>{copyScheduleDay(project,source.value,date.value,{appointments:true,replace:true});ui.date=date.value;ui.selection={type:'day'};},'Расписание скопировано');if(success)modal.close();};
}
function exportModal(){if(!visibleColumns(day()).length){toast('Включите пациентов для экспорта этого дня',true);return;}openModal('Сохранить расписание',`<div class="modal-body"><div class="export-controls"><label class="field"><span class="field-label">Начало</span><input id="export-start" type="time" value="${hm(day().start)}"></label><label class="field"><span class="field-label">Конец</span><input id="export-end" type="time" value="${hm(exportEndTime(day()))}"></label><label class="field"><span class="field-label">Разрешение</span><select id="export-scale"><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option></select></label><label class="field"><span class="field-label">Колонок в PNG</span><select id="export-columns"><option value="all">Все</option><option value="6">По 6</option><option value="10">По 10</option></select></label></div><div class="export-preview" id="export-preview"></div><div class="error-text" id="modal-error"></div></div>`,`${button('close-modal','Закрыть')}${button('refresh-export','Обновить просмотр','image')}${button('download-export','Сохранить PNG','download','btn primary')}`,'export-dialog');refreshExport();modal.querySelectorAll('.export-controls input,.export-controls select').forEach(e=>e.onchange=refreshExport);}
let exportCanvases=[];
function refreshExport(){try{const start=minutes(modal.querySelector('#export-start').value),end=minutes(modal.querySelector('#export-end').value),scale=Number(modal.querySelector('#export-scale').value),group=modal.querySelector('#export-columns').value==='all'?visibleColumns(day()).length:Number(modal.querySelector('#export-columns').value);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1440||end<=start)throw Error('Выберите диапазон в пределах 00:00–23:59');const canvases=[];for(let i=0;i<visibleColumns(day()).length;i+=group)canvases.push(renderScheduleImage(day(),{scale,start,end,columns:visibleColumns(day()).slice(i,i+group)}));exportCanvases=canvases;const preview=modal.querySelector('#export-preview');preview.replaceChildren();canvases.forEach((c,i)=>{const wrapper=document.createElement('div');wrapper.className='export-page';wrapper.append(c);if(canvases.length>1){const b=document.createElement('button');b.className='btn';b.textContent=`Скачать часть ${i+1}`;b.onclick=()=>downloadCanvas(c,i);wrapper.append(b);}preview.append(wrapper);});modal.querySelector('#modal-error').textContent='';modal.querySelector('[data-action="download-export"]').disabled=false;}catch(e){exportCanvases=[];modal.querySelector('#modal-error').textContent=e.message;modal.querySelector('[data-action="download-export"]').disabled=true;}}
function downloadCanvas(canvas,index){canvas.toBlob(async blob=>{if(!blob){toast('Не удалось создать PNG. Уменьшите разрешение.',true);return;}try{const result=await downloadBlob(blob,`Расписание-${ui.date}${exportCanvases.length>1?'-часть-'+(index+1):''}.png`);if(desktop&&!result?.canceled)toast('Изображение сохранено');}catch(error){toast('Не удалось сохранить PNG: '+error.message,true);}},'image/png');}

function orderPatient(delta){const active=project.patients.filter(p=>!p.archived),index=active.findIndex(p=>p.id===ui.selection.id),next=index+delta;if(index<0||next<0||next>=active.length)return;transact(()=>{const first=project.patients.indexOf(active[index]),second=project.patients.indexOf(active[next]);[project.patients[first],project.patients[second]]=[project.patients[second],project.patients[first]];});}
function batchPatients(){openModal('Добавить пациентов списком',`<form id="batch-form" class="modal-body"><label class="field"><span class="field-label">Пациенты</span><textarea name="patients" rows="8" required placeholder="Иванов Иван; 7&#10;Петрова Анна; 3" autofocus></textarea></label><div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="batch-form" class="btn primary">Добавить</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const rows=new FormData(e.target).get('patients').split(/\r?\n/).filter(line=>line.trim());if(rows.length>200){modal.querySelector('#modal-error').textContent='Добавьте не более 200 пациентов за один раз';return;}const patients=rows.map(row=>{const [name,...house]=row.split(/[;\t]/);return {id:uid(),name:name.trim(),house:house.join(' ').trim(),archived:false};});if(patients.some(p=>!p.name)){modal.querySelector('#modal-error').textContent='Укажите имя для каждого пациента';return;}const styles=readTextStyles(e.target);for(const p of patients)p.textStyles=styles.patients?{name:styles.patients}:{};modal.close();transact(()=>project.patients.push(...patients),`Добавлено пациентов: ${patients.length}`);};}
function togglePatient(id,enabled){const count=day().appointments.filter(a=>a.patientId===id).length;transact(()=>{const selected=getSelection();if(ui.selection.type==='appointment'&&selected?.patientId===id)ui.selection={type:'day'};setPatientEnabled(day(),id,enabled);},count?`Процедуры пациента в этом дне удалены: ${count}. Отменить — Ctrl+Z`:undefined);}
function requestScheduleRemoval(id){const schedule=project.stays.find(s=>s.id===id);if(!schedule)return;const data=id===project.currentStayId?project:schedule;const text=`«${esc(schedule.name)}»: ${Object.keys(data.days).length} дней, ${data.patients.filter(p=>!p.archived).length} пациентов. Будут удалены все дни и назначения этого расписания. Библиотека процедур сохранится. Действие можно отменить.${project.stays.length===1?' Вместо последнего расписания появится новое пустое.':''}`;confirmAction('Удалить расписание?',text,'Удалить расписание',()=>{transact(()=>{removeSchedule(project,id);if(!project.days[ui.date])ui.date=Object.keys(project.days).sort()[0];ui.selection={type:'day'};},'Расписание удалено');});}
function staySelector(){return `<section class="schedule-picker" aria-label="Список расписаний"><div class="schedule-picker-head"><span class="eyebrow">Расписания</span>${ib('new-stay','Новое расписание','plus')}</div><div class="schedule-picker-list">${project.stays.map(schedule=>`<div class="schedule-picker-item ${schedule.id===project.currentStayId?'active':''}"><button data-action="choose-schedule" data-id="${schedule.id}" title="${esc(schedule.name)}">${icon('calendar')}<span class="schedule-name"><strong style="${fontCss(textStyle(schedule,'name',{fontSize:11}))}">${esc(schedule.name)}</strong>${schedule.startDate?`<small>${esc(new Date(schedule.startDate+'T12:00:00').toLocaleDateString('ru-RU'))} — ${esc(new Date(schedule.endDate+'T12:00:00').toLocaleDateString('ru-RU'))}</small>`:''}</span></button>${button('remove-schedule','','trash','icon-btn schedule-trash',`data-id="${schedule.id}" title="Удалить расписание" aria-label="Удалить расписание"`)}</div>`).join('')}</div></section>`;}
function changeStay(id){if(id===project.currentStayId)return;project.stays.find(s=>s.id===project.currentStayId).viewDate=ui.date;switchStay(project,id);const current=project.stays.find(s=>s.id===id);ui.date=project.days[current.viewDate]?current.viewDate:Object.keys(project.days).sort()[0];ui.selection={type:'day'};ui.search='';ui.undo=[];ui.redo=[];persist();render();}
function stayForm(rename=false){
  const current=project.stays.find(s=>s.id===project.currentStayId),startDate=ui.date;
  openModal(rename?'Название расписания':'Новое расписание',`<form id="stay-form" class="modal-body"><label class="field"><span class="field-label">Название</span><input name="name" required maxlength="100" value="${rename?esc(current.name):''}" placeholder="Например, ноябрь · первая группа" autofocus></label>${rename?'':`<div class="field-grid"><label class="field"><span class="field-label">Начало заезда</span><input name="date" type="date" required value="${startDate}"></label><label class="field"><span class="field-label">Окончание заезда</span><input name="endDate" type="date" required min="${startDate}" value="${addCalendarDays(startDate,27)}"></label></div><p id="stay-duration" aria-live="polite">28 календарных дней</p><label class="checkbox-field"><input name="patients" type="checkbox">Взять список пациентов из текущего расписания</label>`}<div class="error-text" id="modal-error"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="stay-form" class="btn primary">${rename?'Сохранить':'Создать расписание'}</button>`);
  if(!rename){
    const start=modal.querySelector('[name=date]'),end=modal.querySelector('[name=endDate]'),summary=modal.querySelector('#stay-duration');let automaticEnd=true;
    const update=()=>{end.min=start.value;try{const count=stayDates(start.value,end.value).length,word=new Intl.PluralRules('ru').select(count);summary.textContent=`${count} календарн${word==='one'?'ый день':word==='few'?'ых дня':'ых дней'}`;modal.querySelector('#modal-error').textContent='';}catch(error){summary.textContent='';modal.querySelector('#modal-error').textContent=error.message;}};
    start.onchange=()=>{if(automaticEnd&&start.value){try{end.value=addCalendarDays(start.value,27);}catch{}}update();};
    end.oninput=()=>{automaticEnd=false;update();};end.onchange=()=>{automaticEnd=false;update();};
  }
  modal.querySelector('form').onsubmit=e=>{
    e.preventDefault();const data=new FormData(e.target),name=data.get('name').trim(),textStyles=readTextStyles(e.target);if(!name)return;
    if(!rename){try{stayDates(data.get('date'),data.get('endDate'));}catch(error){modal.querySelector('#modal-error').textContent=error.message;return;}}
    const success=transact(()=>{if(rename){current.name=name;current.textStyles={...current.textStyles,...textStyles};}else{createStay(project,name,data.get('date'),data.has('patients'),data.get('endDate'));project.stays.find(s=>s.id===project.currentStayId).textStyles=textStyles;ui.date=data.get('date');ui.selection={type:'day'};ui.search='';}},rename?'Название сохранено':'Расписание создано');if(success)modal.close();
  };
}
function dayTabs(){return `<nav class="day-tabs" aria-label="Дни расписания">${Object.keys(project.days).sort().map(date=>{const dt=new Date(date+'T12:00:00');return `<button class="day-tab ${date===ui.date?'active':''}" data-action="goto-day" data-date="${date}" aria-current="${date===ui.date?'date':'false'}"><strong>${esc(dt.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}))}</strong><span>${esc(dt.toLocaleDateString('ru-RU',{weekday:'short'}))}</span></button>`;}).join('')}${button('new-day','День','plus','day-tab add-day')}</nav>`;}
function dayForm(mode='structure'){
  openModal(mode==='full'?'Копировать день':'Новый день',`<form id="day-form" class="modal-body"><label class="field"><span class="field-label">Дата</span><input name="date" type="date" required value="${localDate(new Date(new Date(ui.date+'T12:00:00').valueOf()+86400000))}"></label><label class="field"><span class="field-label">Что перенести из ${esc(new Date(ui.date+'T12:00:00').toLocaleDateString('ru-RU'))}</span><select name="mode"><option value="empty" ${mode==='empty'?'selected':''}>Пустой день с общим списком пациентов</option><option value="structure" ${mode==='structure'?'selected':''}>Оформление и общие периоды</option><option value="full" ${mode==='full'?'selected':''}>Всё расписание с процедурами</option></select></label><div id="modal-error" class="error-text"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="day-form" class="btn primary">Создать день</button>`);
  modal.querySelector('form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),date=data.get('date'),mode=data.get('mode');if(project.days[date]){modal.querySelector('#modal-error').textContent='День уже существует. Выберите его вкладку или другую дату.';return;}modal.close();transact(()=>{if(mode==='empty')project.days[date]=applyTemplate(makeDay(date,project.patients));else copyScheduleDay(project,ui.date,date,{appointments:mode==='full'});ui.date=date;ui.selection={type:'day'};},'День создан');};
}
function transferForm(){const selected=getSelection();if(ui.selection.type!=='appointment'||!selected)return;const source=ui.date,id=selected.id;openModal('Процедура в другой день',`<form id="transfer-form" class="modal-body"><p>${esc(selected.text)} · ${hm(selected.start)}–${hm(selected.start+selected.duration)}</p><label class="field"><span class="field-label">Дата назначения</span><input name="date" type="date" required value="${localDate(new Date(new Date(ui.date+'T12:00:00').valueOf()+86400000))}"></label><label class="field"><span class="field-label">Действие</span><select name="mode"><option value="copy">Копировать · оставить в исходном дне</option><option value="move">Перенести · убрать из исходного дня</option></select></label><div id="modal-error" class="error-text"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="transfer-form" class="btn primary">Применить</button>`);modal.querySelector('form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),date=data.get('date');if(date===source){modal.querySelector('#modal-error').textContent='Выберите другой день';return;}const success=transact(()=>{if(!project.days[date])project.days[date]=applyTemplate(makeDay(date,project.patients));const next=transferAppointment(project,source,id,date,data.get('mode')==='move');ui.date=date;ui.selection={type:'appointment',id:next.id};},'Процедура добавлена в выбранный день');if(success)modal.close();};}
const actions={
  'toggle-left':()=>{if(matchMedia('(max-width:650px)').matches){ui.mobileLeft=!ui.mobileLeft;ui.inspectorOverlay=false;}else ui.left=!ui.left;render();},'toggle-right':()=>{if(matchMedia('(max-width:950px)').matches){ui.inspectorOverlay=!ui.inspectorOverlay;ui.mobileLeft=false;}else ui.right=!ui.right;render();},'toggle-library':()=>{ui.library=!ui.library;render();},
  'select-patient':el=>select('patient',el.dataset.id),'remove-patient':el=>requestPatientRemoval(el.dataset.id),'remove-schedule':el=>requestScheduleRemoval(el.dataset.id),'enable-all-patients':()=>transact(()=>{for(const id of [...(day().disabledPatientIds||[])])setPatientEnabled(day(),id,true);}),'select-band':el=>select('band',el.dataset.id),'day-settings':()=>select('day'),
  'sidebar-tab':el=>{ui.sidebarTab=el.dataset.tab;render();},'add-instructor':()=>instructorForm(false),'batch-instructors':()=>instructorForm(true),'select-instructor':el=>select('instructor',el.dataset.id),'remove-instructor':el=>requestInstructorRemoval(el.dataset.id),'autofill':autofillDialog,'autofill-repeat':repeatAutofill,'clear-day':clearDay,'add-proc-instructor':addProcedureInstructor,'remove-proc-instructor':el=>removeProcedureInstructor(Number(el.dataset.index)),'toggle-lock':el=>{const a=day().appointments.find(a=>a.id===el.dataset.id);if(!a)return;ui.selection={type:'appointment',id:a.id};transact(()=>a.locked=!a.locked);},
  'add-patient':newPatient,'batch-patients':batchPatients,'choose-schedule':el=>changeStay(el.dataset.id),'add-procedure':addProcedure,'add-band':addBand,
  'close-modal':()=>modal.close(),'undo':undo,'redo':redo,'delete-selection':el=>{selectFromButton(el);deleteSelection();},'duplicate':el=>{selectFromButton(el);duplicate();},
  'place-procedure':()=>placeForm(ui.selection.id),
  'save-project':saveProject,'open-project':async()=>{if(!desktop){document.querySelector('#project-file').click();return;}try{const result=await desktop.openProject();if(!result.canceled)loadImportedProject(result.data);}catch(error){toast('Не удалось открыть файл: '+error.message,true);}},'export':exportModal,'refresh-export':refreshExport,
  'download-export':()=>{if(exportCanvases.length===1)downloadCanvas(exportCanvases[0],0);else toast('Скачайте каждую часть кнопкой под её изображением');},
  'prev-day':()=>moveDate(localDate(new Date(new Date(ui.date+'T12:00:00').valueOf()-86400000))),
  'next-day':()=>moveDate(localDate(new Date(new Date(ui.date+'T12:00:00').valueOf()+86400000))),
  'patient-left':()=>orderPatient(-1),'patient-right':()=>orderPatient(1),'copy-day':copyDay,'new-day':()=>dayForm('structure'),'new-stay':()=>stayForm(),'rename-stay':()=>stayForm(true),'transfer-appointment':transferForm,
  'saved-days':()=>openModal('Сохранённые дни',`<div class="modal-body"><div class="patient-picker">${Object.values(project.days).sort((a,b)=>b.date.localeCompare(a.date)).map(d=>`<button class="picker-row" data-action="goto-day" data-date="${d.date}"><strong>${esc(dateLabel(d.date))}</strong><small>${d.appointments.length} процедур</small></button>`).join('')}</div></div>`),
  'goto-day':el=>{modal.close();moveDate(el.dataset.date);},
  'goto-appointment':el=>{modal.close();select('appointment',el.dataset.id);document.querySelector(`[data-appointment="${el.dataset.id}"]`)?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});},
  'new-project':()=>confirmAction('Начать с пустого расписания?','Демонстрационные пациенты и назначения текущего расписания будут удалены. Остальные расписания и библиотека процедур сохранятся. Это действие можно отменить.','Начать',()=>{transact(()=>{const blank=newProject(false);project.patients=[];project.days=blank.days;project.demo=false;delete project.templates;ui.date=Object.keys(project.days)[0];ui.selection={type:'day'};});}),
  'save-template':()=>{const key='regular',d=day();transact(()=>{project.templates??={};project.templates[key]={start:d.start,end:d.end,step:d.step,defaultDuration:d.defaultDuration,bands:clone(d.bands)};},'Шаблон сохранён для новых дней');},
  'help':()=>{helpDeck={pages:helpPages,title:'Как работать с программой',cls:'tutorial-dialog',done:null};modal.oncancel=null;showHelp(0);},
  'help-page':el=>showHelp(Number(el.dataset.page)),
  'help-done':leaveHelp
};
// Apply stored templates only when creating a new date, never to existing appointments.
function applyTemplate(d){const t=project.templates?.regular;if(t){for(const key of ['start','end','step','defaultDuration'])d[key]=t[key];d.bands=t.bands.map(b=>({...clone(b),id:uid()}));}return d;}
document.addEventListener('click',e=>{if(suppressClick){suppressClick=false;return;}const el=e.target.closest('[data-action]');if(el){e.preventDefault();actions[el.dataset.action]?.(el);}else if(ui.selection.type!=='day'&&e.target.closest('.workspace')&&!e.target.closest('button,input,select,textarea,[data-appointment],[data-procedure],[data-band],.gutter-band'))select('day');});
root.addEventListener('submit',e=>e.preventDefault());
root.addEventListener('change',e=>{const el=e.target;if(el.id==='apply-procedure-day'){ui.applyProcedureToDay=el.checked;return;}if(el.dataset.procInstructor!==undefined){const next=clone(getSelection().instructors);next[Number(el.dataset.procInstructor)].instructorId=el.value;changeProcedureInstructors(next);return;}if(el.dataset.procInstructorColor!==undefined){const index=Number(el.dataset.procInstructorColor);if(index===0){updateField('color',el.value);return;}const next=clone(getSelection().instructors);next[index].color=el.value;changeProcedureInstructors(next);return;}if(el.dataset.patientToggle){togglePatient(el.dataset.patientToggle,el.checked);return;}if(el.dataset.field)updateField(el.dataset.field,el.type==='checkbox'?el.checked:el.value);else if(el.id==='date-picker')moveDate(el.value);else if(el.id==='zoom'){ui.zoom=Number(el.value);render();}});
root.addEventListener('input',e=>{if(e.target.id==='instructor-search'){const pos=e.target.selectionStart;ui.instructorSearch=e.target.value;document.querySelector('.sidebar').innerHTML=sidebar();const input=document.querySelector('#instructor-search');input.focus();input.setSelectionRange(pos,pos);return;}if(e.target.id==='patient-search'){const pos=e.target.selectionStart;ui.search=e.target.value;document.querySelector('.sidebar').innerHTML=sidebar();const input=document.querySelector('#patient-search');input.focus();input.setSelectionRange(pos,pos);}});
document.addEventListener('keydown',e=>{
  const editable=e.target.closest('input,textarea,select,[contenteditable=true]');if(e.key==='Escape'&&drag){e.preventDefault();stopDrag(true);return;}if(editable)return;if(modal.open)return;if(e.key==='Escape'){e.preventDefault();select('day');return;}
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}
  if(mod&&e.code==='KeyY'){e.preventDefault();redo();}
  if(mod&&e.code==='KeyS'){e.preventDefault();saveProject();}
  if(mod&&e.code==='KeyD'){e.preventDefault();duplicate();}
  if(e.key==='Delete'&&['appointment','band','patient','procedure'].includes(ui.selection.type)){e.preventDefault();deleteSelection();}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button]')){e.preventDefault();if(e.target.dataset.procedure)select('procedure',e.target.dataset.procedure);else if(e.target.dataset.appointment)select('appointment',e.target.dataset.appointment);else e.target.click();}
});
function loadImportedProject(text){const imported=ensureStays(upgradeDefaultPeriods(validateProject(JSON.parse(text))));confirmAction('Открыть другой проект?','Текущий проект будет заменён. Предварительно сохраните его кнопкой «Сохранить проект», если нужна отдельная копия. Открытие можно отменить через Ctrl+Z.','Открыть',()=>{recovery=false;transact(()=>{project=imported;ui.date=Object.keys(project.days).sort().at(-1)||localDate();if(!project.days[ui.date])project.days[ui.date]=makeDay(ui.date,project.patients);ui.selection={type:'day'};},'Проект открыт');});}
document.querySelector('#project-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>15*1024*1024)throw Error('Размер проекта превышает 15 МБ');loadImportedProject(await file.text());}catch(err){toast('Не удалось открыть файл: '+err.message,true);}};
desktop?.onCommand(command=>actions[command]?.());
window.addEventListener('beforeunload',e=>{if(!saved){e.preventDefault();e.returnValue='';}});

// Only procedure cards and appointments can be dragged.
let instructorPress=null,drag=null,lastPointer={x:0,y:0},dragFrame=0,reorderTimer=0,suppressClick=false;
// Patient columns slide aside while one is dragged by its header; the move applies to
// the shared patient order, so every day of this schedule and the PNG follow it.
const columnParts=id=>[document.querySelector(`.column-header[data-patient="${id}"]`),document.querySelector(`[data-lane="${id}"]`),...document.querySelectorAll(`.appointment-group[data-col="${id}"] > *`)].filter(Boolean);
function clearColumnDrag(){
  for(const col of colOffsets())for(const part of columnParts(col.patientId)){part.style.transform='';part.classList.remove('column-dragged');}
  clearTimeout(reorderTimer);reorderTimer=setTimeout(()=>{if(!drag)document.body.classList.remove('column-reordering');},220);
}
function updateColumnDrag(){
  const cols=colOffsets(),lanes=document.querySelector('#lanes');if(!lanes)return;
  const from=cols.findIndex(c=>c.patientId===drag.id);if(from<0)return;
  const rect=lanes.getBoundingClientRect();
  drag.columnGrab??=drag.startX-rect.left-cols[from].x;
  document.body.classList.add('column-reordering');
  const moving=cols[from],left=lastPointer.x-rect.left-drag.columnGrab,center=left+moving.width/2,others=cols.filter(c=>c!==moving);
  let to=others.length,position=0;
  for(let i=0;i<others.length;i++){if(center<position+others[i].width/2){to=i;break;}position+=others[i].width;}
  drag.columnTo=to;drag.columnFrom=from;
  const order=[...others.slice(0,to),moving,...others.slice(to)];let x=0;
  for(const col of order){
    const dragged=col===moving,shift=dragged?left-col.x:x-col.x;
    for(const part of columnParts(col.patientId)){part.classList.toggle('column-dragged',dragged);part.style.transform=shift?`translateX(${shift}px)`:'';}
    x+=col.width;
  }
}
function finishColumnDrag(current,cancel){
  if(!current.active)return;
  suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
  const cols=colOffsets(),from=current.columnFrom,to=current.columnTo;
  if(cancel||to==null||from===to){clearColumnDrag();return;}
  const header=document.querySelector(`.column-header[data-patient="${current.id}"]`),oldLeft=header?.getBoundingClientRect().left;
  const moved=transact(()=>moveVisiblePatient(project,cols.map(c=>c.patientId),current.id,to));
  clearColumnDrag();if(!moved)return;
  const next=document.querySelector(`.column-header[data-patient="${current.id}"]`);if(!next||oldLeft===undefined)return;
  const shift=oldLeft-next.getBoundingClientRect().left,parts=columnParts(current.id);
  for(const part of parts){part.classList.add('column-dragged');part.style.transition='none';part.style.transform=`translateX(${shift}px)`;}
  next.getBoundingClientRect();
  for(const part of parts){part.style.transition='transform .18s ease';part.style.transform='';}
  setTimeout(()=>{for(const part of parts){part.style.transition='';part.classList.remove('column-dragged');}},200);
}

// Library cards slide aside while one is dragged; dropping elsewhere still places it.
function libraryCards(){return [...document.querySelectorAll('#procedure-list .procedure-card')];}
function clearReorder(){
  for(const card of libraryCards()){card.style.transform='';card.classList.remove('reorder-dragged');}
  clearTimeout(reorderTimer);reorderTimer=setTimeout(()=>{if(!drag)document.body.classList.remove('reordering');},220);
}
function updateLibraryReorder(){
  if(drag?.type!=='procedure'||!ui.library)return false;
  const list=document.querySelector('.procedure-list'),cards=libraryCards();
  if(!list||!cards.length)return false;
  const box=list.getBoundingClientRect();
  if(!drag.reorder){
    const from=project.procedures.findIndex(p=>p.id===drag.id),rect=cards[from].getBoundingClientRect(),first=cards[0].getBoundingClientRect();
    drag.reorder={from,grab:drag.startX-rect.left,base:first.left-box.left+list.scrollLeft-cards[0].offsetLeft,step:cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:rect.width};
  }
  const {from,grab,base,step}=drag.reorder,inside=lastPointer.x>=box.left&&lastPointer.x<=box.right&&lastPointer.y>=box.top-24&&lastPointer.y<=box.bottom+24;
  if(!inside){if(drag.reorderTo!=null){drag.reorderTo=null;clearReorder();}return false;}
  document.body.classList.add('reordering');
  const left=lastPointer.x-box.left+list.scrollLeft-grab,to=Math.max(0,Math.min(cards.length-1,Math.round((left-base-cards[0].offsetLeft)/step)));
  drag.reorderTo=to;
  cards.forEach((card,i)=>{
    if(i===from){card.classList.add('reorder-dragged');card.style.transform=`translateX(${left-base-card.offsetLeft}px)`;return;}
    card.style.transform=i>from&&i<=to?`translateX(${-step}px)`:i<from&&i>=to?`translateX(${step}px)`:'';
  });
  return true;
}
function finishLibraryReorder(id,from,to){
  const moving=document.querySelector(`[data-procedure="${id}"]`),oldLeft=moving?.getBoundingClientRect().left;
  if(from===to){clearReorder();return;}
  transact(()=>{const [item]=project.procedures.splice(from,1);project.procedures.splice(to,0,item);});
  clearReorder();
  const card=document.querySelector(`[data-procedure="${id}"]`);if(!card||oldLeft===undefined)return;
  card.classList.add('reorder-dragged');card.style.transition='none';card.style.transform=`translateX(${oldLeft-card.getBoundingClientRect().left}px)`;card.getBoundingClientRect();
  card.style.transition='transform .18s ease';card.style.transform='';
  setTimeout(()=>{card.style.transition='';card.classList.remove('reorder-dragged');},200);
}

function pointerLocation(x,y,clampTop=false){const lanes=document.querySelector('#lanes'),scroll=document.querySelector('.schedule-scroll');if(!lanes||!scroll)return null;const rect=lanes.getBoundingClientRect(),visible=scroll.getBoundingClientRect();if(x<Math.max(rect.left,visible.left+TIME_GUTTER)||x>Math.min(rect.right,visible.right)||(!clampTop&&y<visible.top+76)||y>visible.bottom+20)return null;const xx=x-rect.left,col=colOffsets().find(c=>xx>=c.x&&xx<c.x+c.width);if(!col)return null;const effectiveY=clampTop?Math.max(y,visible.top+86,rect.top):y;return {patientId:col.patientId,col,minute:day().start+Math.round(((effectiveY-rect.top)/ppm())/day().step)*day().step,rect};}
root.addEventListener('pointerdown',e=>{
  if(e.button!==0||modal.open||e.target.closest('.procedure-card-actions'))return;instructorPress=null;const row=e.target.closest('[data-instructor-row]');if(row&&!e.target.closest('[data-action="remove-instructor"]')){instructorPress={id:row.dataset.instructorRow,x:e.clientX,y:e.clientY,pointerId:e.pointerId};return;}const ael=e.target.closest('[data-appointment]'),pel=e.target.closest('[data-procedure]'),head=e.target.closest('.column-header');
  if(head){e.preventDefault();drag={type:'column',id:head.dataset.patient,startX:e.clientX,startY:e.clientY,active:false,pointerId:e.pointerId};lastPointer={x:e.clientX,y:e.clientY};return;}
  if(ael||pel){e.preventDefault();const type=ael?'appointment':'procedure',id=(ael||pel).dataset[type],o=clone(type==='appointment'?day().appointments.find(a=>a.id===id):project.procedures.find(p=>p.id===id));const resize=e.target.closest('[data-resize]')?.dataset.resize;drag={type,id,original:o,startX:e.clientX,startY:e.clientY,active:false,resize,offset:type==='appointment'?Math.floor((e.clientY-ael.getBoundingClientRect().top)/ppm()/day().step)*day().step:0,pointerId:e.pointerId};lastPointer={x:e.clientX,y:e.clientY};
  }else if(e.target.matches('[data-lane]'))select('day');
});
document.addEventListener('pointermove',e=>{if(!drag)return;lastPointer={x:e.clientX,y:e.clientY};if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5){drag.active=true;document.body.classList.add('dragging');dragFrame=requestAnimationFrame(dragTick);}if(drag.active){e.preventDefault();updatePreview();}},{passive:false});
function calculateDrag(){if(!drag)return null;const d=day(),location=pointerLocation(lastPointer.x,lastPointer.y,true),o=drag.original;if(!location)return null;
  let next;if(drag.type==='procedure')next=makeAppointment(o,location.patientId,clampedDropStart(d,location.minute,durationFor(o,d),durationFor(o,d)/2));else if(drag.resize){next={...o};const delta=Math.round((lastPointer.y-drag.startY)/ppm()/d.step)*d.step;if(drag.resize==='bottom')next.duration=Math.min(1440-o.start,Math.max(d.step,o.duration+delta));else{const start=Math.max(d.start,Math.min(o.start+o.duration-d.step,o.start+delta));next.start=start;next.duration=o.start+o.duration-start;}}else next={...o,patientId:location.patientId,start:clampedDropStart(d,location.minute,o.duration,drag.offset)};
  return {next,location,error:validatePlacement(d,next)};
}
function updatePreview(){const p=document.querySelector('#drag-preview');if(drag?.type==='column'){updateColumnDrag();p.hidden=true;return;}if(updateLibraryReorder()){p.hidden=true;return;}const result=calculateDrag();if(!result){p.hidden=true;return;}const {next,location,error}=result,lanes=document.querySelector('#lanes').getBoundingClientRect(),scroll=document.querySelector('.schedule-scroll').getBoundingClientRect();const x=lanes.left+location.col.x+4,width=location.col.width-8;const y=lanes.top+(next.start-day().start)*ppm();p.hidden=false;p.className='';p.style.cssText=`left:${x}px;top:${y}px;width:${width}px;height:${Math.max(10,next.duration*ppm())}px;background:${next.color};color:${next.textColor||'#53616b'}`;p.innerHTML=`<span class="drag-tooltip">${hm(next.start)}–${hm(next.start+next.duration)} · ${next.duration} мин${error?' · '+esc(error):''}</span><span>${esc(next.text||next.name)}</span>`;}
function dragTick(){if(!drag?.active)return;if(drag.reorderTo!=null){const list=document.querySelector('.procedure-list');if(list){const box=list.getBoundingClientRect();list.scrollLeft+=lastPointer.x>box.right-36?8:lastPointer.x<box.left+36?-8:0;}}let scroll=document.querySelector('.schedule-scroll');if(drag.type==='column'){const box=scroll.getBoundingClientRect();scroll.scrollLeft+=lastPointer.x>box.right-36?10:lastPointer.x<box.left+TIME_GUTTER+36?-10:0;}const delta=dragScrollDelta(drag,lastPointer,scroll.getBoundingClientRect(),TIME_GUTTER);if(delta.y>0&&scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<30&&day().end<1440){day().end=Math.min(1440,day().end+60);render();scroll=document.querySelector('.schedule-scroll');}scroll.scrollTop+=delta.y;scroll.scrollLeft+=delta.x;updatePreview();dragFrame=requestAnimationFrame(dragTick);}
function stopDrag(cancel=false){if(!drag)return;const current=drag,result=current.active&&current.reorderTo==null&&current.type!=='column'?calculateDrag():null;drag=null;cancelAnimationFrame(dragFrame);document.body.classList.remove('dragging');document.querySelector('#drag-preview').hidden=true;if(current.type==='column'){finishColumnDrag(current,cancel);return;}if(cancel){if(current.reorder)clearReorder();return;}if(current.reorderTo!=null){finishLibraryReorder(current.id,current.reorder.from,current.reorderTo);return;}if(current.reorder)clearReorder();
  if(!current.active){select(current.type,current.id);return;}if(!result)return;if(result.error){toast(result.error,true);return;}const {next}=result;ui.selection={type:current.type==='procedure'?'appointment':current.type,id:next.id};transact(()=>{if(current.type==='procedure')day().appointments.push(next);else if(current.type==='appointment')Object.assign(day().appointments.find(a=>a.id===next.id),next);});
}
document.addEventListener('pointerup',e=>{const press=instructorPress;instructorPress=null;if(press&&e.pointerId===press.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<=5&&project.instructors.some(i=>i.id===press.id))select('instructor',press.id);stopDrag();});document.addEventListener('pointercancel',()=>{instructorPress=null;stopDrag(true);});window.addEventListener('blur',()=>{instructorPress=null;if(drag)stopDrag(true);});
render();if(loadError)toast(loadError,true);else{persist();if(loadWarning)toast(loadWarning);}

function instructorName(id){return project.instructors.find(i=>i.id===id)?.name||'Не выбран';}
function directoryTabs(){return `<div class="sidebar-tabs directory-tabs" role="tablist" aria-label="Справочники"><button type="button" role="tab" aria-selected="${ui.sidebarTab==='patients'}" class="${ui.sidebarTab==='patients'?'active':''}" data-action="sidebar-tab" data-tab="patients">Пациенты</button><button type="button" role="tab" aria-selected="${ui.sidebarTab==='instructors'}" class="${ui.sidebarTab==='instructors'?'active':''}" data-action="sidebar-tab" data-tab="instructors">Инструктора</button></div>`;}
function instructorsSidebar(){const list=project.instructors.filter(i=>i.name.toLowerCase().includes(ui.instructorSearch.toLowerCase()));return `<div class="sidebar-inner">${staySelector()}${directoryTabs()}<div class="side-title"><h2>Инструктора <span class="count">${project.instructors.length}</span></h2>${ib('add-instructor','Добавить инструктора','plus')}</div><div class="search">${icon('search')}<input id="instructor-search" aria-label="Поиск инструкторов" placeholder="Найти инструктора" value="${esc(ui.instructorSearch)}" data-plain-text></div><div class="patient-list instructor-list">${list.map(i=>`<div class="patient-item ${ui.selection.type==='instructor'&&ui.selection.id===i.id?'selected':''}" data-action="select-instructor" data-id="${i.id}" data-instructor-row="${i.id}"><button type="button" class="patient-select instructor-select" data-action="select-instructor" data-id="${i.id}"><div class="patient-details"><div class="patient-name">${esc(i.name)}</div></div></button>${button('remove-instructor','','trash','icon-btn patient-trash',`data-id="${i.id}" title="Удалить инструктора" aria-label="Удалить инструктора"`)}</div>`).join('')||'<div class="inspector-empty">Инструктора не найдены</div>'}</div><div class="side-bottom">${button('batch-instructors','Добавить списком','users','btn ghost')}</div></div>`;}
function instructorForm(batch=false){
  openModal(batch?'Добавить инструкторов списком':'Новый инструктор',`<form id="instructor-form" class="modal-body"><label class="field"><span class="field-label">${batch?'ФИО — по одному в строке':'ФИО'}</span>${batch?'<textarea name="names" rows="7" required data-plain-text autofocus></textarea>':'<input name="name" type="text" required maxlength="140" placeholder="Фамилия Имя Отчество" data-plain-text autofocus>'}</label><div id="modal-error" class="error-text"></div></form>`,`${button('close-modal','Отмена')}<button type="submit" form="instructor-form" class="btn primary">Добавить</button>`);
  modal.querySelector('form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),names=String(data.get(batch?'names':'name')).split(/\r?\n/).map(name=>name.trim()).filter(Boolean);if(!names.length||names.length>200||names.some(name=>name.length>140)){modal.querySelector('#modal-error').textContent='Укажите от 1 до 200 ФИО, не более 140 символов каждое';return;}const added=names.map(name=>({id:uid(),name}));modal.close();ui.sidebarTab='instructors';ui.selection={type:'instructor',id:added[0].id};transact(()=>project.instructors.push(...added));};
}
function requestInstructorRemoval(id){const instructor=project.instructors.find(i=>i.id===id);if(!instructor)return;confirmAction('Удалить инструктора?',`${esc(instructor.name)}. Назначения этого инструктора будут сняты с заготовок и процедур. Сами процедуры сохранятся.`,'Удалить',()=>{ui.selection={type:'day'};transact(()=>removeInstructor(project,id));});}
function procedureInstructorsField(o){
  const list=o.instructors||[];
  const rows=list.map((w,i)=>{
    const used=new Set(list.filter((_,j)=>j!==i).map(x=>x.instructorId));
    const options=project.instructors.filter(x=>!used.has(x.id)).map(x=>`<option value="${x.id}" ${x.id===w.instructorId?'selected':''}>${esc(x.name)}</option>`).join('');
    return `<div class="proc-instructor"><select data-proc-instructor="${i}" aria-label="Инструктор ${i+1}">${options}</select><div class="proc-instructor-color"><input type="color" data-proc-instructor-color="${i}" value="${esc(i===0?o.color:w.color)}" aria-label="Цвет инструктора"></div>${button('remove-proc-instructor','','trash','icon-btn',`data-index="${i}" title="Убрать инструктора" aria-label="Убрать инструктора"`)}</div>`;
  }).join('');
  return `<div class="field proc-instructors"><div class="proc-instructors-head"><span class="field-label">Инструкторы</span>${ib('add-proc-instructor','Добавить инструктора','plus')}</div>${rows}</div>`;
}
function changeProcedureInstructors(next){transact(()=>updateProcedureTemplate(project,ui.date,ui.selection.id,{instructors:next},{applyToDay:ui.applyProcedureToDay}));}
function addProcedureInstructor(){
  const o=getSelection(),list=o.instructors||[];
  if(!project.instructors.length){toast('Сначала добавьте инструктора на вкладке «Инструктора»',true);return;}
  const free=project.instructors.find(x=>!list.some(w=>w.instructorId===x.id));
  if(!free){toast('Все инструкторы уже добавлены',true);return;}
  changeProcedureInstructors([...clone(list),{instructorId:free.id,color:o.color}]);
}
function removeProcedureInstructor(index){
  const o=getSelection(),next=clone(o.instructors||[]);next.splice(index,1);
  if(index===0&&next[0])next[0].color=o.color;
  changeProcedureInstructors(next);
}
const AUTOFILL_HELP={
  day:['Режим и время',[
    '<b>Весь набор</b> заменяет все назначения дня без замочка у включённых пациентов.',
    '<b>На свободное место</b> ставит только отмеченные процедуры. Их прежние назначения без замочка переставляются, все остальные остаются и занимают время. У этого режима свои галочки.',
    '<b>Начало</b> — раньше этого времени ничего не ставится.',
    '<b>Конец дня</b> берётся из настроек дня в инспекторе, там же он меняется. Это ориентир: что не помещается, уходит позже него, но не дальше 24:00. В таблице он отмечен полоской, на PNG её нет.',
    '<b>Слот</b> — шаг для процедур «по сетке». При 60 минутах это 09:00, 10:00 и так далее.',
    '<b>Не ставить на</b> — периоды дня, на которые нельзя ставить процедуры. После такого периода слоты считаются заново, например с 13:30.'
  ]],
  procedures:['Процедуры',[
    '<b>Оценка нагрузки</b> сверху и под названием процедуры считает сеансы до запуска: сколько нужно и сколько помещается. Это прикидка, точный результат покажет составление.',
    '<b>Галочка у названия</b> — процедура будет в этот день у всех включённых пациентов.',
    '<b>Инструктора</b> — галочка значит, что инструктор сегодня работает. Несколько инструкторов работают параллельно, а пациенту нужна одна такая процедура.',
    '<b>С и до</b> — время инструктора на этой процедуре, например массаж до 14:00, АФК после. Что не помещается в заданное «до», не ставится и попадает в итог. Пустое поле — без ограничения.',
    'Инструктор не возвращается к прежней процедуре. Порядок задают поля «с» и «до», без них его выбирает генератор.',
    '<b>Мин</b> — длительность из библиотеки процедур.',
    '<b>Макс.</b> — сколько пациентов может быть на этой процедуре одновременно у всех инструкторов, например 2, если кушеток две. Остальных генератор поставит на другое время или процедуру. Пустое поле — без ограничения.',
    '<b>По сетке</b> — старт только на слотах. Без галочки — любое время по шагу сетки с указанным перерывом. Галочка в заголовке включает или снимает сетку у всех.',
    '<b>Пациенты</b>: «Поодиночке» — один пациент у инструктора. «Совместно» — любые пациенты, до указанного числа. «По группам» — только с одинаковым номером в выбранной группе.'
  ]],
  links:['Связки',[
    'Связка ставит две процедуры подряд в любом порядке, например АФК · кушетка и АФК · тренажёр.',
    'Обе идут у одного инструктора и не разрываются периодом «Не ставить на».',
    'Связка работает, когда отмечены обе процедуры. В режиме «На свободное место» вторая добавляется сама.',
    '<b>Инструктор может вести обе сразу</b> — один инструктор одновременно ведёт разных пациентов: одного на кушетке, другого на тренажёре.',
    'Если одна половина закреплена замочком, вторая ставится рядом. Если рядом нет места, итог об этом сообщит.',
    'Процедура может входить только в одну связку. Связки общие для всех дней недели этого расписания.'
  ]],
  groups:['Группы пациентов',[
    'Группа — это набор номеров. Пациенты с одинаковым номером могут идти на процедуру вместе, с разными — нет. Без номера пациент идёт один.',
    'Группа действует только на процедуры с режимом «По группам», у которых она выбрана в строке.',
    'Один и тот же пациент может иметь разные номера в разных группах: вместе на спорт, но отдельно на эрготерапию.',
    '«Общая» есть всегда. Плюсик добавляет новую группу, название можно поменять, корзинка её удаляет.',
    'Одинаковый номер разрешает идти вместе, но не обязывает: если раздельно день заканчивается раньше, генератор поставит раздельно.',
    'Группы общие для всех дней недели этого расписания.'
  ]]
};
function autofillHelp(key){const [title,lines]=AUTOFILL_HELP[key],id=`af-help-${key}`;return `<button type="button" class="af-help" popovertarget="${id}" title="Подсказка: ${title}" aria-label="Подсказка: ${title}">${icon('info')}</button><div popover id="${id}" class="af-help-popup" role="tooltip"><strong>${title}</strong><ul>${lines.map(line=>`<li>${line}</li>`).join('')}</ul></div>`;}
function positionAutofillHelp(container){
  for(const button of container.querySelectorAll('.af-help[popovertarget]')){
    const popup=container.querySelector(`#${button.getAttribute('popovertarget')}`);
    popup.addEventListener('toggle',e=>{
      if(e.newState!=='open')return;
      const r=button.getBoundingClientRect(),h=popup.offsetHeight,w=popup.offsetWidth;
      popup.style.left=`${Math.max(8,Math.min(r.left,innerWidth-w-8))}px`;
      popup.style.top=`${Math.max(8,r.bottom+h+6<=innerHeight?r.bottom+6:Math.min(r.top-h-6,innerHeight-h-8))}px`;
    });
  }
}
function autofillStore(){const stay=project.stays.find(s=>s.id===project.currentStayId),store=stay.autofill||emptyAutofill(),keys=new Set(procedurePools(project.procedures).map(p=>p.key));return {...store,...normalizeGroups(store),links:(store.links||[]).filter(l=>keys.has(l.a)&&keys.has(l.b))};}
function autofillReady(){if(!visibleColumns(day()).length){toast('Сначала включите пациентов в этом дне',true);return false;}if(!project.procedures.length){toast('Сначала создайте вид процедуры',true);return false;}return true;}
function refreshAutofillEstimate(form,draft){
  const box=form.querySelector('#af-estimate');if(!box)return;
  const load=estimateLoad({procedures:project.procedures,day:day(),settings:draft.settings,links:draft.links,groupList:draft.groupList});
  for(const el of form.querySelectorAll('.af-row[data-row]')){
    const note=el.querySelector('[data-note]'),row=load?.rows[el.dataset.row];
    note.className=`af-note ${row?.status||''}`;
    note.textContent=!row?'':!row.needed?'уже поставлено':row.cause?'':row.fit===null?`нужно ${row.needed}`:`нужно ${row.needed} · помещается ${row.fit}`;
  }
  if(!load){box.className='af-estimate';box.textContent='Оценка появится, когда настройки будут заполнены верно.';return;}
  const lines=describeLoad(load,instructorName);
  box.className=`af-estimate ${load.status}`;
  box.innerHTML=lines.length?`<strong>Оценка нагрузки</strong><ul>${lines.map(line=>`<li class="${line.status}">${esc(line.text)}</li>`).join('')}</ul>`:'<strong>Оценка нагрузки</strong><span>Всё должно поместиться в рабочий день.</span>';
}
function autofillDialog(){
  if(!autofillReady())return;
  const store=autofillStore(),draft={settings:resolveSettings(store,ui.date,project.procedures,day().bands).settings,links:clone(store.links),groupList:clone(store.groupList)};
  const show=()=>{const y=modal.querySelector('.autofill-body')?.scrollTop||0;openModal(`Автозаполнение расписания<button type="button" class="af-help" data-af-tutorial title="Как пользоваться автозаполнением" aria-label="Как пользоваться автозаполнением">${icon('info')}</button>`,autofillBody(draft),`${button('close-modal','Отмена')}<button type="submit" form="autofill-form" class="btn primary">Составить</button>`,'autofill-dialog');modal.querySelector('.autofill-body').scrollTop=y;positionAutofillHelp(modal);document.activeElement?.blur?.();bind();};
  const bind=()=>{
    modal.querySelector('[data-af-tutorial]').onclick=()=>{readAutofillForm(modal.querySelector('#autofill-form'),draft);showAutofillTutorial(show);};
    const form=modal.querySelector('#autofill-form'),all=form.querySelector('#af-grid-all'),rows=Object.values(draft.settings.rows),grids=rows.filter(r=>r.grid).length;
    all.checked=grids===rows.length;all.indeterminate=grids>0&&grids<rows.length;
    refreshAutofillEstimate(form,draft);
    form.oninput=()=>{readAutofillForm(form,draft);refreshAutofillEstimate(form,draft);};
    form.onchange=e=>{const el=e.target;readAutofillForm(form,draft);if(el===all){for(const row of rows)row.grid=el.checked;show();}else if(el.matches('[name=mode],[data-grid],[data-together],[data-group-name]'))show();else refreshAutofillEstimate(form,draft);};
    form.onclick=e=>{
      const addLink=e.target.closest('[data-af-add-link]'),removeLink=e.target.closest('[data-af-remove-link]'),addGroup=e.target.closest('[data-af-add-group]'),removeGroup=e.target.closest('[data-af-remove-group]');
      if(!addLink&&!removeLink&&!addGroup&&!removeGroup)return;
      e.preventDefault();readAutofillForm(form,draft);
      if(addLink){const pools=procedurePools(project.procedures);draft.links.push({a:pools[0].key,b:pools[1].key,simultaneous:false});}
      if(removeLink)draft.links.splice(Number(removeLink.dataset.afRemoveLink),1);
      if(addGroup)draft.groupList.push({id:uid(),name:`Группа ${draft.groupList.length}`,values:{}});
      if(removeGroup){const id=removeGroup.dataset.afRemoveGroup;draft.groupList=draft.groupList.filter(g=>g.id!==id);for(const row of Object.values(draft.settings.rows))if(row.groupId===id)row.groupId=COMMON_GROUP;}
      show();
    };
    form.onsubmit=e=>{
      e.preventDefault();readAutofillForm(form,draft);
      const errors=checkSettings(draft.settings,project.procedures,day(),draft.links);
      if(draft.groupList.some(g=>!g.name))errors.push('Укажите название каждой группы');
      if(draft.groupList.some(g=>Object.values(g.values).some(n=>!Number.isInteger(n)||n<1)))errors.push('Номер в группе — целое число от 1');
      if(errors.length){form.querySelector('#modal-error').textContent=errors[0];return;}
      const stay=project.stays.find(s=>s.id===project.currentStayId);
      stay.autofill=saveWeekdaySettings(stay.autofill,ui.date,draft.settings,draft.links,draft.groupList);
      persist();modal.close();runAutofill(draft.settings,draft.links,draft.groupList);
    };
  };
  show();
}
function autofillBody({settings:s,links,groupList}){
  const d=day(),pools=procedurePools(project.procedures),partial=s.mode==='partial',bandNames=[...new Set(d.bands.map(b=>b.name))];
  const number=(attr,value,min,max,step,label)=>`<input class="af-input af-number" type="number" ${attr} value="${esc(value)}" min="${min}" max="${max}" step="${step}" aria-label="${label}">`;
  const clock=(attr,value,label)=>`<input class="af-input af-clock" type="time" data-time-clearable ${attr} value="${esc(value)}" placeholder="—" aria-label="${label}">`;
  const rows=pools.map(pool=>{
    const row=s.rows[pool.key],picked=partial?s.partialKeys.includes(pool.key):row.enabled,durations=[...new Set(pool.templates.map(t=>durationFor(t.procedure,d)))];
    const instructors=pool.templates.map(t=>{const work=s.instructors[t.work];return `<div class="af-work" data-work="${t.work}"><label><input type="checkbox" data-work-on ${work.enabled!==false?'checked':''}><span>${t.instructorId?esc(instructorName(t.instructorId)):'Без инструктора'}</span></label><span class="af-window">с ${clock('data-work-from',work.from,'Начало работы')} до ${clock('data-work-to',work.to,'Конец работы')}</span></div>`;}).join('');
    return `<div class="af-row" data-row="${esc(pool.key)}"><div class="af-name-cell"><label class="af-name"><input type="checkbox" data-pick ${picked?'checked':''}><strong>${esc(pool.name)}</strong></label><small class="af-note" data-note></small></div><div>${instructors}</div><span class="af-minutes">${durations.join(', ')}</span><div class="af-limit">${number('data-limit',row.limit??'',1,500,1,'Максимум одновременно')}</div><div class="af-grid-cell"><input type="checkbox" data-grid ${row.grid?'checked':''} aria-label="По сетке">${row.grid?'':`<label>перерыв ${number('data-gap',row.gap,0,240,d.step,'Перерыв, минут')}</label>`}</div><div class="af-together"><select class="af-input" data-together aria-label="Пациенты"><option value="single" ${row.together==='single'?'selected':''}>Поодиночке</option><option value="any" ${row.together==='any'?'selected':''}>Совместно</option><option value="groups" ${row.together==='groups'?'selected':''}>По группам</option></select>${row.together==='groups'?`<select class="af-input" data-row-group aria-label="Группа для процедуры">${groupList.map(g=>`<option value="${g.id}" ${(row.groupId||COMMON_GROUP)===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select>`:''}${row.together==='single'?'':`<label>до ${number('data-capacity',row.capacity,2,50,1,'Пациентов одновременно')}</label>`}</div></div>`;
  }).join('');
  const options=key=>pools.map(p=>`<option value="${esc(p.key)}" ${p.key===key?'selected':''}>${esc(p.name)}</option>`).join('');
  const linkRows=links.map((l,i)=>`<div class="af-link" data-link><select class="af-input" data-link-a aria-label="Первая процедура">${options(l.a)}</select><span>+</span><select class="af-input" data-link-b aria-label="Вторая процедура">${options(l.b)}</select><label><input type="checkbox" data-link-both ${l.simultaneous?'checked':''}>Инструктор может вести обе сразу</label><button type="button" class="icon-btn" data-af-remove-link="${i}" title="Удалить связку" aria-label="Удалить связку">${icon('trash')}</button></div>`).join('')||'<p class="af-empty">Связок пока нет</p>';
  const groupHeads=groupList.map(g=>g.id===COMMON_GROUP?`<th>${esc(g.name)}</th>`:`<th><span class="af-group-head"><input class="af-input" type="text" data-plain-text data-group-name="${g.id}" value="${esc(g.name)}" maxlength="40" aria-label="Название группы"><button type="button" class="icon-btn" data-af-remove-group="${g.id}" title="Удалить группу" aria-label="Удалить группу">${icon('trash')}</button></span></th>`).join('');
  const patientRows=project.patients.filter(p=>!p.archived).sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(p=>`<tr><td>${esc(p.name)}</td>${groupList.map(g=>`<td><input class="af-input af-number" type="number" min="1" step="1" data-group-value="${g.id}" data-patient="${p.id}" value="${esc(g.values[p.id]??'')}" aria-label="${esc(g.name)}: ${esc(p.name)}"></td>`).join('')}</tr>`).join('');
  const head=(title,key,action='')=>`<div class="af-card-head"><div class="af-card-title"><h3>${title}</h3>${autofillHelp(key)}</div>${action}</div>`;
  return `<form id="autofill-form" class="modal-body autofill-body" data-shown-mode="${s.mode}" novalidate>
    <section class="af-card">${head(esc(dateLabel(ui.date)),'day')}
      <div class="af-modes"><label><input type="radio" name="mode" value="full" ${partial?'':'checked'}><span>Весь набор</span></label><label><input type="radio" name="mode" value="partial" ${partial?'checked':''}><span>На свободное место</span></label></div>
      <div class="af-general"><label class="af-field"><span>Начало</span><input class="af-input af-clock" type="time" name="start" value="${esc(Number.isInteger(s.start)?hm(s.start):'')}"></label><div class="af-field" title="Меняется в настройках дня в инспекторе"><span>Конец дня</span><span class="af-readonly">${hm(workdayEnd(d))}</span></div><label class="af-field"><span>Слот, мин</span>${number('name="slot"',s.slot,d.step,480,d.step,'Длина слота')}</label>${bandNames.length?`<div class="af-field af-bands"><span>Не ставить на</span><div>${bandNames.map(n=>`<label><input type="checkbox" data-band-name="${esc(n)}" ${s.blockedBands[n]?'checked':''}>${esc(n)}</label>`).join('')}</div></div>`:''}</div>
    </section>
    <section class="af-card">${head('Процедуры','procedures')}
      <div id="af-estimate" class="af-estimate" aria-live="polite"></div>
      <div class="af-table"><div class="af-row af-head"><span>Процедура</span><span>Инструктора</span><span>Мин</span><span title="Максимум пациентов на этой процедуре одновременно у всех инструкторов">Макс.</span><label class="af-grid-all"><input type="checkbox" id="af-grid-all">По сетке</label><span>Пациенты</span></div>${rows}</div>
    </section>
    <section class="af-card">${head('Связки','links',`<button type="button" class="icon-btn" data-af-add-link title="Добавить связку" aria-label="Добавить связку" ${pools.length<2?'disabled':''}>${icon('plus')}</button>`)}${linkRows}</section>
    <section class="af-card">${head('Группы пациентов','groups',`<button type="button" class="icon-btn" data-af-add-group title="Добавить группу" aria-label="Добавить группу">${icon('plus')}</button>`)}
      <div class="af-matrix"><table><thead><tr><th>Пациент</th>${groupHeads}</tr></thead><tbody>${patientRows}</tbody></table></div>
    </section>
    <div id="modal-error" class="error-text"></div></form>`;
}
function readAutofillForm(form,draft){
  const s=draft.settings,value=name=>form.querySelector(`[name=${name}]`).value,shown=form.dataset.shownMode;
  s.mode=form.querySelector('[name=mode]:checked').value;s.start=minutes(value('start'));s.slot=Number(value('slot'));
  for(const el of form.querySelectorAll('[data-band-name]'))s.blockedBands[el.dataset.bandName]=el.checked;
  const picked=[];
  for(const el of form.querySelectorAll('.af-row[data-row]')){
    const key=el.dataset.row,row=s.rows[key],pick=el.querySelector('[data-pick]').checked;
    if(shown==='full')row.enabled=pick;else if(pick)picked.push(key);
    row.grid=el.querySelector('[data-grid]').checked;row.together=el.querySelector('[data-together]').value;
    const gap=el.querySelector('[data-gap]'),capacity=el.querySelector('[data-capacity]');if(gap)row.gap=Number(gap.value);if(capacity)row.capacity=Number(capacity.value);const limit=el.querySelector('[data-limit]').value;row.limit=limit===''?null:Number(limit);
    for(const work of el.querySelectorAll('[data-work]'))s.instructors[work.dataset.work]={enabled:work.querySelector('[data-work-on]').checked,from:work.querySelector('[data-work-from]').value.trim(),to:work.querySelector('[data-work-to]').value.trim()};
  }
  if(shown==='partial')s.partialKeys=picked;
  draft.links=[...form.querySelectorAll('[data-link]')].map(el=>({a:el.querySelector('[data-link-a]').value,b:el.querySelector('[data-link-b]').value,simultaneous:el.querySelector('[data-link-both]').checked}));
  for(const el of form.querySelectorAll('[data-row-group]'))s.rows[el.closest('[data-row]').dataset.row].groupId=el.value;
  for(const group of draft.groupList){
    const name=form.querySelector(`[data-group-name="${group.id}"]`);if(name)group.name=name.value.trim();
    group.values=Object.fromEntries([...form.querySelectorAll(`[data-group-value="${group.id}"]`)].filter(el=>el.value!=='').map(el=>[el.dataset.patient,Number(el.value)]));
  }
}
function repeatAutofill(){
  if(!autofillReady())return;
  const store=autofillStore(),{settings,saved}=resolveSettings(store,ui.date,project.procedures,day().bands);
  if(!saved){autofillDialog();return;}
  const errors=checkSettings(settings,project.procedures,day(),store.links);
  if(errors.length){toast(errors[0],true);return;}
  runAutofill(settings,store.links,store.groupList);
}
function runAutofill(settings,links,groupList){
  const plan=planDay({procedures:project.procedures,day:day(),settings,links,groupList,budgetMs:500}),removed=new Set(plan.remove);
  const success=transact(()=>{const d=day();d.appointments=d.appointments.filter(a=>!removed.has(a.id));for(const item of plan.place)d.appointments.push(makeAppointment(project.procedures.find(p=>p.id===item.procedureId),item.patientId,item.start,item.instructorId));expandDayCanvas(d);ui.selection={type:'day'};});
  if(success)showAutofillReport(plan.report,settings);
}
function showAutofillReport(report,settings){
  const summary=`Поставлено ${report.placed} из ${report.total}${report.overtime?`. После ${hm(workdayEnd(day()))}: ${report.overtime}`:''}`;
  if(!report.unplaced.length&&!report.broken.length&&!report.lockedReturns.length){toast(summary);return;}
  const patient=id=>esc(project.patients.find(p=>p.id===id)?.name||'Пациент');
  const groups=new Map();
  for(const item of report.unplaced){
    const {text,hint}=describeCause(item,instructorName),id=item.name+'|'+text;
    if(!groups.has(id))groups.set(id,{name:item.name,text,hint,patients:[]});
    groups.get(id).patients.push(item.patientId);
  }
  const list=(title,items)=>items.length?`<h3 class="af-report-title">${title}</h3><ul class="af-report">${items.map(item=>`<li>${item}</li>`).join('')}</ul>`:'';
  const causes=[...groups.values()].map(g=>`<b>${esc(g.name)}</b>: ${esc(g.text)}.<div class="af-report-patients">${g.patients.map(patient).join(', ')}</div><div class="af-report-hint">${esc(g.hint)}</div>`);
  openModal('Итог автозаполнения',`<div class="modal-body"><p>${esc(summary)}.</p>${list('Не поставлено',causes)}${list('Связка не рядом',report.broken.map(b=>`${patient(b.patientId)} — ${esc(b.name)}`))}${list('Замочки: инструктор возвращается к прежней процедуре',report.lockedReturns.map(id=>esc(instructorName(id))))}</div>`);
}
