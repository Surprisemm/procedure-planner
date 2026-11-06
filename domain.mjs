import {FONTS} from './presentation.mjs';
export const uid = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);
export const TIME_GUTTER=112;
// Suppress an entire time label and its tick when its box touches a period's
// clearance area. Geometry is in rendered pixels, so this also follows zoom.
export function timeMarkIsClear(time,bands,pixelsPerMinute,halfHeight=10,clearance=2){
  const reach=halfHeight+clearance;
  return !bands.some(b=>(b.start-time)*pixelsPerMinute<=reach&&(b.start+b.duration-time)*pixelsPerMinute>=-reach);
}
export const hm = m => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
export function minutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h,m] = value.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : NaN;
}
export const overlaps = (a,b) => a.start < b.start + b.duration && b.start < a.start + a.duration;
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const calendarTime=date=>{const time=Date.parse(`${date}T12:00:00Z`);assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date,'Укажите корректную дату');return time;};
export function addCalendarDays(date,count){const result=new Date(calendarTime(date)+count*86400000).toISOString().slice(0,10);calendarTime(result);return result;}
export function stayDates(startDate,endDate=addCalendarDays(startDate,27)){
  const start=calendarTime(startDate),end=calendarTime(endDate);assert(end>=start,'Дата окончания не может быть раньше даты начала');
  return Array.from({length:(end-start)/86400000+1},(_,i)=>addCalendarDays(startDate,i));
}
// A procedure that does not fit the grid step could never be placed on the schedule.
export function procedureDurationError(value,step){
  if(!Number.isInteger(value)||value<step||value>480)return `Укажите длительность от ${step} до 480 минут`;
  return value%step?`Длительность должна быть кратна шагу сетки: ${step} мин`:null;
}
export function durationFor(procedure, day) {
  return procedure.duration || 55;
}
export const workKey=(procedureId,instructorId)=>`${procedureId}:${instructorId||''}`;
// The first instructor uses the procedure's own colour; the others have their own.
export function instructorColor(procedure,instructorId){
  const list=procedure.instructors||[],index=list.findIndex(x=>x.instructorId===instructorId);
  return index>0?list[index].color:procedure.color;
}
// One library card per procedure: older projects kept a copy of a procedure for
// each instructor. Merge those by name and keep each copy's colour for its instructor.
export function upgradeProcedureInstructors(p){
  if(p.procedures.every(x=>Array.isArray(x.instructors)))return p;
  const merged=new Map(),result=[],moved=new Map();
  for(const procedure of p.procedures){
    const key=procedure.name.trim().toLowerCase(),instructorId=procedure.instructorId||null;
    delete procedure.instructorId;
    let target=merged.get(key);
    if(!target){target=procedure;target.instructors=[];merged.set(key,target);result.push(target);}
    moved.set(procedure.id,{id:target.id,instructorId});
    if(!instructorId||target.instructors.some(x=>x.instructorId===instructorId))continue;
    target.instructors.push({instructorId,color:target.instructors.length?procedure.color:target.color});
  }
  p.procedures=result;
  for(const schedule of [p,...(p.stays||[])]){
    for(const d of Object.values(schedule.days||{}))for(const a of d.appointments)if(moved.has(a.procedureId))a.procedureId=moved.get(a.procedureId).id;
    for(const settings of Object.values(schedule.autofill?.weekdays||{})){
      const work={};
      for(const [id,value] of Object.entries(settings.instructors||{})){const place=moved.get(id);work[place?workKey(place.id,place.instructorId):id]=value;}
      settings.instructors=work;
    }
  }
  return p;
}
export function updateProcedureTemplate(project,date,id,patch,{applyToDay=false}={}){
  const procedure=project.procedures.find(p=>p.id===id);
  assert(procedure,'Вид процедуры не найден');
  const d=project.days[date];assert(d,'День не найден');
  const appointments=applyToDay?d.appointments.filter(a=>a.procedureId===id):[];
  const changes={};
  for(const key of ['textColor','duration'])if(Object.hasOwn(patch,key))changes[key]=patch[key];
  if(Object.hasOwn(patch,'name'))changes.text=patch.name;
  if(patch.textStyles?.name){
    changes.textStyles={text:clone(patch.textStyles.name)};
    for(const key of ['fontFamily','fontSize','bold','italic'])if(Object.hasOwn(patch.textStyles.name,key))changes[key]=patch.textStyles.name[key];
  }
  // Check every affected assignment before changing the template or any copy.
  if(Object.hasOwn(changes,'duration'))for(const a of appointments){
    const error=validatePlacement({...d,disabledPatientIds:[]},{...a,duration:changes.duration});
    assert(!error,error);
  }
  Object.assign(procedure,clone(patch));
  if(Object.hasOwn(patch,'color')&&procedure.instructors?.[0])procedure.instructors[0].color=patch.color;
  for(const a of appointments){
    const styles=a.textStyles;
    Object.assign(a,clone(changes));
    if(changes.textStyles)a.textStyles={...styles,...a.textStyles};
    if(Object.hasOwn(patch,'instructors')&&!procedure.instructors.some(x=>x.instructorId===a.instructorId))a.instructorId=procedure.instructors[0]?.instructorId??null;
    if(Object.hasOwn(patch,'color')||Object.hasOwn(patch,'instructors'))a.color=instructorColor(procedure,a.instructorId);
  }
  if(appointments.length)expandDayCanvas(d);
  return appointments.length;
}
export function makeDay(date, patients = []) {
  return { date, start:540, end:1050, step:5, defaultDuration:55,
    columns:patients.filter(p=>!p.archived).map(p=>({ patientId:p.id, name:p.name, house:p.house, width:144, color:'#f8fafb', headerColor:'#ffffff' })),
    appointments:[], cells:[], disabledPatientIds:[], bands:[
      {id:uid(), name:'Обед', start:780, duration:30, color:'#edf0f3'}
    ] };
}
export function newProject(demo = true) {
  const names=['Анна Соколова','Михаил Волков','Елена Орлова','Александр Морозов','Мария Лебедева','Дмитрий Козлов','Ольга Новикова','Андрей Павлов','Ирина Смирнова','Сергей Белов'];
  const patients = demo ? names.map((name,i)=>({id:uid(),name,house:String(1+Math.floor(i/2)),archived:false})) : [];
  const procedures = [
    ['Массаж','#f7df88'],['Физиотерапия','#bddcc2'],['Эрготерапия','#f3b5ac'],['Спорт','#a8d9ee'],['АФК · кушетка','#d7cef0'],['АФК · тренажёр','#d8dfe8']
  ].map(([name,color])=>({id:uid(),name,color,textColor:'#26332f',duration:55,note:'',instructors:[]}));
  const date=localDate(); const day=makeDay(date,patients);
  if (demo) patients.forEach((p,i)=>{
    [0,1,2].forEach((_,j)=>{
      const proc=procedures[(i+j)%procedures.length];
      const start=540+j*65+(i%3)*5;
      day.appointments.push({id:uid(),patientId:p.id,procedureId:proc.id,start,duration:durationFor(proc,day),text:proc.name,color:proc.color,textColor:proc.textColor,fontSize:12,bold:false,align:'center',status:'planned',note:''});
    });
    if(i%2===0) { const proc=procedures[(i+3)%6];day.appointments.push({id:uid(),patientId:p.id,procedureId:proc.id,start:835+(i%3)*10,duration:durationFor(proc,day),text:proc.name,color:proc.color,textColor:proc.textColor,fontSize:12,align:'center',status:'planned',note:''}); }
  });
  return {version:1,defaultsVersion:2,demo,patients,procedures,instructors:[],days:{[date]:day}};
}
// Upgrade only the previous built-in lunch time; keep manually added periods and custom times.
export function upgradeDefaultPeriods(project){
  if(project.defaultsVersion>=2)return project;
  for(const schedule of [...Object.values(project.days),...Object.values(project.templates||{})]){
    for(const band of schedule.bands){if(band.name==='Обед'&&band.start===790&&band.duration===30&&band.color==='#edf0f3')band.start=780;}
  }
  project.defaultsVersion=2;
  return project;
}
export function issuesFor(){return [];}
export function expandDayCanvas(day){
  const blocks=[...day.appointments,...day.bands];
  day.start=Math.max(0,Math.min(day.start,...blocks.map(b=>b.start)));
  day.end=Math.min(1440,Math.max(day.end,...blocks.map(b=>b.start+b.duration)));
  return day;
}
export function clampedDropStart(day,minute,duration,offset=0){return Math.max(day.start,Math.min(1440-duration,Math.round((minute-offset)/day.step)*day.step));}
export function validatePlacement(day, appointment) {
  if(!isPatientEnabled(day,appointment.patientId))return 'Пациент выключен в выбранном дне. Сначала включите его в списке.';
  if(!Number.isInteger(appointment.start)||!Number.isInteger(appointment.duration)||appointment.duration<=0)return 'Укажите корректное время и положительную длительность';
  if(appointment.start%day.step || appointment.duration%day.step)return `Время и длительность должны соответствовать шагу ${day.step} мин`;
  return appointment.start<0||appointment.start+appointment.duration>1440?'Назначение должно оставаться в пределах 00:00–23:59':null;
}
// Assign side-by-side tracks to each connected cluster of overlapping appointments.
export function layoutAppointments(items) {
  const sorted=[...items].sort((a,b)=>a.start-b.start || a.id.localeCompare(b.id));
  const result=[];let group=[],end=-Infinity;
  function flush(){const tracks=[];const placed=group.map(a=>{let track=tracks.findIndex(t=>t<=a.start);if(track<0)track=tracks.length;tracks[track]=a.start+a.duration;return {...a,track};});placed.forEach(a=>result.push({...a,tracks:tracks.length}));group=[];}
  for(const item of sorted){if(item.start>=end){flush();end=-Infinity;}group.push(item);end=Math.max(end,item.start+item.duration);}flush();return result;
}
function assert(condition,message){if(!condition)throw Error(message);}
export const isPatientEnabled=(day,id)=>!(day.disabledPatientIds||[]).includes(id);
export const visibleColumns=day=>day.columns.filter(c=>isPatientEnabled(day,c.patientId));
// Default end of the exported image: the last procedure of the patients shown that day.
export function exportEndTime(day){
  const ends=day.appointments.filter(a=>isPatientEnabled(day,a.patientId)).map(a=>a.start+a.duration);
  return Math.min(1439,ends.length?Math.max(...ends):day.end);
}
export function setPatientEnabled(day,id,enabled){assert(day.columns.some(c=>c.patientId===id),'Пациент не найден');day.disabledPatientIds=[...new Set(day.disabledPatientIds||[])].filter(value=>value!==id);if(!enabled)day.disabledPatientIds.push(id);
  // Switching a patient off or on leaves the column empty for this day, locked work included.
  day.appointments=day.appointments.filter(a=>a.patientId!==id);}
