// Only blocks dragged from the timeline can scroll it, immediately at an edge.
export function dragScrollDelta(drag,pointer,rect,gutter=112){
  if(drag.type!=='appointment')return {x:0,y:0};
  const inside=pointer.x>=rect.left+gutter&&pointer.x<=rect.right&&pointer.y>=rect.top+76&&pointer.y<=rect.bottom;
  if(!inside)return {x:0,y:0};
  const directionY=pointer.y>rect.bottom-40?1:pointer.y<rect.top+110?-1:0;
  const directionX=pointer.x>rect.right-35?1:pointer.x<rect.left+gutter+33?-1:0;
  return {x:directionX*10,y:directionY*9};
}
