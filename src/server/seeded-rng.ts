/**
 * Deterministic PRNG for seeding the mock database (§6). `Math.random`
 * can't be seeded, so this hand-rolled generator stands in for it —
 * intentionally small rather than pulling in a dependency for something
 * this contained.
 *
 * mulberry32 (public domain, Tommy Ettinger): a fast 32-bit generator with
 * good-enough statistical quality for generating look-and-feel demo data
 * (not for anything cryptographic).
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
