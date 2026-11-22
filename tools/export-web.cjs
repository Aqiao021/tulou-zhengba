'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const inventory = 'pwa-files.json';
const worker = 'service-worker.js';

function main(target) {
  if (!target) throw new Error('用法: node tools/export-web.cjs <空目录>');
  const destination = path.resolve(target);
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) {
    throw new Error('导出目录须为空: ' + destination);
  }
  const names = [...JSON.parse(fs.readFileSync(path.join(root, inventory), 'utf8')), inventory, worker];
  const files = [];
  const hash = createHash('sha256');
  for (const name of [...new Set(names)].sort()) {
    if (!/^(?:[\w-]+\/)*[\w.-]+$/.test(name) || name.split('/').some((part) => part.startsWith('.'))) {
      throw new Error('无效的游戏文件路径: ' + name);
    }
    const bytes = fs.readFileSync(path.join(root, name));
    hash.update(name).update('\0').update(bytes).update('\0');
    files.push([name, bytes]);
  }
  const version = hash.digest('hex').slice(0, 24);
  for (const [name, bytes] of files) {
    const file = path.join(destination, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const data = name === worker ? bytes.toString('utf8').replace(
      /^const VERSION = '[^']+';/m, "const VERSION = '" + version + "';"
    ) : bytes;
    fs.writeFileSync(file, data);
  }
  console.log('已导出 ' + files.length + ' 个运行文件，版本 ' + version);
}

try {
  main(process.argv[2]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
