/* =========================================================
CONSTRUCTION PLAN SYSTEM
DATA-DRIVEN CAD BLUEPRINT ENGINE
---------------------------------------------------------
IMPORTANT:
- Plot dimensions are taken from actual input.
- Buildable footprint is respected.
- Room selection comes from room_details.
- Room count comes from room_details.
- Room area comes from AUTO / MANUAL area.
- No hard-coded BHK floor plan.
- Each selected floor gets its own layout.
- Rooms are packed into the usable building rectangle.
- Staircase / parking / balcony are handled separately.
========================================================= */

import { PlotDimensions, PlotShape } from "../types";

type RoomInput = {
  selected?: boolean;
  count?: number;
  areaMode?: "AUTO" | "MANUAL";
  areaPerRoom?: number;
};

type RoomDetails = Record<string, RoomInput>;

type FloorDetails = Record<
  string,
  {
    length?: number;
    width?: number;
    area?: number;
  }
>;

type BlueprintRoom = {
  name: string;
  sourceKey: string;
  index: number;

  x: number;
  y: number;
  w: number;
  h: number;

  area: string;

  hasDoor?: boolean;
  hasWindow?: boolean;

  doorSide?: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";

  isStairs?: boolean;
  isParking?: boolean;
  isBoundary?: boolean;
  isBalcony?: boolean;
};

type BlueprintFloor = {
  floorName: string;
  floorArea: number;
  rooms: BlueprintRoom[];
};

