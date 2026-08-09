"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  // [START NEW FEATURE - SALE AGREEMENT PAYMENT DETAILS]
  bayanaAmount: string;
  remainingAmount: string;
  paymentPeriod: string;
  // [END NEW FEATURE - SALE AGREEMENT PAYMENT DETAILS]

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

  floorsList: [
    {
      floorName: "GROUND FLOOR (तल मंजिल)",
      builtUpArea: "",
    },
  ],

  parentDocument: "",
  plotArea: "",
  considerationAmount: "",

  // [START NEW FEATURE - SALE AGREEMENT PAYMENT DETAILS]
  bayanaAmount: "",
  remainingAmount: "",
  paymentPeriod: "3 माह",
  // [END NEW FEATURE - SALE AGREEMENT PAYMENT DETAILS]

  boundaryEast: "",
  boundaryWest: "",
  boundaryNorth: "",
  boundarySouth: "",
};

const INDIAN_STATES = [
  "ANDHRA PRADESH",
  "ARUNACHAL PRADESH",
  "ASSAM",
  "BIHAR",
  "CHHATTISGARH",
  "GOA",
  "GUJARAT",
  "HARYANA",
  "HIMACHAL PRADESH",
  "JHARKHAND",
  "KARNATAKA",
  "KERALA",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "ODISHA",
  "PUNJAB",
  "RAJASTHAN",
  "SIKKIM",
  "TAMIL NADU",
  "TELANGANA",
  "TRIPURA",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "WEST BENGAL",
  "DELHI",
  "JAMMU AND KASHMIR",
];

export default function DeedDraftingPage() {
  const router = useRouter();

  const [formData, setFormData] =
    useState<DeedFormData>(INITIAL_FORM_STATE);

  const [isGenerating, setIsGenerating] =
    useState(false);

  // ============================================================
  // BACK
  // ============================================================

  const handleBack = () => {
    router.push("/dashboard");
  };

  // ============================================================
  // GENERAL CHANGE
  // ============================================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "cityName"
          ? value.toUpperCase()
          : value,
    }));
  };

  // ============================================================
  // PARTY CHANGE
  // ============================================================

  const handlePartyChange = (
    index: number,
    field: "name" | "details",
    value: string,
    partyType: "sellers" | "buyers"
  ) => {
    setFormData((prev) => {
      const list = [...prev[partyType]];

      list[index] = {
        ...list[index],
        [field]: value,
      };

      return {
        ...prev,
        [partyType]: list,
      };
    });
  };

  // ============================================================
  // ADD PARTY
  // ============================================================

  const addParty = (
    partyType: "sellers" | "buyers"
  ) => {
    setFormData((prev) => ({
      ...prev,
      [partyType]: [
        ...prev[partyType],
        {
          name: "",
          details: "",
        },
      ],
    }));
  };

  // ============================================================
  // REMOVE PARTY
  // ============================================================

  const removeParty = (
    index: number,
    partyType: "sellers" | "buyers"
  ) => {
    setFormData((prev) => {
      if (prev[partyType].length === 1) {
        return prev;
      }

      return {
        ...prev,
        [partyType]: prev[partyType].filter(
          (_, i) => i !== index
        ),
      };
    });
  };

  // ============================================================
  // FLOOR CHANGE
  // ============================================================

  const handleFloorChange = (
    index: number,
    field: "floorName" | "builtUpArea",
    value: string
  ) => {
    setFormData((prev) => {
      const updatedFloors = [
        ...prev.floorsList,
      ];

      updatedFloors[index] = {
        ...updatedFloors[index],
        [field]: value,
      };

      return {
        ...prev,
        floorsList: updatedFloors,
      };
    });
  };

  // ============================================================
  // ADD FLOOR
  // ============================================================

  const addFloorItem = () => {
    setFormData((prev) => ({
      ...prev,

      floorsList: [
        ...prev.floorsList,

        {
          floorName:
            `FLOOR ${prev.floorsList.length + 1}`,

          builtUpArea: "",
        },
      ],
    }));
  };

  // ============================================================
  // REMOVE FLOOR
  // ============================================================

  const removeFloorItem = (
    index: number
  ) => {
    setFormData((prev) => {
      if (prev.floorsList.length === 1) {
        return prev;
      }

      return {
        ...prev,

        floorsList:
          prev.floorsList.filter(
            (_, i) => i !== index
          ),
      };
    });
  };

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateForm = (): boolean => {
    const sellersList =
      formData.sellers || [];

    const buyersList =
      formData.buyers || [];

    const hasValidSeller =
      sellersList.some(
        (seller) =>
          seller?.name?.trim() !== ""
      );

    const hasValidBuyer =
      buyersList.some(
        (buyer) =>
          buyer?.name?.trim() !== ""
      );

    if (
      !hasValidSeller ||
      !hasValidBuyer
    ) {
      alert(
        "कृपया कम से कम एक विक्रेता (Seller) और एक क्रेता (Buyer) का नाम दर्ज करें।"
      );

      return false;
    }

    if (
      !formData.propertyAddress?.trim()
    ) {
      alert(
        "कृपया प्रॉपर्टी का पूरा पता (Address) दर्ज करें।"
      );

      return false;
    }

    if (!formData.plotArea?.trim()) {
      alert(
        "कृपया Plot / Land Area दर्ज करें।"
      );

      return false;
    }

    return true;
  };

  // ============================================================
// [START NEW FEATURE - COMPLETE DYNAMIC DEED CONTENT ENGINE]
// ============================================================

