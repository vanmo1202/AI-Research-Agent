const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSecretFiles } = require('../src/config/environment');
test('File secrets load without dotenv and never expose values or paths on errors', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-files-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'fake-sensitive-path');
  fs.writeFileSync(file, 'synthetic-key-only\n', { mode: 0o600 });
  const env = { INTERNAL_API_KEY_FILE: file };
  loadSecretFiles(env);
  assert.equal(env.INTERNAL_API_KEY, 'synthetic-key-only');
  assert.throws(() => loadSecretFiles({ ...env }), /Conflicting secret sources/);
  for (const value of ['', 'x'.repeat(8193)]) {
    fs.writeFileSync(file, value);
    assert.throws(() => loadSecretFiles({ GEMINI_API_KEY_FILE: file }), error =>
      error.message === 'Cannot load secret file for GEMINI_API_KEY');
  }
  assert.throws(() => loadSecretFiles({ TAVILY_API_KEY_FILE: dir }), /Cannot load secret file/);
  assert.throws(() => loadSecretFiles({ TAVILY_API_KEY_FILE: file + '.missing' }), error =>
    !error.message.includes(dir) && !error.message.includes('synthetic-key-only'));
});
