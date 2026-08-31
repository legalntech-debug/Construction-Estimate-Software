import { FloorRoom } from './planningTypes';
import { buildCirculationGraph } from './circulationEngine';

export interface PlanningScore {
  total: number;
  circulation: number;
  privacy: number;
  service: number;
  proportions: number;
  notes: string[];
}

function kind(r: FloorRoom) {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('parking')) return 'parking';
  if (s.includes('hall') || s.includes('living')) return 'hall';
  if (s.includes('stair')) return 'stairs';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('dining')) return 'dining';
  if (s.includes('bedroom') || s.includes('master')) return 'bedroom';
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('duct')) return 'duct';
  return 'other';
}

export function scorePlan(rooms: FloorRoom[]): PlanningScore {
  let circulation = 100, privacy = 100, service = 100, proportions = 100;
  const notes: string[] = [];
  const graph = buildCirculationGraph(rooms);
  if (!graph.connected) { circulation -= graph.unreachableRooms.length * 25; notes.push(`Unreachable: ${graph.unreachableRooms.join(', ')}`); }
  const parking = rooms.find(r => kind(r) === 'parking');
  const hall = rooms.find(r => kind(r) === 'hall');
  const stairs = rooms.find(r => kind(r) === 'stairs');
  if (parking && hall) {
    const direct = graph.edges.some(e => (e.from === parking.name && e.to === hall.name) || (e.from === hall.name && e.to === parking.name));
    if (!direct) circulation -= 25;
  }
  if (stairs && hall) {
    const direct = graph.edges.some(e => (e.from === stairs.name && e.to === hall.name) || (e.from === hall.name && e.to === stairs.name));
    if (!direct) circulation -= 15;
  }
  const bedrooms = rooms.filter(r => kind(r) === 'bedroom');
  for (const b of bedrooms) if ((b.y || 0) > 0) privacy += 1;
  const toilets = rooms.filter(r => kind(r) === 'bathroom');
  if (toilets.length) {
    const ducts = rooms.filter(r => kind(r) === 'duct');
    if (!ducts.length) service -= 12;
  }
  for (const r of rooms) {
    const min = Math.min(Number(r.w || 0), Number(r.h || 0));
    if (kind(r) === 'bedroom' && min < 9.5) proportions -= 12;
    if (kind(r) === 'hall' && min < 9) proportions -= 10;
    if (kind(r) === 'parking' && min < 9) proportions -= 20;
  }
  const total = Math.max(0, Math.round(circulation * .35 + privacy * .15 + service * .20 + proportions * .30));
  return { total, circulation, privacy, service, proportions, notes };
}
