import {readFile, readdir} from 'node:fs/promises';

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
  const entry = localFiles.get(name);
  if (!entry) return null;
  return {mime:entry.mime, bytes:await readFile(entry.url)};
}

export async function bundleDemoFiles() {
  const entries = [];
  for (const name of localFiles.keys()) {
    const {mime, bytes} = await getDemoFile(name);
    entries.push([name, {mime, data:bytes.toString('base64')}]);
  }
  return Object.fromEntries(entries);
}