const getDynamicDeedContent = (
  data: DeedFormData
) => {
  const {
    deedType,
    considerationAmount,
    propertyAddress,
    plotArea,
    boundaryEast,
    boundaryWest,
    boundaryNorth,
    boundarySouth,
    sellers,
    buyers,
    cityName,
    stateName,
    parentDocument,
    bayanaAmount,
    remainingAmount,
    paymentPeriod,
    propertyType,
    floorsList,
  } = data;

  const sellerNames =
    sellers
      ?.map((seller) => seller.name?.trim())
      .filter(Boolean) || [];

  const buyerNames =
    buyers
      ?.map((buyer) => buyer.name?.trim())
      .filter(Boolean) || [];

  const firstSeller =
    sellers?.[0] || {
      name: "",
      details: "",
    };

  const firstBuyer =
    buyers?.[0] || {
      name: "",
      details: "",
    };

  const totalAmount =
    considerationAmount?.trim() || "______";

  const advanceAmount =
    bayanaAmount?.trim() || "______";

  const balanceAmount =
    remainingAmount?.trim() || "______";

  const paymentDuration =
    paymentPeriod?.trim() || "3 माह";

  const propertyArea =
    plotArea?.trim() || "______";

  const propertyLocation =
    propertyAddress?.trim() || "______";

  const city =
    cityName?.trim() || "______";

  const state =
    stateName?.trim() || "______";

  const parentDoc =
    parentDocument?.trim() || "____________________________";

  const east =
    boundaryEast?.trim() || "______";

  const west =
    boundaryWest?.trim() || "______";

  const north =
    boundaryNorth?.trim() || "______";

  const south =
    boundarySouth?.trim() || "______";

  const floorDetails =
    floorsList
      ?.map(
        (floor, index) =>
          `<b>${index + 1}.</b> ${floor.floorName || "______"} - निर्मित क्षेत्रफल: <b>${floor.builtUpArea || "______"} वर्गफीट</b>`
      )
      .join("<br/>") || "";

  // फॉर्मेटेड सेलर्स और बायर्स (सारे डीड्स के लिए सामान्य उपयोग हेतु)
  const formattedSellers =
    sellers
      ?.map((s, i) => `<b>${i + 1}. ${s.name || "______"}</b><br/>${s.details || "______"}`)
      .join("<br/><br/>") || "";

  const formattedBuyers =
    buyers
      ?.map((b, i) => `<b>${i + 1}. ${b.name || "______"}</b><br/>${b.details || "______"}`)
      .join("<br/><br/>") || "";

  // कानूनी डिस्क्लेमर
  const legalDisclaimer = `
    <div class="disclaimer">
      <b>⚠️ कानूनी अस्वीकरण:</b><br/>
      यह लेख पक्षकारों द्वारा प्रदान की गई जानकारी के आधार पर तैयार किया गया है। 
      सर्विस प्रोवाइडर ने संपत्ति के दस्तावेजों, भौतिक स्थिति या पहचान का परीक्षण नहीं किया है। 
      ई-स्टाम्पिंग और ड्राफ्टिंग की जिम्मेदारी तक ही सेवा सीमित है। 
      अंतिम विधिक सत्यापन और पंजीयन संबंधी कार्यवाही पक्षकारों द्वारा की जानी चाहिए।
    </div>
  `;

  // ============================================================
  // SALE AGREEMENT
  // ============================================================
  if (deedType === "SALE AGREEMENT") {
    return {
      title: "विक्रय अनुबंध लेख",
      party1Title: "प्रथमपक्ष / विक्रेता",
      party2Title: "द्वितीयपक्ष / क्रेता",
      bodyText: `
        <div class="deed-title">!! विक्रय अनुबंध लेख !!</div>
        <div class="party-section">
          <p>${sellerNames.map((name, index) => `<b>${index + 1}. ${name}</b><br/>${sellers[index]?.details || ""}`).join("<br/>")}</p>
          <p><b>..प्रथमपक्ष / विक्रेता</b></p>
          <p>जिन्हें इस लेख में आगे सुविधा की दृष्टि से प्रथमपक्ष/विक्रेता के नाम से संबोधित किया गया है...</p>
          <p><b>एवं</b></p>
          <p>${buyerNames.map((name, index) => `<b>${index + 1}. ${name}</b><br/>${buyers[index]?.details || ""}`).join("<br/>")}</p>
          <p><b>द्वितीयपक्ष / क्रेता</b></p>
        </div>
        <div class="clause">
          <p><b>1.</b> संपत्ति का पता: <b>${propertyLocation}</b>, क्षेत्रफल: <b>${propertyArea} वर्गफीट</b>।</p>
          <p><b>चतुःसीमा :-</b></p>
          <table class="boundary-table">
            <tr><td><b>पूर्व में</b></td><td>${east}</td></tr>
            <tr><td><b>पश्चिम में</b></td><td>${west}</td></tr>
            <tr><td><b>उत्तर में</b></td><td>${north}</td></tr>
            <tr><td><b>दक्षिण में</b></td><td>${south}</td></tr>
          </table>
          <p><b>2.</b> कुल अनुबंध राशि रुपये <b>₹ ${totalAmount}/-</b> तय की गई है। बयाना राशि <b>₹ ${advanceAmount}/-</b> और शेष राशि <b>₹ ${balanceAmount}/-</b>, <b>${paymentDuration}</b> की अवधि में देय होगी।</p>
          ${legalDisclaimer}
        </div>
      `,
    };
  }

  // ============================================================
  // CO-OWNERSHIP DEED
  // ============================================================
  if (deedType === "CO_OWNERSHIP") {
    const firstPartyName = firstSeller.name?.trim() || "______";
    const firstPartyDetails = firstSeller.details?.trim() || "______";
    const secondPartyName = firstBuyer.name?.trim() || "______";
    const secondPartyDetails = firstBuyer.details?.trim() || "______";

    return {
      title: "अचल संपत्ति के सह-स्वामित्व का लेख (प्रतिफल रहित)",
      party1Title: "प्रथम पक्ष",
      party2Title: "द्वितीय पक्ष",
      bodyText: `
        <p>यह सह-स्वामित्व लेख प्रतिफल रहित निष्पादित कर देने वाले <b>${firstPartyName}</b> (${firstPartyDetails})...</p>
        <p>संपत्ति का पता: <b>${propertyLocation}</b>, क्षेत्रफल: <b>${propertyArea} वर्गफीट</b>।</p>
        <table class="boundary-table">
          <tr><td><b>पूर्व में</b></td><td>${east}</td></tr>
          <tr><td><b>पश्चिम में</b></td><td>${west}</td></tr>
          <tr><td><b>उत्तर में</b></td><td>${north}</td></tr>
          <tr><td><b>दक्षिण में</b></td><td>${south}</td></tr>
        </table>
        ${legalDisclaimer}
      `,
    };
  }

  // ============================================================
  // GIFT DEED
  // ============================================================
  if (deedType === "GIFT DEED") {
    return {
      title: "दान-पत्र (GIFT DEED)",
      party1Title: "दाता / प्रथम पक्ष (Donor)",
      party2Title: "प्राप्तकर्ता / द्वितीय पक्ष (Donee)",
      bodyText: `
        <p>यह कि प्रथम पक्ष अपने पूर्ण स्नेह और बिना किसी आर्थिक प्रतिफल के अपनी यह संपत्ति स्वेच्छा से दान करता है।</p>
        <p>संपत्ति का पता: <b>${propertyLocation}</b>, क्षेत्रफल: <b>${propertyArea} वर्गफीट</b>।</p>
        <table class="boundary-table">
          <tr><td><b>पूर्व में</b></td><td>${east}</td></tr>
          <tr><td><b>पश्चिम में</b></td><td>${west}</td></tr>
          <tr><td><b>उत्तर में</b></td><td>${north}</td></tr>
          <tr><td><b>दक्षिण में</b></td><td>${south}</td></tr>
        </table>
        ${legalDisclaimer}
      `,
    };
  }

  // ============================================================
  // RELINQUISHMENT DEED
  // ============================================================
  if (deedType === "RELINQUISHMENT DEED") {
    return {
      title: "हकत्याग पत्र (RELINQUISHMENT DEED)",
      party1Title: "हकत्यागकर्ता / प्रथम पक्ष",
      party2Title: "पक्षकार / द्वितीय पक्ष",
      bodyText: `
        <p>यह कि प्रथम पक्ष अपनी संयुक्त संपत्ति से अपने समस्त अधिकार और दावे स्वेच्छा से त्यागता है।</p>
        <p>संपत्ति का पता: <b>${propertyLocation}</b>, क्षेत्रफल: <b>${propertyArea} वर्गफीट</b>।</p>
        <table class="boundary-table">
          <tr><td><b>पूर्व में</b></td><td>${east}</td></tr>
          <tr><td><b>पश्चिम में</b></td><td>${west}</td></tr>
          <tr><td><b>उत्तर में</b></td><td>${north}</td></tr>
          <tr><td><b>दक्षिण में</b></td><td>${south}</td></tr>
        </table>
        ${legalDisclaimer}
      `,
    };
  }

  // ============================================================
  // SALE DEED (DEFAULT / MAIN)
  // ============================================================
  if (deedType === "SALE DEED" || !deedType) {
    return {
      title: "विक्रय – पत्र (SALE DEED)",
      party1Title: "", // ऊपर का अतिरिक्त हेडर खाली कर दिया ताकि रिपीट न हो
      party2Title: "", 
      bodyText: `
        <div class="deed-title">!! विक्रय – पत्र !!</div>

        <div class="party-section">
          <p>यह विक्रय निष्पादित कर देने वाले:</p>
          <p>${formattedSellers}</p>
          <p>जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“विक्रेतापक्ष”</b> के शब्द से संबोधित किया गया है।</p>
          
          <p>एवं</p>
          
          <p>${formattedBuyers}</p>
          <p>जिन्हें आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“क्रेतापक्ष”</b> के शब्द से संबोधित किया गया है।</p>

          <p>मैं प्रथम पक्ष / विक्रेतापक्ष, आप द्वितीय पक्ष / क्रेतापक्ष के हित में यह विक्रय पत्र निष्पादित कर देती/देता हूँ कि :-</p>
        </div>

        <div class="clause">
          <p><b>1.</b> यहाँ कि प्रथमपक्ष / विक्रेतापक्ष के एकमात्र स्वामित्व एवं आधिपत्य का यह <b>${propertyType}</b>, जो कि <b>${propertyLocation}</b> में स्थित है। जिसका कुल क्षेत्रफल <b>${propertyArea} वर्गफीट</b> है।</p>
          
          <p>उक्त संपत्ति का मूल दस्तावेज / पूर्व स्वामित्व विवरण: <b>${parentDoc}</b></p>
          
          <p>सदर संपत्ति वर्तमान में ${propertyType === "PLOT" ? "रिक्त अवस्था में होकर उस पर किसी भी प्रकार का कोई निर्माण कार्य नहीं किया गया है" : "विक्रेता पक्ष के स्वामित्व एवं आधिपत्य में है"}। इस प्रकार उक्त संपत्ति को विक्रय (बेचने) का पूर्ण एवं वैधानिक अधिकार विक्रेता पक्ष को प्राप्त है।</p>

          <p><b>2.</b> यंहा की विक्रेतापक्ष के द्वारा क्रेतापक्ष को विक्रय किए जा रहे भूखंड का वर्णन व उक्त भूखंड की चतुःसीमा निम्नानुसार है :-</p>
          <table class="boundary-table">
            <tr><td><b>पूर्व में</b></td><td>${east}</td></tr>
            <tr><td><b>पश्चिम में</b></td><td>${west}</td></tr>
            <tr><td><b>उत्तर में</b></td><td>${north}</td></tr>
            <tr><td><b>दक्षिण में</b></td><td>${south}</td></tr>
          </table>

          <p><b>3.</b> यह कि उपरोक्त वर्णित चतुःसीमा के बीच का दर्शाया गया भूखंड विक्रेतापक्ष ने क्रेतापक्ष को <b>₹ ${totalAmount}/-</b> में विक्रय किया होकर विक्रय प्रतिफल की संपूर्ण धन राशि क्रेतापक्ष से विक्रेतापक्ष ने प्राप्त कर ली है। विक्रेतापक्ष ने सम्पूर्ण धनराशि प्राप्त कर ली है जिसकी प्राप्ति की अभिस्वीकृति विक्रेतापक्ष इस लेख पर अपने हस्ताक्षर प्रदान करते हैं। अब इस विक्रय लेख पेटे कोई धनराशि मुझे विक्रेतापक्ष को लेने अवशेष नहीं है। उपरोक्त वर्णित चतुःसीमा से संबंधित भूखंड को इस लेख में आगे सुविधा एवं संक्षिप्तता की दृष्टि से <b>“सदर संपत्ति”</b> शब्द से संबोधित किया जा रहा है।</p>

          <p><b>4.</b> यह कि सदर संपत्ति का मूर्तिमात आधिपत्य आप क्रेता को मौका पर ले जाकर आज दिनांक को साक्षीगण की उपस्थित में आप क्रेतापक्ष को मालिक नाते सौंप दिया गया है, तथा आप क्रेतापक्ष ने इस पर अपना  आधिपत्य कर लिया है  अब आप  क्रेतापक्ष इसका उपयोग एवं उपभोग आपके इक्छा अनुसार करना व  करते जाना है |</p>

          <p><b>5.</b> यह कि सदर सम्पत्ति के लिये विक्रतापक्ष के स्वामित्व बाबद हक, अधिकार स्वत्व, आगमन आदि इस लेख में विक्रेतापक्ष व उनके उत्तराधिकारियों में निहित है वे समस्त हक, अधिकार, स्वत्व, आगम आदि इस लेख के द्वारा आप क्रेतापक्ष में वेष्ठित हो गये हैं, अब आप क्रेतापक्ष सदर सम्पत्ति का स्वेच्छानुसार उपयोग एवं उपभोग व अन्तरण आदि कर सकेंगे। इसमें क्रेतापक्ष या उनके वारिसान की किसी भी प्रकार आपत्ति नहीं रहेगी।</p>

          <p><b>6.</b> यह कि सदर सम्पत्ति विक्रेतापक्ष के एकमेव स्वामित्व एवं आधिपत्य का होकर इस विक्रय करने एवं विक्रय प्रतिफल धनराशि प्राप्त कर यह विक्रय लेख क्रेतापक्ष के हित में निष्पादित कर देने का पूर्ण वैधानिक अधिकार प्राप्त है।</p>

          <p><b>7.</b> यह कि विक्रेतापक्ष एतद द्वारा घोषित एवं निश्चित करते है कि सदर सम्पत्ति उसके द्वारा इस विक्रय पत्र से आप क्रेतापक्ष के तथा आप क्रेतापक्ष के अलावा अन्य किसी व्यक्ति या संस्था को दान, गिरवी, रहन, जमानत, मेंटेनेंस, इत्यादि रीति से या अन्य किसी भी रीति से अन्तरित या हस्तांतरित नहीं कि गयी है, और न ही विक्रेतापक्ष द्वारा ऐसे किसी लिखित या मौखिक वचन या पारिवारिक व्यवस्था पत्र आदि का निष्पादन किया है न हि सदर सम्पत्ति पर शासन का, बैंक का या सहकारी संस्था आदि का कोई ऋण भार नहीं है तात्पर्य यह है कि उक्त भूखण्ड पूर्णतः भार व बोझ से रहित अवस्था में आप क्रेतापक्ष को विक्रय किया गया है।</p>

          <p><b>8.</b> यह कि सदर सम्पत्ति के स्वामित्व के सम्बन्ध में किसी भी प्रकार का विवाद या दोष इस विक्रय पत्र पंजीयन दिनांक से पूर्व के लिये तथा भविष्य में भी पाया गया या इस सम्पत्ति पर किसी व्यक्ति या संस्था ने अपना हक या अधिकार सिध्द किया या इस विक्रय व्यवहार में किसी भी प्रकार की आपत्ति की तो उसके निराकरण का सम्पूर्ण एवं सव्यय दायित्व विक्रेतापक्ष का रहेगा इस कारण से आप क्रेतापक्ष को किसी भी प्रकार का खर्च या नुकसान नहीं लगने देंगे तथा आपत्तिकर्ता के हस्ताक्षर एवं सहमति करवाने का दायित्व विक्रेतापक्ष का रहेगा।</p>

          <p><b>9.</b> यह कि सदर सम्पत्ति के लिये देय समस्त टेक्सेस, सम्पत्तिकर, मेंटेनेंस, विद्युत व्यय एवं अन्य दायित्व विक्रय पत्र पंजीयन दिनांक तक विक्रेतापक्ष वहन करेंगे तथा विक्रय पत्र पंजीयन दिनांक से क्रेतापक्ष द्वारा क्रय किये जा रहे भूखण्ड के दायित्व क्रेतापक्ष वहन करेंगे.</p>

          <p><b>10.</b> यह कि सदर सम्पत्ति के लिये क्रेतापक्ष स्वयं के व्यय से अपना नामांत्रण सम्बन्धित विभागों, नगर निगम राजस्व अभिलेखों व अभिलेखों, संस्था में करवा सकेंगे तथा इस कार्यवाही में विक्रेतापक्ष अपेक्षित सहयोग प्रदान करने हस्ताक्षर इत्यादि करने के लिये वचनबद्ध तथा बाध्य रहेंगे.</p>

          <p><b>11.</b> यह कि विक्रेतापक्ष / प्रथमपक्ष ने अपने मालिक की सम्बन्धित समस्त असल दस्तावेज आज दिनांक को क्रेतापक्ष के सुपुर्द कर दिये हैं, अब प्रथमपक्ष / विक्रेता के पास उक्त सम्पत्ति के सम्बन्ध में कोई भी असल दस्तावेज उपलब्ध नहीं है.</p>

          <p><b>12.</b> यह कि, विक्रय पत्र में विक्रित सम्पत्ति के विक्रय द्वारा पंजीयन की धारा २२-क व अन्य किसी भी प्रचलित विधि का उल्लंघन नहीं किया गया है</p>

          <p><b>13.</b> यह कि, इस लेख के पक्षकारों ने इसे भली-भांति पढ़कर एवं समझकर इस पर अपने-अपने हस्ताक्षर किये हैं पक्षकारों द्वारा दी गयी जानकारी अनुसार सर्विस प्रोवाइडर ने सम्पदा सॉफ्टवेयर में सभी जानकारियां अपलोड की हैं. यदि इसमें किसी भी असत्य, भ्रामक, झूठा कथन पाया गया तो उसकी समस्त जबाबदारी पक्षकारों की होगी. सर्विस प्रोवाइडर द्वारा मौके का परीक्षण नहीं किया गया है और व्यक्तियों की पहचान के सम्बन्ध में भी सम्पूर्ण जबाबदारी पक्षकारों स्वयं की रहेगी. सर्विस प्रोवाइडर को किसी भी रूप में उपरोक्त सभी बातों के लिए उत्तरदायी नहीं ठहराया जायेगा. उसके द्वारा सिर्फ पंजीयन की कार्यवाही को ई-स्टाम्पिंग कर पूर्ण करवाया गया है तथा सर्विस प्रोवाइडर द्वारा मुझसे शासन द्वारा तय राशि से अधिक राशि प्राप्त नहीं की गयी है इस प्रकार लेख के पक्षकारों व्यवहारों तथा व क्रय में उल्लेखित सम्पत्ति व लेख में वर्णित तथा लेख के साथ प्रस्तुत अपलोड किये गये दस्तावेजों से भी प्रारूपणकर्ता एवं सेवा प्रदाता का प्रत्यक्ष या अप्रत्यक्ष रूप से किसी भी प्रकार का कोई लेना देना, सरोकार व सम्बन्ध नहीं है तथा उनके बाबद भी प्रारूपणकर्ता एवं सेवाप्रदाता की किसी भी प्रकार की कोई जवाबदारी नहीं रहेगी। उपरोक्तानुसार यह विक्रयपत्र मुझ निष्पादक ने पढ़कर, सुनकर व समझकर स्वेच्छा से शरीर व मन की पूर्ण स्वस्थ हालत में प्रतिफल की सम्पूर्ण धनराशि प्राप्त करने के पश्चात साक्षीगणों के समक्ष अपने हस्ताक्षर से आप क्रेता के हित में निष्पादित कर दिया, सो सही ताकि वक्त जरूरत काम आवे।</p>
          
          ${legalDisclaimer}
        </div>
      `,
    };
  }

  // अंतिम फॉलबैक रिटर्न (यदि कोई अन्य स्थिति बने)
  return {
    title: "विक्रय-पत्र (SALE DEED)",
    party1Title: "प्रथम पक्ष / विक्रेता",
    party2Title: "द्वितीय पक्ष / क्रेता",
    bodyText: `<p>संपत्ति का पता: <b>${propertyLocation}</b></p>${legalDisclaimer}`,
  };
};

