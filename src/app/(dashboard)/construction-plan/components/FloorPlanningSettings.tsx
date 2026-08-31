"use client";

import React from "react";
import {
  DEFAULT_FLOOR_PLANNING_SETTINGS,
  DoorPosition,
  FloorPlanningSettings as FloorPlanningSettingsType,
  PlanningMode,
} from "../engine/planningTypes";

interface Props {
  floor: string;
  value?: Partial<FloorPlanningSettingsType>;
  onChange: (settings: FloorPlanningSettingsType) => void;
  onClose: () => void;
}

const mergeDefaults = (value?: Partial<FloorPlanningSettingsType>): FloorPlanningSettingsType => ({
  ...DEFAULT_FLOOR_PLANNING_SETTINGS,
  ...(value || {}),
});

const DOOR_POSITIONS: DoorPosition[] = [
  "TOP",
  "BOTTOM",
  "LEFT",
  "RIGHT",
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
];

export default function FloorPlanningSettings({ floor, value, onChange, onClose }: Props) {
  const settings = mergeDefaults(value);
  const isGround = floor === "GROUND FLOOR";

  const set = <K extends keyof FloorPlanningSettingsType>(key: K, next: FloorPlanningSettingsType[K]) => {
    onChange({ ...settings, [key]: next });
  };

  const input = (label: string, key: keyof FloorPlanningSettingsType, min = 0, step = 0.5) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={Number(settings[key] ?? 0)}
        onChange={(e) => set(key, Number(e.target.value) || 0)}
        className="border-2 border-black p-2 text-xs font-black bg-white"
      />
    </label>
  );

  return (
    <div className="mt-2 border-2 border-black bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-2 mb-3">
        <div>
          <div className="text-xs font-black">{floor} — PLANNING SETTINGS</div>
          <div className="text-[9px] font-bold text-gray-600 mt-1">
            AUTO gives a standard plan. MANUAL lets you control floor-specific openings and levels.
          </div>
        </div>
        <button type="button" onClick={onClose} className="border-2 border-black px-3 py-1 text-[10px] font-black bg-white">
          CLOSE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black">PLANNING MODE</span>
          <select
            value={settings.planningMode || settings.mode || "AUTO"}
            onChange={(e) => {
              const selectedMode = e.target.value as PlanningMode;
              set("planningMode", selectedMode);
              set("mode", selectedMode);
            }}
            className="border-2 border-black p-2 text-xs font-black bg-white"
          >
            <option value="AUTO">AUTO — STANDARD</option>
            <option value="MANUAL">MANUAL — CUSTOM</option>
          </select>
        </label>

        {(settings.planningMode === "MANUAL" || settings.mode === "MANUAL") && (
          <>
            {input("MAIN DOORS (NOS)", "mainDoorCount", 0, 1)}
            {input("INTERNAL DOORS (NOS)", "internalDoorCount", 0, 1)}
            {input("BATHROOM DOORS (NOS)", "bathroomDoorCount", 0, 1)}
            {input("WINDOWS (NOS)", "windowCount", 0, 1)}
            {input("VENTILATORS (NOS)", "ventilatorCount", 0, 1)}

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black">MAIN DOOR POSITION</span>
              <select
                value={settings.mainDoorPosition || "TOP"}
                onChange={(e) => set("mainDoorPosition", e.target.value as DoorPosition)}
                className="border-2 border-black p-2 text-xs font-black bg-white"
              >
                {DOOR_POSITIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            {input("MAIN DOOR OFFSET (FT)", "mainDoorOffsetFeet", 0, 0.5)}
            {input("DOOR WIDTH (FT)", "doorWidthFeet", 1, 0.25)}
            {input("DOOR HEIGHT (FT)", "doorHeightFeet", 5, 0.25)}
            {input("FLOOR-TO-FLOOR HEIGHT (FT)", "floorToFloorHeightFeet", 7, 0.5)}
            {input("CEILING HEIGHT (FT)", "ceilingHeightFeet", 7, 0.25)}
          </>
        )}
      </div>

      {isGround && (
        <div className="mt-4 border-2 border-amber-600 bg-amber-50 p-3">
          <div className="text-[10px] font-black text-amber-900 mb-2">GROUND FLOOR — PLINTH SETTINGS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {input("PLINTH HEIGHT ABOVE EXISTING GROUND (FT)", "plinthHeightFeet", 0, 0.25)}
            {input("PLINTH LEVEL / DATUM (FT)", "plinthLevelFeet", 0, 0.25)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-amber-900">
            Plinth controls are intentionally available only on Ground Floor because plinth is a ground-level building datum.
          </div>
        </div>
      )}

      {(settings.planningMode === "AUTO" || settings.mode === "AUTO") && (
        <div className="mt-3 bg-slate-100 border border-black p-2 text-[9px] font-bold">
          AUTO MODE: standard door/window quantities, positions and room rules will be generated from the selected plot, floor area and room requirements. You can switch any floor to MANUAL later.
        </div>
      )}
    </div>
  );
}