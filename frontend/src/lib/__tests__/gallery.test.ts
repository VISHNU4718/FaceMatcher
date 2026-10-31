import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addFace, getAllFaces, removeFace } from '../gallery';

describe('gallery (IndexedDB)', () => {
  it('stores, lists newest first, and removes faces', async () => {
    const a = await addFace('Ada', new Float32Array([0.1, 0.2]), 'data:image/jpeg;base64,AA');
    const b = await addFace('Grace', [0.3, 0.4], 'data:image/jpeg;base64,BB');
    expect(b.id).toBeGreaterThan(a.id);

    const all = await getAllFaces();
    expect(all.map((f) => f.name)).toEqual(['Grace', 'Ada']);
    expect(all[1].descriptor[0]).toBeCloseTo(0.1);

    expect(await removeFace(a.id)).toBe(true);
    expect(await removeFace(a.id)).toBe(false);
    expect((await getAllFaces()).map((f) => f.name)).toEqual(['Grace']);
  });
});
