import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function gitBlobSha(bytes) {
  const hash = createHash('sha1');
  hash.update('blob ' + bytes.length + '\0');
  hash.update(bytes);
  return hash.digest('hex');
}

for (const [name, path, expected] of [
  ['City Fare 002 PRO', 'versions/002-pro/index.html', '3e30e181ca3203a33bcfa8dcec7d65748d4d568d'],
  ['Sonoran Run 007', 'versions/007-sonoran-run/index.html', 'a29f1bfaa2b8daa9e6ecaf84703ca2b91a18aa30']
]) {
  test(name + ' playable HTML is byte-for-byte unchanged', () => {
    assert.equal(gitBlobSha(readFileSync(new URL('../' + path, import.meta.url))), expected);
  });
}

test('comparison page links to both preserved versions', () => {
  const page = readFileSync(new URL('../compare/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('../versions/002-pro/'));
  assert.ok(page.includes('../versions/007-sonoran-run/'));
});
