import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
    AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart,
    ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
    ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText,
    Search, Filter, Lock, Unlock, AlertTriangle, CheckSquare, Square, User, Menu, Plus
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
        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group h-full"
    >
        <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{label}</p>
            <div className="flex items-baseline gap-1.5 pt-0.5">
                {currency && <span className="text-[10px] font-bold text-gray-400 uppercase">{currency}</span>}
                <h4 className="text-xl font-black text-gray-900 tracking-tight leading-none">
                    {value}
                </h4>
            </div>
        </div>
        <div className="p-2.5 rounded-xl bg-gray-50 group-hover:bg-opacity-10 transition-colors" style={{ backgroundColor: isGreen ? '#f0fdf4' : '#f0f9ff' }}>
            <Icon size={18} className="text-gray-500 group-hover:opacity-100" style={{ color: themeColor }} strokeWidth={2.5} />
        </div>
    </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName, icon: Icon, themeColor }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-all duration-300">
        <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Icon size={14} style={{ color: themeColor }} strokeWidth={2.5} />
                <h5 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{title}</h5>
            </div>
        </div>
        <div className="p-2 flex-1">
            <div className="space-y-1">
                {links.map((link, idx) => (
                    <div
                        key={idx}
                        onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
                        className="flex items-center justify-between p-2.5 px-4 rounded-lg hover:bg-gray-50 transition-all cursor-pointer group"
                    >
                        <span className="text-[11px] font-bold text-gray-700 transition-colors">{link.doctype}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{link.count}</span>
                            <ArrowRight size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 transition-transform" />
                        </div>
                    </div>
                ))}
                {links.length === 0 && (
                    <div className="py-8 flex flex-col items-center justify-center text-center opacity-40">
                        <Layers size={24} className="mb-2 text-gray-300" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Registry Empty</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const InfoSection = ({ title, children, icon: Icon, themeColor, className = "" }) => (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 h-full ${className}`}>
        <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
            <Icon size={15} style={{ color: themeColor }} strokeWidth={2.5} />
            <h5 className="text-[10px] font-black text-gray-700 uppercase tracking-widest leading-none">{title}</h5>
        </div>
        <div className="p-6 flex-1">
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
    const [activeTab, setActiveTab] = useState('General');
    const [showEditModal, setShowEditModal] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

                {/* Compact Page Header */}
                <div className="so-page-header sticky top-0" style={{ zIndex: 100, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 1.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-50 transition-all active:scale-90 border border-slate-200 shadow-sm group"
                                style={{ borderColor: `${themeColor}20` }}
                            >
                                <Menu size={18} strokeWidth={2.5} style={{ color: themeColor }} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <div className="flex flex-col">
                                <h1 className="so-page-title leading-none" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {supplier.supplier_name.toUpperCase()}
                                    {activeTab && <span className="opacity-10 mx-0.5">/</span>}
                                    <span style={{ color: themeColor, fontSize: '0.9rem', fontWeight: 900 }}>{activeTab.toUpperCase()}</span>
                                </h1>
                                <p className="so-page-subtitle mt-1" style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>SYSTEM PARTNER REGISTRY</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={toggleTheme}
                            className="so-btn-secondary"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                border: `1.5px solid ${isGreen ? '#0ea5e940' : '#10b98140'}`,
                                color: isGreen ? '#0ea5e9' : '#10b981',
                                padding: '0.4rem 0.9rem',
                                fontSize: '0.68rem',
                                fontWeight: 900,
                                borderRadius: '0.75rem'
                            }}
                        >
                            <Palette size={12} strokeWidth={2.5} />
                            {isGreen ? 'BLUE' : 'GREEN'}
                        </button>
                        <div style={{ width: '1.5px', height: '1.25rem', backgroundColor: '#f1f5f9', margin: '0 0.25rem' }} />
                        <button className="so-btn-primary" onClick={() => setShowEditModal(true)} style={{ backgroundColor: themeColor, padding: '0.4rem 1.1rem', fontSize: '0.72rem', borderRadius: '0.75rem' }}>
                            <Edit2 size={13} strokeWidth={2.5} /> EDIT
                        </button>
                    </div>
                </div>

                {/* Navigation Dropdown Menu (Clean Minimal Box Style) */}
                {isDrawerOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[2000] bg-transparent"
                            onClick={() => setIsDrawerOpen(false)}
                        />
                        <div
                            className="absolute left-6 top-[3.8rem] w-[210px] z-[2001] bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                        >
                            <div className="flex flex-col">
                                {[
                                    { id: 'General', label: 'General' },
                                    { id: 'Dashboard', label: 'Dashboard' },
                                    { id: 'Connectivity', label: 'Connectivity' },
                                    { id: 'Settings', label: 'Settings' }
                                ].map((tab, idx) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsDrawerOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 flex items-center justify-between transition-all group ${idx !== 0 ? 'border-t border-slate-50' : ''} ${activeTab === tab.id ? 'bg-slate-50/80 border-l-[3.5px]' : 'hover:bg-slate-50/50 border-l-[3.5px] border-l-transparent'}`}
                                        style={{ borderLeftColor: activeTab === tab.id ? themeColor : undefined }}
                                    >
                                        <span className={`text-[10.5px] font-[900] tracking-[0.16em] uppercase transition-colors ${activeTab === tab.id ? 'text-black' : 'text-slate-900/60 group-hover:text-black'}`}
                                        >
                                            {tab.label}
                                        </span>
                                        {activeTab === tab.id && (
                                            <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.1)] transition-transform scale-110" style={{ backgroundColor: themeColor }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Compact Summary Bar */}
                <div style={{ padding: '0.75rem 1.5rem 0', position: 'relative', zIndex: 1 }}>
                    <div className="so-summary-bar" style={{ marginBottom: '1rem', padding: '0.65rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="so-summary-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="so-summary-label" style={{ fontSize: '0.6rem', opacity: 0.6 }}>Supplier ID</span>
                            <span className="so-summary-value grand" style={{ fontSize: '0.9rem', letterSpacing: '-0.02em' }}>{supplier.name}</span>
                        </div>
                        <div className="so-summary-divider" style={{ height: '1.5rem', margin: '0 1rem' }} />
                        <div className="so-summary-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="so-summary-label" style={{ fontSize: '0.6rem', opacity: 0.6 }}>Operational Status</span>
                            <span className="so-summary-value" style={{ fontSize: '0.9rem', color: isActive ? themeColor : '#ef4444' }}>
                                {isActive ? 'OPERATIONAL' : 'RESTRICTED'}
                            </span>
                        </div>
                        <div className="so-summary-divider" style={{ height: '1.5rem', margin: '0 1rem' }} />
                        <div className="so-summary-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="so-summary-label" style={{ fontSize: '0.6rem', opacity: 0.6 }}>Supplier Group</span>
                            <span className="so-summary-value" style={{ fontSize: '0.9rem' }}>{supplier.supplier_group}</span>
                        </div>
                        <div className="so-summary-divider" style={{ height: '1.5rem', margin: '0 1rem' }} />
                        <div className="so-summary-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="so-summary-label" style={{ fontSize: '0.6rem', opacity: 0.6 }}>Country</span>
                            <span className="so-summary-value" style={{ fontSize: '0.9rem' }}>{supplier.country || 'Global Site'}</span>
                        </div>
                    </div>
                </div>



                {/* Content Shard */}
                <div style={{ padding: '0 1.5rem' }}>
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
                        <div className="space-y-4 pb-12 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                                <InfoSection title="General Information" icon={Hash} themeColor={themeColor}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Legal Name</label>
                                            <p className="text-[14px] font-bold text-gray-900 border-l-[3px] pl-3" style={{ borderColor: themeColor }}>{supplier.supplier_name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Industrial Cluster</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.supplier_group}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Structural Format</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.supplier_type}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tax Identity (TRN)</label>
                                            <p className="text-[12px] font-black text-gray-900 font-mono tracking-tight bg-gray-50 px-2.5 py-1 rounded inline-block border border-gray-100">
                                                {supplier.tax_id || 'NOT REGISTERED'}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tax Category</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.tax_category || 'General Procurement'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Withholding Category</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.tax_withholding_category || 'None'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Payment Terms</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.payment_terms || 'Immediate'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Contact Link</label>
                                            <p className="text-[14px] font-bold text-blue-600">{supplier.supplier_primary_contact || 'N/A'}</p>
                                        </div>
                                    </div>
                                </InfoSection>

                                <InfoSection title="Supplier Registry" icon={Calendar} themeColor={themeColor}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Key</label>
                                            <p className="text-[11px] font-bold font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded inline-block border border-slate-100">{supplier.name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Billing Currency</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.default_currency || 'AED'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Price List</label>
                                            <p className="text-[14px] font-bold text-gray-900">{supplier.default_price_list || 'Standard Buying'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Creation Vector</label>
                                            <p className="text-[13px] font-bold text-gray-600">{new Date(supplier.creation).toLocaleDateString()}</p>
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
                                <div className="p-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-16 gap-y-10">
                                        {/* Column 1: Core Flags */}
                                        <div className="space-y-5">
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] pb-3 border-b border-gray-100 mb-2">Core Entity Flags</p>
                                            {[
                                                { label: 'Is Transporter', val: supplier.is_transporter },
                                                { label: 'Internal Supplier', val: supplier.is_internal_supplier },
                                                { label: 'Is Frozen', val: supplier.is_frozen },
                                                { label: 'Bill Without PO', val: supplier.allow_purchase_invoice_creation_without_purchase_order },
                                                { label: 'Bill Without Receipt', val: supplier.allow_purchase_invoice_creation_without_purchase_receipt }
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center justify-between group/flag">
                                                    <span className="text-[11px] font-bold text-gray-500 group-hover/flag:text-gray-900 transition-colors">{item.label}</span>
                                                    {item.val ? <CheckSquare size={16} style={{ color: themeColor }} /> : <Square size={16} className="text-gray-200" />}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Column 2: Transaction Warnings */}
                                        <div className="space-y-5">
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.25em] pb-3 border-b border-gray-100 mb-2">Transaction Warnings</p>
                                            {[
                                                { label: 'Warn on RFQs', val: supplier.warn_rfqs },
                                                { label: 'Warn on POs', val: supplier.warn_pos }
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center justify-between group/flag">
                                                    <span className="text-[11px] font-bold text-gray-500 group-hover/flag:text-gray-900 transition-colors">{item.label}</span>
                                                    {item.val ? <AlertTriangle size={16} className="text-amber-500" /> : <Square size={16} className="text-gray-200" />}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Column 3: Prevention Protocols */}
                                        <div className="space-y-5">
                                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.25em] pb-3 border-b border-gray-100 mb-2">Prevention Protocols</p>
                                            {[
                                                { label: 'Prevent RFQs', val: supplier.prevent_rfqs },
                                                { label: 'Prevent POs', val: supplier.prevent_pos }
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center justify-between group/flag">
                                                    <span className="text-[11px] font-bold text-gray-500 group-hover/flag:text-gray-900 transition-colors">{item.label}</span>
                                                    {item.val ? <Lock size={16} className="text-rose-500 transition-transform group-hover/flag:scale-110" /> : <Unlock size={16} className="text-gray-200" />}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Column 4: Operational State */}
                                        <div className="space-y-5">
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] pb-3 border-b border-gray-100 mb-2">Operational State</p>
                                            <div className="p-5 bg-gray-50/50 rounded-2xl space-y-5 border border-gray-100/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-bold text-gray-700">On Hold</span>
                                                    {supplier.on_hold ? <Activity size={18} className="text-rose-500 animate-pulse" /> : <Square size={18} className="text-gray-200" />}
                                                </div>
                                                {supplier.on_hold && (
                                                    <div className="pt-3 border-t border-gray-200">
                                                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Hold Logic</p>
                                                        <p className="text-[11px] font-bold text-rose-600 italic">"{supplier.hold_type || 'Manual Hold'}"</p>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-[12px] font-bold text-gray-700">Disabled</span>
                                                    {supplier.disabled ? <X size={18} className="text-rose-500" /> : <CheckSquare size={18} className="text-emerald-500" />}
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
                                {/* Simplified Sub-navigation */}
                                <div className="px-6 py-1 border-b border-gray-100 bg-white flex items-center gap-4 overflow-x-auto">
                                    {dashboardData?.connections && Object.keys(dashboardData.connections).map(module => (
                                        <button
                                            key={module}
                                            onClick={() => setActiveModule(module)}
                                            className={`py-2 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${activeModule === module
                                                ? 'text-slate-900'
                                                : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                                            style={{ borderBottomColor: activeModule === module ? themeColor : 'transparent' }}
                                        >
                                            {module}
                                        </button>
                                    ))}
                                    <div className="w-[1.5px] h-3 bg-gray-100 mx-1" />
                                    <button
                                        onClick={() => setActiveModule('Addresses')}
                                        className={`py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all border-b-2 ${activeModule === 'Addresses'
                                            ? 'text-slate-900'
                                            : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                                        style={{ borderBottomColor: activeModule === 'Addresses' ? themeColor : 'transparent' }}
                                    >
                                        ADDRESSES ({linkedAddresses.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveModule('Contacts')}
                                        className={`py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all border-b-2 ${activeModule === 'Contacts'
                                            ? 'text-slate-900'
                                            : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                                        style={{ borderBottomColor: activeModule === 'Contacts' ? themeColor : 'transparent' }}
                                    >
                                        CONTACTS ({linkedContacts.length})
                                    </button>
                                </div>

                                {/* Clean Filter Bar */}
                                <div className="px-6 py-2 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex-1 min-w-[200px] relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-4 py-1.5 bg-gray-50/50 border border-transparent rounded-lg text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:border-gray-200 transition-all outline-none"
                                            placeholder="Search connected records..."
                                            value={linkedSearch}
                                            onChange={e => setLinkedSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-gray-50/50 rounded-lg px-2.5 py-1.5 gap-2 text-gray-500">
                                            <Calendar size={11} />
                                            <input type="date" className="bg-transparent border-none text-[10px] font-bold outline-none" />
                                            <span className="opacity-30">→</span>
                                            <input type="date" className="bg-transparent border-none text-[10px] font-bold outline-none" />
                                        </div>
                                        <button className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:text-gray-600 transition-all">
                                            <Filter size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Simple Compact Table */}
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50/40">
                                                <th className="px-6 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest text-left">Record Detail</th>
                                                <th className="px-6 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest text-left">Classification</th>
                                                <th className="px-6 py-2" style={{ width: '80px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 bg-white">
                                            {activeModule === 'Addresses' ? (
                                                linkedAddresses.filter(a => !linkedSearch || a.address_title?.toLowerCase().includes(linkedSearch.toLowerCase()) || a.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(addr => (
                                                    <tr key={addr.name} onClick={() => navigate(`/addresslist?name=${encodeURIComponent(addr.name)}`)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-slate-900 transition-all border border-transparent group-hover:border-slate-100">
                                                                    <MapPin size={14} />
                                                                </div>
                                                                <div>
                                                                    <h6 className="text-[13px] font-bold text-slate-800 leading-none">{addr.address_title}</h6>
                                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{addr.name}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded-md text-[10px] font-bold uppercase tracking-wider">{addr.address_type}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="text-[10px] font-black text-slate-300 group-hover:text-slate-900 uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto">
                                                                View <ArrowRight size={10} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : activeModule === 'Contacts' ? (
                                                linkedContacts.filter(c => !linkedSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(linkedSearch.toLowerCase()) || c.name?.toLowerCase().includes(linkedSearch.toLowerCase())).map(con => (
                                                    <tr key={con.name} onClick={() => navigate(`/contactlist?name=${encodeURIComponent(con.name)}`)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-50/50 flex items-center justify-center text-emerald-600/50 group-hover:bg-white group-hover:text-emerald-600 transition-all border border-transparent group-hover:border-emerald-100">
                                                                    <User size={14} />
                                                                </div>
                                                                <div>
                                                                    <h6 className="text-[13px] font-bold text-slate-800 leading-none">{con.first_name} {con.last_name}</h6>
                                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{con.name}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-[11px] font-bold text-slate-700">{con.designation || 'Personnel'}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="text-[10px] font-black text-slate-300 group-hover:text-slate-900 uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto">
                                                                View <ArrowRight size={10} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (dashboardData?.connections?.[activeModule] || []).map((conn, idx) => (
                                                <tr key={idx} onClick={() => navigateDetail(conn.doctype, conn.name)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-slate-900 transition-all border border-transparent group-hover:border-slate-100">
                                                                <Building2 size={14} />
                                                            </div>
                                                            <h6 className="text-[13px] font-bold text-slate-800 leading-none">{conn.name}</h6>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-0.5 bg-blue-50/30 text-blue-600 border border-blue-100/50 rounded-md text-[10px] font-bold uppercase tracking-wider">{conn.doctype}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-[10px] font-black text-slate-300 group-hover:text-slate-900 uppercase tracking-widest transition-colors flex items-center gap-2 ml-auto">
                                                            Open <ArrowRight size={10} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!linkedAddresses.length && !linkedContacts.length && !(dashboardData?.connections?.[activeModule] || []).length) && (
                                                <tr>
                                                    <td colSpan="3" className="py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <Layers size={32} className="text-gray-300 mb-2" />
                                                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">No Shards Initialized</h3>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Empty Sector Registry</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Auxiliary Connectivity Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <InfoSection title="Global Channels" icon={Globe} themeColor={themeColor}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-2.5 bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all flex items-center gap-3">
                                            <div className="p-1.5 bg-white rounded shadow-sm text-blue-500"><Mail size={14} /></div>
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">Email</p>
                                                <p className="text-[11px] font-bold text-gray-800 break-all">{supplier.contact_details?.email_id || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all flex items-center gap-3">
                                            <div className="p-1.5 bg-white rounded shadow-sm text-emerald-500"><Phone size={14} /></div>
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">Phone</p>
                                                <p className="text-[11px] font-bold text-gray-800">{supplier.contact_details?.mobile_no || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </InfoSection>

                                <InfoSection title="Geographic Office" icon={MapPin} themeColor={themeColor}>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-gray-100 relative overflow-hidden">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Primary Address</p>
                                        <p className="text-[12px] font-bold text-slate-800 leading-relaxed italic pr-12">
                                            {supplier.address || supplier.address_details?.address_line1 || 'No Address Registered'}
                                        </p>
                                        <div className="flex gap-1.5 mt-3">
                                            <span className="px-1.5 py-0.25 bg-white border border-gray-200 rounded text-[8px] font-bold text-gray-500">{supplier.address_details?.city || 'City'}</span>
                                            <span className="px-1.5 py-0.25 bg-white border border-gray-200 rounded text-[8px] font-bold text-gray-500">{supplier.country}</span>
                                        </div>
                                    </div>
                                </InfoSection>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Settings' && (
                        <div className="w-full animate-in slide-in-from-bottom-2 duration-300">
                            <InfoSection
                                title="Governance Constraints"
                                icon={ShieldCheck}
                                themeColor={themeColor}
                                className="relative"
                            >
                                <div className="absolute top-4 right-10 flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200 shadow-sm">
                                    <Lock size={10} className="text-slate-400" />
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Read-Only Status Monitor</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pb-2">
                                    {[
                                        { id: 'disabled', label: 'Registry Disabled' },
                                        { id: 'is_frozen', label: 'Status Frozen' },
                                        { id: 'on_hold', label: 'Manual System Hold' },
                                        { id: 'is_internal_supplier', label: 'Internal Business Partner' },
                                        { id: 'is_transporter', label: 'Logistics / Transporter' },
                                        { id: 'warn_rfqs', label: 'Warning on RFQs' },
                                        { id: 'warn_pos', label: 'Warning on POs' },
                                        { id: 'prevent_rfqs', label: 'Block Creation of RFQs' },
                                        { id: 'prevent_pos', label: 'Block Creation of POs' },
                                        { id: 'allow_purchase_invoice_creation_without_purchase_order', label: 'Authorize Invoice without PO' },
                                        { id: 'allow_purchase_invoice_creation_without_purchase_receipt', label: 'Authorize Invoice without Receipt' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 px-4 bg-slate-50/50 border border-slate-100 rounded-lg transition-all group"
                                        >
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${supplier[item.id] ? 'text-black' : 'text-slate-400'}`}>
                                                {item.label}
                                            </span>
                                            <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${supplier[item.id] ? '' : 'bg-slate-200'}`}
                                                style={{ backgroundColor: supplier[item.id] ? themeColor : undefined }}
                                            >
                                                <div
                                                    className={`absolute w-2.5 h-2.5 rounded-full bg-white transition-all duration-300 shadow-sm ${supplier[item.id] ? 'right-0.5' : 'left-0.5'}`}
                                                    style={{
                                                        top: '2px'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
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