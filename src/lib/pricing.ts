// src/lib/pricing.ts

export interface ServicePrices {
  estimate: number;
  map: number;
  drafting: number;
  constructionCertificate: number;
  completionCertificate: number;
  locationPlan: number;
}

export const stateWisePricing: Record<string, ServicePrices> = {
  // 1. Madhya Pradesh
  "MADHYA PRADESH": {
    estimate: 21,
    map: 231,
    drafting: 21,
    constructionCertificate: 51,
    completionCertificate: 700,
    locationPlan: 500, // Route Map ke liye bhi yahi use hoga
  },

  // 2. Maharashtra
  "MAHARASHTRA": {
    estimate: 500,
    map: 700,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 1500,
    locationPlan: 1500,
  },

  // 3. Gujarat
  "GUJARAT": {
    estimate: 500,
    map: 700,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 1000,
    locationPlan: 800,
  },

  // 4. Rajasthan
  "RAJASTHAN": {
    estimate: 150,
    map: 300,
    drafting: 100,
    constructionCertificate: 300,
    completionCertificate: 800,
    locationPlan: 800,
  },

  // 5. Uttar Pradesh (UP)
  "UTTAR PRADESH": {
    estimate: 150,
    map: 300,
    drafting: 100,
    constructionCertificate: 300,
    completionCertificate: 800,
    locationPlan: 600,
  },

  // 6. Delhi (NCR)
  "DELHI": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 7. Karnataka
  "KARNATAKA": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 8. Tamil Nadu
  "TAMIL NADU": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 9. Telangana & Andhra Pradesh
  "TELANGANA": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },
  "ANDHRA PRADESH": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 10. Bihar & Jharkhand
  "BIHAR": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },
  "JHARKHAND": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 11. Punjab & Haryana
  "PUNJAB": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },
  "HARYANA": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // 12. West Bengal
  "WEST BENGAL": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 500,
    completionCertificate: 2000,
    locationPlan: 1500,
  },

  // Default Fallback
  "DEFAULT": {
    estimate: 1000,
    map: 1500,
    drafting: 500,
    constructionCertificate: 1500,
    completionCertificate: 1500,
    locationPlan: 1500,
  }
};

// Yeh function user ke state ke hisaab se automatic rate nikal kar dega
export const getItemRate = (stateName: string, itemName: string): number => {
  const normalizedState = stateName?.toUpperCase().trim() || "DEFAULT";
  const statePrices = stateWisePricing[normalizedState] || stateWisePricing["DEFAULT"];

  // Agar koi 'routeMap' maange, toh hum usko automatically 'locationPlan' ka rate de denge kyunki dono same hain
  const targetItem = itemName === "routeMap" ? "locationPlan" : itemName;

  return statePrices[targetItem] || statePrices["estimate"] || 0;
};