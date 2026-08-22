export const ALL_INDIA_STATES = [
  { name: "MADHYA PRADESH", code: "MP", defaultLanguage: "HINDI" },
  { name: "MAHARASHTRA", code: "MH", defaultLanguage: "ENGLISH" },
  { name: "UTTAR PRADESH", code: "UP", defaultLanguage: "HINDI" },
  { name: "RAJASTHAN", code: "RJ", defaultLanguage: "HINDI" },
  { name: "GUJARAT", code: "GJ", defaultLanguage: "ENGLISH" },
  { name: "DELHI", code: "DL", defaultLanguage: "ENGLISH" },
  { name: "KARNATAKA", code: "KA", defaultLanguage: "ENGLISH" },
];

export const getDistrictsByState = (stateName: string) => {
  switch (stateName) {
    case "MADHYA PRADESH":
      return ["INDORE", "BHOPAL", "UJJAIN", "GWALIOR", "JABALPUR", "SAGAR", "DEWAS"];
    case "MAHARASHTRA":
      return ["MUMBAI", "PUNE", "NAGPUR", "THANE", "NASHIK", "AURANGABAD"];
    case "UTTAR PRADESH":
      return ["LUCKNOW", "KANPUR", "VARANASI", "AGRA", "MEERUT", "PRAYAGRAJ"];
    default:
      return ["DISTRICT HEADQUARTER"];
  }
};