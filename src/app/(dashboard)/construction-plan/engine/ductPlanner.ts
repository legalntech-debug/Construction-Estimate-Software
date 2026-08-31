import { FloorRoom } from './planningTypes';

function kind(r: FloorRoom) {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('duct')) return 'duct';
  return 'other';
}

export function optimizeWetCore(rooms: FloorRoom[]): FloorRoom[] {
  const wet = rooms.filter(r => kind(r) === 'bathroom');
  if (!wet.length) return rooms;
  const ducts = rooms.filter(r => kind(r) === 'duct');
  if (ducts.length) return rooms;
  const right = Math.max(...rooms.map(r => Number(r.x || 0) + Number(r.w || 0)), 0);
  const y = Math.min(...wet.map(r => Number(r.y || 0)));
  const h = Math.max(...wet.map(r => Number(r.h || 0)), 5);
  return [...rooms, {
    id: `duct_auto_${Date.now()}`,
    name: 'DUCT', label: 'DUCT', roomType: 'duct', type: 'duct',
    x: Math.max(0, right - 1.5), y, w: 1.5, h,
    selected: true, count: 1, areaMode: 'AUTO', areaPerRoom: 1.5 * h,
  }];
}
