export interface PartyDetail {
  name: string;
  details: string;
}

export interface FloorDetail {
  floorName: string;
  builtUpArea: string;
  areaUnit: string; // Sq. Ft., Sq. Mtr., Acre, Hectare
  constructionType: string; // RCC / Load Bearing / Tin Shed / Frame Structure
  // Area basis used for FLAT deeds: BUILT_UP | SUPER_BUILT_UP | CARPET (defaults to SUPER_BUILT_UP)
  areaType?: string;
}

export interface PaymentInstallment {
  amount: string;
  amountWords: string;
  mode: string;
  date: string;
}

export interface DeedFormData {
  caseType: string;
  feeMode: string;
  feeAmount?: number; 
  clientName: string;
  representativeName: string;
  stateName: string;
  cityName: string;
  propertyType: string; // PLOT, HOUSE, FLAT, COMMERCIAL, AGRICULTURAL
  deedType: string;
  outputLanguage: string;

  sellers: PartyDetail[];
  buyers: PartyDetail[];

  propertyAddress: string;
  plotArea: string;
  plotAreaUnit: string; // Area unit for plot
  floorsList: FloorDetail[]; // Dynamic Floor details

  parentDocument: string;
  considerationAmount: string;
  installments?: PaymentInstallment[];

  bayanaAmount?: string;
  remainingAmount?: string;
  paymentPeriod?: string;

  bankName?: string;
  loanAmount?: string;

  boundaryEast: string;
  boundaryWest: string;
  boundaryNorth: string;
  boundarySouth: string;

  // Reference number of an already-saved record (set when a draft is reopened from the dashboard)
  refNo?: string;
}