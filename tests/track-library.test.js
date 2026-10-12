import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { uniqueLibraryTracks } from '../track-library.js';

const manifest = JSON.parse(await readFile(new URL('../assets/tracks/lesson-tracks.json', import.meta.url), 'utf8'));

test('a deck lists each audio file once, while retaining every lesson source', () => {
  const tracks = uniqueLibraryTracks(manifest, 'a');
  assert.equal(tracks.length, new Set(tracks.map(track => track.file)).size);
  assert.deepEqual(tracks.find(track => track.title === 'Madoromi')?.courses, ['c06', 'c07']);
  assert.deepEqual(tracks.find(track => track.title === 'EDM at Midnight')?.courses, ['intro', 'c00']);
});

test('different files stay separate even when they belong to the same lesson', () => {
  const tracks = uniqueLibraryTracks(manifest, 'b');
  assert.equal(tracks.length, new Set(tracks.map(track => track.file)).size);
  assert.ok(tracks.some(track => track.title === 'All Night'));
  assert.ok(tracks.some(track => track.title === '我只在乎你'));
  assert.deepEqual(tracks.find(track => track.title === '十年')?.courses, ['c04', 'c05']);
});
