import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSemver, compareSemver } from './semver.js';

describe('parseSemver', () => {
  const valid: [string, [number, number, number]][] = [
    ['0.1.8', [0, 1, 8]],
    ['v0.1.8', [0, 1, 8]],
    ['1.0.0', [1, 0, 0]],
    ['12.34.56', [12, 34, 56]],
  ];
  for (const [input, expected] of valid) {
    it(`parses "${input}"`, () => assert.deepStrictEqual(parseSemver(input), expected));
  }

  const invalid: [string | null | undefined, string][] = [
    [null, 'null'],
    [undefined, 'undefined'],
    ['', 'empty string'],
    ['1.0', 'two segments'],
    ['1.0.0.0', 'four segments'],
    ['v1.0.0-beta.1', 'prerelease suffix'],
    ['abc', 'non-numeric'],
    ['1.0.0-rc1', 'prerelease'],
  ];
  for (const [input, why] of invalid) {
    it(`rejects ${why}`, () => assert.equal(parseSemver(input), null));
  }
});

describe('compareSemver', () => {
  it('equal', () => assert.equal(compareSemver([1, 2, 3], [1, 2, 3]), 0));
  it('a < b (major)', () => assert.equal(compareSemver([0, 9, 9], [1, 0, 0]), -1));
  it('a > b (minor)', () => assert.equal(compareSemver([1, 1, 0], [1, 0, 9]), 1));
  it('a < b (patch)', () => assert.equal(compareSemver([0, 1, 7], [0, 1, 8]), -1));
});
