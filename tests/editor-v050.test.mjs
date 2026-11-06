import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,makeDay,expandDayCanvas,clampedDropStart,validatePlacement,validateProject,syncSharedRoster,transferAppointment,copyScheduleDay,issuesFor} from '../domain.mjs';
import {bandLabelLayout,layoutPeriodLabels} from '../presentation.mjs';
import {scheduleTitle} from '../export.mjs';

test('appointments expand both canvas edges without truncating or warning',()=>{
  const p=ensureStays(newProject()),date=Object.keys(p.days)[0],d=p.days[date];
  const first={...d.appointments[0],id:'early',start:420},last={...d.appointments[0],id:'late',start:1380,duration:55};
  for(const a of [first,last]){assert.equal(validatePlacement(d,a),null);assert.deepEqual(issuesFor(d,a),[]);d.appointments.push(a);}
  expandDayCanvas(d);assert.equal(d.start,420);assert.equal(d.end,1435);assert.equal(last.duration,55);validateProject(p);
  assert.match(validatePlacement(d,{...last,start:1400}),/23:59/);
});
test('library uses a center anchor and every anchor snaps safely to the first row',()=>{
  const d=makeDay('2026-11-06'),duration=55;
  const start=clampedDropStart(d,660,duration,duration/2);assert.ok(Math.abs(start+duration/2-660)<=d.step/2);
  for(const offset of [0,25,54,100])assert.equal(clampedDropStart(d,0,duration,offset),d.start);
  assert.ok(clampedDropStart(d,1500,duration,0)+duration<=1440);
});
test('copy and transfer retain typography and expand a target canvas',()=>{
  const p=ensureStays(newProject()),date=Object.keys(p.days)[0],d=p.days[date],style={fontFamily:'Georgia',fontSize:18,bold:true,italic:true};
  d.appointments[0].textStyles={text:style};d.appointments[0].start=1200;expandDayCanvas(d);
  p.days['2026-12-01']=makeDay('2026-12-01',p.patients);const copy=transferAppointment(p,date,d.appointments[0].id,'2026-12-01');
  assert.deepEqual(copy.textStyles.text,style);assert.equal(p.days['2026-12-01'].end,1255);
  copyScheduleDay(p,date,'2026-12-02',{appointments:true});assert.deepEqual(p.days['2026-12-02'].appointments[0].textStyles.text,style);validateProject(p);
});
test('saved swatches and patient typography survive JSON and propagate to every day',()=>{
  const p=ensureStays(newProject()),date=Object.keys(p.days)[0],style={fontFamily:'Arial',fontSize:16,bold:false,italic:true};
  p.colorPresets=['#ff0000','#ffffff'];p.patients[0].textStyles={name:style};copyScheduleDay(p,date,'2026-12-01');syncSharedRoster(p);
  const restored=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.colorPresets,p.colorPresets);
  assert.ok(Object.values(restored.days).every(d=>d.columns[0].textStyles.name.fontFamily==='Arial'));
  p.patients[0].textStyles.name.fontFamily="Arial';position:fixed";assert.throws(()=>validateProject(p));
});
test('short period labels reserve enough room for a complete title and a separate time line',()=>{
  const ctx={font:'',measureText(value){const size=Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1]||12);return {width:[...value].length*size*.6};}};
  for(const duration of [5,10,20])for(const zoom of [.75,1,2]){
    const label=bandLabelLayout(ctx,{name:'Собрание',duration},1.4*zoom);
    assert.ok(label.height>=28);assert.equal(label.lines.join(''),'Собрание');assert.ok(label.lines.length*label.lineHeight+label.timeSize+6<=label.height);
  }
});
test('adjacent short periods retain independent labels and export title uses correct weekday form',()=>{
  const ctx={font:'',measureText(value){return {width:value.length*6};}},bands=[{name:'Разбор',start:900,duration:5},{name:'Собрание',start:905,duration:5}];
  const labels=layoutPeriodLabels(ctx,bands,1.05,540,1080);
  assert.ok(labels[0].top+labels[0].label.height<labels[1].top);assert.equal(bands[0].duration,5);
  assert.match(scheduleTitle('2026-11-06'),/^Расписание на пятницу, 6 ноября 2026/);assert.match(scheduleTitle('2026-11-04'),/^Расписание на среду,/);
});
