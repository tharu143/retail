import React, { useState, useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import {
  Save, ChevronLeft, Loader2, User, AlertCircle, ShieldCheck,
  ShoppingCart, Receipt, Package, DollarSign, Clock, Percent,
  Globe, Mail, Phone, ImageIcon
, AlertOctagon, Snowflake, X } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../hooks/useLegacyTheme';
import './CustomerEditPage.css';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

const countryPhoneCodes = {
  'afghanistan': '+93', 'aland islands': '+358', 'albania': '+355', 'algeria': '+213', 'american samoa': '+1', 'andorra': '+376', 'angola': '+244', 'anguilla': '+1', 'antarctica': '+672', 'antigua and barbuda': '+1', 'argentina': '+54', 'armenia': '+374', 'aruba': '+297', 'australia': '+61', 'austria': '+43', 'azerbaijan': '+994', 'bahamas': '+1', 'bahrain': '+973', 'bangladesh': '+880', 'barbados': '+1', 'belarus': '+375', 'belgium': '+32', 'belize': '+501', 'benin': '+229', 'bermuda': '+1', 'bhutan': '+975', 'bolivia': '+591', 'bonaire': '+599', 'bosnia and herzegovina': '+387', 'botswana': '+267', 'bouvet island': '+47', 'brazil': '+55', 'british indian ocean territory': '+246', 'british virgin islands': '+1', 'brunei': '+673', 'bulgaria': '+359', 'burkina faso': '+226', 'burundi': '+257', 'cambodia': '+855', 'cameroon': '+237', 'canada': '+1', 'cape verde': '+238', 'cayman islands': '+1', 'central african republic': '+236', 'chad': '+235', 'chile': '+56', 'china': '+86', 'christmas island': '+61', 'cocos islands': '+61', 'colombia': '+57', 'comoros': '+269', 'cook islands': '+682', 'costa rica': '+506', 'croatia': '+385', 'cuba': '+53', 'curacao': '+599', 'cyprus': '+357', 'czech republic': '+420', 'czechia': '+420', 'democratic republic of the congo': '+243', 'denmark': '+45', 'djibouti': '+253', 'dominica': '+1', 'dominican republic': '+1', 'ecuador': '+593', 'egypt': '+20', 'el salvador': '+503', 'equatorial guinea': '+240', 'eritrea': '+291', 'estonia': '+372', 'eswatini': '+268', 'ethiopia': '+251', 'falkland islands': '+500', 'faroe islands': '+298', 'fiji': '+679', 'finland': '+358', 'france': '+33', 'french guiana': '+594', 'french polynesia': '+689', 'french southern territories': '+262', 'gabon': '+241', 'gambia': '+220', 'georgia': '+995', 'germany': '+49', 'ghana': '+233', 'gibraltar': '+350', 'greece': '+30', 'greenland': '+299', 'grenada': '+1', 'guadeloupe': '+590', 'guam': '+1', 'guatemala': '+502', 'guernsey': '+44', 'guinea': '+224', 'guinea-bissau': '+245', 'guyana': '+592', 'haiti': '+509', 'heard island and mcdonald islands': '+672', 'honduras': '+504', 'hong kong': '+852', 'hungary': '+36', 'iceland': '+354', 'india': '+91', 'indonesia': '+62', 'iran': '+98', 'iraq': '+964', 'ireland': '+353', 'isle of man': '+44', 'israel': '+972', 'italy': '+39', 'ivory coast': '+225', 'jamaica': '+1', 'japan': '+81', 'jersey': '+44', 'jordan': '+962', 'kazakhstan': '+7', 'kenya': '+254', 'kiribati': '+686', 'kosovo': '+383', 'kuwait': '+965', 'kyrgyzstan': '+996', 'laos': '+856', 'latvia': '+371', 'lebanon': '+961', 'lesotho': '+266', 'liberia': '+231', 'libya': '+218', 'liechtenstein': '+423', 'lithuania': '+370', 'luxembourg': '+352', 'macao': '+853', 'madagascar': '+261', 'malawi': '+265', 'malaysia': '+60', 'maldives': '+960', 'mali': '+223', 'malta': '+356', 'marshall islands': '+692', 'martinique': '+596', 'mauritania': '+222', 'mauritius': '+230', 'mayotte': '+262', 'mexico': '+52', 'micronesia': '+691', 'moldova': '+373', 'monaco': '+377', 'mongolia': '+976', 'montenegro': '+382', 'montserrat': '+1', 'morocco': '+212', 'mozambique': '+258', 'myanmar': '+95', 'namibia': '+264', 'nauru': '+674', 'nepal': '+977', 'netherlands': '+31', 'new caledonia': '+687', 'new zealand': '+64', 'nicaragua': '+505', 'niger': '+227', 'nigeria': '+234', 'niue': '+683', 'norfolk island': '+672', 'north korea': '+850', 'north macedonia': '+389', 'northern mariana islands': '+1', 'norway': '+47', 'oman': '+968', 'pakistan': '+92', 'palau': '+680', 'palestine': '+970', 'panama': '+507', 'papua new guinea': '+675', 'paraguay': '+595', 'peru': '+51', 'philippines': '+63', 'pitcairn': '+64', 'poland': '+48', 'portugal': '+351', 'puerto rico': '+1', 'qatar': '+974', 'republic of the congo': '+242', 'reunion': '+262', 'romania': '+40', 'russia': '+7', 'rwanda': '+250', 'saint barthelemy': '+590', 'saint helena': '+290', 'saint kitts and nevis': '+1', 'saint lucia': '+1', 'saint martin': '+590', 'saint pierre and miquelon': '+508', 'saint vincent and the grenadines': '+1', 'samoa': '+685', 'san marino': '+378', 'sao tome and principe': '+239', 'saudi arabia': '+966', 'ksa': '+966', 'senegal': '+221', 'serbia': '+381', 'seychelles': '+248', 'sierra leone': '+232', 'singapore': '+65', 'sint maarten': '+1', 'slovakia': '+421', 'slovenia': '+386', 'solomon islands': '+677', 'somalia': '+252', 'south africa': '+27', 'south georgia and the south sandwich islands': '+500', 'south korea': '+82', 'south sudan': '+211', 'spain': '+34', 'sri lanka': '+94', 'sudan': '+249', 'suriname': '+597', 'svalbard and jan mayen': '+47', 'sweden': '+46', 'switzerland': '+41', 'syria': '+963', 'taiwan': '+886', 'tajikistan': '+992', 'tanzania': '+255', 'thailand': '+66', 'timor leste': '+670', 'togo': '+228', 'tokelau': '+690', 'tonga': '+676', 'trinidad and tobago': '+1', 'tunisia': '+216', 'turkey': '+90', 'turkmenistan': '+993', 'turks and caicos islands': '+1', 'tuvalu': '+688', 'u.s. virgin islands': '+1', 'uganda': '+256', 'ukraine': '+380', 'united arab emirates': '+971', 'uae': '+971', 'united kingdom': '+44', 'uk': '+44', 'united states': '+1', 'usa': '+1', 'uruguay': '+598', 'uzbekistan': '+998', 'vanuatu': '+678', 'vatican': '+379', 'venezuela': '+58', 'vietnam': '+84', 'wallis and futuna': '+681', 'western sahara': '+212', 'yemen': '+967', 'zambia': '+260', 'zimbabwe': '+263'
};

const getUpdatedPhone = (currentPhone, newCode) => {
  if (!currentPhone) return newCode;
  if (!newCode) return currentPhone;
  if (currentPhone.startsWith(newCode)) return currentPhone;
  for (const code of Object.values(countryPhoneCodes)) {
    if (code && currentPhone.startsWith(code)) {
      return currentPhone.replace(code, newCode);
    }
  }
  return newCode + currentPhone;
};

export default function CustomerEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  const { themeColor } = useLegacyTheme();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [meta, setMeta] = useState({
    customer_group: [], territory: [], customer_type: ['Individual', 'Company'],
    salutations: [], address_type: [], emirates: [], countries: [],
    price_lists: [], tax_categories: [], payment_terms: [], loyalty_programs: [],
    warehouses: []
  });

  const [form, setForm] = useState({
    customer_name: '', mobile_no: '+971', email_id: '', salutation: '',
    customer_type: 'Individual', customer_group: 'All Customer Groups',
    territory: 'All Territories', gender: '', tax_id: '',
    account_manager: '', prospect_name: '', image: '',
    default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
    customer_details: '', tax_category: '', payment_terms: '',
    loyalty_program: '', loyalty_program_tier: '',
    disabled: 0, is_frozen: 0,
    address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
    first_name: '', middle_name: '', last_name: '', designation: '',
    contact_email: '', contact_mobile: '', status: 'Passive',
    custom_phone_code: '+971',
    branch_availability: []
  });


  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-slide-up-fade');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    // Slight delay to ensure DOM is fully rendered before querySelectorAll
    setTimeout(() => {
      document.querySelectorAll('.scroll-animate-card').forEach(card => {
        observer.observe(card);
      });
    }, 100);

    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    fetchMeta();
    if (!isNew) {
      fetchCustomerData();
    }
  }, [id, isNew]);

  const fetchMeta = async () => {
    try {
      const [metaRes, whRes] = await Promise.all([
        axios.get(`${API_BASE}.get_customer_meta_options`),
        axios.get('/api/resource/Warehouse?fields=["name"]&limit=500')
      ]);
      const data = metaRes.data.message?.data;
      const whData = whRes.data?.data || [];
      if (data) setMeta(prev => ({ 
        ...prev, 
        ...data,
        warehouses: whData.map(w => w.name)
      }));
    } catch (err) { console.error('Meta failed', err); }
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } });
      const data = res.data.message?.data;
      if (data) {
        const fullCustomer = {
          ...data.customer,
          addresses: data.addresses || [],
          contacts: data.contacts || []
        };
        setSelectedCustomer(fullCustomer);
        
        const addr = fullCustomer.addresses?.[0] || {};
        const cont = fullCustomer.contacts?.[0] || {};
        const editCountry = addr.country || 'United Arab Emirates';
        const normCountry = editCountry.toLowerCase().trim();
        const derivedCode = countryPhoneCodes[normCountry] || '';
        
        setForm({
          customer_name: fullCustomer.customer_name || '',
          mobile_no: fullCustomer.mobile_no || '',
          email_id: fullCustomer.email_id || '',
          salutation: fullCustomer.salutation || '',
          customer_type: fullCustomer.customer_type || 'Individual',
          customer_group: fullCustomer.customer_group || 'All Customer Groups',
          territory: fullCustomer.territory || 'All Territories',
          gender: fullCustomer.gender || '',
          tax_id: fullCustomer.tax_id || '',
          account_manager: fullCustomer.account_manager || '',
          prospect_name: fullCustomer.prospect_name || '',
          image: fullCustomer.image || '',
          default_price_list: fullCustomer.default_price_list || '',
          is_internal_customer: fullCustomer.is_internal_customer || 0,
          customer_pos_id: fullCustomer.customer_pos_id || '',
          customer_details: fullCustomer.customer_details || '',
          tax_category: fullCustomer.tax_category || '',
          payment_terms: fullCustomer.payment_terms || '',
          loyalty_program: fullCustomer.loyalty_program || '',
          loyalty_program_tier: fullCustomer.loyalty_program_tier || '',
          disabled: fullCustomer.disabled || 0,
          is_frozen: fullCustomer.is_frozen || 0,
          address_type: addr.address_type || 'Billing',
          address_line1: addr.address_line1 || '',
          address_line2: addr.address_line2 || '',
          city: addr.city || '',
          emirate: addr.state || addr.emirate || '',
          country: addr.country || 'United Arab Emirates',
          first_name: cont.first_name || '',
          middle_name: cont.middle_name || '',
          last_name: cont.last_name || '',
          designation: cont.designation || '',
          contact_email: cont.email_id || '',
          contact_mobile: cont.mobile_no || '',
          status: cont.status || 'Passive',
          custom_phone_code: fullCustomer.custom_phone_code || derivedCode,
          branch_availability: fullCustomer.branch_availability || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch details for edit', err);
      Swal.fire('Error', 'Failed to retrieve full customer details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.customer_name) return Swal.fire('Error', 'Customer Name is required', 'warning');
    setSaving(true);
    try {
      const payload = {
        customer_data: {
          ...form,
          name: !isNew ? selectedCustomer?.name : undefined,
          custom_branch: isNew ? (!isAdmin ? warehouse : form.custom_branch) : form.custom_branch,
          branch_availability: form.branch_availability
        },
        address_data: form.address_line1 ? {
          address_type: form.address_type,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          state: form.emirate,
          country: form.country
        } : null,
        contact_data: form.first_name ? {
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name,
          email_id: form.contact_email,
          mobile_no: form.contact_mobile,
          designation: form.designation,
          status: form.status,
          is_primary_contact: 1
        } : null
      };

      const res = await axios.post(`${API_BASE}.save_customer_details_retail`, payload);
      if (res.data.message?.success) {
        Swal.fire({ 
          icon: 'success', 
          title: 'Saved Successfully', 
          confirmButtonColor: themeColor, 
          text: isNew ? 'Customer created successfully.' : 'Customer profile updated successfully.' 
        });
        navigate('/customerlist');
      } else throw new Error(res.data.message?.message);
    } catch (err) { Swal.fire('Save Failure', err.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6fa]">
        <Loader2 size={36} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div 
      className="customer-edit-page flex flex-col font-sans bg-[#f5f6fa] min-h-screen relative z-50"
      style={{ '--theme-color': themeColor || '#3b82f6' }}
    >
{/* UI Header */}
          <div className="sticky top-[48px] bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-1.5 flex items-center justify-between z-10 shadow-xs transition-all">
            <div className="flex items-center gap-3">

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                  <User size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none">
                    {!isNew ? 'Edit Customer Registry' : 'New Customer Registry'}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Customer Directory Profile</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                  onClick={() => navigate('/customerlist')}
                  className="px-4 py-1.5 font-bold text-slate-500 hover:text-slate-800 transition-colors text-[13px]"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.customer_name}
                  className="px-5 py-1.5 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all hover:brightness-110 text-[13px]"
                  style={{ backgroundColor: themeColor }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving...' : (!isNew ? 'Save Customer' : 'Create Customer')}
                </button>
            </div>
          </div>

          {/* Form Body - Masonry Style Layout */}
          <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-4">
            <div className="w-full flex flex-col gap-4 pb-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
                
                  {/* Row 1 - Col 1: Section 1 (Core Customer Specifications) */}

              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"

                      style={{ backgroundColor: themeColor }}

                    >

                      1

                    </div>

                    <div className="flex flex-col"><h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Opportunity Details</h3><p className="text-[10px] font-medium text-slate-400 normal-case">Basic customer and profile information</p></div>

                  </div>

                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">

                  <div className="space-y-1.5 col-span-1 md:col-span-2">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Customer Name <span className="text-rose-500">*</span>

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.customer_name}

                      onChange={e => setForm({ ...form, customer_name: e.target.value })}

                      placeholder="e.g. Acme Corp - Primary Corporate Customer"

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Customer Group <span className="text-rose-500">*</span>

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.customer_group}

                      onChange={e => setForm({ ...form, customer_group: e.target.value })}

                    >

                      {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Customer Type

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.customer_type}

                      onChange={e => setForm({ ...form, customer_type: e.target.value })}

                    >

                      {meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Territory

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.territory}

                      onChange={e => setForm({ ...form, territory: e.target.value })}

                    >

                      {meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Salutation

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.salutation}

                      onChange={e => setForm({ ...form, salutation: e.target.value })}

                    >

                      <option value="">NA</option>

                      {meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5 col-span-1 md:col-span-2">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Gender Profile

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.gender}

                      onChange={e => setForm({ ...form, gender: e.target.value })}

                    >

                      <option value="">NA</option>

                      <option value="Male">Male</option>

                      <option value="Female">Female</option>

                      <option value="Other">Other</option>

                    </select>

                  </div>

                </div>

              </div>
                  {/* Row 1 - Col 2: Section 3 (Currency and Price List) */}

              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"

                      style={{ backgroundColor: themeColor }}

                    >

                      3

                    </div>

                    <div className="flex flex-col"><h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Source & Assignment</h3><p className="text-[10px] font-medium text-slate-400 normal-case">Source details and assignment information</p></div>

                  </div>

                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">

                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Tax Id

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.tax_id}

                      onChange={e => setForm({ ...form, tax_id: e.target.value })}

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Tax Category

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.tax_category}

                      onChange={e => setForm({ ...form, tax_category: e.target.value })}

                    >

                      <option value="">Default</option>

                      {meta.tax_categories?.map(t => <option key={t} value={t}>{t}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5 col-span-1 md:col-span-2">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Profile Image URL

                    </label>

                    <div className="flex items-center gap-4">

                      <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">

                        {form.image ? (

                          <img src={form.image} alt="Profile" className="w-full h-full object-cover" />

                        ) : (

                          <User size={24} className="text-slate-300" />

                        )}

                      </div>

                      <input

                        className="flex-1 h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                        style={{ borderColor: '#cbd5e1', outline: 'none' }}

                        value={form.image}

                        onChange={e => setForm({ ...form, image: e.target.value })}

                        placeholder="e.g. https://example.com/avatar.jpg"

                      />

                    </div>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Pricing Matrix

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.default_price_list}

                      onChange={e => setForm({ ...form, default_price_list: e.target.value })}

                    >

                      <option value="">System Standard</option>

                      {meta.price_lists?.map(p => <option key={p} value={p}>{p}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Payment Terms Protocol

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.payment_terms}

                      onChange={e => setForm({ ...form, payment_terms: e.target.value })}

                    >

                      <option value="">Direct</option>

                      {meta.payment_terms?.map(p => <option key={p} value={p}>{p}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Loyalty Hub Link

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.loyalty_program}

                      onChange={e => setForm({ ...form, loyalty_program: e.target.value })}

                    >

                      <option value="">None</option>

                      {meta.loyalty_programs?.map(p => <option key={p} value={p}>{p}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Account Supervisor

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.account_manager}

                      onChange={e => setForm({ ...form, account_manager: e.target.value })}

                    >

                      <option value="">Select Supervisor</option>

                      {meta.account_managers?.map(m => <option key={m} value={m}>{m}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Customer POS Ident

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.customer_pos_id}

                      onChange={e => setForm({ ...form, customer_pos_id: e.target.value })}

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Prospect Alias

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.prospect_name}

                      onChange={e => setForm({ ...form, prospect_name: e.target.value })}

                    >

                      <option value="">Select Prospect</option>

                      {meta.prospects?.map(p => <option key={p} value={p}>{p}</option>)}

                    </select>

                  </div>

                </div>

              </div>
                
                  {/* Row 2 - Col 1: Section 2 (Contact Info & Address) */}

              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"

                      style={{ backgroundColor: themeColor }}

                    >

                      2

                    </div>

                    <div className="flex flex-col"><h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Deal Information</h3><p className="text-[10px] font-medium text-slate-400 normal-case">Contact and address information</p></div>

                  </div>

                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">

                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Email Id

                    </label>

                    <input

                      type="email"

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.email_id}

                      onChange={e => setForm({ ...form, email_id: e.target.value })}

                      placeholder="email@example.com"

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Mobile No

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.mobile_no}

                      onChange={e => setForm({ ...form, mobile_no: e.target.value })}

                      placeholder="+971 -- --- ----"

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Address Type

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.address_type}

                      onChange={e => setForm({ ...form, address_type: e.target.value })}

                    >

                      {meta.address_type?.map(a => <option key={a} value={a}>{a}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      City Station

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.city}

                      onChange={e => setForm({ ...form, city: e.target.value })}

                    />

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Emirate Hub

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.emirate}

                      onChange={e => setForm({ ...form, emirate: e.target.value })}

                    >

                      <option value="">Select Emirate</option>

                      {meta.emirates?.map(e => <option key={e} value={e}>{e}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Country

                    </label>

                    <select

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.country}

                      onChange={e => {

                        const selectedCountry = e.target.value;

                        const norm = (selectedCountry || '').toLowerCase().trim();

                        const code = countryPhoneCodes[norm] || '';

                        setForm(prev => ({

                          ...prev,

                          country: selectedCountry,

                          custom_phone_code: code,

                          mobile_no: getUpdatedPhone(prev.mobile_no, code)

                        }));

                      }}

                    >

                      {meta.countries?.map(c => <option key={c} value={c}>{c}</option>)}

                    </select>

                  </div>



                  <div className="space-y-1.5 col-span-1 md:col-span-2">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Building / Street Line 1

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.address_line1}

                      onChange={e => setForm({ ...form, address_line1: e.target.value })}

                    />

                  </div>



                  <div className="space-y-1.5 col-span-1 md:col-span-2">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Address Line 2

                    </label>

                    <input

                      className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.address_line2}

                      onChange={e => setForm({ ...form, address_line2: e.target.value })}

                    />

                  </div>

                </div>

              </div>
                  {/* Row 2 - Col 2: Section 4 (Settings & Controls) */}

              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"

                      style={{ backgroundColor: themeColor }}

                    >

                      4

                    </div>

                    <div className="flex flex-col"><h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Additional Information</h3><p className="text-[10px] font-medium text-slate-400 normal-case">Status, contact person and other details</p></div>

                  </div>

                </div>

                <div className="p-4 flex flex-col justify-between flex-1 space-y-6">

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

                    {[
                        { id: 'disabled', label: 'DISABLED', icon: <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center shrink-0"><AlertOctagon size={16} className="text-red-500" /></div> },
                        { id: 'is_frozen', label: 'IS FROZEN', icon: <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0"><Snowflake size={16} className="text-blue-500" /></div> },
                        { id: 'is_internal_customer', label: 'INTERNAL CUSTOMER', icon: <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center shrink-0"><User size={16} className="text-orange-500" /></div> }
                      ].map(check => (

                      <label key={check.id} className="cursor-pointer block w-full m-0">
                        <div className="flex flex-row items-center justify-start px-4 py-3 gap-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-sm group w-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 transition-all cursor-pointer focus:ring-0 w-4 h-4 shrink-0 m-0"
                            style={{
                              accentColor: themeColor
                            }}
                            checked={form[check.id] === 1 || form[check.id] === true}
                            onChange={e => setForm({ ...form, [check.id]: e.target.checked ? 1 : 0 })}
                          />
                          <div className="flex flex-row items-center gap-3 shrink-0 m-0" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                            {check.icon}
                            <span className="text-[11px] font-black text-slate-800 group-hover:text-slate-900 transition-colors uppercase tracking-widest whitespace-nowrap m-0">{check.label}</span>
                          </div>
                        </div>
                      </label>

                    ))}

                  </div>



                  {/* Section: Personnel Profile (Primary Contact) */}

                  <div className="space-y-3">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Primary Contact Person Profile</label>

                    <div className="grid grid-cols-2 gap-3">

                      <input
                          placeholder="First Name"
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                          value={form.first_name}
                          onChange={e => setForm({ ...form, first_name: e.target.value })}
                        />
                        <input
                          placeholder="Last Name"
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                          value={form.last_name}
                          onChange={e => setForm({ ...form, last_name: e.target.value })}
                        />
                        <input
                          placeholder="Designation"
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                          value={form.designation}
                          onChange={e => setForm({ ...form, designation: e.target.value })}
                        />
                        <select
                          value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                        >
                          <option value="Passive">Passive</option>
                          <option value="Active">Active</option>
                        </select>
                        <input
                          placeholder="Mobile No"
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                          value={form.contact_mobile}
                          onChange={e => setForm({ ...form, contact_mobile: e.target.value })}
                        />
                        <input
                          placeholder="Contact Email"
                          className="w-full h-8 px-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white"
                          style={{ borderColor: '#cbd5e1', outline: 'none' }}
                          value={form.contact_email}
                          onChange={e => setForm({ ...form, contact_email: e.target.value })}
                        />

                    </div>

                  </div>



                  <div className="space-y-1.5 flex flex-col flex-1">

                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">

                      Customer Details

                    </label>

                    <textarea

                      className="w-full px-4 py-3 border rounded-lg text-[11px] font-bold text-slate-700 bg-white min-h-[85px] resize-none flex-1"

                      style={{ borderColor: '#cbd5e1', outline: 'none' }}

                      value={form.customer_details}

                      onChange={e => setForm({ ...form, customer_details: e.target.value })}

                      placeholder="Enter customer details or description notes..."

                    />

                  </div>

                </div>

              </div>
                </div>
              {/* Full Width Section */}
              <div className="w-full">
                {/* Row 3 - Col 1: Section 5 (Branch Availability) */}

              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"

                      style={{ backgroundColor: themeColor }}

                    >

                      5

                    </div>

                    <div className="flex flex-col"><h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Branch Availability</h3><p className="text-[10px] font-medium text-slate-400 normal-case">Select branches where this customer can be used:</p></div>

                  </div>

                </div>

                <div className="p-4 space-y-4 flex-1">

                  

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1">

                    {meta.warehouses?.map(wh => (

                      <label key={wh} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer transition-all hover:bg-slate-100/80">

                        <input

                          type="checkbox"

                          className="rounded border-slate-300"

                          style={{ accentColor: themeColor, marginRight: '10px' }}

                          checked={form.branch_availability?.some(b => b.warehouse === wh)}

                          onChange={e => {

                            const updated = e.target.checked 

                              ? [...form.branch_availability, { warehouse: wh }]

                              : form.branch_availability.filter(b => b.warehouse !== wh);

                            setForm({ ...form, branch_availability: updated });

                          }}

                        />

                        <span className="text-[11px] font-bold text-slate-600">{wh}</span>

                      </label>

                    ))}

                  </div>

                </div>

              </div>
              </div>
            </div>
          </div>


    </div>
  );
}
