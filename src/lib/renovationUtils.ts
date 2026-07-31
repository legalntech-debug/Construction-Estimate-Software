export const calculateRenovationRows = (estimate: any, masterItem: any) => {
  if (!estimate || !masterItem) return [];

  const totalBuiltupSqFt = Number(estimate.total_builtup_area || 0);
  const totalBuiltupSqMt = totalBuiltupSqFt / 10.76;
  const renovationRate = Number(estimate.renovation_rate || 0);
  const additionalFee = Number(estimate.additional_fee || 0);

  const rows = [
    { description: "Renovation & Repairing Base Charges", qty: 1, unit: "LS", rate: renovationRate },
    { description: "Additional Structural Repair Works", qty: 1, unit: "LS", rate: additionalFee },
    { 
      description: "Internal Plaster Repair (Patchwork)", 
      qty: (totalBuiltupSqMt * 0.5).toFixed(2), 
      unit: "SQ.MT", 
      rate: masterItem.internal_plaster_rate || 0 
    },
    { 
      description: "Internal Painting & Putty Surface Preparation", 
      qty: totalBuiltupSqMt.toFixed(2), 
      unit: "SQ.MT", 
      rate: masterItem.paint_putty_rate || 0 
    }
  ];

  return rows.filter(row => Number(row.rate) > 0);
};