// ============================================================
// [END NEW FEATURE - COMPLETE DYNAMIC DEED CONTENT ENGINE]
// ============================================================

  // ============================================================
  // [START NEW FEATURE - SAVE DEED RECORD TO SUPABASE]
  // ============================================================

  const saveDeedRecord = async (
    draftHtml: string
  ) => {
    try {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      const { data, error } =
        await supabase
          .from("deed_records")
          .insert({
            user_id:
              user?.id || null,

            deed_type:
              formData.deedType,

            property_type:
              formData.propertyType,

            state_name:
              formData.stateName,

            city_name:
              formData.cityName,

            output_language:
              formData.outputLanguage,

            sellers:
              formData.sellers,

            buyers:
              formData.buyers,

            property_address:
              formData.propertyAddress,

            floors_list:
              formData.floorsList,

            parent_document:
              formData.parentDocument,

            plot_area:
              formData.plotArea,

            consideration_amount:
              formData.considerationAmount,

            bayana_amount:
              formData.bayanaAmount,

            remaining_amount:
              formData.remainingAmount,

            payment_period:
              formData.paymentPeriod,

            boundary_east:
              formData.boundaryEast,

            boundary_west:
              formData.boundaryWest,

            boundary_north:
              formData.boundaryNorth,

            boundary_south:
              formData.boundarySouth,

            uploaded_file_name:
              null,

            uploaded_file_path:
              null,

            uploaded_file_type:
              null,

            uploaded_file_size:
              null,

            form_snapshot:
              formData,

            generated_draft_html:
              draftHtml,

            status:
              "GENERATED",

            deed_generated_at:
              new Date().toISOString(),

            payment_status:
              "PENDING",
          })
          .select(
            "id, ref_no, deed_generated_at, payment_status"
          )
          .single();

      if (error) {
        console.error(
          "DEED RECORD SAVE ERROR:",
          error
        );

        throw error;
      }

      console.log(
        "DEED RECORD SAVED:",
        data
      );

      return data;

    } catch (error: any) {
      console.error(
        "SAVE DEED ERROR:",
        error
      );

      throw error;
    }
  };

  // ============================================================
  // [END NEW FEATURE - SAVE DEED RECORD TO SUPABASE]
  // ============================================================

  // ============================================================
  // GENERATE + SAVE + OPEN
  // ============================================================

  const handleGenerateAndOpenWindow = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsGenerating(true);

    try {
      const deedContent =
        getDynamicDeedContent(formData);

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
        bayanaAmount,
        remainingAmount,
        paymentPeriod,
      } = formData;

      const sellersFormatted =
        sellers
          .map(
            (seller, index) =>
              `<b>
                ${index + 1}.
                ${seller.name || ""}
              </b>
              <br/>
              ${seller.details || ""}`
          )
          .join("<br/><br/>");

      const buyersFormatted =
        buyers
          .map(
            (buyer, index) =>
              `<b>
                ${index + 1}.
                ${buyer.name || ""}
              </b>
              <br/>
              ${buyer.details || ""}`
          )
          .join("<br/><br/>");

      const floorsFormattedHtml =
        floorsList
          .map(
            (floor, index) =>
              `<b>
                ${index + 1}. मंजिल/हिस्सा:
              </b>
              ${floor.floorName}
              -
              <b>निर्मित क्षेत्र:</b>
              ${floor.builtUpArea || "______"}
              वर्गफीट`
          )
          .join("<br/>");

      let mockDraft = "";

      // ========================================================
      // HINDI
      // ========================================================

      if (
        outputLanguage === "HINDI"
      ) {
        mockDraft = `
          <div class="document-header">

            <h1>
              ${
                deedType ===
                "SALE AGREEMENT"
                  ? "!! विक्रय अनुबंध लेख !!"
                  : deedContent.title
              }
            </h1>

          </div>

          <div class="party-header">

            <p>
              <b>
                ${
                  deedType ===
                  "SALE AGREEMENT"
                    ? "प्रथमपक्ष / विक्रेता"
                    : deedContent.party1Title
                }
              </b>
            </p>

            <div>
              ${sellersFormatted}
            </div>

            ${
              deedType ===
              "SALE AGREEMENT"
                ? `
                  <p>
                    जिन्हें इस लेख में आगे सुविधा की दृष्टि
                    से प्रथमपक्ष/विक्रेता के नाम से संबोधित
                    किया गया है जिसमें इन्हीं को समस्त
                    वैध प्रतिनिधि, असाईनीज, आम मुखत्यार,
                    हितबंध व्यक्ति आदि सम्मिलित हैं।
                  </p>
                `
                : ""
            }

            <p style="text-align:center;">
              <b>एवं</b>
            </p>

            <p>
              <b>
                ${
                  deedType ===
                  "SALE AGREEMENT"
                    ? "द्वितीयपक्ष / क्रेता"
                    : deedContent.party2Title
                }
              </b>
            </p>

            <div>
              ${buyersFormatted}
            </div>

            ${
              deedType ===
              "SALE AGREEMENT"
                ? `
                  <p>
                    जिन्हें इस लेख में आगे सुविधा की दृष्टि
                    से द्वितीयपक्ष/क्रेता के नाम से संबोधित
                    किया गया है जिसमें इनको समस्त वैध
                    प्रतिनिधि, असाईनीज, आम मुखत्यार,
                    हितबंध व्यक्ति आदि सम्मिलित हैं।
                  </p>
                `
                : ""
            }

          </div>

          <div class="main-content">

            ${
              deedType !==
              "SALE AGREEMENT"
                ? `
                  <p>
                    <b>
                      ${deedContent.party1Title}:
                    </b>
                  </p>
                `
                : ""
            }

            ${deedContent.bodyText}

          </div>

          ${
            deedType !==
            "SALE AGREEMENT"
              ? `
                <table class="signature-table">

                  <tr>

                    <td>
                      <b>
                        हस्ताक्षर /
                        ${deedContent.party1Title}
                      </b>
                    </td>

                    <td>
                      <b>
                        हस्ताक्षर /
                        ${deedContent.party2Title}
                      </b>
                    </td>

                  </tr>

                  <tr>

                    <td>
                      <br/><br/>
                      __________________________
                    </td>

                    <td>
                      <br/><br/>
                      __________________________
                    </td>

                  </tr>

                </table>
              `
              : ""
          }
        `;
      }

      // ========================================================
      // ENGLISH
      // ========================================================

      else {
        mockDraft = `
          <div class="document-header">

            <h1>
              PROFESSIONAL
              ${deedType}
            </h1>

            <p>
              ${
                deedType ===
                "SALE AGREEMENT"
                  ? "AGREEMENT TO SALE"
                  : deedContent.title
              }
            </p>

          </div>

          <h3>
            FIRST PARTY / SELLER
          </h3>

          <p>
            ${sellers
              .map(
                (seller) =>
                  `${seller.name || ""}
                   <br/>
                   ${seller.details || ""}`
              )
              .join("<br/><br/>")}
          </p>

          <h3>
            SECOND PARTY / BUYER
          </h3>

          <p>
            ${buyers
              .map(
                (buyer) =>
                  `${buyer.name || ""}
                   <br/>
                   ${buyer.details || ""}`
              )
              .join("<br/><br/>")}
          </p>

          <h3>
            1. PROPERTY DESCRIPTION
          </h3>

          <p>
            Property Type:
            <b>${propertyType}</b>
          </p>

          <p>
            Property Address:
            <b>${propertyAddress}</b>,
            ${cityName},
            ${stateName}
          </p>

          <p>
            Plot / Land Area:
            <b>${plotArea}</b> SQ.FT.
          </p>

          ${
            propertyType !==
            "PLOT"
              ? `
                <h3>
                  FLOOR DETAILS
                </h3>

                <p>
                  ${floorsFormattedHtml}
                </p>
              `
              : ""
          }

          <h3>
            2. FOUR BOUNDARIES
          </h3>

          <p>
            East:
            ${boundaryEast}

            <br/>

            West:
            ${boundaryWest}

            <br/>

            North:
            ${boundaryNorth}

            <br/>

            South:
            ${boundarySouth}
          </p>

          <h3>
            3. CONSIDERATION AMOUNT
          </h3>

          <p>
            Total consideration amount:
            <b>
              ₹ ${considerationAmount || "______"}
            </b>
          </p>

          ${
            deedType ===
            "SALE AGREEMENT"
              ? `
                <h3>
                  4. PAYMENT DETAILS
                </h3>

                <p>
                  Advance / Bayana:
                  <b>
                    ₹ ${bayanaAmount || "______"}
                  </b>
                </p>

                <p>
                  Remaining Amount:
                  <b>
                    ₹ ${remainingAmount || "______"}
                  </b>
                </p>

                <p>
                  Payment Period:
                  <b>
                    ${paymentPeriod || "3 Months"}
                  </b>
                </p>
              `
              : ""
          }

          <h3>
            5. PARENT DOCUMENT
          </h3>

          <p>
            ${parentDocument || "________________"}
          </p>

          <br/>

          <hr/>

          <p class="english-disclaimer">

            <b>Disclaimer:</b>

            This draft has been generated from the
            information provided by the parties and
            requires final legal verification before
            execution or registration.

          </p>

          <table class="signature-table">

            <tr>

              <td>
                <b>
                  First Party / Seller
                </b>
              </td>

              <td>
                <b>
                  Second Party / Buyer
                </b>
              </td>

            </tr>

            <tr>

              <td>
                <br/><br/>
                __________________________
              </td>

              <td>
                <br/><br/>
                __________________________
              </td>

            </tr>

          </table>
        `;
      }

      // ========================================================
      // COMPLETE HTML
      // ========================================================

      const completeDraftHtml = `
        <!DOCTYPE html>

        <html
          lang="${
            outputLanguage ===
            "HINDI"
              ? "hi"
              : "en"
          }"
        >

        <head>

          <meta charset="UTF-8"/>

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>
            Legal Deed Detailed Draft Report
          </title>

          <style>

            * {
              box-sizing: border-box;
            }

            body {
              background: #f4f6f8;
              margin: 0;
              padding: 20px;

              font-family:
                "Noto Sans Devanagari",
                "Mangal",
                Arial,
                sans-serif;

              color: #111;
              line-height: 1.85;
            }

            .card {
              background: #ffffff;
              max-width: 900px;
              margin: auto;
              padding: 55px;

              border-radius: 8px;

              box-shadow:
                0 4px 15px
                rgba(0,0,0,0.10);

              position: relative;
              overflow: hidden;
            }

            .content {
              position: relative;
              z-index: 1;
            }

            .document-header {
              text-align: center;
              margin-bottom: 35px;
            }

            .document-header h1 {
              font-size: 22px;
              margin:
                0 0 12px 0;
              font-weight: 800;
            }

            .document-header p {
              font-size: 17px;
              font-weight: 700;
            }

            .party-header {
              margin-bottom: 30px;
            }

            .party-header p {
              margin: 10px 0;
            }

            .main-content p {
              text-align: justify;
              margin: 15px 0;
            }

            .clause p {
              text-align: justify;
            }

            .deed-title {
              text-align: center;
              font-size: 21px;
              font-weight: 800;
              margin-bottom: 25px;
            }

            .party-section {
              margin-bottom: 20px;
            }

            .boundary-table {
              width: 100%;
              border-collapse: collapse;
              margin:
                18px 0 25px 0;
            }

            .boundary-table td {
              border:
                1px solid #777;

              padding: 9px;
              vertical-align: top;
            }

            .boundary-table td:first-child {
              width: 25%;
              font-weight: 700;
            }

            .signature-table {
              width: 100%;
              margin-top: 50px;
              border-collapse: collapse;
            }

            .signature-table td {
              width: 50%;
              padding: 10px;
              vertical-align: top;
            }

            .witness-section {
              margin-top: 45px;
            }

            .witness-section p {
              margin: 18px 0;
            }

            .closing {
              margin-top: 40px;
            }

            .disclaimer {
              background: #fff3cd;
              padding: 15px;

              border:
                1px solid #ffeeba;

              border-radius: 5px;

              font-size: 13px;
              line-height: 1.7;

              margin-top: 35px;
            }

            .english-disclaimer {
              font-size: 12px;
              color: #555;
            }

            .watermark {
              position: fixed;

              top: 42%;
              left: 20%;

              font-size: 70px;

              color:
                rgba(180,180,180,0.12);

              transform:
                rotate(-30deg);

              z-index: 0;

              pointer-events: none;

              font-weight: bold;
            }

            .no-print {
              margin-top: 45px;
              text-align: center;
            }

            .btn {
              background: #2563eb;
              color: white;

              border: none;

              padding:
                11px 22px;

              font-size: 14px;

              border-radius: 6px;

              cursor: pointer;

              margin: 5px;
            }

            .btn-green {
              background: #059669;
            }

            .btn:hover {
              opacity: 0.92;
            }

            @media print {

              body {
                background: #ffffff;
                padding: 0;
              }

              .card {
                box-shadow: none;
                border-radius: 0;
                padding: 25px;
                max-width: none;
              }

              .no-print {
                display: none !important;
              }

              .watermark {
                position: fixed;
              }

            }

            @media screen
              and (max-width: 700px) {

              body {
                padding: 8px;
              }

              .card {
                padding: 20px;
              }

              .signature-table,
              .signature-table tbody,
              .signature-table tr,
              .signature-table td {
                display: block;
                width: 100%;
              }

              .signature-table td {
                margin-bottom: 25px;
              }

            }

          </style>

        </head>

        <body>

          <div class="card">

            <div class="watermark">
              SECURE DRAFT REVIEW
            </div>

            <div class="content">

              ${mockDraft}

              <div class="no-print">

                <button
                  class="btn btn-green"
                  onclick="window.print()"
                >
                  Print / Save as PDF 🖨️
                </button>

                <button
                  class="btn"
                  onclick="window.close()"
                >
                  Close Window ✖
                </button>

              </div>

            </div>

          </div>

        </body>

        </html>
      `;

      // ========================================================
      // SAVE FIRST
      // ========================================================

      let savedRecord: any = null;

      try {
        savedRecord =
          await saveDeedRecord(
            completeDraftHtml
          );
      } catch (saveError: any) {
        console.error(
          "DEED SAVE FAILED:",
          saveError
        );

        alert(
          "Deed generate हुआ लेकिन record Supabase में save नहीं हो पाया। कृपया Supabase/RLS policy check करें।"
        );

        setIsGenerating(false);

        return;
      }

      // ========================================================
      // OPEN WINDOW AFTER SUCCESSFUL SAVE
      // ========================================================

      const newWindow =
        window.open(
          "",
          "_blank",
          "width=950,height=800"
        );

      if (newWindow) {

        newWindow.document.write(
          completeDraftHtml
        );

        newWindow.document.close();

        // ======================================================
        // REF NO DISPLAY
        // ======================================================

        if (
          savedRecord?.ref_no
        ) {
          setTimeout(() => {

            const refElement =
              newWindow.document.createElement(
                "div"
              );

            refElement.style.cssText = `
              text-align:center;
              margin-top:10px;
              margin-bottom:20px;
              font-size:13px;
              font-weight:700;
              color:#334155;
            `;

            refElement.innerHTML = `
              DEED REF NO:
              <b>
                ${savedRecord.ref_no}
              </b>
            `;

            const header =
              newWindow.document.querySelector(
                ".document-header"
              );

            if (header) {
              header.appendChild(
                refElement
              );
            }

          }, 50);
        }

      } else {

        alert(
          "पॉप-अप ब्लॉक (Popup Blocked) हो गया है। कृपया ब्राउज़र सेटिंग्स से पॉप-अप की अनुमति दें।"
        );
      }

    } catch (error: any) {

      console.error(
        "DEED GENERATION ERROR:",
        error
      );

      alert(
        "Deed generate करते समय error आया। Console में error details देखें।"
      );

    } finally {

      setIsGenerating(false);

    }
  };

  // ============================================================
  // RESET
  // ============================================================

  const handleReset = () => {
    setFormData({
      ...INITIAL_FORM_STATE,

      sellers: [
        {
          name: "",
          details: "",
        },
      ],

      buyers: [
        {
          name: "",
          details: "",
        },
      ],

      floorsList: [
        {
          floorName:
            "GROUND FLOOR (तल मंजिल)",

          builtUpArea: "",
        },
      ],
    });
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="max-w-6xl mx-auto">

      <div className="mb-6">

        <h1 className="text-xl md:text-2xl font-bold text-slate-800">
          ADVANCED LEGAL DEED DRAFTING PORTAL
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          All States & Multi-Floor Mode
        </p>

      </div>

      <form
        onSubmit={
          handleGenerateAndOpenWindow
        }
        className="space-y-6"
      >

        {/* =====================================================
            TOP DROPDOWNS
        ====================================================== */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">

          <div>

            <label className="block text-xs font-bold text-gray-700 mb-1">
              PROPERTY TYPE
            </label>

            <select
              name="propertyType"
              value={
                formData.propertyType
              }
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >

              <option value="PLOT">
                Plot (भूखंड)
              </option>

              <option value="HOUSE">
                House (मकान)
              </option>

              <option value="FLAT">
                Flat (फ्लैट)
              </option>

              <option value="COMMERCIAL">
                Commercial Shop / Office (वाणिज्यिक)
              </option>

              <option value="AGRICULTURAL">
                Agricultural Land (कृषि भूमि)
              </option>

              <option value="INDUSTRIAL">
                Industrial Shed / Plot (औद्योगिक)
              </option>

            </select>

          </div>

          <div>

            <label className="block text-xs font-bold text-gray-700 mb-1">
              STATE (ALL INDIA)
            </label>

            <select
              name="stateName"
              value={
                formData.stateName
              }
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >

              {INDIAN_STATES.map(
                (state) => (
                  <option
                    key={state}
                    value={state}
                  >
                    {state}
                  </option>
                )
              )}

            </select>

          </div>

          <div>

            <label className="block text-xs font-bold text-gray-700 mb-1">
              CITY / DISTRICT
            </label>

            <input
              type="text"
              name="cityName"
              value={
                formData.cityName
              }
              onChange={handleChange}
              placeholder="Enter City Name"
              className="w-full p-2.5 border rounded-lg text-sm bg-white uppercase focus:ring-2 focus:ring-blue-500"
              required
            />

          </div>

          <div>

            <label className="block text-xs font-bold text-gray-700 mb-1">
              DEED TYPE
            </label>

            <select
              name="deedType"
              value={
                formData.deedType
              }
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >

              <option value="SALE DEED">
                Sale Deed (विक्रय-पत्र)
              </option>

              <option value="SALE AGREEMENT">
                Sale Agreement (विक्रय अनुबंध)
              </option>

              <option value="GIFT DEED">
                Gift Deed (दान-पत्र)
              </option>

              <option value="CO_OWNERSHIP">
                Co-Ownership Deed (सह-स्वामित्व लेख)
              </option>

              <option value="RELINQUISHMENT DEED">
                Relinquishment Deed (हकत्याग पत्र)
              </option>

            </select>

          </div>

          <div>

            <label className="block text-xs font-bold text-gray-700 mb-1">
              OUTPUT LANGUAGE
            </label>

            <select
              name="outputLanguage"
              value={
                formData.outputLanguage
              }
              onChange={handleChange}
              className="w-full p-2.5 border rounded-lg text-sm bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500"
            >

              <option value="HINDI">
                Hindi (हिंदी)
              </option>

              <option value="ENGLISH">
                English
              </option>

            </select>

          </div>

        </div>

        {/* =====================================================
            SELLERS
        ====================================================== */}

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-3">

          <div className="flex justify-between items-center">

            <h3 className="text-xs font-bold text-slate-800">
              SELLER / VENDOR DETAILS (प्रथम पक्ष)
            </h3>

            <button
              type="button"
              onClick={() =>
                addParty("sellers")
              }
              className="text-xs bg-slate-800 text-white px-3 py-1 rounded-lg hover:bg-slate-700"
            >
              + Add Seller
            </button>

          </div>

          {formData.sellers.map(
            (seller, index) => (

              <div
                key={index}
                className="flex gap-2 items-start bg-white p-3 rounded-lg border"
              >

                <div className="flex-1 space-y-2">

                  <input
                    type="text"
                    placeholder={`Seller ${
                      index + 1
                    } Name`}
                    value={
                      seller.name
                    }
                    onChange={(e) =>
                      handlePartyChange(
                        index,
                        "name",
                        e.target.value,
                        "sellers"
                      )
                    }
                    className="w-full p-2 border rounded-lg text-sm"
                    required
                  />

                  <textarea
                    placeholder={`Seller ${
                      index + 1
                    } Father/Husband Name, Address & Details`}
                    value={
                      seller.details
                    }
                    onChange={(e) =>
                      handlePartyChange(
                        index,
                        "details",
                        e.target.value,
                        "sellers"
                      )
                    }
                    className="w-full p-2 border rounded-lg text-sm h-20"
                  />

                </div>

                {formData.sellers
                  .length > 1 && (

                  <button
                    type="button"
                    onClick={() =>
                      removeParty(
                        index,
                        "sellers"
                      )
                    }
                    className="text-red-600 font-bold px-2"
                  >
                    ×
                  </button>

                )}

              </div>

            )
          )}

        </div>

        {/* =====================================================
            BUYERS
        ====================================================== */}

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-3">

          <div className="flex justify-between items-center">

            <h3 className="text-xs font-bold text-slate-800">
              BUYER / PURCHASER DETAILS (द्वितीय पक्ष)
            </h3>

            <button
              type="button"
              onClick={() =>
                addParty("buyers")
              }
              className="text-xs bg-slate-800 text-white px-3 py-1 rounded-lg hover:bg-slate-700"
            >
              + Add Buyer
            </button>

          </div>

          {formData.buyers.map(
            (buyer, index) => (

              <div
                key={index}
                className="flex gap-2 items-start bg-white p-3 rounded-lg border"
              >

                <div className="flex-1 space-y-2">

                  <input
                    type="text"
                    placeholder={`Buyer ${
                      index + 1
                    } Name`}
                    value={
                      buyer.name
                    }
                    onChange={(e) =>
                      handlePartyChange(
                        index,
                        "name",
                        e.target.value,
                        "buyers"
                      )
                    }
                    className="w-full p-2 border rounded-lg text-sm"
                    required
                  />

                  <textarea
                    placeholder={`Buyer ${
                      index + 1
                    } Father/Husband Name, Address & Details`}
                    value={
                      buyer.details
                    }
                    onChange={(e) =>
                      handlePartyChange(
                        index,
                        "details",
                        e.target.value,
                        "buyers"
                      )
                    }
                    className="w-full p-2 border rounded-lg text-sm h-20"
                  />

                </div>

                {formData.buyers
                  .length > 1 && (

                  <button
                    type="button"
                    onClick={() =>
                      removeParty(
                        index,
                        "buyers"
                      )
                    }
                    className="text-red-600 font-bold px-2"
                  >
                    ×
                  </button>

                )}

              </div>

            )
          )}

        </div>

        {/* =====================================================
            PROPERTY
        ====================================================== */}

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-4">

          <h3 className="text-xs font-bold text-slate-800">
            PROPERTY & MULTI-FLOOR SPECIFICATIONS
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div>

              <label className="block text-xs font-bold text-gray-600 mb-1">
                TOTAL PLOT / LAND AREA (SQ. FT.)
              </label>

              <input
                type="text"
                name="plotArea"
                placeholder="e.g. 1000"
                value={
                  formData.plotArea
                }
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
                required
              />

            </div>

            <div className="md:col-span-2">

              <label className="block text-xs font-bold text-gray-600 mb-1">
                EXACT PROPERTY ADDRESS / LOCATION
              </label>

              <input
                type="text"
                name="propertyAddress"
                placeholder="e.g. कुंदन नगर, ग्राम अहिरखेड़ी, तहसील राऊ, जिला इंदौर"
                value={
                  formData.propertyAddress
                }
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
                required
              />

            </div>

          </div>

          {/* =================================================
              FLOORS
          ================================================== */}

          {formData.propertyType !==
            "PLOT" && (

            <div className="space-y-3 pt-2 border-t border-gray-200">

              <div className="flex justify-between items-center">

                <label className="text-xs font-bold text-blue-700">
                  FLOOR-WISE BUILT-UP AREA
                  (मंजिलवार क्षेत्रफल)
                </label>

                <button
                  type="button"
                  onClick={
                    addFloorItem
                  }
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                >
                  + Add Another Floor
                </button>

              </div>

              {formData.floorsList.map(
                (
                  floor,
                  index
                ) => (

                  <div
                    key={index}
                    className="flex gap-2 items-center bg-white p-3 rounded-lg border border-blue-200"
                  >

                    <div className="flex-1">

                      <input
                        type="text"
                        placeholder="Floor Name"
                        value={
                          floor.floorName
                        }
                        onChange={(
                          e
                        ) =>
                          handleFloorChange(
                            index,
                            "floorName",
                            e.target.value
                          )
                        }
                        className="w-full p-2 border rounded-lg text-sm bg-slate-50"
                        required
                      />

                    </div>

                    <div className="w-40">

                      <input
                        type="text"
                        placeholder="Area (Sq. Ft.)"
                        value={
                          floor.builtUpArea
                        }
                        onChange={(
                          e
                        ) =>
                          handleFloorChange(
                            index,
                            "builtUpArea",
                            e.target.value
                          )
                        }
                        className="w-full p-2 border rounded-lg text-sm"
                        required
                      />

                    </div>

                    {formData
                      .floorsList
                      .length >
                      1 && (

                      <button
                        type="button"
                        onClick={() =>
                          removeFloorItem(
                            index
                          )
                        }
                        className="text-red-600 font-bold px-2 text-lg"
                      >
                        ×
                      </button>

                    )}

                  </div>

                )
              )}

            </div>

          )}

          {/* =================================================
              DOCUMENT + AMOUNT
          ================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            <div>

              <label className="block text-xs font-bold text-gray-600 mb-1">
                PARENT DOCUMENT DETAILS
              </label>

              <input
                type="text"
                name="parentDocument"
                placeholder="e.g. पंजीयन क्रमांक / दिनांक / दस्तावेज विवरण"
                value={
                  formData.parentDocument
                }
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              />

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-600 mb-1">
                CONSIDERATION / TOTAL AGREEMENT AMOUNT (₹)
              </label>

              <input
                type="text"
                name="considerationAmount"
                placeholder="e.g. 10,00,000"
                value={
                  formData.considerationAmount
                }
                onChange={handleChange}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              />

            </div>

          </div>

          {/* =================================================
              SALE AGREEMENT PAYMENT
          ================================================== */}

          {formData.deedType ===
            "SALE AGREEMENT" && (

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">

              <div className="flex items-center justify-between mb-3">

                <h3 className="text-sm font-bold text-blue-800">
                  SALE AGREEMENT PAYMENT DETAILS
                </h3>

                <span className="text-[11px] bg-blue-600 text-white px-2 py-1 rounded">
                  AGREEMENT MODE
                </span>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    BAYANA / ADVANCE AMOUNT (₹)
                  </label>

                  <input
                    type="text"
                    name="bayanaAmount"
                    placeholder="e.g. 2,00,000"
                    value={
                      formData.bayanaAmount
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full p-2.5 border rounded-lg text-sm bg-white"
                  />

                </div>

                <div>

                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    REMAINING AMOUNT (₹)
                  </label>

                  <input
                    type="text"
                    name="remainingAmount"
                    placeholder="e.g. 8,00,000"
                    value={
                      formData.remainingAmount
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full p-2.5 border rounded-lg text-sm bg-white"
                  />

                </div>

                <div>

                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    PAYMENT PERIOD
                  </label>

                  <input
                    type="text"
                    name="paymentPeriod"
                    placeholder="e.g. 3 माह"
                    value={
                      formData.paymentPeriod
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full p-2.5 border rounded-lg text-sm bg-white"
                  />

                </div>

              </div>

            </div>

          )}

        </div>

        {/* =====================================================
            FOUR BOUNDARIES
        ====================================================== */}

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm">

          <h3 className="text-xs font-bold text-slate-800 mb-1">
            FOUR BOUNDARIES (चतुःसीमा)
          </h3>

          <p className="text-[11px] text-gray-500 mb-3">
            * सभी चार दिशाओं में संपत्ति की वास्तविक
            सीमा/रोड/रास्ता/पड़ोसी संपत्ति की जानकारी
            दर्ज करें।
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <input
              type="text"
              name="boundaryEast"
              placeholder="East (पूर्व): e.g. कॉलोनी का रोड"
              value={
                formData.boundaryEast
              }
              onChange={handleChange}
              className="p-2.5 border rounded-lg text-sm bg-white"
              required
            />

            <input
              type="text"
              name="boundaryWest"
              placeholder="West (पश्चिम): e.g. अन्य का मकान"
              value={
                formData.boundaryWest
              }
              onChange={handleChange}
              className="p-2.5 border rounded-lg text-sm bg-white"
              required
            />

            <input
              type="text"
              name="boundaryNorth"
              placeholder="North (उत्तर): e.g. भूखंड क्रमांक 1520"
              value={
                formData.boundaryNorth
              }
              onChange={handleChange}
              className="p-2.5 border rounded-lg text-sm bg-white"
              required
            />

            <input
              type="text"
              name="boundarySouth"
              placeholder="South (दक्षिण): e.g. भूखंड क्रमांक 1518"
              value={
                formData.boundarySouth
              }
              onChange={handleChange}
              className="p-2.5 border rounded-lg text-sm bg-white"
              required
            />

          </div>

        </div>

        {/* =====================================================
            ACTION BUTTONS
        ====================================================== */}

        <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">

          <button
            type="button"
            onClick={
              handleBack
            }
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

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />

            </svg>

            Back to Dashboard

          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">

            <button
              type="button"
              onClick={
                handleReset
              }
              className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm rounded-xl transition-all active:scale-[0.98] text-center"
            >
              CLEAR DATA
            </button>

            <button
              type="submit"
              disabled={
                isGenerating
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >

              {isGenerating ? (
                <>

                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >

                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />

                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />

                  </svg>

                  Saving & Opening Draft...

                </>
              ) : (
                <>

                  GENERATE DRAFTING

                  <span className="text-base">
                    📄
                  </span>

                </>
              )}

            </button>

          </div>

        </div>

      </form>

    </div>
  );
}