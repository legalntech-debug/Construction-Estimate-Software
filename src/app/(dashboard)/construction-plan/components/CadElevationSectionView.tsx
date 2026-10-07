import React from "react";
import CadElevationRenderer from "./CadElevationRenderer";
import CadSectionRenderer from "./CadSectionRenderer";
import {
  SectionContext, SectionCutDef, ElevationSide, ElevationModel, SectionModel, Levels, MosFt,
  buildLevels, buildElevationModel, buildSectionModel, layoutDrawingRow, resolveCut,
} from "../engine/sectionEngine";

export interface DrawingItem {
  kind: "ELEVATION" | "SECTION";
  x0: number;
  widthPx: number;
  elevation?: ElevationModel;
  section?: SectionModel;
}

export interface SectionLayout {
  levels: Levels;
  items: DrawingItem[];
  totalWidthPx: number;
}

/** Builds every drawing model and lays them out left -> right (elevations first, then sections). MOS-aware spacing. */
export function computeSectionLayout(
  ctx: SectionContext,
  sides: ElevationSide[],
  cuts: SectionCutDef[],
  scale: number,
  startX: number,
  mos: MosFt = { front: 0, back: 0, left: 0, right: 0 }
): SectionLayout {
  const levels = buildLevels(ctx);
  const rc = cuts.map((c) => resolveCut(c, ctx));                 // AUTO axis -> concrete axis (spacing needs it)
  const row = layoutDrawingRow(sides, rc, ctx.outerW, ctx.outerL, scale, startX, mos);
  const items: DrawingItem[] = row.items.map((it) => {
    if (it.kind === "ELEVATION") {
      return { kind: "ELEVATION", x0: it.x0, widthPx: it.widthPx, elevation: buildElevationModel(ctx, sides[it.index]) };
    }
    return { kind: "SECTION", x0: it.x0, widthPx: it.widthPx, section: buildSectionModel(ctx, rc[it.index]) };
  });
  return { levels, items, totalWidthPx: row.totalWidthPx };
}

interface Props {
  layout: SectionLayout;
  scale: number;
  measurementUnit?: "FEET" | "METERS";
  hasBasement?: boolean;
  basementFt?: number;
  mos: MosFt;
}

export default function CadElevationSectionView({ layout, scale, measurementUnit, hasBasement, basementFt, mos }: Props) {
  return (
    <g>
      {layout.items.map((it, i) => {
        if (it.kind === "ELEVATION" && it.elevation) {
          return (
            <CadElevationRenderer
              key={`el-${i}`}
              model={it.elevation}
              levels={layout.levels}
              scale={scale}
              x0={it.x0}
              measurementUnit={measurementUnit}
              hasBasement={hasBasement}
              basementFt={basementFt}
            />
          );
        }
        if (it.kind === "SECTION" && it.section) {
          const vertical = it.section.cut.axis === "VERTICAL";
          return (
            <CadSectionRenderer
              key={`se-${i}-${it.section.cut.id}`}
              model={it.section}
              levels={layout.levels}
              scale={scale}
              x0={it.x0}
              measurementUnit={measurementUnit}
              mosV0Ft={vertical ? mos.back : mos.left}
              mosV1Ft={vertical ? mos.front : mos.right}
              hasBasement={hasBasement}
              basementFt={basementFt}
            />
          );
        }
        return null;
      })}
    </g>
  );
}
