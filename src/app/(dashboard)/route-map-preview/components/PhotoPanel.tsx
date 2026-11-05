// Space beside the satellite view for site photos (printed on the sheet). Without photos the cell keeps its place
// with a caption, so the photos can be added later or pasted in after printing.
import { CYAN } from "../engine/constants";

export default function PhotoPanel({ photos }: { photos: string[] }) {
  if (photos.length === 0) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: CYAN, fontWeight: 700, fontSize: "9pt", letterSpacing: "0.5mm" }}>
        SITE PHOTO
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {photos.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Site photo ${i + 1}`}
          style={{ flex: 1, minHeight: 0, width: "100%", objectFit: "cover", display: "block", borderTop: i > 0 ? "0.3mm solid #000" : undefined }}
        />
      ))}
    </div>
  );
}
