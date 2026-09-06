export interface PathElement {
  type: 'rect' | 'line' | 'dim' | 'polyline' | 'text';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  rotation?: number;
  hatched?: boolean;
  text?: string;
  points?: { x: number; y: number }[];
  color?: string;
}

export interface CadImage {
  id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}