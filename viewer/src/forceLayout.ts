/**
 * A small Fruchterman–Reingold force-directed graph layout.
 * Returns absolute (x, y) positions for each node id.
 *
 * Computed once per game (memoised) — for 89 nodes and 137 edges it
 * runs in well under 100 ms with 250 iterations.
 */

export interface LayoutEdge {
  source: number;
  target: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  /** Optional set of nodes to anchor near the centre. */
  hubs?: Set<number>;
}

export function forceLayout(
  nodeIds: number[],
  edges: LayoutEdge[],
  opts: LayoutOptions = {},
): Record<number, { x: number; y: number }> {
  const W = opts.width ?? 1600;
  const H = opts.height ?? 1000;
  const iterations = opts.iterations ?? 250;
  const center = { x: W / 2, y: H / 2 };
  const n = nodeIds.length;
  if (n === 0) return {};

  // Ideal edge length: square root of available area per node.
  const k = Math.sqrt((W * H) / n) * 0.7;
  const k2 = k * k;

  // Initial layout — distribute on a circle with a small jitter so
  // identical-degree nodes don't perfectly stack.
  type N = { id: number; x: number; y: number; vx: number; vy: number };
  const nodes: N[] = nodeIds.map((id, i) => {
    const angle = (i / n) * 2 * Math.PI;
    const r = Math.min(W, H) * 0.35;
    return {
      id,
      x: center.x + Math.cos(angle) * r + (Math.random() - 0.5) * 30,
      y: center.y + Math.sin(angle) * r + (Math.random() - 0.5) * 30,
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map<number, N>(nodes.map((nd) => [nd.id, nd]));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsive force between every pair of nodes.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = k2 / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Attractive spring force along each edge.
    for (const edge of edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b || a === b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }

    // Mild gravity toward centre (stronger for hub nodes, if any).
    for (const nd of nodes) {
      const gx = (center.x - nd.x) * 0.01;
      const gy = (center.y - nd.y) * 0.01;
      const hubBoost = opts.hubs?.has(nd.id) ? 5 : 1;
      nd.vx += gx * hubBoost;
      nd.vy += gy * hubBoost;
    }

    // Update positions with cooling-limited step size and damping.
    const maxStep = 60 * cooling;
    for (const nd of nodes) {
      const speed = Math.sqrt(nd.vx * nd.vx + nd.vy * nd.vy);
      const scale = speed > maxStep ? maxStep / speed : 1;
      nd.x += nd.vx * scale;
      nd.y += nd.vy * scale;
      nd.vx *= 0.5;
      nd.vy *= 0.5;
    }
  }

  const out: Record<number, { x: number; y: number }> = {};
  for (const nd of nodes) out[nd.id] = { x: nd.x, y: nd.y };
  return out;
}
