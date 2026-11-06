import fs from 'node:fs';
import path from 'node:path';
import {validateProject} from '../domain.mjs';
export const MAX_PROJECT_BYTES=15*1024*1024;
// Import prior releases once; leave their original files untouched.
export function migrateLegacyAutosave(source,destination){
  const saves=['autosave.json','autosave.previous.json'];
  if(saves.some(file=>fs.existsSync(path.join(destination,file)))||!saves.some(file=>fs.existsSync(path.join(source,file))))return false;
  fs.mkdirSync(destination,{recursive:true});
  for(const file of [...saves,'window.json']){
    const from=path.join(source,file),to=path.join(destination,file);
    if(fs.existsSync(from)&&!fs.existsSync(to))fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  }
  return true;
}
export function parseProject(text){
  if(typeof text!=='string'||Buffer.byteLength(text)>MAX_PROJECT_BYTES)throw Error('Размер проекта превышает 15 МБ');
  return validateProject(JSON.parse(text));
}
export function loadAutosave(directory){
  const primary=path.join(directory,'autosave.json'),backup=path.join(directory,'autosave.previous.json');
  if(!fs.existsSync(primary)&&!fs.existsSync(backup))return {data:null};
  for(const file of [primary,backup]){
    try {const data=fs.readFileSync(file,'utf8');parseProject(data);return {data,warning:file===backup?'Восстановлена предыдущая резервная копия автосохранения.':''};}catch{}
  }
  return {data:null,error:'Не удалось прочитать автосохранение. Исходные файлы сохранены. Откройте резервный файл проекта.'};
}
export function saveAutosave(directory,text){
  parseProject(text);fs.mkdirSync(directory,{recursive:true});
  const primary=path.join(directory,'autosave.json'),backup=path.join(directory,'autosave.previous.json'),temporary=path.join(directory,'autosave.tmp');
  if(fs.existsSync(primary)){
    try {parseProject(fs.readFileSync(primary,'utf8'));fs.copyFileSync(primary,backup);}catch(error){if(error.code)throw error;}
  }
  const fd=fs.openSync(temporary,'w');
  try{fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temporary,primary);
  return {ok:true};
}
