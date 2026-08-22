export function getMaharashtraDeedContent(deedType: string, data: any) {
  return `
    <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 15px;">
      DEED OF ${deedType} - MAHARASHTRA JURISDICTION
    </div>
    <p><b>First Party (Vendor):</b> ${data.sellers?.[0]?.name || ""}</p>
    <p><b>Second Party (Purchaser):</b> ${data.buyers?.[0]?.name || ""}</p>
    <p><b>Property Description:</b> ${data.propertyAddress}, Area: ${data.plotArea} Sq. Ft. in ${data.cityName}, Maharashtra.</p>
    <p><b>Consideration Value:</b> ₹ ${data.considerationAmount}/-</p>
    <p>This execution is governed as per the Maharashtra Stamp Act and Registration Rules.</p>
  `;
}