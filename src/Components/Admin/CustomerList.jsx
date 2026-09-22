import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Eye, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, Contact, MoreHorizontal
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './CustomerList.css';
import LoyaltyCardModal from './LoyaltyCardModal';
import ListCustomizer from './ListCustomizer';
import CustomerFormModal from './CustomerFormModal';

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

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Dropdown action menu
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const requestedFields = Array.from(new Set([...customColumns, 'modified', 'creation', 'owner', 'modified_by']));
      const res = await axios.get(`${API_BASE}.get_customers_list`, { 
        params: { 
          order_by: `${sortField} ${sortOrder}`,
          search: filterSearch,
          warehouse: filterBranch !== 'all' ? filterBranch : undefined,
          extra_fields: JSON.stringify(requestedFields)
        } 
      });
      setCustomers(Array.isArray(res.data.message?.data) ? res.data.message.data : []);
    } catch (err) { console.error('List failed', err); }
    finally { setLoading(false); }
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
    <div className="erp-page customer-list-page">
      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="animate-in fade-in duration-300">
          {/* 1. Top Sub-Tabs Bar */}
          <div className="customer-top-tabs-bar">
            <button className="customer-tab-btn active">Customer</button>
            <button className="customer-tab-btn" onClick={() => navigate('/salesreport')}>Reports</button>
          </div>

          {/* 2. Main Header */}
          <PageHeader className="customer-header-container">
            <div className="customer-title-group">
              <h1>CUSTOMER MANAGEMENT</h1>
              <p>Manage customer and account records</p>
            </div>
            <div className="customer-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  background: '#ffffff',
                  color: themeColor || '#0082f6',
                  border: `1.5px solid ${themeColor || '#0082f6'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease-in-out',
                  boxSizing: 'border-box'
                }}
              >
                <Palette size={14} />
                <span>{isGreen ? 'BLUE' : 'GREEN'}</span>
              </button>
              <ListCustomizer
                doctype="Customer"
                onSave={cols => setCustomColumns(cols)}
                themeColor={themeColor || '#0082f6'}
                btnStyle={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  background: '#ffffff',
                  color: themeColor || '#0082f6',
                  border: `1.5px solid ${themeColor || '#0082f6'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease-in-out',
                  boxSizing: 'border-box'
                }}
              />
              <button className="erp-button erp-button-primary customer-btn-create" onClick={() => navigate('/customer-edit/new')}>
                <Plus size={16} />
                <span>CREATE CUSTOMER</span>
              </button>
            </div>
          </PageHeader>

          {/* 3. Filter Bar */}
          <div className="erp-filter-bar customer-filter-bar">
            <div className="customer-filter-group" style={{ flex: '1 1 320px' }}>
              <label className="customer-filter-label">Search Customer</label>
              <div className="customer-search-wrapper">
                <div className="customer-search-input-box">
                  <Search className="customer-search-icon" />
                  <input
                    type="text"
                    className="customer-search-input"
                    placeholder="Name, ID or Contact..."
                    value={filterSearch}
                    onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <button className="customer-btn-global-sync" onClick={openGlobalSyncModal} disabled={searchingGlobal}>
                  {searchingGlobal ? <Loader2 size={13} className="animate-spin" /> : <Globe size={14} />}
                  <span>GLOBAL SYNC</span>
                </button>
              </div>
            </div>

            <div className="customer-filter-group" style={{ flex: '1 1 160px' }}>
              <label className="customer-filter-label">Group</label>
              <select className="customer-select-input" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}>
                <option value="">All Groups</option>
                {meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="customer-filter-group" style={{ flex: '1 1 160px' }}>
              <label className="customer-filter-label">Entity Type</label>
              <select className="customer-select-input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
                <option value="">All Types</option>
                <option value="Company">Company</option>
                <option value="Individual">Individual</option>
              </select>
            </div>

            <div className="customer-filter-group" style={{ flex: '1 1 160px' }}>
              <label className="customer-filter-label">Branch</label>
              <select className="customer-select-input" value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setCurrentPage(1); }}>
                <option value="all">All Branches (Global)</option>
                {meta.warehouses?.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <div className="customer-filter-group" style={{ flex: '1 1 160px' }}>
              <label className="customer-filter-label">Status</label>
              <select className="customer-select-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                <option value="">All Statuses</option>
                <option value="active">Operational Only</option>
                <option value="inactive">Restricted Only</option>
              </select>
            </div>

            <button className="customer-btn-reset" onClick={() => {
              setFilterSearch(''); setFilterGroup(''); setFilterType(''); setFilterStatus(''); setFilterBranch('all'); setCurrentPage(1);
            }}>
              Reset
            </button>
          </div>

          {/* 4. Stats Summary Cards */}
          <div className="customer-stats-card">
            <div className="customer-stat-item">
              <span className="customer-stat-label">TOTAL CUSTOMERS</span>
              <span className="customer-stat-value total">{stats.total}</span>
            </div>
            <div className="customer-stat-item">
              <span className="customer-stat-label">ACTIVE</span>
              <span className="customer-stat-value active">{stats.active}</span>
            </div>
            <div className="customer-stat-item">
              <span className="customer-stat-label">RESTRICTED</span>
              <span className="customer-stat-value frozen">{stats.inactive}</span>
            </div>
            <div className="customer-stat-item">
              <span className="customer-stat-label">CATEGORIES</span>
              <span className="customer-stat-value types">{stats.groups} Types</span>
            </div>
          </div>

          {/* 5. Main Directory Table */}
          <div className="erp-table-card customer-table-card">
            <div className="erp-table-scroll customer-table-wrapper">
              <table className="erp-table customer-directory-table">
                <thead>
                  <tr>
                    <th>Customer Profile</th>
                    <th>Contact Vectors</th>
                    <th>Classification</th>
                    <th>Last Update & Created</th>
                    {customColumns.map(col => (
                      <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                    ))}
                    <th>Status</th>
                    <th style={{ width: '60px', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6 + customColumns.length} style={{ textAlign: 'center', padding: '40px' }}>
                        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: '#0284c7' }} />
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6 + customColumns.length} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <Users size={36} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>No customers match the current filter criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((c) => (
                      <tr
                        key={c.name || c.value}
                        className="customer-table-row"
                        onClick={() => handleCustomerClick(c)}
                      >
                        {/* Customer Profile */}
                        <td>
                          <div className="customer-profile-cell">
                            <div className="customer-profile-icon-box">
                              {c.image ? (
                                <img src={c.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                              ) : (
                                <Users size={18} />
                              )}
                            </div>
                            <div>
                              <div className="customer-profile-name">{c.customer_name || c.label}</div>
                              <div className="customer-profile-subtext">{c.name || c.value}</div>
                            </div>
                          </div>
                        </td>

                        {/* Contact Vectors */}
                        <td>
                          <div className="customer-contact-cell">
                            <div className="customer-contact-item">
                              <Phone className="customer-contact-icon" />
                              <span>{c.mobile || c.mobile_no || 'No Contact'}</span>
                            </div>
                            <div className="customer-contact-item">
                              <Mail className="customer-contact-icon" />
                              <span>{c.email || c.email_id || 'No Email'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Classification */}
                        <td>
                          <div className="customer-classification-cell">
                            <span className="customer-classification-type">{c.customer_type || 'Individual'}</span>
                            <span className="customer-classification-group">{c.customer_group || 'Retail Customer'}</span>
                          </div>
                        </td>

                        {/* Audit & Last Update */}
                        <td>
                          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#334155' }} title="Last Update">
                              <Clock size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                              <span>{c.modified ? formatDate(c.modified) : '-'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }} title="Created By">
                              <User size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                              <span>By: {c.owner ? c.owner.split('@')[0] : 'System'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Custom Columns */}
                        {customColumns.map(col => {
                          let val = c[col];
                          if (['modified', 'creation'].includes(col) && val) {
                            val = formatDate(val);
                          } else if (['owner', 'modified_by'].includes(col) && val) {
                            val = String(val).split('@')[0];
                          } else {
                            val = val !== undefined && val !== null ? String(val) : '-';
                          }
                          return (
                            <td key={col} style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              {val}
                            </td>
                          );
                        })}

                        {/* Status */}
                        <td>
                          {c.is_global ? (
                            <span className="erp-status customer-status-badge restricted">OTHER BRANCH</span>
                          ) : c.disabled === 1 ? (
                            <span className="erp-status customer-status-badge frozen">RESTRICTED</span>
                          ) : (
                            <span className="erp-status customer-status-badge operational">OPERATIONAL</span>
                          )}
                        </td>

                        {/* Action Dropdown Menu */}
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="customer-action-menu-container">
                            <button
                              className="customer-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(activeDropdown === c.name ? null : c.name);
                              }}
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {activeDropdown === c.name && (
                              <div className="customer-action-dropdown" ref={dropdownRef}>
                                <button
                                  className="customer-dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    handleCustomerClick(c);
                                  }}
                                >
                                  <Eye size={14} />
                                  <span>View Details</span>
                                </button>
                                <button
                                  className="customer-dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    navigate(`/customer-edit/${c.name || c.value}`);
                                  }}
                                >
                                  <Edit2 size={14} />
                                  <span>Edit Customer</span>
                                </button>
                                {c.is_global && (
                                  <button
                                    className="customer-dropdown-item"
                                    onClick={(e) => {
                                      setActiveDropdown(null);
                                      handleEnableForBranch(e, c);
                                    }}
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Enable Branch</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination Bar */}
              {!loading && filtered.length > 0 && (
                <div className="customer-pagination-bar">
                  <div>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} customers
                  </div>
                  <div className="customer-pagination-right">
                    <div className="customer-capacity-group">
                      <span className="customer-capacity-label">Per Page</span>
                      <select
                        className="customer-capacity-select"
                        value={pageSize}
                        onChange={e => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="customer-page-nav">
                      <button
                        className="customer-nav-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="customer-page-counter">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        className="customer-nav-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRightIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4rem' }}>
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
                  <DetailCard title="Audit & System Metadata">
                    <DataInfo label="Created By" value={selectedCustomer.owner ? selectedCustomer.owner.split('@')[0] : 'System'} icon={User} />
                    <DataInfo label="Creation Timestamp" value={selectedCustomer.creation ? formatDate(selectedCustomer.creation) : '-'} icon={Calendar} />
                    <DataInfo label="Last Updated By" value={selectedCustomer.modified_by ? selectedCustomer.modified_by.split('@')[0] : 'System'} icon={UserCircle2} />
                    <DataInfo label="Last Update Timestamp" value={selectedCustomer.modified ? formatDate(selectedCustomer.modified) : '-'} icon={Clock} color="#0284c7" />
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
      <CustomerFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={() => {
          if (view === 'detail' && selectedCustomer) fetchFullDetails(selectedCustomer.name);
          fetchCustomers();
        }}
        editingCustomer={modalMode === 'edit' ? selectedCustomer : null}
        userWarehouse={warehouse}
        themeColor={themeColor}
      />

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