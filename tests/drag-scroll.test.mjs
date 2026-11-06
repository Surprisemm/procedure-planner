import test from 'node:test';
import assert from 'node:assert/strict';
import {dragScrollDelta} from '../drag-scroll.mjs';
const rect={left:0,right:800,top:0,bottom:600};
const edges=[{x:350,y:590},{x:350,y:90},{x:795,y:350},{x:120,y:350}];
test('library drags never scroll at any edge or after repeated frames',()=>{
  const drag={type:'procedure'};
  for(let frame=0;frame<100;frame++)for(const point of edges)assert.deepEqual(dragScrollDelta(drag,point,rect),{x:0,y:0});
});
test('timeline drags scroll immediately at all four edges and on direction changes',()=>{
  const drag={type:'appointment'};
  const expected=[{x:0,y:9},{x:0,y:-9},{x:10,y:0},{x:-10,y:0}];
  edges.forEach((point,i)=>assert.deepEqual(dragScrollDelta(drag,point,rect),expected[i]));
  assert.deepEqual(dragScrollDelta(drag,{x:795,y:590},rect),{x:10,y:9});
});
test('timeline drags stop outside the body or away from its edges and resume immediately',()=>{
  const drag={type:'appointment'};
  for(const point of [{x:350,y:350},{x:50,y:590},{x:350,y:70},{x:810,y:590},{x:350,y:610}])assert.deepEqual(dragScrollDelta(drag,point,rect),{x:0,y:0});
  assert.equal(dragScrollDelta(drag,edges[0],rect).y,9);
});
