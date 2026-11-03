/*
 * 浏览器合同入口：自动发现 tests/browser/*.browser.mjs，逐个串跑。
 * 加合同不用改 package.json 或 CI。一份失败不影响其余继续跑，最后统一汇报。
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const contracts = readdirSync(dir).filter((file) => file.endsWith('.browser.mjs')).sort();
const TIMEOUT_MS = 5 * 60 * 1000;
const failed = [];

for (const file of contracts) {
  console.log(`\n▶ ${file}`);
  const { status, error } = spawnSync(process.execPath, ['--experimental-websocket', `${dir}${file}`], {
    stdio: 'inherit',
    timeout: TIMEOUT_MS,
  });
  if (status !== 0) failed.push(error ? `${file}（${error.code}）` : file);
}

console.log(`\n浏览器合同：${contracts.length - failed.length}/${contracts.length} 通过`);
if (failed.length) {
  console.error(`✗ 失败：${failed.join('、')}`);
  process.exit(1);
}
