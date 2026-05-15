import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  Globe, Tag, Receipt, Layers, ShoppingCart, Edit2, Save, X,
  Clock, Award, User, Briefcase, Hash, FileText, ShieldCheck,
  UserPlus, Shield, UserCircle2, Percent, Warehouse, Plus, Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

const countryPhoneCodes = {
  'afghanistan': '+93',
  'aland islands': '+358',
  'albania': '+355',
  'algeria': '+213',
  'american samoa': '+1',
  'andorra': '+376',
  'angola': '+244',
  'anguilla': '+1',
  'antarctica': '+672',
  'antigua and barbuda': '+1',
  'argentina': '+54',
  'armenia': '+374',
  'aruba': '+297',
  'australia': '+61',
  'austria': '+43',
  'azerbaijan': '+994',
  'bahamas': '+1',
  'bahrain': '+973',
  'bangladesh': '+880',
  'barbados': '+1',
  'belarus': '+375',
  'belgium': '+32',
  'belize': '+501',
  'benin': '+229',
  'bermuda': '+1',
  'bhutan': '+975',
  'bolivia': '+591',
  'bonaire': '+599',
  'bosnia and herzegovina': '+387',
  'botswana': '+267',
  'bouvet island': '+47',
  'brazil': '+55',
  'british indian ocean territory': '+246',
  'british virgin islands': '+1',
  'brunei': '+673',
  'bulgaria': '+359',
  'burkina faso': '+226',
  'burundi': '+257',
  'cambodia': '+855',
  'cameroon': '+237',
  'canada': '+1',
  'cape verde': '+238',
  'cayman islands': '+1',
  'central african republic': '+236',
  'chad': '+235',
  'chile': '+56',
  'china': '+86',
  'christmas island': '+61',
  'cocos islands': '+61',
  'colombia': '+57',
  'comoros': '+269',
  'cook islands': '+682',
  'costa rica': '+506',
  'croatia': '+385',
  'cuba': '+53',
  'curacao': '+599',
  'cyprus': '+357',
  'czech republic': '+420',
  'czechia': '+420',
  'democratic republic of the congo': '+243',
  'denmark': '+45',
  'djibouti': '+253',
  'dominica': '+1',
  'dominican republic': '+1',
  'ecuador': '+593',
  'egypt': '+20',
  'el salvador': '+503',
  'equatorial guinea': '+240',
  'eritrea': '+291',
  'estonia': '+372',
  'eswatini': '+268',
  'ethiopia': '+251',
  'falkland islands': '+500',
  'faroe islands': '+298',
  'fiji': '+679',
  'finland': '+358',
  'france': '+33',
  'french guiana': '+594',
  'french polynesia': '+689',
  'french southern territories': '+262',
  'gabon': '+241',
  'gambia': '+220',
  'georgia': '+995',
  'germany': '+49',
  'ghana': '+233',
  'gibraltar': '+350',
  'greece': '+30',
  'greenland': '+299',
  'grenada': '+1',
  'guadeloupe': '+590',
  'guam': '+1',
  'guatemala': '+502',
  'guernsey': '+44',
  'guinea': '+224',
  'guinea-bissau': '+245',
  'guyana': '+592',
  'haiti': '+509',
  'heard island and mcdonald islands': '+672',
  'honduras': '+504',
  'hong kong': '+852',
  'hungary': '+36',
  'iceland': '+354',
  'india': '+91',
  'indonesia': '+62',
  'iran': '+98',
  'iraq': '+964',
  'ireland': '+353',
  'isle of man': '+44',
  'israel': '+972',
  'italy': '+39',
  'ivory coast': '+225',
  'jamaica': '+1',
  'japan': '+81',
  'jersey': '+44',
  'jordan': '+962',
  'kazakhstan': '+7',
  'kenya': '+254',
  'kiribati': '+686',
  'kosovo': '+383',
  'kuwait': '+965',
  'kyrgyzstan': '+996',
  'laos': '+856',
  'latvia': '+371',
  'lebanon': '+961',
  'lesotho': '+266',
  'liberia': '+231',
  'libya': '+218',
  'liechtenstein': '+423',
  'lithuania': '+370',
  'luxembourg': '+352',
  'macao': '+853',
  'madagascar': '+261',
  'malawi': '+265',
  'malaysia': '+60',
  'maldives': '+960',
  'mali': '+223',
  'malta': '+356',
  'marshall islands': '+692',
  'martinique': '+596',
  'mauritania': '+222',
  'mauritius': '+230',
  'mayotte': '+262',
  'mexico': '+52',
  'micronesia': '+691',
  'moldova': '+373',
  'monaco': '+377',
  'mongolia': '+976',
  'montenegro': '+382',
  'montserrat': '+1',
  'morocco': '+212',
  'mozambique': '+258',
  'myanmar': '+95',
  'namibia': '+264',
  'nauru': '+674',
  'nepal': '+977',
  'netherlands': '+31',
  'new caledonia': '+687',
  'new zealand': '+64',
  'nicaragua': '+505',
  'niger': '+227',
  'nigeria': '+234',
  'niue': '+683',
  'norfolk island': '+672',
  'north korea': '+850',
  'north macedonia': '+389',
  'northern mariana islands': '+1',
  'norway': '+47',
  'oman': '+968',
  'pakistan': '+92',
  'palau': '+680',
  'palestine': '+970',
  'panama': '+507',
  'papua new guinea': '+675',
  'paraguay': '+595',
  'peru': '+51',
  'philippines': '+63',
  'pitcairn': '+64',
  'poland': '+48',
  'portugal': '+351',
  'puerto rico': '+1',
  'qatar': '+974',
  'republic of the congo': '+242',
  'reunion': '+262',
  'romania': '+40',
  'russia': '+7',
  'rwanda': '+250',
  'saint barthelemy': '+590',
  'saint helena': '+290',
  'saint kitts and nevis': '+1',
  'saint lucia': '+1',
  'saint martin': '+590',
  'saint pierre and miquelon': '+508',
  'saint vincent and the grenadines': '+1',
  'samoa': '+685',
  'san marino': '+378',
  'sao tome and principe': '+239',
  'saudi arabia': '+966',
  'ksa': '+966',
  'senegal': '+221',
  'serbia': '+381',
  'seychelles': '+248',
  'sierra leone': '+232',
  'singapore': '+65',
  'sint maarten': '+1',
  'slovakia': '+421',
  'slovenia': '+386',
  'solomon islands': '+677',
  'somalia': '+252',
  'south africa': '+27',
  'south georgia and the south sandwich islands': '+500',
  'south korea': '+82',
  'south sudan': '+211',
  'spain': '+34',
  'sri lanka': '+94',
  'sudan': '+249',
  'suriname': '+597',
  'svalbard and jan mayen': '+47',
  'sweden': '+46',
  'switzerland': '+41',
  'syria': '+963',
  'taiwan': '+886',
  'tajikistan': '+992',
  'tanzania': '+255',
  'thailand': '+66',
  'timor leste': '+670',
  'togo': '+228',
  'tokelau': '+690',
  'tonga': '+676',
  'trinidad and tobago': '+1',
  'tunisia': '+216',
  'turkey': '+90',
  'turkmenistan': '+993',
  'turks and caicos islands': '+1',
  'tuvalu': '+688',
  'u.s. virgin islands': '+1',
  'uganda': '+256',
  'ukraine': '+380',
  'united arab emirates': '+971',
  'uae': '+971',
  'united kingdom': '+44',
  'uk': '+44',
  'united states': '+1',
  'usa': '+1',
  'uruguay': '+598',
  'uzbekistan': '+998',
  'vanuatu': '+678',
  'vatican': '+379',
  'venezuela': '+58',
  'vietnam': '+84',
  'wallis and futuna': '+681',
  'western sahara': '+212',
  'yemen': '+967',
  'zambia': '+260',
  'zimbabwe': '+263'
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

/* ==================== KEY-VALUE ROW COMPONENT ==================== */
const DetailRow = ({ label, value, icon: Icon, themeColor }) => (
  <div className="flex items-start gap-4 py-3 hover:bg-slate-50/50 px-3 rounded-lg transition-colors border-b border-slate-100 last:border-none">
    <div className="p-2 bg-slate-50 rounded-lg shrink-0 mt-0.5">
      <Icon size={14} style={{ color: themeColor || '#475569' }} />
    </div>
    <div className="space-y-0.5 min-w-0 flex-1">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-slate-800 break-words">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</p>
    </div>
  </div>
);

const SectionHeader = ({ num, text }) => (
  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-slate-900">{num}</div>
    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{text}</h3>
  </div>
);

/* ==================== MAIN COMPONENT ==================== */
const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { themeColor } = useLegacyTheme();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(isNew ? 'edit' : 'view'); // 'view' or 'edit'

  // Data States
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [meta, setMeta] = useState({
    customer_group: [], territory: [], customer_type: ['Individual', 'Company'],
    salutations: [], address_type: [], emirates: [], countries: [],
    price_lists: [], tax_categories: [], payment_terms: [], loyalty_programs: [],
    warehouses: []
  });

  // Form state containing all customer create fields
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
    address_name: '', // Added to track existing address
    first_name: '', middle_name: '', last_name: '', designation: '',
    contact_email: '', contact_mobile: '', status: 'Passive',
    contact_name: '', // Added to track existing contact
    custom_phone_code: '+971',
    branch_availability: []
  });

  useEffect(() => {
    fetchMeta();
    if (!isNew && id && id !== 'undefined') {
      fetchCustomerData();
    }
  }, [id, isNew]);

  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${API_BASE}.get_customer_meta_options`);
      const data = res.data.message?.data;
      if (data) setMeta(prev => ({ ...prev, ...data }));
    } catch (err) { console.error("Meta failed", err); }
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } });
      const { customer: cust, addresses: addrList, contacts: contList } = res.data.message.data;
      setCustomer(cust);
      setAddresses(addrList || []);
      setContacts(contList || []);

      const addr = addrList?.[0] || {};
      const cont = contList?.[0] || {};
      const editCountry = addr.country || 'United Arab Emirates';
      const normCountry = editCountry.toLowerCase().trim();
      const derivedCode = countryPhoneCodes[normCountry] || '';

      setForm({
        customer_name: cust.customer_name || '',
        mobile_no: cust.mobile_no || '',
        email_id: cust.email_id || '',
        salutation: cust.salutation || '',
        customer_type: cust.customer_type || 'Individual',
        customer_group: cust.customer_group || 'All Customer Groups',
        territory: cust.territory || 'All Territories',
        gender: cust.gender || '',
        tax_id: cust.tax_id || '',
        account_manager: cust.account_manager || '',
        prospect_name: cust.prospect_name || '',
        image: cust.image || '',
        default_price_list: cust.default_price_list || '',
        is_internal_customer: cust.is_internal_customer || 0,
        customer_pos_id: cust.customer_pos_id || '',
        customer_details: cust.customer_details || '',
        tax_category: cust.tax_category || '',
        payment_terms: cust.payment_terms || '',
        loyalty_program: cust.loyalty_program || '',
        loyalty_program_tier: cust.loyalty_program_tier || '',
        disabled: cust.disabled || 0,
        is_frozen: cust.is_frozen || 0,
        address_type: addr.address_type || 'Billing',
        address_line1: addr.address_line1 || '',
        address_line2: addr.address_line2 || '',
        city: addr.city || '',
        emirate: addr.state || addr.emirate || '',
        country: addr.country || 'United Arab Emirates',
        address_name: addr.name || '',
        first_name: cont.first_name || '',
        middle_name: cont.middle_name || '',
        last_name: cont.last_name || '',
        designation: cont.designation || '',
        contact_email: cont.email_id || '',
        contact_mobile: cont.mobile_no || '',
        status: cont.status || 'Passive',
        contact_name: cont.name || '',
        custom_phone_code: cust.custom_phone_code || derivedCode,
        branch_availability: cust.branch_availability || []
      });
    } catch (err) { Swal.fire('Error', 'Failed to retrieve profile data', 'error'); }
    finally { setTimeout(() => setLoading(false), 300); }
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) return Swal.fire('Field Missing', 'Customer Name is mandatory', 'warning');
    try {
      setSaving(true);
      const payload = {
        customer_data: {
          ...form,
          name: isNew ? undefined : id,
          branch_availability: form.branch_availability.filter(b => b.warehouse)
        },
        address_data: form.address_line1 ? {
          name: form.address_name || undefined,
          address_type: form.address_type,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          state: form.emirate,
          country: form.country
        } : null,
        contact_data: form.first_name ? {
          name: form.contact_name || undefined,
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
        Swal.fire({ icon: 'success', title: 'Saved Successfully', text: isNew ? 'Customer created.' : 'Customer profile updated.', confirmButtonColor: themeColor });
        if (isNew) navigate(`/customer-details/${res.data.message.customer_id || res.data.message.customer_name}`);
        else { setViewMode('view'); fetchCustomerData(); }
      } else throw new Error(res.data.message?.message);
    } catch (err) { Swal.fire('Save Failure', err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_private', 0);
    formData.append('doctype', 'Customer');
    if (!isNew && id) formData.append('docname', id);

    try {
      setSaving(true);
      // Using standard Frappe upload API
      const res = await axios.post('/api/method/upload_file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.message?.file_url) {
        setForm(prev => ({ ...prev, image: res.data.message.file_url }));
        Swal.fire({ icon: 'success', title: 'Image Uploaded', text: 'Reference link updated.', timer: 1500, showConfirmButton: false });
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Upload Error', 'Failed to upload image. Ensure you are logged in.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={36} />
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Customer details...</p>
    </div>
  );

  const activeAddr = addresses?.[0] || {};
  const activeCont = contacts?.[0] || {};

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-6 sticky top-0 z-40">
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <button onClick={() => viewMode === 'edit' && !isNew ? setViewMode('view') : navigate('/customerlist')} className="px-3.5 py-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-all border border-gray-100 flex items-center gap-1.5 shadow-xs">
              <ChevronLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
            </button>
            <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-md overflow-hidden">
              {customer?.image ? (
                <img src={customer.image} alt={customer.customer_name} className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-800 tracking-tight">
                  {isNew ? 'New Customer Registration' : (viewMode === 'edit' ? `Editing: ${customer?.customer_name}` : customer?.customer_name)}
                </h1>
                {!isNew && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${customer?.disabled === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {customer?.disabled === 0 ? 'Active' : 'Disabled'}
                  </span>
                )}
              </div>
              {!isNew && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Registry Reference: {customer?.name}</p>}
            </div>
          </div>
          <div>
            {viewMode === 'view' ? (
              <button onClick={() => setViewMode('edit')} className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md transition-all">
                <Edit2 size={13} /> Edit Customer Details
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {!isNew && (
                  <button onClick={() => setViewMode('view')} className="px-5 py-2.5 text-slate-400 hover:text-slate-800 text-[10px] font-black uppercase tracking-widest transition-all">
                    Discard
                  </button>
                )}
                <button onClick={handleSave} disabled={saving} className="px-7 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md transition-all">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>      {/* Main Content Layout containing ONLY form specs */}
      <div className="w-full mt-8 px-8">
        {viewMode === 'view' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300 pb-12">

            {/* Card 1: Legal Identity Details */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
              <SectionHeader num="1" text="Legal Identity Profile" />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 bg-white">
                <DetailRow label="Legal Identity Name" value={customer?.customer_name} icon={User} themeColor={themeColor} />
                <DetailRow label="Salutation" value={customer?.salutation} icon={UserPlus} themeColor={themeColor} />
                <DetailRow label="Corporate Type" value={customer?.customer_type} icon={Building2} themeColor={themeColor} />
                <DetailRow label="Identity Group" value={customer?.customer_group} icon={Layers} themeColor={themeColor} />
                <DetailRow label="Territory Domain" value={customer?.territory} icon={Globe} themeColor={themeColor} />
                <DetailRow label="Gender" value={customer?.gender} icon={Users} themeColor={themeColor} />
                <div className="md:col-span-2">
                  <DetailRow label="Profile Image Reference" value={customer?.image} icon={Tag} themeColor={themeColor} />
                </div>
                <div className="md:col-span-2">
                  <DetailRow label="Identity Registry Specs Details" value={customer?.customer_details} icon={FileText} themeColor={themeColor} />
                </div>
              </div>
            </div>

            {/* Card 2: Deal Information & Primary Address */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
              <SectionHeader num="2" text="Deal & Spatial Information" />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 bg-white">
                <DetailRow label="Email Id" value={customer?.email_id} icon={Mail} themeColor={themeColor} />
                <DetailRow label="Mobile No" value={customer?.mobile_no} icon={Phone} themeColor={themeColor} />
                <DetailRow label="Address Type" value={activeAddr.address_type} icon={Tag} themeColor={themeColor} />
                <DetailRow label="City Station" value={activeAddr.city} icon={MapPin} themeColor={themeColor} />
                <DetailRow label="Emirate Hub / State" value={activeAddr.state || activeAddr.emirate} icon={MapPin} themeColor={themeColor} />
                <DetailRow label="Country" value={activeAddr.country} icon={Globe} themeColor={themeColor} />
                <div className="md:col-span-2">
                  <DetailRow label="Building / Street Line 1" value={activeAddr.address_line1} icon={MapPin} themeColor={themeColor} />
                </div>
                <div className="md:col-span-2">
                  <DetailRow label="Address Line 2" value={activeAddr.address_line2} icon={MapPin} themeColor={themeColor} />
                </div>
              </div>
            </div>

            {/* Card 3: Source & Assignment */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
              <SectionHeader num="3" text="Source & Assignment Protocols" />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 bg-white">
                <DetailRow label="Tax Id / TRN" value={customer?.tax_id} icon={Receipt} themeColor={themeColor} />
                <DetailRow label="Tax Category" value={customer?.tax_category} icon={Percent} themeColor={themeColor} />
                <DetailRow label="Pricing Matrix" value={customer?.default_price_list} icon={ShoppingCart} themeColor={themeColor} />
                <DetailRow label="Payment Terms Protocol" value={customer?.payment_terms} icon={Clock} themeColor={themeColor} />
                <DetailRow label="Loyalty Hub Link" value={customer?.loyalty_program} icon={Award} themeColor={themeColor} />
                <DetailRow label="Account Supervisor" value={customer?.account_manager} icon={Briefcase} themeColor={themeColor} />
                <DetailRow label="Customer POS Ident" value={customer?.customer_pos_id} icon={Hash} themeColor={themeColor} />
                <DetailRow label="Prospect Alias" value={customer?.prospect_name} icon={UserCircle2} themeColor={themeColor} />
              </div>
            </div>

            {/* Card 4: Additional Information & Contact Person */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
              <SectionHeader num="4" text="Additional Information & Primary Contact" />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 bg-white">
                <DetailRow label="Disabled Status" value={customer?.disabled === 1 ? 'Disabled' : 'Active'} icon={Shield} themeColor={themeColor} />
                <DetailRow label="Is Frozen Status" value={customer?.is_frozen === 1 ? 'Frozen State' : 'Normal State'} icon={Shield} themeColor={themeColor} />
                <DetailRow label="Internal Customer Status" value={customer?.is_internal_customer === 1 ? 'Yes, Internal' : 'No, External'} icon={Shield} themeColor={themeColor} />
                <div className="md:col-span-2 my-2 border-t border-dashed border-slate-100" />

                <div className="md:col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">Primary Contact Profile</p>
                </div>
                <DetailRow label="Contact Full Name" value={activeCont.first_name ? `${activeCont.first_name} ${activeCont.middle_name || ''} ${activeCont.last_name || ''}`.trim() : ''} icon={User} themeColor={themeColor} />
                <DetailRow label="Designation" value={activeCont.designation} icon={Briefcase} themeColor={themeColor} />
                <DetailRow label="Contact Email" value={activeCont.email_id} icon={Mail} themeColor={themeColor} />
                <DetailRow label="Contact Mobile" value={activeCont.mobile_no} icon={Phone} themeColor={themeColor} />
                <DetailRow label="Contact Status" value={activeCont.status} icon={ShieldCheck} themeColor={themeColor} />
              </div>
            </div>

            {/* Card 5: Branch Availability Visibility */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden lg:col-span-2">
              <SectionHeader num="5" text="Regional Branch Availability" />
              <div className="p-6">
                {customer?.branch_availability?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {customer.branch_availability.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-8 h-8 rounded bg-white flex items-center justify-center shadow-xs">
                          <Warehouse size={14} className="text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{b.warehouse}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Warehouse size={32} className="mx-auto text-slate-300 mb-2 opacity-50" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available in all branches (Global Access)</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* Full Screen Edit Form */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-300 pb-12">
            {/* Quadrant 1: Registration Details */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>1</div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identity Details</h3>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Legal Identity Name</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Company or Individual Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Salutation</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.salutation}
                    onChange={e => setForm({ ...form, salutation: e.target.value })}
                  >
                    <option value="">Select Salutation</option>
                    {meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Corporate Type</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.customer_type}
                    onChange={e => setForm({ ...form, customer_type: e.target.value })}
                  >
                    {meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Identity Group</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.customer_group}
                    onChange={e => setForm({ ...form, customer_group: e.target.value })}
                  >
                    {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Territory Domain</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.territory}
                    onChange={e => setForm({ ...form, territory: e.target.value })}
                  >
                    {meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Gender</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.gender}
                    onChange={e => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Profile Image Reference</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.image}
                      onChange={e => setForm({ ...form, image: e.target.value })}
                      placeholder="Image URL link"
                    />
                    <button
                      onClick={() => document.getElementById('customer-image-upload')?.click()}
                      className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all"
                    >
                      Upload
                    </button>
                    <input
                      id="customer-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Identity Registry Specs Details</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg text-xs font-medium text-slate-700 bg-white focus:ring-0 resize-none"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.customer_details}
                    onChange={e => setForm({ ...form, customer_details: e.target.value })}
                    placeholder="Internal description notes"
                  />
                </div>

                {/* Branch Availability Management */}
                <div className="space-y-3 col-span-1 md:col-span-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branch Hub Availability</label>
                    <button 
                      onClick={() => setForm({ ...form, branch_availability: [...form.branch_availability, { warehouse: '' }] })}
                      className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors flex items-center gap-1.5"
                    >
                      <Plus size={12} /> Add Branch Hub
                    </button>
                  </div>
                  
                  {form.branch_availability.length === 0 ? (
                    <div className="py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                      <Warehouse size={24} className="text-slate-300 mb-2 opacity-60" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global access (All Branches)</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {form.branch_availability.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            className="flex-1 h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                            style={{ borderColor: '#cbd5e1', outline: 'none' }}
                            value={b.warehouse}
                            onChange={e => {
                              const newB = [...form.branch_availability];
                              newB[idx].warehouse = e.target.value;
                              setForm({ ...form, branch_availability: newB });
                            }}
                          >
                            <option value="">Select Branch / Warehouse</option>
                            {meta.warehouses?.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                          <button 
                            onClick={() => {
                              const newB = form.branch_availability.filter((_, i) => i !== idx);
                              setForm({ ...form, branch_availability: newB });
                            }}
                            className="w-11 h-11 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quadrant 2: Contact Info & Address */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>2</div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Deal Information</h3>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Email Id</label>
                  <input
                    type="email"
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.email_id}
                    onChange={e => setForm({ ...form, email_id: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Mobile No</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.mobile_no}
                    onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                    placeholder="+971 -- --- ----"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Address Type</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.address_type}
                    onChange={e => setForm({ ...form, address_type: e.target.value })}
                  >
                    {meta.address_type?.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">City Station</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Emirate Hub</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.emirate}
                    onChange={e => setForm({ ...form, emirate: e.target.value })}
                  >
                    <option value="">Select Emirate</option>
                    {meta.emirates?.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Country</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Building / Street Line 1</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.address_line1}
                    onChange={e => setForm({ ...form, address_line1: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Address Line 2</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.address_line2}
                    onChange={e => setForm({ ...form, address_line2: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Quadrant 3: Currency & Price List */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>3</div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Source & Assignment</h3>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Tax Id</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.tax_id}
                    onChange={e => setForm({ ...form, tax_id: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Tax Category</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.tax_category}
                    onChange={e => setForm({ ...form, tax_category: e.target.value })}
                  >
                    <option value="">Default</option>
                    {meta.tax_categories?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Pricing Matrix</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.default_price_list}
                    onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                  >
                    <option value="">System Standard</option>
                    {meta.price_lists?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Payment Terms Protocol</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.payment_terms}
                    onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                  >
                    <option value="">Direct</option>
                    {meta.payment_terms?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Loyalty Hub Link</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.loyalty_program}
                    onChange={e => setForm({ ...form, loyalty_program: e.target.value })}
                  >
                    <option value="">None</option>
                    {meta.loyalty_programs?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Account Supervisor</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.account_manager}
                    onChange={e => setForm({ ...form, account_manager: e.target.value })}
                  >
                    <option value="">Select Supervisor</option>
                    {meta.account_managers?.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Customer POS Ident</label>
                  <input
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                    style={{ borderColor: '#cbd5e1', outline: 'none' }}
                    value={form.customer_pos_id}
                    onChange={e => setForm({ ...form, customer_pos_id: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Prospect Alias</label>
                  <select
                    className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
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

            {/* Quadrant 4: Settings & Controls */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>4</div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Additional Information</h3>
                </div>
              </div>
              <div className="p-6 flex flex-col justify-between flex-1 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[
                    { id: 'disabled', label: 'Disabled' },
                    { id: 'is_frozen', label: 'Is Frozen' },
                    { id: 'is_internal_customer', label: 'Internal Customer' }
                  ].map(check => (
                    <label key={check.id} className="flex items-center px-3 py-2.5 bg-slate-50/50 hover:bg-slate-100/50 border border-slate-100 rounded-lg cursor-pointer transition-all select-none group">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-slate-800 transition-all cursor-pointer focus:ring-0"
                        style={{
                          accentColor: themeColor,
                          width: '16px',
                          height: '16px',
                          minWidth: '16px',
                          minHeight: '16px',
                          position: 'static',
                          display: 'inline-block',
                          margin: '0 10px 0 0',
                          flexShrink: 0,
                          cursor: 'pointer'
                        }}
                        checked={form[check.id] === 1 || form[check.id] === true}
                        onChange={e => setForm({ ...form, [check.id]: e.target.checked ? 1 : 0 })}
                      />
                      <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors uppercase tracking-wider whitespace-nowrap">{check.label}</span>
                    </label>
                  ))}
                </div>

                {/* Personnel Profile (Primary Contact) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Primary Contact Person Profile</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="First Name"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                    />
                    <input
                      placeholder="Middle Name"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.middle_name}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })}
                    />
                    <input
                      placeholder="Last Name"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                    />
                    <input
                      placeholder="Designation"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.designation}
                      onChange={e => setForm({ ...form, designation: e.target.value })}
                    />
                    <input
                      placeholder="Contact Email"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white col-span-2"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                    />
                    <input
                      placeholder="Contact Mobile"
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.contact_mobile}
                      onChange={e => setForm({ ...form, contact_mobile: e.target.value })}
                    />
                    <select
                      className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="Passive">Passive</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetails;
