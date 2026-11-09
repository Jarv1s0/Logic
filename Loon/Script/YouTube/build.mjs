import {build} from 'esbuild';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const entries = ['feed', 'feed-request', 'playback-request', 'playback-response', 'config', 'config-request', 'logger', 'channels', 'caption'];
const licenses = await Promise.all((await readdir('licenses')).filter(name => name.endsWith('.txt')).map(async name => name + '\n' + await readFile('licenses/' + name, 'utf8')));
const banner = '/*! Logic YouTube. devchristian1337, Horatio Xu, Jarv1s0.\n' + licenses.join('\n\n') + '\n*/';
const manifest = {};
for (const name of entries) {
  const file = name + '.min.js';
  const result = await build({entryPoints: ['src/entries/' + name + '.mjs'], outfile: file,
    bundle: true, platform: 'browser', format: 'iife', target: 'es2020', charset: 'utf8',
    minify: true, legalComments: 'inline', banner: {js: banner}, metafile: true});
  const bytes = await readFile(file);
  manifest[file] = {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    modules: Object.entries(result.metafile.outputs[file].inputs).filter(([, value]) => value.bytesInOutput).map(([name]) => name)};
}
await writeFile('build-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(Object.entries(manifest).map(([name, value]) => name + ': ' + value.bytes + ' bytes').join('\n'));
