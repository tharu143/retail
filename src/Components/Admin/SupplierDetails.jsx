import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart,
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
  ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText,
  Search, Filter, Lock, Unlock, AlertTriangle, CheckSquare, Square, User, RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import SupplierFormModal from './SupplierFormModal';
import { Palette } from 'lucide-react';
import { ChevronDown } from "lucide-react";

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, themeColor, isGreen }) => (
  <div
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group"
  >
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {currency && <span className="text-[11px] font-bold text-slate-500 uppercase">{currency}</span>}
        <h4 className="text-2xl font-black text-slate-800 tracking-tight">
          {value}
        </h4>
      </div>
    </div>
    <div className="p-3.5 rounded-xl transition-colors" style={{ backgroundColor: `${themeColor}0c` }}>
      <Icon size={22} style={{ color: themeColor }} strokeWidth={2.5} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName, icon: Icon, themeColor }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-all duration-300">
    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/20">
      <Icon size={16} style={{ color: themeColor }} />
      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</h5>
    </div>
    <div className="p-4 flex-1">
      <div className="space-y-1.5">
        {links.map((link, idx) => (
          <div
            key={idx}
            onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-100/60"
          >
            <span className="text-xs font-semibold text-slate-700">{link.doctype}</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-100/80 text-slate-500 rounded-full group-hover:bg-slate-200 transition-all">{link.count}</span>
              <ArrowRight size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        ))}
        {links.length === 0 && (
          <div className="py-8 flex flex-col items-center justify-center text-center opacity-40">
            <Layers size={32} className="mb-2 text-slate-300" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Registry Empty</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const InfoSection = ({ title, children, icon: Icon, themeColor }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 hover:shadow-md transition-all duration-300">
    <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/20 flex items-center gap-3">
      <Icon size={16} style={{ color: themeColor }} />
      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</h5>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const SupplierDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const warehouse = useSelector((state) => state.user.warehouse);
  const { legacySubTheme, isGreen, themeColor, themeLight, toggleTheme } = useLegacyTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard'); // Dashboard, General, Addresses, Contacts, Settings
  const [showEditModal, setShowEditModal] = useState(false);

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_group: '',
    supplier_type: 'Company',
    tax_id: '',
    // Personalize Primary Entities
    contact_name: '',
    first_name: '',
    email_id: '',
    mobile_no: '',
    // Address Details
    address_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    emirate: '',
    country: 'United Arab Emirates',
    // ... governance flags unchanged
    is_transporter: 0,
    is_internal_supplier: 0,
    is_frozen: 0,
    on_hold: 0,
    hold_type: '',
    warn_rfqs: 0,
    warn_pos: 0,
    prevent_rfqs: 0,
    prevent_pos: 0,
    disabled: 0,
    // New fields confirmed by metadata
    default_currency: 'AED',
    default_price_list: '',
    tax_category: '',
    tax_withholding_category: '',
    payment_terms: '',
    supplier_primary_address: '',
    supplier_primary_contact: '',
    supplier_details: '',
    allow_purchase_invoice_creation_without_purchase_order: 0,
    allow_purchase_invoice_creation_without_purchase_receipt: 0
  });

  const [emirates] = useState(['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']);

  // Connectivity Sub-tabs & Filters
  const [activeModule, setActiveModule] = useState('');
  const [linkedAddresses, setLinkedAddresses] = useState([]);
  const [linkedContacts, setLinkedContacts] = useState([]);
  const [linkedSearch, setLinkedSearch] = useState('');
  const [connDateRange, setConnDateRange] = useState({ start: '', end: '' });

  const [supplierGroups] = useState(['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler', 'Retailer']);

  useEffect(() => {
    fetchData();
  }, [name]);

  const fetchData = async () => {
    if (!name) return;
    try {
      setLoading(true);
      const [detailRes, dashRes] = await Promise.all([
        axios.get('/api/method/kyle_retail.retail_api.api.get_supplier_detail', { params: { supplier_name: name }, withCredentials: true }),
        axios.get('/api/method/kyle_retail.retail_api.api.get_supplier_dashboard_details', { params: { supplier_name: name }, withCredentials: true })
      ]);

      const data = detailRes.data.message?.data || detailRes.data.data;
      if (data) {
        setSupplier(data);
        setForm({
          supplier_name: data.supplier_name,
          supplier_group: data.supplier_group,
          supplier_type: data.supplier_type,
          tax_id: data.tax_id || '',
          // Contact Split
          contact_name: data.contact_details?.name || '',
          first_name: data.contact_details?.first_name || '',
          email_id: data.contact_details?.email_id || data.email_id || '',
          mobile_no: data.contact_details?.mobile_no || data.mobile_no || '',
          // Address Split
          address_name: data.address_details?.name || '',
          address_line1: data.address_details?.address_line1 || '',
          address_line2: data.address_details?.address_line2 || '',
          city: data.address_details?.city || '',
          emirate: data.address_details?.emirate || '',
          country: data.country || 'United Arab Emirates',
          // ... governance flags
          is_transporter: data.is_transporter || 0,
          is_internal_supplier: data.is_internal_supplier || 0,
          is_frozen: data.is_frozen || 0,
          on_hold: data.on_hold || 0,
          hold_type: data.hold_type || '',
          warn_rfqs: data.warn_rfqs || 0,
          warn_pos: data.warn_pos || 0,
          prevent_rfqs: data.prevent_rfqs || 0,
          prevent_pos: data.prevent_pos || 0,
          disabled: data.disabled || 0,
          // New fields payload map
          default_currency: data.default_currency || 'AED',
          default_price_list: data.default_price_list || '',
          tax_category: data.tax_category || '',
          tax_withholding_category: data.tax_withholding_category || '',
          payment_terms: data.payment_terms || '',
          supplier_primary_address: data.supplier_primary_address || '',
          supplier_primary_contact: data.supplier_primary_contact || '',
          supplier_details: data.supplier_details || '',
          allow_purchase_invoice_creation_without_purchase_order: data.allow_purchase_invoice_creation_without_purchase_order || 0,
          allow_purchase_invoice_creation_without_purchase_receipt: data.allow_purchase_invoice_creation_without_purchase_receipt || 0,
          branch_availability: data.branch_availability || []
        });
      }
      const dash = dashRes.data.message || dashRes.data;
      if (data.default_price_list) {
        if (!dash.connections) dash.connections = {};
        if (!dash.connections['Procurement']) dash.connections['Procurement'] = [];
        // Only add if not already present
        if (!dash.connections['Procurement'].find(c => c.doctype === 'Price List')) {
          dash.connections['Procurement'].push({
            doctype: 'Price List',
            count: 1
          });
        }
      }
      setDashboardData(dash);
      if (dash?.connections && Object.keys(dash.connections).length > 0) {
        setActiveModule(Object.keys(dash.connections)[0]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setTimeout(() => setLoading(false), 600);
      fetchLinkedData();
    }
  };

  const fetchLinkedData = async () => {
    try {
      const [addrRes, contactRes] = await Promise.all([
        axios.get('/api/resource/Address', {
          params: {
            filters: JSON.stringify([['Dynamic Link', 'link_name', '=', name], ['Dynamic Link', 'link_doctype', '=', 'Supplier']]),
            fields: JSON.stringify(['name', 'address_title', 'address_type', 'city', 'country', 'address_line1']),
            limit_page_length: 50
          }
        }),
        axios.get('/api/resource/Contact', {
          params: {
            filters: JSON.stringify([['Dynamic Link', 'link_name', '=', name], ['Dynamic Link', 'link_doctype', '=', 'Supplier']]),
            fields: JSON.stringify(['name', 'first_name', 'last_name', 'designation', 'email_id', 'mobile_no']),
            limit_page_length: 50
          }
        })
      ]);
      setLinkedAddresses(addrRes.data.data || []);
      setLinkedContacts(contactRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch linked addresses/contacts:', err);
    }
  };

  const navigateDoc = (doctype) => {
    const map = {
      'Purchase Order': 'purchaseorderlist',
      'Purchase Receipt': 'purchasereceiptlist',
      'Purchase Invoice': 'purchaseinvoicelist',
      'Sales Order': 'salesorderlist',
      'Sales Invoice': 'salesinvoice',
      'Delivery Note': 'deliverynote',
      'Contact': 'contactlist',
      'Address': 'addresslist'
    };
    const route = map[doctype] || `${doctype.toLowerCase().replace(/ /g, '')}list`;
    navigate(`/${route}?supplier=${encodeURIComponent(name)}`);
  };

  const navigateDetail = (doctype, docname) => {
    const map = {
      'Purchase Order': `/purchaseorder?name=${encodeURIComponent(docname)}`,
      'Purchase Receipt': `/purchasereceiptlist?name=${encodeURIComponent(docname)}`,
      'Purchase Invoice': `/purchaseinvoicelist?name=${encodeURIComponent(docname)}`,
      'Sales Order': `/salesorder-details/${encodeURIComponent(docname)}`,
      'Sales Invoice': `/salesinvoice?name=${encodeURIComponent(docname)}`,
      'Delivery Note': `/deliverynote?name=${encodeURIComponent(docname)}`
    };
    const path = map[doctype] || `/${doctype.toLowerCase().replace(/ /g, '')}list?name=${encodeURIComponent(docname)}`;
    navigate(path);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // 1. Update Core Supplier
      const supplierRes = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
        supplier_name: name,
        data: form
      }, { withCredentials: true });

      if (supplierRes.data.message?.status !== 'success') {
        throw new Error(supplierRes.data.message?.message || 'Update rejected by server.');
      }

      // 2. Update Primary Contact if it exists
      if (form.contact_name) {
        await axios.put(`/api/resource/Contact/${encodeURIComponent(form.contact_name)}`, {
          first_name: form.first_name,
          email_id: form.email_id,
          mobile_no: form.mobile_no
        });
      }

      // 3. Update Primary Address if it exists
      if (form.address_name) {
        await axios.put(`/api/resource/Address/${encodeURIComponent(form.address_name)}`, {
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          emirate: form.emirate,
          country: form.country
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'System Authorized',
        text: 'Partner profile & related doctypes synchronized.',
        borderRadius: '2rem',
        confirmButtonColor: themeColor
      });
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Authorization Refused', text: err.message, borderRadius: '2rem', confirmButtonColor: themeColor });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfdfe] gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-100 rounded-full animate-spin" style={{ borderTopColor: themeColor }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full animate-ping opacity-20" style={{ backgroundColor: themeColor }} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Restructuring Virtual Assets...</p>
    </div>
  );

  if (!supplier) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfdfe] text-center p-8">
      <div className="p-10 bg-rose-50 rounded-[3rem] mb-8">
        <AlertCircle size={64} className="text-rose-400" />
      </div>
      <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-3">Partner Not Found</h2>
      <p className="text-sm font-medium text-gray-400 max-w-xs mb-10">The requested entity does not exist in the current procurement shard.</p>
      <button onClick={() => navigate(-1)} className="px-10 py-4 bg-gray-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:shadow-xl transition-all active:scale-95">Relocate to Directory</button>
    </div>
  );

  const isActive = supplier?.disabled === 0;

  const linkTypeToIcon = (type) => {
    switch (type) {
      case 'Procurement': return ShoppingCart;
      case 'Sales': return Receipt;
      case 'CRM': return Users;
      default: return Layers;
    }
  };

  const currConnections = dashboardData?.connections?.[activeModule] || [];

  return (
    <>
      <div className="min-h-screen bg-[#f8fafc] pb-24">

        {/* Page Header */}
        <div className="sticky top-0 z-45 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5">
          <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-100 flex items-center gap-1.5 shadow-sm"
              >
                <ChevronLeft size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">BACK</span>
              </button>

              <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-md overflow-hidden text-white">
                <Building2 size={20} style={{ color: themeColor }} />
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">
                    {supplier.supplier_name}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {isActive ? 'Operational' : 'Restricted'}
                  </span>
                </div>
                {/* Dynamic Metadata Row in Header */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <Tag size={10} style={{ color: themeColor }} />
                    <span>Group: {supplier.supplier_group}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <Globe size={10} style={{ color: themeColor }} />
                    <span>Country: {supplier.country || 'Global Site'}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <CreditCard size={10} style={{ color: themeColor }} />
                    <span>Price List: {supplier.default_price_list || 'Standard Buying'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                title={`Switch to ${isGreen ? 'Blue' : 'Green'} Theme`}
              >
                <Palette size={13} style={{ color: themeColor }} />
                <span>{isGreen ? 'BLUE' : 'GREEN'}</span>
              </button>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchData();
                }}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                title="Sync Dashboard Data"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>REFRESH</span>
              </button>
              <button
                onClick={() => navigate(`/generalledgerreport?party_type=Supplier&party=${name}`)}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                title="View General Ledger"
              >
                <FileText size={13} />
                <span>GENERAL LEDGER</span>
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="px-5 py-2.5 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                style={{ backgroundColor: themeColor }}
              >
                <Edit2 size={13} />
                <span>EDIT PROFILE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Intelligence Navigation Tabs */}
        <div className="px-8 py-4 sticky top-[77px] z-30 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-100/60">
          <div className="inline-flex p-1 bg-slate-100/80 rounded-xl gap-1">
            {[
              { id: 'Dashboard', icon: Activity },
              { id: 'General', icon: FileText },
              { id: 'Addresses', icon: MapPin },
              { id: 'Contacts', icon: Users },
              { id: 'Branches', icon: Building2 },
              { id: 'Settings', icon: ShieldCheck }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 rounded-lg ${activeTab === tab.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                <tab.icon size={14} style={{ color: activeTab === tab.id ? themeColor : undefined }} />
                <span>{tab.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Shard */}
        <div className="px-8 mt-8">
          {activeTab === 'Dashboard' && dashboardData && (
            <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700 pb-20">
              {/* Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <StatCard
                  label="Annual Billing"
                  value={parseFloat(dashboardData.stats?.annual_billing || 0).toLocaleString()}
                  currency={dashboardData.stats?.currency || 'AED'}
                  icon={TrendingUp}
                  themeColor={themeColor}
                  isGreen={isGreen}
                />
                <StatCard
                  label="Liability Exposure"
                  value={parseFloat(dashboardData.stats?.total_unpaid || 0).toLocaleString()}
                  currency={dashboardData.stats?.currency || 'AED'}
                  icon={Activity}
                  themeColor={themeColor}
                  isGreen={isGreen}
                />
              </div>

              {/* Connection Matrices */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                {dashboardData.connections && Object.entries(dashboardData.connections).map(([category, links]) => {
                  if (!links || links.length === 0) return null;
                  return (
                    <ConnectionCard
                      key={category}
                      title={category}
                      links={links}
                      navigate={navigate}
                      supplierName={name}
                      icon={linkTypeToIcon(category)}
                      themeColor={themeColor}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'General' && (
            <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <InfoSection title="General Information" icon={Hash} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legal Name</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.supplier_name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Industrial Cluster</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.supplier_group}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Structural Format</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.supplier_type}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Identity (TRN)</label>
                      <p className="text-xs font-bold text-slate-800 font-mono tracking-tight bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg inline-block mt-0.5">
                        {supplier.tax_id || 'NOT REGISTERED'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Category</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.tax_category || 'General'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Withholding Category</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.tax_withholding_category || 'None'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Terms</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.payment_terms || 'Not Set'}</p>
                    </div>
                  </div>
                </InfoSection>

                <InfoSection title="Deal Information" icon={Tag} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        Email Id
                        {!supplier.email_id && supplier.contact_details?.email_id && (
                          <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full lowercase">linked</span>
                        )}
                      </label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.email_id || supplier.contact_details?.email_id || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        Mobile No
                        {!supplier.mobile_no && supplier.contact_details?.mobile_no && (
                          <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full lowercase">linked</span>
                        )}
                      </label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.mobile_no || supplier.contact_details?.mobile_no || '—'}</p>
                    </div>
                    <div className="space-y-1 col-span-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Contact</label>
                      <p className="text-sm font-semibold text-blue-600">
                        {supplier.contact_details?.name ? (
                          <span className="flex items-center gap-1.5">
                            {supplier.contact_details.first_name} {supplier.contact_details.last_name}
                            <span className="text-[9px] text-slate-400 font-medium">({supplier.contact_details.name})</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    <div className="space-y-1 col-span-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Address</label>
                      <div className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-100/50 rounded-xl p-3.5 mt-1">
                        {supplier.address_details?.address_line1 || '—'}<br />
                        {supplier.address_details?.address_line2 && <>{supplier.address_details.address_line2}<br /></>}
                        {supplier.address_details?.city && (
                          <span className="text-[11px] text-slate-500">
                            {supplier.address_details.city}
                            {supplier.address_details.emirate ? `, ${supplier.address_details.emirate}` : (supplier.address_details.county ? `, ${supplier.address_details.county}` : '')}
                            {supplier.address_details.country ? `, ${supplier.address_details.country}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </InfoSection>


                <InfoSection title="Supplier Registry" icon={Calendar} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Key</label>
                      <p className="text-xs font-semibold font-mono bg-blue-50/30 px-2 py-1 rounded inline-block mt-0.5" style={{ color: themeColor }}>{supplier.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Currency</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.default_currency || 'AED'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price List</label>
                      <p className="text-sm font-semibold text-slate-800">{supplier.default_price_list || 'Standard Buying'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Creation Vector</label>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{new Date(supplier.creation).toLocaleDateString()}</p>
                    </div>
                  </div>
                </InfoSection>
              </div>

              <InfoSection title="Supplier Intelligence Bio" icon={FileText} themeColor={themeColor}>
                <p className="text-xs font-medium text-slate-600 leading-relaxed italic whitespace-pre-wrap">
                  {supplier.supplier_details || 'No detailed intelligence registered for this partner.'}
                </p>
              </InfoSection>
            </div>
          )}

          {activeTab === 'Addresses' && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-5 bg-slate-50/20 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Geospatial Registry</h3>
                  <div className="flex-1 max-w-md mx-8 relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-300 transition-colors"
                      placeholder="Search addresses..."
                      value={linkedSearch}
                      onChange={e => setLinkedSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-8 py-3.5">Registry Vector</th>
                        <th className="px-8 py-3.5">Metrics</th>
                        <th className="px-8 py-3.5 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {linkedAddresses.filter(a => !linkedSearch || a.address_title?.toLowerCase().includes(linkedSearch.toLowerCase()) || a.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(addr => (
                        <tr key={addr.name} onClick={() => navigate(`/addresslist?name=${encodeURIComponent(addr.name)}`)} className="group hover:bg-slate-50/50 transition-colors cursor-pointer">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-4">
                              <div className="p-2.5 bg-slate-100/50 border border-slate-200/50 text-slate-600 rounded-xl"><MapPin size={16} /></div>
                              <div>
                                <h6 className="text-xs font-bold text-slate-800">{addr.address_title}</h6>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{addr.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="px-2.5 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-600 rounded-md uppercase tracking-wider">{addr.address_type}</div>
                              <div className="text-xs font-semibold text-slate-700">{addr.city}, {addr.country}</div>
                            </div>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-slate-50 transition-colors">Access Stream</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Contacts' && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-5 bg-slate-50/20 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Personnel Registry</h3>
                  <div className="flex-1 max-w-md mx-8 relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-300 transition-colors"
                      placeholder="Search contacts..."
                      value={linkedSearch}
                      onChange={e => setLinkedSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-8 py-3.5">Personnel Identity</th>
                        <th className="px-8 py-3.5">Connectivity Meta</th>
                        <th className="px-8 py-3.5 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {linkedContacts.filter(c => !linkedSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(linkedSearch.toLowerCase()) || c.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(con => (
                        <tr key={con.name} onClick={() => navigate(`/contactlist?name=${encodeURIComponent(con.name)}`)} className="group hover:bg-slate-50/50 transition-colors cursor-pointer">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-4">
                              <div className="p-2.5 bg-slate-100/50 border border-slate-200/50 text-slate-600 rounded-xl"><User size={16} /></div>
                              <div>
                                <h6 className="text-xs font-bold text-slate-800">{con.first_name} {con.last_name}</h6>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{con.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs font-bold text-slate-700">{con.designation || 'Personnel'}</div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                <span className="flex items-center gap-1"><Mail size={10} /> {con.email_id || '—'}</span>
                                <span className="flex items-center gap-1"><Phone size={10} /> {con.mobile_no || '—'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-slate-50 transition-colors">Access Stream</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Branches' && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/20">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Branch Availability</h3>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {(supplier?.branch_availability || []).length > 0 ? (
                      supplier.branch_availability.map((branch, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100/50 rounded-2xl hover:bg-slate-100/20 transition-all">
                          <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                            <Building2 size={16} style={{ color: themeColor }} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{branch.warehouse}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Authorized Branch</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-60">
                        <Building2 size={48} className="mb-4 text-slate-300" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">No Branch Restrictions</p>
                        <p className="text-[11px] text-slate-400 mt-1">This supplier is available across all operational zones.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
              <InfoSection title="Policy Controls" icon={ShieldCheck} themeColor={themeColor}>
                <div className="flex items-center justify-between bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lifecycle Permissions</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current operational authorization</p>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2 rounded-xl border border-transparent text-xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: isActive ? `${themeColor}15` : '#fff1f2',
                      color: isActive ? themeColor : '#e11d48'
                    }}
                  >
                    <Activity size={16} className={isActive ? 'animate-pulse' : ''} />
                    <span>{isActive ? 'Authorized' : 'Restricted'}</span>
                  </div>
                </div>
              </InfoSection>

              <InfoSection title="Settings & Status" icon={ShieldCheck} themeColor={themeColor}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Transporter', active: supplier.is_transporter },
                    { label: 'Internal Supplier', active: supplier.is_internal_supplier },
                    { label: 'Frozen', active: supplier.is_frozen },
                    { label: 'On Hold', active: supplier.on_hold },
                    { label: 'Disabled', active: supplier.disabled },
                    { label: 'Bill without PO', active: supplier.allow_purchase_invoice_creation_without_purchase_order },
                    { label: 'Bill without Receipt', active: supplier.allow_purchase_invoice_creation_without_purchase_receipt }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                      <span className="text-xs font-bold text-slate-600">{item.label}</span>
                      {item.active ? (
                        <CheckSquare size={16} className="text-emerald-500" />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </div>
                  ))}
                  {supplier.on_hold && (
                    <div className="col-span-full p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
                      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-1">Hold Logic</p>
                      <p className="text-xs font-bold text-rose-700 italic">"{supplier.hold_type || 'Manual Hold'}"</p>
                    </div>
                  )}
                </div>
              </InfoSection>
            </div>
          )}
        </div>
      </div>

      <SupplierFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={() => {
          fetchData();
          setShowEditModal(false);
        }}
        editingSupplier={supplier}
        userWarehouse={warehouse}
      />
    </>
  );
};




export default SupplierDetails;