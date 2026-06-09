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
import './SupplierDetails.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import SupplierFormModal from './SupplierFormModal';
import { Palette } from 'lucide-react';
import { ChevronDown } from "lucide-react";

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, themeColor, isGreen }) => (
  <div
    className="stat-card-modern"
    style={{ borderLeft: `4px solid ${themeColor}` }}
  >
    <div className="space-y-1">
      <p className="stat-card-label">{label}</p>
      <div className="stat-card-value-group">
        {currency && <span className="stat-card-currency">{currency}</span>}
        <h4 className="stat-card-value">
          {value}
        </h4>
      </div>
    </div>
    <div className="stat-card-icon-container" style={{ color: themeColor }}>
      <Icon size={22} strokeWidth={2.5} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName, icon: Icon, themeColor }) => (
  <div className="connection-module-card">
    <div className="connection-card-header">
      <div className="connection-card-title-group">
        <Icon size={16} style={{ color: themeColor }} strokeWidth={2.5} />
        <h5 className="connection-card-title">{title}</h5>
      </div>
    </div>
    <div className="connection-links-list">
      {links.map((link, idx) => (
        <div
          key={idx}
          onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
          className="connection-link-item"
        >
          <span className="connection-link-name">{link.doctype}</span>
          <div className="connection-link-right">
            <span className="connection-count-badge">{link.count}</span>
            <ArrowRight size={12} className="connection-arrow-icon" style={{ color: themeColor }} />
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
);

const InfoSection = ({ title, children, icon: Icon, themeColor }) => (
  <div className="info-panel-card">
    <div className="info-panel-header">
      <Icon size={18} style={{ color: themeColor }} strokeWidth={2.5} />
      <h5 className="info-panel-title">{title}</h5>
    </div>
    <div className="info-panel-body">
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
  const [isEditing, setIsEditing] = useState(false);

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

  const isNew = name === 'new' || window.location.pathname.includes('/supplier-details/new') || window.location.hash.includes('/supplier-details/new');

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [name, isNew]);

  const fetchData = async () => {
    if (!name || isNew) return;
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
      setIsEditing(false);
      fetchData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Authorization Refused', text: err.message, borderRadius: '2rem', confirmButtonColor: themeColor });
    } finally {
      setSaving(false);
    }
  };

  if (isNew || isEditing) {
    return (
      <SupplierFormModal
        isOpen={true}
        inline={true}
        editingSupplier={isEditing ? supplier : null}
        onClose={() => {
          if (isEditing) {
            setIsEditing(false);
          } else {
            navigate('/supplierlist');
          }
        }}
        onSave={(savedSup) => {
          if (isEditing) {
            setIsEditing(false);
            fetchData();
          } else {
            navigate(`/supplier-details/${encodeURIComponent(savedSup.name || savedSup.supplier_name)}`);
          }
        }}
        userWarehouse={warehouse}
      />
    );
  }

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
      <div className="supplier-page-container">

        {/* Profile Header Overlay Card */}
        <div className="profile-header-container">
          {/* Header row with buttons */}
          <div className="header-actions-row">
            <div className="left-controls-group" />
            <div className="right-controls-group">
              <button
                onClick={toggleTheme}
                className="btn-modern-secondary"
                style={{ borderColor: themeColor, color: themeColor }}
                title={`Switch to ${isGreen ? 'Blue' : 'Green'} Theme`}
              >
                <Palette size={14} />
                <span style={{ fontSize: '0.75rem' }}>{isGreen ? 'BLUE' : 'GREEN'}</span>
              </button>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchData();
                }}
                className="btn-modern-secondary"
                title="Sync Dashboard Data"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span style={{ fontSize: '0.75rem' }}>REFRESH</span>
              </button>
              <button
                onClick={() => navigate(`/generalledgerreport?party_type=Supplier&party=${name}`)}
                className="btn-modern-secondary"
                title="View General Ledger"
              >
                <FileText size={14} />
                <span style={{ fontSize: '0.75rem' }}>GENERAL LEDGER</span>
              </button>
              <button
                className="btn-modern-primary"
                onClick={() => setIsEditing(true)}
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
              >
                <Edit2 size={14} />
                <span style={{ fontSize: '0.75rem' }}>EDIT</span>
              </button>
            </div>
          </div>

          {/* Supplier Name and Avatar Block */}
          <div className="profile-header-content">
            <div className="supplier-avatar-container" style={{ borderLeft: `5px solid ${themeColor}` }}>
              {supplier.supplier_name ? supplier.supplier_name.charAt(0).toUpperCase() : 'S'}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {supplier.supplier_name}
              </h1>

              {/* Dynamic Metadata Row */}
              <div className="meta-badges-flex">
                <div className="badge-pill-modern" style={{ borderColor: isActive ? '#bbf7d0' : '#fecaca', backgroundColor: isActive ? '#f0fdf4' : '#fdf2f2' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} style={{ width: '6px', height: '6px', borderRadius: '50%' }} />
                  <span style={{ color: isActive ? '#15803d' : '#b91c1c', fontWeight: 700, fontSize: '0.75rem' }}>
                    {isActive ? 'Operational' : 'Restricted'}
                  </span>
                </div>

                <div className="badge-pill-modern">
                  <Tag size={12} style={{ color: themeColor }} />
                  <span className="badge-label-muted">Group:</span>
                  <span className="badge-value-dark">{supplier.supplier_group}</span>
                </div>

                <div className="badge-pill-modern">
                  <Globe size={12} style={{ color: themeColor }} />
                  <span className="badge-label-muted">Country:</span>
                  <span className="badge-value-dark">{supplier.country || 'Global Site'}</span>
                </div>

                <div className="badge-pill-modern">
                  <CreditCard size={12} style={{ color: themeColor }} />
                  <span className="badge-label-muted">Price List:</span>
                  <span className="badge-value-dark">{supplier.default_price_list || 'Standard Buying'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Navigation Tabs Container */}
        <div className="tabs-navigation-panel">
          <div className="tabs-navigation-container">
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
                className={`nav-tab-btn-modern ${activeTab === tab.id ? 'tab-active' : ''}`}
                style={activeTab === tab.id ? { color: themeColor } : undefined}
              >
                <tab.icon size={15} style={activeTab === tab.id ? { color: themeColor } : undefined} strokeWidth={2.5} />
                {tab.id}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="supplier-content-layout">
          {activeTab === 'Dashboard' && dashboardData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Highlights Grid - WITH GRAPH CONNECTIVITY REMOVED */}
              <div className="dashboard-highlights-grid">
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
              <div className="connection-modules-grid">
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <InfoSection title="General Information" icon={Hash} themeColor={themeColor}>
                  <div className="info-fields-grid">
                    <div className="info-field-box">
                      <span className="info-field-label">Legal Name</span>
                      <span className="info-field-value">{supplier.supplier_name}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Industrial Cluster</span>
                      <span className="info-field-value">{supplier.supplier_group}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Structural Format</span>
                      <span className="info-field-value">{supplier.supplier_type}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Tax Identity (TRN)</span>
                      <div>
                        <span className="info-field-value-mono">{supplier.tax_id || 'NOT REGISTERED'}</span>
                      </div>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Tax Category</span>
                      <span className="info-field-value">{supplier.tax_category || 'General'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Withholding Category</span>
                      <span className="info-field-value">{supplier.tax_withholding_category || 'None'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Payment Terms</span>
                      <span className="info-field-value">{supplier.payment_terms || 'Not Set'}</span>
                    </div>
                  </div>
                </InfoSection>

                <InfoSection title="Deal Information" icon={Tag} themeColor={themeColor}>
                  <div className="info-fields-grid">
                    <div className="info-field-box">
                      <span className="info-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Email Id
                        {!supplier.email_id && supplier.contact_details?.email_id && (
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '9999px', fontWeight: 700 }}>linked</span>
                        )}
                      </span>
                      <span className="info-field-value">{supplier.email_id || supplier.contact_details?.email_id || 'N/A'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Mobile No
                        {!supplier.mobile_no && supplier.contact_details?.mobile_no && (
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '9999px', fontWeight: 700 }}>linked</span>
                        )}
                      </span>
                      <span className="info-field-value">{supplier.mobile_no || supplier.contact_details?.mobile_no || 'N/A'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Linked Contact</span>
                      <span className="info-field-value" style={{ color: themeColor }}>
                        {supplier.contact_details?.name ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {supplier.contact_details.first_name} {supplier.contact_details.last_name}
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>({supplier.contact_details.name})</span>
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Primary Address</span>
                      <div className="info-field-value" style={{ lineHeight: '1.4', fontWeight: 600 }}>
                        {supplier.address_details?.address_line1 || 'N/A'}<br />
                        {supplier.address_details?.address_line2 && <>{supplier.address_details.address_line2}<br /></>}
                        {supplier.address_details?.city && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
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
                  <div className="info-fields-grid">
                    <div className="info-field-box">
                      <span className="info-field-label">System Key</span>
                      <div>
                        <span className="info-field-value-mono" style={{ color: themeColor, background: `${themeColor}10` }}>{supplier.name}</span>
                      </div>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Billing Currency</span>
                      <span className="info-field-value">{supplier.default_currency || 'AED'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Price List</span>
                      <span className="info-field-value">{supplier.default_price_list || 'Standard Buying'}</span>
                    </div>
                    <div className="info-field-box">
                      <span className="info-field-label">Creation Vector</span>
                      <span className="info-field-value">{new Date(supplier.creation).toLocaleDateString()}</span>
                    </div>
                  </div>
                </InfoSection>
              </div>

              <InfoSection title="Supplier Intelligence Bio" icon={FileText} themeColor={themeColor}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: '#334155', lineHeight: '1.6', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                  {supplier.supplier_details || 'No detailed intelligence registered for this partner.'}
                </p>
              </InfoSection>
            </div>
          )}

          {activeTab === 'Addresses' && (
            <div className="modern-table-card animate-in fade-in duration-500">
              <div className="modern-table-header">
                <h3 className="table-header-title">Geospatial Registry</h3>
                <div className="search-input-wrapper">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder="Search addresses..."
                    value={linkedSearch}
                    onChange={e => setLinkedSearch(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="modern-styled-table">
                  <thead>
                    <tr>
                      <th>Registry Vector</th>
                      <th>Metrics</th>
                      <th style={{ textAlign: 'right' }}>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedAddresses.filter(a => !linkedSearch || a.address_title?.toLowerCase().includes(linkedSearch.toLowerCase()) || a.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(addr => (
                      <tr key={addr.name} onClick={() => navigate(`/addresslist?name=${encodeURIComponent(addr.name)}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="row-avatar-box">
                              <MapPin size={18} style={{ color: themeColor }} />
                            </div>
                            <div>
                              <div className="row-title-bold">{addr.address_title}</div>
                              <div className="row-subtitle-muted">{addr.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px' }}>
                              {addr.address_type}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{addr.city}, {addr.country}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn-modern-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>Access Stream</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Contacts' && (
            <div className="modern-table-card animate-in fade-in duration-500">
              <div className="modern-table-header">
                <h3 className="table-header-title">Personnel Registry</h3>
                <div className="search-input-wrapper">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder="Search contacts..."
                    value={linkedSearch}
                    onChange={e => setLinkedSearch(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="modern-styled-table">
                  <thead>
                    <tr>
                      <th>Personnel Identity</th>
                      <th>Connectivity Meta</th>
                      <th style={{ textAlign: 'right' }}>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedContacts.filter(c => !linkedSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(linkedSearch.toLowerCase()) || c.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(con => (
                      <tr key={con.name} onClick={() => navigate(`/contactlist?name=${encodeURIComponent(con.name)}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="row-avatar-box" style={{ backgroundColor: `${themeColor}10` }}>
                              <User size={18} style={{ color: themeColor }} />
                            </div>
                            <div>
                              <div className="row-title-bold">{con.first_name} {con.last_name}</div>
                              <div className="row-subtitle-muted">{con.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{con.designation || 'Personnel'}</div>
                            <div className="contact-meta-row">
                              <span className="contact-meta-item">
                                <Mail size={12} /> {con.email_id}
                              </span>
                              <span className="contact-meta-item">
                                <Phone size={12} /> {con.mobile_no}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn-modern-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>Access Stream</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Branches' && (
            <div className="modern-table-card animate-in fade-in duration-500" style={{ padding: '2rem' }}>
              <h3 className="table-header-title" style={{ marginBottom: '1.5rem' }}>Branch Availability</h3>
              <div className="branches-cards-grid">
                {(supplier?.branch_availability || []).length > 0 ? (
                  supplier.branch_availability.map((branch, idx) => (
                    <div key={idx} className="branch-card-modern">
                      <div className="branch-icon-box">
                        <Building2 size={18} style={{ color: themeColor }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{branch.warehouse}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authorized Branch</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <Building2 size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.95rem' }}>No Branch Restrictions</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>This supplier is available across all operational zones.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <InfoSection title="Policy Controls" icon={ShieldCheck} themeColor={themeColor}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Lifecycle Permissions</h5>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Current operational authorization</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: isActive ? `${themeColor}15` : '#fff1f2',
                      color: isActive ? themeColor : '#e11d48',
                      fontWeight: 800,
                      fontSize: '0.75rem'
                    }}
                  >
                    <Activity size={14} className={isActive ? 'animate-pulse' : ''} />
                    <span>{isActive ? 'AUTHORIZED' : 'RESTRICTED'}</span>
                  </div>
                </div>
              </InfoSection>

              <InfoSection title="Settings & Status" icon={ShieldCheck} themeColor={themeColor}>
                <div className="settings-grid-panel">
                  {[
                    { label: 'Transporter', value: supplier.is_transporter },
                    { label: 'Internal Supplier', value: supplier.is_internal_supplier },
                    { label: 'Frozen', value: supplier.is_frozen, critical: true },
                    { label: 'On Hold', value: supplier.on_hold, critical: true },
                    { label: 'Disabled', value: supplier.disabled, critical: true, inverted: true },
                    { label: 'Bill without PO', value: supplier.allow_purchase_invoice_creation_without_purchase_order },
                    { label: 'Bill without Receipt', value: supplier.allow_purchase_invoice_creation_without_purchase_receipt }
                  ].map((setting, idx) => {
                    const isChecked = setting.inverted ? !setting.value : setting.value;
                    return (
                      <div key={idx} className="settings-card-toggle">
                        <span className="toggle-label-bold">{setting.label}</span>
                        <div className={`checkbox-visual-box ${isChecked ? 'checked-active' : ''}`} style={isChecked ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}>
                          {isChecked && <ShieldCheck size={12} />}
                        </div>
                      </div>
                    );
                  })}

                  {supplier.on_hold && (
                    <div style={{ gridColumn: '1 / -1', padding: '1rem', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '12px', marginTop: '0.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hold Logic</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', fontWeight: 600, color: '#be123c', fontStyle: 'italic' }}>"{supplier.hold_type || 'Manual Hold'}"</p>
                    </div>
                  )}
                </div>
              </InfoSection>
            </div>
          )}
        </div>
      </div>


    </>
  );
};




export default SupplierDetails;