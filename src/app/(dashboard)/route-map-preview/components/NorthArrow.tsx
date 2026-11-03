// North symbol of the sheet: compass ring with a two-tone north arrow. The maps always have north at the top
// (like a normal map), so the symbol is fixed and points up.
export default function NorthArrow({ color }: { color: string }) {
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width="46" height="58" viewBox="0 0 64 80" style={{ display: "block" }}>
      {/* The letter N above the ring */}
      <text x="32" y="15" textAnchor="middle" fontSize="17" fontWeight="800" fontFamily="Arial, sans-serif" fill={color} stroke="#fff" strokeWidth="3" paintOrder="stroke">N</text>

      {/* Ring */}
      <circle cx="32" cy="48" r="26" fill="#ffffff" fillOpacity="0.92" stroke="#000" strokeWidth="1.6" />
      <circle cx="32" cy="48" r="22" fill="none" stroke="#000" strokeWidth="0.6" />
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="32" y1="22" x2="32" y2={deg % 90 === 0 ? 27 : 25}
          stroke="#000" strokeWidth={deg % 90 === 0 ? 1.2 : 0.7}
          transform={`rotate(${deg} 32 48)`}
        />
      ))}

      {/* South half (light) and north half (black / white) of the arrow */}
      <polygon points="32,70 27.5,50 36.5,50" fill="#d9d9d9" stroke="#000" strokeWidth="0.8" />
      <polygon points="32,24 25,50 32,45" fill="#000" />
      <polygon points="32,24 39,50 32,45" fill="#ffffff" stroke="#000" strokeWidth="1" />
      <circle cx="32" cy="48" r="1.6" fill="#000" />
    </svg>
  );
}
