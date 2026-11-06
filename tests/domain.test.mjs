import {exportEndTime as exportEndForTest,procedureDurationError} from '../domain.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,makeDay,durationFor,overlaps,validatePlacement,issuesFor,layoutAppointments,validateProject,clone,minutes,upgradeDefaultPeriods} from '../domain.mjs';

test('new schedules include only lunch at 13:00–13:30, including Saturday and blank projects',()=>{
  for(const d of [makeDay('2026-11-06'),makeDay('2026-11-07'),Object.values(newProject(false).days)[0]])assert.deepEqual(d.bands.map(({name,start,duration})=>({name,start,duration})),[{name:'Обед',start:780,duration:30}]);
});
test('legacy default lunch is corrected without dropping optional or custom periods',()=>{
  const p=newProject(false);delete p.defaultsVersion;const d=Object.values(p.days)[0];d.bands[0].start=790;d.bands.push({id:'optional',name:'Консилиум',start:750,duration:30,color:'#e2e6ec',rule:'warn'});
  p.templates={regular:{start:540,end:1050,step:5,defaultDuration:55,bands:clone(d.bands)}};
  upgradeDefaultPeriods(p);assert.equal(d.bands[0].start,780);assert.equal(d.bands[1].name,'Консилиум');assert.equal(p.templates.regular.bands[0].start,780);validateProject(p);
  d.bands[0].start=790;upgradeDefaultPeriods(p);assert.equal(d.bands[0].start,790,'user changes after migration must be retained');
});

test('procedure defaults are independent of weekday, legacy Saturday settings and day defaults',()=>{
  const p={duration:null,saturdayDuration:45},fri=makeDay('2026-11-06'),sat=makeDay('2026-11-07');
  assert.equal(durationFor(p,fri),55);assert.equal(durationFor(p,sat),55);assert.equal(sat.end,fri.end);
  sat.defaultDuration=45;assert.equal(durationFor(p,sat),55);
  p.duration=30;assert.equal(durationFor(p,sat),30);assert.equal(durationFor(p,fri),30);
  p.saturdayDuration=20;assert.equal(durationFor(p,sat),30);
});

test('adjacent appointments do not conflict; a five-minute overlap does',()=>{
  const a={start:540,duration:55};assert.equal(overlaps(a,{start:595,duration:45}),false);assert.equal(overlaps(a,{start:590,duration:45}),true);
});
test('shortening an appointment releases exactly ten minutes',()=>{
  const d=makeDay('2026-11-06');const next={id:'next',patientId:'p',start:585,duration:45,status:'planned',text:'Следующая'};d.appointments=[next];
  const a={id:'first',patientId:'p',start:540,duration:55,status:'planned'};
  assert.equal(overlaps(a,next),true);a.duration=45;assert.equal(overlaps(a,next),false);assert.deepEqual(issuesFor(d,a),[]);
});
test('overlapping and cancelled appointments never generate warnings',()=>{
  const d=makeDay('2026-11-06');d.appointments=[{id:'a',patientId:'p1',start:540,duration:55,text:'Массаж',status:'planned'}];
  const b={id:'b',patientId:'p2',start:540,duration:55,status:'planned'};assert.equal(issuesFor(d,b).length,0);b.patientId='p1';assert.equal(issuesFor(d,b).length,0);d.appointments[0].status='cancelled';assert.equal(issuesFor(d,b).length,0);
});
test('shared periods are visual only, including legacy warning and blocking rules',()=>{
  const d=makeDay('2026-11-06');d.bands=[{id:'a',name:'Обед',start:780,duration:30,rule:'warn'},{id:'b',name:'Консилиум',start:750,duration:30,rule:'block'},{id:'c',name:'Свой период',start:840,duration:30,rule:'info'}];
  for(const start of [750,780,840]){const a={id:'p',patientId:'p',start,duration:30,status:'planned'};assert.equal(validatePlacement(d,a),null);assert.deepEqual(issuesFor(d,a),[]);}
});

