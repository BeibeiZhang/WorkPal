export function parseSemver(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const stripped = input.startsWith('v') ? input.slice(1) : input;
  const parts = stripped.split('.');
  if (parts.length !== 3) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (!Number.isInteger(n) || n < 0) return null;
    nums.push(n);
  }
  return [nums[0], nums[1], nums[2]];
}

export function compareSemver(a: [number, number, number], b: [number, number, number]): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}
