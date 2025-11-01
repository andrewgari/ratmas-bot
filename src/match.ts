export function derangement<T>(arr: T[], maxTries = 1000): T[] | null {
  if (arr.length <= 1) return null;
  for (let t = 0; t < maxTries; t++) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    if (copy.every((v, i) => v !== arr[i])) return copy;
  }
  return null;
}
