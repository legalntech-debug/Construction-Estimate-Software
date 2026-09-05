export function generateDeedHtmlContent(formData: any): string {
  const state = formData.stateName?.toUpperCase() || "MADHYA PRADESH";
  const rawDeedType = formData.deedType || "SALE DEED";
  const deedType = rawDeedType.toUpperCase();
  const lang = (formData.outputLanguage || "HINDI").toUpperCase();

  let headerTitle = "विक्रय – पत्र (SALE DEED)";
  let vendorLabel = "प्रथम पक्ष / विक्रेता पक्ष";
  let purchaserLabel = "द्वितीय पक्ष / क्रेता पक्ष";

  // सभी 6 Deed Types के आधार पर पहचान और टाइटल्स तय करना
  const isSaleAgreement = deedType.includes("SALE AGREEMENT") || deedType.includes("अनुबंध") || deedType.includes("AGREEMENT");
  const isCoOwnership = deedType.includes("CO_OWNERSHIP") || deedType.includes("CO-OWNERSHIP");
  const isMortgage = deedType.includes("MORTGAGE") || deedType.includes("MODT") || deedType.includes("बंधक");
  const isRelease = deedType.includes("RELEASE") || deedType.includes("हकत्याग") || deedType.includes("रिलिज़");
  const isGift = deedType.includes("GIFT") || deedType.includes("दान");

  if (isSaleAgreement) {
    headerTitle = "विक्रय अनुबंध / इकरारनामा (AGREEMENT TO SELL)";
    vendorLabel = "प्रथमपक्ष / विक्रेता";
    purchaserLabel = "द्वितीयपक्ष / क्रेता";
  } else if (isCoOwnership) {
    headerTitle = "सह-स्वामित्व विलेख (CO-OWNERSHIP DEED)";
    vendorLabel = "प्रथम पक्ष / सह-स्वामित्वकर्ता";
    purchaserLabel = "द्वितीय पक्ष / सह-स्वामित्वकर्ता";
  } else if (isMortgage) {
    headerTitle = "Equitable Mortgage / निक्षेप विलेख (MODT)";
    vendorLabel = "ऋणदाता / बैंक पक्ष";
    purchaserLabel = "ऋणी / Mortgagor पक्ष";
  } else if (isRelease) {
    headerTitle = "हकत्याग विलेख / रिलीज़ डीड (RELEASE DEED)";
    vendorLabel = "हकत्यागकर्ता (Releasor)";
    purchaserLabel = "हकप्राप्तकर्ता (Releasee)";
  } else if (isGift) {
    headerTitle = "दान-पत्र विलेख (GIFT DEED)";
    vendorLabel = "दाता पक्ष (Donor)";
    purchaserLabel = "प्राप्तकर्ता पक्ष (Donee)";
  }

  // प्रॉपर्टी के प्रकार के अनुसार हिंदी शब्द तय करना (यह सभी डीड्स में काम करेगा)
  const subType = (formData.propertySubType || formData.propertyType || "").toUpperCase();
  let propertyNounHindi = "भूखंड";
  if (subType.includes("FLAT") || subType.includes("प्रकोष्ठ")) {
    propertyNounHindi = "प्रकोष्ठ";
  } else if (subType.includes("COMMERCIAL") || subType.includes("SHOP") || subType.includes("दुकान")) {
    propertyNounHindi = "दुकान";
  } else if (subType.includes("PLOT") || subType.includes("भूखंड")) {
    propertyNounHindi = "भूखंड";
  } else {
    propertyNounHindi = "भवन / संपत्ति";
  }

  // आगे का कोड (Main Body Content और HTML रिटर्न करने वाला हिस्सा) यहाँ से शुरू करें...

  // भाषा के अनुसार लेबल्स (मराठी और गुजराती सपोर्ट)
  if (lang === "MARATHI" || lang === "मराठी") {
    if (isSaleAgreement) {
      headerTitle = `खरेदी करार / इसरारपावती (${rawDeedType})`;
      vendorLabel = "पहिले पक्ष / विक्रेता";
      purchaserLabel = "दुसरे पक्ष / खरेदीदार";
    } else if (isRelease) {
      headerTitle = `हकत्याग पत्र / रिलीज डीड (${rawDeedType})`;
      vendorLabel = "हकत्यागकर्ता";
      purchaserLabel = "हकप्राप्तकर्ता";
    } else if (isGift) {
      headerTitle = `बक्षीस पत्र / गिफ्ट डीड (${rawDeedType})`;
      vendorLabel = "दाता";
      purchaserLabel = "स्वीकारकर्ता";
    } else {
      headerTitle = `खरेदी खत / दस्तऐवज (${rawDeedType})`;
      vendorLabel = "पहिले पक्ष / विक्रेता";
      purchaserLabel = "दुसरे पक्ष / खरेदीदार";
    }
  } else if (lang === "GUJARATI" || lang === "ગુજરાતી") {
    if (isSaleAgreement) {
      headerTitle = `વેચાણ કરાર (${rawDeedType})`;
    } else if (isRelease) {
      headerTitle = `હકત્યાગ દસ્તાવેજ (${rawDeedType})`;
    } else if (isGift) {
      headerTitle = `બક્ષિસ દસ્તાવેજ (GIFT DEED)`;
    } else {
      headerTitle = `વેચાણ દસ્તાવેज (${rawDeedType})`;
    }
    vendorLabel = "પ્રથમ પક્ષ / પક્ષકાર ૧";
    purchaserLabel = "બીજા પક્ષ / પક્ષકાર ૨";
  }
  const sellersHtml = formData.sellers?.map((s: any, idx: number) => `
    <div style="margin-bottom: 20px;">
      <p style="margin: 0; font-weight: bold;">${s.name || "N/A"}</p>
      <p style="margin: 2px 0;">${s.details || ""}</p>
      <div style="text-align: right; font-weight: bold; color: #b91c1c; margin-top: 5px;">
        ---------------------------- ${vendorLabel} ${formData.sellers.length > 1 ? idx + 1 : ""}
      </div>
    </div>
  `).join("") || `
    <div style="margin-bottom: 20px;">
      <p style="margin: 0; font-weight: bold;">${formData.sellerName || "श्री दीपक गड़वाल पिता तोताराम गड़वाल"}</p>
      <p style="margin: 2px 0;">${formData.sellerDetails || "निवास : भवानी नगर, सांवेर रोड, इंदौर"}</p>
      <div style="text-align: right; font-weight: bold; color: #b91c1c; margin-top: 5px;">
        ---------------------------- ${vendorLabel}
      </div>
    </div>`;

  const buyersHtml = formData.buyers?.map((b: any, idx: number) => `
    <div style="margin-bottom: 20px;">
      <p style="margin: 0; font-weight: bold;">${b.name || "N/A"}</p>
      <p style="margin: 2px 0;">${b.details || ""}</p>
      <div style="text-align: right; font-weight: bold; color: #b91c1c; margin-top: 5px;">
        ---------------------------- ${purchaserLabel} ${formData.buyers.length > 1 ? idx + 1 : ""}
      </div>
    </div>
  `).join("") || `
    <div style="margin-bottom: 20px;">
      <p style="margin: 0; font-weight: bold;">${formData.buyerName || "श्रीमती सुनीता खण्डेलवाल पति प्रदीप खण्डेलवाल"}</p>
      <p style="margin: 2px 0;">${formData.buyerDetails || "निवास : C-807, सुखलिया सेक्टर, इंदौर, मध्य प्रदेश (452005)"}</p>
      <div style="text-align: right; font-weight: bold; color: #b91c1c; margin-top: 5px;">
        ---------------------------- ${purchaserLabel}
      </div>
    </div>`;

  const sellerIntroText = formData.sellers?.map((s: any) => `${s.name} (${s.details || ""})`).join(", ") || `${formData.sellerName || "श्री दीपक गड़वाल"} (${formData.sellerDetails || "निवासी : इंदौर"})`;
  const buyerIntroText = formData.buyers?.map((b: any) => `${b.name} (${b.details || ""})`).join(", ") || `${formData.buyerName || "श्रीमती सुनीता खण्डेलवाल"} (${formData.buyerDetails || "निवासी : इंदौर"})`;

  let propertyDescription = "";

  const getLocalizedFloorName = (fName: string) => {
    const upper = (fName || "").toUpperCase();
    if (lang === "HINDI") {
      if (upper.includes("GROUND")) return "भूतल (Ground Floor)";
      if (upper.includes("FIRST")) return "प्रथम तल (First Floor)";
      if (upper.includes("SECOND")) return "द्वितीय तल (Second Floor)";
      if (upper.includes("THIRD")) return "तृतीय तल (Third Floor)";
      if (upper.includes("TOWER")) return "टावर (Tower)";
      if (upper.includes("BASEMENT")) return "तहखाना (Basement)";
    }
    return fName;
  };

  if (subType.includes("PLOT") || subType.includes("भूखंड")) {
    const plotAddress = formData.propertyAddress || "भूखंड क्रमांक 81, द्वारका वेली, ग्राम मंगलिया तहसील सांवेर, जिला इंदौर, (म.प्र.)";
    const plotAreaVal = formData.plotArea || "1000";
    const plotUnit = formData.plotAreaUnit || "वर्गफीट";
    const sqMeters = formData.sqMeters || "92.90";
    const registryOffice = formData.registryOffice || "जिला इंदौर";
    const registryDate = formData.registryDate || "13/12/2025";
    const registryNo = formData.registryNo || "MP319522023A114771720";

    propertyDescription = `
      <p><b>1.</b> यह कि प्रथमपक्ष / विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह भूखंड <b>${plotAddress}</b> सा स्थित है | जिसका एरिया <b>${plotAreaVal} ${plotUnit}</b> (अर्थात <b>${sqMeters} वर्गमीटर</b>) है जिसका पंजीयक कार्यालय <b>${registryOffice}</b> में दिनांक <b>${registryDate}</b> को कराया है जिसका क्रमांक <b>${registryNo}</b> पर पंजीकृत है सदर भूखंड वर्तमान में रिक्त अवस्था में होकर उस पर किसी भी प्रकार का कोई निर्माण कार्य नहीं किया गया है सदर संपत्ति का उपयोग एवं उपभोग विक्रेता पक्ष द्वारा मालिक एवं स्वामी के रूप में किया जा रहा है। इस प्रकार उक्त संपत्ति को विक्रय (बेचने) करने का पूर्ण एवं वैधानिक अधिकार विक्रेता पक्ष को प्राप्त है।</p>
      
      <p style="text-align: center; font-weight: bold; margin-top: 15px;">!! विक्रीत भूखंड का वर्णन !!</p>
      <p><b>${plotAddress}</b> में स्थित है | उक्त भूखंड का कुल क्षेत्रफल <b>${plotAreaVal} ${plotUnit}</b> (अर्थात <b>${sqMeters} वर्गमीटर</b>) है सदर भूखंड वर्तमान में रिक्त अवस्था में होकर उस पर किसी भी प्रकार का कोई निर्माण कार्य नहीं किया गया है जिसे इस लेख के माध्यम से विक्रेतापक्ष द्वारा क्रेतापक्ष को विक्रय किया जा रहा है</p>
    `;
  } else if (subType.includes("FLAT") || subType.includes("प्रकोष्ठ")) {
    const flatNo = formData.flatNumber || formData.propertyAddress || "प्रकोष्ठ क्रमांक 304, शांति सफायर ब्लॉक बी";
    const floorName = getLocalizedFloorName(formData.flatFloor || "तृतीय मंजिल");
    const landDetails = formData.landDetails || "भूखंड क्रमांक 55, श्री कृष्ण ऐवेन्यू फेस 3, ग्राम लिम्बोदड़ी, तहसील व जिला इंदौर (म.प्र.)";
    const superBuiltUp = formData.plotArea || "715";

    propertyDescription = `
      <p><b>1.</b> यह कि प्रथमपक्ष / विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह प्रकोष्ठ/फ्लैट <b>${flatNo}</b>, जो कि <b>${floorName}</b> पर स्थित है तथा जिस भूखंड पर यह निर्मित है वह <b>${landDetails}</b> स्थित है। जिसका सुपर बिल्ट अप एरिया <b>${superBuiltUp} वर्गफीट</b> है। इस प्रकोष्ठ की पार्टीशन वॉल, फर्श व छत सामाहती उपयोग की होकर इस विक्रय पत्र में छत के अधिकार सम्मिलित नहीं हैं। उक्त प्रकोष्ठ पूर्ण निर्मित एवं आवासीय उपयोग का है। उक्त संपूर्ण भवन आवासीय उपयोग का होकर विक्रत प्रकोष्ठ भी आवासीय उपयोग का है। सदर संपत्ति का उपयोग एवं उपभोग विक्रेता पक्ष द्वारा मालिक व स्वामी नाते कर रहे हैं। इस प्रकार सदर संपत्ति को विक्रय करने का विक्रेता पक्ष को पूर्ण वैधानिक अधिकार प्राप्त है।</p>
      
      <p style="text-align: center; font-weight: bold; margin-top: 15px;">!! प्रकोष्ठ / भूखंड का वर्णन !!</p>
      <p>यह प्रकोष्ठ <b>${flatNo}</b>, जो कि <b>${floorName}</b> पर स्थित है तथा भूखंड <b>${landDetails}</b> पर स्थित है। जिसका सुपर बिल्ट अप एरिया <b>${superBuiltUp} वर्गफीट</b> है जिसका यहाँ विक्रय है। इस प्रकोष्ठ की पार्टीशन वॉल, फर्श व छत सामाहती उपयोग की होकर इस विक्रय पत्र में छत के अधिकार सम्मिलित नहीं हैं। उक्त प्रकोष्ठ पूर्ण निर्मित अवस्था में है। उक्त संपूर्ण भवन आवासीय उपयोग का होकर विक्रत प्रकोष्ठ भी आवासीय उपयोग का है।</p>
    `;
  } else if (subType.includes("COMMERCIAL") || subType.includes("SHOP") || subType.includes("दुकान")) {
    propertyDescription = `
      यह कि दुकान शहर <b>${formData.cityName || "इंदौर"}</b> के <b>${formData.propertyAddress || "ट्रांसपोर्ट नगर स्थित दुकान क्रमांक 6"}</b> हैं। सदर दुकान का बिल्टअप एरिया <b>${formData.plotArea || "550"} वर्गफीट</b> है। सदर दुकान के निकास की व्यवस्था भवन के कॉमन पैसेज से होकर सामने की रोड से रहेगी। सदर दुकान व्यावसायिक उपयोग की हैं।
    `;
  } else {
    const floorsList = formData.floorsList && formData.floorsList.length > 0 ? formData.floorsList : [
      { floorName: "GROUND FLOOR", builtUpArea: "800", areaUnit: "Sq. Ft.", constructionType: "RCC Frame Structure" }
    ];

    const totalBuiltUp = floorsList.reduce((acc: number, f: any) => acc + (parseFloat(f.builtUpArea) || 0), 0);
    
    const floorsTextDescr = floorsList.map((f: any, idx: number) => {
      const fName = getLocalizedFloorName(f.floorName);
      const bArea = f.builtUpArea || "0";
      const u = f.areaUnit || "Sq. Ft.";
      const cType = f.constructionType || "RCC Frame Structure";
      return `${idx > 0 ? ", तथा " : ""}${fName} पर निर्मित क्षेत्र ${bArea} ${u} (${cType})`;
    }).join("");

    const floorNamesString = floorsList.map((f: any) => getLocalizedFloorName(f.floorName)).join(', ');

    propertyDescription = `
      <p><b>1.</b> यह कि प्रथमपक्ष / विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का बहुमंजिला भवन/मकान <b>${formData.propertyAddress || "भूखंड क्रमांक 81"}</b> पर स्थित है। जिसके अंतर्गत कुल भूमि/प्लॉट क्षेत्रफल <b>${formData.plotArea || "1000"} ${formData.plotAreaUnit || "वर्गफीट"}</b> है, जिस पर ${floorsTextDescr} का निर्माण कार्य किया गया है, जिसका कुल संचयी (Total) बिल्टअप एरिया करीब <b>${totalBuiltUp} वर्गफीट</b> है।</p>
      
      <p>सदर संपत्ति का उपयोग एवं उपभोग विक्रेता पक्ष द्वारा मालिक एवं स्वामी के रूप में किया जा रहा है। इस प्रकार उक्त निर्मित बहुमंजिला भवन व भूमि को विक्रय करने का पूर्ण वैधानिक अधिकार विक्रेता पक्ष को प्राप्त है।</p>
      
      <p style="text-align: center; font-weight: bold; margin-top: 15px;">!! विक्रीत बहुमंजिला भवन / संपत्ति का विस्तृत वर्णन !!</p>
      <p>आवासीय/व्यावसायिक बहुमंजिला संपत्ति <b>${formData.propertyAddress || "81"}</b> में स्थित है। उक्त संपत्ति का कुल प्लॉट क्षेत्रफल <b>${formData.plotArea || "1000"} ${formData.plotAreaUnit || "वर्गफीट"}</b> है जिसके ऊपर ${floorNamesString} पर कुल <b>${totalBuiltUp} वर्गफीट</b> का निर्माण स्थित है। जिसे इस लेख के माध्यम से विक्रेतापक्ष द्वारा क्रेतापक्ष को विक्रय किया जा रहा है।</p>
    `;
  }

  // Dynamic Installments HTML mapping
  const installmentsHtml = formData.installments && formData.installments.length > 0 
    ? formData.installments.map((inst: any) => `
        <p style="margin-left: 20px; margin-bottom: 8px;">
          • रुपये <b>${inst.amount || "0"}/-</b> (अक्षरी रुपये <b>${inst.amountWords || "................................................................................................"}</b> मात्र) माध्यम <b>${inst.mode || "RTGS / NEFT"}</b> (विवरण / Ref No: <b>${inst.date || "N/A"}</b>) के द्वारा प्रथमपक्ष / विक्रेता ने द्वितीयपक्ष / क्रेता पक्ष से प्राप्त किये हैं।
        </p>
      `).join("")
    : `
        <p style="margin-left: 20px; margin-bottom: 8px;">
          • रुपये ........................................................../- (अक्षरी रुपये .................................................................................................. मात्र) के बैंक/चेक/नकद माध्यम से प्रथमपक्ष / विक्रेता ने द्वितीयपक्ष / क्रेतापक्ष से प्राप्त किये है
        </p>
      `;

  // डीड प्रकार के आधार पर परिचय और एक्शन टेक्स्ट तय करना
  let deedContextTitle = "विक्रय निष्पादित कर देने वाले";
  let deedActionText = "विक्रय पत्र";

  if (isSaleAgreement) {
    deedContextTitle = "विक्रय अनुबंध (Sale Agreement)";
    deedActionText = "विक्रय अनुबंध / इकरारनामा";
  } else if (isCoOwnership) {
    deedContextTitle = "सह-स्वामित्व विलेख (Co-Ownership Deed)";
    deedActionText = "सह-स्वामित्व विलेख";
  } else if (isMortgage) {
    deedContextTitle = "इक्विटेबल मॉर्गेज / निक्षेप विलेख (MODT)";
    deedActionText = "बंधक विलेख (Mortgage Deed)";
  } else if (isRelease) {
    deedContextTitle = "हकत्याग विलेख (Release Deed)";
    deedActionText = "हकत्याग पत्र";
  } else if (isGift) {
    deedContextTitle = "दान-पत्र विलेख (Gift Deed)";
    deedActionText = "दान-पत्र";
  }

  let mainBodyContent = "";

  // 1. SALE AGREEMENT (विक्रय अनुबंध) के लिए क्लॉज़
  if (isSaleAgreement) {
    mainBodyContent = `
      <div class="section-box">
        <p>
          यह ${deedContextTitle} <b>${sellerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${vendorLabel}”</b> के शब्द से संबोधित किया गया है; तथा <b>${buyerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${purchaserLabel}”</b> के शब्द से संबोधित किया गया है, के मध्य निष्पादित किया जा रहा है।
        </p>
        
        <p>मैं प्रथम पक्ष / ${vendorLabel} आप द्वितीय पक्ष / ${purchaserLabel} के हित में यह <b>${deedActionText}</b> स्वेच्छा से निष्पादित करता/करती हूँ कि : -</p>
        
        <p style="text-align: center; font-weight: bold; margin-top: 20px;">!! संपत्ति का वर्णन एवं विवरण !!</p>
        <p>${propertyDescription}</p>

        <div class="boundaries-box">
          <p style="text-align: center; font-weight: bold; margin-bottom: 12px;">!! सदर संपत्ति की चतुःसीमा निम्नानुसार है !!</p>
          <table style="width: 85%; margin: 0 auto; border-collapse: collapse;">
            <tr><td style="width: 25%; padding: 6px 0; font-weight: bold;">पूर्व में</td><td style="width: 5%; text-align: center;">:</td><td style="width: 70%; padding: 6px 0;">${formData.boundaryEast || "कॉलोनी का रोड"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">पश्चिम में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryWest || "भूखंड क्रमांक 94"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">उत्तर में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryNorth || "भूखंड क्रमांक 80"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">दक्षिण में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundarySouth || "इसी भूखंड का शेष भाग"}</td></tr>
          </table>
        </div>

        <p><b>1.</b> यह कि उपरोक्त वर्णन व चतुःसीमा के <b>${propertyNounHindi}</b> को इस लेख में आगे सुविधा के लिये "उक्त संपत्ति" शब्द से संबोधित किया गया हैं।</p>
        
        <p><b>2.</b> यह कि, उक्त चरण 1 में वर्णित उक्त प्रकोष्ठ को विक्रेता / प्रथमपक्ष ने द्वितीयपक्ष/क्रेता को क्रय करने का अनुबंध राशि रूपये <b>${formData.considerationAmount || "0"}</b>/- (अक्षरी मात्र) में क्रय करना तय किया होकर सदर अनुबंध पेटे बयाना ${formData.advanceAmount || "........"} /- (अक्षरी मात्र) नगद विक्रेतापक्ष को अदा कर दिये है तथा शेष रूपये ${formData.balanceAmount || "........"} /- (अक्षरी मात्र) आज अनुबंध दिनांक से 3 माह की अवधि में क्रेता विभिन्न / लोन माध्यम से विक्रेता को अदा करेंगे।</p>
        
        ${installmentsHtml}

        <p><b>3.</b> यह कि, उक्त संपत्ति विक्रेता ने द्वितीयपक्ष/क्रेता के सिवाय अन्य किसी को दान, गिरवी बक्षिस जमानत मेंटेनेंस, रहन, कर्जे आदि तरीकों से अंतरित या भारित नहीं की है ना ही किसी को विक्रय करने का अनुबंध किया है.</p>
        
        <p><b>4.</b> यह कि, उक्त संपत्ति बाबद भविष्य में किसी भी व्यक्ति, संस्था, बैंक, आदि ने स्वामित्व बाबद विवाद किया तो इसकी एकमात्र संपूर्ण जवाबदारी विक्रेता / प्रथमपक्ष की रहेगी.</p>
        
        <p><b>5.</b> यह कि, उक्त संपत्ति के पंजीयन दिनांक तक लगने वाले समस्त कर, टेक्स आदि अदा करने की जवाबदारी विक्रेता / प्रथमपक्ष की रहेगी तथा पंजीयन दिनांक के पश्चात् अदा करने की जवाबदारी द्वितीयपक्ष/क्रेता की रहेगी.</p>
        
        <p><b>6.</b> यह कि, क्रेतापक्ष उक्त सम्पत्ति किसी भी प्रकार की दस्तावेजों की आवश्यकता होने पर विक्रेतापक्ष क्रेतापक्ष को उक्त दस्तावेजों को प्रदान करने का दायित्व विक्रेतापक्ष का होगा.</p>
        
        <p><b>7.</b> यह कि, उक्त संपत्ति की संपूर्ण राशि का भुगतान करने के बाद भी यदि विक्रेता/ प्रथमपक्ष ने द्वितीयपक्ष/क्रेता के हित में विक्रय पत्र का पंजीयन कराने से इन्कार किया तो द्वितीयपक्ष/क्रेता, विक्रेता / प्रथमपक्ष के विरूद्ध सक्षम न्यायालय में "स्पेसिफिक परफारमेंस ऑफ दि कान्ट्रेक्ट" का वाद लगाकर अपने हित में पंजीयन करवा लेवेंगे और अगर क्रेता पक्ष समय पर पेमेन्ट न कर पाये तो या फ्लेट लेने में आना कानी करेगें तो यह सौदा निरस्त माता जायेगा बिना कुछ शुल्क का देन देन करके.</p>
        
        <p><b>8.</b> यह कि, विक्रेतापक्ष किसी कारणवश पंजीयन करने से इन्कार कर देते है तो वह क्रेतापक्ष को प्राप्त हुई राशि का दोगुना मय व्याज के अदा करेगें तथा उक्त राशि देने से इन्कार करते है तो द्वितीयपक्ष/क्रेता, विक्रेता / प्रथमपक्ष के विरुद्ध सक्षम न्यायालय में "स्पेसिफिक परफारमेंस ऑफ दि कान्ट्रेक्ट" का वाद लगाकर अपने हित में पंजीयन करवा लेवेंगे.</p>
        
        <p style="margin-top: 15px; font-style: italic;">अतः यह विक्रय अनुबंध लेख विक्रेता / प्रथमपक्ष ने द्वितीयपक्ष/क्रेता के हित में अपने पूर्ण होशो हवास में बिना नशा पानी के, दो गवाहों के समक्ष निष्पादित कर दिया सो सही ताकि वक्त जरूरत काम आवे।</p>
      </div>
    `;
  } 
  // 2. CO-OWNERSHIP DEED (सह-स्वामित्व विलेख) के लिए क्लॉज़
  else if (isCoOwnership) {
    mainBodyContent = `
      <div class="section-box">
        <p>
          यह ${deedContextTitle} <b>${sellerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${vendorLabel}”</b> के शब्द से संबोधित किया गया है; तथा <b>${buyerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${purchaserLabel}”</b> के शब्द से संबोधित किया गया है, के मध्य निष्पादित किया जा रहा है।
        </p>
        
        <p style="text-align: center; font-weight: bold; margin-top: 20px;">!! संपत्ति का वर्णन एवं विवरण !!</p>
        <p>${propertyDescription}</p>

        <div class="boundaries-box">
          <p style="text-align: center; font-weight: bold; margin-bottom: 12px;">!! सदर संपत्ति की चतुःसीमा निम्नानुसार है !!</p>
          <table style="width: 85%; margin: 0 auto; border-collapse: collapse;">
            <tr><td style="width: 25%; padding: 6px 0; font-weight: bold;">पूर्व में</td><td style="width: 5%; text-align: center;">:</td><td style="width: 70%; padding: 6px 0;">${formData.boundaryEast || "कॉलोनी का रोड"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">पश्चिम में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryWest || "भूखंड क्रमांक 94"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">उत्तर में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryNorth || "भूखंड क्रमांक 80"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">दक्षिण में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundarySouth || "इसी भूखंड का शेष भाग"}</td></tr>
          </table>
        </div>

        <p><b>1.</b> यह कि उक्त चरण क्रमांक १ में उल्लेखित ${propertyNounHindi} व उस पर निर्मित संपत्ति को इस लेख में आगे सुविधा एवं संक्षिप्ता की दृष्टि से 'उक्त सम्पत्ति' शब्द से सम्बोधित किया गया है जिसका आशय ${formData.propertyAddress || "........"} पर स्थित संपत्ति से है.</p>
        
        <p><b>2.</b> यह कि, द्वितीयपक्ष, प्रथमपक्ष की पत्नी है। प्रथमपक्ष ने अपने स्वामित्व एवं आधिपत्य की उक्त चरण क्रमांक १ में वर्णित एवं चतुःसीमा के मध्य की तथा विवरण की सदर संपत्ति में अपनी पत्नी को अपनी स्वेच्छा से सहस्वामी बनाया है तथा इस बावत प्रथमपक्ष ने द्वितीयपक्ष से कोई प्रतिफल प्राप्त नहीं किया होकर यह लेख प्रथमपक्ष द्वारा द्वितीयपक्ष के पक्ष तथा हित में निष्पादित कर पंजीयत करवाया जा रहा है। इस प्रकार उक्त चरण क्रमांक १ में वर्णित संपत्ति में प्रथमपक्ष एवं द्वितीयपक्ष बराबर के हिस्सेदार होकर सदर संपत्ति दोनों के संयुक्त स्वामित्व की हो जायेगी। इस प्रकार उक्त चरण क्रमांक १ में वर्णित संपत्ति में द्वितीयपक्ष का 50 प्रतिशत अर्थात बराबर हिस्से पर हक व अधिकार रहेगा तथा 50 प्रतिशत अर्थात बराबर हिस्से पर प्रथमपक्ष का ही हक व अधिकार रहेगा.</p>
        
        <p><b>3.</b> यह कि उक्त चरण क्रमांक १ में वर्णित संपत्ति प्रथमपक्ष के एकमेव स्वामित्व एवं आधिपत्य की होकर उक्त संपत्ति में द्वितीयपक्ष को अविभाजित आधे अविभाज्य भाग का सहस्वामी बनाने का और यह लेख निष्पादित कर पंजीयन करा देने का पूर्ण अधिकार प्रथमपक्ष को है.</p>
        
        <p><b>4.</b> यह कि प्रथमपक्ष ने उक्त चरण क्रमांक १ में वर्णित सदर संपत्ति में द्वितीयपक्ष को सहस्वामी बनाये जाने से इस सदर संपत्ति के स्वामित्व बावत प्रथमपक्ष के व उनके अन्य वारिसानों के जो स्वत्व, हित अधिकार आदि थे, इस लेख के द्वारा आप द्वितीयपक्ष को प्राप्त हो गये है। अब उक्त संपत्ति का उपयोग, उपभोग संयुक्त स्वामित्व नाते से एवं संयुक्त आधिपत्यधारी की हैसियत से द्वितीयपक्ष कर सकेंगी, जिसमें प्रथमपक्ष को या अन्य वारिसान को कोई उजर या आपत्ति नहीं रहेगी। उक्त संपत्ति का अंतरण संयुक्त रूप से प्रथमपक्ष व द्वितीयपक्ष मिलकर कर सकेंगे.</p>
        
        <p><b>5.</b> यह कि प्रथमपक्ष एतद द्वारा घोषित करते है कि उक्त सम्पत्ति को प्रथमपक्ष ने किसी भी प्रकार से अंतरित व भारित बोझित नहीं किया है और उक्त सम्पत्ति पर किसी भी व्यक्ति या निकाय या वित्तीय संस्था का कोई जमानत, ऋण, दान, बक्षीस, गिरवी आदि प्रकार का कोई भार नहीं है और न ही विक्रय पत्र, दान पत्र, उपहार पत्र आदि के द्वारा अंतरित की हुई है। इस प्रकार से उक्त संपत्ति सर्वभार मुक्त होकर उक्त संपत्ति पर किसी भी व्यक्ति, संस्था आदि का कोई हक अधिकार नहीं होकर प्रथमपक्ष ने इस लेख के माध्यम से भार रहित अवस्था में ही द्वितीयपक्ष को सहस्वामी बनाया है.</p>
        
        <p><b>6.</b> यह कि सदर संपत्ति में अन्य किसी का हक्क, हिस्सा या शर्त नहीं है। इस सम्पत्ति के स्वामित्व आदि या अन्य किसी संबंध में कोई दावा झगड़ा प्रकरण किसी भी प्राधिकारी के समक्ष अथवा किसी भी ज्युडिशियल न्यायालय में लंबित या विचाराधीन नहीं है अथवा सवज्यूडिस नहीं है। आज दिनांक को यह सम्पत्ति हर प्रकार के गिरवी, बिक्री, दान, जमानत, ऋण, आड, मेन्टनेंस, डिकी, आसेध, धर्मादा देव स्थान के चार्ज, बैंकों, वित्तीय संस्थाओं, सोसायटियों के ऋण, भार चार्ज आदि से शुद्ध व मुक्त होकर पवित्र स्थिति में है। इस प्रकार द्वितीयपक्ष को उक्त सम्पत्ति के सम्बन्ध में यह सह स्वामित्व का लेख प्रथमपक्ष के पक्ष तथा हित में निष्पादित करने का पूर्ण व स्वतंत्र अधिकार है। उक्त भवन की तलभूमि नजूल की भूमि नहीं होकर प्रथमपक्ष के एकमात्र स्वामित्व अधिकार की है। दस्तावेज में वर्णित संपत्ति शासकीय भूमि नहीं है और न ही उस पर स्थित है, उक्त सम्पत्ति नजूल की भूमि नहीं है और ना ही उस पर स्थित है एवं सम्पत्ति नगर भूमि सीमा अधिनियम के तहत अविशेष शहरी सीलिंग भूमि भी नहीं है। प्रशनाधीन संपत्ति और निष्पादित दस्तावेज पर कोई न्यायालयीन रोक नहीं है.</p>
        
        <p><b>7.</b> यह कि द्वितीयपक्ष उक्त चरण क्रमांक में वर्णित सदर संपत्ति बाबद संबंधित शासकीय अर्ध-शासकीय व स्वायत्तशासी कार्यालयों में उक्त संपत्ति के रेकार्ड में अपना नाम सहस्वामी की हैसियत से अंकित करवा सकेंगी एवं ऐसी कार्यवाहियों में प्रथमपक्ष के हस्ताक्षर आदि की आवश्यकता एवं जो भी सहयोग आवश्यक होगा तो प्रथमपक्ष इस कार्य में द्वितीयपक्ष को पूर्ण सहयोग प्रदान करेंगे.</p>
        
        <p><b>8.</b> यह कि उक्त संपत्ति के संबंध में देय समस्त शासकीय टैक्सेस, नगर पालिका निगम का संपत्तिकर, म.प्र. विद्युत मण्डल का बिल, अन्य टैक्स व डयूज आदि जो भी है, को आज दिनांक तक प्रथमपक्ष के द्वारा अदा किये गये है तथा आज दिनांक के पश्चात से सहस्वामी की हैसियत से प्रथमपक्ष व द्वितीयपक्ष के द्वारा मिलकर भुगतान किये जावेंगे.</p>
        
        <p><b>9.</b> यह कि सदर सम्पत्ति के सह-स्वामित्व लेख पर प्रकाशित राजपत्र के आलोक में मुद्रांक शुल्क पर यह लेख निष्पादित कर पंजीयत कराया गया है.</p>
        
        <p><b>10.</b> यह कि इस सहस्वामित्व में प्रथमपक्ष द्वारा भारतीय रजिस्ट्रीकरण अधिनियम, 1908 की धारा 22 क का उल्लंघन नहीं किया गया है.</p>
        
        <p><b>11.</b> हम निष्पादकों द्वारा प्रदान की गई जानकारी दस्तावेजों की प्रति हमारे पहचान पत्र, गवाहों के पहचान पत्र सम्पत्ति के फोटो के आधार पर हमारे द्वारा यह प्रारूप तैयार करवाया गया है। दस्तावेज तथा सम्पत्ति बावद सभी विधिक जानकारी हमारे द्वारा प्राप्त कर ली है। दस्तावेज हमारे द्वारा पूर्णतः पढ़कर सुनकर समझकर स्वेच्छा से सर्विस प्रोवाइडर के माध्यम से अपलोड करवाया है। सर्विस प्रोवाइडर द्वारा मात्र मुद्रांक शुल्क एवं पंजीयन शुल्क का भुगतान किया गया है यदि सम्पत्ति / स्टाम्प डयूटी / प्रतिफल / निष्पादको के आईडी / गवाहों के आईडी के सम्बन्ध में भविष्य में किसी भी प्रकार की त्रुटि या कानूनी विवाद उत्पन्न होता है तो उसके बावद हम निष्पादक जिम्मेदार रहेंगे। सर्विस प्रोवाइडर या अभिभाषक की कोई जबाबदारी नहीं रहेगी.</p>
        
        <p style="margin-top: 15px; font-style: italic;">उपरोक्तानुसार यह उक्त संपत्ति के सह-स्वामित्व का यह लेख प्रथमपक्ष ने अपनी स्वेच्छा से बिना किसी दबाव के, अपने मन मस्तिष्क की पूर्ण स्वस्थ अवस्था में साक्षीगणों के समक्ष पूर्णरूपेण पढ़कर, सुनकर व समझकर अपने हस्ताक्षर से हस्ताक्षरित कर निष्पादित कर दिया है और द्वितीयपक्ष ने भी उक्त संपत्ति का सहस्वामी बनना स्वीकार कर अपनी स्वेच्छा से, बिना किसी दबाव के अपने मन मस्तिष्क की पूर्ण स्वस्थ अवस्था में साक्षीगणों के समक्ष पूर्णरूपेण पढ़कर, सुनकर व समझकर अपने हस्ताक्षर से हस्ताक्षरित कर निष्पादित कर दिया है, सो सनद रहे, और आवश्यकता पड़ने पर काम आवे।</p>
        
        <div style="margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 10px;">
          <p>This deed has been prepared, drafted and uploaded as per instructions, information and facts provided by the parties of the deed. Advocate (s), who drafted this deed, and Service Provider, who has only booked the slot (and not involved in any activity of the deed viz. Drafting, typing of the deed, validity of the identity of the parties, site photographs and entire facts, recitals and data of the deed), have not gone through the facts of the deed viz. Identity of the parties, ownership (title) of the owner(s), site photographs (if any), all the facts and recitals of the deed etc. So they (Advocate and Service Provider of this deed) will not take any responsibility whether criminal, civil, or taxation specially laws related to registration Act 1908 section and all provisions regarding any offence, penalty imprisonment under registration Act, rules, manuals, circulars etc, Indian Stamp Act 1899 and its rules, cyber law and all other acts, rules, circulars, and instructions of various officers/Authorities etc regarding above. I.e. Advocate (s) and Service Provider disowned all the legal, factual, criminal and all other responsibilities which are not mentioned in this Disclaimer.</p>
        </div>
      </div>
    `;
  } 
  // 3. DEFAULT / SALE DEED (विक्रय-पत्र) के लिए क्लॉज़
  else {
    mainBodyContent = `
      <div class="section-box">
        <p>
          यह ${deedContextTitle} <b>${sellerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${vendorLabel}”</b> के शब्द से संबोधित किया गया है; तथा <b>${buyerIntroText}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“${purchaserLabel}”</b> के शब्द से संबोधित किया गया है, के मध्य निष्पादित किया जा रहा है।
        </p>
        
        <p>मैं प्रथम पक्ष / ${vendorLabel} आप द्वितीय पक्ष / ${purchaserLabel} के हित में यह <b>${deedActionText}</b> स्वेच्छा से निष्पादित करता/करती हूँ कि : -</p>
        
        <p style="text-align: center; font-weight: bold; margin-top: 20px;">!! संपत्ति का वर्णन एवं विवरण !!</p>
        <p>${propertyDescription}</p>

        <div class="boundaries-box">
          <p style="text-align: center; font-weight: bold; margin-bottom: 12px;">!! सदर संपत्ति की चतुःसीमा निम्नानुसार है !!</p>
          <table style="width: 85%; margin: 0 auto; border-collapse: collapse;">
            <tr><td style="width: 25%; padding: 6px 0; font-weight: bold;">पूर्व में</td><td style="width: 5%; text-align: center;">:</td><td style="width: 70%; padding: 6px 0;">${formData.boundaryEast || "कॉलोनी का रोड"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">पश्चिम में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryWest || "भूखंड क्रमांक 94"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">उत्तर में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundaryNorth || "भूखंड क्रमांक 80"}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">दक्षिण में</td><td style="text-align: center;">:</td><td style="padding: 6px 0;">${formData.boundarySouth || "इसी भूखंड का शेष भाग"}</td></tr>
          </table>
        </div>

        <p><b>1.</b> यह कि सदर संपत्ति का मूर्तिमात आधिपत्य आप क्रेता को मौका पर ले जाकर आज दिनांक को साक्षीगण की उपस्थिति में आप क्रेतापक्ष को मालिक नाते सौंप दिया गया है, तथा आप क्रेतापक्ष ने इस पर अपना आधिपत्य कर लिया है अब आप क्रेतापक्ष इसका उपयोग एवं उपभोग आपके इच्छा अनुसार करना व करते जाना है |</p>
        
        ${installmentsHtml}

        <p><b>2.</b> यह कि सदर सम्पत्ति के लिये विक्रतापक्ष के स्वामित्व बाबद हक, अधिकार स्वत्व, आगमन आदि इस लेख में विक्रेतापक्ष व उनके उत्तराधिकारियों में निहित है वे समस्त हक, अधिकार, स्वत्व, आगम आदि इस लेख के द्वारा आप क्रेतापक्ष में वेष्ठित हो गये हैं, अब आप क्रेतापक्ष सदर सम्पत्ति का स्वेच्छानुसार उपयोग एवं उपभोग व अन्तरण आदि कर सकेंगे। इसमें क्रेतापक्ष या उनके वारिसान की किसी भी प्रकार आपत्ति नहीं रहेगी।</p>
        
        <p><b>3.</b> यह कि सदर सम्पत्ति विक्रेतापक्ष के एकमेव स्वामित्व एवं आधिपत्य का होकर इस विक्रय करने एवं विक्रय प्रतिफल धनराशि प्राप्त कर यह विक्रय लेख क्रेतापक्ष के हित में निष्पादित कर देने का पूर्ण वैधानिक अधिकार प्राप्त है।</p>
        
        <p><b>4.</b> यह कि विक्रेतापक्ष एतद द्वारा घोषित एवं निश्चित करते है कि सदर सम्पत्ति उसके द्वारा इस विक्रय पत्र से आप क्रेतापक्ष के तथा आप क्रेतापक्ष के अलावा अन्य किसी व्यक्ति या संस्था को दान, गिरवी, रहन, जमानत, मेंटेनेंस, इत्यादि रीति से या अन्य किसी भी रीति से अन्तरित या हस्तांतरित नहीं की गयी है, और न ही विक्रेतापक्ष द्वारा ऐसे किसी लिखित या मौखिक वचन या पारिवारिक व्यवस्था पत्र आदि का निष्पादन किया है न ही सदर सम्पत्ति पर शासन का, बैंक का या सहकारी संस्था आदि का कोई ऋण भार नहीं है तात्पर्य यह है कि उक्त भूखण्ड पूर्णतः भार व बोझ से रहित अवस्था में आप क्रेतापक्ष को विक्रय किया गया है।</p>
        
        <p><b>5.</b> यह कि सदर सम्पत्ति के स्वामित्व के सम्बन्ध में किसी भी प्रकार का विवाद या दोष इस विक्रय पत्र पंजीयन दिनांक से पूर्व के लिये तथा भविष्य में भी पाया गया या इस सम्पत्ति पर किसी व्यक्ति या संस्था ने अपना हक या अधिकार सिध्द किया या इस विक्रय व्यवहार में किसी भी प्रकार की आपत्ति की तो उसके निराकरण का सम्पूर्ण एवं सव्यय दायित्व विक्रेतापक्ष का रहेगा इस कारण से आप क्रेतापक्ष को किसी भी प्रकार का खर्च या नुकसान नहीं लगने देंगे तथा आपत्तिकर्ता के हस्ताक्षर एवं सहमति करवाने का दायित्व विक्रेतापक्ष का रहेगा।</p>
        
        <p><b>6.</b> यह कि सदर सम्पत्ति के लिये देय समस्त टेक्सेस, सम्पत्तिकर, मेंटेनेंस, विद्युत व्यय एवं अन्य दायित्व विक्रय पत्र पंजीयन दिनांक तक विक्रेतापक्ष वहन करेंगे तथा विक्रय पत्र पंजीयन दिनांक से क्रेतापक्ष द्वारा क्रय किये जा रहे भूखण्ड के दायित्व क्रेतापक्ष वहन करेंगे.</p>
        
        <p><b>7.</b> यह कि सदर सम्पत्ति के लिये क्रेतापक्ष स्वयं के व्यय से अपना नामांत्रण सम्बन्धित विभागों, नगर निगम राजस्व अभिलेखों व अभिलेखों, संस्था में करवा सकेंगे तथा इस कार्यवाही में विक्रेतापक्ष अपेक्षित सहयोग प्रदान करने हस्ताक्षर इत्यादि करने के लिये वचनबद्ध तथा बाध्य रहेंगे.</p>
        
        <p><b>8.</b> यह कि विक्रेतापक्ष / प्रथमपक्ष ने अपने मालिक की सम्बन्धित समस्त असल दस्तावेज आज दिनांक को क्रेतापक्ष के सुपुर्द कर दिये हैं, अब प्रथमपक्ष / विक्रेता के पास उक्त सम्पत्ति के सम्बन्ध में कोई भी असल दस्तावेज उपलब्ध नहीं है.</p>
        
        <p><b>9.</b> यह कि, विक्रय पत्र में विक्रित सम्पत्ति के विक्रय द्वारा पंजीयन की धारा २२-क व अन्य किसी भी प्रचलित विधि का उल्लंघन नहीं किया गया है</p>
        
        <p><b>10.</b> यह कि, इस लेख के पक्षकारों ने इसे भली-भांति पढ़कर एवं समझकर इस पर अपने-अपने हस्ताक्षर किये हैं पक्षकारों द्वारा दी गयी जानकारी अनुसार सर्विस प्रोवाइडर ने सम्पदा सॉफ्टवेयर में सभी जानकारियां अपलोड की हैं। यदि इसमें किसी भी असत्य, भ्रामक, झूठा कथन पाया गया तो उसकी समस्त जबाबदारी पक्षकारों की होगी। सर्विस प्रोवाइडर द्वारा मौके का परीक्षण नहीं किया गया है और व्यक्तियों की पहचान के सम्बन्ध में भी सम्पूर्ण जबाबदारी पक्षकारों स्वयं की रहेगी। सर्विस प्रोवाइडर को किसी भी रूप में उपरोक्त सभी बातों के लिए उत्तरदायी नहीं ठहराया जायेगा। उसके द्वारा सिर्फ पंजीयन की कार्यवाही को ई-स्टाम्पिंग कर पूर्ण करवाया गया है तथा सर्विस प्रोवाइडर द्वारा मुझसे शासन द्वारा तय राशि से अधिक राशि प्राप्त नहीं की गयी है इस प्रकार लेख के पक्षकारों व्यवहारों तथा व क्रय में उल्लेखित सम्पत्ति व लेख में वर्णित तथा लेख के साथ प्रस्तुत अपलोड किये गये दस्तावेजों से भी प्रारूपणकर्ता एवं सेवा प्रदाता का प्रत्यक्ष या अप्रत्यक्ष रूप से किसी भी प्रकार का कोई लेना देना, सरोकार व सम्बन्ध नहीं है तथा उनके बाबद भी प्रारूपणकर्ता एवं सेवाप्रदाता की किसी भी प्रकार की कोई जवाबदारी नहीं रहेगी।</p>
        
        <p style="margin-top: 15px; font-style: italic;">उपरोक्तानुसार यह विक्रयपत्र मुझ निष्पादक ने पढ़कर, सुनकर व समझकर स्वेच्छा से शरीर व मन की पूर्ण स्वस्थ हालत में प्रतिफल की सम्पूर्ण धनराशि प्राप्त करने के पश्चात साक्षीगणों के समक्ष अपने हस्ताक्षर से आप क्रेता के हित में निष्पादित कर दिया, सो सही ताकि वक्त जरूरत काम आवे।</p>
      </div>
    `;
  }
  
  // ==========================================
  // GIFT DEED TEMPLATE (दान-पत्र विलेख) - पूर्णतः डाइनैमिक
  // ==========================================
  if (isGift) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; padding: 20px; font-size: 15px;">
        
        <h2 style="text-align: center; text-decoration: underline; margin-bottom: 5px;">दान-पत्र (GIFT DEED)</h2>
        <p style="text-align: center; font-weight: bold; margin-top: 0;">(बिना प्रतिफल के दिया गया)</p>
        <hr style="border: 0.5px solid #000;" />

        <h3 style="text-align: center; margin-bottom: 5px;">दानपत्र</h3>
        <p style="text-align: justify;">
          <b>बाबद सम्पति पटवारी हल्का नं. ${formData.patwariHalkaNo || "........"}, सरल नं. ${formData.saralNo || "........"}, स्थित ${formData.propertyType || "हाउस"} सर्वे क्रमांक ${formData.surveyNo || "........"} पैकी, रकबा ${formData.totalAreaHectare || "........"} हैक्टयर में से ${formData.plotArea || "........"} ${formData.areaUnit || "वर्गफीट"} (${formData.metricArea || "........"} ${formData.metricUnit || "वर्गमीटर"}), ग्राम ${formData.village || "........"} तहसील ${formData.tehsil || "........"} जिला ${formData.district || "........"} (${formData.stateName || "MADHYA PRADESH"}) में स्थित भवन / संपत्ति का दानपत्र |</b>
        </p>

        <p style="font-size: 14px; background: #f9f9f9; padding: 10px; border-left: 3px solid #666;">
          भारतीय स्टाम्प अधिनियम 1899 (म.प्र. में प्रयोज्य) अनुसूची 1-क लिखतों पर स्टाम्प शुल्क धारा अनुच्छेद 3 (देखिये) का स्पष्टीकरण इसमे परिवार हेतु प्रयोजन के लिये शब्द <b>“कुठुंम्ब से माता, पिता, पत्नी, पुत्र, पुत्री, भाई, बहन, पोत्री, नातिन एवं पोत्र, नाती अभिप्रेत है”</b> |
        </p>
        <hr style="border: 0.5px solid #000;" />

        <p><b>दानदाता एवं दानगृहिता का संबंध:</b> ${formData.relationBetweenParties || "पिता – पुत्र"} हैं।</p>

        <p style="text-align: right; font-weight: bold;">
          स्टाम्प ड्यूटि हेतु दान पत्र का मूल्य रूपये ${formData.stampValue || "--------"}/- (अक्षरी रूपये ${formData.stampValueWords || "-----------"} रुपए मात्र)
        </p>
        <hr style="border: 0.5px solid #000;" />

        <!-- दानदाता (Donor) विवरण -->
        <p><b>दान पत्र लिख देने वाला (दानदाता):-</b></p>
        <p>
          <b>${formData.sellers?.[0]?.name || "........"}</b> पिता ${formData.sellers?.[0]?.fatherName || "........"},<br>
          आयु : ${formData.sellers?.[0]?.age || "........"} वर्ष, व्यवसाय : ${formData.sellers?.[0]?.occupation || "........"}, जाति : ${formData.sellers?.[0]?.caste || "........"}<br>
          आधार कार्ड क्रमांक : [Aadhaar Redacted]<br>
          निवासी : ${formData.sellers?.[0]?.address || "........"}
        </p>
        <p style="font-size: 13px; color: #444;">(जिन्हे आगे दानदाता के नाम से संबोधित किया गया है, इसमे इनके वारीसान हितग्राही, वैध प्रतिनिधी तथा असाईनीज़ एवं निष्पादक का भी समावेश है |)</p>
        <hr style="border: 0.5px solid #000;" />

        <!-- दानगृहिता (Donee) विवरण -->
        <p><b>दान पत्र जिनके हित मे लिखा जा रहा है (दानगृहिता):-</b></p>
        <p>
          <b>${formData.buyers?.[0]?.name || "........"}</b> पति/पिता ${formData.buyers?.[0]?.fatherName || "........"},<br>
          उम्र : ${formData.buyers?.[0]?.age || "........"} वर्ष, व्यवसाय : ${formData.buyers?.[0]?.occupation || "........"}, जाति : ${formData.buyers?.[0]?.caste || "........"}<br>
          आधारकार्ड क्रमांक : [Aadhaar Redacted]<br>
          निवासी : ${formData.buyers?.[0]?.address || "........"}
        </p>
        <p style="font-size: 13px; color: #444;">(जिन्हे आगे दानगृहिता के नाम से सम्बोधित किया गया है इसमे वारीसान हितग्राही वैध प्रतिनिधि तथा असाईनीज़ एवं निष्पादक का भी समावेश है |)</p>
        <hr style="border: 0.5px solid #000;" />

        <!-- संपत्ति का विवरण -->
        <p><b>दान की जाने वाली संपत्ति का विवरण :-</b></p>
        <p style="text-align: justify;">
          ${formData.propertyAddress || `भूखंड क्रमांक ${formData.plotNumber || "........"} जो कि ${formData.colonyName || "........"}, ग्राम ${formData.village || "........"} तहसील ${formData.tehsil || "........"}, जिला ${formData.district || "........"}, (${formData.stateName || "म.प्र."}) का दान किया जा रहा है | तथा जिसकी साईज एवं चतुर्सीमा निम्नानुसार है :-`}
        </p>

        <p><b>दान की जा रही संपत्ति का क्षेत्रफल:-</b><br>
        कुल क्षेत्रफल: <b>${formData.plotArea || "........"} ${formData.areaUnit || "वर्गफीट"} (${formData.metricArea || "........"} ${formData.metricUnit || "वर्गमीटर"})</b></p>

        <!-- चतुःसीमा -->
        <p><b>चतुर्सीमा :-</b></p>
        <table style="width: 100%; margin-bottom: 10px;">
          <tr><td style="width: 15%;"><b>पूर्व में</b></td><td>: ${formData.boundaryEast || formData.eastBoundary || "........"}</td></tr>
          <tr><td><b>पश्चिम में</b></td><td>: ${formData.boundaryWest || formData.westBoundary || "........"}</td></tr>
          <tr><td><b>उत्तर में</b></td><td>: ${formData.boundaryNorth || formData.northBoundary || "........"}</td></tr>
          <tr><td><b>दक्षिण में</b></td><td>: ${formData.boundarySouth || formData.southBoundary || "........"}</td></tr>
        </table>
        <hr style="border: 0.5px solid #000;" />

        <p style="text-align: justify;">
          भूमि के मे म.प्र. भू.रा. संहिता 1959 की धारा 165 एवं सीलिंग एक्ट की बाधा आती नही है । उक्त संपति के हस्तांतरण में किसी न्यायालय या शासकीय संस्था की कोई रोक नहीं है| उक्त भूमि अन्दर की ओर स्थित है | उक्त भूमि को आगे संपत्ति शब्द से सम्बोधित किया जावेगा | यह कि आज अंतरित की जा रही प्रश्नाधीन संपत्ति को मेरे किसी प्रतिनिधी या समूनूदेशिती या उसके अभिकर्ता एजेंट के द्वारा आज दिनांक तक किसी अन्य व्यक्ति के पक्ष मे रजिस्ट्रीकृत दस्तावेज़ द्वारा पूर्व मे ही हस्तांतरित या स्थाई रूप से अन्य संक्रांत नहीं करा गया है अर्थात इस अंतरण से पंजीयन अधिनियम की धारा 22 (क) का उल्लंघन नही होता है |
        </p>
        <hr style="border: 0.5px solid #000;" />

        <!-- मुख्य शर्ते (Clauses) - डाइनैमिक -->
        <p style="text-align: justify;">
          <b>1.</b> यह कि, उक्त वर्णित संपत्ति ${formData.surveyNo ? `भूमि सर्वे क्रमांक ${formData.surveyNo}, रकबा ${formData.totalAreaHectare || "........"} हैक्टयर जिसका भू अधिकार पुस्तिका भाग-एक, एवं भाग-दो CLR No. ${formData.clrNo || "........"} एवं यूनिक आईडी ${formData.uniqueId || "........"} है` : `${formData.propertyAddress || `भूखंड क्रमांक ${formData.plotNumber || "........"} जो कि ${formData.colonyName || "........"}, ग्राम ${formData.village || "........"} तहसील ${formData.tehsil || "........"}, जिला ${formData.district || "........"}, (${formData.stateName || "म.प्र."})`}`} | जो शासकीय / रिकॉर्ड में ${formData.governmentOwners || formData.sellers?.[0]?.name || "........"} के नाम पर दर्ज है |
        </p>

        <p style="text-align: justify;">
          <b>2.</b> यह कि, उक्त वर्णित संपत्ति ${formData.surveyNo ? `भूमि सर्वे क्रमांक ${formData.surveyNo} पैकी, रकबा ${formData.totalAreaHectare || "........"} हैक्टयर` : `${formData.propertyAddress || `भूखंड क्रमांक ${formData.plotNumber || "........"} जो कि ${formData.colonyName || "........"}, ग्राम ${formData.village || "........"} तहसील ${formData.tehsil || "........"}, जिला ${formData.district || "........"}`}`} दानदाता ${formData.sellers?.[0]?.name || "........"} द्वारा अपने हक्क हिस्से की संपत्ति में से ${formData.plotArea || "........"} ${formData.areaUnit || "वर्गफीट"} (${formData.metricArea || "........"} ${formData.metricUnit || "वर्गमीटर"}), का दान किया जा रहा है | जिसमें अन्य किसी को कोई उजर आपत्ति नहीं है |
        </p>

        <p style="text-align: justify;">
          <b>3.</b> यह कि दानदाता एवं दानगृहिता आपस में <b>${formData.relationBetweenParties || "पिता – पुत्र"}</b> हैं तथा दानदाता का दानगृहिता पर काफी स्नेह है इस कारण दानदाता स्वेच्छा से उक्त संपत्ति जिसका विवरण ऊपर बताये अनुसार है, बगैर किसी आपत्ति के दानगृहिता को दान कर दिया है |
        </p>

        <p style="text-align: justify;">
          <b>4.</b> यह कि दानदाता द्वारा दी जा रही दान की संपत्ति को प्राप्त करने के लिए दानगृहिता की स्वेच्छिक स्वतंत्र सहमति है जो दान का आवश्यक तत्व है दानगृहिता उक्त संपत्ति का उपयोग जिस प्रकार चाहे कर सकेंगे |
        </p>

        <p style="text-align: justify;">
          <b>5.</b> यह कि दानगृहिता को दान की गयी संपत्ति पर आज तारीख तक जो मालकी स्वत्व दानदाता को प्राप्त थे वह कुल स्वत्व आज से आप दानगृहिता को मालिक नाते प्राप्त हो गये है अब आपने इस संपत्ति का उपयोग व उपभोग हमेशा के लिये मालिक लेते जाना इसमे दानदाता एवं उनके किसी वारसान की ओर से किसी प्रकार का उजर या आपत्ति नही रहेगी |
        </p>

        <p style="text-align: justify;">
          <b>6.</b> यह कि दानगृहिता को दान की गयी संपत्ति पर किसी दूसरे का भार बोझ या स्वत्व नही है तथा किसी बैंक सोसायटी का बकाया नही है | अगर किसी ने इस दान की गयी संपत्ति पर भार बोझ स्वत्व कायम किया तो उसको निपटने की कुल जवाबदारी दानदाता की रहेगी आपको किसी खर्च मे नही पड़ने देंगे |
        </p>

        <p style="text-align: justify;">
          <b>7.</b> यह कि अब आप दानगृहिता इस दान की गयी संपत्ति पर से दानदाता का नाम ग्राम पंचायत/तहसील कार्यालय व नजुल एवं अन्य शासकीय कागजात मे से कम करवाकर आपका नाम मालिक नाते दर्ज करवा लेना इसमे आपको दानदाता की जरूरत होगी तो समय समय पर आपकी मदद करेंगे इसमे दानदाता एवं उनके किसी वारसान का उजर हरकत रहेगा नही |
        </p>

        <p style="text-align: justify;">
          <b>8.</b> यह कि, सर्विस प्रोवाईडर के द्वारा पक्षकरगण से पंजीयन की जाने वाली संपत्ति के दस्तावेज एवं स्थति की जानकारी प्राप्त की गई है सर्विस प्रोवाईडर को पक्षकरगण एवं गवाहों से किसी प्रकार का परिचित आदि नहीं होकर उनसे प्राप्ती मात्र जानकारी के आधार पर विलेख के माध्यम से तैयार करवाकर पंजीयन करवाया गया है इसमें यदि किसी प्रकार के तथ्य पक्षकारो के द्वारा छिपाये गये है तो सम्पूर्ण उतरदायित्व पक्षकारो का ही है |
        </p>

        <p style="text-align: justify; margin-top: 20px;">
          <b>अत:</b> यह दान पत्र दानदाता के द्वारा अपनी राजी खुशी अकल होशियारी से बिना किसी दबाव के संपादित कर दिया सो सनद रहे व वक्त जरूरत काम आवे |
        </p>
        <hr style="border: 0.5px solid #000;" />

        <p style="font-size: 13px; color: #555; text-align: justify;">
          मेरे कार्यालय में उभय पक्ष द्वारा दी गई जानकारी एवं निर्देशानुसार इस विलेख का प्रारूप तैयार किया गया है | पक्षकारो, गवाहों की पहचान, संपत्ति तथा संपत्ति के छायाचित्र से मेरा कोई सम्बन्ध नहीं है|
        </p>

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
        .study-notice-footer { background: #fef3c7; border: 1px dashed #d97706; color: #92400e; padding: 12px; font-size: 12px; text-align: center; margin-top: 40px; font-weight: bold; border-radius: 4px; }
        .header-title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
        .section-box { margin-bottom: 15px; text-align: justify; }
        .boundaries-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-top: 15px; margin-bottom: 15px; }
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

        <div class="header-title">
          !! श्री !! <br/> ${headerTitle}
        </div>

        <div class="section-box">
          ${sellersHtml}
          <div style="margin: 25px 0;"></div>
          ${buyersHtml}
        </div>

        <hr style="border: 0.5px solid #e2e8f0; margin: 20px 0;"/>

        ${mainBodyContent}

        <div class="section-box" style="margin-top: 30px;">
          <p><b>स्थान (Place):</b> ${formData.cityName || "इंदौर"} (${state})</p>
          <p><b>दिनांक (Date):</b> ........................................</p>
        </div>

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

        <div class="study-notice-footer">
          ⚠️ यह दस्तावेज़ केवल पठन, अध्ययन एवं सॉफ्टवेयर परीक्षण हेतु प्रारूप (Draft) है। अंतिम पंजीयन से पूर्व उप-रजिस्ट्रार कार्यालय की विधिक प्रक्रियाओं का पालन करना अनिवार्य है।
        </div>

        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF 🖨️</button>
        </div>

      </div>
    </body>
    </html>
  `;
}