// Moves a patient among the columns shown today. Patients switched off today stay in
// the list; the moved one lands next to its new visible neighbour.
export function moveVisiblePatient(project,visibleIds,id,to){
  const rest=visibleIds.filter(value=>value!==id);
  assert(project.patients.some(p=>p.id===id),'Пациент не найден');
  const patient=project.patients.find(p=>p.id===id);
  project.patients=project.patients.filter(p=>p.id!==id);
  const index=to<rest.length?project.patients.findIndex(p=>p.id===rest[to]):project.patients.findIndex(p=>p.id===rest[rest.length-1])+1;
  project.patients.splice(index<0?project.patients.length:index,0,patient);
}
export function syncSharedRoster(schedule){
  const patients=schedule.patients.filter(p=>!p.archived);
  for(const day of Object.values(schedule.days)){
    const existing=new Map(day.columns.map(c=>[c.patientId,c]));
    day.columns=patients.map(p=>({...existing.get(p.id)||{patientId:p.id,width:144,color:'#f8fafb',headerColor:'#ffffff'},name:p.name,house:p.house,...(p.textStyles?{textStyles:clone(p.textStyles)}:{})}));
    day.disabledPatientIds=(day.disabledPatientIds||[]).filter(id=>patients.some(p=>p.id===id));
  }
  for(const day of Object.values(schedule.days))expandDayCanvas(day);
  schedule.rosterVersion=1;return schedule;
}
function upgradeRoster(schedule){
  if(schedule.rosterVersion!==1){const used=new Set(Object.values(schedule.days).flatMap(d=>d.columns.map(c=>c.patientId)));schedule.patients.forEach(p=>{if(used.has(p.id))p.archived=false;});}
  return syncSharedRoster(schedule);
}
export function ensureStays(p){
  p.instructors??=[];upgradeProcedureInstructors(p);
  if(!p.stays){const id=uid();p.currentStayId=id;p.stays=[{id,name:p.demo?'Демонстрационное расписание':'Первое расписание'}];}
  upgradeRoster(p);
  for(const schedule of p.stays){if(schedule.name==='Первый заезд')schedule.name='Первое расписание';if(schedule.name==='Демонстрационный заезд')schedule.name='Демонстрационное расписание';if(schedule.id!==p.currentStayId)upgradeRoster(schedule);}
  return p;
}
export function removeSchedulePatient(p,id){
  const patient=p.patients.find(p=>p.id===id);assert(patient,'Пациент не найден');patient.archived=true;
  for(const day of Object.values(p.days)){day.appointments=day.appointments.filter(a=>a.patientId!==id);day.cells=day.cells.filter(c=>c.patientId!==id);}
  syncSharedRoster(p);
}
function archiveCurrentStay(p){const current=p.stays.find(s=>s.id===p.currentStayId);for(const key of ['patients','days','templates','demo','rosterVersion']){if(p[key]!==undefined)current[key]=p[key];else delete current[key];}}
export function switchStay(p,id){
  ensureStays(p);if(id===p.currentStayId)return;
  const target=p.stays.find(s=>s.id===id);assert(target,'Заезд не найден');archiveCurrentStay(p);
  for(const key of ['patients','days','templates','demo','rosterVersion']){if(target[key]!==undefined)p[key]=target[key];else delete p[key];delete target[key];}p.currentStayId=id;syncSharedRoster(p);
}
export function createStay(p,name,date,copyPatients=false,endDate=addCalendarDays(date,27)){
  ensureStays(p);assert(typeof name==='string'&&name.trim(),'Введите название заезда');
  const dates=stayDates(date,endDate);
  const patients=copyPatients?p.patients.filter(x=>!x.archived).map(x=>({...clone(x),id:uid()})):[];
  const next={id:uid(),name:name.trim(),startDate:date,endDate,viewDate:date,patients,days:Object.fromEntries(dates.map(d=>[d,makeDay(d,patients)])),demo:false,rosterVersion:1};p.stays.push(next);switchStay(p,next.id);return next.id;
}
export function removeSchedule(p,id){
  ensureStays(p);assert(p.stays.some(s=>s.id===id),'Расписание не найдено');
  if(p.stays.length===1){const date=localDate();p.stays.push({id:uid(),name:'Новое расписание',patients:[],days:{[date]:makeDay(date)},demo:false,rosterVersion:1});}
  if(p.currentStayId===id)switchStay(p,p.stays.find(s=>s.id!==id).id);
  p.stays=p.stays.filter(s=>s.id!==id);return p;
}
export function copyScheduleDay(p,sourceDate,targetDate,{appointments=false,replace=false}={}){
  assert(p.days[sourceDate],'Исходный день не найден');assert(sourceDate!==targetDate,'Выберите другой день для копии');calendarTime(targetDate);
  const target=p.days[targetDate];assert(!target||replace,'На эту дату уже есть расписание');
  const copied=clone(p.days[sourceDate]);copied.date=targetDate;copied.disabledPatientIds=target?clone(target.disabledPatientIds||[]):[];
  const hidden=new Set([...(p.days[sourceDate].disabledPatientIds||[]),...copied.disabledPatientIds]);copied.appointments=appointments?copied.appointments.filter(a=>!hidden.has(a.patientId)).map(a=>({...a,id:uid()})):[];
  copied.bands=copied.bands.map(b=>({...b,id:uid()}));copied.cells=copied.cells.map(c=>({...c,id:uid()}));p.days[targetDate]=copied;return copied;
}
export function transferAppointment(p,sourceDate,id,targetDate,move=false){
  assert(sourceDate!==targetDate,'Выберите другой день');const source=p.days[sourceDate],target=p.days[targetDate];assert(source&&target,'День не найден');
  const item=source.appointments.find(a=>a.id===id);assert(item,'Процедура не найдена');
  const next={...clone(item),id:uid()},error=validatePlacement(target,next);assert(!error,error);
  if(!target.columns.some(c=>c.patientId===item.patientId))target.columns.push(clone(source.columns.find(c=>c.patientId===item.patientId)));
  target.appointments.push(next);expandDayCanvas(target);if(move)source.appointments=source.appointments.filter(a=>a.id!==id);return next;
}
// Optional generator settings stored on a schedule; older files simply lack them.
export function validateAutofill(a){
  if(a===undefined)return;
  const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
  assert(record(a)&&Array.isArray(a.links)&&(a.groups===undefined||record(a.groups))&&record(a.weekdays),'Некорректные настройки автозаполнения');
  a.links.forEach(l=>assert(record(l)&&typeof l.a==='string'&&typeof l.b==='string'&&typeof l.simultaneous==='boolean','Некорректная связка процедур'));
  assert(Object.values(a.groups||{}).every(g=>typeof g==='string'),'Некорректная группа пациентов');
  assert(a.groupList===undefined||(Array.isArray(a.groupList)&&a.groupList.every(g=>record(g)&&typeof g.id==='string'&&typeof g.name==='string'&&(g.values===undefined||(record(g.values)&&Object.values(g.values).every(n=>Number.isInteger(n)&&n>=1))))),'Некорректный список групп');
  assert(a.lastWeekday===undefined||/^[0-6]$/.test(a.lastWeekday),'Некорректный день недели');
  for(const [weekday,s] of Object.entries(a.weekdays))assert(/^[0-6]$/.test(weekday)&&record(s)&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&Number.isInteger(s.slot)&&['full','partial'].includes(s.mode)&&Array.isArray(s.partialKeys)&&record(s.blockedBands)&&record(s.rows)&&record(s.instructors),'Некорректные настройки автозаполнения');
}
export function validateProject(p) {
  assert(p && p.version===1 && Array.isArray(p.patients) && Array.isArray(p.procedures) && p.days && typeof p.days==='object' && !Array.isArray(p.days),'Неподдерживаемый формат проекта');
  const checkIdList=(list)=>{const ids=new Set();for(const x of list){assert(x && typeof x.id==='string' && !ids.has(x.id),'Некорректные или повторяющиеся ID');ids.add(x.id);}return ids;};
  const patientIds=checkIdList(p.patients);checkIdList(p.procedures);
  assert(p.instructors===undefined||Array.isArray(p.instructors),'Некорректный список инструкторов');
  const instructorIds=checkIdList(p.instructors||[]);
  for(const i of p.instructors||[])assert(typeof i.name==='string'&&i.name.trim()&&i.name.length<=140,'Некорректная карточка инструктора');
  const checkInstructor=record=>assert(record.instructorId==null||instructorIds.has(record.instructorId),'Инструктор не найден');
  p.procedures.forEach(checkInstructor);
  for(const x of p.procedures){
    if(x.instructors===undefined)continue;
    assert(Array.isArray(x.instructors)&&new Set(x.instructors.map(w=>w?.instructorId)).size===x.instructors.length,'Некорректный список инструкторов процедуры');
    for(const w of x.instructors)assert(instructorIds.has(w.instructorId)&&/^#[0-9a-f]{6}$/i.test(w.color),'Некорректный инструктор процедуры');
  }
  p.patients.forEach(x=>assert(typeof x.name==='string'&&typeof x.house==='string','Некорректная карточка пациента'));
  const color=x=>typeof x==='string' && /^#[0-9a-f]{6}$/i.test(x);
  if(p.colorPresets!==undefined)assert(Array.isArray(p.colorPresets)&&p.colorPresets.every(color),'Некорректная палитра');
  const checkTextStyles=record=>{if(record.textStyles===undefined)return;assert(record.textStyles&&typeof record.textStyles==='object'&&!Array.isArray(record.textStyles),'Некорректное оформление текста');for(const style of Object.values(record.textStyles)){assert(style&&FONTS.includes(style.fontFamily)&&Number.isInteger(style.fontSize)&&style.fontSize>=6&&style.fontSize<=48&&typeof style.bold==='boolean'&&typeof style.italic==='boolean','Некорректное оформление текста');}};
  [...p.patients,...p.procedures,...Object.values(p.days),...(p.stays||[])].forEach(checkTextStyles);
  p.procedures.forEach(x=>assert(typeof x.name==='string'&&color(x.color)&&color(x.textColor)&&[x.duration,x.saturdayDuration].every(v=>v==null||(Number.isInteger(v)&&v>0&&v<=1440)),'Некорректный вид процедуры'));
  for(const [key,d] of Object.entries(p.days)){
    assert(/^\d{4}-\d{2}-\d{2}$/.test(key)&&d.date===key&&!Number.isNaN(new Date(key+'T12:00:00').valueOf())&&localDate(new Date(key+'T12:00:00'))===key,'Некорректная дата');
    assert(Number.isInteger(d.start)&&Number.isInteger(d.end)&&d.start>=0&&d.end<=1440&&d.end>d.start&&[1,5,10,15].includes(d.step)&&Number.isInteger(d.defaultDuration)&&d.defaultDuration>0,'Некорректные настройки дня');
    assert(Array.isArray(d.columns)&&Array.isArray(d.appointments)&&Array.isArray(d.bands)&&Array.isArray(d.cells),'Неполные данные дня');
    const colIds=new Set();d.columns.forEach(c=>{assert(patientIds.has(c.patientId)&&!colIds.has(c.patientId)&&typeof c.name==='string'&&typeof c.house==='string'&&Number.isFinite(c.width)&&c.width>=100&&c.width<=320&&color(c.color)&&color(c.headerColor),'Некорректная колонка');colIds.add(c.patientId);});
    if(d.disabledPatientIds!==undefined)assert(Array.isArray(d.disabledPatientIds)&&new Set(d.disabledPatientIds).size===d.disabledPatientIds.length&&d.disabledPatientIds.every(id=>colIds.has(id)),'Некорректный список выключенных пациентов');
    if(p.rosterVersion===1){const roster=p.patients.filter(x=>!x.archived);assert(d.columns.length===roster.length&&d.columns.every((c,i)=>c.patientId===roster[i].id&&c.name===roster[i].name&&c.house===roster[i].house),'Список пациентов должен быть общим для всех дней расписания');}
    for(const list of [d.appointments,d.bands,d.cells]){checkIdList(list);list.forEach(x=>assert(Number.isInteger(x.start)&&Number.isInteger(x.duration)&&x.start>=0&&x.duration>0&&x.start+x.duration<=1440&&color(x.color),'Некорректный временной блок'));}
    d.appointments.forEach(a=>{checkInstructor(a);assert(a.locked===undefined||typeof a.locked==='boolean','Некорректный флаг блокировки');});
    d.appointments.forEach(a=>assert(colIds.has(a.patientId)&&typeof a.text==='string'&&color(a.textColor)&&['planned','cancelled'].includes(a.status)&&Number.isFinite(a.fontSize)&&a.fontSize>=6&&a.fontSize<=48&&['left','center','right'].includes(a.align),'Некорректное назначение'));
    [...d.columns,...d.appointments,...d.bands].forEach(checkTextStyles);
    d.bands.forEach(b=>assert(typeof b.name==='string','Некорректный общий период'));
    d.cells.forEach(c=>assert(colIds.has(c.patientId)&&typeof c.text==='string','Некорректное оформление области'));
  }
  if(p.templates!==undefined){
    assert(p.templates&&typeof p.templates==='object'&&!Array.isArray(p.templates),'Некорректные шаблоны');
    for(const [kind,t] of Object.entries(p.templates)){
      assert(['regular','saturday'].includes(kind)&&t&&typeof t==='object','Некорректный шаблон');
      validateProject({version:1,patients:[],procedures:[],days:{'2026-11-07':{...t,date:'2026-11-07',columns:[],appointments:[],cells:[]}}});
    }
  }
  if(p.stays!==undefined){
    assert(Array.isArray(p.stays)&&p.stays.length>0,'Некорректный список заездов');const ids=checkIdList(p.stays);assert(ids.has(p.currentStayId),'Текущий заезд не найден');
    for(const stay of p.stays){assert(typeof stay.name==='string'&&stay.name.trim(),'Нет названия расписания');validateAutofill(stay.autofill);if(stay.startDate!==undefined||stay.endDate!==undefined){assert(typeof stay.startDate==='string'&&typeof stay.endDate==='string','Неполные даты заезда');assert(calendarTime(stay.endDate)>=calendarTime(stay.startDate),'Дата окончания не может быть раньше даты начала');}if(stay.id!==p.currentStayId)validateProject({version:1,patients:stay.patients,days:stay.days,procedures:p.procedures,instructors:p.instructors,templates:stay.templates,rosterVersion:stay.rosterVersion});}
  }
  return p;
}

export function removeInstructor(project,id){
  assert((project.instructors||[]).some(i=>i.id===id),'Инструктор не найден');
  project.instructors=project.instructors.filter(i=>i.id!==id);
  for(const p of project.procedures)p.instructors=(p.instructors||[]).filter(w=>w.instructorId!==id);
  for(const schedule of [project,...(project.stays||[]).filter(s=>s.id!==project.currentStayId)])for(const d of Object.values(schedule.days||{}))for(const a of d.appointments)if(a.instructorId===id)a.instructorId=null;
}
