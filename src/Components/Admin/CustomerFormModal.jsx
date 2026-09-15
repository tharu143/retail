// src/Components/Admin/CustomerFormModal.jsx
import React, { useState, useEffect } from 'react';
import {
  User, Save, X, ChevronDown, Check, Sparkles,
  Lock, Snowflake, PauseCircle, UserCheck, Bell,
  AlertTriangle, ShieldAlert, Shield, FileText, Loader2,
  ChevronLeft, ChevronRight, Pencil, AlertOctagon,
  Building2, Layers, Globe, Briefcase, Award, Percent, DollarSign, Clock,
  Smartphone, Mail, Hash, MapPin, Contact
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import './CustomerFormModal.css';
import AttachmentSection from './AttachmentSection';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

const countryPhoneCodes = {
  'afghanistan': '+93', 'aland islands': '+358', 'albania': '+355', 'algeria': '+213', 'american samoa': '+1', 'andorra': '+376', 'angola': '+244', 'anguilla': '+1', 'antarctica': '+672', 'antigua and barbuda': '+1', 'argentina': '+54', 'armenia': '+374', 'aruba': '+297', 'australia': '+61', 'austria': '+43', 'azerbaijan': '+994', 'bahamas': '+1', 'bahrain': '+973', 'bangladesh': '+880', 'barbados': '+1', 'belarus': '+375', 'belgium': '+32', 'belize': '+501', 'benin': '+229', 'bermuda': '+1', 'bhutan': '+975', 'bolivia': '+591', 'bonaire': '+599', 'bosnia and herzegovina': '+387', 'botswana': '+267', 'bouvet island': '+47', 'brazil': '+55', 'british indian ocean territory': '+246', 'british virgin islands': '+1', 'brunei': '+673', 'bulgaria': '+359', 'burkina faso': '+226', 'burundi': '+257', 'cambodia': '+855', 'cameroon': '+237', 'canada': '+1', 'cape verde': '+238', 'cayman islands': '+1', 'central african republic': '+236', 'chad': '+235', 'chile': '+56', 'china': '+86', 'christmas island': '+61', 'cocos islands': '+61', 'colombia': '+57', 'comoros': '+269', 'cook islands': '+682', 'costa rica': '+506', 'croatia': '+385', 'cuba': '+53', 'curacao': '+599', 'cyprus': '+357', 'czech republic': '+420', 'czechia': '+420', 'democratic republic of the congo': '+243', 'denmark': '+45', 'djibouti': '+253', 'dominica': '+1', 'dominican republic': '+1', 'ecuador': '+593', 'egypt': '+20', 'el salvador': '+503', 'equatorial guinea': '+240', 'eritrea': '+291', 'estonia': '+372', 'eswatini': '+268', 'ethiopia': '+251', 'falkland islands': '+500', 'faroe islands': '+298', 'fiji': '+679', 'finland': '+358', 'france': '+33', 'french guiana': '+594', 'french polynesia': '+689', 'french southern territories': '+262', 'gabon': '+241', 'gambia': '+220', 'georgia': '+995', 'germany': '+49', 'ghana': '+233', 'gibraltar': '+350', 'greece': '+30', 'greenland': '+299', 'grenada': '+1', 'guadeloupe': '+590', 'guam': '+1', 'guatemala': '+502', 'guernsey': '+44', 'guinea': '+224', 'guinea-bissau': '+245', 'guyana': '+592', 'haiti': '+509', 'heard island and mcdonald islands': '+672', 'honduras': '+504', 'hong kong': '+852', 'hungary': '+36', 'iceland': '+354', 'india': '+91', 'indonesia': '+62', 'iran': '+98', 'iraq': '+964', 'ireland': '+353', 'isle of man': '+44', 'israel': '+972', 'italy': '+39', 'ivory coast': '+225', 'jamaica': '+1', 'japan': '+81', 'jersey': '+44', 'jordan': '+962', 'kazakhstan': '+7', 'kenya': '+254', 'kiribati': '+686', 'kosovo': '+383', 'kuwait': '+965', 'kyrgyzstan': '+996', 'laos': '+856', 'latvia': '+371', 'lebanon': '+961', 'lesotho': '+266', 'liberia': '+231', 'libya': '+218', 'liechtenstein': '+423', 'lithuania': '+370', 'luxembourg': '+352', 'macao': '+853', 'madagascar': '+261', 'malawi': '+265', 'malaysia': '+60', 'maldives': '+960', 'mali': '+223', 'malta': '+356', 'marshall islands': '+692', 'martinique': '+596', 'mauritania': '+222', 'mauritius': '+230', 'mayotte': '+262', 'mexico': '+52', 'micronesia': '+691', 'moldova': '+373', 'mongolia': '+976', 'montenegro': '+382', 'montserrat': '+1', 'morocco': '+212', 'mozambique': '+258', 'myanmar': '+95', 'namibia': '+264', 'nauru': '+674', 'nepal': '+977', 'netherlands': '+31', 'new caledonia': '+687', 'new zealand': '+64', 'nicaragua': '+505', 'niger': '+227', 'nigeria': '+234', 'niue': '+683', 'norfolk island': '+672', 'north korea': '+850', 'north macedonia': '+389', 'northern mariana islands': '+1', 'norway': '+47', 'oman': '+968', 'pakistan': '+92', 'palau': '+680', 'palestine': '+970', 'panama': '+507', 'papua new guinea': '+675', 'paraguay': '+595', 'peru': '+51', 'philippines': '+63', 'pitcairn': '+64', 'poland': '+48', 'portugal': '+351', 'puerto rico': '+1', 'qatar': '+974', 'republic of the congo': '+242', 'reunion': '+262', 'romania': '+40', 'russia': '+7', 'rwanda': '+250', 'saint barthelemy': '+590', 'saint helena': '+290', 'saint kitts and nevis': '+1', 'saint lucia': '+1', 'saint martin': '+590', 'saint pierre and miquelon': '+508', 'saint vincent and the grenadines': '+1', 'samoa': '+685', 'san marino': '+378', 'sao tome and principe': '+239', 'saudi arabia': '+966', 'ksa': '+966', 'senegal': '+221', 'serbia': '+381', 'seychelles': '+248', 'sierra leone': '+232', 'singapore': '+65', 'sint maarten': '+1', 'slovakia': '+421', 'slovenia': '+386', 'solomon islands': '+677', 'somalia': '+252', 'south africa': '+27', 'south georgia and the south sandwich islands': '+500', 'south korea': '+82', 'south sudan': '+211', 'spain': '+34', 'sri lanka': '+94', 'sudan': '+249', 'suriname': '+597', 'svalbard and jan mayen': '+47', 'sweden': '+46', 'switzerland': '+41', 'syria': '+963', 'taiwan': '+886', 'tajikistan': '+992', 'tanzania': '+255', 'thailand': '+66', 'timor leste': '+670', 'togo': '+228', 'tokelau': '+690', 'tonga': '+676', 'trinidad and tobago': '+1', 'tunisia': '+216', 'turkey': '+90', 'turkmenistan': '+993', 'turks and caicos islands': '+1', 'tuvalu': '+688', 'u.s. virgin islands': '+1', 'uganda': '+256', 'ukraine': '+380', 'united arab emirates': '+971', 'uae': '+971', 'united kingdom': '+44', 'uk': '+44', 'united states': '+1', 'usa': '+1', 'uruguay': '+598', 'uzbekistan': '+998', 'vanuatu': '+678', 'vatican': '+379', 'venezuela': '+58', 'vietnam': '+84', 'wallis and futuna': '+681', 'western sahara': '+212', 'yemen': '+967', 'zambia': '+260', 'zimbabwe': '+263'
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

export default function CustomerFormModal({
  isOpen,
  onClose,
  onSave,
  editingCustomer = null,
  userWarehouse = null,
  inline = false,
  themeColor = '#0082f6'
}) {
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const effectiveWarehouse = userWarehouse || warehouse;

  const [activeTab, setActiveTab] = useState(1);
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState({
    customer_group: [],
    territory: [],
    customer_type: ['Individual', 'Company'],
    salutations: [],
    address_type: [],
    emirates: [],
    countries: [],
    price_lists: [],
    tax_categories: [],
    payment_terms: [],
    loyalty_programs: [],
    warehouses: [],
    account_managers: [],
    prospects: []
  });

  const [form, setForm] = useState({
    customer_name: '', mobile_no: '+971', email_id: '', salutation: '',
    customer_type: 'Individual', customer_group: 'All Customer Groups',
    territory: 'All Territories', gender: '', tax_id: '', custom_trn: '',
    account_manager: '', prospect_name: '', image: '',
    default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
    customer_details: '', tax_category: '', payment_terms: '',
    loyalty_program: '', loyalty_program_tier: '',
    disabled: 0, is_frozen: 0,
    address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
    first_name: '', middle_name: '', last_name: '', designation: '',
    contact_email: '', contact_mobile: '', status: 'Passive',
    custom_phone_code: '+971',
    custom_branch: effectiveWarehouse || '',
    branch_availability: effectiveWarehouse ? [{ warehouse: effectiveWarehouse }] : []
  });

  useEffect(() => {
    if (editingCustomer) {
      const addr = editingCustomer.addresses?.[0] || editingCustomer.address_data || {};
      const cont = editingCustomer.contacts?.[0] || editingCustomer.contact_data || {};
      const editCountry = addr.country || editingCustomer.country || 'United Arab Emirates';
      const normCountry = editCountry.toLowerCase().trim();
      const derivedCode = countryPhoneCodes[normCountry] || '+971';

      setForm({
        customer_name: editingCustomer.customer_name || '',
        mobile_no: editingCustomer.mobile_no || editingCustomer.mobile || '',
        email_id: editingCustomer.email_id || editingCustomer.email || '',
        salutation: editingCustomer.salutation || '',
        customer_type: editingCustomer.customer_type || 'Individual',
        customer_group: editingCustomer.customer_group || 'All Customer Groups',
        territory: editingCustomer.territory || 'All Territories',
        gender: editingCustomer.gender || '',
        tax_id: editingCustomer.tax_id || '',
        custom_trn: editingCustomer.custom_trn || '',
        account_manager: editingCustomer.account_manager || '',
        prospect_name: editingCustomer.prospect_name || '',
        image: editingCustomer.image || '',
        default_price_list: editingCustomer.default_price_list || '',
        is_internal_customer: editingCustomer.is_internal_customer || 0,
        customer_pos_id: editingCustomer.customer_pos_id || '',
        customer_details: editingCustomer.customer_details || '',
        tax_category: editingCustomer.tax_category || '',
        payment_terms: editingCustomer.payment_terms || '',
        loyalty_program: editingCustomer.loyalty_program || '',
        loyalty_program_tier: editingCustomer.loyalty_program_tier || '',
        disabled: editingCustomer.disabled || 0,
        is_frozen: editingCustomer.is_frozen || 0,
        address_type: addr.address_type || editingCustomer.address_type || 'Billing',
        address_line1: addr.address_line1 || editingCustomer.address_line1 || '',
        address_line2: addr.address_line2 || editingCustomer.address_line2 || '',
        city: addr.city || editingCustomer.city || '',
        emirate: addr.state || addr.emirate || editingCustomer.emirate || '',
        country: editCountry,
        first_name: cont.first_name || editingCustomer.first_name || '',
        middle_name: cont.middle_name || editingCustomer.middle_name || '',
        last_name: cont.last_name || editingCustomer.last_name || '',
        designation: cont.designation || editingCustomer.designation || '',
        contact_email: cont.email_id || editingCustomer.contact_email || '',
        contact_mobile: cont.mobile_no || editingCustomer.contact_mobile || '',
        status: cont.status || editingCustomer.status || 'Passive',
        custom_phone_code: editingCustomer.custom_phone_code || derivedCode,
        custom_branch: editingCustomer.custom_branch || effectiveWarehouse || '',
        branch_availability: editingCustomer.branch_availability || (effectiveWarehouse ? [{ warehouse: effectiveWarehouse }] : [])
      });
    } else {
      setForm({
        customer_name: '', mobile_no: '+971', email_id: '', salutation: '',
        customer_type: 'Individual', customer_group: 'All Customer Groups',
        territory: 'All Territories', gender: '', tax_id: '', custom_trn: '',
        account_manager: '', prospect_name: '', image: '',
        default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
        customer_details: '', tax_category: '', payment_terms: '',
        loyalty_program: '', loyalty_program_tier: '',
        disabled: 0, is_frozen: 0,
        address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
        first_name: '', middle_name: '', last_name: '', designation: '',
        contact_email: '', contact_mobile: '', status: 'Passive',
        custom_phone_code: '+971',
        custom_branch: effectiveWarehouse || '',
        branch_availability: effectiveWarehouse ? [{ warehouse: effectiveWarehouse }] : []
      });
    }
  }, [editingCustomer, isOpen]);

  useEffect(() => {
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
      } catch (err) { console.error('Meta fetch failed', err); }
    };
    if (isOpen || inline) fetchMeta();
  }, [isOpen, inline]);

  const handleSave = async () => {
    if (!form.customer_name || !form.customer_name.trim()) {
      setActiveTab(1);
      Swal.fire({ icon: 'warning', title: 'Missing Data', text: 'Customer Name is required in Opportunity Details.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_data: {
          ...form,
          name: editingCustomer ? editingCustomer.name : undefined,
          custom_branch: !editingCustomer ? (!isAdmin ? effectiveWarehouse : form.custom_branch) : form.custom_branch,
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
          timer: 2000,
          showConfirmButton: false,
          text: editingCustomer ? 'Customer profile updated successfully.' : 'Customer created successfully.'
        });
        if (onSave) onSave(res.data.message.data || payload);
        if (onClose) onClose();
      } else throw new Error(res.data.message?.message || 'Save operation failed');
    } catch (err) {
      Swal.fire('Save Failure', err.message || 'Error occurred while saving customer record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [editingSummarySection, setEditingSummarySection] = useState(null);
  const [summarySnapshot, setSummarySnapshot] = useState(null);

  const handleStartSummaryEdit = (sectionKey, tabId, elementId, e) => {
    if (e) e.stopPropagation();
    setSummarySnapshot({ ...form });
    setEditingSummarySection(sectionKey);
    handleEditSection(tabId, elementId);
  };

  const handleSaveSummaryEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingSummarySection(null);
    setSummarySnapshot(null);
    Swal.fire({
      icon: 'success',
      title: 'Details Saved',
      text: 'Summary changes applied to form.',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const handleCancelSummaryEdit = (e) => {
    if (e) e.stopPropagation();
    if (summarySnapshot) {
      setForm(summarySnapshot);
    }
    setEditingSummarySection(null);
    setSummarySnapshot(null);
  };

  const handleEditSection = (tabId, elementId) => {
    setActiveTab(tabId);
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = el.querySelector('input, select, textarea');
        if (input) {
          input.focus();
          if (typeof input.select === 'function') input.select();
        }
      }
    }, 100);
  };

  if (!isOpen && !inline) return null;

  const containerClass = inline
    ? "customer-form-canvas w-full min-h-full flex flex-col bg-[#f8fafc]"
    : "customer-form-canvas bg-[#f8fafc] w-full max-w-[1550px] h-full max-h-[96vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200";

  const tabs = [
    { id: 1, name: '1. OPPORTUNITY & DEAL DETAILS' },
    { id: 2, name: '2. SOURCE & ASSIGNMENT' },
    { id: 3, name: '3. ADDITIONAL INFO & BRANCH AVAILABILITY' }
  ];

  const formContent = (
    <div className={containerClass}>
      {/* 1. Modal Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-7 py-4 shrink-0">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80 shrink-0">
              <User size={22} />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight m-0" style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                {editingCustomer ? 'EDIT CUSTOMER REGISTRY' : 'NEW CUSTOMER REGISTRY'}
              </h1>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 font-medium text-[12px] rounded-full border border-slate-200/60">
                {editingCustomer ? 'Saved' : 'Draft / not saved'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.customer_name}
              className="customer-save-btn flex items-center gap-2 px-5 py-2 text-white bg-[#0082f6] hover:bg-[#0070f3] rounded-full text-[13px] font-semibold shadow-xs transition-all cursor-pointer hover:brightness-110"
              style={{ backgroundColor: '#0082f6' }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving...' : (editingCustomer ? 'Save Customer' : 'Create Customer')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Stepper Bar */}
      <div className="customer-stepper-bar-container overflow-x-auto shrink-0">
        <div className="max-w-[1600px] w-full mx-auto flex items-center gap-3 min-w-max">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const isCompleted = activeTab > tab.id;

            return (
              <React.Fragment key={tab.id}>
                {idx > 0 && <div className="customer-stepper-line" />}

                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`customer-stepper-pill ${isActive ? 'active' : isCompleted ? 'completed' : 'inactive'}`}
                >
                  {isCompleted ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-extrabold ${isActive ? 'bg-[#0284c7] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {tab.id}
                    </span>
                  )}
                  <span>{tab.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. Main Two-Column Content Area */}
      <div className="p-6 sm:p-7 bg-[#f1f5f9] flex-1 overflow-y-auto">
        <div className="max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row gap-7 items-start">

          {/* Left Column: Form Cards */}
          <div className="flex-1 w-full space-y-6">

            {/* STEP 1: Opportunity Details */}
            {activeTab === 1 && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="customer-form-card" id="sec-opportunity-details">
                  <div className="customer-form-card-header">
                    <div className="customer-form-card-title-number">1</div>
                    <div>
                      <div className="customer-form-card-title-text">Opportunity Details</div>
                      <div className="customer-form-card-subtitle-text">Basic customer and profile information</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.customer_name}
                        onChange={e => setForm({ ...form, customer_name: e.target.value })}
                        placeholder="e.g. Acme Corp - Primary Corporate Customer"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">
                        Customer Group <span className="text-rose-500">*</span>
                      </label>
                      <select
                        className="customer-form-field-select"
                        value={form.customer_group}
                        onChange={e => setForm({ ...form, customer_group: e.target.value })}
                      >
                        {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">Customer Type</label>
                      <select
                        className="customer-form-field-select"
                        value={form.customer_type}
                        onChange={e => setForm({ ...form, customer_type: e.target.value })}
                      >
                        {meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">Territory</label>
                      <select
                        className="customer-form-field-select"
                        value={form.territory}
                        onChange={e => setForm({ ...form, territory: e.target.value })}
                      >
                        {meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">Salutation</label>
                      <select
                        className="customer-form-field-select"
                        value={form.salutation}
                        onChange={e => setForm({ ...form, salutation: e.target.value })}
                      >
                        <option value="">NA</option>
                        {meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">Gender Profile</label>
                      <select
                        className="customer-form-field-select"
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

                {/* Deal Information Card */}
                <div className="customer-form-card" id="sec-deal-information">
                  <div className="customer-form-card-header">
                    <div className="customer-form-card-title-number">2</div>
                    <div>
                      <div className="customer-form-card-title-text">Deal Information</div>
                      <div className="customer-form-card-subtitle-text">Contact and address information</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">EMAIL ID</label>
                      <input
                        type="email"
                        className="customer-form-field-input"
                        value={form.email_id}
                        onChange={e => setForm({ ...form, email_id: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">MOBILE NO</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.mobile_no}
                        onChange={e => { const val = e.target.value; const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971'; setForm({ ...form, mobile_no: sanitizeMobileNo(val, code) }); }} onBlur={() => { const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971'; setForm(prev => ({ ...prev, mobile_no: sanitizeMobileNo(prev.mobile_no, code) })); }}
                        placeholder="+971"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">ADDRESS TYPE</label>
                      <select
                        className="customer-form-field-select"
                        value={form.address_type}
                        onChange={e => setForm({ ...form, address_type: e.target.value })}
                      >
                        <option value="Billing">Billing</option>
                        <option value="Shipping">Shipping</option>
                        <option value="Office">Office</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">CITY STATION</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                        placeholder="Dubai / Abu Dhabi"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">EMIRATE HUB</label>
                      <select
                        className="customer-form-field-select"
                        value={form.emirate}
                        onChange={e => setForm({ ...form, emirate: e.target.value })}
                      >
                        <option value="">Select Emirate</option>
                        {meta.emirates?.map(em => <option key={em} value={em}>{em}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">COUNTRY</label>
                      <select
                        className="customer-form-field-select"
                        value={form.country}
                        onChange={e => {
                          const newCountry = e.target.value;
                          const norm = newCountry.toLowerCase().trim();
                          const newCode = countryPhoneCodes[norm] || '+971';
                          setForm(prev => ({
                            ...prev,
                            country: newCountry,
                            custom_phone_code: newCode,
                            mobile_no: getUpdatedPhone(prev.mobile_no, newCode)
                          }));
                        }}
                      >
                        {meta.countries?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">BUILDING / STREET LINE 1</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.address_line1}
                        onChange={e => setForm({ ...form, address_line1: e.target.value })}
                        placeholder="Building / Street Line 1"
                      />
                    </div>

                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">ADDRESS LINE 2</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.address_line2}
                        onChange={e => setForm({ ...form, address_line2: e.target.value })}
                        placeholder="Address Line 2"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 2: Source & Assignment */}
            {activeTab === 2 && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="customer-form-card" id="sec-source-assignment">
                  <div className="customer-form-card-header">
                    <div className="customer-form-card-title-number">3</div>
                    <div>
                      <div className="customer-form-card-title-text">Source & Assignment</div>
                      <div className="customer-form-card-subtitle-text">Source details and assignment information</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">TAX ID</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.tax_id}
                        onChange={e => setForm({ ...form, tax_id: e.target.value })}
                        placeholder="Tax Identification Number"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">TRN</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.custom_trn}
                        onChange={e => setForm({ ...form, custom_trn: e.target.value })}
                        placeholder="Enter 15-digit TRN"
                      />
                    </div>

                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">TAX CATEGORY</label>
                      <select
                        className="customer-form-field-select"
                        value={form.tax_category}
                        onChange={e => setForm({ ...form, tax_category: e.target.value })}
                      >
                        <option value="">Default</option>
                        {meta.tax_categories?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group col-span-1 md:col-span-2">
                      <label className="customer-form-field-label">PROFILE IMAGE URL</label>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          className="customer-form-field-input flex-1"
                          value={form.image}
                          onChange={e => setForm({ ...form, image: e.target.value })}
                          placeholder="e.g. https://example.com/avatar.jpg"
                        />
                      </div>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">PRICING MATRIX</label>
                      <select
                        className="customer-form-field-select"
                        value={form.default_price_list}
                        onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                      >
                        <option value="">System Standard</option>
                        {meta.price_lists?.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">PAYMENT TERMS PROTOCOL</label>
                      <select
                        className="customer-form-field-select"
                        value={form.payment_terms}
                        onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                      >
                        <option value="">Direct</option>
                        {meta.payment_terms?.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">LOYALTY HUB LINK</label>
                      <select
                        className="customer-form-field-select"
                        value={form.loyalty_program}
                        onChange={e => setForm({ ...form, loyalty_program: e.target.value })}
                      >
                        <option value="">None</option>
                        {meta.loyalty_programs?.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">ACCOUNT SUPERVISOR</label>
                      <select
                        className="customer-form-field-select"
                        value={form.account_manager}
                        onChange={e => setForm({ ...form, account_manager: e.target.value })}
                      >
                        <option value="">Select Supervisor</option>
                        {meta.account_managers?.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">CUSTOMER POS IDENT</label>
                      <input
                        type="text"
                        className="customer-form-field-input"
                        value={form.customer_pos_id}
                        onChange={e => setForm({ ...form, customer_pos_id: e.target.value })}
                        placeholder="POS ID"
                      />
                    </div>

                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">PROSPECT ALIAS</label>
                      <select
                        className="customer-form-field-select"
                        value={form.prospect_name}
                        onChange={e => setForm({ ...form, prospect_name: e.target.value })}
                      >
                        <option value="">Select Prospect</option>
                        {meta.prospects?.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="w-full">
                  <AttachmentSection doctype="Customer" docname={editingCustomer?.name || editingCustomer?.id || editingCustomer?.customer_name || null} />
                </div>
              </div>
            )}

            {/* STEP 3: Combined Additional Information & Branch Availability */}
            {activeTab === 3 && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* Section 4: Additional Information */}
                <div className="customer-form-card" id="sec-additional-info">
                  <div className="customer-form-card-header">
                    <div className="customer-form-card-title-number">4</div>
                    <div>
                      <div className="customer-form-card-title-text">Additional Information</div>
                      <div className="customer-form-card-subtitle-text">Status, contact person and other details</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    {/* Status Checkboxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'disabled', label: 'DISABLED', icon: AlertOctagon, color: '#ef4444' },
                        { id: 'is_frozen', label: 'IS FROZEN', icon: Snowflake, color: '#3b82f6' },
                        { id: 'is_internal_customer', label: 'INTERNAL CUSTOMER', icon: User, color: '#f59e0b' }
                      ].map(check => {
                        const Icon = check.icon;
                        const isChecked = form[check.id] === 1 || form[check.id] === true;
                        return (
                          <label key={check.id} className={`customer-checkbox-card ${isChecked ? 'checked' : ''}`}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 cursor-pointer"
                              style={{ accentColor: themeColor }}
                              checked={isChecked}
                              onChange={e => setForm({ ...form, [check.id]: e.target.checked ? 1 : 0 })}
                            />
                            <div className="flex items-center gap-2">
                              <Icon size={16} style={{ color: check.color }} />
                              <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase">{check.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Primary Contact Person Profile */}
                    <div className="space-y-2">
                      <label className="customer-form-field-label">PRIMARY CONTACT PERSON PROFILE</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          placeholder="First Name"
                          className="customer-form-field-input"
                          value={form.first_name}
                          onChange={e => setForm({ ...form, first_name: e.target.value })}
                        />
                        <input
                          placeholder="Last Name"
                          className="customer-form-field-input"
                          value={form.last_name}
                          onChange={e => setForm({ ...form, last_name: e.target.value })}
                        />
                        <input
                          placeholder="Designation"
                          className="customer-form-field-input"
                          value={form.designation}
                          onChange={e => setForm({ ...form, designation: e.target.value })}
                        />
                        <select
                          value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          className="customer-form-field-select"
                        >
                          <option value="Passive">Passive</option>
                          <option value="Active">Active</option>
                        </select>
                        <input
                          placeholder="Mobile No"
                          className="customer-form-field-input"
                          value={form.contact_mobile}
                          onChange={e => setForm({ ...form, contact_mobile: e.target.value })}
                        />
                        <input
                          placeholder="Contact Email"
                          className="customer-form-field-input"
                          value={form.contact_email}
                          onChange={e => setForm({ ...form, contact_email: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Customer Details Textarea */}
                    <div className="customer-form-field-group">
                      <label className="customer-form-field-label">Customer Details</label>
                      <textarea
                        className="customer-form-field-textarea"
                        value={form.customer_details}
                        onChange={e => setForm({ ...form, customer_details: e.target.value })}
                        placeholder="Enter customer details or description notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Branch Availability (Combined) */}
                <div className="customer-form-card" id="sec-branch-availability">
                  <div className="customer-form-card-header">
                    <div className="customer-form-card-title-number">5</div>
                    <div>
                      <div className="customer-form-card-title-text">Branch Availability</div>
                      <div className="customer-form-card-subtitle-text">Select branches where this customer can be used:</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto p-1">
                    {meta.warehouses?.map(wh => {
                      const isChecked = form.branch_availability?.some(b => b.warehouse === wh);
                      return (
                        <label key={wh} className={`customer-checkbox-card ${isChecked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 cursor-pointer"
                            style={{ accentColor: themeColor }}
                            checked={isChecked}
                            onChange={e => {
                              const updated = e.target.checked
                                ? [...form.branch_availability, { warehouse: wh }]
                                : form.branch_availability.filter(b => b.warehouse !== wh);
                              setForm({ ...form, branch_availability: updated });
                            }}
                          />
                          <span className="text-[11px] font-bold text-slate-700 truncate">{wh}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>


              </div>
            )}
          </div>

          {/* Right Column: Sticky Live Summary Sidebar */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="customer-live-summary-card">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: themeColor }} />
                  <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Live Customer Profile</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {form.customer_type}
                </span>
              </div>

              <div className="customer-live-summary-body max-h-[calc(100vh-230px)] sm:max-h-[620px] overflow-y-auto pr-1">
                {/* 1. Opportunity Details */}
                <div className="customer-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">1. Opportunity Details</span>
                    <button type="button" onClick={(e) => handleStartSummaryEdit('opportunity', 1, 'sec-opportunity-details', e)} className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                  {editingSummarySection === 'opportunity' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Customer Name *</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.customer_name}
                          onChange={e => setForm({ ...form, customer_name: e.target.value })}
                          placeholder="e.g. Acme Corp"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Customer Group *</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.customer_group}
                          onChange={e => setForm({ ...form, customer_group: e.target.value })}
                        >
                          {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Customer Type</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.customer_type}
                          onChange={e => setForm({ ...form, customer_type: e.target.value })}
                        >
                          {meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Territory</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.territory}
                          onChange={e => setForm({ ...form, territory: e.target.value })}
                        >
                          {meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Salutation</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.salutation}
                          onChange={e => setForm({ ...form, salutation: e.target.value })}
                        >
                          <option value="">NA</option>
                          {meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Gender Profile</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.gender}
                          onChange={e => setForm({ ...form, gender: e.target.value })}
                        >
                          <option value="">NA</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('opportunity', 1, 'sec-opportunity-details', e)}>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Customer Name:</span><span className="customer-summary-v">{form.customer_name || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Customer Group:</span><span className="customer-summary-v">{form.customer_group || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Customer Type:</span><span className="customer-summary-v">{form.customer_type || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Territory:</span><span className="customer-summary-v">{form.territory || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Salutation:</span><span className="customer-summary-v">{form.salutation || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Gender Profile:</span><span className="customer-summary-v">{form.gender || '—'}</span></div>
                    </div>
                  )}
                </div>

                {/* 2. Deal Information (Contact & Address) */}
                <div className="customer-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">2. Deal Information</span>
                    <button type="button" onClick={(e) => handleStartSummaryEdit('deal', 1, 'sec-deal-information', e)} className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                  {editingSummarySection === 'deal' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Email ID</label>
                        <input
                          type="email"
                          className="live-summary-edit-input"
                          value={form.email_id}
                          onChange={e => setForm({ ...form, email_id: e.target.value })}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Mobile No</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.mobile_no}
                          onChange={e => { const val = e.target.value; const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971'; setForm({ ...form, mobile_no: sanitizeMobileNo(val, code) }); }} onBlur={() => { const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971'; setForm(prev => ({ ...prev, mobile_no: sanitizeMobileNo(prev.mobile_no, code) })); }}
                          placeholder="+971"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Address Type</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.address_type}
                          onChange={e => setForm({ ...form, address_type: e.target.value })}
                        >
                          <option value="Billing">Billing</option>
                          <option value="Shipping">Shipping</option>
                          <option value="Office">Office</option>
                          <option value="Personal">Personal</option>
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>City Station</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.city}
                          onChange={e => setForm({ ...form, city: e.target.value })}
                          placeholder="City"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Emirate Hub</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.emirate}
                          onChange={e => setForm({ ...form, emirate: e.target.value })}
                        >
                          <option value="">Select Emirate</option>
                          {meta.emirates?.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Country</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.country}
                          onChange={e => setForm({ ...form, country: e.target.value })}
                        >
                          {meta.countries?.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('deal', 1, 'sec-deal-information', e)}>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Email ID:</span><span className="customer-summary-v">{form.email_id || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Mobile No:</span><span className="customer-summary-v">{form.mobile_no || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Address Type:</span><span className="customer-summary-v">{form.address_type || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">City Station:</span><span className="customer-summary-v">{form.city || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Emirate Hub:</span><span className="customer-summary-v">{form.emirate || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Country:</span><span className="customer-summary-v">{form.country || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Building Line 1:</span><span className="customer-summary-v truncate max-w-[140px]">{form.address_line1 || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Address Line 2:</span><span className="customer-summary-v truncate max-w-[140px]">{form.address_line2 || '—'}</span></div>
                    </div>
                  )}
                </div>

                {/* 3. Source & Assignment */}
                <div className="customer-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">3. Source & Assignment</span>
                    <button type="button" onClick={(e) => handleStartSummaryEdit('source', 2, 'sec-source-assignment', e)} className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                  {editingSummarySection === 'source' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Tax ID</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.tax_id}
                          onChange={e => setForm({ ...form, tax_id: e.target.value })}
                          placeholder="Tax ID"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>TRN</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.custom_trn}
                          onChange={e => setForm({ ...form, custom_trn: e.target.value })}
                          placeholder="TRN"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Tax Category</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.tax_category}
                          onChange={e => setForm({ ...form, tax_category: e.target.value })}
                        >
                          <option value="">Default</option>
                          {meta.tax_categories?.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Pricing Matrix</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.default_price_list}
                          onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                        >
                          <option value="">System Standard</option>
                          {meta.price_lists?.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Payment Terms</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.payment_terms}
                          onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                        >
                          <option value="">Direct</option>
                          {meta.payment_terms?.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('source', 2, 'sec-source-assignment', e)}>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Tax ID:</span><span className="customer-summary-v">{form.tax_id || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">TRN:</span><span className="customer-summary-v">{form.custom_trn || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Tax Category:</span><span className="customer-summary-v">{form.tax_category || 'Default'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Photo / Logo:</span><span className="customer-summary-v">{form.image ? 'Uploaded' : 'None'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Pricing Matrix:</span><span className="customer-summary-v">{form.default_price_list || 'System Standard'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Payment Terms:</span><span className="customer-summary-v">{form.payment_terms || 'Direct'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Loyalty Hub Link:</span><span className="customer-summary-v">{form.loyalty_program || 'None'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Account Supervisor:</span><span className="customer-summary-v">{form.account_manager || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Customer POS Ident:</span><span className="customer-summary-v">{form.customer_pos_id || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Prospect Alias:</span><span className="customer-summary-v">{form.prospect_name || '—'}</span></div>
                    </div>
                  )}
                </div>

                {/* 4. Controls & Branch Availability */}
                <div className="customer-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">4. Controls & Branch</span>
                    <button type="button" onClick={(e) => handleStartSummaryEdit('controls', 3, 'sec-additional-info', e)} className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                  {editingSummarySection === 'controls' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Disabled</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.disabled ? 1 : 0}
                          onChange={e => setForm({ ...form, disabled: Number(e.target.value) })}
                        >
                          <option value={0}>Active</option>
                          <option value={1}>Disabled</option>
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Is Frozen</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.is_frozen ? 1 : 0}
                          onChange={e => setForm({ ...form, is_frozen: Number(e.target.value) })}
                        >
                          <option value={0}>No</option>
                          <option value={1}>Yes</option>
                        </select>
                      </div>
                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('controls', 3, 'sec-additional-info', e)}>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Disabled:</span><span className="customer-summary-v">{form.disabled ? 'Yes' : 'No'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Is Frozen:</span><span className="customer-summary-v">{form.is_frozen ? 'Yes' : 'No'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Internal Customer:</span><span className="customer-summary-v">{form.is_internal_customer ? 'Yes' : 'No'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Primary Contact:</span><span className="customer-summary-v">{[form.first_name, form.last_name].filter(Boolean).join(' ') || '—'}</span></div>
                      <div className="customer-summary-kv-row"><span className="customer-summary-k">Branches Available:</span><span className="customer-summary-v">{form.branch_availability?.length || 0} Selected</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  if (inline) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 z-[11000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fadeIn" onClick={onClose}>
      <div className="w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {formContent}
      </div>
    </div>
  );
}
