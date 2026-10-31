const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findPath } = require('./trap.js');
function valid(result, walls, width, start, goal) {
  assert.equal(result.path[0], start); assert.equal(result.path.at(-1), goal);
  result.path.forEach((cell, i) => { assert.ok(!walls.has(cell)); if (i) { const prev = result.path[i - 1]; assert.equal(Math.abs(cell % width - prev % width) + Math.abs(Math.floor(cell / width) - Math.floor(prev / width)), 1); } });
}
test('open board takes the ten-step shortest route', () => {
  const walls = new Set(), result = findPath(11, 11, walls, 55, 65);
  valid(result, walls, 11, 55, 65); assert.equal(result.path.length, 11);
});
test('new walls force a real detour; erasing restores the shorter route', () => {
  const walls = new Set([60]), result = findPath(11, 11, walls, 55, 65);
  valid(result, walls, 11, 55, 65); assert.equal(result.path.length, 13);
  walls.delete(60); assert.equal(findPath(11, 11, walls, 55, 65).path.length, 11);
});
test('sealed barrier has no path; opening a gap makes it solvable', () => {
  const walls = new Set(Array.from({ length: 11 }, (_, y) => y * 11 + 5));
  assert.deepEqual(findPath(11, 11, walls, 55, 65).path, []);
  walls.delete(5); const result = findPath(11, 11, walls, 55, 65);
  valid(result, walls, 11, 55, 65); assert.equal(result.path.length, 21);
});
test('recalculates from current position and never wraps between rows', () => {
  const result = findPath(3, 3, new Set(), 2, 3);
  valid(result, new Set(), 3, 2, 3); assert.equal(result.path.length, 4);
  assert.deepEqual(findPath(3, 3, new Set(), 8, 8).path, [8]);
});