test('placements extend beyond the current canvas while calendar, snap and duration stay valid',()=>{
  const d=makeDay('2026-11-06'),a={id:'a',start:1030,duration:55,status:'planned'};
  assert.equal(validatePlacement(d,a),null);a.start=1430;assert.match(validatePlacement(d,a),/23:59/);a.start=541;assert.match(validatePlacement(d,a),/шагу/);a.start=540;a.duration=0;assert.match(validatePlacement(d,a),/положительную/);
});
test('overlapping clusters get separate tracks; sequential blocks reclaim full width',()=>{
  const result=layoutAppointments([{id:'a',start:540,duration:55},{id:'b',start:550,duration:55},{id:'c',start:605,duration:45}]);
  assert.equal(result.find(a=>a.id==='a').tracks,2);assert.notEqual(result[0].track,result[1].track);assert.equal(result.find(a=>a.id==='c').tracks,1);
});
test('project round-trip retains cancelled blocks, snapshots, and custom periods',()=>{
  const p=newProject();const d=Object.values(p.days)[0];d.appointments[0].status='cancelled';d.columns[0].house='Исторический домик';p.patients[0].house='Новый домик';d.bands.push({id:'custom',name:'Собрание',start:900,duration:20,color:'#d8dfe8',rule:'block'});
  const result=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(Object.values(result.days)[0].columns[0].house,'Исторический домик');assert.equal(Object.values(result.days)[0].bands.at(-1).rule,'block');assert.equal(Object.values(result.days)[0].appointments[0].status,'cancelled');
});
test('malformed project and broken references are rejected before replacement',()=>{
  assert.throws(()=>validateProject({version:99}));const p=newProject(),d=Object.values(p.days)[0];d.appointments[0].patientId='missing';assert.throws(()=>validateProject(p));const bad=newProject();Object.values(bad.days)[0].columns[0].color='red;position:fixed';assert.throws(()=>validateProject(bad));
});
test('editing a day snapshot and deleting a procedure leave history independent',()=>{
  const p=newProject(),source=Object.values(p.days)[0],copy=clone(source);copy.date='2026-11-07';copy.columns[0].house='99';copy.appointments[0].duration=45;p.procedures=[];assert.notEqual(source.columns[0].house,'99');assert.equal(source.appointments[0].duration,durationFor({duration:null,saturdayDuration:null},source));assert.ok(source.appointments[0].text);validateProject(p);
});
test('time parsing rejects impossible times and keeps minute precision',()=>{assert.equal(minutes('09:05'),545);assert.ok(Number.isNaN(minutes('25:00')));assert.ok(Number.isNaN(minutes('09:65')));});
test('invalid saved template and impossible calendar dates are rejected',()=>{
  const p=newProject();p.templates={saturday:{start:600,end:500,step:5,defaultDuration:45,bands:[]}};assert.throws(()=>validateProject(p));
  const q=newProject();q.days={'2026-02-30':{...Object.values(q.days)[0],date:'2026-02-30'}};assert.throws(()=>validateProject(q));
});

test('exported image ends with the last procedure of the patients shown that day',()=>{
  const day={end:1440,disabledPatientIds:['off'],appointments:[{patientId:'on',start:540,duration:55},{patientId:'on',start:990,duration:55},{patientId:'off',start:1300,duration:60}]};
  assert.equal(exportEndForTest(day),1045);
  assert.equal(exportEndForTest({...day,appointments:[]}),1439,'an empty day falls back to the canvas');
  assert.equal(exportEndForTest({end:1050,appointments:[]}),1050);
  assert.equal(exportEndForTest({end:1440,appointments:[{patientId:'on',start:1400,duration:40}]}),1439,'the time field cannot show 24:00');
});

test('procedure duration must fit the grid step',()=>{
  for(const [value,step] of [[50,5],[60,15],[480,5],[5,5],[7,1]])assert.equal(procedureDurationError(value,step),null);
  assert.match(procedureDurationError(52,5),/кратна шагу сетки: 5/);
  assert.match(procedureDurationError(55,15),/кратна шагу сетки: 15/);
  for(const [value,step] of [[0,5],[3,5],[485,5],[12.5,5],[NaN,5]])assert.match(procedureDurationError(value,step),/от \d+ до 480/);
});
