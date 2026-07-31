"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface Party {
  name: string;
  details: string;
}

interface FloorDetail {
  floorName: string;
  builtUpArea: string;
}

interface DeedFormData {
  propertyType: string;
  stateName: string;
  cityName: string;
  deedType: string;
  outputLanguage: string;
  sellers: Party[];
  buyers: Party[];
  propertyAddress: string;
  floorsList: FloorDetail[];
  parentDocument: string;
  plotArea: string;
  considerationAmount: string;
  boundaryEast: string;
  boundaryWest: string;
  boundaryNorth: string;
  boundarySouth: string;
}

const INITIAL_FORM_STATE: DeedFormData = {
  propertyType: "HOUSE",
  stateName: "MADHYA PRADESH",
  cityName: "INDORE",
  deedType: "SALE DEED",
  outputLanguage: "HINDI",
  sellers: [{ name: "", details: "" }],
  buyers: [{ name: "", details: "" }],
  propertyAddress: "",
  floorsList: [{ floorName: "GROUND FLOOR (तल मंजिल)", builtUpArea: "" }],
  parentDocument: "",
  plotArea: "",
  considerationAmount: "",
  boundaryEast: "",
  boundaryWest: "",
  boundaryNorth: "",
  boundarySouth: "",
};

const INDIAN_STATES = [
  "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", 
  "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", 
  "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", 
  "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", 
  "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", 
  "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "DELHI", "JAMMU AND KASHMIR"
];

