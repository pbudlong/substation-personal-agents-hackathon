import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
// All Worker modules use named imports from this fixed, dependency-ordered set.
// Emit one self-contained ES module for the Sites Worker runtime.
const files=['catalog.mjs','agent.mjs','sponsors.mjs','service.mjs','receipt.mjs','worker.mjs'];
const bundled=[];
const included=new Set();
for(const file of files){
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  const body=source.replace(/^import\s*\{[^}]+\}\s*from ['"]\.\/([^'"]+)['"];$/gm,(_line,dependency)=>{
    if(!included.has(dependency))throw Error('Unexpected Worker dependency: '+dependency);
    return '';
  });
  if(/^import\s/m.test(body)) throw Error('Worker build cannot inline an external import in '+file);
  bundled.push('// '+file+'\n'+body.replace(/^export (?=(?:async )?function |const )/gm,''));
  included.add(file);
}
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',bundled.join('\n'));
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
