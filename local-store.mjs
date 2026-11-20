import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
export function localStore(dir='.local'){
  return {
    async put(key,data){const path=join(dir,key);await mkdir(dirname(path),{recursive:true});await writeFile(path,data);},
    async get(key){try{const buffer=await readFile(join(dir,key));return {text:()=>buffer.toString()};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  };
}
