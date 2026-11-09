import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDay,newProject,ensureStays,validateProject,clone} from '../domain.mjs';
import {buildSlots,checkSettings,describeCause,describeLoad,estimateLoad,normalizeGroups,normalizeSettings,planDay,poolKey,procedurePools,resolveSettings,saveWeekdaySettings} from '../autofill.mjs';
import {workdayEnd} from '../domain.mjs';

const seeded=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const proc=(name,instructorId,duration=55)=>({id:`${name}|${instructorId}`,name,instructors:instructorId?[{instructorId,color:'#ffffff'}]:[],duration,color:'#ffffff',textColor:'#000000'});
function setup(count,procedures,tune=()=>{}){
  const patients=Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Пациент ${i}`,house:'1',archived:false}));
  const day=makeDay('2026-11-09',patients),settings=normalizeSettings(null,procedures,day.bands);
  tune(settings,day);
  return {day,settings,procedures};
}
const run=(ctx,options={})=>planDay({...ctx,rng:seeded(7),attempts:80,...options});
const end=item=>item.start+item.duration;
const instructorOf=(procedures,item)=>item.instructorId;
const keyOf=(procedures,item)=>poolKey(procedures.find(p=>p.id===item.procedureId).name);
const clash=(a,b)=>a.start<end(b)&&b.start<end(a);
function assertNoPatientOverlap(place){
  for(let i=0;i<place.length;i++)for(let j=i+1;j<place.length;j++)if(place[i].patientId===place[j].patientId)assert.ok(!clash(place[i],place[j]),'patient overlap');
}
const SLOTS=[540,600,660,720,810,870,930,990];

test('fixed slots restart after lunch',()=>{
  const lunch=[{start:780,duration:30}];
  assert.deepEqual(buildSlots(540,60,lunch,5).slice(0,8),SLOTS);
});
test('every selected procedure reaches every patient without overlap or instructor clash',()=>{
  const procedures=['Массаж','Спорт','Эрготерапия','Физиотерапия'].map((n,i)=>proc(n,`i${i}`));
  const ctx=setup(6,procedures),{place,report}=run(ctx);
  assert.equal(place.length,24);assert.equal(report.unplaced.length,0);assertNoPatientOverlap(place);
  for(let i=0;i<place.length;i++)for(let j=i+1;j<place.length;j++)if(instructorOf(procedures,place[i])===instructorOf(procedures,place[j]))assert.ok(!clash(place[i],place[j]),'instructor clash');
  for(const item of place){assert.ok(SLOTS.includes(item.start),`not on a slot: ${item.start}`);assert.ok(item.start>=810||end(item)<=780,'crosses lunch');}
});
test('work that does not fit continues past the end of the day',()=>{
  const ctx=setup(10,[proc('Массаж','m')]),{place,report}=run(ctx);
  assert.equal(place.length,10);assert.equal(report.unplaced.length,0);assert.equal(report.overtime,2);
});
test('unticked procedures are skipped',()=>{
  const procedures=[proc('Массаж','m'),proc('Спорт','s')];
  const ctx=setup(2,procedures,s=>{s.rows['спорт'].enabled=false;});
  assert.ok(run(ctx).place.every(item=>keyOf(procedures,item)==='массаж'));
});
test('same-name templates are a pool: one procedure per patient, parallel instructors',()=>{
  const procedures=[proc('Массаж','yulia'),proc('Массаж','olimpiada')];
  const {place}=run(setup(4,procedures));
  assert.equal(place.length,4);assert.equal(new Set(place.map(p=>p.patientId)).size,4);
  assert.equal(Math.max(...place.map(end)),655,'two instructors finish in two slots');
});
test('one procedure with several instructors runs in parallel and each can be switched off',()=>{
  const massage={...proc('Массаж','yulia'),instructors:[{instructorId:'yulia',color:'#ffffff'},{instructorId:'olimpiada',color:'#f6c6d0'}]};
  const both=run(setup(4,[massage])).place;
  assert.equal(both.length,4);assert.equal(Math.max(...both.map(end)),655);assert.equal(new Set(both.map(p=>p.instructorId)).size,2);
  const one=run(setup(3,[massage],s=>{s.instructors['Массаж|yulia:olimpiada'].enabled=false;})).place;
  assert.ok(one.every(p=>p.instructorId==='yulia'));
});
test('unticked instructor gets no work',()=>{
  const procedures=[proc('Массаж','yulia'),proc('Массаж','olimpiada')];
  const ctx=setup(3,procedures,s=>{s.instructors['Массаж|olimpiada:olimpiada'].enabled=false;});
  assert.ok(run(ctx).place.every(item=>instructorOf(procedures,item)==='yulia'));
});
test('linked procedures stay adjacent, in either order, with one instructor, never across lunch',()=>{
  const procedures=[proc('Кушетка','yulia'),proc('Тренажёр','yulia'),proc('Кушетка','natalia'),proc('Тренажёр','natalia'),proc('Массаж','m')];
  const links=[{a:'кушетка',b:'тренажёр',simultaneous:false}],ctx={...setup(4,procedures),links};
  const {place,report}=run(ctx);
  assert.equal(report.unplaced.length,0);assertNoPatientOverlap(place);
  for(const id of ['p0','p1','p2','p3']){
    const own=place.filter(p=>p.patientId===id&&keyOf(procedures,p)!=='массаж').sort((a,b)=>a.start-b.start);
    assert.equal(own.length,2);assert.equal(own[1].start-own[0].start,own[0].start===720?-1:60,'not adjacent');
    assert.equal(instructorOf(procedures,own[0]),instructorOf(procedures,own[1]));
  }
  const many=new Set();
  for(let seed=1;seed<30;seed++)for(const item of planDay({...ctx,rng:seeded(seed),attempts:1}).place.filter(p=>p.patientId==='p0'&&keyOf(procedures,p)!=='массаж').sort((a,b)=>a.start-b.start).slice(0,1))many.add(keyOf(procedures,item));
  assert.equal(many.size,2,'both orders must occur');
});
test('simultaneous link lets one instructor run both procedures for different patients',()=>{
  const procedures=[proc('Кушетка','yulia'),proc('Тренажёр','yulia')];
  const ctx={...setup(2,procedures),links:[{a:'кушетка',b:'тренажёр',simultaneous:true}]};
  const {place}=run(ctx);
  assert.equal(place.length,4);assert.equal(Math.max(...place.map(end)),655);assertNoPatientOverlap(place);
  const without={...setup(2,procedures),links:[{a:'кушетка',b:'тренажёр',simultaneous:false}]};
  assert.ok(Math.max(...run(without).place.map(end))>655,'without the flag the instructor runs one at a time');
});
test('generated work never makes an instructor return to an earlier procedure',()=>{
  const procedures=[proc('Массаж','yulia'),proc('АФК','yulia')];
  for(let seed=1;seed<25;seed++){
    const {place,report}=planDay({...setup(5,procedures),rng:seeded(seed),attempts:1});
    assert.equal(report.unplaced.length,0);
    const sequence=place.slice().sort((a,b)=>a.start-b.start).map(item=>keyOf(procedures,item));
    assert.equal(sequence.filter((key,i)=>key!==sequence[i-1]).length,2,sequence.join());
  }
});
test('instructor hours are hard limits and what does not fit is reported',()=>{
  const procedures=[proc('Массаж','yulia'),proc('АФК','yulia')];
  const ctx=setup(6,procedures,s=>{s.instructors['Массаж|yulia:yulia'].to='11:00';s.instructors['АФК|yulia:yulia'].from='14:00';});
  const {place,report}=run(ctx);
  const massage=place.filter(p=>keyOf(procedures,p)==='массаж'),afk=place.filter(p=>keyOf(procedures,p)==='афк');
  assert.ok(massage.every(p=>end(p)<=660));assert.equal(massage.length,2);assert.ok(afk.every(p=>p.start>=840));assert.equal(afk.length,6);
  assert.equal(report.unplaced.length,4);assert.ok(report.unplaced.every(u=>u.reason==='no-time'&&u.name==='Массаж'));assert.equal(report.total,12);
});
test('free placement follows the grid step and the break',()=>{
  const procedures=[proc('Спорт','s',30)];
  const ctx=setup(3,procedures,s=>{s.rows['спорт'].grid=false;s.rows['спорт'].gap=10;});
  assert.deepEqual(run(ctx).place.map(p=>p.start).sort((a,b)=>a-b),[540,580,620]);
  ctx.settings.rows['спорт'].gap=0;
  assert.deepEqual(run(ctx).place.map(p=>p.start).sort((a,b)=>a-b),[540,570,600]);
});
function peak(items){return Math.max(0,...items.map(a=>items.filter(b=>b.start<=a.start&&a.start<end(b)).length));}
test('a limit caps a procedure across all instructors, so three AFK instructors use two couches at most',()=>{
  const procedures=[proc('Кушетка','a'),proc('Кушетка','b'),proc('Кушетка','c'),proc('Тренажёр','a'),proc('Тренажёр','b'),proc('Тренажёр','c')];
  const ctx={...setup(6,procedures,s=>{s.rows['кушетка'].limit=2;}),links:[{a:'кушетка',b:'тренажёр',simultaneous:false}]};
  for(let seed=1;seed<12;seed++){
    const {place,report}=planDay({...ctx,rng:seeded(seed),attempts:30});
    assert.equal(report.unplaced.length,0);
    const couch=place.filter(p=>keyOf(procedures,p)==='кушетка'),both=place;
    assert.equal(couch.length,6);assert.ok(peak(couch)<=2,'more than two couches at once');
    assert.equal(peak(both),3,'the third instructor works on the machine at the same time');
  }
  const free={...ctx,settings:normalizeSettings(null,procedures,ctx.day.bands)};
  assert.equal(peak(run(free).place.filter(p=>keyOf(procedures,p)==='кушетка')),3,'no limit: all three couches');
});
test('locked appointments count toward the limit; empty and invalid limits',()=>{
  const procedures=[proc('Кушетка','a'),proc('Кушетка','b')];
  const ctx=setup(2,procedures,s=>{s.rows['кушетка'].limit=1;});
  ctx.day.appointments=[appointment('lock','p0',procedures[0],540,{locked:true})];
  assert.notEqual(run(ctx).place[0].start,540);
  ctx.settings.rows['кушетка'].limit=0;assert.match(checkSettings(ctx.settings,procedures,ctx.day)[0],/максимум/);
  ctx.settings.rows['кушетка'].limit=null;assert.deepEqual(checkSettings(ctx.settings,procedures,ctx.day),[]);
  assert.equal(run(ctx).place[0].start,540,'no limit: the other instructor works in parallel');
});
test('a limit also caps shared sessions by patient count',()=>{
  const procedures=[proc('Спорт','s')];
  const {place}=run(setup(5,procedures,s=>{Object.assign(s.rows['спорт'],{together:'any',capacity:4,limit:2});}));
  assert.ok(peak(place)<=2);assert.equal(place.length,5);
});
test('shared procedures respect capacity and start together',()=>{
  const procedures=[proc('Спорт','s')];
  const ctx=setup(5,procedures,s=>{s.rows['спорт'].together='any';s.rows['спорт'].capacity=2;});
  const starts=run(ctx).place.map(p=>p.start).sort((a,b)=>a-b);
  assert.deepEqual(starts,[540,540,600,600,660]);
});
test('group mode mixes only patients with the same label',()=>{
  const procedures=[proc('Спорт','s')];
  const ctx={...setup(5,procedures,s=>{s.rows['спорт'].together='groups';s.rows['спорт'].capacity=5;}),groupList:[{id:'common',name:'Общая',values:{p0:1,p1:1,p2:2,p3:2}}]};
  const {place}=run(ctx),at=id=>place.find(p=>p.patientId===id).start;
  assert.equal(at('p0'),at('p1'));assert.equal(at('p2'),at('p3'));assert.notEqual(at('p0'),at('p2'));
  assert.equal(new Set(place.map(p=>p.start)).size,3,'patient without a group goes alone');
});
function appointment(id,patientId,procedure,start,extra={}){return {id,patientId,procedureId:procedure.id,instructorId:procedure.instructors[0]?.instructorId??null,start,duration:procedure.duration,text:procedure.name,color:'#ffffff',textColor:'#000000',fontSize:12,align:'center',status:'planned',note:'',...extra};}
test('locks stay, count as done and occupy patient and instructor; the rest is replaced',()=>{
  const procedures=[proc('Массаж','m'),proc('Спорт','s')];
  const ctx=setup(2,procedures),[massage,sport]=procedures;
  ctx.day.appointments=[appointment('lock','p0',massage,600,{locked:true}),appointment('free','p1',sport,900)];
  const {place,remove}=run(ctx);
  assert.deepEqual(remove,['free']);
  assert.ok(!place.some(p=>p.patientId==='p0'&&p.procedureId===massage.id),'locked procedure is not added twice');
  const other=place.find(p=>p.patientId==='p1'&&p.procedureId===massage.id);assert.notEqual(other.start,600);
  assert.notEqual(place.find(p=>p.patientId==='p0'&&p.procedureId===sport.id).start,600);
});
test('a locked half of a link pulls its partner next to it, or the report says otherwise',()=>{
  const procedures=[proc('Кушетка','y'),proc('Тренажёр','y')],links=[{a:'кушетка',b:'тренажёр',simultaneous:false}];
  const ctx={...setup(1,procedures),links};
  ctx.day.appointments=[appointment('lock','p0',procedures[0],660,{locked:true})];
  const {place,report}=run(ctx);
  assert.equal(place.length,1);assert.ok([600,720].includes(place[0].start));assert.equal(report.broken.length,0);
  const blocked={...setup(1,procedures),links};
  blocked.day.appointments=[appointment('lock','p0',procedures[0],660,{locked:true}),appointment('a','p0',procedures[1],540,{locked:false,procedureId:'other',text:'Другое',duration:115,instructorId:null}),appointment('b','p0',procedures[1],720,{locked:false,procedureId:'other',text:'Другое',instructorId:null})];
  blocked.settings.mode='partial';blocked.settings.partialKeys=['тренажёр'];
  const result=run(blocked);
  assert.equal(result.report.broken.length,1);assert.equal(result.place.length,1);
});
test('partial mode keeps other unlocked work and re-places only the chosen procedure',()=>{
  const procedures=[proc('Массаж','m'),proc('АФК','a')],[massage,afk]=procedures;
  const ctx=setup(2,procedures,s=>{s.mode='partial';s.partialKeys=['афк'];});
  ctx.day.appointments=[appointment('keep','p0',massage,540),appointment('old','p1',afk,540),appointment('stay','p0',afk,990,{locked:true})];
  const {place,remove}=run(ctx);
  assert.deepEqual(remove,['old']);assert.equal(place.length,1);assert.equal(place[0].patientId,'p1');assert.equal(place[0].procedureId,afk.id);
});
test('partial mode brings the linked partner along',()=>{
  const procedures=[proc('Кушетка','y'),proc('Тренажёр','y')];
  const ctx={...setup(1,procedures,s=>{s.mode='partial';s.partialKeys=['кушетка'];}),links:[{a:'кушетка',b:'тренажёр',simultaneous:false}]};
  assert.equal(run(ctx).place.length,2);
});
test('patients switched off for the day are untouched and do not occupy instructors',()=>{
  const procedures=[proc('Массаж','m')],ctx=setup(2,procedures);
  ctx.day.disabledPatientIds=['p1'];ctx.day.appointments=[appointment('hidden','p1',procedures[0],540)];
  const {place,remove}=run(ctx);
  assert.deepEqual(remove,[]);assert.deepEqual(place.map(p=>[p.patientId,p.start]),[['p0',540]]);
});
test('no shared instructor for a link is reported instead of splitting it',()=>{
  const procedures=[proc('Кушетка','y'),proc('Тренажёр','n')];
  const {place,report}=run({...setup(1,procedures),links:[{a:'кушетка',b:'тренажёр',simultaneous:false}]});
  assert.equal(place.length,0);assert.ok(report.unplaced.every(u=>u.reason==='no-pair'));
});
test('a procedure without an instructor is limited only by the patient',()=>{
  const {place}=run(setup(3,[proc('Прогулка',null)]));
  assert.deepEqual(place.map(p=>p.start),[540,540,540]);
});
test('settings errors block generation',()=>{
  const procedures=[proc('Массаж','m',52)],{day,settings}=setup(1,procedures);
  assert.match(checkSettings(settings,procedures,day)[0],/не кратна/);
  procedures[0].duration=55;assert.deepEqual(checkSettings(settings,procedures,day),[]);
  settings.instructors['Массаж|m:m'].to='9 утра';assert.match(checkSettings(settings,procedures,day)[0],/ЧЧ:ММ/);
  settings.instructors['Массаж|m:m'].to='';settings.rows['массаж'].enabled=false;assert.match(checkSettings(settings,procedures,day)[0],/хотя бы одну/);
});
test('settings are remembered per weekday, new weekdays inherit, and projects still validate',()=>{
  const p=ensureStays(newProject(true)),date='2026-11-09',nextMonday='2026-11-16',tuesday='2026-11-10',bands=[{name:'Обед'}];
  const first=resolveSettings(undefined,date,p.procedures,bands);assert.equal(first.saved,false);assert.equal(first.settings.blockedBands['Обед'],true);
  first.settings.rows[poolKey(p.procedures[0].name)].enabled=false;
  const stay=p.stays[0];stay.autofill=saveWeekdaySettings(stay.autofill,date,first.settings,[{a:'x',b:'y',simultaneous:true}],[{id:'common',name:'Общая',values:{}}]);
  const restored=validateProject(JSON.parse(JSON.stringify(p))).stays[0].autofill;
  assert.equal(resolveSettings(restored,nextMonday,p.procedures,bands).saved,true);
  const inherited=resolveSettings(restored,tuesday,p.procedures,bands);assert.equal(inherited.saved,false);assert.equal(inherited.settings.rows[poolKey(p.procedures[0].name)].enabled,false);
  const broken=clone(p);broken.stays[0].autofill.links=[{a:1}];assert.throws(()=>validateProject(broken),/связка/);
});
test('each procedure uses its own group: the same patients can share one procedure and not another',()=>{
  const procedures=[proc('Спорт','s'),proc('Эрготерапия','e')];
  const groupList=[{id:'common',name:'Общая',values:{}},{id:'sport',name:'Спорт',values:{anton:1,veronika:1}},{id:'ergo',name:'Эрготерапия',values:{anton:5,veronika:1}}];
  const ctx=setup(2,procedures,s=>{for(const [key,groupId] of [['спорт','sport'],['эрготерапия','ergo']])Object.assign(s.rows[key],{together:'groups',capacity:5,groupId});});
  ctx.day.columns[0].patientId='anton';ctx.day.columns[1].patientId='veronika';
  const at=(place,patient,id)=>place.find(p=>p.patientId===patient&&p.procedureId===id).start;
  const only=key=>{for(const row of Object.values(ctx.settings.rows))row.enabled=false;ctx.settings.rows[key].enabled=true;return run({...ctx,groupList}).place;};
  const sport=only('спорт'),ergo=only('эрготерапия');
  assert.equal(at(sport,'anton',procedures[0].id),at(sport,'veronika',procedures[0].id),'same number: together');
  assert.notEqual(at(ergo,'anton',procedures[1].id),at(ergo,'veronika',procedures[1].id),'different numbers: apart');
});
test('a procedure pointing at a removed group falls back to the common one',()=>{
  const ctx={...setup(2,[proc('Спорт','s')],s=>{Object.assign(s.rows['спорт'],{together:'groups',groupId:'gone'});}),groupList:[{id:'common',name:'Общая',values:{p0:1,p1:1}}]};
  assert.equal(new Set(run(ctx).place.map(p=>p.start)).size,1);
});
test('the common group always exists; older groups become its numbers',()=>{
  assert.deepEqual(normalizeGroups(undefined).groupList,[{id:'common',name:'Общая',values:{}}]);
  const labels=normalizeGroups({groups:{p1:' А ',p2:'А',p3:'Б',p4:' '}}).groupList;
  assert.equal(labels.length,1);assert.equal(labels[0].values.p1,labels[0].values.p2);assert.notEqual(labels[0].values.p1,labels[0].values.p3);assert.ok(!('p4' in labels[0].values));
  const earlier=normalizeGroups({groupList:[{id:'g',name:'Неврология'}],groups:{p1:'g'}}).groupList;
  assert.equal(earlier.length,1);assert.equal(earlier[0].values.p1,1);
  const current=normalizeGroups({groupList:[{id:'x',name:'Спорт',values:{}},{id:'common',name:'Общая',values:{a:2}}]}).groupList;
  assert.deepEqual(current.map(g=>g.id),['common','x']);
  const added=normalizeGroups({groupList:[{id:'x',name:'Спорт',values:{}}]}).groupList;assert.equal(added[0].id,'common');
});
test('named groups are saved and validated',()=>{
  const p=ensureStays(newProject(true)),stay=p.stays[0],settings=resolveSettings(undefined,'2026-11-09',p.procedures,[]).settings;
  stay.autofill=saveWeekdaySettings({groups:{old:'x'},links:[],weekdays:{}},'2026-11-09',settings,[],[{id:'common',name:'Общая',values:{[p.patients[0].id]:3}}]);
  const saved=validateProject(JSON.parse(JSON.stringify(p))).stays[0].autofill;
  assert.equal(saved.groupList[0].values[p.patients[0].id],3);assert.ok(!('groups' in saved),'old field goes away');
  const broken=clone(p);broken.stays[0].autofill.groupList=[{id:1}];assert.throws(()=>validateProject(broken),/групп/);
  const zero=clone(p);zero.stays[0].autofill.groupList[0].values.a=0;assert.throws(()=>validateProject(zero),/групп/);
});
test('new procedures appear with defaults and removed ones disappear',()=>{
  const before=[proc('Массаж','m')],settings=normalizeSettings(null,before,[]);settings.rows['массаж'].grid=false;
  const after=normalizeSettings(settings,[before[0],proc('Спорт','s')],[]);
  assert.equal(after.rows['массаж'].grid,false);assert.equal(after.rows['спорт'].grid,true);
  assert.deepEqual(Object.keys(normalizeSettings(settings,[proc('Спорт','s')],[]).rows),['спорт']);
  assert.equal(procedurePools([proc(' Массаж ','a'),proc('массаж','b')]).length,1);
});

test('load estimate: one masseur runs late, hours lose sessions, two masseurs fit',()=>{
  const one=[proc('Массаж','m')];
  let load=estimateLoad(setup(10,one));
  assert.deepEqual([load.rows['массаж'].needed,load.rows['массаж'].fit,load.rows['массаж'].status],[10,8,'late']);
  assert.equal(load.status,'late');assert.match(describeLoad(load)[0].text,/нужно 10 сеансов, до конца дня помещается 8/);
  const ctx=setup(10,one,s=>{s.instructors['Массаж|m:m'].to='11:00';});
  load=estimateLoad(ctx);assert.deepEqual([load.rows['массаж'].fit,load.rows['массаж'].fitDay,load.rows['массаж'].status],[2,2,'lost']);
  assert.equal(run(ctx).report.unplaced.length,8,'the estimate matches the result');
  const pair={...proc('Массаж','a'),instructors:[{instructorId:'a',color:'#ffffff'},{instructorId:'b',color:'#ffffff'}]};
  load=estimateLoad(setup(10,[pair]));assert.equal(load.rows['массаж'].fit,16);assert.equal(load.status,'ok');assert.deepEqual(describeLoad(load),[]);
});
test('load estimate: an instructor with two procedures shares one day',()=>{
  const procedures=[proc('Физио','artem'),proc('Тренажёр','artem')],ctx=setup(10,procedures),load=estimateLoad(ctx);
  assert.equal(load.rows['физио'].status,'late');
  const artem=load.instructors.find(i=>i.instructorId==='artem');
  assert.deepEqual([artem.needed,artem.status],[20,'lost']);assert.ok(artem.fit>=8&&artem.fit<=9,'whole hours of the day: '+artem.fit);
  assert.match(describeLoad(load,()=>'Артём')[0].text,/^Артём: нужно 20 сеансов/);
  assert.ok(run(ctx).report.unplaced.length>0,'the warning is real');
  const linked=estimateLoad({...setup(10,procedures),links:[{a:'физио',b:'тренажёр',simultaneous:true}]});
  assert.equal(linked.instructors.find(i=>i.instructorId==='artem').needed,10,'both at once count once');
});
test('load estimate: groups, shared sessions, limits, locks and partial mode',()=>{
  const sport=[proc('Спорт','s')];
  assert.equal(estimateLoad(setup(10,sport,s=>{Object.assign(s.rows['спорт'],{together:'any',capacity:4});})).rows['спорт'].needed,3);
  const grouped=estimateLoad({...setup(5,sport,s=>{Object.assign(s.rows['спорт'],{together:'groups',capacity:5});}),groupList:[{id:'common',name:'Общая',values:{p0:1,p1:1,p2:2}}]});
  assert.equal(grouped.rows['спорт'].needed,4,'two groups and two patients alone');
  const couches=[proc('Кушетка','a'),proc('Кушетка','b'),proc('Кушетка','c')];
  assert.equal(estimateLoad(setup(30,couches,s=>{s.rows['кушетка'].limit=2;})).rows['кушетка'].fit,16,'two at once for eight slots');
  const locked=setup(2,[proc('Массаж','m')]);locked.day.appointments=[appointment('l','p0',locked.procedures[0],540,{locked:true})];
  const load=estimateLoad(locked);assert.equal(load.rows['массаж'].needed,1);assert.equal(load.rows['массаж'].fit,7,'the locked slot is taken');
  locked.day.appointments.push(appointment('m','p1',locked.procedures[0],600,{locked:true}));
  assert.equal(estimateLoad(locked).rows['массаж'].needed,0);
  const partial=setup(2,[proc('Массаж','m'),proc('Спорт','s')],s=>{s.mode='partial';s.partialKeys=['спорт'];});
  assert.deepEqual(Object.keys(estimateLoad(partial).rows),['спорт']);
});
test('load estimate: patients, missing instructors, links and bad settings',()=>{
  const many=Array.from({length:10},(_,i)=>{const p=proc('П'+i,'i'+i);return p;});
  const load=estimateLoad(setup(2,many));assert.equal(load.patients.late,2,'ten hours do not fit into a working day');assert.match(describeLoad(load).at(-1).text,/У 2 пациентов/);
  const off=setup(1,[proc('Спорт','s')],s=>{s.instructors['Спорт|s:s'].enabled=false;});
  assert.equal(estimateLoad(off).rows['спорт'].cause,'no-instructor');
  const split=estimateLoad({...setup(1,[proc('К','y'),proc('Т','n')]),links:[{a:'к',b:'т',simultaneous:false}]});
  assert.equal(split.rows['к'].cause,'no-pair');assert.equal(describeLoad(split).length,1,'one line for the pair');
  assert.equal(estimateLoad(setup(1,[proc('Спорт',null)])).rows['спорт'].fit,null,'no instructor limit');
  const bad=setup(1,[proc('Спорт','s')]);bad.settings.slot=0;assert.equal(estimateLoad(bad),null);
});
test('the report names what got in the way',()=>{
  const names=id=>({m:'Юлия',y:'Наталья'}[id]||id);
  const causes=ctx=>[...new Set(run(ctx).report.unplaced.map(u=>u.cause))];
  const hours=setup(4,[proc('Массаж','m')],s=>{s.instructors['Массаж|m:m'].to='11:00';});
  assert.deepEqual(causes(hours),['busy']);
  const text=describeCause(run(hours).report.unplaced[0],names);assert.equal(text.text,'нет свободного времени у инструктора: Юлия до 11:00');assert.match(text.hint,/«до»/);
  const late=setup(1,[proc('Массаж','m')],s=>{s.instructors['Массаж|m:m'].from='23:30';});
  assert.deepEqual(causes(late),['hours']);
  assert.deepEqual(causes(setup(1,[proc('Массаж','m')],s=>{s.instructors['Массаж|m:m'].enabled=false;})),['no-instructor']);
  const limit=setup(40,[proc('Спорт','a'),proc('Спорт','b')],s=>{s.rows['спорт'].limit=1;});
  assert.deepEqual(causes(limit),['limit']);assert.match(describeCause(run(limit).report.unplaced[0]).text,/максимум одновременно: 1/);
  assert.deepEqual(causes({...setup(1,[proc('К','y'),proc('Т','n')]),links:[{a:'к',b:'т',simultaneous:false}]}),['no-pair']);
  const crowded=setup(1,[proc('Массаж','m'),proc('Спорт','s')],s=>{s.instructors['Массаж|m:m'].to='10:00';});
  crowded.day.appointments=[appointment('l','p0',crowded.procedures[1],540,{locked:true})];
  assert.deepEqual(causes(crowded),['patient']);
  const two=setup(1,[proc('К','y'),proc('Т','y')],s=>{s.instructors['Т|y:y'].to='10:00';s.instructors['К|y:y'].from='12:00';});
  assert.deepEqual([...new Set(run({...two,links:[{a:'к',b:'т',simultaneous:false}]}).report.unplaced.map(u=>u.cause))].sort().join(),'link');
  for(const cause of ['no-instructor','no-pair','link','hours','blocked','patient','limit','busy','returns','day']){
    const d=describeCause({cause,instructorIds:['m'],until:660,limit:2},names);assert.ok(d.text&&d.hint,cause);
  }
});

test('generation and the estimate take the working day end from the day',()=>{
  const ctx=setup(10,[proc('Массаж','m')]);ctx.settings.end=1400;
  assert.equal(run(ctx).report.overtime,2,'the settings value is ignored');
  assert.equal(estimateLoad(ctx).rows['массаж'].fit,8);
  ctx.day.workEnd=720;
  assert.equal(run(ctx).report.overtime,7,'until 12:00 only three start and finish in time');
  assert.equal(estimateLoad(ctx).rows['массаж'].fit,3);
  ctx.day.workEnd=500;assert.match(checkSettings(ctx.settings,ctx.procedures,ctx.day)[0],/раньше конца/);
  delete ctx.day.workEnd;assert.equal(workdayEnd(ctx.day),1050,'older days end at 17:30');
});
