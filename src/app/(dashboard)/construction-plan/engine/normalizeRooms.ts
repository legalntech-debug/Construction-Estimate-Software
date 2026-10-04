/* Shared by plan view AND section/elevation engine (single source of truth for rooms/doors). */
export const normalizeRoomList = (input: any[], W: number, H: number): any[] => {
  const EPS = 0.2;
  const rooms: any[] = input.map((r: any) => ({
    ...r,
    doors: Array.isArray(r.doors) ? r.doors.map((d: any) => ({ ...d })) : [],
    windows: Array.isArray(r.windows) ? r.windows.map((w: any) => ({ ...w })) : [],
  }));

  const up = (r: any) => String(r?.name || "").toUpperCase();
  const has = (r: any, ...keys: string[]) => keys.some((k) => up(r).includes(k));
  const isStair = (r: any) => r.type === "stairs" || has(r, "STAIR");
  const isHall = (r: any) => has(r, "LIVING", "HALL", "DRAWING") && !isStair(r) && !has(r, "KITCHEN");
  const isCirc = (r: any) => (has(r, "PASSAGE", "CORRIDOR", "LIVING", "HALL", "DRAWING", "DINING")) && !isStair(r) && !has(r, "KITCHEN");
  const xOv = (a: any, b: any) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOv = (a: any, b: any) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const overlaps = (a: any, b: any) => xOv(a, b) > 0.05 && yOv(a, b) > 0.05;
  const contains = (p: any, r: any) =>
    r.x >= p.x - 0.05 && r.y >= p.y - 0.05 && r.x + r.w <= p.x + p.w + 0.05 && r.y + r.h <= p.y + p.h + 0.05 && p.w * p.h > r.w * r.h + 0.5;
  const onBoundary = (r: any, wall: string) =>
    wall === "TOP" ? r.y <= EPS :
    wall === "BOTTOM" ? r.y + r.h >= H - EPS :
    wall === "LEFT" ? r.x <= EPS :
    r.x + r.w >= W - EPS;
  const OPP: Record<string, string> = { TOP: "BOTTOM", BOTTOM: "TOP", LEFT: "RIGHT", RIGHT: "LEFT" };

  const addDoor = (room: any, wall: string, nb: any, width: number, tag: string) => {
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    const r0 = horizontal ? room.x : room.y;
    const lo = Math.max(r0, horizontal ? nb.x : nb.y);
    const hi = Math.min(r0 + (horizontal ? room.w : room.h), horizontal ? nb.x + nb.w : nb.y + nb.h);
    const span = hi - lo;
    if (span < 2.4) return;
    const w = Math.min(width, Math.max(2.5, span - 1));
    const start = lo + Math.max(0.5, (span - w) / 2);
    const id = `shared-norm-${tag}-${String(room.id ?? room.name)}`;
    room.doors.push({
      id, sharedOpeningId: id, wall, offsetFeet: Number((start - r0).toFixed(3)), widthFeet: w,
      heightFeet: 7, swingInside: true, hingeSide: "START", renderSymbol: true, doorType: "INTERNAL",
    });
  };

  const hasDoorBetween = (room: any, wall: string, nb: any) => {
    const horizontal = wall === "TOP" || wall === "BOTTOM";
    const r0 = horizontal ? room.x : room.y;
    const lo = Math.max(r0, horizontal ? nb.x : nb.y);
    const hi = Math.min(r0 + (horizontal ? room.w : room.h), horizontal ? nb.x + nb.w : nb.y + nb.h);
    const covers = (owner: any, ownWall: string, d: any) => {
      if (d.wall !== ownWall || d.renderSymbol === false) return false;
      const g0 = (horizontal ? owner.x : owner.y) + Number(d.offsetFeet || 0);
      const g1 = g0 + Number(d.widthFeet ?? 0);
      return g1 > lo + 0.05 && g0 < hi - 0.05;
    };
    return room.doors.some((d: any) => covers(room, wall, d)) || nb.doors.some((d: any) => covers(nb, OPP[wall], d));
  };

  const band = rooms.filter((r) => !isStair(r) && Math.abs(r.y + r.h - H) <= EPS && has(r, "PARKING", "KITCHEN"));
  if (band.length >= 2) {
    const topY = Math.min(...band.map((r) => r.y));
    band.forEach((r) => {
      if (r.y <= topY + 0.05) return;
      const strip = { x: r.x, y: topY, w: r.w, h: r.y - topY };
      if (rooms.some((o) => o !== r && overlaps(strip, o))) return;
      const delta = r.y - topY;
      r.h += delta; r.y = topY;
      [...r.doors, ...r.windows].forEach((o: any) => {
        if (o.wall === "LEFT" || o.wall === "RIGHT") o.offsetFeet = Number(o.offsetFeet || 0) + delta;
      });
    });
  }

  rooms.filter(isHall).forEach((h) => {
    const bottom = h.y + h.h;
    if (bottom >= H - EPS) return;
    let limit = H;
    rooms.forEach((o) => { if (o !== h && xOv(h, o) > 0.12 && o.y >= bottom - 0.05) limit = Math.min(limit, o.y); });
    const gap = limit - bottom;
    if (limit >= H - EPS || gap <= 0.05 || gap > 8) return;
    const strip = { x: h.x, y: bottom, w: h.w, h: gap };
    if (rooms.some((o) => o !== h && overlaps(strip, o))) return;
    h.h += gap;
    h.doors = h.doors.filter((d: any) => d.wall !== "BOTTOM");
    h.windows = h.windows.filter((w: any) => w.wall !== "BOTTOM");
  });

  rooms.filter((r) => has(r, "ATTACHED") || (has(r, "BATH", "TOILET") && !has(r, "COMMON"))).forEach((b) => {
    const parent = rooms.find((p) => p !== b && has(p, "BEDROOM") && contains(p, b));
    if (!parent || parent.w > 12.01 || b.h <= b.w) return;
    const below = rooms.some((o) => o !== parent && isCirc(o) && Math.abs(parent.y + parent.h - o.y) <= 0.25 && xOv(parent, o) >= 2.5);
    const above = rooms.some((o) => o !== parent && isCirc(o) && Math.abs(o.y + o.h - parent.y) <= 0.25 && xOv(parent, o) >= 2.5);
    const entry = below ? "BOTTOM" : above ? "TOP" : null;
    if (!entry) return;
    const bw = Math.min(parent.w - 3.5, Math.max(5, Math.round(parent.w * 0.55 * 4) / 4));
    if (bw < 4) return;
    const area = Math.max(b.w * b.h, 30);
    const bh = Math.min(5, Math.max(4.5, Math.ceil((area / bw) * 4) / 4));
    if (parent.h - bh < 4) return;
    b.w = bw; b.h = bh; b.x = parent.x;
    b.y = entry === "BOTTOM" ? parent.y + parent.h - bh : parent.y;
    b.doors = [];
    const doorWall = entry === "BOTTOM" ? "TOP" : "BOTTOM";
    const dw = 2.5;
    const id = `shared-norm-bath-door-${String(b.id ?? b.name)}`;
    b.doors.push({ id, sharedOpeningId: id, wall: doorWall, offsetFeet: Number(((bw - dw) / 2).toFixed(2)), widthFeet: dw, heightFeet: 7, swingInside: true, hingeSide: "START", renderSymbol: true, doorType: "INTERNAL" });
    b.windows = b.windows.filter((w: any) => onBoundary(b, w.wall));
    if (b.windows.length === 0) {
      const wall = (["LEFT", "RIGHT", "TOP", "BOTTOM"] as const).find((s) => onBoundary(b, s));
      if (wall) {
        const len = wall === "TOP" || wall === "BOTTOM" ? b.w : b.h;
        b.windows.push({ id: `norm-bath-vent-${String(b.id ?? b.name)}`, wall, offsetFeet: Number(((len - 1.5) / 2).toFixed(2)), lengthFeet: 1.5, widthFeet: 1.5, type: "VENTILATOR" });
      }
    }
  });

  const isPrivate = (r: any) => has(r, "BEDROOM", "BATH", "TOILET", "DRESS", "STORE", "POOJA", "STUDY") && !has(r, "PARKING");
  const bestInterval = (lo: number, hi: number, forbidden: [number, number][], need: number): [number, number] | null => {
    const sorted = forbidden.filter((f) => f[1] > lo && f[0] < hi).sort((a, b) => a[0] - b[0]);
    let cur = lo; let best: [number, number] | null = null;
    const consider = (a: number, b: number) => { if (b - a >= need && (!best || b - a > best[1] - best[0])) best = [a, b]; };
    for (const [f0, f1] of sorted) { consider(cur, Math.min(f0, hi)); cur = Math.max(cur, f1); }
    consider(cur, hi);
    return best;
  };

  rooms.filter(isPrivate).forEach((r) => {
    const parent = rooms.find((p) => p !== r && has(p, "BEDROOM") && contains(p, r));
    const subs = rooms.filter((s) => s !== r && !isStair(s) && contains(r, s));
    r.doors.forEach((d: any) => {
      if (!onBoundary(r, d.wall)) return;
      const dw = Math.min(Number(d.widthFeet) || 3, 3);
      let pick: { wall: string; a: number; b: number; score: number } | null = null;

      (["BOTTOM", "TOP", "LEFT", "RIGHT"] as const).forEach((wall) => {
        if (onBoundary(r, wall)) return;
        const horizontal = wall === "TOP" || wall === "BOTTOM";
        const r0 = horizontal ? r.x : r.y;
        const r1 = r0 + (horizontal ? r.w : r.h);
        const fixed = wall === "TOP" ? r.y : wall === "BOTTOM" ? r.y + r.h : wall === "LEFT" ? r.x : r.x + r.w;
        const forbidden: [number, number][] = subs
          .filter((s) => (wall === "TOP" ? s.y - r.y : wall === "BOTTOM" ? r.y + r.h - (s.y + s.h) : wall === "LEFT" ? s.x - r.x : r.x + r.w - (s.x + s.w)) < 1.2)
          .map((s) => (horizontal ? [s.x - 0.25, s.x + s.w + 0.25] : [s.y - 0.25, s.y + s.h + 0.25]) as [number, number]);

        if (parent) {
          const depth = wall === "TOP" ? r.y - parent.y : wall === "BOTTOM" ? parent.y + parent.h - (r.y + r.h) : wall === "LEFT" ? r.x - parent.x : parent.x + parent.w - (r.x + r.w);
          if (depth < 2.5) return;
          const itv = bestInterval(r0, r1, forbidden, dw + 0.4);
          if (itv && (!pick || depth > pick.score)) pick = { wall, a: itv[0], b: itv[1], score: depth };
          return;
        }
        rooms.forEach((o) => {
          if (o === r || !isCirc(o)) return;
          const adjacent = wall === "TOP" ? Math.abs(o.y + o.h - fixed) <= 0.25 : wall === "BOTTOM" ? Math.abs(o.y - fixed) <= 0.25 : wall === "LEFT" ? Math.abs(o.x + o.w - fixed) <= 0.25 : Math.abs(o.x - fixed) <= 0.25;
          if (!adjacent) return;
          const lo = Math.max(r0, horizontal ? o.x : o.y);
          const hi = Math.min(r1, horizontal ? o.x + o.w : o.y + o.h);
          const itv = bestInterval(lo, hi, forbidden, dw + 0.6);
          if (!itv) return;
          const score = (has(o, "PASSAGE") ? 100 : 0) + (itv[1] - itv[0]);
          if (!pick || score > pick.score) pick = { wall, a: itv[0], b: itv[1], score };
        });
      });

      if (pick) {
        const p = pick as { wall: string; a: number; b: number; score: number };
        const horizontal = p.wall === "TOP" || p.wall === "BOTTOM";
        const start = p.a + Math.max(0.3, (p.b - p.a - dw) / 2);
        d.wall = p.wall;
        d.widthFeet = dw;
        d.offsetFeet = Number((start - (horizontal ? r.x : r.y)).toFixed(3));
        d.swingInside = true;
        d.renderSymbol = true;
        d.sharedOpeningId = `shared-reloc-${String(d.id || "door")}`;
      }
    });
  });

  rooms.filter((r) => has(r, "PARKING")).forEach((p) => {
    const hall = rooms.find((h) => isCirc(h) && Math.abs(h.y + h.h - p.y) <= 0.25 && xOv(h, p) >= 3);
    if (hall && !hasDoorBetween(p, "TOP", hall)) addDoor(p, "TOP", hall, 3, "parking-hall");
  });
  rooms.filter((r) => has(r, "KITCHEN") && !isStair(r)).forEach((k) => {
    if (k.doors.length > 0) return;
    const hall = rooms.find((h) => isCirc(h) && Math.abs(h.y + h.h - k.y) <= 0.25 && xOv(h, k) >= 2.5);
    if (hall && !hasDoorBetween(k, "TOP", hall)) addDoor(k, "TOP", hall, 2.5, "kitchen-hall");
  });

  rooms.forEach((r) => r.doors.forEach((d: any) => { d.__onBoundary = onBoundary(r, d.wall); }));

  return rooms;
};
