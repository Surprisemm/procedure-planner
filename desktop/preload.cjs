const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ritmDesktop',Object.freeze({
  window:Object.freeze({getState:()=>ipcRenderer.invoke('ritm:window-state'),command:command=>ipcRenderer.send('ritm:window-command',command),onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('ritm:window-state',listener);return ()=>ipcRenderer.removeListener('ritm:window-state',listener);}}),
  storage:Object.freeze({load:()=>ipcRenderer.sendSync('ritm:load'),save:text=>ipcRenderer.sendSync('ritm:autosave',text)}),
  saveFile:payload=>ipcRenderer.invoke('ritm:save-file',payload),
  openProject:()=>ipcRenderer.invoke('ritm:open-project'),
  onCommand:callback=>{const listener=(_event,command)=>{if(['open-project','save-project','export','undo','redo','help'].includes(command))callback(command);};ipcRenderer.on('ritm:command',listener);return ()=>ipcRenderer.removeListener('ritm:command',listener);}
}));