export default function DeedDraftingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<DeedFormData>(INITIAL_FORM_STATE);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleBack = () => {
    router.push("/dashboard");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cityName" ? value.toUpperCase() : value,
    }));
  };

  const handlePartyChange = (
    index: number,
    field: "name" | "details",
    value: string,
    partyType: "sellers" | "buyers"
  ) => {
    const list = formData[partyType] || [];
    const updatedParties = [...list];
    updatedParties[index] = { ...updatedParties[index], [field]: value };
    setFormData((prev) => ({ ...prev, [partyType]: updatedParties }));
  };

  const addParty = (partyType: "sellers" | "buyers") => {
    const list = formData[partyType] || [];
    setFormData((prev) => ({
      ...prev,
      [partyType]: [...list, { name: "", details: "" }],
    }));
  };

  const removeParty = (index: number, partyType: "sellers" | "buyers") => {
    const list = formData[partyType] || [];
    if (list.length === 1) return;
    const updatedParties = list.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, [partyType]: updatedParties }));
  };

  const handleFloorChange = (index: number, field: "floorName" | "builtUpArea", value: string) => {
    const updatedFloors = [...formData.floorsList];
    updatedFloors[index][field] = value;
    setFormData((prev) => ({ ...prev, floorsList: updatedFloors }));
  };

  const addFloorItem = () => {
    setFormData((prev) => ({
      ...prev,
      floorsList: [...prev.floorsList, { floorName: "FIRST FLOOR (प्रथम मंजिल)", builtUpArea: "" }]
    }));
  };

  const removeFloorItem = (index: number) => {
    if (formData.floorsList.length === 1) return;
    const updatedFloors = formData.floorsList.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, floorsList: updatedFloors }));
  };

  const validateForm = (): boolean => {
    const sellersList = formData.sellers || [];
    const buyersList = formData.buyers || [];

    const hasValidSeller = sellersList.some((s) => s?.name?.trim() !== "");
    const hasValidBuyer = buyersList.some((b) => b?.name?.trim() !== "");

    if (!hasValidSeller || !hasValidBuyer) {
      alert("कृपया कम से कम एक विक्रेता (Seller) और एक क्रेता (Buyer) का नाम दर्ज करें।");
      return false;
    }

    if (!formData.propertyAddress?.trim()) {
      alert("कृपया प्रॉपर्टी का पूरा पता (Address) दर्ज करें।");
      return false;
    }

    return true;
  };

  const handleGenerateAndOpenWindow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsGenerating(true);

    setTimeout(() => {
      let mockDraft = "";
      const {
        outputLanguage,
        deedType,
        sellers = [],
        buyers = [],
        propertyAddress,
        plotArea,
        floorsList,
        propertyType,
        cityName,
        stateName,
        boundaryEast,
        boundaryWest,
        boundaryNorth,
        boundarySouth,
        considerationAmount,
        parentDocument,
      } = formData;

      const sellersFormatted = sellers
        .map((s) => `श्री ${s.name || ""}<br/>${s.details || ""}`)
        .join("<br/><br/>");

      const buyersFormatted = buyers
        .map((b) => `श्री ${b.name || ""}<br/>${b.details || ""}`)
        .join("<br/><br/>");

      const floorsFormattedHtml = floorsList
        .map((f, i) => `<b>${i + 1}. मंजिल/हिस्सा:</b> ${f.floorName} - <b>निर्मित क्षेत्र:</b> ${f.builtUpArea || "______"} वर्गफीट`)
        .join("<br/>");

      if (outputLanguage === "HINDI") {
  mockDraft = `
  <div style="font-family: Arial, sans-serif; line-height: 1.8; padding: 40px; color: #111; max-width: 900px; margin: auto; text-align: justify;">
    <h2 style="text-align: center;">!! श्री !!</h2>
    <h3 style="text-align: center;">|| ${deedType} (${propertyType}) ||</h3>
    <hr/><br/>
    
    <p><b>विक्रेता पक्ष (प्रथम पक्ष):</b><br/>${sellersFormatted}</p>
    <p style="text-align: right;"><b>------------ प्रथम पक्ष / विक्रेता पक्ष</b></p>
    
    <p><b>क्रेता पक्ष (द्वितीय पक्ष):</b><br/>${buyersFormatted}</p>
    <p style="text-align: right;"><b>----------------- द्वितीय पक्ष / क्रेतापक्ष</b></p>

    <p>यह विक्रय निष्पादित कर देने वाले <b>${sellers[0]?.name || "______"} ${sellers[0]?.details || ""}</b> जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से “विक्रेतापक्ष” के शब्द से संबोधित किया गया है, इस संबोधन में विक्रेतापक्ष के समस्त हितग्राही, असाईनीज आदि का समावेश है; निष्पादक, वैध प्रतिनिधि तथा यह विक्रयपत्र अपने पक्ष एवं हित में लिखवा लेने वाले—<b>${buyers[0]?.name || "______"} ${buyers[0]?.details || ""}</b>, जो इस विक्रयपत्र में आगे सुविधा एवं संक्षिप्तता की दृष्टि से “क्रेतापक्ष” के शब्द से संबोधित किए गए हैं (इस संबोधन में क्रेतापक्ष स्वयं, इनके वारिसान, हितग्राही, असाईनीज, वैध प्रतिनिधि एवं निष्पादिती आदि का समावेश है), के पक्ष में मैं प्रथम पक्ष / विक्रेतापक्ष, आप द्वितीय पक्ष / क्रेतापक्ष के हित में यह विक्रय पत्र निष्पादित कर देती हूँ कि:</p>
    
    <p><b>1. संपत्ति का विवरण:</b><br/>
    यह कि, प्रथम पक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह ${propertyType} जो कि ${propertyAddress}, ${cityName} (${stateName}) पर स्थित है। जिसका कुल भूखंड क्षेत्रफल ${plotArea || "______"} वर्गफीट है।<br/>
    ${propertyType !== "PLOT" ? `<br/><b>विस्तृत मंजिलवार विवरण:</b><br/>${floorsFormattedHtml}<br/>` : ""}
    सदर संपत्ति वर्तमान में उपयोग में है। मूल दस्तावेज विवरण: ${parentDocument || "पर पंजीकृत है। सदर भूखंड वर्तमान में रिक्त अवस्था में होकर उस पर किसी भी प्रकार का कोई निर्माण कार्य नहीं किया गया है। सदर संपत्ति का उपयोग एवं उपभोग विक्रेता पक्ष द्वारा मालिक एवं स्वामी के रूप में किया जा रहा है। इस प्रकार उक्त संपत्ति को विक्रय (बेचने) करने का पूर्ण एवं वैधानिक अधिकार विक्रेता पक्ष को प्राप्त है।"}</p>

    <p><b>2. चतुःसीमा (Four Boundaries):</b><br/>
    - पूर्व में : ${boundaryEast}<br/>
    - पश्चिम में : ${boundaryWest}<br/>
    - उत्तर में : ${boundaryNorth}<br/>
    - दक्षिण में : ${boundarySouth}</p>

    <p><b>3. प्रतिफल राशि एवं भुगतान विवरण (Consideration Amount):</b><br/>
    यह कि उपरोक्त वर्णित चतुःसीमा के बीच का दर्शाया गया भूखंड विक्रेतापक्ष ने क्रेतापक्ष को कुल प्रतिफल मूल्य ₹ ${considerationAmount || "______"}/- में विक्रय किया होकर, विक्रय प्रतिफल की संपूर्ण धन-राशि क्रेतापक्ष से विक्रेतापक्ष ने निम्नानुसार प्राप्त कर ली है। विक्रेतापक्ष ने उपरोक्तानुसार संपूर्ण धनराशि प्राप्त कर ली है, जिसकी प्राप्ति की अभिस्वीकृति विक्रेतापक्ष इस लेख पर अपने हस्ताक्षर प्रदान करते हैं। अब इस विक्रय लेख पेटे कोई धनराशि मुझे (विक्रेतापक्ष को) लेनी अवशेष नहीं है। उपरोक्त वर्णित चतुःसीमा से संबंधित भूखंड को इस लेख में आगे सुविधा एवं संक्षिप्तता की दृष्टि से “सदर संपत्ति” शब्द से संबोधित किया जा रहा है।</p>
    
    <p><b>4. वैधानिक घोषणा एवं शर्तें:</b><br/><br/>
    
    <b>1.</b> यह कि सदर संपत्ति का मूर्तिमात आधिपत्य आप क्रेता को मौका पर ले जाकर आज दिनांक को साक्षीगण की उपस्थिति में आप क्रेतापक्ष को मालिक नाते सौंप दिया गया है, तथा आप क्रेतापक्ष ने इस पर अपना आधिपत्य कर लिया है। अब आप क्रेतापक्ष इसका उपयोग एवं उपभोग अपनी इच्छाअनुसार कर सकेंगे।<br/><br/>

    <b>2.</b> यह कि सदर संपत्ति के लिये विक्रेतापक्ष के स्वामित्व बाबद हक, अधिकार, स्वत्व, आगम आदि इस लेख में विक्रेतापक्ष व उनके उत्तराधिकारियों में निहित थे; वे समस्त हक, अधिकार, स्वत्व, आगम आदि इस लेख के द्वारा आप क्रेतापक्ष में वेष्ठित हो गये हैं। अब आप क्रेतापक्ष सदर संपत्ति का स्वेच्छानुसार उपयोग, उपभोग व अन्तरण आदि कर सकेंगे। इसमें क्रेतापक्ष या उनके वारिसान की किसी भी प्रकार की आपत्ति नहीं रहेगी।<br/><br/>

    <b>3.</b> यह कि सदर संपत्ति विक्रेतापक्ष के एकमेव स्वामित्व एवं आधिपत्य की होकर, इसे विक्रय करने एवं विक्रय प्रतिफल धनराशि प्राप्त कर यह विक्रय लेख क्रेतापक्ष के हित में निष्पादित कर देने का पूर्ण वैधानिक अधिकार प्राप्त है।<br/><br/>

    <b>4.</b> यह कि विक्रेतापक्ष एतद्द्वारा घोषित एवं निश्चित करते हैं कि सदर संपत्ति उनके द्वारा इस विक्रय पत्र से आप क्रेतापक्ष के अलावा अन्य किसी व्यक्ति या संस्था को दान, गिरवी, रहन, जमानत, मेंटेनेंस इत्यादि रीति से या अन्य किसी भी रीति से अन्तरित या हस्तांतरित नहीं की गयी है, और न ही विक्रेतापक्ष द्वारा ऐसे किसी लिखित या मौखिक वचन या पारिवारिक व्यवस्था पत्र आदि का निष्पादन किया गया है। न ही सदर संपत्ति पर शासन का, बैंक का या सहकारी संस्था आदि का कोई ऋण भार है। तात्पर्य यह है कि उक्त भूखंड पूर्णतः भार व बोझ से रहित अवस्था में आप क्रेतापक्ष को विक्रय किया गया है।<br/><br/>

    <b>5.</b> यह कि सदर संपत्ति के स्वामित्व के सम्बन्ध में किसी भी प्रकार का विवाद या दोष इस विक्रय पत्र पंजीयन दिनांक से पूर्व के लिये तथा भविष्य में भी पाया गया या इस संपत्ति पर किसी व्यक्ति या संस्था ने अपना हक या अधिकार सिद्ध किया या इस विक्रय व्यवहार में किसी भी प्रकार की आपत्ति की, तो उसके निराकरण का सम्पूर्ण एवं सव्यय दायित्व विक्रेतापक्ष का रहेगा। इस कारण से आप क्रेतापक्ष को किसी भी प्रकार का खर्च या नुकसान नहीं लगने देंगे तथा आपत्तिकर्ता के हस्ताक्षर एवं सहमति करवाने का दायित्व विक्रेतापक्ष का रहेगा।<br/><br/>

    <b>6.</b> यह कि सदर संपत्ति के लिये देय समस्त टेक्सेस, संपत्तिकर, मेंटेनेंस, विद्युत व्यय एवं अन्य दायित्व विक्रय पत्र पंजीयन दिनांक तक विक्रेतापक्ष वहन करेंगे तथा विक्रय पत्र पंजीयन दिनांक से क्रेतापक्ष द्वारा क्रय किए जा रहे भूखंड के दायित्व क्रेतापक्ष वहन करेंगे।<br/><br/>

    <b>7.</b> यह कि सदर संपत्ति के लिये क्रेतापक्ष स्वयं के व्यय से अपना नामांतरण सम्बन्धित विभागों, नगर निगम राजस्व अभिलेखों व संस्था में करवा सकेंगे तथा इस कार्यवाही में विक्रेतापक्ष अपेक्षित सहयोग प्रदान करने व हस्ताक्षर इत्यादि करने के लिये वचनबद्ध तथा बाध्य रहेंगे।<br/><br/>

    <b>8.</b> यह कि विक्रेतापक्ष / प्रथमपक्ष ने अपनी मालिकी सम्बन्धित समस्त असल दस्तावेज आज दिनांक को क्रेतापक्ष के सुपुर्द कर दिये हैं। अब प्रथमपक्ष / विक्रेता के पास उक्त सम्पत्ति के सम्बन्ध में कोई भी असल दस्तावेज उपलब्ध नहीं है।<br/><br/>

    <b>9.</b> यह कि विक्रय पत्र में विक्रित सम्पत्ति के विक्रय द्वारा पंजीयन की धारा २२-क व अन्य किसी भी प्रचलित विधि का उल्लंघन नहीं किया गया है।<br/><br/>

    <b>10.</b> यह कि इस लेख के पक्षकारों ने इसे भली-भांति पढ़कर एवं समझकर इस पर अपने-अपने हस्ताक्षर किये हैं। पक्षकारों द्वारा दी गयी जानकारी अनुसार सर्विस प्रोवाइडर ने सम्पदा सॉफ्टवेयर में सभी जानकारियां अपलोड की हैं। यदि इसमें कोई भी असत्य, भ्रामक, झूठा कथन पाया गया तो उसकी समस्त जबाबदारी पक्षकारों की होगी। सर्विस प्रोवाइडर द्वारा मौके का परीक्षण नहीं किया गया है और व्यक्तियों की पहचान के सम्बन्ध में भी सम्पूर्ण जबाबदारी पक्षकारों स्वयं की रहेगी। सर्विस प्रोवाइडर को किसी भी रूप में उपरोक्त सभी बातों के लिए उत्तरदायी नहीं ठहराया जायेगा। उसके द्वारा सिर्फ पंजीयन की कार्यवाही को ई-स्टाम्पिंग कर पूर्ण करवाया गया है तथा सर्विस प्रोवाइडर द्वारा शासन द्वारा तय राशि से अधिक राशि प्राप्त नहीं की गई है। इस प्रकार लेख के पक्षकारों के व्यवहारों तथा क्रय में उल्लेखित संपत्ति व लेख में वर्णित तथा लेख के साथ प्रस्तुत अपलोड किए गए दस्तावेजों से भी प्रारूपणकर्ता एवं सेवा प्रदाता का प्रत्यक्ष या अप्रत्यक्ष रूप से किसी भी प्रकार का कोई लेना-देना, सरोकार व सम्बन्ध नहीं है तथा उनके बाबद भी प्रारूपणकर्ता एवं सेवाप्रदाता की किसी भी प्रकार की कोई जवाबदारी नहीं रहेगी।
    </p>

              <div style="background: #fff3cd; padding: 15px; border: 1px solid #ffeeba; border-radius: 5px; font-size: 13px;">
            <b>⚠️ कानूनी अस्वीकरण (Disclaimer & Safety Clause):</b><br/>
            यह ड्राफ्ट केवल पक्षकारों की दी गई जानकारी और शैक्षणिक/पढ़ने के उद्देश्य से तैयार किया गया है। सर्विस प्रोवाइडर/प्रारूपणकर्ता की इसमें कोई विधिक या वित्तीय जिम्मेदारी नहीं होगी। मौके का भौतिक सत्यापन पक्षकारों ने स्वयं कर लिया है।
          </div>

          <br/><br/>
          <table style="width: 100%; margin-top: 30px;">
            <tr>
              <td style="text-align: left; width: 50%;">
                <p><b>दिनांक:</b> ........................</p>
                <p><b>स्थान:</b> ${cityName}</p>
              </td>
              <td style="text-align: right; width: 50%;">
                <p><b>हस्ताक्षर (विक्रेता / प्रथम पक्ष)</b></p>
                <br/><br/>
                <p>......................................................</p>
              </td>
            </tr>
            <tr>
              <td style="text-align: left; width: 50%; padding-top: 30px;">
                <p><b>साक्षीगण (Witnesses):</b><br/>1. ......................................<br/>2. ......................................</p>
              </td>
              <td style="text-align: right; width: 50%; padding-top: 30px;">
                <p><b>हस्ताक्षर (क्रेता / द्वितीय पक्ष)</b></p>
                <br/><br/>
                <p>......................................................</p>
              </td>
            </tr>
          </table>

          <br/><hr/>
          <p style="color: gray; font-size: 11px; text-align: center;">[यह एक कम्प्यूटर जनरेटेड सुरक्षित ड्राफ्ट रिपोर्ट है]</p>
        </div>`;
      } else {
        mockDraft = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; padding: 30px; color: #111; max-width: 800px; margin: auto;">
          <h2 style="text-align: center;">PROFESSIONAL ${deedType} (${propertyType}) FORMAT</h2>
          <hr/><br/>
          <h3>VENDOR / FIRST PARTY:</h3>
          <p>${sellers.map((s) => `${s.name || ""}, ${s.details || ""}`).join("<br/>")}</p>
          
          <h3>PURCHASER / SECOND PARTY:</h3>
          <p>${buyers.map((b) => `${b.name || ""}, ${b.details || ""}`).join("<br/>")}</p>

          <h3>1. PROPERTY DESCRIPTION:</h3>
          <p>Property Type: ${propertyType}, Located at ${propertyAddress}, ${cityName}, ${stateName}. Plot Area: ${plotArea} SQ.FT.</p>
          ${propertyType !== "PLOT" ? `<h3>FLOOR DETAILS:</h3>${floorsFormattedHtml}` : ""}

          <h3>2. FOUR BOUNDARIES:</h3>
          <p>East: ${boundaryEast}<br/>West: ${boundaryWest}<br/>North: ${boundaryNorth}<br/>South: ${boundarySouth}</p>

          <h3>3. CONSIDERATION AMOUNT:</h3>
          <p>Total consideration amount fixed at ₹ ${considerationAmount}/-.</p>

          <br/>
          <hr/>
          <p style="font-size: 12px; color: #555;"><b>Disclaimer:</b> This document is generated for reading and drafting assistance only. Service provider is not liable for legal discrepancies.</p>
          
          <table style="width: 100%; margin-top: 40px;">
            <tr>
              <td><b>First Party Sign:</b> ..........................</td>
              <td style="text-align: right;"><b>Second Party Sign:</b> ..........................</td>
            </tr>
          </table>
        </div>`;
      }

      const newWindow = window.open("", "_blank", "width=950,height=800");
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Legal Deed Detailed Draft Report</title>
              <style>
                body { background: #f4f6f8; margin: 0; padding: 20px; }
                .card { background: #fff; padding: 50px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); position: relative; }
                .watermark { position: absolute; top: 40%; left: 30%; font-size: 80px; color: rgba(200, 200, 200, 0.15); transform: rotate(-30deg); z-index: 0; pointer-events: none; font-weight: bold; }
                .content { position: relative; z-index: 1; }
                .no-print { margin-top: 40px; text-align: center; }
                .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer; margin: 5px; }
                .btn-green { background: #059669; }
                @media print { .no-print { display: none; } body { background: #fff; } .card { box-shadow: none; padding: 0; } }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="watermark">SECURE DRAFT REVIEW</div>
                <div class="content">
                  ${mockDraft}
                  <div class="no-print">
                    <button class="btn btn-green" onclick="window.print()">Print / Save as PDF 🖨️</button>
                    <button class="btn" onclick="window.close()">Close Window ✖</button>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);
        newWindow.document.close();
      } else {
        alert("पॉप-अप ब्लॉक (Popup Blocked) हो गया है। कृपया ब्राउज़र सेटिंग्स से पॉप-अप की अनुमति दें।");
      }

      setIsGenerating(false);
    }, 1000);
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 my-6">
      <div className="bg-slate-900 text-white p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between items-center gap-2">
        <h1 className="text-lg md:text-xl font-bold tracking-wide">ADVANCED LEGAL DEED DRAFTING PORTAL</h1>
        <span className="text-xs bg-blue-600 px-3 py-1 rounded-full font-semibold">All States & Multi-Floor Mode</span>
      </div>

      <form onSubmit={handleGenerateAndOpenWindow} className="space-y-6">
        {/* Top Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">PROPERTY TYPE</label>
            <select 
              name="propertyType"
              value={formData.propertyType} 
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="PLOT">Plot (भूखंड)</option>
              <option value="HOUSE">House (मकान)</option>
              <option value="FLAT">Flat (फ्लैट)</option>
              <option value="COMMERCIAL">Commercial Shop / Office (वाणिज्यिक)</option>
              <option value="AGRICULTURAL">Agricultural Land (कृषि भूमि)</option>
              <option value="INDUSTRIAL">Industrial Shed / Plot (औद्योगिक)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">STATE (ALL INDIA)</label>
            <select 
              name="stateName"
              value={formData.stateName} 
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">CITY / DISTRICT</label>
            <input 
              type="text" 
              name="cityName"
              value={formData.cityName} 
              onChange={handleChange}
              placeholder="Enter City Name"
              className="w-full p-2.5 border rounded-lg text-sm bg-white uppercase focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">DEED TYPE</label>
            <select 
              name="deedType"
              value={formData.deedType} 
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="SALE DEED">Sale Deed (विक्रय-पत्र)</option>
              <option value="SALE AGREEMENT">Sale Agreement (इकरारनामा)</option>
              <option value="GIFT DEED">Gift Deed (दान-पत्र)</option>
              <option value="CO_OWNERSHIP">Co-Ownership Deed (सह-स्वामित्व लेख)</option>
              <option value="RELINQUISHMENT DEED">Relinquishment Deed (हकत्याग पत्र)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">OUTPUT LANGUAGE</label>
            <select 
              name="outputLanguage"
              value={formData.outputLanguage} 
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="HINDI">Hindi (हिंदी)</option>
              <option value="ENGLISH">English</option>
            </select>
          </div>
        </div>

        {/* Sellers Section */}
        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800">SELLER / VENDOR DETAILS (प्रथम पक्ष)</h3>
            <button 
              type="button" 
              onClick={() => addParty("sellers")}
              className="text-xs bg-slate-800 text-white px-3 py-1 rounded-lg hover:bg-slate-700"
            >
              + Add Seller
            </button>
          </div>
          {(formData.sellers || []).map((seller, index) => (
            <div key={index} className="flex gap-2 items-start bg-white p-3 rounded-lg border">
              <div className="flex-1 space-y-2">
                <input 
                  type="text" 
                  placeholder={`Seller ${index + 1} Name`} 
                  value={seller?.name || ""}
                  onChange={(e) => handlePartyChange(index, "name", e.target.value, "sellers")}
                  className="w-full p-2 border rounded-lg text-sm"
                  required
                />
                <textarea 
                  placeholder={`Seller ${index + 1} Father Name, Address & Details`} 
                  value={seller?.details || ""}
                  onChange={(e) => handlePartyChange(index, "details", e.target.value, "sellers")}
                  className="w-full p-2 border rounded-lg text-sm h-16"
                />
              </div>
              {(formData.sellers || []).length > 1 && (
                <button type="button" onClick={() => removeParty(index, "sellers")} className="text-red-600 font-bold px-2">×</button>
              )}
            </div>
          ))}
        </div>

        {/* Buyers Section */}
        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800">BUYER / PURCHASER DETAILS (द्वितीय पक्ष)</h3>
            <button 
              type="button" 
              onClick={() => addParty("buyers")}
              className="text-xs bg-slate-800 text-white px-3 py-1 rounded-lg hover:bg-slate-700"
            >
              + Add Buyer
            </button>
          </div>
          {(formData.buyers || []).map((buyer, index) => (
            <div key={index} className="flex gap-2 items-start bg-white p-3 rounded-lg border">
              <div className="flex-1 space-y-2">
                <input 
                  type="text" 
                  placeholder={`Buyer ${index + 1} Name`} 
                  value={buyer?.name || ""}
                  onChange={(e) => handlePartyChange(index, "name", e.target.value, "buyers")}
                  className="w-full p-2 border rounded-lg text-sm"
                  required
                />
                <textarea 
                  placeholder={`Buyer ${index + 1} Father/Husband Name, Address & Details`} 
                  value={buyer?.details || ""}
                  onChange={(e) => handlePartyChange(index, "details", e.target.value, "buyers")}
                  className="w-full p-2 border rounded-lg text-sm h-16"
                />
              </div>
              {(formData.buyers || []).length > 1 && (
                <button type="button" onClick={() => removeParty(index, "buyers")} className="text-red-600 font-bold px-2">×</button>
              )}
            </div>
          ))}
        </div>

       {/* Property & Specs with Dynamic Multi-Floor Config */}
    <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-4">
      <h3 className="text-xs font-bold text-slate-800">PROPERTY & MULTI-FLOOR SPECIFICATIONS</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-gray-600 mb-1">TOTAL PLOT / LAND AREA (SQ. FT.)</label>
          <input 
            type="text" 
            name="plotArea"
            placeholder="e.g. 1000" 
            value={formData.plotArea}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-white"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-gray-600 mb-1">EXACT PROPERTY ADDRESS / LOCATION</label>
          <input 
            type="text" 
            name="propertyAddress"
            placeholder="e.g. ट्रांसपोर्ट नगर, इंदौर" 
            value={formData.propertyAddress}
            onChange={handleChange}
            className="w-full p-2.5 border rounded-lg text-sm bg-white"
            required
          />
        </div>
      </div>
      
          {/* Dynamic Floors Section */}
          {formData.propertyType !== "PLOT" && (
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-blue-700">FLOOR-WISE BUILT-UP AREA (मंजिलवार क्षेत्रफल)</label>
                <button 
                  type="button" 
                  onClick={addFloorItem}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                >
                  + Add Another Floor
                </button>
              </div>

              {formData.floorsList.map((floor, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="Floor Name e.g. Ground Floor / प्रथम तल" 
                      value={floor.floorName}
                      onChange={(e) => handleFloorChange(idx, "floorName", e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm bg-slate-50"
                      required
                    />
                  </div>
                  <div className="w-40">
                    <input 
                      type="text" 
                      placeholder="Area (Sq. Ft.)" 
                      value={floor.builtUpArea}
                      onChange={(e) => handleFloorChange(idx, "builtUpArea", e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm"
                      required
                    />
                  </div>
                  {formData.floorsList.length > 1 && (
                    <button type="button" onClick={() => removeFloorItem(idx)} className="text-red-600 font-bold px-2 text-lg">×</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">PARENT DOCUMENT DETAILS</label>
              <input 
                type="text" 
                name="parentDocument"
                placeholder="e.g. पंजीयन क्रमांक..." 
                value={formData.parentDocument}
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">CONSIDERATION AMOUNT (₹)</label>
              <input 
                type="text" 
                name="considerationAmount"
                placeholder="e.g. 5,00,000" 
                value={formData.considerationAmount}
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* Four Boundaries */}
        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-1">FOUR BOUNDARIES (चतुःसीमा)</h3>
          <p className="text-[11px] text-gray-500 mb-3">* अनिवार्य: कम से कम एक दिशा में रोड, रास्ता या गली (Access) दर्ज होना चाहिए।</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" name="boundaryEast" placeholder="East (पूर्व): e.g. रोड" value={formData.boundaryEast} onChange={handleChange} className="p-2.5 border rounded-lg text-sm bg-white" required />
            <input type="text" name="boundaryWest" placeholder="West (पश्चिम): e.g. 100 फीट चौड़ा रोड" value={formData.boundaryWest} onChange={handleChange} className="p-2.5 border rounded-lg text-sm bg-white" required />
            <input type="text" name="boundaryNorth" placeholder="North (उत्तर): e.g. अन्य की संपत्ति" value={formData.boundaryNorth} onChange={handleChange} className="p-2.5 border rounded-lg text-sm bg-white" required />
            <input type="text" name="boundarySouth" placeholder="South (दक्षिण): e.g. प्लॉट क्रमांक 05" value={formData.boundarySouth} onChange={handleChange} className="p-2.5 border rounded-lg text-sm bg-white" required />
          </div>
        </div>

   {/* Action Buttons */}
    <div className="flex flex-col sm:flex-row gap-3 pt-6 items-center justify-between border-t border-gray-100">
      
      {/* Back to Dashboard Button (Gray Style matching Image 2) */}
      <button
        type="button"
        onClick={handleBack}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#525E75] hover:bg-[#3F4A5E] text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {/* Clear Data Button */}
        <button 
          type="button" 
          onClick={handleReset}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm rounded-xl transition-all active:scale-[0.98] text-center"
        >
          Clear Data
        </button>

        {/* Generate Report Button (Solid Blue matching Image 2) */}
        <button 
          type="submit" 
          disabled={isGenerating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Opening Draft...
            </>
          ) : (
            <>
              Generate Secure Draft
              <span className="text-base">📄</span>
            </>
          )}
        </button>
      </div>

    </div>
      </form>
    </div>
  );
}