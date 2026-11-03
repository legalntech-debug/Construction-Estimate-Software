"use client";
import type { Boundaries } from "../types";
import { CYAN, ROAD_PATTERN } from "../constants";
import { averageOf, formatFeetInches, measureText, wrapByWidth } from "../helpers";

// ---------------------------------------------------------------------------
// PlotSketch: engineering style plot drawing.
//  - the drawing is turned in quarter steps so that the road side is always at the bottom; the NORTH / EAST /
//    SOUTH / WEST labels follow the rotation
//  - every side with a length gets a dimension line with arrow heads and extension lines
//  - boundary texts are wrapped by measured width and the margins are sized from the wrapped text, so no text,
//    dimension or label overlaps another one; the view box grows to fit
// ---------------------------------------------------------------------------

// Sides in clockwise order, starting at the top of a north-up drawing
const SIDE_ORDER: (keyof Boundaries)[] = ["north", "east", "south", "west"];
// When several sides touch a road, the first one in this list is placed at the bottom
const ROAD_PRIORITY: (keyof Boundaries)[] = ["south", "west", "east", "north"];

// Arrow head polygon: tip at "tip", pointing away from "toward"
const arrowHead = (tip: [number, number], toward: [number, number]) => {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const L = 7;
  const W = 2.2;
  const bx = tip[0] + ux * L;
  const by = tip[1] + uy * L;
  return `${tip[0]},${tip[1]} ${bx - uy * W},${by + ux * W} ${bx + uy * W},${by - ux * W}`;
};

