import { FloorRoom } from './planningTypes';

function kind(r: FloorRoom) {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('duct')) return 'duct';
  return 'other';
}

// Helper: Check if a rectangle overlaps with any existing room
function overlapsAny(x: number, y: number, w: number, h: number, rooms: FloorRoom[], ignoreDucts = true): boolean {
  return rooms.some(r => {
    if (ignoreDucts && kind(r) === 'duct') return false;
    const ox = Math.min(x + w, (r.x || 0) + (r.w || 0)) - Math.max(x, r.x || 0);
    const oy = Math.min(y + h, (r.y || 0) + (r.h || 0)) - Math.max(y, r.y || 0);
    return ox > 0.15 && oy > 0.15;
  });
}

// Helper: Check if duct touches a specific room
function touchesRoom(x: number, y: number, w: number, h: number, room: FloorRoom): boolean {
  const rx = room.x || 0, ry = room.y || 0, rw = room.w || 0, rh = room.h || 0;
  const touchX = Math.abs((x + w) - rx) < 0.3 || Math.abs((rx + rw) - x) < 0.3 || (x < rx + rw && x + w > rx);
  const touchY = Math.abs((y + h) - ry) < 0.3 || Math.abs((ry + rh) - y) < 0.3 || (y < ry + rh && y + h > ry);
  return touchX && touchY;
}

/**
 * Dynamically places a DUCT only if user selected it.
 * Priority:
 *  1. Between ATTACHED TOILET and COMMON TOILET (serves both + bedroom + living)
 *  2. Near PASSAGE + COMMON TOILET (serves passage + toilet)
 *  3. Right edge of plot (fallback)
 */
export function optimizeWetCore(rooms: FloorRoom[]): FloorRoom[] {
  // 1. Agar user ne DUCT select nahi kiya to kuch mat karo
  const userSelectedDuct = rooms.some(r => kind(r) === 'duct');
  if (!userSelectedDuct) return rooms;

  // 2. Wet core rooms identify karo
  const wetRooms = rooms.filter(r => kind(r) === 'bathroom');
  if (!wetRooms.length) return rooms;

  const attachedToilet = wetRooms.find(r => r.name?.toLowerCase().includes('attached'));
  const commonToilet = wetRooms.find(r => r.name?.toLowerCase().includes('common') || r.name?.toLowerCase().includes('toilet'));
  const passage = rooms.find(r => r.name?.toLowerCase().includes('passage'));
  const livingRoom = rooms.find(r => r.name?.toLowerCase().includes('living'));
  const masterBedroom = rooms.find(r => r.name?.toLowerCase().includes('master'));

  // 3. Duct dimensions (practical minimum)
  const ductW = 1.5;
  let ductH = 4.0;
  if (attachedToilet) ductH = Math.max(4.0, (attachedToilet.h || 7) * 0.8);
  else if (commonToilet) ductH = Math.max(4.0, (commonToilet.h || 7) * 0.8);

  // 4. Candidate positions (priority based)
  type Candidate = { x: number; y: number; score: number; serves: string[] };
  const candidates: Candidate[] = [];

  const servesAll = ['ATTACHED TOILET', 'COMMON TOILET', 'MASTER BEDROOM', 'LIVING ROOM'];
  const servesToiletPassage = ['COMMON TOILET', 'PASSAGE', 'MASTER BEDROOM'];

  // Priority 1: Between Attached Toilet and Common Toilet
  if (attachedToilet && commonToilet) {
    const ax = (attachedToilet.x || 0) + (attachedToilet.w || 0);
    const ay = (attachedToilet.y || 0);
    const cx = (commonToilet.x || 0);
    const cy = (commonToilet.y || 0) + (commonToilet.h || 0);

    // Try multiple positions around the gap
    const tryPositions = [
      { x: Math.min(ax, cx), y: Math.min(ay, cy) - ductH },
      { x: Math.min(ax, cx), y: Math.max(ay, cy) },
      { x: (attachedToilet.x || 0) + (attachedToilet.w || 0), y: (commonToilet.y || 0) },
      { x: (commonToilet.x || 0) - ductW, y: (attachedToilet.y || 0) },
    ];

    for (const pos of tryPositions) {
      if (pos.x < 0 || pos.y < 0) continue;
      if (overlapsAny(pos.x, pos.y, ductW, ductH, rooms)) continue;
      candidates.push({ x: pos.x, y: pos.y, score: 100, serves: servesAll });
      break;
    }
  }

  // Priority 2: Near Passage + Common Toilet
  if (passage && commonToilet) {
    const px = (passage.x || 0) + (passage.w || 0);
    const py = (commonToilet.y || 0);
    const tryPositions = [
      { x: px, y: py },
      { x: px, y: py - ductH },
      { x: (commonToilet.x || 0) + (commonToilet.w || 0), y: py },
    ];
    for (const pos of tryPositions) {
      if (pos.x < 0 || pos.y < 0) continue;
      if (overlapsAny(pos.x, pos.y, ductW, ductH, rooms)) continue;
      candidates.push({ x: pos.x, y: pos.y, score: 80, serves: servesToiletPassage });
      break;
    }
  }

  // Priority 3: Right edge fallback
  const plotRightEdge = Math.max(...rooms.map(r => (r.x || 0) + (r.w || 0)), 0);
  const fallbackX = Math.max(0, plotRightEdge - ductW);
  const fallbackY = Math.min(...wetRooms.map(r => r.y || 0));
  if (!overlapsAny(fallbackX, fallbackY, ductW, ductH, rooms)) {
    candidates.push({ x: fallbackX, y: fallbackY, score: 50, serves: ['COMMON TOILET', 'MASTER BEDROOM'] });
  }

  // 5. Best candidate select karo
  if (!candidates.length) {
    console.warn('[DUCT PLANNER] No valid non-overlapping position found for DUCT.');
    return rooms;
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];

  // 6. Remove existing duct(s) if any, then add new one
  const withoutDucts = rooms.filter(r => kind(r) !== 'duct');
  const newDuct: FloorRoom = {
    id: `duct_auto_${Date.now()}`,
    name: 'DUCT',
    label: 'DUCT',
    roomType: 'duct',
    type: 'duct',
    x: best.x,
    y: best.y,
    w: ductW,
    h: ductH,
    selected: true,
    count: 1,
    areaMode: 'AUTO',
    areaPerRoom: ductW * ductH,
    ventilationFor: best.serves.join(' / '),
    servesRooms: best.serves,
    openToSky: true,
    serviceCore: true,
    verticalStack: true,
  };

  return [...withoutDucts, newDuct];
}