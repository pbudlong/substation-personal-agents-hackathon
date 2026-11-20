import {readFile, readdir} from 'node:fs/promises';

import {readAirbyteSql, applyAirbyte, queryCognee, sendAmplitude, agentEvents, saveSql, readSql} from './sponsors.mjs';
import {write as syncCatalog} from './integrations/airbyte-singlestore/connector.mjs';

const sourceFiles = {
  airbyte: [applyAirbyte, readAirbyteSql, syncCatalog],
  cognee: [queryCognee],
  amplitude: [sendAmplitude, agentEvents],
  singleStore: [saveSql, readSql]
};

function partnerCodeFile() {
  const sources = Object.fromEntries(Object.entries(sourceFiles).map(([partner, functions]) => [
    partner, functions.map(fn => ({
      name: fn.name,
      file: fn === syncCatalog ? 'integrations/airbyte-singlestore/connector.mjs' : 'sponsors.mjs',
      code: fn.toString()
    }))
  ]));
  return {mime:'application/json; charset=utf-8', bytes:Buffer.from(JSON.stringify(sources))};
}

const fileTypes = {html:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', json:'application/json; charset=utf-8', jpg:'image/jpeg', webp:'image/webp'};
const localFiles = new Map();

for (const directory of ['demo', 'evidence']) {
  const folder = new URL('./' + directory + '/', import.meta.url);
  for (const file of await readdir(folder, {withFileTypes:true})) {
    const mime = fileTypes[file.name.split('.').pop()];
    if (file.isFile() && mime) localFiles.set(file.name, {mime, url:new URL(file.name, folder)});
  }
}

export async function getDemoFile(name) {
  if (name === 'partner-code.json') return partnerCodeFile();
  const entry = localFiles.get(name);
  if (!entry) return null;
  return {mime:entry.mime, bytes:await readFile(entry.url)};
}

export async function bundleDemoFiles() {
  const entries = [];
  for (const name of [...localFiles.keys(), 'partner-code.json']) {
    const {mime, bytes} = await getDemoFile(name);
    entries.push([name, {mime, data:bytes.toString('base64')}]);
  }
  return Object.fromEntries(entries);
}
