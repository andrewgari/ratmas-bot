import assert from 'node:assert/strict';
import { derangement } from '../src/match.js';
import { isValidAmazonWishlist } from '../src/utils/amazon.js';
import { runRatmasCommandTests } from './ratmas.command.test.js';
import { runSchedulerTests } from './scheduler.test.js';
import { runDmRelayTests } from './dmRelay.test.js';

function testDerangement() {
  assert.equal(derangement([]), null);
  assert.equal(derangement([1]), null);
  for (let n = 2; n <= 8; n++) {
    const arr = Array.from({ length: n }, (_, i) => i);
    const d = derangement(arr);
    assert.ok(d, `derangement returned null for n=${n}`);
    assert.equal(d!.length, arr.length);
    for (let i = 0; i < n; i++) assert.notEqual(d![i], arr[i]);
    assert.deepEqual([...d!].sort(), [...arr].sort());
  }
}

function testAmazonValidation() {
  const valid = [
    'https://www.amazon.com/hz/wishlist/ls/ABC123',
    'https://amazon.com/registry/wishlist/XYZ',
    'https://www.amazon.co.uk/wishlist/ZZZ',
  ];
  const invalid = [
    'https://example.com/wishlist/abc',
    'not-a-url',
    'https://www.amazon.com/gp/cart/view.html',
  ];
  for (const u of valid) assert.equal(isValidAmazonWishlist(u), true, `should be valid: ${u}`);
  for (const u of invalid) assert.equal(isValidAmazonWishlist(u), false, `should be invalid: ${u}`);
}

async function main() {
  console.log('> derangement');
  testDerangement();
  console.log('> amazon');
  testAmazonValidation();

  console.log('> ratmas command tests');
  try { await runRatmasCommandTests(); } catch (e) { console.error('ratmas command tests failed:', e); throw e; }

  console.log('> scheduler tests');
  try { await runSchedulerTests(); } catch (e) { console.error('scheduler tests failed:', e); throw e; }

  console.log('> dm relay tests');
  try { await runDmRelayTests(); } catch (e) { console.error('dm relay tests failed:', e); throw e; }

  console.log('All tests passed.');
}

main().catch((e) => { console.error('Test run failed:', e); process.exit(1); });
