import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// Fix type casting for vfs setup safely
if ((pdfMake as any).vfs === undefined) {
  try {
    const fonts = pdfFonts as any;
    (pdfMake as any).vfs = fonts.pdfMake ? fonts.pdfMake.vfs : fonts.vfs;
  } catch (e) {
    console.warn('VFS setup error:', e);
  }
}

export interface FloorData {
  name: string;
  builtUp: number;
  rooms: string;
}

export interface PlanData {
  customerName?: string;
  address?: string;
  plotArea?: number;
  plotWidth?: string;
  plotLength?: string;
  designMode?: string;
  northBoundary?: string;
  southBoundary?: string;
  eastBoundary?: string;
  westBoundary?: string;
  floors?: FloorData[];
}

export const generateConstructionPlanPDF = (planData: PlanData = {}) => {
  const {
    customerName = 'MR. BANE SINGH S/O LATE MR. BHANWAR SINGH TANWAR',
    address = 'PLOT NO 1693/3 MAYUR NAGAR GRAM MUSAKHEDI TEHSIL AND DIST INDORE',
    plotArea = 1000,
    plotWidth = '25\'-0"',
    plotLength = '40\'-0"',
    designMode = 'norms',
    northBoundary = 'SHRI HARI KUMAWAT HOUSE',
    southBoundary = 'ROAD',
    eastBoundary = 'PAVITRA SHARMA HOUSE',
    westBoundary = 'ROAD',
    floors = [
      { name: 'GROUND FLOOR', builtUp: 900, rooms: 'PARKING|HALL|KITCHEN|BEDROOM|TOILET' }
    ]
  } = planData;

  const totalBuiltUp = floors.reduce((acc: number, f: FloorData) => acc + (Number(f.builtUp) || 0), 0);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [8, 8, 8, 8],
    defaultStyle: { fontSize: 7 },

    content: [
      {
        table: {
          widths: ['74%', '26%'],
          body: [
            [
              {
                stack: [
                  {
                    columns: [
                      {
                        stack: [
                          { text: 'ELEVATION', bold: true, fontSize: 7, alignment: 'center' },
                          {
                            canvas: [
                              { type: 'rect', x: 2, y: 2, w: 92, h: 140, lineWidth: 0.8 },
                              { type: 'rect', x: 25, y: 110, w: 42, h: 18, lineWidth: 0.5 },
                              { type: 'line', x1: 46, y1: 110, x2: 46, y2: 128, lineWidth: 0.3 },
                              { type: 'rect', x: 20, y: 75, w: 52, h: 22, lineWidth: 0.5 },
                              { type: 'line', x1: 15, y1: 97, x2: 79, y2: 97, lineWidth: 0.6 },
                              { type: 'rect', x: 20, y: 40, w: 52, h: 22, lineWidth: 0.5 },
                              { type: 'line', x1: 15, y1: 62, x2: 79, y2: 62, lineWidth: 0.6 },
                              { type: 'line', x1: 2, y1: 132, x2: 94, y2: 132, lineWidth: 0.9 },
                              { type: 'text', x: 6, y: 134, text: 'GL', fontSize: 6, bold: true },
                            ],
                            alignment: 'center'
                          }
                        ],
                        width: '*'
                      },
                      {
                        stack: [
                          { text: 'SECTION', bold: true, fontSize: 7, alignment: 'center' },
                          {
                            canvas: [
                              { type: 'rect', x: 2, y: 2, w: 92, h: 140, lineWidth: 0.8 },
                              { type: 'line', x1: 2, y1: 35, x2: 94, y2: 35, lineWidth: 0.7 },
                              { type: 'line', x1: 2, y1: 70, x2: 94, y2: 70, lineWidth: 0.7 },
                              { type: 'line', x1: 2, y1: 105, x2: 94, y2: 105, lineWidth: 0.7 },
                              { type: 'polyline', points: [{x:55, y:132}, {x:55, y:120}, {x:65, y:120}, {x:65, y:105}, {x:65, y:85}, {x:75, y:85}, {x:75, y:70}], lineWidth: 0.5 },
                              { type: 'polyline', points: [{x:55, y:105}, {x:55, y:95}, {x:45, y:95}, {x:45, y:70}], lineWidth: 0.5 },
                            ],
                            alignment: 'center'
                          }
                        ],
                        width: '*'
                      }
                    ],
                    margin: [0, 0, 0, 4]
                  },
                  {
                    columns: floors.map((floor: FloorData) => ({
                      stack: [
                        {
                          canvas: [
                            { type: 'rect', x: 2, y: 2, w: 92, h: 170, lineWidth: 0.8 },
                            { type: 'line', x1: 2, y1: 55, x2: 94, y2: 55, lineWidth: 0.6 },
                            { type: 'line', x1: 2, y1: 115, x2: 94, y2: 115, lineWidth: 0.6 },
                            { type: 'rect', x: 25, y: 55, w: 42, h: 60, lineWidth: 0.6 },
                            { type: 'line', x1: 25, y1: 55, x2: 67, y2: 115, lineWidth: 0.4 },
                            { type: 'line', x1: 67, y1: 55, x2: 25, y2: 115, lineWidth: 0.4 },
                            { type: 'rect', x: 67, y: 55, w: 27, h: 60, lineWidth: 0.6 },
                          ],
                          alignment: 'center'
                        },
                        { text: floor.name, bold: true, fontSize: 7, alignment: 'center', margin: [0, 1, 0, 0] },
                        { text: floor.rooms ? floor.rooms.replace(/\|/g, '\n') : '', fontSize: 4.8, alignment: 'center', color: '#333' }
                      ],
                      width: '*'
                    }))
                  }
                ],
                margin: [2, 2, 2, 2]
              },
              {
                stack: [
                  { text: `PROPOSED RESIDENTIAL BUILDING (${floors.map((f: FloorData) => f.name).join(' + ')})`, bold: true, fontSize: 6, alignment: 'center', margin: [0, 0, 0, 3] },
                  { text: 'CUSTOMER NAME:', bold: true, fontSize: 5.5 },
                  { text: customerName, fontSize: 5.5, bold: true, margin: [0, 0, 0, 2] },
                  { text: 'PROPERTY ADDRESS:', bold: true, fontSize: 5.5 },
                  { text: address, fontSize: 5, margin: [0, 0, 0, 3] },
                  {
                    canvas: [
                      { type: 'rect', x: 22, y: 2, w: 80, h: 32, lineWidth: 0.6 },
                      { type: 'line', x1: 62, y1: 2, x2: 62, y2: 34, lineWidth: 0.4, color: '#333' },
                      { type: 'text', x: 28, y: 10, text: designMode === '100' ? '100% COVERAGE MODE' : 'P.C.C. 0.10 MM THICK', fontSize: 4.5 },
                      { type: 'text', x: 35, y: 22, text: 'SECTION ON D-D', fontSize: 5, bold: true }
                    ],
                    alignment: 'center',
                    margin: [0, 0, 0, 2]
                  },
                  { text: 'AREA STATEMENT', bold: true, fontSize: 6.5, color: '#00008B', alignment: 'center', margin: [0, 2, 0, 2] },
                  {
                    table: {
                      widths: ['*', 'auto'],
                      body: [
                        [{ text: 'PLOT AREA', fontSize: 5, bold: true }, { text: `${plotArea} SQFT`, fontSize: 5 }],
                        ...floors.map((f: FloorData) => [
                          { text: f.name, fontSize: 5, bold: true },
                          { text: `${f.builtUp} SQFT`, fontSize: 5 }
                        ]),
                        [{ text: 'TOTAL BUILT-UP', fontSize: 5, bold: true }, { text: `${totalBuiltUp} SQFT`, fontSize: 5, bold: true }]
                      ]
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 3]
                  },
                  { text: northBoundary, fontSize: 4.5, alignment: 'center', color: '#333', margin: [0, 0, 0, 1] },
                  {
                    canvas: [
                      { type: 'rect', x: 10, y: 2, w: 105, h: 82, lineWidth: 0.7 },
                      { type: 'rect', x: 20, y: 12, w: 85, h: 58, lineWidth: 0.6 },
                      { type: 'line', x1: 20, y1: 22, x2: 78, y2: 12, lineWidth: 0.3 },
                      { type: 'line', x1: 20, y1: 40, x2: 105, y2: 21, lineWidth: 0.3 },
                      { type: 'line', x1: 20, y1: 58, x2: 105, y2: 39, lineWidth: 0.3 },
                      { type: 'line', x1: 30, y1: 70, x2: 105, y2: 59, lineWidth: 0.3 },
                      { type: 'text', x: 34, y: 32, text: 'PROPOSED SITE', fontSize: 5.5, bold: true },
                      { type: 'text', x: 52, y: 3, text: plotWidth, fontSize: 5, bold: true },
                      { type: 'text', x: 11, y: 36, text: plotLength, fontSize: 5, bold: true },
                      { type: 'rect', x: 10, y: 71, w: 105, h: 12, lineWidth: 0.5, color: '#f0f0f0' },
                      { type: 'text', x: 48, y: 75, text: southBoundary, fontSize: 5, bold: true }
                    ],
                    alignment: 'center'
                  },
                  { text: `EAST: ${eastBoundary} | WEST: ${westBoundary}`, fontSize: 4, alignment: 'center', color: '#444', margin: [0, 2, 0, 3] },
                  { text: 'SITE PLAN', bold: true, fontSize: 6.5, alignment: 'center', margin: [0, 0, 0, 3] },
                  {
                    columns: [
                      {
                        stack: [
                          { text: 'E', bold: true, color: 'red', alignment: 'center', fontSize: 5.5 },
                          { text: 'N ✚ S', bold: true, color: 'red', alignment: 'center', fontSize: 5.5 },
                          { text: 'W', bold: true, color: 'red', alignment: 'center', fontSize: 5.5 },
                        ],
                        width: 24
                      },
                      {
                        stack: [
                          { text: 'ENG/172/2024', fontSize: 4.5, bold: true },
                          { text: 'Digitally signed by', fontSize: 5, bold: true },
                          { text: 'Er. Jasvant Chouhan', fontSize: 5.5, bold: true },
                          { text: `Date: ${new Date().toISOString().split('T')[0].replace(/-/g, '.')}`, fontSize: 4, color: '#333' }
                        ],
                        width: '*'
                      }
                    ]
                  }
                ],
                margin: [4, 2, 2, 2]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#000',
          vLineColor: () => '#000',
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 2,
          paddingBottom: () => 2
        }
      }
    ]
  };

  pdfMake.createPdf(docDefinition).download(`Blueprint_${customerName.replace(/\s+/g, '_')}.pdf`);
};