'use client';

import { useState, useMemo } from 'react';
import { UserPlus, X, Mail, Lock, Eye, EyeOff, Building, ShieldCheck, MessageSquareShare, MapPin, CreditCard } from 'lucide-react';

const INDIAN_STATES_AND_DISTRICTS: Record<string, string[]> = {
  "ANDHRA PRADESH": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "ARUNACHAL PRADESH": ["Tawang", "West Kameng", "East Kameng", "Papum Pare", "Kurung Kumey", "Kra Daadi", "Lower Subansiri", "Upper Subansiri", "West Siang", "East Siang", "Siang", "Upper Siang", "Lower Siang", "Lower Dibang Valley", "Dibang Valley", "Anjaw", "Lohang", "Namsai", "Changlang", "Tirap", "Longding"],
  "ASSAM": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Dima Hasao", "Sivasagar", "Sonitpur", "Tinsukia", "Udalguri", "West Karbi Anglong"],
  "BIHAR": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "CHHATTISGARH": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Janjgir-Champa", "Jashpur", "Kanker", "Kawardha", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja"],
  "GOA": ["North Goa", "South Goa"],
  "GUJARAT": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "HARYANA": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Narnaul", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  "HIMACHAL PRADESH": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  "JHARKHAND": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"],
  "KARNATAKA": ["Bagalkot", "Bangalore Rural", "Bangalore Urban", "Belgaum", "Bellary", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Gulbarga", "Hassan", "Haveri", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysore", "Raichur", "Ramanagara", "Shimoga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"],
  "KERALA": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  "MADHYA PRADESH": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  "MAHARASHTRA": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "MANIPUR": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
  "MEGHALAYA": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
  "MIZORAM": ["Aizawl", "Champhai", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Serchhip"],
  "NAGALAND": ["Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Peren", "Phek", "Tuensang", "Wokha", "Zunheboto"],
  "ODISHA": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  "PUNJAB": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Firozpur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "SAS Nagar", "Shaheed Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
  "RAJASTHAN": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "SIKKIM": ["Gangtok", "Mangan", "Namchi", "Gyalshing", "Pakyong", "Soreng"],
  "TAMIL NADU": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
  "TELANGANA": ["Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashanker Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal–Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
  "TRIPURA": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  "UTTAR PRADESH": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Badaun", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  "UTTARAKHAND": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
  "WEST BENGAL": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
};

interface AddUserModalProps {
  partnerProfile: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUserModal({ partnerProfile, onClose, onSuccess }: AddUserModalProps) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserType, setNewUserType] = useState('INDIVIDUAL');
  const [newUserFirmName, setNewUserFirmName] = useState('');
  const [newUserState, setNewUserState] = useState('');
  const [newUserCity, setNewUserCity] = useState('');
  const [newUserAddress, setNewUserAddress] = useState('');
  const [newUserAadhaar, setNewUserAadhaar] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdUserPayload, setCreatedUserPayload] = useState<any>(null);

  const availableCities = useMemo(() => {
    if (!newUserState) return [];
    return INDIAN_STATES_AND_DISTRICTS[newUserState.toUpperCase()] || [];
  }, [newUserState]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    setFormError('');

    if (!partnerProfile) {
      setFormError('PARTNER SESSION INVALID.');
      setSubmittingUser(false);
      return;
    }

    try {
      const generatedUserCode = 'LNT-' + Math.floor(100000 + Math.random() * 900000);
      const partnerUserCode = partnerProfile?.profiles?.user_code || partnerProfile.partner_id;

      // API Route endpoint call
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail.toLowerCase(),
          password: newUserPassword,
          profileData: {
            full_name: newUserName.toUpperCase(),
            mobile: newUserMobile,
            email: newUserEmail.toLowerCase(),
            address: newUserAddress.toUpperCase(),
            aadhaar_no: newUserAadhaar,
            user_type: newUserType,
            plan_type: 'BASIC PLAN',
            firm_name: newUserType !== 'INDIVIDUAL' ? newUserFirmName.toUpperCase() : null,
            city: newUserCity.toUpperCase(),
            state: newUserState.toUpperCase(),
            user_code: generatedUserCode,
            referred_by: partnerUserCode,
            partner_id: partnerProfile.partner_id,
            status: 'active',
            role: 'user',
            terms_accepted: false,
            terms_accepted_at: null,
            created_at: new Date().toISOString(),
          },
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || 'FAILED TO CREATE USER ACCOUNT.');
      }

      setCreatedUserPayload({
        name: newUserName.toUpperCase(),
        code: generatedUserCode,
        email: newUserEmail.toLowerCase(),
        mobile: newUserMobile,
        password: newUserPassword,
      });

      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'SOMETHING WENT WRONG WHILE CREATING USER.');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleShareToWhatsApp = () => {
    if (!createdUserPayload) return;
    const { name, code, email, mobile, password } = createdUserPayload;
    const textMessage = `Hello ${name},\n\nYour account has been successfully created on our portal!\n\n📌 *ACCOUNT DETAILS:*\n• *User Code:* ${code}\n• *Email:* ${email}\n• *Password:* ${password}\n\n🔗 *Login URL:* ${window.location.origin}/login\n\nThank you for choosing us!`;
    const encodedMsg = encodeURIComponent(textMessage);
    const cleanMobile = mobile.replace(/\D/g, '');
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    window.open(`https://wa.me/${formattedMobile}?text=${encodedMsg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 uppercase">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
            <UserPlus size={16} /> DIRECT ADD USER
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {!createdUserPayload ? (
          <form onSubmit={handleAddUserSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 text-xs p-2.5 rounded-xl font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">FULL NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="FULL NAME"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">MOBILE NUMBER *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-DIGIT MOBILE"
                  value={newUserMobile}
                  onChange={(e) => setNewUserMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Mail size={12} className="text-indigo-400" /> EMAIL ADDRESS *
                </label>
                <input
                  type="email"
                  required
                  placeholder="EMAIL ADDRESS"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Lock size={12} className="text-indigo-400" /> PASSWORD *
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    required
                    placeholder="ASSIGN PASSWORD"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full p-2.5 pr-9 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewUserPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <CreditCard size={12} className="text-indigo-400" /> AADHAAR NUMBER *
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  placeholder="12-DIGIT AADHAAR NUMBER"
                  value={newUserAadhaar}
                  onChange={(e) => setNewUserAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-indigo-400" /> FULL ADDRESS *
                </label>
                <input
                  type="text"
                  required
                  placeholder="STREET / HOUSE NO. / LOCALITY"
                  value={newUserAddress}
                  onChange={(e) => setNewUserAddress(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">STATE *</label>
                <select
                  required
                  value={newUserState}
                  onChange={(e) => {
                    setNewUserState(e.target.value);
                    setNewUserCity('');
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                >
                  <option value="">SELECT STATE</option>
                  {Object.keys(INDIAN_STATES_AND_DISTRICTS).map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">DISTRICT / CITY *</label>
                <select
                  required
                  disabled={!newUserState}
                  value={newUserCity}
                  onChange={(e) => setNewUserCity(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{newUserState ? 'SELECT CITY' : 'FIRST SELECT STATE'}</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city.toUpperCase()}>
                      {city.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">USER TYPE</label>
                <select
                  value={newUserType}
                  onChange={(e) => setNewUserType(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                >
                  <option value="INDIVIDUAL">INDIVIDUAL USER</option>
                  <option value="BANKER">BANKER</option>
                  <option value="ENGINEER">ENGINEER</option>
                  <option value="ARCHITECT">ARCHITECT</option>
                  <option value="VALUER">VALUER</option>
                  <option value="DSA">DSA</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">PLAN TYPE</label>
                <select
                  disabled
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-amber-400 font-bold focus:outline-none cursor-not-allowed"
                >
                  <option value="BASIC PLAN">BASIC PLAN</option>
                </select>
              </div>
            </div>

            {newUserType !== 'INDIVIDUAL' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                  <Building size={12} className="text-indigo-400" /> FIRM / BANK NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="FIRM OR BANK NAME"
                  value={newUserFirmName}
                  onChange={(e) => setNewUserFirmName(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={submittingUser}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5"
              >
                {submittingUser ? 'CREATING...' : 'CREATE ACCOUNT NOW →'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-2xl w-fit mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">USER ACCOUNT CREATED SUCCESSFULLY!</h4>
              <p className="text-xs text-slate-400 mt-1">Direct Auth & Profile created. Terms approval pending for first login.</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-left space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">NAME:</span>
                <span className="text-white font-bold">{createdUserPayload.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">USER CODE:</span>
                <span className="text-indigo-400 font-bold">{createdUserPayload.code}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">EMAIL:</span>
                <span className="text-slate-200">{createdUserPayload.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">MOBILE:</span>
                <span className="text-slate-200">{createdUserPayload.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PASSWORD:</span>
                <span className="text-amber-400 font-bold">{createdUserPayload.password}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={handleShareToWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageSquareShare size={16} /> SHARE CREDENTIALS VIA WHATSAPP
              </button>
              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs"
              >
                DONE & CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}