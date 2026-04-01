import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart,
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
  ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText,
  Search, Filter, Lock, Unlock, AlertTriangle, CheckSquare, Square, User
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { legacySubTheme, isGreen, themeColor, themeLight, toggleTheme } = useLegacyTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
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
          email_id: data.contact_details?.email_id || '',
          mobile_no: data.contact_details?.mobile_no || '',
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
          allow_purchase_invoice_creation_without_purchase_receipt: data.allow_purchase_invoice_creation_without_purchase_receipt || 0
        });
      }
      const dash = dashRes.data.message || dashRes.data;
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
        <div className="so-page-header" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate(-1)} className="so-btn-ghost" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ChevronLeft size={18} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>BACK</span>
            </button>
            <div>
              <h1 className="so-page-title">
                <Building2 size={20} /> {supplier.supplier_name}
              </h1>
              <p className="so-page-subtitle">Supplier Detail</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={toggleTheme}
              className="so-btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                border: `1.5px solid ${isGreen ? '#0ea5e9' : '#10b981'}`,
                color: isGreen ? '#0ea5e9' : '#10b981',
                padding: '0.4rem 0.8rem',
                fontSize: '0.7rem',
                fontWeight: 800
              }}
              title={`Switch to ${isGreen ? 'Blue' : 'Green'} Theme`}
            >
              <Palette size={13} />
              {isGreen ? 'BLUE' : 'GREEN'}
            </button>
            <button className="so-btn-primary" onClick={() => setShowEditModal(true)} style={{ backgroundColor: themeColor }}>
              <Edit2 size={16} /> Edit
            </button>
          </div>
        </div>

        {/* Executive Dashboard */}
        <div style={{ padding: '1.25rem 2rem 0', position: 'relative', zIndex: 1 }}>
          <div className="so-summary-bar">
            <div className="so-summary-item">
              <span className="so-summary-label">Supplier ID</span>
              <span className="so-summary-value grand">{supplier.name}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Operational Status</span>
              <span className="so-summary-value" style={{ color: isActive ? themeColor : '#ef4444' }}>
                {isActive ? 'Operational' : 'Restricted'}
              </span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Supplier Group</span>
              <span className="so-summary-value">{supplier.supplier_group}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Country</span>
              <span className="so-summary-value">{supplier.country || 'Global Site'}</span>
            </div>
          </div>
        </div>

        {/* Intelligence Navigation Tabs */}
        <div style={{ padding: '1.5rem 2rem 1rem', position: 'relative', zIndex: 1 }}>
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl">
            {[
              { id: 'Dashboard', icon: Layers },
              { id: 'General', icon: FileText },
              { id: 'Connectivity', icon: Globe },
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
                  label="Annualized Expenditure"
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Primary Contact Link</label>
                      <p className="text-sm font-black text-gray-900 text-blue-600">{supplier.supplier_primary_contact || 'N/A'}</p>
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

              {/* Bio / Details Section */}
              <InfoSection title="Supplier Intelligence Bio" icon={FileText} themeColor={themeColor}>
                    <p className="text-sm font-medium text-gray-700 leading-relaxed italic whitespace-pre-wrap">
                      {supplier.supplier_details || 'No detailed intelligence registered for this partner.'}
                    </p>
              </InfoSection>

              {/* Status & Governance Section */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden auto-cols-max">
                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} style={{ color: themeColor }} strokeWidth={2.5} />
                    <h5 className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Settings & Status</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Policy Sync: Active</span>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8">
                    {/* Column 1: Core Flags */}
                    <div className="space-y-6">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] pb-2 border-b border-gray-50">Core Entity Flags</p>
                      {[
                        { label: 'Is Transporter', val: supplier.is_transporter },
                        { label: 'Internal Supplier', val: supplier.is_internal_supplier },
                        { label: 'Is Frozen', val: supplier.is_frozen },
                        { label: 'Bill Without PO', val: supplier.allow_purchase_invoice_creation_without_purchase_order },
                        { label: 'Bill Without Receipt', val: supplier.allow_purchase_invoice_creation_without_purchase_receipt }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-600">{item.label}</span>
                          {item.val ? <CheckSquare size={16} style={{ color: themeColor }} /> : <Square size={16} className="text-gray-200" />}
                        </div>
                      ))}
                    </div>

                    {/* Column 2: Transaction Warnings */}
                    <div className="space-y-6">
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] pb-2 border-b border-gray-50">Transaction Warnings</p>
                      {[
                        { label: 'Warn on RFQs', val: supplier.warn_rfqs },
                        { label: 'Warn on POs', val: supplier.warn_pos }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-600">{item.label}</span>
                          {item.val ? <AlertTriangle size={16} className="text-amber-500" /> : <Square size={16} className="text-gray-200" />}
                        </div>
                      ))}
                    </div>

                    {/* Column 3: Prevention Protocols */}
                    <div className="space-y-6">
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] pb-2 border-b border-gray-50">Prevention Protocols</p>
                      {[
                        { label: 'Prevent RFQs', val: supplier.prevent_rfqs },
                        { label: 'Prevent POs', val: supplier.prevent_pos }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-600">{item.label}</span>
                          {item.val ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} className="text-gray-200" />}
                        </div>
                      ))}
                    </div>

                    {/* Column 4: Operational State */}
                    <div className="space-y-6">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] pb-2 border-b border-gray-50">Operational State</p>
                      <div className="p-4 bg-gray-50 rounded-xl space-y-4">
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Connectivity' && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Module-wise Horizontal Tabs (Sub-navigation) */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30 overflow-x-auto">
                  <div className="flex items-center gap-1">
                    {dashboardData?.connections && Object.keys(dashboardData.connections).map(module => (
                      <button
                        key={module}
                        onClick={() => setActiveModule(module)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeModule === module
                          ? 'bg-white shadow-sm ring-1 ring-gray-100 text-slate-800'
                          : 'text-gray-600 hover:text-gray-900'}`}
                        style={{ color: activeModule === module ? themeColor : undefined }}
                      >
                        {module}
                      </button>
                    ))}
                    <div className="w-[1px] h-6 bg-gray-200 mx-2" />
                    <button
                      onClick={() => setActiveModule('Addresses')}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeModule === 'Addresses'
                        ? 'bg-white shadow-sm ring-1 ring-gray-100 text-slate-800'
                        : 'text-gray-600 hover:text-gray-900'}`}
                      style={{ color: activeModule === 'Addresses' ? themeColor : undefined }}
                    >
                      Addresses ({linkedAddresses.length})
                    </button>
                    <button
                      onClick={() => setActiveModule('Contacts')}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeModule === 'Contacts'
                        ? 'bg-white shadow-sm ring-1 ring-gray-100 text-slate-800'
                        : 'text-gray-600 hover:text-gray-900'}`}
                      style={{ color: activeModule === 'Contacts' ? themeColor : undefined }}
                    >
                      Contacts ({linkedContacts.length})
                    </button>
                  </div>
                </div>

                {/* Report-style Action Bar */}
                <div className="px-8 py-4 bg-white border-b border-gray-50 flex flex-wrap items-center justify-between gap-6">
                  <div className="flex-1 min-w-[300px] relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-bold placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                      placeholder="Filter connected nodes by ID or title..."
                      value={linkedSearch}
                      onChange={e => setLinkedSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-1.5 gap-3">
                      <Calendar size={13} className="text-gray-600" />
                      <input type="date" className="bg-transparent border-none text-[10px] font-bold text-gray-600 outline-none" />
                      <span className="text-gray-500 text-xs">→</span>
                      <input type="date" className="bg-transparent border-none text-[10px] font-bold text-gray-600 outline-none" />
                    </div>
                    <button className="p-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
                      <Filter size={15} />
                    </button>
                  </div>
                </div>

                {/* Connection List (Report View) */}
                <div className="p-0 overflow-x-auto">
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Registry Vector</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100">Metrics</th>
                        <th className="px-8 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-100" style={{ width: '120px', textAlign: 'right' }}>Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeModule === 'Addresses' ? (
                        linkedAddresses.filter(a => !linkedSearch || a.address_title?.toLowerCase().includes(linkedSearch.toLowerCase()) || a.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(addr => (
                          <tr key={addr.name} onClick={() => navigate(`/addresslist?name=${encodeURIComponent(addr.name)}`)} className="group hover:bg-slate-50 transition-all border-b border-slate-50">
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
                              <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95">Access Stream</button>
                            </td>
                          </tr>
                        ))
                      ) : activeModule === 'Contacts' ? (
                        linkedContacts.filter(c => !linkedSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(linkedSearch.toLowerCase()) || c.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(con => (
                          <tr key={con.name} onClick={() => navigate(`/contactlist?name=${encodeURIComponent(con.name)}`)} className="group hover:bg-slate-50 transition-all border-b border-slate-50">
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
                              <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95">Access Stream</button>
                            </td>
                          </tr>
                        ))
                      ) : dashboardData?.connections?.[activeModule]?.map((conn, idx) => (
                        <tr key={idx} onClick={() => navigateDetail(conn.doctype, conn.name)} className="group hover:bg-slate-50 transition-all border-b border-slate-50">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-gray-50 rounded-xl">
                                <Building2 size={18} className="text-gray-400" />
                              </div>
                              <div>
                                <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Shard: {conn.name}</h6>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{conn.doctype}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-8">
                              <div>
                                <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Quantifiable</div>
                                <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Shards</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-4">
                              <button
                                onClick={() => navigateDoc(conn.doctype)}
                                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                              >
                                Access Stream
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!dashboardData?.connections?.[activeModule] || dashboardData.connections[activeModule].length === 0) && (
                    <div className="py-24 flex flex-col items-center justify-center opacity-40">
                      <div className="p-6 bg-gray-50 rounded-3xl mb-4">
                        <Layers size={48} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-black text-gray-900 tracking-tighter uppercase mb-2">No Shards Initialized</h3>
                      <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.2em]">Transaction array is currently empty for this sector.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Auxiliary Connectivity Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <InfoSection title="Direct Global Channels" icon={Globe} themeColor={themeColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="p-3 bg-white w-fit rounded-xl shadow-sm"><Mail size={20} className="text-blue-500" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Email Protocol</p>
                        <p className="text-[13px] font-black text-gray-800 break-all">{supplier.contact_details?.email_id || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="p-3 bg-white w-fit rounded-xl shadow-sm"><Phone size={20} className="text-emerald-500" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Secure Voice</p>
                        <p className="text-[13px] font-black text-gray-800">{supplier.contact_details?.mobile_no || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </InfoSection>

                <InfoSection title="Geospatial Architecture" icon={MapPin} themeColor={themeColor}>
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4 relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10 -mr-6 -mb-6"><MapPin size={120} /></div>
                      <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Primary Registry Address</p>
                      <p className="text-sm font-black italic opacity-90 leading-relaxed max-w-[80%]">"{supplier.address || supplier.address_details?.address_line1 || 'No Global Site Registered'}"</p>
                      <div className="flex gap-2 pt-2">
                        <span className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest">{supplier.address_details?.city || 'REGIONAL'}</span>
                        <span className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest">{supplier.country}</span>
                      </div>
                    </div>
                  </div>
                </InfoSection>
              </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="max-w-2xl">
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
      />
    </>
  );
};




export default SupplierDetails;