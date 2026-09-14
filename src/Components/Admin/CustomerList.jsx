import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Eye, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, Contact
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SalesOrder.css';
import LoyaltyCardModal from './LoyaltyCardModal';
import ListCustomizer from './ListCustomizer';

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

const sanitizeMobileNo = (value, defaultCode = '+971') => {
  if (!value) return '';
  let str = String(value).trim();
  
  // Find which country code it starts with
  let matchedCode = '';
  for (const code of Object.values(countryPhoneCodes)) {
    if (code && str.startsWith(code)) {
      if (code.length > matchedCode.length) {
        matchedCode = code;
      }
    }
  }

  if (matchedCode) {
    let rest = str.slice(matchedCode.length);
    // Remove leading 0 from the local number part (e.g., +9710501234567 -> +971501234567)
    while (rest.startsWith('0')) {
      rest = rest.slice(1);
    }
    return matchedCode + (rest ? (rest.startsWith(' ') ? rest : ' ' + rest.trim()) : '');
  }

  // If starts with 0 and no country code, strip leading 0 and attach default country code
  if (str.startsWith('0')) {
    let rest = str;
    while (rest.startsWith('0')) {
      rest = rest.slice(1);
    }
    return defaultCode ? `${defaultCode} ${rest}` : rest;
  }

  return str;
};

const getUpdatedPhone = (currentPhone, newCode) => {
  if (!currentPhone) return newCode ? `${newCode} ` : '';
  if (!newCode) return currentPhone;

  let currentRest = currentPhone;
  for (const code of Object.values(countryPhoneCodes)) {
    if (code && currentRest.startsWith(code)) {
      currentRest = currentRest.slice(code.length).trim();
      break;
    }
  }
  // Remove any leading zero from rest
  while (currentRest.startsWith('0')) {
    currentRest = currentRest.slice(1);
  }
  return currentRest ? `${newCode} ${currentRest}` : `${newCode} `;
};

