'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const INDIAN_STATES_AND_DISTRICTS: { [key: string]: string[] } = {
  "ANDHRA PRADESH": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "BIHAR": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "DELHI": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "GUJARAT": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "MADHYA PRADESH": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  "MAHARASHTRA": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "RAJASTHAN": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "UTTAR PRADESH": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Badaun", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  "WEST BENGAL": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
};

export default function AdminCreateUserWidget({ onUserCreated }: { onUserCreated: () => void }) {
  const [newUser, setNewUser] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    userType: 'VALUER',
    planType: 'PREMIUM PLAN',
    firmName: '',
    city: '',
    state: '',
    walletBonus: '500'
  });
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setNewUser({ ...newUser, mobile: numericValue });
    } else if (name === 'password' || name === 'email') {
      setNewUser({ ...newUser, [name]: value });
    } else {
      setNewUser({ ...newUser, [name]: value.toUpperCase() });
    }
  };

  const handleCreatePremiumUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.fullName || !newUser.password) {
      alert('Please fill in Email, Full Name, and Password.');
      return;
    }

    if (!/^\d{10}$/.test(newUser.mobile)) {
      alert("Please enter a valid 10-digit mobile number!");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (authError) {
        alert(authError.message);
        setLoading(false);
        return;
      }

      const user = authData.user;
      if (!user) {
        alert('Failed to create authentication user.');
        setLoading(false);
        return;
      }

      const generatedUserId = 'LNT-' + Math.floor(100000 + Math.random() * 900000);

      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          full_name: newUser.fullName,
          mobile: newUser.mobile,
          email: newUser.email.toLowerCase(),
          user_type: newUser.userType,
          role: 'premium',
          plan_type: newUser.planType,
          firm_name: newUser.userType !== 'INDIVIDUAL' ? newUser.firmName : null,
          city: newUser.city,
          state: newUser.state,
          user_code: generatedUserId,
          status: 'active',
          wallet_balance: Number(newUser.walletBonus || 0),
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        },
      ]);

      if (profileError) {
        alert(profileError.message);
        setLoading(false);
        return;
      }

      alert(`Successfully created Premium Account for ${newUser.email}! System ID: ${generatedUserId}`);
      setNewUser({
        fullName: '',
        mobile: '',
        email: '',
        password: '',
        userType: 'VALUER',
        planType: 'PREMIUM PLAN',
        firmName: '',
        city: '',
        state: '',
        walletBonus: '500'
      });
      onUserCreated();
    } catch (err: any) {
      alert('Error creating premium user: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 my-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-base">👑 Create Manual User / Premium Account</h3>
          <p className="text-xs text-slate-500">Manually provision a fully configured user profile with State, City, Plan, and Wallet Bonus.</p>
        </div>
        <button 
          onClick={() => setShowPanel(!showPanel)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          {showPanel ? 'Hide [-]' : 'Show [+]'}
        </button>
      </div>

      {showPanel && (
        <form onSubmit={handleCreatePremiumUser} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Name *</label>
              <input 
                type="text" 
                name="fullName"
                placeholder="RAJESH SHARMA" 
                value={newUser.fullName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mobile Number (10 Digits) *</label>
              <input 
                type="tel" 
                name="mobile"
                maxLength={10}
                placeholder="9876543210" 
                value={newUser.mobile}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address *</label>
              <input 
                type="email" 
                name="email"
                placeholder="client@example.com" 
                value={newUser.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Password *</label>
              <input 
                type="password" 
                name="password"
                placeholder="********" 
                value={newUser.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">State *</label>
              <input 
                type="text" 
                name="state" 
                required 
                placeholder="SELECT OR TYPE STATE" 
                value={newUser.state} 
                onChange={handleInputChange} 
                list="admin-states-list" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500" 
              />
              <datalist id="admin-states-list">
                {Object.keys(INDIAN_STATES_AND_DISTRICTS).map((s) => (<option key={s} value={s} />))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">City / District *</label>
              <input 
                type="text" 
                name="city" 
                required 
                placeholder="SELECT OR TYPE CITY" 
                value={newUser.city} 
                onChange={handleInputChange} 
                list="admin-districts-list" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500" 
              />
              <datalist id="admin-districts-list">
                {newUser.state && INDIAN_STATES_AND_DISTRICTS[newUser.state.toUpperCase()] && 
                  INDIAN_STATES_AND_DISTRICTS[newUser.state.toUpperCase()].map((d) => (<option key={d} value={d} />))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">User Category</label>
              <select 
                name="userType" 
                value={newUser.userType} 
                onChange={handleInputChange} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="BANKER">BANKER</option>
                <option value="ENGINEER">ENGINEER</option>
                <option value="ARCHITECT">ARCHITECT</option>
                <option value="VALUER">VALUER</option>
                <option value="DSA">DSA</option>
                <option value="INDIVIDUAL">INDIVIDUAL USER</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Plan Type (Default Premium)</label>
              <select 
                name="planType" 
                value={newUser.planType} 
                onChange={handleInputChange} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="PREMIUM PLAN">PREMIUM PLAN</option>
                <option value="BASIC ENGINE PLAN">BASIC ENGINE PLAN</option>
              </select>
            </div>
          </div>

          {newUser.userType !== 'INDIVIDUAL' && (
            <div>
              <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Registered Firm Name *</label>
              <input 
                name="firmName" 
                required 
                placeholder="ENTER FIRM NAME" 
                value={newUser.firmName} 
                onChange={handleInputChange} 
                className="w-full px-3 py-2 bg-purple-50/40 border border-purple-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500" 
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Initial Wallet Bonus (₹)</label>
            <input 
              type="number" 
              name="walletBonus"
              value={newUser.walletBonus}
              onChange={handleInputChange}
              className="w-full sm:w-1/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm uppercase tracking-wider"
          >
            {loading ? 'Creating Account...' : '👑 Create Manual User / Premium Account Now'}
          </button>
        </form>
      )}
    </div>
  );
}