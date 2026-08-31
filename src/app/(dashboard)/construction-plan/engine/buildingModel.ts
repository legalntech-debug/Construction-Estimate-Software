/** Canonical building-model types will be expanded as floor-to-floor coordination moves into the master engine. */
export type BuildingFloorMap<T = unknown> = Record<string, T>;

export interface BuildingModel<TFloor = unknown> {
  selectedFloors: string[];
  floors: BuildingFloorMap<TFloor>;
  generatedAt: string;
}
