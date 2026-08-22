export function getMPDeedContent(deedType: string, data: any) {
  const isHindi = data.outputLanguage === "HINDI";

  switch (deedType) {
    case "SALE DEED":
      return `
        <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 15px;">
          !! श्री !! <br/> || विक्रय – पत्र (SALE DEED) ||
        </div>
        <p><b>प्रथम पक्ष / विक्रेता पक्ष:</b> ${data.sellers?.[0]?.name || ""} (${data.sellers?.[0]?.details || ""})</p>
        <p><b>द्वितीय पक्ष / क्रेता पक्ष:</b> ${data.buyers?.[0]?.name || ""} (${data.buyers?.[0]?.details || ""})</p>
        <br/>
        <p>यह कि प्रथमपक्ष के एकमात्र स्वामित्व एवं आधिपत्य का भूखंड/संपत्ति जो कि <b>${data.propertyAddress}</b>, जिला <b>${data.cityName}</b> (म.प्र.) में स्थित है। जिसका कुल क्षेत्रफल <b>${data.plotArea} वर्गफीट</b> है।</p>
        <p><b>चतुःसीमा (Four Boundaries):</b><br/>
           - पूर्व में: ${data.boundaryEast}<br/>
           - पश्चिम में: ${data.boundaryWest}<br/>
           - उत्तर में: ${data.boundaryNorth}<br/>
           - दक्षिण में: ${data.boundarySouth}
        </p>
        <p><b>विक्रय प्रतिफल (Consideration Amount):</b> ₹ ${data.considerationAmount}/- (रुपये)</p>
        <p>यह कि, इस विक्रय पत्र में निष्पादित संपत्ति के विक्रय द्वारा पंजीयन की <b>धारा २२-क</b> व म.प्र. भू-राजस्व संहिता एवं अन्य किसी भी प्रचलित विधि का उल्लंघन नहीं किया गया है।</p>
      `;

    case "SALE AGREEMENT":
      return `
        <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 15px;">
          !! विक्रय अनुबंध लेख (AGREEMENT TO SALE) ||
        </div>
        <p><b>प्रथम पक्ष / विक्रेता:</b> ${data.sellers?.[0]?.name || ""} (${data.sellers?.[0]?.details || ""})</p>
        <p><b>द्वितीय पक्ष / क्रेता:</b> ${data.buyers?.[0]?.name || ""} (${data.buyers?.[0]?.details || ""})</p>
        <br/>
        <p>यह कि अनुबंधित संपत्ति: <b>${data.propertyAddress}</b>, क्षेत्रफल: <b>${data.plotArea} वर्गफीट</b>, जिला <b>${data.cityName} (म.प्र.)</b>.</p>
        <p><b>कुल अनुबंध राशि:</b> ₹ ${data.considerationAmount}/- | <b>बयाना (Advance):</b> ₹ ${data.bayanaAmount}/- | <b>शेष राशि:</b> ₹ ${data.remainingAmount}/- (${data.paymentPeriod} के भीतर देय)</p>
      `;

    default:
      return `<p>Standard Madhya Pradesh Deed Format for ${deedType}</p>`;
  }
}