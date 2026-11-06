import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,clone,createStay,switchStay,removeSchedule,removeInstructor,copyScheduleDay,transferAppointment,updateProcedureTemplate,validateProject} from '../domain.mjs';
test('legacy projects load with an empty global instructor list and optional lock flags',()=>{
  const p=newProject(true);delete p.instructors;validateProject(p);ensureStays(p);assert.deepEqual(p.instructors,[]);validateProject(p);
});
test('instructors and duplicate procedure names belong to the project and survive schedule changes',()=>{
  const p=ensureStays(newProject(true)),first=p.currentStayId,date=Object.keys(p.days)[0];p.instructors=[{id:'i1',name:'Иванов Иван'},{id:'i2',name:'Петров Пётр'}];
  p.procedures[0].instructorId='i1';p.procedures[1].name=p.procedures[0].name;p.procedures[1].instructorId='i2';
  const id=createStay(p,'Другая группа',date,false,date);assert.deepEqual(p.patients,[]);assert.equal(p.instructors.length,2);switchStay(p,first);removeSchedule(p,id);
  const restored=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(restored.instructors.length,2);assert.notEqual(restored.procedures[0].instructorId,restored.procedures[1].instructorId);
});
test('removing an instructor clears references in every schedule while preserving appointments and lock flags',()=>{
  const p=ensureStays(newProject(true)),first=p.currentStayId,date=Object.keys(p.days)[0];p.instructors=[{id:'i',name:'Иван Иванов'}];p.procedures[0].instructorId='i';
  const a=p.days[date].appointments[0];a.instructorId='i';a.locked=true;
  createStay(p,'Другая группа',date,true,date);p.days[date].appointments.push({...clone(a),id:'other',patientId:p.patients[0].id});switchStay(p,first);
  removeInstructor(p,'i');assert.equal(p.procedures[0].instructorId,null);assert.equal(a.instructorId,null);assert.equal(a.locked,true);
  const other=p.stays.find(s=>s.id!==first).days[date].appointments[0];assert.equal(other.instructorId,null);assert.equal(other.locked,true);validateProject(p);
});
test('instructor changes obey the current-day propagation checkbox',()=>{
  const p=ensureStays(newProject(true)),date=Object.keys(p.days)[0],id=p.procedures[0].id;p.instructors=[{id:'i',name:'Инструктор'}];
  updateProcedureTemplate(p,date,id,{instructorId:'i'});assert.ok(p.days[date].appointments.every(a=>a.instructorId===undefined));
  updateProcedureTemplate(p,date,id,{instructorId:'i'},{applyToDay:true});assert.ok(p.days[date].appointments.filter(a=>a.procedureId===id).every(a=>a.instructorId==='i'));validateProject(p);
});
test('lock and instructor snapshots survive copies, transfers and JSON without blocking manual edits',()=>{
  const p=ensureStays(newProject(true)),date=Object.keys(p.days)[0],other=date==='2026-12-01'?'2026-12-02':'2026-12-01';p.instructors=[{id:'i',name:'Инструктор'}];
  const a=p.days[date].appointments[0];Object.assign(a,{locked:true,instructorId:'i'});copyScheduleDay(p,date,other,{appointments:true});assert.equal(p.days[other].appointments[0].locked,true);
  const moved=transferAppointment(p,date,a.id,other,true);assert.equal(moved.locked,true);assert.equal(moved.instructorId,'i');moved.start=600;validateProject(JSON.parse(JSON.stringify(p)));
});
test('malformed instructor references and nonboolean lock flags are rejected',()=>{
  const p=ensureStays(newProject(true));p.instructors=[{id:'i',name:'Инструктор'}];const a=Object.values(p.days)[0].appointments[0];
  a.locked='true';assert.throws(()=>validateProject(p));a.locked=false;a.instructorId='missing';assert.throws(()=>validateProject(p));a.instructorId=null;p.procedures[0].instructorId='missing';assert.throws(()=>validateProject(p));
});