function CustomerList() {
  const navigate = useNavigate();
  const { themeColor, themeLight, isGreen, toggleTheme, legacySubTheme } = useLegacyTheme();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  // View States
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'

  // Data States
  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Customer');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();
  const [filterSearch, setFilterSearch] = useState(location.state?.search || '');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState(warehouse || 'all');
  const [sortField, setSortField] = useState('modified');
  const [sortOrder, setSortOrder] = useState('desc');

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('Information');
  const [dashboardData, setDashboardData] = useState({
    counts: { sales_orders: 0, sales_invoices: 0, delivery_notes: 0, payment_entries: 0, quotations: 0 },
    current_balance: 0
  });

  const [meta, setMeta] = useState({
    customer_group: [], territory: [], customer_type: ['Individual', 'Company'],
    salutations: [], address_type: [], emirates: [], countries: [],
    price_lists: [], tax_categories: [], payment_terms: [], loyalty_programs: [],
    warehouses: []
  });

  const [form, setForm] = useState({
    customer_name: '', mobile_no: '+971', email_id: '', salutation: '',
    customer_type: 'Individual', customer_group: 'Retail Customer',
    territory: 'All Territories', gender: '', tax_id: '',
    account_manager: '', prospect_name: '', image: '',
    default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
    customer_details: '', tax_category: '', payment_terms: '',
    loyalty_program: '', loyalty_program_tier: '',
    disabled: 0, is_frozen: 0,
    // Spatial Coordinate (Address)
    address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
    // Personnel Profile (Primary Contact)
    first_name: '', middle_name: '', last_name: '', designation: '',
    contact_email: '', contact_mobile: '', status: 'Passive',
    custom_phone_code: '+971',
    branch_availability: []
  });

  const [saving, setSaving] = useState(false);

  // Global Sync Modal States for Customers
  const [showGlobalSyncModal, setShowGlobalSyncModal] = useState(false);
  const [globalSyncSearch, setGlobalSyncSearch] = useState('');
  const [globalCustomers, setGlobalCustomers] = useState([]);
  const [selectedGlobalCustomers, setSelectedGlobalCustomers] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [syncingGlobal, setSyncingGlobal] = useState(false);

  const openGlobalSyncModal = () => {
    setGlobalSyncSearch(filterSearch || '');
    setGlobalCustomers([]);
    setSelectedGlobalCustomers([]);
    setShowGlobalSyncModal(true);
    if (filterSearch) {
      setTimeout(() => {
        runGlobalSearch(filterSearch);
      }, 100);
    }
  };

  const runGlobalSearch = async (searchTermOverride) => {
    const q = searchTermOverride !== undefined ? searchTermOverride : globalSyncSearch;
    if (!q.trim()) return Swal.fire('Search', 'Please enter a name or mobile to discover.', 'info');
    
    setSearchingGlobal(true);
    try {
      const res = await axios.get(`${API_BASE}.find_customer_globally_retail`, {
        params: { search_term: q },
        withCredentials: true
      });
      const results = res.data.message?.data || [];
      setGlobalCustomers(results);
      setSelectedGlobalCustomers([]);
    } catch (err) {
      console.error('Global search failed:', err);
      Swal.fire('Search Failed', 'Unable to reach global registry.', 'error');
    } finally {
      setSearchingGlobal(false);
    }
  };

  const handleBulkSync = async () => {
    if (selectedGlobalCustomers.length === 0) return;
    setSyncingGlobal(true);
    try {
      Swal.fire({ title: 'Synchronizing Members...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await axios.post(`${API_BASE}.bulk_enable_customers_for_branch`, {
        customers: JSON.stringify(selectedGlobalCustomers),
        warehouse: warehouse
      }, { withCredentials: true });
      
      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Sync Completed', text: 'All selected customers are now active for your branch.', timer: 2000 });
        setShowGlobalSyncModal(false);
        fetchCustomers();
      } else {
        Swal.fire('Error', res.data.message?.message || 'Sync failed.', 'error');
      }
    } catch (err) {
      console.error('Bulk sync failed:', err);
      Swal.fire('Sync Error', err.response?.data?.message || 'Connection failure.', 'error');
    } finally {
      setSyncingGlobal(false);
    }
  };

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    fetchCustomers();
  }, [sortField, sortOrder, filterBranch, customColumns]);

  useEffect(() => {
    fetchMeta();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customers_list`, { 
        params: { 
          order_by: `${sortField} ${sortOrder}`,
          search: filterSearch,
          warehouse: filterBranch !== 'all' ? filterBranch : undefined,
          extra_fields: JSON.stringify(customColumns)
        } 
      });
      setCustomers(Array.isArray(res.data.message?.data) ? res.data.message.data : []);
    } catch (err) { console.error('List failed', err); }
    finally { setLoading(false); }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

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

  const fetchFullDetails = async (id) => {
    try {
      const [detailRes, dashRes] = await Promise.all([
        axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } }),
        axios.get(`${API_BASE}.get_customer_dashboard_data`, { params: { customer_id: id } })
      ]);

      const data = detailRes.data.message?.data;
      if (data) {
        setSelectedCustomer({
          ...data.customer,
          addresses: data.addresses || [],
          contacts: data.contacts || []
        });
      }
      if (dashRes.data.message?.success) setDashboardData(dashRes.data.message.data);
    } catch (err) { console.error('Detail fetch failed', err); }
  };

  /* ────────────────────── ACTIONS ────────────────────── */
  const handleCustomerClick = (c) => {
    const id = c.name || c.value;
    navigate(`/customer-details/${id}`);
  };

  const openAddModal = () => {
    setModalMode('create');
    setForm({
      customer_name: '', mobile_no: '+971', email_id: '', salutation: '',
      customer_type: 'Individual', customer_group: 'Retail Customer',
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
    setShowModal(true);
  };

  const openEditModal = () => {
    if (!selectedCustomer) return;
    setModalMode('edit');
    const addr = selectedCustomer.addresses?.[0] || {};
    const cont = selectedCustomer.contacts?.[0] || {};
    const editCountry = addr.country || 'United Arab Emirates';
    const normCountry = editCountry.toLowerCase().trim();
    const derivedCode = countryPhoneCodes[normCountry] || '';
    setForm({
      customer_name: selectedCustomer.customer_name || '',
      mobile_no: selectedCustomer.mobile_no || '',
      email_id: selectedCustomer.email_id || '',
      salutation: selectedCustomer.salutation || '',
      customer_type: selectedCustomer.customer_type || 'Individual',
      customer_group: selectedCustomer.customer_group || 'Retail Customer',
      territory: selectedCustomer.territory || 'All Territories',
      gender: selectedCustomer.gender || '',
      tax_id: selectedCustomer.tax_id || '',
      account_manager: selectedCustomer.account_manager || '',
      prospect_name: selectedCustomer.prospect_name || '',
      image: selectedCustomer.image || '',
      default_price_list: selectedCustomer.default_price_list || '',
      is_internal_customer: selectedCustomer.is_internal_customer || 0,
      customer_pos_id: selectedCustomer.customer_pos_id || '',
      customer_details: selectedCustomer.customer_details || '',
      tax_category: selectedCustomer.tax_category || '',
      payment_terms: selectedCustomer.payment_terms || '',
      loyalty_program: selectedCustomer.loyalty_program || '',
      loyalty_program_tier: selectedCustomer.loyalty_program_tier || '',
      disabled: selectedCustomer.disabled || 0,
      is_frozen: selectedCustomer.is_frozen || 0,
      // Address Shard
      address_type: addr.address_type || 'Billing',
      address_line1: addr.address_line1 || '',
      address_line2: addr.address_line2 || '',
      city: addr.city || '',
      emirate: addr.state || addr.emirate || '',
      country: addr.country || 'United Arab Emirates',
      // Personnel Profile
      first_name: cont.first_name || '',
      middle_name: cont.middle_name || '',
      last_name: cont.last_name || '',
      designation: cont.designation || '',
      contact_email: cont.email_id || '',
      contact_mobile: cont.mobile_no || '',
      status: cont.status || 'Passive',
      custom_phone_code: selectedCustomer.custom_phone_code || derivedCode,
      branch_availability: selectedCustomer.branch_availability || []
    });
    setShowModal(true);
  };

  const handleEditClick = async (e, customer) => {
    e.stopPropagation();
    const id = customer.name || customer.value;
    setSaving(true);
    try {
      const res = await axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } });
      const data = res.data.message?.data;
      if (data) {
        const fullCustomer = {
          ...data.customer,
          addresses: data.addresses || [],
          contacts: data.contacts || []
        };
        setSelectedCustomer(fullCustomer);
        setModalMode('edit');
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
        setShowModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch details for edit', err);
      Swal.fire('Error', 'Failed to retrieve full customer details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGlobalSearch = async () => {
    if (!filterSearch) return Swal.fire('Search', 'Enter name or mobile for Global Discovery', 'info');
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}.find_customer_globally_retail`, {
        params: { search: filterSearch }
      });
      if (res.data.message?.success) {
        const found = res.data.message.data;
        if (found.length === 0) {
          Swal.fire('Not Found', 'No customers discovered in any branch.', 'info');
        } else {
          setCustomers(found);
          Swal.fire('Discovered', `Found ${found.length} customers across branches.`, 'success');
        }
      }
    } catch (err) {
      console.error('Global search failed', err);
      Swal.fire('Search Error', 'Cross-branch discovery unavailable.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableForBranch = async (e, customer) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: 'Enable for Branch?',
      text: `Enable ${customer.customer_name} for this branch (${warehouse})?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: themeColor,
      confirmButtonText: 'Yes, Enable'
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        const res = await axios.post(`${API_BASE}.enable_customer_for_branch_retail`, {
          customer_id: customer.name || customer.value,
          warehouse: warehouse
        });
        if (res.data.message?.success) {
          Swal.fire('Enabled', 'Customer is now active for your branch.', 'success');
          fetchCustomers();
        } else throw new Error(res.data.message?.message);
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!form.customer_name) return Swal.fire('Error', 'Customer Name is required', 'warning');
    setSaving(true);
    try {
      const payload = {
        customer_data: {
          ...form,
          name: modalMode === 'edit' ? selectedCustomer.name : undefined,
          custom_branch: modalMode === 'create' ? (!isAdmin ? warehouse : form.custom_branch) : form.custom_branch,
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
          text: modalMode === 'create' ? 'Customer created successfully.' : 'Customer profile updated successfully.' 
        });
        setShowModal(false);
        if (view === 'detail') fetchFullDetails(selectedCustomer.name);
        fetchCustomers();
      } else throw new Error(res.data.message?.message);
    } catch (err) { Swal.fire('Sync Failure', err.message, 'error'); }
    finally { setSaving(false); }
  };

  /* ────────────────────── DATA COMPUTE ────────────────────── */
  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = filterSearch.toLowerCase();
      const name = (c.customer_name || c.label || '').toLowerCase();
      const id = (c.name || c.value || '').toLowerCase();
      const mobile = (c.mobile || c.mobile_no || '').toLowerCase();
      const email = (c.email || c.email_id || '').toLowerCase();

      const matchesSearch = !filterSearch ||
        name.includes(q) ||
        id.includes(q) ||
        mobile.includes(q) ||
        email.includes(q);

      const matchesGroup = !filterGroup || c.customer_group === filterGroup;
      const matchesType = !filterType || c.customer_type === filterType;
      const matchesStatus = !filterStatus || (filterStatus === 'active' ? c.disabled !== 1 : c.disabled === 1);

      return matchesSearch && matchesGroup && matchesType && matchesStatus;
    });
  }, [customers, filterSearch, filterGroup, filterType, filterStatus]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter(c => c.disabled !== 1).length,
    inactive: customers.filter(c => c.disabled === 1).length,
    groups: [...new Set(customers.map(c => c.customer_group))].filter(Boolean).length
  }), [customers]);

  /* ────────────────────── STYLES ────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.975); } to { opacity: 1; transform: scale(1); } }
        .p-modal { position: fixed; inset: 0; z-index: 2000; background: #fff; display: flex; flex-direction: column; animation: scaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .m-header { height: 90px; padding: 0 50px; border-bottom: 2px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
        .m-body { flex: 1; overflow-y: auto; padding: 60px 80px; background: #fff; }
        .m-footer { height: 100px; padding: 0 50px; background: #fdfdfd; border-top: 2px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
        .f-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px 60px; }
        .f-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px; display: block; }
        .f-input, .f-select { width: 100%; height: 56px; padding: 0 20px; border: 2.5px solid #e2e8f0; border-radius: 16px; font-size: 16px; font-weight: 800; color: #0f172a; background: #fff; transition: all 0.25s; }
        .f-input:focus { outline: none; border-color: ${themeColor}; background: #fff; box-shadow: 0 0 0 6px ${themeColor}12; }
        .f-input:disabled { background: #f8fafc; color: #cbd5e1; font-family: 'DM Mono', monospace; font-size: 13px; }
        .section-label { display: flex; align-items: center; gap: 20px; margin: 60px 0 40px; }
        .section-label-text { font-size: 14px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em; white-space: nowrap; }
        .tab-btn { padding: 1.5rem 0; font-size: 13px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 3px solid transparent; transition: 0.2s; cursor: pointer; background: none; }
        .tab-btn.active { color: #0f172a; border-bottom-color: ${themeColor}; }
        @media (max-width: 1200px) { .f-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 768px) { .f-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="animate-in fade-in duration-500">
          <div className="so-page-header-container">
            <div className="so-page-tabs">
              <span className="so-page-tab active">Customer</span>
              <span className="so-page-tab" onClick={() => navigate('/salesreport')} style={{ cursor: 'pointer' }}>Reports</span>
            </div>
            <div className="so-page-header">
              <h1 className="so-page-title">Customer Management</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="so-btn-secondary" onClick={handleGlobalSearch} style={{ height: '38px', padding: '0 12px', fontSize: '13px' }}>
                  <Globe size={16} /> Global Search
                </button>
                <button className="so-btn-secondary" onClick={toggleTheme} style={{ height: '38px', padding: '0 12px', fontSize: '13px' }}>
                  <Palette size={16} /> {legacySubTheme.toUpperCase()}
                </button>
                <ListCustomizer
                  doctype="Customer"
                  onSave={cols => setCustomColumns(cols)}
                  themeColor={themeColor}
                />
                <button className="so-btn-primary" onClick={() => navigate('/customer-edit/new')}>
                  <Plus size={16} /> Create Customer
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="so-filter-bar">
            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column' }}>
              <label className="so-filter-label">Search Customer</label>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input
                  className="so-filter-input"
                  type="text"
                  placeholder="Name, ID or Contact..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={openGlobalSyncModal}
                  disabled={searchingGlobal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0 0.85rem', background: '#e0f2fe',
                    border: '1px solid #bae6fd', borderRadius: '0.375rem',
                    fontSize: '0.7rem', fontWeight: 800, color: '#0369a1',
                    cursor: 'pointer', transition: 'all 0.2s',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    height: '38px', flexShrink: 0
                  }}
                  title="Search and enable customers from other branches"
                >
                  {searchingGlobal ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                  Global Search
                </button>
              </div>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Group</label>
              <select className="so-filter-input" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}>
                <option value="">All Groups</option>
                {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Entity Type</label>
              <select className="so-filter-input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
                <option value="">All Types</option>
                <option value="Company">Company</option>
                <option value="Individual">Individual</option>
              </select>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Branch</label>
              <select className="so-filter-input" value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setCurrentPage(1); }}>
                <option value="all">All Branches (Global)</option>
                {meta.warehouses?.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Status</label>
              <select className="so-filter-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                <option value="">All Statuses</option>
                <option value="active">Operational Only</option>
                <option value="inactive">Restricted Only</option>
              </select>
            </div>
            <button className="so-clear-btn" style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0 }} onClick={() => {
              setFilterSearch(''); setFilterGroup(''); setFilterType(''); setFilterStatus('');
            }}>Reset</button>
          </div>

          {/* Executive Dashboard */}
          <div style={{ padding: '1.25rem 2.5rem 0' }}>
            <div className="so-summary-bar">
              <div className="so-summary-item">
                <span className="so-summary-label">Total Customers</span>
                <span className="so-summary-value grand">{stats.total}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Active</span>
                <span className="so-summary-value" style={{ color: '#059669' }}>{stats.active}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Restricted</span>
                <span className="so-summary-value" style={{ color: '#ef4444' }}>{stats.inactive}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Groups</span>
                <span className="so-summary-value">{stats.groups} Categories</span>
              </div>
            </div>
          </div>

          {/* Main Directory Table */}
          <div style={{ padding: '1.5rem 2.5rem' }}>
            <div className="so-table-card">
              <div className="so-table-wrapper" style={{ maxHeight: 'none', overflowY: 'visible' }}>
                <table className="so-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('customer_name')} style={{ cursor: 'pointer' }}>
                        Customer Profile {sortField === 'customer_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => toggleSort('modified')} style={{ cursor: 'pointer' }}>
                        Last Updated {sortField === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Contact Vectors</th>
                      <th>Classification</th>
                      <th onClick={() => toggleSort('creation')} style={{ cursor: 'pointer' }}>
                        Created By {sortField === 'creation' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      {customColumns.map(col => (
                        <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
                      <th>Status</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7 + customColumns.length} className="so-empty" style={{ textAlign: 'center', padding: '100px' }}>
                          <Loader2 size={28} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7 + customColumns.length} className="so-empty" style={{ textAlign: 'center', padding: '150px' }}>
                          <Users size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                          No customers match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginated.map(c => (
                        <tr key={c.name || c.value} onClick={() => handleCustomerClick(c)} style={{ transition: 'background-color 0.15s ease' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {c.image ? (
                                <img src={c.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <UserCircle2 size={18} />
                              )}
                            </div>
                              <div>
                                <span style={{ fontWeight: 700, color: '#1f2937' }}>{c.customer_name || c.label}</span>
                                <span style={{ display: 'block', fontSize: '10px', color: '#6b7280', fontWeight: 500, marginTop: '2px' }}>{c.name || c.value}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{c.modified_by?.split('@')[0]}</span>
                              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(c.modified).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{c.mobile || c.mobile_no || '⎯⎯⎯'}</span>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>{c.email || c.email_id || '⎯⎯⎯'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{c.customer_type || 'Individual'}</span>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>{c.customer_group}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{c.owner?.split('@')[0]}</span>
                              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{c.custom_branch || 'Global'}</span>
                            </div>
                          </td>
                          {customColumns.map(col => (
                            <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {c[col] !== undefined && c[col] !== null ? String(c[col]) : '-'}
                            </td>
                          ))}
                          <td>
                            {c.is_global ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">OTHER BRANCH</span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${c.disabled !== 1 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {c.disabled !== 1 ? 'Operational' : 'Restricted'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                              {c.is_global ? (
                                <button
                                  className="so-btn-ghost text-emerald-600 hover:bg-emerald-50"
                                  style={{ padding: '0.25rem' }}
                                  onClick={(e) => handleEnableForBranch(e, c)}
                                  title="Enable for My Branch"
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="so-btn-ghost"
                                    style={{ padding: '0.25rem' }}
                                    onClick={() => handleCustomerClick(c)}
                                    title="View Customer Details"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    className="so-btn-ghost"
                                    style={{ padding: '0.25rem' }}
                                    onClick={(e) => { e.stopPropagation(); navigate(`/customer-edit/${c.name || c.value}`); }}
                                    title="Edit Customer Details"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {!loading && filtered.length > 0 && (
                  <div className="so-pagination" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <span>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} customers</span>
                    <div className="so-pagination-btns">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="so-page-btn">PREV</button>
                      <span style={{ alignSelf: 'center', margin: '0 0.5rem', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="so-page-btn">NEXT</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── EXHAUSTIVE DETAIL EXPLORER ────────────────────── */}
      {view === 'detail' && selectedCustomer && (
        <div style={{ background: '#fff', minHeight: '100vh', animation: 'scaleUp 0.4s ease' }}>
          <div style={{ background: '#0f172a', padding: '5rem 5rem 4rem', color: '#fff' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '4rem' }}>
                <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.06)', height: '72px', width: '72px', borderRadius: '24px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                  <ArrowLeft size={36} />
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <span style={{ background: themeColor, color: '#fff', padding: '0.4rem 1.25rem', borderRadius: '12px', fontSize: '11px', fontWeight: 950, textTransform: 'uppercase' }}>{selectedCustomer.customer_group}</span>
                    <div style={{ height: '8px', width: '8px', borderRadius: '50%', background: !selectedCustomer.disabled ? '#10b981' : '#ef4444', boxShadow: !selectedCustomer.disabled ? '0 0 12px #10b981' : 'none' }} />
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>MATRIX_ID: {selectedCustomer.name}</span>
                  </div>
                  <h1 style={{ fontSize: '4rem', fontWeight: 950, letterSpacing: '-0.05em', lineHeight: 1 }}>{selectedCustomer.customer_name}</h1>
                  <div style={{ display: 'flex', gap: '3rem', marginTop: '1.5rem', opacity: 0.5, fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <span style={{ display: 'flex', gap: '8px' }}><Smartphone size={14} /> Signal: {selectedCustomer.mobile_no || 'OFFLINE'}</span>
                    <span style={{ display: 'flex', gap: '8px' }}><Award size={14} /> Loyalty: {selectedCustomer.loyalty_program || 'NULL'}</span>
                    <span style={{ display: 'flex', gap: '8px' }}><Briefcase size={14} /> POS: {selectedCustomer.customer_pos_id || 'LOCAL-AUT'}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setShowLoyaltyModal(true)}
                  disabled={!selectedCustomer.custom_loyalty_card_number}
                  style={{ height: '72px', padding: '0 2rem', background: '#f1f5f9', borderRadius: '24px', border: 'none', color: !selectedCustomer.custom_loyalty_card_number ? '#cbd5e1' : '#64748b', fontSize: '1.1rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '12px', cursor: !selectedCustomer.custom_loyalty_card_number ? 'not-allowed' : 'pointer' }}
                >
                  <CreditCard size={24} /> Print Card
                </button>
                <button
                  onClick={openEditModal}
                  style={{ height: '72px', padding: '0 3.5rem', background: themeColor, borderRadius: '24px', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', shadow: `0 15px 40px ${themeColor}60` }}
                >
                  <Edit2 size={24} /> Revise Portfolio
                </button>
              </div>
            </div>
          </div>

          <div style={{ sticky: 'top', top: 0, zIndex: 10, background: '#fff', borderBottom: '3px solid #f1f5f9' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 5rem', display: 'flex', gap: '5rem' }}>
              {['Information', 'Dashboard', 'Geospatial', 'Personnel'].map(tab => (
                <button key={tab} className={`tab-btn ${activeDetailTab === tab ? 'active' : ''}`} onClick={() => setActiveDetailTab(tab)}>{tab}</button>
              ))}
            </div>
          </div>

          <div style={{ maxWidth: '1600px', margin: '4rem auto', padding: '0 5rem 6rem' }}>
            {activeDetailTab === 'Information' && (
              <div className="animate-in fade-in duration-700">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4rem' }}>
                  <DetailCard title="Registry Specifications">
                    <DataInfo label="Customer Type" value={selectedCustomer.customer_type} icon={Building2} />
                    <DataInfo label="Salutation" value={selectedCustomer.salutation} icon={User} />
                    <DataInfo label="Customer Group" value={selectedCustomer.customer_group} icon={Layers} />
                    <DataInfo label="Territorial Hub" value={selectedCustomer.territory} icon={Globe} />
                    <DataInfo label="Account Supervisor" value={selectedCustomer.account_manager} icon={Briefcase} />
                    <DataInfo label="Prospect Name" value={selectedCustomer.prospect_name} icon={Award} />
                  </DetailCard>
                  <DetailCard title="Fiscal & Logic Parameters">
                    <DataInfo label="Fiscal Hub (Tax ID)" value={selectedCustomer.tax_id} icon={Hash} />
                    <DataInfo label="Tax Classification" value={selectedCustomer.tax_category} icon={Percent} />
                    <DataInfo label="Pricing Matrix" value={selectedCustomer.default_price_list} icon={DollarSign} />
                    <DataInfo label="Payment Protocol" value={selectedCustomer.payment_terms} icon={Clock} />
                    <DataInfo label="Internal Customer" value={selectedCustomer.is_internal_customer ? 'YES' : 'NO'} icon={ShieldCheck} />
                    <DataInfo label="Loyalty Tier" value={selectedCustomer.loyalty_program_tier} icon={Award} color="#f59e0b" />
                  </DetailCard>
                  <DetailCard title="Signal Connectivity">
                    <DataInfo label="Mobile Signal" value={selectedCustomer.mobile_no} icon={Smartphone} />
                    <DataInfo label="Digital Hub (Email)" value={selectedCustomer.email_id} icon={Mail} />
                    <DataInfo label="Gender Profile" value={selectedCustomer.gender} icon={User} />
                    <DataInfo label="Profile Image" value={selectedCustomer.image ? 'LINKED' : 'NOT DETECTED'} icon={ImageIcon} />
                    <DataInfo label="Account Status" value={selectedCustomer.disabled ? 'RESTRICTED' : 'OPERATIONAL'} icon={Activity} color={selectedCustomer.disabled ? '#ef4444' : '#10b981'} />
                    <DataInfo label="Global Sync" value={selectedCustomer.is_frozen ? 'FROZEN' : 'ACTIVE'} icon={Shield} color={selectedCustomer.is_frozen ? '#ef4444' : '#10b981'} />
                  </DetailCard>
                </div>
                <div style={{ marginTop: '5rem', background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2rem', letterSpacing: '0.2em' }}>Customer Details & Logs</h4>
                  <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155', lineHeight: 1.75 }}>{selectedCustomer.customer_details || 'Critical narrative data log is currently null for this customer. Registry remains synchronized.'}</p>
                </div>
              </div>
            )}

            {activeDetailTab === 'Dashboard' && (
              <div className="animate-in fade-in duration-500">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem', marginBottom: '4rem' }}>
                  <OrbStat label="Liability Flow" value={dashboardData.current_balance} currency="AED" icon={TrendingUp} color="#ef4444" />
                  <OrbStat label="Interaction Pulse" value={Object.values(dashboardData.counts).reduce((a, b) => a + b, 0)} icon={Zap} color={themeColor} />
                  <OrbStat label="Registry Stability" value={!selectedCustomer.disabled ? "Stable" : "Isolated"} icon={HeartPulse} color={!selectedCustomer.disabled ? "#10b981" : "#f59e0b"} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                  <GridPanel title="Sales Orders" count={dashboardData.counts.sales_orders} icon={ShoppingCart} color={themeColor} />
                  <GridPanel title="Sales Invoices" count={dashboardData.counts.sales_invoices} icon={Receipt} color={themeColor} />
                  <GridPanel title="Delivery Notes" count={dashboardData.counts.delivery_notes} icon={Package} color={themeColor} />
                  <GridPanel title="Customer Ledger" count="QUERY" icon={HardDrive} color="#6366f1" />
                </div>
              </div>
            )}

            {activeDetailTab === 'Geospatial' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4rem' }}>
                {selectedCustomer.addresses?.map((a, i) => (
                  <div key={i} style={{ background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                      <span style={{ fontSize: '10px', fontWeight: 950, background: '#fff', color: '#64748b', padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', textTransform: 'uppercase' }}>{a.address_type} Node</span>
                      {a.is_primary_address === 1 && <div style={{ background: themeColor, color: '#fff', padding: '0.5rem 1.5rem', borderRadius: '12px', fontSize: '10px', fontWeight: 950 }}>PRIMARY HUB</div>}
                    </div>
                    <h4 style={{ fontSize: '1.75rem', fontWeight: 950, color: '#0f172a', marginBottom: '12px' }}>{a.address_title}</h4>
                    <p style={{ fontSize: '1.15rem', color: '#64748b', fontWeight: 600, lineHeight: 1.75 }}>{a.address_line1}<br />{a.address_line2 && a.address_line2 + ', '}{a.city}, {a.country}</p>
                  </div>
                ))}
                {selectedCustomer.addresses?.length === 0 && <p style={{ gridColumn: 'span 2', textAlign: 'center', padding: '10rem', color: '#cbd5e1', fontWeight: 950, fontSize: '24px' }}>NO SPATIAL COORDINATES DETECTED</p>}
              </div>
            )}

            {activeDetailTab === 'Personnel' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem' }}>
                {selectedCustomer.contacts?.map((c, i) => (
                  <div key={i} style={{ background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9', textAlign: 'center' }}>
                    <div style={{ height: '100px', width: '100px', borderRadius: '32px', background: '#fff', border: '3px solid #e2e8f0', margin: '0 auto 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                      <User size={56} />
                    </div>
                    <h4 style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a' }}>{c.full_name}</h4>
                    <p style={{ fontSize: '12px', fontWeight: 950, color: themeColor, textTransform: 'uppercase', tracking: '0.15em', marginTop: '6px' }}>{c.designation || 'ACCESS NODAL SPECIALIST'}</p>
                    <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b', fontWeight: 700, fontSize: '15px' }}><Mail size={16} /> {c.email_id || 'NULL-VEC'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b', fontWeight: 700, fontSize: '15px' }}><Phone size={16} /> {c.mobile_no || 'OFFLINE'}</div>
                    </div>
                    {c.is_primary_contact === 1 && <div style={{ marginTop: '2.5rem', background: '#ecfdf5', color: '#10b981', padding: '10px 0', borderRadius: '14px', fontSize: '10px', fontWeight: 950 }}>PRIMARY ACCESS HUB</div>}
                  </div>
                ))}
                {selectedCustomer.contacts?.length === 0 && <p style={{ gridColumn: 'span 3', textAlign: 'center', padding: '10rem', color: '#cbd5e1', fontWeight: 950, fontSize: '24px' }}>NO CONTACTS LINKED</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────── CUSTOMER MANAGEMENT PORTAL ────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[11000] bg-[#f5f6fa] flex flex-col font-sans overflow-hidden animate-fadeIn">
          {/* UI Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between z-10 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${themeColor}12`, color: themeColor }}>
                  <User size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none">
                    {modalMode === 'edit' ? 'Edit Customer Registry' : 'New Customer Registry'}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Customer Directory Profile</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-rose-500 transition-all rounded-lg"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.customer_name}
                className="px-5 py-2 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: themeColor }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Saving...' : (modalMode === 'edit' ? 'Save Customer' : 'Create Customer')}
              </button>
            </div>
          </div>

          {/* Form Body - Direct 2-Column Grid to align Heights perfectly across Row 1 and Row 2 */}
          <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-6">
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12 items-stretch">

              {/* Row 1 - Col 1: Section 1 (Core Customer Specifications) */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      1
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Opportunity Details</h3>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.customer_name}
                      onChange={e => setForm({ ...form, customer_name: e.target.value })}
                      placeholder="e.g. Acme Corp - Primary Corporate Customer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Customer Group <span className="text-rose-500">*</span>
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Customer Type
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Territory
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Salutation
                    </label>
                    <select
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.salutation}
                      onChange={e => setForm({ ...form, salutation: e.target.value })}
                    >
                      <option value="">NA</option>
                      {meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Gender Profile
                    </label>
                    <select
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
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

              {/* Row 2 - Col 1: Section 2 (Contact Info & Address) */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      2
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Deal Information</h3>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Email Id
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Mobile No
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.mobile_no}
                      onChange={e => {
                        const val = e.target.value;
                        const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971';
                        setForm({ ...form, mobile_no: sanitizeMobileNo(val, code) });
                      }}
                      onBlur={() => {
                        const code = form.custom_phone_code || countryPhoneCodes[(form.country || '').toLowerCase().trim()] || '+971';
                        setForm(prev => ({ ...prev, mobile_no: sanitizeMobileNo(prev.mobile_no, code) }));
                      }}
                      placeholder="+971 50 --- ----"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Address Type
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      City Station
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Emirate Hub
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Country
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Building / Street Line 1
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.address_line1}
                      onChange={e => setForm({ ...form, address_line1: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Address Line 2
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.address_line2}
                      onChange={e => setForm({ ...form, address_line2: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Row 1 - Col 2: Section 3 (Currency and Price List) */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      3
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Source & Assignment</h3>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Tax Id
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.tax_id}
                      onChange={e => setForm({ ...form, tax_id: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Tax Category
                    </label>
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

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
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
                        className="flex-1 h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                        style={{ borderColor: '#cbd5e1', outline: 'none' }}
                        value={form.image}
                        onChange={e => setForm({ ...form, image: e.target.value })}
                        placeholder="e.g. https://example.com/avatar.jpg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Pricing Matrix
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Payment Terms Protocol
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Loyalty Hub Link
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Account Supervisor
                    </label>
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Customer POS Ident
                    </label>
                    <input
                      className="w-full h-11 px-4 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.customer_pos_id}
                      onChange={e => setForm({ ...form, customer_pos_id: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Prospect Alias
                    </label>
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

              {/* Row 2 - Col 2: Section 4 (Settings & Controls) */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      4
                    </div>
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

                  {/* Section: Personnel Profile (Primary Contact) */}
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
                      <select
                        className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                        style={{ borderColor: '#cbd5e1', outline: 'none' }}
                        value={form.status}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Passive">Passive</option>
                        <option value="Isolated">Isolated</option>
                      </select>
                      <input
                        placeholder="Contact Mobile"
                        className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                        style={{ borderColor: '#cbd5e1', outline: 'none' }}
                        value={form.contact_mobile}
                        onChange={e => setForm({ ...form, contact_mobile: e.target.value })}
                      />
                      <input
                        placeholder="Contact Email"
                        className="w-full h-9 px-3 border rounded-lg text-xs font-medium text-slate-700 bg-white"
                        style={{ borderColor: '#cbd5e1', outline: 'none' }}
                        value={form.contact_email}
                        onChange={e => setForm({ ...form, contact_email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 flex flex-col flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Customer Details
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border rounded-lg text-xs font-medium text-slate-700 bg-white min-h-[85px] resize-none flex-1"
                      style={{ borderColor: '#cbd5e1', outline: 'none' }}
                      value={form.customer_details}
                      onChange={e => setForm({ ...form, customer_details: e.target.value })}
                      placeholder="Enter customer details or description notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Row 3 - Col 1: Section 5 (Branch Availability) */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden group hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      5
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Branch Availability</h3>
                  </div>
                </div>
                <div className="p-6 space-y-4 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select branches where this customer can be used:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1">
                    {meta.warehouses?.map(wh => (
                      <label key={wh} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer transition-all hover:bg-slate-100/80">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          style={{ accentColor: themeColor }}
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

          {/* Sticky Footer exact structure matching mockup */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
            <div className="text-xs font-semibold text-slate-400">
              Fields marked <span className="text-rose-500">*</span> are required
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.customer_name}
                className="px-6 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: themeColor }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : (modalMode === 'edit' ? 'Save Customer' : 'Create Customer')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showGlobalSyncModal && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fadeIn p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] text-left">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 flex items-center justify-between" style={{ padding: '1.25rem 1.75rem' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-50 text-[#0369a1]">
                  <Globe size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">Global Discovery Wizard</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Sync Customers across branches</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGlobalSyncModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '1.75rem', gap: '1.25rem' }}>
              {/* Search Bar inside Modal */}
              <div className="flex shrink-0" style={{ gap: '0.75rem' }}>
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, code, or mobile globally..."
                    value={globalSyncSearch}
                    onChange={e => setGlobalSyncSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runGlobalSearch()}
                    className="w-full border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all bg-slate-50/50"
                    style={{ height: '2.75rem', paddingLeft: '3rem', paddingRight: '1rem' }}
                  />
                </div>
                <button
                  onClick={() => runGlobalSearch()}
                  disabled={searchingGlobal}
                  className="px-6 text-xs font-bold uppercase tracking-wider text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  style={{ height: '2.75rem' }}
                >
                  {searchingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Discover
                </button>
              </div>

              {/* List */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30 flex-1 min-h-[250px] flex flex-col">
                {searchingGlobal ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                    <Loader2 size={24} className="animate-spin text-[#0369a1]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Searching Global Registries...</span>
                  </div>
                ) : globalCustomers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-3">
                    <Users size={36} className="text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">No Discovered Records</p>
                      <p className="text-[10px] text-slate-400 font-medium">Type a customer name above and click Discover</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[350px] divide-y divide-slate-100 bg-white">
                    {/* Select All row */}
                    <div className="bg-slate-50/50 flex items-center justify-between" style={{ padding: '0.75rem 1.25rem' }}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGlobalCustomers.length === globalCustomers.filter(c => !c.active_branches || !c.active_branches.includes(warehouse)).length && globalCustomers.filter(c => !c.active_branches || !c.active_branches.includes(warehouse)).length > 0}
                          onChange={(e) => {
                            const unlinked = globalCustomers.filter(c => !c.active_branches || !c.active_branches.includes(warehouse));
                            if (e.target.checked) {
                              setSelectedGlobalCustomers(unlinked.map(c => c.name));
                            } else {
                              setSelectedGlobalCustomers([]);
                            }
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select All Unlinked</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {selectedGlobalCustomers.length} Selected
                      </span>
                    </div>

                    {/* Records rows */}
                    {globalCustomers.map((c, i) => {
                      const isLinked = c.active_branches && c.active_branches.includes(warehouse);
                      return (
                        <div key={i} className={`flex items-center justify-between hover:bg-slate-50/50 transition-colors ${isLinked ? 'opacity-60 bg-slate-50/20' : ''}`} style={{ padding: '0.875rem 1.25rem' }}>
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              disabled={isLinked}
                              checked={selectedGlobalCustomers.includes(c.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGlobalCustomers(prev => [...prev, c.name]);
                                } else {
                                  setSelectedGlobalCustomers(prev => prev.filter(name => name !== c.name));
                                }
                              }}
                              className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4 disabled:opacity-50"
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-[13px] text-slate-700">{c.customer_name}</span>
                              <span className="text-[10px] text-slate-400 font-medium font-mono">{c.name} • {c.customer_group}</span>
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            {isLinked ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">Already Linked</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-600 border border-sky-100 uppercase tracking-wider">Ready to Sync</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0" style={{ padding: '1rem 1.75rem' }}>
              <button
                onClick={() => setShowGlobalSyncModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-rose-500 transition-all rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSync}
                disabled={syncingGlobal || selectedGlobalCustomers.length === 0}
                className="px-6 py-2.5 text-white bg-sky-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:scale-100 cursor-pointer"
              >
                {syncingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {syncingGlobal ? 'Syncing...' : `Sync ${selectedGlobalCustomers.length} Selected`}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showLoyaltyModal && (
        <LoyaltyCardModal 
          customer={selectedCustomer} 
          themeColor={themeColor} 
          onClose={() => setShowLoyaltyModal(false)} 
        />
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */
const DataInfo = ({ icon: Icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', py: '4px' }}>
    <div style={{ height: '52px', width: '52px', borderRadius: '16px', background: '#fff', border: '2.5px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      <Icon size={22} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: '11px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', tracking: '0.05em', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '1.1rem', fontWeight: 850, color: color || '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '⎯⎯⎯'}</p>
    </div>
  </div>
);

const DetailCard = ({ title, children }) => (
  <div style={{ background: '#f8fafc', padding: '3rem', borderRadius: '3.5rem', border: '4px solid #f1f5f9' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3rem' }}>{title}</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>{children}</div>
  </div>
);

const OrbStat = ({ label, value, currency, icon: Icon, color }) => (
  <div style={{ background: '#fff', padding: '3rem', borderRadius: '4rem', border: '5px solid #f8fafc', display: 'flex', gap: '2.5rem', alignItems: 'center', shadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
    <div style={{ height: '90px', width: '90px', borderRadius: '32px', background: `${color}10`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={44} />
    </div>
    <div>
      <p style={{ fontSize: '12px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em' }}>{label}</p>
      <p style={{ fontSize: '3rem', fontWeight: 950, color: '#0f172a', tracking: '-0.04em', lineHeight: 1 }}>
        {currency && (
          currency === 'AED' ? (
            <DirhamIcon size={16} className="text-slate-300 mr-2 inline-block align-middle" style={{ verticalAlign: 'middle' }} />
          ) : (
            <span style={{ fontSize: '16px', color: '#cbd5e1', marginRight: '8px', verticalAlign: 'middle' }}>{currency}</span>
          )
        )}
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  </div>
);


const GridPanel = ({ title, count, icon: Icon, color }) => (
  <div style={{ background: '#f8fafc', padding: '2.5rem', borderRadius: '2.5rem', border: '3px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <Icon size={28} style={{ color: '#94a3b8' }} />
      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{title}</span>
    </div>
    <span style={{ fontSize: '15px', fontWeight: 950, background: '#fff', color: '#0f172a', padding: '8px 24px', borderRadius: '16px', border: '2.5px solid #e2e8f0' }}>{count}</span>
  </div>
);

export default CustomerList;