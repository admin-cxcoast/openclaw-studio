/**
 * Port allocation — ported from Agency-AI provision-openclaw.ts (lines 41-113).
 *
 * Deterministic hash-based port in range 19000-19999 with collision avoidance.
 * Studio version takes usedPorts as argument (stateless) since ports are
 * discovered via SSH before allocation, unlike Agency-AI's in-memory map.
 */

const PORT_MIN = 19000;
const PORT_MAX = 19999;

/**
 * Compute the deterministic hash-based port for an instance name.
 * Exact same hash function from Agency-AI.
 */
function hashPort(name: string): number {
  let hash = 0;
  for (const c of name) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return PORT_MIN + (Math.abs(hash) % (PORT_MAX - PORT_MIN + 1));
}

/**
 * Allocate a port for an instance, avoiding collisions with used ports.
 * Linear scan with wraparound — same strategy as Agency-AI.
 */
export function allocatePort(
  instanceName: string,
  usedPorts: number[],
): number {
  const preferred = hashPort(instanceName);
  const usedSet = new Set(usedPorts);

  if (!usedSet.has(preferred)) return preferred;

  // Try from preferred+1 to PORT_MAX
  for (let port = preferred + 1; port <= PORT_MAX; port++) {
    if (!usedSet.has(port)) return port;
  }

  // Wrap around: PORT_MIN to preferred-1
  for (let port = PORT_MIN; port < preferred; port++) {
    if (!usedSet.has(port)) return port;
  }

  throw new Error(
    `No available ports in range ${PORT_MIN}-${PORT_MAX}`,
  );
}
