import { FloorRoom } from './planningTypes';
import { findSharedBoundary } from './doorWindowRules';

function typeOf(r: FloorRoom): string {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('parking')) return 'parking';
  if (s.includes('living') || s.includes('hall') || s.includes('drawing')) return 'hall';
  if (s.includes('stair')) return 'stairs';
  if (s.includes('bedroom') || s.includes('master')) return 'bedroom';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('dining')) return 'dining';
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('duct')) return 'duct';
  if (s.includes('passage')) return 'passage';
  return 'room';
}

function touches(a: FloorRoom, b: FloorRoom): boolean {
  const ax = Number(a.x || 0), ay = Number(a.y || 0), aw = Number(a.w || 0), ah = Number(a.h || 0);
  const bx = Number(b.x || 0), by = Number(b.y || 0), bw = Number(b.w || 0), bh = Number(b.h || 0);
  const xOverlap = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const yOverlap = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  const horizontal = Math.abs(ay + ah - by) < .08 || Math.abs(by + bh - ay) < .08;
  const vertical = Math.abs(ax + aw - bx) < .08 || Math.abs(bx + bw - ax) < .08;
  return (horizontal && xOverlap > .5) || (vertical && yOverlap > .5);
}

export interface CirculationResult {
  connected: boolean;
  startRoom?: string;
  unreachableRooms: string[];
  edges: Array<{ from: string; to: string; reason: string }>;
}

function hasActualDoorBetween(a: FloorRoom, b: FloorRoom, rooms: FloorRoom[]): boolean {
  const ia = rooms.indexOf(a);
  const ib = rooms.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  const boundary = findSharedBoundary(a as any, ia, b as any, ib);
  if (!boundary) return false;
  const aDoors = Array.isArray(a.doors) ? a.doors : [];
  const bDoors = Array.isArray(b.doors) ? b.doors : [];
  return aDoors.some((d: any) => d.wall === boundary.wallForA && Number(d.widthFeet) > 0) ||
    bDoors.some((d: any) => d.wall === boundary.wallForB && Number(d.widthFeet) > 0);
}

/** Logical access graph for the generated plan. It is intentionally independent from CAD drawing. */
export function buildCirculationGraph(rooms: FloorRoom[]): CirculationResult {
  const active = rooms.filter(r => typeOf(r) !== 'duct' && (r as any).parkingZone !== 'EXTENSION');
  if (!active.length) return { connected: true, unreachableRooms: [], edges: [] };
  const parking = active.find(r => typeOf(r) === 'parking');
  const hall = active.find(r => typeOf(r) === 'hall');
  const start = parking || hall || active[0];
  const visited = new Set<string>([String(start.id || start.name)]);
  const edges: CirculationResult['edges'] = [];
  const queue = [start];
  while (queue.length) {
    const a = queue.shift()!;
    for (const b of active) {
      const aid = String(a.id || a.name), bid = String(b.id || b.name);
      if (aid === bid || visited.has(bid) || !touches(a, b) || !hasActualDoorBetween(a, b, active)) continue;
      const ta = typeOf(a), tb = typeOf(b);
      if (ta === 'bathroom' && tb === 'bathroom') continue;
      // Prefer practical hierarchy while still allowing a valid physical connection.
      const useful =
        (ta === 'parking' && tb === 'hall') || (ta === 'hall' && tb === 'parking') ||
        (ta === 'hall' && ['stairs','kitchen','dining','bedroom'].includes(tb)) ||
        (tb === 'hall' && ['stairs','kitchen','dining','bedroom'].includes(ta)) ||
        (ta === 'stairs' || tb === 'stairs') ||
        (ta === 'kitchen' && tb === 'dining') || (ta === 'dining' && tb === 'kitchen') ||
        (ta === 'bedroom' && ['bathroom','dining','kitchen','stairs','bedroom','hall'].includes(tb)) ||
        (tb === 'bedroom' && ['bathroom','dining','kitchen','stairs','bedroom','hall'].includes(ta)) ||
        (ta === 'hall' && ['room','pooja','study','utility','store'].includes(tb)) ||
        (tb === 'hall' && ['room','pooja','study','utility','store'].includes(ta));
      if (!useful) continue;
      visited.add(bid);
      queue.push(b);
      edges.push({ from: a.name || '', to: b.name || '', reason: 'shared boundary / circulation adjacency' });
    }
  }
  const unreachableRooms = active.filter(r => !visited.has(String(r.id || r.name))).map(r => r.name || 'ROOM');
  return { connected: unreachableRooms.length === 0, startRoom: start.name, unreachableRooms, edges };
}
