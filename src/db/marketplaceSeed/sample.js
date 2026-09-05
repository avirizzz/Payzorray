function seededShuffle(arr, seed) {
  const out = [...arr];
  let s = seed % 2147483647 || 1;
  function rand() {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stratifiedSample(rows, { categoryOf, floor = 10, targetTotal, capPerCategory = Infinity, weightOf = () => 1, seed = 42 }) {
  const byCategory = new Map();
  for (const row of rows) {
    const cat = categoryOf(row);
    if (!cat) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(row);
  }

  const entries = [...byCategory.entries()];
  const qualifying = entries.filter(([, list]) => list.length >= floor);
  const droppedCategories = entries
    .filter(([, list]) => list.length < floor)
    .map(([cat, list]) => ({ cat, count: list.length }));

  const allocation = new Map();
  let floorTotal = 0;
  for (const [cat, list] of qualifying) {
    const take = Math.min(floor, list.length);
    allocation.set(cat, take);
    floorTotal += take;
  }

  const remaining = Math.max(0, targetTotal - floorTotal);
  const weighted = qualifying.map(([cat, list]) => ({ cat, size: list.length, w: Math.sqrt(list.length) * weightOf(cat) }));
  const totalWeight = weighted.reduce((sum, x) => sum + x.w, 0) || 1;

  for (const { cat, size, w } of weighted) {
    const share = Math.round((w / totalWeight) * remaining);
    const cap = Math.min(size, capPerCategory);
    const current = allocation.get(cat);
    allocation.set(cat, Math.min(cap, current + share));
  }

  const picked = [];
  for (const [cat, list] of qualifying) {
    const n = allocation.get(cat);
    const shuffled = seededShuffle(list, seed + cat.length);
    picked.push(...shuffled.slice(0, n));
  }

  return {
    picked,
    droppedCategories,
    categoryCounts: [...allocation.entries()].sort((a, b) => b[1] - a[1])
  };
}

module.exports = { stratifiedSample, seededShuffle };