export default function PlotSketch({ boundaries, dims }: { boundaries: Boundaries; dims: Boundaries }) {
  const FONT = 11;
  const WORD = 14;
  const DIM_FONT = 10;
  const GAP = 13;
  const ROAD_W = 16;
  const DIM_OFFSET = 10; // dimension line distance from the plot edge (or from the road edge)
  const DIM_ZONE = 24; // space reserved for the dimension line and its extension lines
  const TEXT_GAP = 8;
  const PAD = 10;
  const MIN_PLOT = 64;

  // Quarter turns (clockwise) needed to bring the road side to the bottom; no road side keeps the north-up drawing
  const roadSide = ROAD_PRIORITY.find((s) => ROAD_PATTERN.test(boundaries[s]));
  const roadIndex = roadSide ? SIDE_ORDER.indexOf(roadSide) : 2;
  const turns = (2 - roadIndex + 4) % 4;

  // Positions: 0 = top, 1 = right, 2 = bottom, 3 = left
  const sideAt = (pos: number) => SIDE_ORDER[(pos - turns + 4) % 4];

  // Plot proportions come from the entered side lengths; otherwise a default shape is used
  const widthFt = averageOf(dims[sideAt(0)], dims[sideAt(2)]);
  const heightFt = averageOf(dims[sideAt(1)], dims[sideAt(3)]);
  let w = 150;
  let h = 110;
  if (widthFt > 0 && heightFt > 0) {
    const scale = Math.min(150 / widthFt, 130 / heightFt);
    w = Math.max(MIN_PLOT, widthFt * scale);
    h = Math.max(MIN_PLOT, heightFt * scale);
  }

  // Boundary text blocks. Horizontal blocks may be wider than the plot; vertical blocks are kept within the plot
  // height so they can never run into the top / bottom blocks.
  const horizontalMax = Math.max(w + 80, 210);
  const verticalMax = Math.max(h, 70);

  const S = [0, 1, 2, 3].map((pos) => {
    const side = sideAt(pos);
    const text = boundaries[side];
    const road = ROAD_PATTERN.test(text);
    const dim = dims[side];
    const hasDim = parseFloat(dim) > 0;
    const horizontal = pos % 2 === 0;
    let lines = wrapByWidth(text, horizontal ? horizontalMax : verticalMax, FONT);
    if (lines.length === 0) lines = [""];
    const n = lines.length;
    const blockLen = Math.max(...lines.map((l) => measureText(l, FONT)), measureText(side.toUpperCase(), WORD));
    const roadW = road ? ROAD_W : 0;
    // Distance from the plot edge to the nearest text baseline reference
    const offset0 = roadW + (hasDim ? DIM_ZONE : 0) + TEXT_GAP;
    // Total space needed outside the plot edge for road + dimension + text lines + direction word
    const margin = offset0 + (n - 1) * GAP + FONT + 3 + WORD + 4;
    return { word: side.toUpperCase(), lines, n, road, roadW, dim, hasDim, blockLen, offset0, margin };
  });

  // View box: plot centre plus the largest extent needed on every side
  const topW = S[0].blockLen;
  const bottomW = S[2].blockLen;
  const leftLen = S[3].blockLen;
  const rightLen = S[1].blockLen;
  const leftExt = Math.max(S[3].margin + w / 2, topW / 2, bottomW / 2);
  const rightExt = Math.max(S[1].margin + w / 2, topW / 2, bottomW / 2);
  const topExt = Math.max(S[0].margin + h / 2, leftLen / 2, rightLen / 2);
  const bottomExt = Math.max(S[2].margin + h / 2, leftLen / 2, rightLen / 2);
  const VB_W = leftExt + rightExt + 2 * PAD;
  const VB_H = topExt + bottomExt + 2 * PAD;
  const cx = PAD + leftExt;
  const cy = PAD + topExt;
  const xL = cx - w / 2;
  const xR = cx + w / 2;
  const yT = cy - h / 2;
  const yB = cy + h / 2;

  // Point at "along" (position along the side, 0 = middle) and "out" (distance outside the plot edge)
  const place = (pos: number, along: number, out: number): [number, number] =>
    pos === 0 ? [cx + along, yT - out] : pos === 2 ? [cx + along, yB + out] : pos === 3 ? [xL - out, cy + along] : [xR + out, cy + along];

  // "PROPOSED SITE" label: horizontal when the plot is wide enough, otherwise rotated to run along the plot's
  // long side. The font shrinks further when even that side is too short.
  const LABEL_CHAR_FACTOR = 8.06; // approximate text length of "PROPOSED SITE" per unit of font size
  const LABEL_MAX_FONT = 8.5;
  const LABEL_PAD = 8;
  const LABEL_MAX_LEN = LABEL_CHAR_FACTOR * LABEL_MAX_FONT + LABEL_PAD;
  const labelVertical = w < LABEL_MAX_LEN + 4 && h > w;
  const labelAvail = (labelVertical ? h : w) - 6;
  const labelFont = Math.max(5, Math.min(LABEL_MAX_FONT, (labelAvail - LABEL_PAD) / LABEL_CHAR_FACTOR));
  const labelLen = LABEL_CHAR_FACTOR * labelFont + LABEL_PAD;
  const labelThick = labelFont + 7.5;

  const renderRoad = (pos: number) => {
    if (!S[pos].road) return null;
    const rect =
      pos === 0 ? { x: xL, y: yT - ROAD_W, width: w, height: ROAD_W }
      : pos === 2 ? { x: xL, y: yB, width: w, height: ROAD_W }
      : pos === 3 ? { x: xL - ROAD_W, y: yT, width: ROAD_W, height: h }
      : { x: xR, y: yT, width: ROAD_W, height: h };
    const labelAt: [number, number] =
      pos === 0 ? [cx, yT - 4] : pos === 2 ? [cx, yB + ROAD_W - 4] : pos === 3 ? [xL - 4, cy] : [xR + ROAD_W - 4, cy];
    const rot = pos === 3 ? -90 : pos === 1 ? 90 : 0;
    return (
      <g key={`road${pos}`}>
        <rect {...rect} fill="#f3f4f6" stroke="#000" strokeWidth="1" />
        <text transform={`translate(${labelAt[0]},${labelAt[1]})${rot ? ` rotate(${rot})` : ""}`} textAnchor="middle" fontSize="9" fontWeight="700" fill={CYAN}>ROAD</text>
      </g>
    );
  };

  // Dimension line with arrow heads, extension lines and a centred length label (engineering drawing style)
  const renderDim = (pos: number) => {
    const s = S[pos];
    if (!s.hasDim) return null;
    const half = (pos % 2 === 0 ? w : h) / 2;
    const od = s.roadW + DIM_OFFSET;
    const A = place(pos, -half, od);
    const B = place(pos, half, od);
    const A0 = place(pos, -half, 2);
    const B0 = place(pos, half, 2);
    const A1 = place(pos, -half, od + 4);
    const B1 = place(pos, half, od + 4);
    const mid = place(pos, 0, od);
    const label = formatFeetInches(s.dim);
    const tw = measureText(label, DIM_FONT);
    const vertical = pos % 2 === 1;
    return (
      <g key={`dim${pos}`} stroke="#000" strokeWidth="0.7">
        <line x1={A0[0]} y1={A0[1]} x2={A1[0]} y2={A1[1]} />
        <line x1={B0[0]} y1={B0[1]} x2={B1[0]} y2={B1[1]} />
        <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} />
        <polygon points={arrowHead(A, B)} fill="#000" stroke="none" />
        <polygon points={arrowHead(B, A)} fill="#000" stroke="none" />
        {vertical ? (
          <rect x={mid[0] - 6.5} y={mid[1] - tw / 2 - 3} width={13} height={tw + 6} fill="#fff" stroke="none" />
        ) : (
          <rect x={mid[0] - tw / 2 - 3} y={mid[1] - 6.5} width={tw + 6} height={13} fill="#fff" stroke="none" />
        )}
        <text
          transform={vertical ? `translate(${mid[0] + 3.5},${mid[1]}) rotate(-90)` : `translate(${mid[0]},${mid[1] + 3.5})`}
          textAnchor="middle"
          fontSize={DIM_FONT}
          fontWeight="700"
          fill="#000"
          stroke="none"
        >
          {label}
        </text>
      </g>
    );
  };

  // Boundary text lines plus the direction word, stacked outwards from the plot edge
  const renderText = (pos: number) => {
    const s = S[pos];
    const rot = pos === 1 ? 90 : pos === 3 ? -90 : 0;
    // Outward distance of the baseline nearest to the plot (text hangs outwards on the top / left sides)
    const hangsOutwards = pos === 0 || pos === 3;
    const near = hangsOutwards ? s.offset0 : s.offset0 + FONT * 0.85;
    const lineOut = (i: number) => (pos === 2 ? near + i * GAP : near + (s.n - 1 - i) * GAP);
    const wordOut = hangsOutwards
      ? s.offset0 + (s.n - 1) * GAP + FONT * 0.85 + 3 + WORD * 0.8
      : s.offset0 + FONT * 0.85 + (s.n - 1) * GAP + FONT * 0.2 + 3 + WORD * 0.85;
    const tf = (out: number) => {
      const p = place(pos, 0, out);
      return `translate(${p[0]},${p[1]})${rot ? ` rotate(${rot})` : ""}`;
    };
    return (
      <g key={`text${pos}`}>
        {s.lines.map((t, i) => (
          <text key={i} transform={tf(lineOut(i))} textAnchor="middle" fontSize={FONT} fontWeight="700">{t}</text>
        ))}
        <text transform={tf(wordOut)} textAnchor="middle" fontSize={WORD} fontWeight="800">{s.word}</text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fontFamily="Arial, sans-serif">
      <defs>
        <pattern id="rm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#e11d1d" strokeWidth="1" />
        </pattern>
      </defs>

      {[0, 1, 2, 3].map(renderRoad)}

      {/* Plot */}
      <rect x={xL} y={yT} width={w} height={h} fill="url(#rm-hatch)" stroke="#000" strokeWidth="1.5" />

      {/* Proposed site label */}
      <g transform={labelVertical ? `translate(${cx},${cy}) rotate(-90)` : `translate(${cx},${cy})`}>
        <rect x={-labelLen / 2} y={-labelThick / 2} width={labelLen} height={labelThick} fill="#fff" stroke="#000" strokeWidth="0.6" />
        <text x={0} y={labelFont * 0.35} textAnchor="middle" fontSize={labelFont} fontWeight="700">PROPOSED SITE</text>
      </g>

      {[0, 1, 2, 3].map(renderDim)}
      {[0, 1, 2, 3].map(renderText)}
    </svg>
  );
}
