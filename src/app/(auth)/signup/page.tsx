'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import emailjs from '@emailjs/browser';

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [agreeTermsPolicy, setAgreeTermsPolicy] = useState(false); 
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false); // <--- New state to track if terms modal was opened

  const INDIAN_STATES_AND_DISTRICTS: { [key: string]: string[] } = {
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

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    userType: 'INDIVIDUAL',
    planType: 'BASIC PLAN',
    firmName: '',
    city: '',
    state: '',
    otp: '',
  });

  const [credentials, setCredentials] = useState({
    userId: '',
    password: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    
    if (name === 'mobile') {
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setForm({ ...form, mobile: numericValue });
    } else if (name === 'userType') {
      if (value === 'INDIVIDUAL') {
        setForm({ ...form, userType: value, planType: 'BASIC PLAN' });
      } else {
        setForm({ ...form, userType: value });
      }
    } else if (name === 'password' || name === 'email') {
      setForm({ ...form, [name]: value });
    } else {
      setForm({ ...form, [name]: value.toUpperCase() });
    }
  };

  const sendOtp = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!/^\d{10}$/.test(form.mobile)) {
      setError("Please enter a valid 10-digit mobile number!");
      setLoading(false);
      return;
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: otpError } = await supabase.from('otps').insert([{ email: form.email, otp_code: generatedOtp }]);
    
    if (otpError) {
      setError("Database error, try again.");
      setLoading(false);
      return;
    }

    emailjs.send(
      'service_g8hpevj',
      'template_4sqme4r',
      {
        to_email: form.email,
        otp_code: generatedOtp,
      }, 
      'grxZ-VWExc0FNxr5n'
    )
    .then(() => {
      alert("OTP has been sent to your email!");
      setStep(2);
      setLoading(false);
    })
    .catch((err) => {
      setError("Failed to send email!");
      setLoading(false);
    });
  };
  
  const verifyOtp = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: dbError } = await supabase
      .from('otps')
      .select('otp_code')
      .eq('email', form.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError || data.otp_code !== form.otp) {
      setError('Invalid OTP! Please try again.');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setError('User session not found');
      setLoading(false);
      return;
    }

    const generatedUserId = 'LNT-' + Math.floor(100000 + Math.random() * 900000);
    const isPremium = form.planType === 'PREMIUM PLAN';

    const { error: profileError } = await supabase.from('profiles').insert([
      {
        id: user.id,
        full_name: form.fullName,
        mobile: form.mobile,
        email: form.email.toLowerCase(),
        user_type: form.userType,
        plan_type: form.planType,
        firm_name: form.userType !== 'INDIVIDUAL' ? form.firmName : null,
        city: form.city,
        state: form.state,
        user_code: generatedUserId,
        status: isPremium ? 'PENDING' : 'active',
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      },
    ]);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setCredentials({ userId: generatedUserId, password: form.password });
    setStep(3);
    setLoading(false);
  };

  if (!mounted) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 text-xs tracking-widest font-mono">LOADING GATEWAY...</div>;
  }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white overflow-hidden relative">

      {/* MARQUEE TEXT */}
      <div className="w-full bg-white/5 border-b border-white/10 overflow-hidden relative z-10 flex items-center justify-center">
        <div className="w-full overflow-hidden">
          <div className="inline-block whitespace-nowrap animate-[scrollLeft_25s_linear_infinite] text-sm md:text-base font-bold text-slate-200 py-3 text-center w-full">
            <span>
              Welcome to <span className="text-yellow-400 font-black">Legal n Tech Consultants</span> • Delivering Fast, Secure & Quality-Driven Legal & Construction Solutions 24x365
            </span>
          </div>
        </div>
      </div>

      {/* BACK BUTTON */}
      <div className="absolute top-14 left-4 z-50">
        <Link
          href="/login"
          className="px-4 py-2 text-xs font-bold uppercase rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition"
        >
          ← Back Login
        </Link>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="flex flex-1 items-center justify-between p-6 gap-6">

        {/* LEFT PANEL */}
        <div className="hidden lg:flex flex-1 flex-col justify-center p-6">
          <h2 className="text-yellow-400 font-black text-base mb-5 text-center tracking-widest">
            SERVICES PANEL
          </h2>
          <div className="space-y-4 leading-7 font-medium text-slate-300">
            <p>⚡ Construction Estimate System</p>
            <p>⚡ Client ERP Management</p>
            <p>⚡ Legal Documentation Engine</p>
            <p>⚡ Route Map System</p>
            <p>⚡ MIS Reporting Dashboard</p>
            <p>⚡ Property Valuation System</p>
          </div>
        </div>

        {/* CENTER PANEL (FORM CONTAINER) */}
        <div className="w-full max-w-md bg-white text-black rounded-2xl shadow-2xl p-6">
          <h1 className="text-2xl font-black text-blue-900 text-center uppercase tracking-tight">
            LnT SIGNUP PORTAL
          </h1>
          <p className="text-xs text-center text-gray-500 mb-4 font-bold tracking-wider">
            ACCOUNT REGISTRATION FORM
          </p>

          {error && (
            <div className="bg-red-100 text-red-700 text-xs p-2.5 border border-red-200 rounded mb-3 font-semibold uppercase">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <form onSubmit={sendOtp} className="space-y-3">
              <input name="fullName" required placeholder="FULL NAME" value={form.fullName} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase" />
              <input name="mobile" required type="tel" maxLength={10} placeholder="MOBILE NUMBER" value={form.mobile} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />
              <input name="email" required type="email" placeholder="EMAIL ADDRESS" value={form.email} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />
              <input name="password" required type="password" placeholder="PASSWORD" value={form.password} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />

              {/* STATE & CITY SEARCHABLE DROPDOWN (STATE FIRST) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    name="state"
                    required
                    placeholder="STATE"
                    value={form.state}
                    onChange={handleChange}
                    list="all-states-list"
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase bg-white"
                  />
                  <datalist id="all-states-list">
                    {Object.keys(INDIAN_STATES_AND_DISTRICTS).map((stateName) => (
                      <option key={stateName} value={stateName} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="CITY / DISTRICT"
                    value={form.city}
                    onChange={handleChange}
                    list="all-districts-list"
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase bg-white"
                  />
                  <datalist id="all-districts-list">
                    {form.state && INDIAN_STATES_AND_DISTRICTS[form.state.toUpperCase()] ? (
                      INDIAN_STATES_AND_DISTRICTS[form.state.toUpperCase()].map((district) => (
                        <option key={`${district}-${form.state}`} value={district} />
                      ))
                    ) : (
                      Object.entries(INDIAN_STATES_AND_DISTRICTS).flatMap(([stateName, districts]) =>
                        districts.map((district) => (
                          <option key={`${district}-${stateName}`} value={district} />
                        ))
                      )
                    )}
                  </datalist>
                </div>
              </div>

{/* USER CATEGORY DROPDOWN */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Select User Category</label>
      <select name="userType" value={form.userType} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold bg-white text-slate-800">
        <option value="BANKER">BANKER</option>
        <option value="ENGINEER">ENGINEER</option>
        <option value="ARCHITECT">ARCHITECT</option>
        <option value="VALUER">VALUER</option>
        <option value="DSA">DSA</option>
        <option value="INDIVIDUAL">INDIVIDUAL USER</option>
      </select>
    </div>

    {/* DYNAMIC FIRM / BANK NAME */}
    {form.userType !== 'INDIVIDUAL' && (
      <div className="space-y-1">
        <label className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
          {form.userType === 'BANKER' ? 'Current Bank Name *' : 'Registered Firm Name *'}
        </label>
        <input
          name="firmName"
          required
          placeholder={form.userType === 'BANKER' ? 'ENTER CURRENT BANK NAME' : 'ENTER YOUR FIRM NAME'}
          value={form.firmName}
          onChange={handleChange}
          className="w-full border-2 border-blue-100 p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold uppercase bg-blue-50/30"
        />
      </div>
    )}

              {/* ENGINE PLAN DROPDOWN */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Choose Engine Plan</label>
                <select name="planType" value={form.planType} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold bg-white text-slate-800">
                  <option value="BASIC PLAN">BASIC PLAN</option>
                  {form.userType !== 'INDIVIDUAL' && (
                    <option value="PREMIUM PLAN">PREMIUM PLAN</option>
                  )}
                </select>
              </div>

              {/* LEGAL COMPLIANCE & PLATFORM RULES WITH MODAL POPUP BUTTON */}
              <div className="space-y-2 mt-2 pt-2 border-t border-slate-200">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">
                  Platform Terms & Operational Guidelines *
                </label>

                <div className="flex items-center justify-between p-2.5 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[11px] font-bold text-slate-700">
                    {hasViewedTerms ? "✅ Terms Viewed & Verified" : "⚠️ Please read terms to unlock checkbox"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHasViewedTerms(true); // Unlock checkbox when modal is opened
                      setShowTermsModal(true);
                    }}
                    className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold rounded shadow transition uppercase cursor-pointer"
                  >
                    View Terms
                  </button>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input 
                    type="checkbox" 
                    id="termsPolicy" 
                    required
                    disabled={!hasViewedTerms} // <--- Disabled until terms are viewed
                    checked={agreeTermsPolicy} 
                    onChange={(e) => setAgreeTermsPolicy(e.target.checked)} 
                    className={`mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-900 focus:ring-blue-800 ${!hasViewedTerms ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                  <label htmlFor="termsPolicy" className={`text-[11px] font-bold leading-tight ${!hasViewedTerms ? 'text-gray-400 cursor-not-allowed' : 'text-slate-900 cursor-pointer'}`}>
                    I have read, understood, and unconditionally agree to all the Platform Terms, Wallet Balance Rules, and Operational Guidelines stated above.
                  </label>
                </div>
              </div>

              <button 
                type="button"
                onClick={sendOtp}
                disabled={!agreeTermsPolicy || loading} 
                className={`w-full py-2.5 rounded font-bold transition uppercase tracking-wider text-sm mt-2 ${
                  !agreeTermsPolicy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800 cursor-pointer'
                } text-white`}
              >
                {loading ? 'SENDING OTP...' : 'SEND OTP'}
              </button>
            </form>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={verifyOtp} className="space-y-3">
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-2 rounded text-center font-bold">
                OTP SENT SUCCESSFULLY (Demo: 123456)
              </div>

              <input
                name="otp"
                required
                maxLength={6}
                placeholder="ENTER 6-DIGIT OTP"
                value={form.otp}
                onChange={handleChange}
                className="w-full border-2 p-2 rounded text-center tracking-widest font-black text-xl text-slate-800 focus:ring-2 focus:ring-green-600"
              />

              <button className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded font-bold transition uppercase tracking-wider text-sm">
                {loading ? 'VERIFYING...' : 'VERIFY OTP'}
              </button>
            </form>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center space-y-2">
              <div className="text-green-600 text-5xl font-bold animate-bounce">✓</div>
              <h2 className="font-black text-blue-900 tracking-tight text-lg">
                {form.planType === 'PREMIUM PLAN' ? 'REGISTRATION SUBMITTED FOR APPROVAL' : 'ACCOUNT CREATED SUCCESSFULLY'}
              </h2>

              {form.planType === 'PREMIUM PLAN' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl font-medium text-left">
                  ⚠️ You have selected the <b>Premium Plan</b>. Your account status is currently set to <b>Pending Admin Approval</b>. You will be able to log in once the admin reviews and authorizes your profile.
                </div>
              )}

              <div className="bg-gray-100 p-4 rounded-xl mt-3 text-left text-xs font-mono border border-gray-200 space-y-1">
                <p><b>SYSTEM ID :</b> <span className="text-blue-900 font-bold">{credentials.userId}</span></p>
                <p><b>PASSWORD  :</b> <span className="text-slate-800 font-bold">{credentials.password}</span></p>
                <p><b>CATEGORY  :</b> <span className="text-slate-800 font-bold">{form.userType}</span></p>
                <p><b>LOCATION  :</b> <span className="text-slate-800 font-bold">{form.city}, {form.state}</span></p>
                <p><b>PLAN TYPE :</b> <span className="text-slate-800 font-bold">{form.planType}</span></p>
                {form.userType !== 'INDIVIDUAL' && <p><b>FIRM NAME :</b> <span className="text-slate-800 font-bold">{form.firmName}</span></p>}
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full mt-4 bg-blue-900 hover:bg-blue-800 text-white py-2.5 rounded font-bold transition uppercase text-sm tracking-wider"
              >
                GO TO LOGIN
              </button>
            </div>
          )}

        </div>

        {/* RIGHT PANEL - OFFER & LAUNCHING DETAILS */}
        <div className="hidden lg:flex flex-1 flex-col justify-center p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl backdrop-blur-sm">
          <h2 className="text-yellow-400 font-black text-base mb-4 text-center tracking-widest uppercase">
            ⚡ Special Launching Offer ⚡
          </h2>

          <div className="space-y-4 text-sm font-semibold">
            <div className="bg-white/10 p-3 rounded-lg border border-yellow-400/30 flex flex-col gap-1">
              <div className="flex justify-between items-center text-yellow-300 font-black">
                <span>🚀 ESTIMATE ENGINE OFFER</span>
                <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 rounded text-xs font-black">₹21 ONLY</span>
              </div>
              <p className="text-xs text-slate-200 font-normal">Get instant construction & technical estimates at an unbeatable launching price of just ₹21!</p>
            </div>

            <div className="bg-white/10 p-3 rounded-lg border border-yellow-400/30 flex flex-col gap-1">
              <div className="flex justify-between items-center text-green-400 font-black">
                <span>📄 FREE DRAFTING SERVICES</span>
                <span className="bg-green-500 text-slate-950 px-2 py-0.5 rounded text-xs font-black">FREE</span>
              </div>
              <p className="text-xs text-slate-200 font-normal">Complimentary document drafting included with your selected plans during the launch period.</p>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2">Upcoming Services Pipeline:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-medium">
                <div className="bg-black/20 p-2 rounded border border-white/5">📍 Location Plan</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">📊 Work Plan</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">🏗️ Extension Est.</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">🔨 Renovation Est.</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* TERMS & CONDITIONS POPUP MODAL WINDOW */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-wider">Platform Terms & Operational Guidelines</h3>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-white hover:text-red-400 font-bold text-lg px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-900">Welcome to Our Platform</p>
              <p>Please read these terms and conditions carefully before proceeding to login. By accessing and using our platform, you agree to abide by the following operational rules and guidelines:</p>

              <div className="space-y-1">
                <p className="font-bold text-blue-900 uppercase">1. Wallet Balance & Account Status</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Minimum Balance Requirement:</b> Users must maintain a minimum wallet balance of <b>₹100</b> at all times to ensure uninterrupted access to all platform features and services.</li>
                  <li><b>Low Balance Restrictions:</b> If your wallet balance falls below ₹100, certain active features will be restricted. However, you will still retain access to view and print your previously generated estimates and review your old cases.</li>
                  <li><b>Account Deactivation Policy:</b> If the wallet balance remains below the required minimum and no activity or top-up is recorded for <b>60 days</b>, the account will be temporarily suspended, and estimates older than 60 days will no longer be accessible for opening or editing.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-blue-900 uppercase">2. Service & Estimate Guidelines</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Activity Requirement:</b> Generate at least <b>1 estimate every 2 months</b> to keep your account fully active and operational. Failure to meet this requirement may lead to account suspension.</li>
                  <li><b>Editing Limits:</b> For every standard service package (including estimates, drafting, mapping, and other allied services), users are permitted a maximum of <b>3 free edits</b>.</li>
                  <li><b>Additional Revisions:</b> Any modifications or edits requested after exhausting the initial 3 revisions will incur standard additional charges for a new request.</li>
                  <li><b>Name & Address Correction Policy:</b> Only <b>minor typographical or spelling corrections</b> are permitted in the Name and Address fields. Substantial changes to identity details are not allowed once submitted.</li>
                </ul>
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-200">
                <p className="font-bold text-slate-900 uppercase">Support & Assistance</p>
                <p>If you encounter any technical issues, platform errors, or require clarification regarding your wallet balance or account status, please feel free to contact our Administrator Support Team at:</p>
                <p className="font-bold text-blue-900">Helpline / WhatsApp: 7987561396</p>
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgreeTermsPolicy(true);
                  setShowTermsModal(false);
                }}
                className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Agree & Close
              </button>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}