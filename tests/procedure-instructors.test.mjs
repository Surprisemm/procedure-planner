import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,validateProject,removeInstructor,updateProcedureTemplate,instructorColor,upgradeProcedureInstructors,createStay} from '../domain.mjs';

function legacy(){
  const p=newProject(true),date=Object.keys(p.days)[0];
  p.instructors=[{id:'y',name:'Юлия'},{id:'o',name:'Олимпиада'},{id:'n',name:'Наталья'}];
  const first=p.procedures[0],second=p.procedures[1];
  delete first.instructors;delete second.instructors;for(const x of p.procedures)delete x.instructors;
  first.instructorId='y';
  const copy={...first,id:'copy',instructorId:'o',color:'#112233'},same={...first,id:'same',instructorId:'n',color:first.color};
  p.procedures.push(copy,same);
  p.days[date].appointments[0].procedureId='copy';
  return {p,date,first,second};
}
test('old per-instructor copies merge into one card and keep their colours',()=>{
  const {p,date,first}=legacy();
  ensureStays(p);validateProject(p);
  const merged=p.procedures.filter(x=>x.name===first.name);
  assert.equal(merged.length,1);assert.equal(merged[0].id,first.id);
  assert.deepEqual(merged[0].instructors.map(w=>w.instructorId),['y','o','n']);
  assert.equal(merged[0].instructors[1].color,'#112233');
  assert.equal(merged[0].instructors[2].color,first.color,'a copy keeps its colour even when it matches');
  assert.equal(p.days[date].appointments[0].procedureId,first.id);
  assert.ok(!('instructorId' in merged[0]));
  const again=JSON.stringify(p.procedures);ensureStays(p);assert.equal(JSON.stringify(p.procedures),again,'upgrade runs once');
});
test('the upgrade also repoints other schedules and saved generator settings',()=>{
  const {p,first}=legacy();
  const date='2030-01-07',{days:_days,...rest}=p;
  p.stays=[{id:'cur',name:'Текущее'},{id:'old',name:'Старое',patients:[],rosterVersion:1,days:{[date]:{...Object.values(p.days)[0],date,columns:[],appointments:[{id:'x',procedureId:'copy',patientId:'gone'}],disabledPatientIds:[]}},autofill:{links:[],groups:{},weekdays:{1:{instructors:{copy:{enabled:false}}}}}}];p.currentStayId='cur';
  upgradeProcedureInstructors(p);
  const old=p.stays[1];
  assert.equal(old.days[date].appointments[0].procedureId,first.id);
  assert.deepEqual(old.autofill.weekdays[1].instructors,{[`${first.id}:o`]:{enabled:false}});
});
test('the first instructor uses the procedure colour, the rest their own',()=>{
  const procedure={color:'#111111',instructors:[{instructorId:'a',color:'#222222'},{instructorId:'b',color:'#333333'}]};
  assert.equal(instructorColor(procedure,'a'),'#111111');assert.equal(instructorColor(procedure,'b'),'#333333');assert.equal(instructorColor(procedure,null),'#111111');
  assert.equal(instructorColor({color:'#111111'},'a'),'#111111');
});
test('colour propagation respects each appointment\'s instructor',()=>{
  const p=ensureStays(newProject(true)),date=Object.keys(p.days)[0],procedure=p.procedures[0];
  p.instructors=[{id:'a',name:'А'},{id:'b',name:'Б'}];
  procedure.instructors=[{instructorId:'a',color:procedure.color},{instructorId:'b',color:'#123456'}];
  const list=p.days[date].appointments.filter(x=>x.procedureId===procedure.id);
  assert.ok(list.length>=2);list[0].instructorId='a';list[1].instructorId='b';
  updateProcedureTemplate(p,date,procedure.id,{color:'#abcdef'},{applyToDay:true});
  assert.equal(list[0].color,'#abcdef');assert.equal(list[1].color,'#123456');
  assert.equal(procedure.instructors[0].color,'#abcdef','the first instructor follows the background');assert.equal(procedure.instructors[1].color,'#123456');
  updateProcedureTemplate(p,date,procedure.id,{instructors:[{instructorId:'a',color:'#abcdef'},{instructorId:'b',color:'#654321'}]},{applyToDay:true});
  assert.equal(list[1].color,'#654321');
  updateProcedureTemplate(p,date,procedure.id,{instructors:[{instructorId:'a',color:'#abcdef'}]},{applyToDay:true});
  assert.equal(list[1].instructorId,'a','an appointment of a removed instructor moves to the first');assert.equal(list[1].color,'#abcdef');
  validateProject(p);
});
test('removing an instructor from the directory clears every list; bad lists are rejected',()=>{
  const p=ensureStays(newProject(true));p.instructors=[{id:'a',name:'А'},{id:'b',name:'Б'}];
  p.procedures[0].instructors=[{instructorId:'a',color:'#ffffff'},{instructorId:'b',color:'#000000'}];
  removeInstructor(p,'a');assert.deepEqual(p.procedures[0].instructors.map(w=>w.instructorId),['b']);validateProject(p);
  p.procedures[0].instructors=[{instructorId:'b',color:'#000000'},{instructorId:'b',color:'#ffffff'}];assert.throws(()=>validateProject(p),/инструкторов/);
  p.procedures[0].instructors=[{instructorId:'b',color:'red'}];assert.throws(()=>validateProject(p),/инструктор/);
});
test('instructor lists survive a new schedule and a JSON round trip',()=>{
  const p=ensureStays(newProject(true)),date=Object.keys(p.days)[0];p.instructors=[{id:'a',name:'А'}];p.procedures[0].instructors=[{instructorId:'a',color:'#ffffff'}];
  createStay(p,'Другое',date,false,date);
  assert.equal(validateProject(JSON.parse(JSON.stringify(p))).procedures[0].instructors.length,1);
});
