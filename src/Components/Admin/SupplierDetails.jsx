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
    className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group"
  >
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {currency && <span className="text-[11px] font-bold text-gray-500 uppercase">{currency}</span>}
        <h4 className="text-2xl font-black text-gray-900 tracking-tight">
          {value}
        </h4>
      </div>
    </div>
    <div className="p-3.5 rounded-xl bg-gray-50 group-hover:bg-opacity-10 transition-colors" style={{ backgroundColor: isGreen ? '#f0fdf4' : '#f0f9ff' }}>
      <Icon size={22} className="text-gray-500 group-hover:opacity-100" style={{ color: themeColor }} strokeWidth={2.5} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName, icon: Icon, themeColor }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-all duration-300">
    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon size={16} style={{ color: themeColor }} strokeWidth={2.5} />
        <h5 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{title}</h5>
      </div>
    </div>
    <div className="p-3 flex-1">
      <div className="space-y-1">
        {links.map((link, idx) => (
          <div
            key={idx}
            onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
            className="flex items-center justify-between p-3.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer group"
          >
            <span className="text-xs font-bold text-gray-700 transition-colors" style={{ color: undefined }}>{link.doctype}</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full group-hover:text-white transition-all" style={{ backgroundColor: undefined }}>{link.count}</span>
              <ArrowRight size={12} className="text-gray-500 transition-all" />
            </div>
          </div>
        ))}
        {links.length === 0 && (
          <div className="py-8 flex flex-col items-center justify-center text-center opacity-40">
            <Layers size={32} className="mb-2 text-gray-300" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Registry Empty</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const InfoSection = ({ title, children, icon: Icon, themeColor }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
      <Icon size={18} style={{ color: themeColor }} strokeWidth={2.5} />
      <h5 className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{title}</h5>
    </div>
    <div className="p-8">
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
      <div className="so-page" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible', position: 'relative', zIndex: 1 }}>

        {/* Page Header */}
        <div className="so-page-header" style={{ position: 'relative', zIndex: 1, borderBottom: `1px solid ${themeColor}12`, padding: '1.25rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(-1)}
              className="so-btn-ghost"
              style={{
                padding: '0.5rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: themeColor,
                backgroundColor: `${themeColor}08`,
                border: `1px solid ${themeColor}15`,
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
                height: '36px'
              }}
            >
              <ChevronLeft size={16} />
              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>BACK</span>
            </button>

            <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  <Building2 size={20} style={{ color: themeColor }} />
                  <span>{supplier.supplier_name}</span>
                </h1>
              </div>

              {/* Dynamic Metadata Row in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.675rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Supplier Info:
                </span>

                {/* Status Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: isActive ? '#f0fdf4' : '#fdf2f2',
                    border: `1.5px solid ${isActive ? '#bbf7d0' : '#fecaca'}`,
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    height: '22px'
                  }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span style={{ fontSize: '0.675rem', fontWeight: 800, color: isActive ? '#15803d' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {isActive ? 'Operational' : 'Restricted'}
                  </span>
                </div>

                {/* Supplier Group Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    height: '22px'
                  }}
                >
                  <Tag size={10} style={{ color: themeColor }} />
                  <span style={{ fontSize: '0.675rem', color: '#475569', fontWeight: 700 }}>Group:</span>
                  <span style={{ fontSize: '0.675rem', fontWeight: 800, color: '#0f172a' }}>{supplier.supplier_group}</span>
                </div>

                {/* Country Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    height: '22px'
                  }}
                >
                  <Globe size={10} style={{ color: themeColor }} />
                  <span style={{ fontSize: '0.675rem', color: '#475569', fontWeight: 700 }}>Country:</span>
                  <span style={{ fontSize: '0.675rem', fontWeight: 800, color: '#0f172a' }}>{supplier.country || 'Global Site'}</span>
                </div>

                {/* Price List Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    height: '22px'
                  }}
                >
                  <CreditCard size={10} style={{ color: themeColor }} />
                  <span style={{ fontSize: '0.675rem', color: '#475569', fontWeight: 700 }}>Price List:</span>
                  <span style={{ fontSize: '0.675rem', fontWeight: 800, color: '#0f172a' }}>{supplier.default_price_list || 'Standard Buying'}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={toggleTheme}
              className="so-btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                border: `1.5px solid ${themeColor}`,
                color: themeColor,
                backgroundColor: `${themeColor}05`,
                padding: '0.5rem 0.9rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '0.5rem'
              }}
              title={`Switch to ${isGreen ? 'Blue' : 'Green'} Theme`}
            >
              <Palette size={13} />
              {isGreen ? 'BLUE' : 'GREEN'}
            </button>
            <button
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              className="so-btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                border: '1.5px solid #e2e8f0',
                color: '#64748b',
                backgroundColor: '#fff',
                padding: '0.5rem 0.9rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '0.5rem'
              }}
              title="Sync Dashboard Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              REFRESH
            </button>
            <button
              onClick={() => navigate(`/generalledgerreport?party_type=Supplier&party=${name}`)}
              className="so-btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                border: '1.5px solid #e2e8f0',
                color: '#64748b',
                backgroundColor: '#fff',
                padding: '0.5rem 0.9rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '0.5rem'
              }}
              title="View General Ledger"
            >
              <FileText size={13} />
              GENERAL LEDGER
            </button>
            <button
              className="so-btn-primary"
              onClick={() => setShowEditModal(true)}
              style={{
                backgroundColor: themeColor,
                borderColor: themeColor,
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                borderRadius: '0.5rem'
              }}
            >
              <Edit2 size={15} /> Edit
            </button>
          </div>
        </div>

        {/* Intelligence Navigation Tabs */}
        <div style={{ padding: '1.5rem 2rem 1rem', position: 'relative', zIndex: 1 }}>
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl">
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
                className={`flex items-center gap-2.5 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-300 rounded-lg ${activeTab === tab.id
                  ? 'bg-white shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
                style={{ color: activeTab === tab.id ? themeColor : undefined }}
              >
                <tab.icon size={14} style={{ color: activeTab === tab.id ? themeColor : undefined }} strokeWidth={activeTab === tab.id ? 3 : 2} />
                {tab.id}
              </button>
            ))}
          </div>
        </div>

        {/* Content Shard */}
        <div style={{ padding: '0 2rem' }}>
          {activeTab === 'Dashboard' && dashboardData && (
            <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700 pb-20">
              {/* Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                <StatCard
                  label="Graph Connectivity"
                  value={Object.values(dashboardData.counts || {}).reduce((a, b) => a + b, 0)}
                  icon={Layers}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Legal Name</label>
                      <p className="text-sm font-black text-gray-900">{supplier.supplier_name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Industrial Cluster</label>
                      <p className="text-sm font-black text-gray-900">{supplier.supplier_group}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Structural Format</label>
                      <p className="text-sm font-black text-gray-900">{supplier.supplier_type}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Tax Identity (TRN)</label>
                      <p className="text-sm font-bold text-gray-900 font-mono tracking-tight bg-gray-50 px-3 py-1 rounded inline-block">
                        {supplier.tax_id || 'NOT REGISTERED'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Tax Category</label>
                      <p className="text-sm font-black text-gray-900">{supplier.tax_category || 'General'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Withholding Category</label>
                      <p className="text-sm font-black text-gray-900">{supplier.tax_withholding_category || 'None'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Payment Terms</label>
                      <p className="text-sm font-black text-gray-900">{supplier.payment_terms || 'Not Set'}</p>
                    </div>
                  </div>
                </InfoSection>

                <InfoSection title="Deal Information" icon={Tag} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                        Email Id
                        {!supplier.email_id && supplier.contact_details?.email_id && (
                          <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full lowercase">linked</span>
                        )}
                      </label>
                      <p className="text-sm font-black text-gray-900">{supplier.email_id || supplier.contact_details?.email_id || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                        Mobile No
                        {!supplier.mobile_no && supplier.contact_details?.mobile_no && (
                          <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full lowercase">linked</span>
                        )}
                      </label>
                      <p className="text-sm font-black text-gray-900">{supplier.mobile_no || supplier.contact_details?.mobile_no || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Linked Contact</label>
                      <p className="text-sm font-black text-gray-900 text-blue-600">
                        {supplier.contact_details?.name ? (
                          <span className="flex items-center gap-1.5">
                            {supplier.contact_details.first_name} {supplier.contact_details.last_name}
                            <span className="text-[9px] text-gray-400 font-medium">({supplier.contact_details.name})</span>
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Primary Address</label>
                      <div className="text-sm font-bold text-gray-900 leading-snug">
                         {supplier.address_details?.address_line1 || 'N/A'}<br/>
                         {supplier.address_details?.address_line2 && <>{supplier.address_details.address_line2}<br/></>}
                         {supplier.address_details?.city && (
                           <span className="text-[11px] text-gray-500">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Key</label>
                      <p className="text-xs font-black font-mono bg-blue-50/50 px-2 py-1 rounded" style={{ color: themeColor }}>{supplier.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Billing Currency</label>
                      <p className="text-sm font-black text-gray-900">{supplier.default_currency || 'AED'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Price List</label>
                      <p className="text-sm font-black text-gray-900">{supplier.default_price_list || 'Standard Buying'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Creation Vector</label>
                      <p className="text-[11px] font-bold text-gray-700">{new Date(supplier.creation).toLocaleDateString()}</p>
                    </div>
                  </div>
                </InfoSection>
              </div>

                <InfoSection title="Supplier Intelligence Bio" icon={FileText} themeColor={themeColor}>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed italic whitespace-pre-wrap">
                    {supplier.supplier_details || 'No detailed intelligence registered for this partner.'}
                  </p>
                </InfoSection>
              </div>
            )}

          {activeTab === 'Addresses' && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Geospatial Registry</h3>
                  <div className="flex-1 max-w-md mx-8 relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none"
                      placeholder="Search addresses..."
                      value={linkedSearch}
                      onChange={e => setLinkedSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Registry Vector</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Metrics</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedAddresses.filter(a => !linkedSearch || a.address_title?.toLowerCase().includes(linkedSearch.toLowerCase()) || a.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(addr => (
                        <tr key={addr.name} onClick={() => navigate(`/addresslist?name=${encodeURIComponent(addr.name)}`)} className="group hover:bg-slate-50 transition-all border-b border-slate-50 cursor-pointer">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-gray-50 rounded-xl"><MapPin size={18} className="text-gray-600" /></div>
                              <div>
                                <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{addr.address_title}</h6>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{addr.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1 bg-gray-50 rounded-lg text-[9px] font-black text-slate-700 uppercase tracking-widest">{addr.address_type}</div>
                              <div className="text-[10px] font-black text-slate-900">{addr.city}, {addr.country}</div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Access Stream</button>
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Personnel Registry</h3>
                  <div className="flex-1 max-w-md mx-8 relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none"
                      placeholder="Search contacts..."
                      value={linkedSearch}
                      onChange={e => setLinkedSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Personnel Identity</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Connectivity Meta</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedContacts.filter(c => !linkedSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(linkedSearch.toLowerCase()) || c.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(con => (
                        <tr key={con.name} onClick={() => navigate(`/contactlist?name=${encodeURIComponent(con.name)}`)} className="group hover:bg-slate-50 transition-all border-b border-slate-50 cursor-pointer">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-emerald-50 rounded-xl"><User size={18} className="text-emerald-600" /></div>
                              <div>
                                <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{con.first_name} {con.last_name}</h6>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{con.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                              <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{con.designation || 'Personnel'}</div>
                              <div className="flex items-center gap-3 opacity-60">
                                <Mail size={12} /> <span className="text-[9px] font-bold">{con.email_id}</span>
                                <Phone size={12} className="ml-2" /> <span className="text-[9px] font-bold">{con.mobile_no}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Access Stream</button>
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
               <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Branch Availability</h3>
                  </div>
                  <div className="p-8">
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(supplier?.branch_availability || []).length > 0 ? (
                           supplier.branch_availability.map((branch, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                 <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Building2 size={16} style={{ color: themeColor }} />
                                 </div>
                                 <div>
                                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{branch.warehouse}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Authorized Branch</p>
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-40">
                              <Building2 size={48} className="mb-4 text-gray-300" />
                              <p className="text-sm font-bold uppercase tracking-widest text-gray-600">No Branch Restrictions</p>
                              <p className="text-xs text-gray-400 mt-2">This supplier is available across all operational zones.</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <InfoSection title="Policy Controls" icon={ShieldCheck} themeColor={themeColor}>
                <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <div className="space-y-1">
                    <h5 className="text-base font-bold text-gray-900 uppercase tracking-tight">Lifecycle Permissions</h5>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Current operational authorization</p>
                  </div>
                  <div
                    className="flex items-center gap-3 px-4 py-2 rounded-lg border border-transparent"
                    style={{
                      backgroundColor: isActive ? `${themeColor}15` : '#fff1f2',
                      color: isActive ? themeColor : '#e11d48'
                    }}
                  >
                    <Activity size={16} className={isActive ? 'animate-pulse' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{isActive ? 'Authorized' : 'Restricted'}</span>
                  </div>
                </div>
              </InfoSection>

              <InfoSection title="Settings & Status" icon={ShieldCheck} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Transporter</span>
                      {supplier.is_transporter ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-gray-200" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Internal Supplier</span>
                      {supplier.is_internal_supplier ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-gray-200" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Frozen</span>
                      {supplier.is_frozen ? <Activity size={16} className="text-rose-500" /> : <Square size={16} className="text-gray-200" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">On Hold</span>
                      {supplier.on_hold ? <Activity size={16} className="text-rose-500 animate-pulse" /> : <Square size={16} className="text-gray-200" />}
                    </div>
                    {supplier.on_hold && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Hold Logic</p>
                        <p className="text-[11px] font-bold text-rose-600 italic">"{supplier.hold_type || 'Manual Hold'}"</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Disabled</span>
                      {supplier.disabled ? <X size={16} className="text-rose-500" /> : <CheckSquare size={16} className="text-emerald-500" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Bill without PO</span>
                      {supplier.allow_purchase_invoice_creation_without_purchase_order ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-gray-200" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Bill without Receipt</span>
                      {supplier.allow_purchase_invoice_creation_without_purchase_receipt ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-gray-200" />}
                    </div>
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