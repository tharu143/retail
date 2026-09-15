import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  Globe, Tag, Receipt, Layers, ShoppingCart, Edit2, Save, X,
  Clock, Award, User, Briefcase, Hash, FileText, ShieldCheck,
  UserPlus, Shield, UserCircle2, Percent, Warehouse, Plus, Trash2,
  ChevronDown, ChevronUp, RotateCcw, Calendar, Filter, Info, ArrowRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './CustomerDetails.css';
import AttachmentSection from './AttachmentSection';
import LoyaltyCardModal from './LoyaltyCardModal';
import { CreditCard } from 'lucide-react';
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
  <div className="info-field-box">
    <div className="flex items-center gap-1.5 min-w-0">
      {Icon && <Icon size={13} style={{ color: themeColor || '#0082f6' }} strokeWidth={2} className="shrink-0" />}
      <span className="info-field-label">{label}</span>
    </div>
    <div className="info-field-value">
      {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
    </div>
  </div>
);

const SectionHeader = ({ text, themeColor, icon: Icon }) => (
  <div className="info-panel-header">
    {Icon ? <Icon size={18} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} /> : <div className="w-1 h-3 rounded-full" style={{ backgroundColor: themeColor || '#0082f6' }} />}
    <h5 className="info-panel-title">{text}</h5>
  </div>
);

const CollapsibleSectionHeader = ({ text, themeColor, isOpen, onToggle, icon: Icon }) => {
  const ChevronIcon = isOpen ? ChevronUp : ChevronDown;
  return (
    <div
      className="info-panel-header justify-between cursor-pointer select-none"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? <Icon size={18} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} /> : <div className="w-1 h-3 rounded-full" style={{ backgroundColor: themeColor || '#0082f6' }} />}
        <h5 className="info-panel-title">{text}</h5>
      </div>
      <div className="text-slate-400 hover:text-slate-600 transition-colors">
        <ChevronIcon size={16} strokeWidth={2.5} />
      </div>
    </div>
  );
};


