export function generateDeedHtmlContent(formData: any): string {
  const state = formData.stateName?.toUpperCase() || "MADHYA PRADESH";
  const rawDeedType = formData.deedType || "SALE DEED";
  const deedType = rawDeedType.toUpperCase();
  const lang = formData.outputLanguage || "HINDI";

  // Dynamic Header & Labels based on Language
  let headerTitle = "विक्रय – पत्र (SALE DEED)";
  let vendorLabel = "प्रथम पक्ष / विक्रेता पक्ष";
  let purchaserLabel = "द्वितीय पक्ष / क्रेता पक्ष";

  if (lang === "MARATHI" || lang === "मराठी") {
    headerTitle = `खरेदी खत / दस्तऐवज (${rawDeedType})`;
    vendorLabel = "पहिले पक्ष / विक्रेता";
    purchaserLabel = "दुसरे पक्ष / खरेदीदार";
  } else if (lang === "GUJARATI" || lang === "ગુજરાતી") {
    headerTitle = `વેચાણ દસ્તાવેજ (${rawDeedType})`;
    vendorLabel = "પ્રથમ પક્ષ / વેચાણકર્ता";
    purchaserLabel = "બીજા પક્ષ / ખરીદનાર";
  }

  // Formatting Sellers & Buyers List dynamically
  const sellersHtml = formData.sellers?.map((s: any, idx: number) => `
    <p><b>${vendorLabel} ${idx + 1}:</b> ${s.name || "N/A"} <br/><span style="font-size: 13px; color: #555;">${s.details || ""}</span></p>
  `).join("") || `<p><b>${vendorLabel} 1:</b> ${formData.sellerName || "श्री पक्षकार"} <br/><span style="font-size: 13px; color: #555;">${formData.sellerDetails || "निवासी : मध्य प्रदेश"}</span></p>`;

  const buyersHtml = formData.buyers?.map((b: any, idx: number) => `
    <p><b>${purchaserLabel} ${idx + 1}:</b> ${b.name || "N/A"} <br/><span style="font-size: 13px; color: #555;">${b.details || ""}</span></p>
  `).join("") || `<p><b>${purchaserLabel} 1:</b> ${formData.buyerName || "श्री पक्षकार"} <br/><span style="font-size: 13px; color: #555;">${formData.buyerDetails || "निवासी : मध्य प्रदेश"}</span></p>`;

  let mainBodyContent = "";

  // 1. CO-OWNERSHIP DEED TEMPLATE (Checking safely with includes)
  if (deedType.includes("CO-OWNERSHIP") || deedType.includes("सह-स्वामित्व")) {
    headerTitle = "अचल संपत्ति के सह-स्वामित्व का लेख (प्रतिफल रहित)";
    vendorLabel = "प्रथम पक्ष";
    purchaserLabel = "द्वितीय पक्ष";

    mainBodyContent = `
      <div class="section-box">
        <p>यह सह स्वामित्व लेख प्रतिफल रहित निष्पादित कर देने वाले <b>${formData.sellerName || "श्री राजकुमार मेथिल"}</b> निवासी - बरखेड़ा नाथू भोपाल (म.प्र.) जिन्हें कि आगे इस लेख में सुविधा एवं संक्षिप्तता की दृष्टि से <b>"प्रथमपक्ष"</b> के नाम से संबोधित किया गया है, जिसमें वे स्वयं उनके वैध उत्तराधिकारीगण, निष्पादक, निर्देशक, वैध प्रतिनिधि एवं समस्त हितग्राही आदि सम्मिलित हैं, के द्वारा अपनी पत्नी <b>${formData.buyerName || "श्रीमति संगीता मेथिल"}</b> निवासी बरखेड़ा नाथू भोपाल (म.प्र.) (जिन्हें कि आगे इस लेख में <b>"द्वितीयपक्ष"</b> के नाम से संबोधित किया गया है) के पक्ष तथा हित में यह सह-स्वामित्व लेख निम्नानुसार लिखा जाता है कि :-</p>
        
        <p><b>1.</b> यह कि, प्रथमपक्ष के एकमात्र स्वामित्व एवं आधिपत्य भूखण्ड क्रमांक 61, भूमि सर्वे नम्बर 402 ग्राम बरखेड़ानाथू, तहसील हुजुर, डिस्ट्रिक्ट भोपाल (म.प्र.) पर स्थित है। जिसका क्षेत्रफल <b>${formData.plotArea || "242"} वर्गमीटर</b> है। उक्त आवासीय भूखण्ड ग्राम पंचायत रिकॉर्ड में प्रथमपक्ष के नाम पर है।</p>
        
        <div class="boundaries-box">
          <b>उक्त भवन की चतुःसीमा निम्नानुसार है :-</b><br/>
          - पूर्व (East): ${formData.boundaryEast || "गली"}<br/>
          - पश्चिम (West): ${formData.boundaryWest || "मंदिर"}<br/>
          - उत्तर (North): ${formData.boundaryNorth || "भागीरथ का मकान"}<br/>
          - दक्षिण (South): ${formData.boundarySouth || "कमला प्रसाद का मकान"}
        </div>

        <p><b>2.</b> यह कि उक्त चरण क्रमांक 1 में उल्लेखित भूखण्ड व उस पर निर्मित भवन संपत्ति को इस लेख में आगे 'उक्त सम्पत्ति' शब्द से सम्बोधित किया गया है।</p>
        <p><b>3.</b> यह कि, द्वितीयपक्ष, प्रथमपक्ष की पत्नी है। प्रथमपक्ष ने अपने स्वामित्व एवं आधिपत्य की उक्त संपत्ति में अपनी पत्नी को अपनी स्वेच्छा से सहस्वामी बनाया है तथा इस बावत प्रथमपक्ष ने द्वितीयपक्ष से कोई प्रतिफल प्राप्त नहीं किया है। इस प्रकार उक्त संपत्ति में दोनों का 50% - 50% बराबर हक व अधिकार रहेगा।</p>
        <p><b>4.</b> यह कि उक्त संपत्ति प्रथमपक्ष के एकमेव स्वामित्व की होकर, इसमें द्वितीयपक्ष को अविभाजित आधे भाग का सहस्वामी बनाने का पूर्ण अधिकार प्रथमपक्ष को है।</p>
        <p><b>5.</b> यह कि अब उक्त संपत्ति का उपयोग, उपभोग संयुक्त स्वामित्व नाते से द्वितीयपक्ष कर सकेंगी।</p>
        <p><b>6.</b> यह कि उक्त सम्पत्ति पर किसी भी वित्तीय संस्था का कोई ऋण भार नहीं है।</p>
        <p><b>7.</b> यह कि संपत्ति हर प्रकार के गिरवी, बिक्री, दान, ऋण आदि से शुद्ध व मुक्त है। दस्तावेज में वर्णित संपत्ति शासकीय या नजूल भूमि नहीं है।</p>
        <p><b>8.</b> यह कि द्वितीयपक्ष संबंधित शासकीय कार्यालयों में अपना नाम सहस्वामी के रूप में अंकित करवा सकेंगी।</p>
        <p><b>9.</b> यह कि देय समस्त शासकीय टैक्सेस, संपत्तिकर व विद्युत बिल दोनों मिलकर भुगतान करेंगे।</p>
        <p><b>10.</b> यह लेख नियमानुसार मुद्रांक शुल्क पर निष्पादित कराया गया है (धारा 22-क का कोई उल्लंघन नहीं है)।</p>
        <p><b>11.</b> हम निष्पादकों द्वारा प्रदान की गई जानकारी के आधार पर यह प्रारूप तैयार हुआ है। भविष्य में किसी भी त्रुटि के लिए निष्पादक जिम्मेदार रहेंगे, सर्विस प्रोवाइडर की कोई जवाबदारी नहीं रहेगी।</p>
      </div>
    `;
  } 
  // 2. SALE DEED TEMPLATE (PLOT, FLAT, HOUSE)
  else {
    let subType = formData.propertySubType || "PLOT";
    let propertyDescription = "";

    if (subType === "PLOT" || deedType.includes("PLOT")) {
      propertyDescription = `1. यहाँ की प्रथमपक्ष / विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह भूखंड <b>${formData.propertyAddress}</b> पर स्थित है। जिसका क्षेत्रफल <b>${formData.plotArea || "1000"} वर्गफीट</b> है। सदर भूखंड वर्तमान में रिक्त अवस्था में है। उक्त संपत्ति को विक्रय करने का पूर्ण वैधानिक अधिकार विक्रेता पक्ष को प्राप्त है।`;
    } else if (subType === "FLAT" || deedType.includes("FLAT")) {
      propertyDescription = `1. यहाँ की विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह प्रकोष्ठ/फ्लैट <b>${formData.propertyAddress}</b> पर स्थित है। जिसका सुपर बिल्ट अप एरिया <b>${formData.plotArea || "715"} वर्गफीट</b> है। उक्त प्रकोष्ठ पूर्ण निर्मित अवस्था में एवं आवासीय उपयोग का है।`;
    } else {
      propertyDescription = `1. यहाँ की विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह भवन/दुकान <b>${formData.propertyAddress}</b> पर स्थित है। जिसका बिल्टअप एरिया <b>${formData.plotArea || "550"} वर्गफीट</b> है।`;
    }

    mainBodyContent = `
      <div class="section-box">
        <p>यह विक्रय निष्पादित करने वाले पक्षकारों द्वारा यह विक्रय पत्र अपने पक्ष तथा हित में लिखवा लिया गया है। प्रथम पक्ष / विक्रेतापक्ष द्वारा द्वितीय पक्ष / क्रेतापक्ष के हित में यह विक्रय पत्र निष्पादित किया जाता है कि : -</p>
        
        <p>${propertyDescription}</p>

        <p>2. विक्रय की जा रही संपत्ति की चतुःसीमा निम्नानुसार है : -</p>
        <div class="boundaries-box">
          <b>चतुःसीमा (Four Boundaries):</b><br/>
          - पूर्व (East): ${formData.boundaryEast || "कॉलोनी का रोड"}<br/>
          - पश्चिम (West): ${formData.boundaryWest || "अन्य का मकान"}<br/>
          - उत्तर (North): ${formData.boundaryNorth || "अन्य भूखंड"}<br/>
          - दक्षिण (South): ${formData.boundarySouth || "शेष भाग"}
        </div>

        <p>3. यह कि उपरोक्तानुसार वर्णित संपत्ति का विक्रय प्रतिफल <b>₹ ${formData.considerationAmount || "0"}/-</b> (रुपये ${formData.considerationAmountWords || "मात्र"}) तय हुआ है, जिसकी संपूर्ण राशि प्राप्त कर ली गई है।</p>
        <p>4. यह कि संपत्ति का भौतिक आधिपत्य क्रेतापक्ष को सौंप दिया गया है।</p>
        <p>5. यह कि संपत्ति से संबंधित समस्त अधिकार क्रेतापक्ष में वेष्ठित हो गए हैं।</p>
        <p>6. यह कि संपत्ति हर प्रकार के ऋण, भार, गिरवी आदि से मुक्त है।</p>
        <p>7. यह कि भविष्य में कोई विवाद होने पर निराकरण की जिम्मेदारी विक्रेता की होगी।</p>
        <p>8. यह कि पंजीयन दिनांक के पश्चात के कर/टैक्स क्रेता वहन करेंगे।</p>
        <p>9. यह कि क्रेता अपने व्यय से नामांतरण करा सकेंगे।</p>
        <p>10. यह कि समस्त मूल दस्तावेज क्रेता को सुपुर्द कर दिए गए हैं।</p>
        <p>11. यह कि पंजीयन अधिनियम की धारा 22-क का उल्लंघन नहीं किया गया है।</p>
        <p>12. यह प्रारूप पक्षकारों द्वारा दी गई जानकारी के आधार पर तैयार किया गया है।</p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="${lang.toLowerCase()}">
    <head>
      <meta charset="UTF-8">
      <title>${rawDeedType} - Draft</title>
      <style>
        body { font-family: 'Mangal', 'Arial', sans-serif; font-size: 14px; line-height: 1.8; color: #111; margin: 40px; background: #fff; }
        .deed-container { max-width: 850px; margin: 0 auto; border: 1px solid #ccc; padding: 40px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
        .study-notice { background: #fef3c7; border: 1px dashed #d97706; color: #92400e; padding: 10px; font-size: 12px; text-align: center; margin-bottom: 20px; font-weight: bold; border-radius: 4px; }
        .header-title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
        .meta-info { font-size: 12px; color: #555; margin-bottom: 20px; background: #f8fafc; padding: 10px; border-radius: 5px; }
        .section-box { margin-bottom: 15px; text-align: justify; }
        .boundaries-box { background: #f1f5f9; padding: 12px; border-radius: 6px; margin-top: 10px; margin-bottom: 15px; }
        .signature-section { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-box { width: 45%; text-align: center; border-top: 1px dashed #333; padding-top: 10px; margin-top: 50px; }
        .print-btn-container { text-align: center; margin-top: 30px; }
        .print-btn { background: #1d4ed8; color: #fff; padding: 10px 25px; font-size: 14px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; }
        .print-btn:hover { background: #1e40af; }
        @media print { .print-btn-container { display: none; } body { margin: 0; } .deed-container { border: none; box-shadow: none; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="deed-container">
        
        <!-- Notice for Study Purpose & Registration Procedure Alert -->
        <div class="study-notice">
          ⚠️ यह दस्तावेज़ केवल पठन, अध्ययन एवं सॉफ्टवेयर परीक्षण हेतु प्रारूप (Draft) है। यह कोई अंतिम कानूनी डीड नहीं है। अंतिम पंजीयन से पूर्व उप-रजिस्ट्रार कार्यालय (Registrar Office) की विधिक एवं नियमानुसार प्रक्रियाओं का पालन करना अनिवार्य है।
        </div>

        <div class="meta-info">
          <b>State:</b> ${formData.stateName || "Madhya Pradesh"} | <b>City/District:</b> ${formData.cityName || "Indore"} | <b>Language:</b> ${lang}
        </div>

        <div class="header-title">
          !! श्री !! <br/> ${headerTitle}
        </div>

        <div class="section-box">
          ${sellersHtml}
          <br/>
          ${buyersHtml}
        </div>

        <hr style="border: 0.5px solid #e2e8f0; margin: 20px 0;"/>

        ${mainBodyContent}

        <div class="section-box" style="margin-top: 30px;">
          <p><b>स्थान (Place):</b> ${formData.cityName || "इंदौर"} (${state})</p>
          <p><b>दिनांक (Date):</b> ........................................</p>
        </div>

        <!-- Signature Blocks for Parties -->
        <div class="signature-section">
          <div class="sig-box">
            <b>(${vendorLabel})</b><br/>
            प्रथम पक्ष / विक्रेता के हस्ताक्षर
          </div>
          <div class="sig-box">
            <b>(${purchaserLabel})</b><br/>
            द्वितीय पक्ष / क्रेता के हस्ताक्षर
          </div>
        </div>

        <div class="signature-section" style="margin-top: 20px;">
          <div class="sig-box">
            <b>साक्षी (Witness 1):</b><br/>
            हस्ताक्षर: ........................................
          </div>
          <div class="sig-box">
            <b>साक्षी (Witness 2):</b><br/>
            हस्ताक्षर: ........................................
          </div>
        </div>

        <div class="section-box" style="font-size: 11px; color: #556; margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
          <b>Disclaimer:</b> This deed has been generated automatically through an automated software tool for study and reference purposes only, based on user inputs. No advocate or legal professional has drafted or verified this document. The software developer, platform, and service provider disown all legal, civil, or criminal liabilities regarding party identity, property title, legal compliance, and final registration procedures.
        </div>

        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF 🖨️</button>
        </div>

      </div>
    </body>
    </html>
  `;
}