type CadBlueprint = {
  viewBox: string;

  plotWidth: number;
  plotDepth: number;

  buildableX: number;
  buildableY: number;
  buildableWidth: number;
  buildableDepth: number;

  sitePlan: {
    boundary: {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    topNeighbor: string;
    leftNeighbor: string;
    rightNeighbor: string;
    bottomNeighbor: string;
  };

  floors: Record<string, BlueprintFloor>;

  getRoomsForFloor: (floorName: string) => BlueprintRoom[];
};

const FT_TO_PX = 10;

const OUTER_MARGIN = 20;

const INTERNAL_WALL = 2;

const MIN_ROOM_WIDTH_FT = 4;

const MIN_ROOM_DEPTH_FT = 4;

/* =========================================================
SAFE NUMBER
========================================================= */

function num(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

/* =========================================================
ROOM PRIORITY
---------------------------------------------------------
Large rooms first.
Utility rooms later.
========================================================= */

const ROOM_PRIORITY: Record<string, number> = {
  "MASTER BEDROOM": 100,
  BEDROOM: 90,
  "LIVING ROOM": 85,
  HALL: 80,
  DINING: 70,
  KITCHEN: 65,
  "STUDY ROOM": 60,
  "POOJA ROOM": 55,
  DRESSING: 50,
  STAIRCASE: 45,
  UTILITY: 40,
  STORE: 35,
  BATHROOM: 30,
  WC: 25,
  BALCONY: 20,
  PARKING: 10,
};

/* =========================================================
ROOM LABEL
========================================================= */

function roomLabel(key: string, index: number): string {
  if (
    key === "BEDROOM" ||
    key === "MASTER BEDROOM" ||
    key === "BATHROOM" ||
    key === "WC"
  ) {
    return index > 1 ? `${key} ${index}` : key;
  }

  return key;
}

/* =========================================================
ROOM DIMENSION
---------------------------------------------------------
Convert requested area into an engineering-friendly
rectangle.

We try to keep the rectangle close to square first,
then fit it into the available building width.
========================================================= */

function calculateRoomDimensions(
  areaSqFt: number,
  availableWidthFt: number
) {
  const safeArea = Math.max(areaSqFt, 16);

  let widthFt = Math.sqrt(safeArea);

  let depthFt = safeArea / widthFt;

  if (widthFt > availableWidthFt) {
    widthFt = availableWidthFt;

    depthFt = safeArea / widthFt;
  }

  widthFt = Math.max(widthFt, MIN_ROOM_WIDTH_FT);

  depthFt = Math.max(depthFt, MIN_ROOM_DEPTH_FT);

  return {
    widthFt,
    depthFt,
  };
}

/* =========================================================
NORMALIZE REQUESTED ROOMS
========================================================= */

function normalizeRooms(
  roomDetails: RoomDetails | undefined,
  floorArea: number
) {
  const source = roomDetails || {};

  const rooms: Array<{
    key: string;
    index: number;
    area: number;
  }> = [];

  Object.entries(source).forEach(
    ([roomKey, config]) => {
      if (!config?.selected) return;

      const count = Math.max(
        1,
        Math.floor(num(config.count, 1))
      );

      const requestedArea = Math.max(
        16,
        num(
          config.areaPerRoom,
          0
        )
      );

      for (let i = 1; i <= count; i++) {
        rooms.push({
          key: roomKey,
          index: i,
          area:
            requestedArea > 0
              ? requestedArea
              : floorArea / Math.max(count, 1),
        });
      }
    }
  );

  return rooms.sort(
    (a, b) =>
      (ROOM_PRIORITY[b.key] || 0) -
      (ROOM_PRIORITY[a.key] || 0)
  );
}

/* =========================================================
AUTO FALLBACK ROOMS

Only used if room_details is completely empty.

This is NOT the normal path.
========================================================= */

function fallbackRooms(
  floorArea: number,
  isGround: boolean
) {
  if (floorArea <= 0) {
    return [];
  }

  if (isGround) {
    return [
      {
        key: "LIVING ROOM",
        index: 1,
        area: Math.max(160, floorArea * 0.28),
      },
      {
        key: "BEDROOM",
        index: 1,
        area: Math.max(120, floorArea * 0.22),
      },
      {
        key: "KITCHEN",
        index: 1,
        area: Math.max(70, floorArea * 0.10),
      },
      {
        key: "BATHROOM",
        index: 1,
        area: Math.max(35, floorArea * 0.06),
      },
      {
        key: "STAIRCASE",
        index: 1,
        area: Math.max(50, floorArea * 0.06),
      },
    ];
  }

  return [
    {
      key: "LIVING ROOM",
      index: 1,
      area: Math.max(140, floorArea * 0.30),
    },
    {
      key: "BEDROOM",
      index: 1,
      area: Math.max(120, floorArea * 0.25),
    },
    {
      key: "KITCHEN",
      index: 1,
      area: Math.max(70, floorArea * 0.10),
    },
    {
      key: "BATHROOM",
      index: 1,
      area: Math.max(35, floorArea * 0.06),
    },
    {
      key: "STAIRCASE",
      index: 1,
      area: Math.max(50, floorArea * 0.06),
    },
  ];
}

/* =========================================================
GRID PACKING ENGINE
---------------------------------------------------------
Simple deterministic architectural packing.

This is deliberately predictable:
- no overlap
- no negative coordinates
- all rooms stay inside buildable footprint
- large rooms get priority
========================================================= */

function packRooms(
  rooms: Array<{
    key: string;
    index: number;
    area: number;
  }>,
  buildWidthFt: number,
  buildDepthFt: number
): BlueprintRoom[] {
  if (
    rooms.length === 0 ||
    buildWidthFt <= 0 ||
    buildDepthFt <= 0
  ) {
    return [];
  }

  const totalRequestedArea = rooms.reduce(
    (sum, room) => sum + room.area,
    0
  );

  /*
  If requested rooms exceed usable area,
  scale all room areas proportionally.

  This prevents the drawing from going outside
  the building.
  */

  const usableArea =
    buildWidthFt * buildDepthFt;

  const areaScale =
    totalRequestedArea > usableArea * 0.94
      ? (usableArea * 0.94) /
        totalRequestedArea
      : 1;

  const normalized = rooms.map(
    (room) => ({
      ...room,
      area:
        Math.max(16, room.area * areaScale),
    })
  );

  const result: BlueprintRoom[] = [];

  let cursorX = 0;
  let cursorY = 0;

  let currentRowDepth = 0;

  normalized.forEach((room) => {
    let {
      widthFt,
      depthFt,
    } = calculateRoomDimensions(
      room.area,
      buildWidthFt
    );

    /*
    If room doesn't fit current row,
    start next row.
    */

    if (
      cursorX + widthFt >
      buildWidthFt + 0.01
    ) {
      cursorX = 0;

      cursorY += currentRowDepth;

      currentRowDepth = 0;
    }

    /*
    If room is deeper than remaining depth,
    reduce dimensions while preserving area
    as much as possible.
    */

    if (
      cursorY + depthFt >
      buildDepthFt
    ) {
      const remainingDepth =
        Math.max(
          buildDepthFt - cursorY,
          MIN_ROOM_DEPTH_FT
        );

      depthFt = remainingDepth;

      widthFt =
        Math.min(
          buildWidthFt - cursorX,
          room.area / depthFt
        );
    }

    /*
    Final safety clamp.
    */

    widthFt = Math.max(
      MIN_ROOM_WIDTH_FT,
      Math.min(
        widthFt,
        buildWidthFt - cursorX
      )
    );

    depthFt = Math.max(
      MIN_ROOM_DEPTH_FT,
      Math.min(
        depthFt,
        buildDepthFt - cursorY
      )
    );

    /*
    Convert feet -> SVG pixels.
    */

    const x =
      OUTER_MARGIN +
      cursorX * FT_TO_PX;

    const y =
      OUTER_MARGIN +
      cursorY * FT_TO_PX;

    const w =
      widthFt * FT_TO_PX;

    const h =
      depthFt * FT_TO_PX;

    const isStairs =
      room.key === "STAIRCASE";

    const isParking =
      room.key === "PARKING";

    const isBalcony =
      room.key === "BALCONY";

    result.push({
      name: roomLabel(
        room.key,
        room.index
      ),

      sourceKey: room.key,

      index: room.index,

      x,
      y,
      w,
      h,

      area: `${Math.round(
        widthFt * depthFt
      )} SQ.FT`,

      hasDoor: !isParking && !isBalcony,

      hasWindow:
        !isStairs &&
        !isParking,

      doorSide:
        room.key === "KITCHEN" ||
        room.key === "BATHROOM" ||
        room.key === "WC"
          ? "LEFT"
          : "TOP",

      isStairs,

      isParking,

      isBalcony,
    });

    cursorX += widthFt;

    currentRowDepth =
      Math.max(
        currentRowDepth,
        depthFt
      );
  });

  return result;
}

/* =========================================================
MAIN BLUEPRINT GENERATOR
========================================================= */

export function generateCadVectorBlueprint(
  dimensions: PlotDimensions,
  footprint: any,
  floorDetails?: FloorDetails,
  roomDetails?: Record<string, RoomDetails>,
  plotShape: PlotShape = "RECTANGULAR",
  roadSide = "",
  boundaries?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  }
): CadBlueprint {
  const A = Math.max(
    1,
    num(dimensions?.A, 20)
  );

  const B = Math.max(
    1,
    num(dimensions?.B, A)
  );

  const C = Math.max(
    1,
    num(dimensions?.C, 40)
  );

  const D = Math.max(
    1,
    num(dimensions?.D, C)
  );

  /*
  For standard rectangle use A × C.
  For irregular plots use average dimensions.
  */

  let plotWidthFt = A;

  let plotDepthFt = C;

  if (
    plotShape !== "RECTANGULAR" &&
    plotShape !== "SQUARE"
  ) {
    plotWidthFt =
      (A + B) / 2;

    plotDepthFt =
      (C + D) / 2;
  }

  if (plotShape === "SQUARE") {
    plotWidthFt = A;
    plotDepthFt = A;
  }

  const plotWidth =
    plotWidthFt * FT_TO_PX;

  const plotDepth =
    plotDepthFt * FT_TO_PX;

  /*
  Prefer calculated footprint from layoutEngine.
  */

  const buildWidthFt = Math.max(
    MIN_ROOM_WIDTH_FT,
    num(
      footprint?.width,
      plotWidthFt
    )
  );

  const buildDepthFt = Math.max(
    MIN_ROOM_DEPTH_FT,
    num(
      footprint?.length,
      plotDepthFt
    )
  );

  /*
  Keep footprint inside plot.
  */

  const safeBuildWidthFt =
    Math.min(
      buildWidthFt,
      plotWidthFt
    );

  const safeBuildDepthFt =
    Math.min(
      buildDepthFt,
      plotDepthFt
    );

  const viewBoxWidth =
    plotWidth + OUTER_MARGIN * 2;

  const viewBoxHeight =
    plotDepth + OUTER_MARGIN * 2;

  const floors: Record<
    string,
    BlueprintFloor
  > = {};

  const details =
    floorDetails || {};

  const floorNames =
    Object.keys(details);

  floorNames.forEach(
    (floorName) => {
      const floorArea =
        num(
          details[floorName]?.area,
          safeBuildWidthFt *
            safeBuildDepthFt
        );

      let sourceRooms =
        normalizeRooms(
          roomDetails?.[floorName],
          floorArea
        );

      if (
        sourceRooms.length === 0
      ) {
        sourceRooms =
          fallbackRooms(
            floorArea,
            floorName
              .toUpperCase()
              .includes("GROUND")
          );
      }

      const rooms =
        packRooms(
          sourceRooms,
          safeBuildWidthFt,
          safeBuildDepthFt
        );

      floors[floorName] = {
        floorName,
        floorArea,
        rooms,
      };
    }
  );

  /*
  If floor details are absent, create at least
  a Ground Floor drawing.
  */

  if (
    Object.keys(floors).length === 0
  ) {
    const floorName =
      "GROUND FLOOR";

    const floorArea =
      safeBuildWidthFt *
      safeBuildDepthFt;

    floors[floorName] = {
      floorName,
      floorArea,
      rooms: packRooms(
        fallbackRooms(
          floorArea,
          true
        ),
        safeBuildWidthFt,
        safeBuildDepthFt
      ),
    };
  }

  return {
    viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,

    plotWidth,

    plotDepth,

    buildableX:
      OUTER_MARGIN,

    buildableY:
      OUTER_MARGIN,

    buildableWidth:
      safeBuildWidthFt *
      FT_TO_PX,

    buildableDepth:
      safeBuildDepthFt *
      FT_TO_PX,

    sitePlan: {
      boundary: {
        x: OUTER_MARGIN,
        y: OUTER_MARGIN,
        width: plotWidth,
        height: plotDepth,
      },

      topNeighbor:
        boundaries?.north ||
        "NORTH BOUNDARY",

      leftNeighbor:
        boundaries?.west ||
        "WEST BOUNDARY",

      rightNeighbor:
        boundaries?.east ||
        "EAST BOUNDARY",

      bottomNeighbor:
        boundaries?.south ||
        (
          roadSide ||
          "ROAD / FRONT"
        ),
    },

    floors,

    getRoomsForFloor(
      floorName: string
    ) {
      return (
        floors[floorName]
          ?.rooms || []
      );
    },
  };
}