/* ==================== MAIN COMPONENT ==================== */
const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { themeColor } = useLegacyTheme();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(isNew ? 'edit' : 'view'); // 'view' or 'edit'
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'loyalty'
  const [loyaltyLedger, setLoyaltyLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [loyaltyFromDate, setLoyaltyFromDate] = useState('');
  const [loyaltyToDate, setLoyaltyToDate] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Accordion open/collapse states for sections
  const [isSpatialOpen, setIsSpatialOpen] = useState(true);
  const [isContactOpen, setIsContactOpen] = useState(true);

  const getInputStyle = (fieldId) => ({
    borderColor: focusedField === fieldId ? themeColor : '#e2e8f0',
    boxShadow: focusedField === fieldId ? `0 0 0 3px ${themeColor}15` : 'none',
    backgroundColor: '#ffffff',
    transition: 'all 0.2s ease-in-out',
    outline: 'none'
  });


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
    customer_type: 'Individual', customer_group: 'Retail Customer',
    territory: 'All Territories', gender: '', tax_id: '', custom_trn: '',
    account_manager: '', prospect_name: '', image: '',
    default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
    customer_details: '', tax_category: '', payment_terms: '',
    loyalty_program: '', loyalty_program_tier: '',
    disabled: 0, is_frozen: 0, custom_default_discount: 0,
    address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
    address_name: '', // Added to track existing address
    first_name: '', middle_name: '', last_name: '', designation: '',
    contact_email: '', contact_mobile: '', status: 'Passive',
    contact_name: '', // Added to track existing contact
    custom_phone_code: '+971',
    branch_availability: []
  });

  const fetchLoyaltyLedger = async (fromDate = loyaltyFromDate, toDate = loyaltyToDate) => {
    try {
      setLedgerLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_loyalty_ledger`, {
        params: {
          customer: id,
          from_date: fromDate || undefined,
          to_date: toDate || undefined
        }
      });
      setLoyaltyLedger(res.data.message || []);
    } catch (err) {
      console.error("Ledger fetch failed", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'loyalty' && id && id !== 'new') {
      fetchLoyaltyLedger();
    }
  }, [activeTab, id]);

  useEffect(() => {
    fetchMeta();
    setActiveTab('profile');
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
      const { customer: cust, addresses: addrList, contacts: contList, dashboard_data: data } = res.data.message.data;
      setCustomer(cust);
      setAddresses(addrList || []);
      setContacts(contList || []);
      setDashboardData(data || {});

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
        customer_group: cust.customer_group || 'Retail Customer',
        territory: cust.territory || 'All Territories',
        gender: cust.gender || '',
        tax_id: cust.tax_id || '',
        custom_trn: cust.custom_trn || '',
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
        branch_availability: cust.branch_availability || [],
        custom_default_discount: cust.custom_default_discount || 0
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
    <div className="sd-container">
      {/* 1. TOP HEADER CARD */}
      <div className="sd-header-card">
        <div className="sd-header-left">
          {/* Avatar Box */}
          <div className="sd-avatar-box">
            {customer?.image ? (
              <img src={customer.image} alt={customer.customer_name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              customer?.customer_name ? customer.customer_name.charAt(0).toUpperCase() : 'C'
            )}
          </div>

          <div className="sd-title-area">
            <h1 className="sd-title">
              {isNew ? 'New Customer' : (viewMode === 'edit' ? `Editing: ${customer?.customer_name}` : customer?.customer_name)}
            </h1>

            {/* Dynamic Metadata Badges */}
            {!isNew && (
              <div className="sd-badges-row">
                <div className={`sd-badge ${customer?.disabled === 0 ? 'sd-badge-active' : 'sd-badge-disabled'}`}>
                  <span className={`sd-badge-dot ${customer?.disabled === 0 ? 'active' : 'disabled'}`} />
                  <span>{customer?.disabled === 0 ? 'Active' : 'Disabled'}</span>
                </div>

                {customer?.is_frozen === 1 && (
                  <div className="sd-badge">
                    <span className="sd-badge-val" style={{ color: '#0284c7' }}>Frozen</span>
                  </div>
                )}

                {customer?.is_internal_customer === 1 && (
                  <div className="sd-badge">
                    <span className="sd-badge-val" style={{ color: '#9333ea' }}>Internal</span>
                  </div>
                )}

                <div className="sd-badge">
                  <Users size={13} style={{ color: '#0082f6' }} />
                  <span className="sd-badge-label">Group</span>
                  <span className="sd-badge-val">{customer?.customer_group || '—'}</span>
                </div>

                <div className="sd-badge">
                  <Globe size={13} style={{ color: '#0082f6' }} />
                  <span className="sd-badge-val">{customer?.territory || 'All Territories'}</span>
                </div>

                <div className="sd-badge">
                  <Tag size={13} style={{ color: '#0082f6' }} />
                  <span className="sd-badge-label">Price List:</span>
                  <span className="sd-badge-val">{customer?.default_price_list || 'Standard Price List'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="sd-header-actions">
          {viewMode === 'view' ? (
            <>
              <button
                type="button"
                onClick={() => fetchCustomerData()}
                className="sd-icon-btn"
                title="Refresh Data"
              >
                <RotateCcw size={16} style={{ color: '#0082f6' }} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => navigate(`/generalledgerreport?party_type=Customer&party=${customer?.name}`)}
                className="sd-btn-ledger"
              >
                <FileText size={14} style={{ color: '#0082f6' }} />
                <span>General Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLoyaltyModal(true)}
                disabled={!customer?.loyalty_program}
                className="sd-btn-ledger"
                style={{ opacity: !customer?.loyalty_program ? 0.5 : 1, cursor: !customer?.loyalty_program ? 'not-allowed' : 'pointer' }}
              >
                <CreditCard size={14} style={{ color: '#0082f6' }} />
                <span>Print Card</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/customer-edit/${id}`)}
                className="sd-btn-edit"
              >
                <Edit2 size={14} />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => setViewMode('view')}
                  className="sd-btn-ledger"
                >
                  Discard
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="sd-btn-edit"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. NAVIGATION TABS BAR */}
      {viewMode === 'view' && !isNew && (
        <div className="sd-tabs-container">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`sd-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            style={activeTab === 'profile' ? { color: themeColor } : {}}
          >
            Profile Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('loyalty')}
            className={`sd-tab-btn ${activeTab === 'loyalty' ? 'active' : ''}`}
            style={activeTab === 'loyalty' ? { color: themeColor } : {}}
          >
            Loyalty Ledger ({customer?.loyalty_points ? parseFloat(customer.loyalty_points).toFixed(2) : '0.00'} pts)
          </button>
        </div>
      )}

      {viewMode === 'view' ? (
        activeTab === 'profile' ? (
          /* TWO-COLUMN DASHBOARD - VIEW PROFILE */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300 pb-12">

            {/* Attachment Section at the top */}
            <div className="lg:col-span-2">
              <AttachmentSection doctype="Customer" docname={id} />
            </div>

            {/* TOP FULL WIDTH ROW: Loyalty Balance Banner */}
            <div className="lg:col-span-2">
              <div
                className="rounded-[20px] p-3.5 sm:px-6 sm:py-3.5 shadow-xs border border-[#cce5ff] flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300"
                style={{ background: 'linear-gradient(90deg, #f0f7ff 0%, #e8f4fe 50%, #e0f2fe 100%)' }}
              >
                {/* Left side: Icon badge + Program Title */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 rounded-full bg-[#dbeafe] border border-[#bfdbfe]/60 flex items-center justify-center text-[#0082f6] shrink-0 shadow-xs">
                    <Award className="w-6 h-6 text-[#0082f6]" strokeWidth={2.2} />
                  </div>
                  <div className="h-9 w-[1px] bg-[#93c5fd]/50 hidden sm:block shrink-0" />
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#0284c7] block mb-0.5">LOYALTY PROGRAM</span>
                    <h4 className="text-lg sm:text-xl font-black text-[#0f2942] tracking-tight">{customer?.loyalty_program || 'Retail Customer Loyalty Plan'}</h4>
                  </div>
                </div>

                {/* Right side: View History Button + Available Points Dark Blue Card */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveTab('loyalty')}
                    className="sd-btn-view-history shrink-0"
                    style={{ borderRadius: '9999px' }}
                  >
                    <span>VIEW HISTORY</span>
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </button>

                  <div
                    className="rounded-[16px] py-3 px-5 text-white flex flex-col justify-center gap-1 shadow-md border border-white/10 shrink-0 min-w-[190px]"
                    style={{ background: 'linear-gradient(135deg, #0082f6 0%, #0284c7 100%)' }}
                  >
                    <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-white/85 gap-2">
                      <span>AVAILABLE POINTS</span>
                      <Info size={13} className="text-white/80 shrink-0" title="Available Loyalty Points balance" />
                    </div>
                    <div className="text-2xl sm:text-[28px] font-black text-white tracking-tight flex items-baseline gap-1.5 leading-none">
                      <span>{customer?.loyalty_points ? parseFloat(customer.loyalty_points).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}</span>
                      <span className="text-xs font-extrabold uppercase tracking-widest text-white/90">PTS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 1 LEFT: Panel 1 - Legal Identity details */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4 }} className="lg:col-span-1 info-panel-card h-full flex flex-col justify-between">
              <SectionHeader text="Legal Identity Profile" themeColor={themeColor} icon={User} />
              <div className="info-panel-body info-fields-grid flex-1">
                <DetailRow label="Legal Identity Name" value={customer?.customer_name} icon={User} themeColor={themeColor} />
                <DetailRow label="Salutation" value={customer?.salutation} icon={UserPlus} themeColor={themeColor} />
                <DetailRow label="Corporate Type" value={customer?.customer_type} icon={Building2} themeColor={themeColor} />
                <DetailRow label="Identity Group" value={customer?.customer_group} icon={Layers} themeColor={themeColor} />
                <DetailRow label="Territory Domain" value={customer?.territory} icon={Globe} themeColor={themeColor} />
                <DetailRow label="Gender" value={customer?.gender} icon={Users} themeColor={themeColor} />
                <DetailRow label="Profile Image Reference" value={customer?.image} icon={Tag} themeColor={themeColor} />
                <DetailRow label="Identity Registry Specs Details" value={customer?.customer_details} icon={FileText} themeColor={themeColor} />
              </div>
            </motion.div>

            {/* ROW 1 RIGHT: Panel 2 - Location and Geography details */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4, delay: 0.1 }} className="lg:col-span-1 info-panel-card h-full flex flex-col justify-between">
              <CollapsibleSectionHeader
                text="Deal & Spatial Information"
                themeColor={themeColor}
                icon={MapPin}
                isOpen={isSpatialOpen}
                onToggle={() => setIsSpatialOpen(!isSpatialOpen)}
              />
              {isSpatialOpen && (
                <div className="info-panel-body info-fields-grid flex-1 animate-in fade-in duration-200">
                  <DetailRow label="Email Id" value={customer?.email_id} icon={Mail} themeColor={themeColor} />
                  <DetailRow label="Mobile No" value={customer?.mobile_no} icon={Phone} themeColor={themeColor} />
                  <DetailRow label="Address Type" value={activeAddr.address_type} icon={Tag} themeColor={themeColor} />
                  <DetailRow label="City Station" value={activeAddr.city} icon={MapPin} themeColor={themeColor} />
                  <DetailRow label="Emirate Hub / State" value={activeAddr.state || activeAddr.emirate} icon={MapPin} themeColor={themeColor} />
                  <DetailRow label="Country" value={activeAddr.country} icon={Globe} themeColor={themeColor} />
                  <DetailRow label="Building / Street Line 1" value={activeAddr.address_line1} icon={MapPin} themeColor={themeColor} />
                  <DetailRow label="Address Line 2" value={activeAddr.address_line2} icon={MapPin} themeColor={themeColor} />
                </div>
              )}
            </motion.div>

            {/* ROW 2 LEFT: Panel 5 - Financial rules & assignments */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4, delay: 0.2 }} className="lg:col-span-1 info-panel-card h-full flex flex-col justify-between">
              <SectionHeader text="Financials & Governance" themeColor={themeColor} icon={Receipt} />
              <div className="info-panel-body info-fields-grid flex-1">
                <DetailRow label="Tax Id" value={customer?.tax_id} icon={Receipt} themeColor={themeColor} />
                <DetailRow label="TRN" value={customer?.custom_trn} icon={Hash} themeColor={themeColor} />
                <DetailRow label="Tax Category" value={customer?.tax_category} icon={Percent} themeColor={themeColor} />
                <DetailRow label="Pricing Matrix" value={customer?.default_price_list} icon={ShoppingCart} themeColor={themeColor} />
                <DetailRow label="Payment Terms Protocol" value={customer?.payment_terms} icon={Clock} themeColor={themeColor} />
                <DetailRow label="Allowed Discount (%)" value={customer?.custom_default_discount ? `${customer.custom_default_discount}%` : '0%'} icon={Percent} themeColor={themeColor} />
                <DetailRow label="Account Supervisor" value={customer?.account_manager} icon={Briefcase} themeColor={themeColor} />
                <DetailRow label="Customer POS Ident" value={customer?.customer_pos_id} icon={Hash} themeColor={themeColor} />
                <DetailRow label="Prospect Alias" value={customer?.prospect_name} icon={UserCircle2} themeColor={themeColor} />
              </div>
            </motion.div>

            {/* ROW 2 RIGHT: Panel 6 - Primary Contact assigned */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4, delay: 0.3 }} className="lg:col-span-1 info-panel-card h-full flex flex-col justify-between">
              <CollapsibleSectionHeader
                text="Primary Contact Person"
                themeColor={themeColor}
                icon={User}
                isOpen={isContactOpen}
                onToggle={() => setIsContactOpen(!isContactOpen)}
              />
              {isContactOpen && (
                <div className="info-panel-body info-fields-grid flex-1 animate-in fade-in duration-200">
                  <DetailRow label="Contact Full Name" value={activeCont.first_name ? `${activeCont.first_name} ${activeCont.middle_name || ''} ${activeCont.last_name || ''}`.trim() : ''} icon={User} themeColor={themeColor} />
                  <DetailRow label="Designation" value={activeCont.designation} icon={Briefcase} themeColor={themeColor} />
                  <DetailRow label="Contact Email" value={activeCont.email_id} icon={Mail} themeColor={themeColor} />
                  <DetailRow label="Contact Mobile" value={activeCont.mobile_no} icon={Phone} themeColor={themeColor} />
                  <DetailRow label="Contact Status" value={activeCont.status} icon={ShieldCheck} themeColor={themeColor} />
                </div>
              )}
            </motion.div>

            {/* BOTTOM FULL WIDTH ROW: Regional Branch Availability */}
            <div className="lg:col-span-2 mt-2">
              {/* Panel 3: Branch availability */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4, delay: 0.4 }} className="info-panel-card">
                <SectionHeader text="Regional Branch Availability" themeColor={themeColor} icon={Warehouse} />
                <div className="info-panel-body">
                  {customer?.branch_availability?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {customer.branch_availability.map((b, idx) => (
                        <div key={idx} className="flex-1 min-w-[200px] flex items-center gap-2.5 px-4 py-3 bg-slate-50/50 rounded-lg border border-slate-100/50">
                          <div className="shrink-0" style={{ color: themeColor || '#0082f6' }}>
                            <Warehouse size={14} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-row items-center gap-2">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest m-0 p-0 whitespace-nowrap">Authorized Branch :</p>
                            <p className="text-[11px] font-bold text-slate-800 truncate m-0 p-0">{b.warehouse}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
                      <Warehouse size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Access Allowed (All Branches)</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* BOTTOM FULL WIDTH ROW: Transactions Dashboard (ERPNext style) */}
            <div className="lg:col-span-2 mt-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="info-panel-card"
              >
                <SectionHeader text="Transactions Dashboard" themeColor={themeColor} icon={ShoppingCart} />
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {/* Sales Orders */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'sales_order' ? null : 'sales_order')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'sales_order' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'sales_order' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'}`}>
                      <ShoppingCart size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sales Orders</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-indigo-600">
                      {dashboardData?.sales_order?.length || 0}
                    </span>
                  </div>

                  {/* Sales Invoices */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'sales_invoice' ? null : 'sales_invoice')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'sales_invoice' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'sales_invoice' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'}`}>
                      <FileText size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sales Invoices</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-emerald-600">
                      {dashboardData?.sales_invoice?.length || 0}
                    </span>
                  </div>

                  {/* Delivery Notes */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'delivery_note' ? null : 'delivery_note')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'delivery_note' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'delivery_note' ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'}`}>
                      <Warehouse size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Delivery Notes</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-amber-600">
                      {dashboardData?.delivery_note?.length || 0}
                    </span>
                  </div>

                  {/* Payment Entry */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'payment_entry' ? null : 'payment_entry')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'payment_entry' ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'payment_entry' ? 'bg-violet-100 text-violet-600' : 'bg-violet-50 text-violet-600 group-hover:bg-violet-100'}`}>
                      <Receipt size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Payments</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-violet-600">
                      {dashboardData?.payment_entry?.length || 0}
                    </span>
                  </div>

                  {/* Journal Entry */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'journal_entry' ? null : 'journal_entry')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'journal_entry' ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'journal_entry' ? 'bg-sky-100 text-sky-600' : 'bg-sky-50 text-sky-600 group-hover:bg-sky-100'}`}>
                      <Layers size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Journals</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-sky-600">
                      {dashboardData?.journal_entry?.length || 0}
                    </span>
                  </div>

                  {/* Returns */}
                  <div
                    onClick={() => setExpandedSection(prev => prev === 'returns' ? null : 'returns')}
                    className={`group cursor-pointer p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm ${expandedSection === 'returns' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className={`p-3 rounded-xl transition-colors ${expandedSection === 'returns' ? 'bg-rose-100 text-rose-600' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'}`}>
                      <RotateCcw size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Returns</span>
                    <span className="text-lg font-extrabold text-slate-800 transition-colors group-hover:text-rose-600">
                      {dashboardData?.returns?.length || 0}
                    </span>
                  </div>
                </div>

                {expandedSection && (() => {
                  const sectionConfig = {
                    sales_order: {
                      title: "Sales Orders",
                      items: dashboardData?.sales_order || [],
                      color: "indigo",
                      theme: "#4f46e5",
                      viewAllPath: "/salesorderlist",
                      isReactRoute: true,
                      icon: ShoppingCart
                    },
                    sales_invoice: {
                      title: "Sales Invoices",
                      items: dashboardData?.sales_invoice || [],
                      color: "emerald",
                      theme: "#10b981",
                      viewAllPath: "/salesinvoice",
                      isReactRoute: true,
                      icon: FileText
                    },
                    delivery_note: {
                      title: "Delivery Notes",
                      items: dashboardData?.delivery_note || [],
                      color: "amber",
                      theme: "#f59e0b",
                      viewAllPath: "/deliverynote",
                      isReactRoute: true,
                      icon: Warehouse
                    },
                    payment_entry: {
                      title: "Payments (Payment Entry)",
                      items: dashboardData?.payment_entry || [],
                      color: "violet",
                      theme: "#8b5cf6",
                      viewAllPath: `/app/payment-entry?party_type=Customer&party=${encodeURIComponent(customer?.name || customer?.customer_name || '')}`,
                      isReactRoute: false,
                      icon: Receipt
                    },
                    journal_entry: {
                      title: "Journals (Journal Entry)",
                      items: dashboardData?.journal_entry || [],
                      color: "sky",
                      theme: "#0ea5e9",
                      viewAllPath: `/app/journal-entry?party_type=Customer&party=${encodeURIComponent(customer?.name || customer?.customer_name || '')}`,
                      isReactRoute: false,
                      icon: Layers
                    },
                    returns: {
                      title: "Returns",
                      items: dashboardData?.returns || [],
                      color: "rose",
                      theme: "#f43f5e",
                      viewAllPath: "/salesreturn",
                      isReactRoute: true,
                      icon: RotateCcw
                    }
                  };

                  const current = sectionConfig[expandedSection];
                  if (!current) return null;
                  const IconComponent = current.icon;

                  return (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: current.theme }}>
                            <IconComponent size={14} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Recent {current.title}
                          </h4>
                        </div>

                        {/* View All Button */}
                        <button
                          onClick={() => {
                            if (current.isReactRoute) {
                              navigate(current.viewAllPath, { state: { search: customer?.customer_name } });
                            } else {
                              window.location.href = current.viewAllPath;
                            }
                          }}
                          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 active:scale-95"
                        >
                          View All →
                        </button>
                      </div>

                      {current.items.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">
                          <IconComponent size={24} className="mx-auto text-slate-300 mb-1.5 opacity-60" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No recent {current.title.toLowerCase()} found.</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs font-medium">
                              <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  <th className="py-2.5 px-4">Transaction ID</th>
                                  <th className="py-2.5 px-4">Posting Date</th>
                                  {expandedSection === 'returns' && <th className="py-2.5 px-4">Return Type</th>}
                                  <th className="py-2.5 px-4 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {current.items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-slate-100/50 hover:bg-slate-50/30 text-xs font-semibold text-slate-700 transition-colors">
                                    <td className="py-2.5 px-4">
                                      <button
                                        onClick={() => {
                                          if (expandedSection === 'sales_order') {
                                            navigate(`/salesorder-details/${item.name}`);
                                          } else if (expandedSection === 'delivery_note') {
                                            navigate(`/deliverynote-details/${item.name}`);
                                          } else if (expandedSection === 'sales_invoice') {
                                            navigate(`/salesinvoice?invoice=${item.name}`);
                                          } else if (expandedSection === 'payment_entry') {
                                            window.location.href = `/app/payment-entry/${item.name}`;
                                          } else if (expandedSection === 'journal_entry') {
                                            window.location.href = `/app/journal-entry/${item.name}`;
                                          } else if (expandedSection === 'returns') {
                                            if (item.type === 'Sales Invoice') {
                                              navigate(`/salesinvoice?invoice=${item.name}`);
                                            } else {
                                              navigate(`/deliverynote-details/${item.name}`);
                                            }
                                          }
                                        }}
                                        className="text-indigo-600 hover:underline font-bold text-left"
                                        style={{ color: themeColor }}
                                      >
                                        {item.name}
                                      </button>
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-500 font-medium">
                                      {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                                    </td>
                                    {expandedSection === 'returns' && (
                                      <td className="py-2.5 px-4">
                                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${item.type === 'Sales Invoice' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                          {item.type === 'Sales Invoice' ? 'Invoice Return' : 'DN Return'}
                                        </span>
                                      </td>
                                    )}
                                    <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                                      AED {(parseFloat(item.grand_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            </div>

          </div>
        ) : (
          /* LOYALTY LEDGER TAB */
          <div className="sd-loyalty-ledger-card animate-in fade-in duration-300">
            {/* Top Row: Title Left, Active Balance Right */}
            <div className="sd-ledger-header-row">
              {/* Left Title & Ribbon Icon */}
              <div className="sd-ledger-header-left">
                <Award size={22} className="sd-ledger-icon" />
                <h3 className="sd-ledger-title">Loyalty Points Balance Ledger</h3>
                <p className="sd-ledger-subtitle">HISTORICAL RECORD OF POINT CREDITS AND REDEMPTIONS</p>
              </div>

              {/* Right: Active Balance & Date Filter Control */}
              <div className="sd-ledger-header-right">
                {/* Active Balance Display */}
                <div className="sd-ledger-active-balance">
                  ACTIVE BALANCE:
                  <span>{customer?.loyalty_points ? parseFloat(customer.loyalty_points).toFixed(2) : '0.00'} pts</span>
                </div>

                {/* Filter Control Box */}
                <div className="sd-ledger-filter-wrapper">
                  <span className="sd-ledger-filter-label">FILTER BY DATE RANGE</span>
                  <div className="sd-ledger-filter-controls">
                    {/* Date Capsule */}
                    <div className="sd-ledger-date-pill">
                      <Calendar size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={loyaltyFromDate}
                        onChange={(e) => setLoyaltyFromDate(e.target.value)}
                        className="sd-ledger-date-input"
                        title="Start Date"
                      />
                      <span className="text-slate-300 font-bold">-</span>
                      <input
                        type="date"
                        value={loyaltyToDate}
                        onChange={(e) => setLoyaltyToDate(e.target.value)}
                        className="sd-ledger-date-input"
                        title="End Date"
                      />
                    </div>

                    {/* Filter Button Pill */}
                    <button
                      type="button"
                      onClick={() => fetchLoyaltyLedger(loyaltyFromDate, loyaltyToDate)}
                      className="sd-ledger-filter-btn"
                    >
                      <Filter size={13} strokeWidth={2.5} />
                      <span>Filter Records</span>
                    </button>

                    {(loyaltyFromDate || loyaltyToDate) && (
                      <button
                        type="button"
                        onClick={() => { setLoyaltyFromDate(''); setLoyaltyToDate(''); fetchLoyaltyLedger('', ''); }}
                        className="px-3.5 py-2 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold uppercase hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Clear Date Filters"
                      >
                        <X size={13} /> Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Horizontal Divider Line */}
            <div className="sd-ledger-divider" />

            {/* Content Body: Loading / Empty State / Table */}
            {ledgerLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-[#0082f6]" size={24} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retrieving ledger entries...</span>
              </div>
            ) : loyaltyLedger.length === 0 ? (
              <div className="sd-ledger-empty-box">
                <Award size={48} className="sd-ledger-empty-icon" strokeWidth={1.5} />
                <p className="sd-ledger-empty-title">
                  NO LOYALTY LEDGER ACTIVITY RECORDED FOR THIS PROFILE.
                </p>
                <p className="sd-ledger-empty-subtitle">
                  ACTIVITY WILL APPEAR HERE ONCE YOUR ACCOUNT ACCUMULATES CREDITS OR REDEMPTIONS.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse customer-loyalty-table">
                  <thead>
                    <tr className="bg-[#f0f7ff] border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Posting Date</th>
                      <th className="py-3 px-4">Transaction Type</th>
                      <th className="py-3 px-4">Purchase Value</th>
                      <th className="py-3 px-4">Points Ledger</th>
                      <th className="py-3 px-4">Reference ID</th>
                      <th className="py-3 px-4">Source/Redeem Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyLedger.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-500">
                          {row.posting_date}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${row.type === 'Earned' ? 'bg-[#e0f2fe] text-[#0284c7] border-[#bae6fd]' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          AED {parseFloat(row.purchase_amount || 0).toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 font-black ${row.loyalty_points > 0 ? 'text-[#0082f6]' : 'text-rose-600'}`}>
                          {row.loyalty_points > 0 ? '+' : ''}{parseFloat(row.loyalty_points).toFixed(2)} pts
                        </td>
                        <td className="py-3 px-4 font-bold">
                          <button
                            type="button"
                            onClick={() => navigate(`/salesinvoice?search=${encodeURIComponent(row.invoice)}`)}
                            className="hover:underline flex items-center gap-1 font-bold text-left cursor-pointer transition-colors text-[#0082f6]"
                          >
                            <FileText size={12} className="opacity-60" /> {row.invoice}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase">
                          {row.type === 'Redeemed' && row.original_invoice ? (
                            <span className="text-slate-600 flex items-center gap-1 select-all">
                              Used against:
                              <button
                                type="button"
                                onClick={() => navigate(`/salesinvoice?search=${encodeURIComponent(row.original_invoice)}`)}
                                className="hover:underline font-bold text-[#0082f6] text-left cursor-pointer transition-colors"
                              >
                                {row.original_invoice}
                              </button>
                            </span>
                          ) : row.type === 'Earned' ? (
                            <span className="text-[#0082f6] font-bold">Credit Credited</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      ) : (
        /* TWO-COLUMN DASHBOARD - EDIT CUSTOMER PROFILE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-300 pb-12">

          {/* Attachment Section at the top */}
          <div className="lg:col-span-3">
            <AttachmentSection doctype="Customer" docname={isNew ? null : id} />
          </div>

          {/* LEFT COLUMN: Customer identity inputs and geospatial address forms */}
          <div className="lg:col-span-2 space-y-8">

            {/* Form Card 1: Identity registration details */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <SectionHeader text="Identity & Profile Details" themeColor={themeColor} />
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Legal Identity Name</label>
                  <input
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                    style={getInputStyle('customer_name')}
                    onFocus={() => setFocusedField('customer_name')}
                    onBlur={() => setFocusedField(null)}
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Company or Individual Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Salutation</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('salutation'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('salutation')}
                    onBlur={() => setFocusedField(null)}
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
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('customer_type'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('customer_type')}
                    onBlur={() => setFocusedField(null)}
                    value={form.customer_type}
                    onChange={e => setForm({ ...form, customer_type: e.target.value })}
                  >
                    {meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Identity Group</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('customer_group'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('customer_group')}
                    onBlur={() => setFocusedField(null)}
                    value={form.customer_group}
                    onChange={e => setForm({ ...form, customer_group: e.target.value })}
                  >
                    {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Territory Domain</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('territory'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('territory')}
                    onBlur={() => setFocusedField(null)}
                    value={form.territory}
                    onChange={e => setForm({ ...form, territory: e.target.value })}
                  >
                    {meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Gender</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('gender'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('gender')}
                    onBlur={() => setFocusedField(null)}
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
                      className="flex-1 h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('image')}
                      onFocus={() => setFocusedField('image')}
                      onBlur={() => setFocusedField(null)}
                      value={form.image}
                      onChange={e => setForm({ ...form, image: e.target.value })}
                      placeholder="Image URL link"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('customer-image-upload')?.click()}
                      className="px-5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-slate-200 transition-all active:scale-95 duration-150"
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
                    rows={3}
                    className="w-full px-4 py-3 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 resize-none focus:ring-0"
                    style={getInputStyle('customer_details')}
                    onFocus={() => setFocusedField('customer_details')}
                    onBlur={() => setFocusedField(null)}
                    value={form.customer_details}
                    onChange={e => setForm({ ...form, customer_details: e.target.value })}
                    placeholder="Internal description notes"
                  />
                </div>
              </div>
            </div>

            {/* Form Card 2: Geospatial & contact details */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <CollapsibleSectionHeader
                text="Deal & Spatial Information"
                themeColor={themeColor}
                isOpen={isSpatialOpen}
                onToggle={() => setIsSpatialOpen(!isSpatialOpen)}
              />
              {isSpatialOpen && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Email Id</label>
                    <input
                      type="email"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('email_id')}
                      onFocus={() => setFocusedField('email_id')}
                      onBlur={() => setFocusedField(null)}
                      value={form.email_id}
                      onChange={e => setForm({ ...form, email_id: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Mobile No</label>
                    <input
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('mobile_no')}
                      onFocus={() => setFocusedField('mobile_no')}
                      onBlur={() => setFocusedField(null)}
                      value={form.mobile_no}
                      onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                      placeholder="+971 -- --- ----"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Address Type</label>
                    <select
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                      style={{
                        ...getInputStyle('address_type'),
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundSize: '1.25rem'
                      }}
                      onFocus={() => setFocusedField('address_type')}
                      onBlur={() => setFocusedField(null)}
                      value={form.address_type}
                      onChange={e => setForm({ ...form, address_type: e.target.value })}
                    >
                      {meta.address_type?.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">City Station</label>
                    <input
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('city')}
                      onFocus={() => setFocusedField('city')}
                      onBlur={() => setFocusedField(null)}
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Emirate Hub</label>
                    <select
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                      style={{
                        ...getInputStyle('emirate'),
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundSize: '1.25rem'
                      }}
                      onFocus={() => setFocusedField('emirate')}
                      onBlur={() => setFocusedField(null)}
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
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                      style={{
                        ...getInputStyle('country'),
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundSize: '1.25rem'
                      }}
                      onFocus={() => setFocusedField('country')}
                      onBlur={() => setFocusedField(null)}
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
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('address_line1')}
                      onFocus={() => setFocusedField('address_line1')}
                      onBlur={() => setFocusedField(null)}
                      value={form.address_line1}
                      onChange={e => setForm({ ...form, address_line1: e.target.value })}
                      placeholder="Building / Street Line 1"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Address Line 2</label>
                    <input
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('address_line2')}
                      onFocus={() => setFocusedField('address_line2')}
                      onBlur={() => setFocusedField(null)}
                      value={form.address_line2}
                      onChange={e => setForm({ ...form, address_line2: e.target.value })}
                      placeholder="Address Line 2"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Form Card 3: Branch Availability */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <SectionHeader text="Regional Branch Availability" themeColor={themeColor} />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between px-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configure Branch Access</p>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, branch_availability: [...form.branch_availability, { warehouse: '' }] })}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 uppercase tracking-widest active:scale-95 duration-150"
                    style={{ color: themeColor }}
                  >
                    <Plus size={12} strokeWidth={2.5} /> Add Warehouse
                  </button>
                </div>

                {form.branch_availability.length === 0 ? (
                  <div className="py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Warehouse size={28} className="text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global access (All Branches)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {form.branch_availability.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          className="flex-1 h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                          style={{
                            ...getInputStyle(`branch_${idx}`),
                            backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                            backgroundSize: '1.25rem'
                          }}
                          onFocus={() => setFocusedField(`branch_${idx}`)}
                          onBlur={() => setFocusedField(null)}
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
                          type="button"
                          onClick={() => {
                            const newB = form.branch_availability.filter((_, i) => i !== idx);
                            setForm({ ...form, branch_availability: newB });
                          }}
                          className="w-11 h-11 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl border border-rose-100/50 transition-all active:scale-95 duration-150"
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

          {/* RIGHT COLUMN: Settings Toggles, Financials Form, Primary Contact Form */}
          <div className="lg:col-span-1 space-y-8">

            {/* Form Card 4: iOS Toggles for Settings */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <SectionHeader text="System Configurations" themeColor={themeColor} />
              <div className="p-6 flex flex-col gap-4">
                {[
                  { id: 'disabled', label: 'Disabled Status', desc: 'Prevent transactions for this customer' },
                  { id: 'is_frozen', label: 'Is Frozen Status', desc: 'Freeze credit limit & activities' },
                  { id: 'is_internal_customer', label: 'Internal Customer', desc: 'Identify as member of organization' }
                ].map(check => (
                  <div key={check.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all duration-200">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{check.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{check.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, [check.id]: form[check.id] === 1 ? 0 : 1 })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${form[check.id] === 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      style={{ backgroundColor: form[check.id] === 1 ? themeColor : undefined }}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form[check.id] === 1 ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Card 5: Financial rules & assignments */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <SectionHeader text="Financials & Governance" themeColor={themeColor} />
              <div className="p-6 grid grid-cols-1 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Tax Id</label>
                  <input
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                    style={getInputStyle('tax_id')}
                    onFocus={() => setFocusedField('tax_id')}
                    onBlur={() => setFocusedField(null)}
                    value={form.tax_id}
                    onChange={e => setForm({ ...form, tax_id: e.target.value })}
                    placeholder="Tax ID"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">TRN</label>
                  <input
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                    style={getInputStyle('custom_trn')}
                    onFocus={() => setFocusedField('custom_trn')}
                    onBlur={() => setFocusedField(null)}
                    value={form.custom_trn}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setForm({ ...form, custom_trn: val });
                    }}
                    placeholder="Enter 15-digit TRN"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Tax Category</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('tax_category'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('tax_category')}
                    onBlur={() => setFocusedField(null)}
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
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('default_price_list'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('default_price_list')}
                    onBlur={() => setFocusedField(null)}
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
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('payment_terms'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('payment_terms')}
                    onBlur={() => setFocusedField(null)}
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
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('loyalty_program'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('loyalty_program')}
                    onBlur={() => setFocusedField(null)}
                    value={form.loyalty_program}
                    onChange={e => setForm({ ...form, loyalty_program: e.target.value })}
                  >
                    <option value="">None</option>
                    {meta.loyalty_programs?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Allowed Discount (%)</label>
                  <input
                    type="number"
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                    style={getInputStyle('custom_default_discount')}
                    onFocus={() => setFocusedField('custom_default_discount')}
                    onBlur={() => setFocusedField(null)}
                    value={form.custom_default_discount}
                    onChange={e => setForm({ ...form, custom_default_discount: parseFloat(e.target.value) || 0 })}
                    placeholder="Allowed discount percent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Account Supervisor</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('account_manager'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('account_manager')}
                    onBlur={() => setFocusedField(null)}
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
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                    style={getInputStyle('customer_pos_id')}
                    onFocus={() => setFocusedField('customer_pos_id')}
                    onBlur={() => setFocusedField(null)}
                    value={form.customer_pos_id}
                    onChange={e => setForm({ ...form, customer_pos_id: e.target.value })}
                    placeholder="POS ID"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">Prospect Alias</label>
                  <select
                    className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                    style={{
                      ...getInputStyle('prospect_name'),
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundSize: '1.25rem'
                    }}
                    onFocus={() => setFocusedField('prospect_name')}
                    onBlur={() => setFocusedField(null)}
                    value={form.prospect_name}
                    onChange={e => setForm({ ...form, prospect_name: e.target.value })}
                  >
                    <option value="">Select Prospect</option>
                    {meta.prospects?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Form Card 6: Primary Contact Person */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <CollapsibleSectionHeader
                text="Primary Contact Person"
                themeColor={themeColor}
                isOpen={isContactOpen}
                onToggle={() => setIsContactOpen(!isContactOpen)}
              />
              {isContactOpen && (
                <div className="p-6 grid grid-cols-2 gap-3.5 animate-in fade-in duration-200">
                  <div className="col-span-2">
                    <input
                      placeholder="First Name"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('first_name')}
                      onFocus={() => setFocusedField('first_name')}
                      onBlur={() => setFocusedField(null)}
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      placeholder="Middle Name"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('middle_name')}
                      onFocus={() => setFocusedField('middle_name')}
                      onBlur={() => setFocusedField(null)}
                      value={form.middle_name}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      placeholder="Last Name"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('last_name')}
                      onFocus={() => setFocusedField('last_name')}
                      onBlur={() => setFocusedField(null)}
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      placeholder="Designation"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('designation')}
                      onFocus={() => setFocusedField('designation')}
                      onBlur={() => setFocusedField(null)}
                      value={form.designation}
                      onChange={e => setForm({ ...form, designation: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      placeholder="Contact Email"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('contact_email')}
                      onFocus={() => setFocusedField('contact_email')}
                      onBlur={() => setFocusedField(null)}
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      placeholder="Contact Mobile"
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                      style={getInputStyle('contact_mobile')}
                      onFocus={() => setFocusedField('contact_mobile')}
                      onBlur={() => setFocusedField(null)}
                      value={form.contact_mobile}
                      onChange={e => setForm({ ...form, contact_mobile: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <select
                      className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                      style={{
                        ...getInputStyle('status'),
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundSize: '1.25rem'
                      }}
                      onFocus={() => setFocusedField('status')}
                      onBlur={() => setFocusedField(null)}
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="Passive">Passive</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {showLoyaltyModal && (
        <LoyaltyCardModal
          customer={customer}
          onClose={() => setShowLoyaltyModal(false)}
          themeColor={themeColor}
        />
      )}
    </div>
  );
};

export default CustomerDetails;

