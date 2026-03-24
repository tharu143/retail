import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, MapPin, Phone, Mail, Clock, Info, 
  ChevronLeft, Loader2, AlertCircle, Calendar, Globe, Tag,
  Briefcase, Activity, Shield, User, Receipt, Layers, ShoppingCart, ArrowRight, Settings, Check, CheckCircle2, Save
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

const SupplierDetails = () => {
    const { name } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [supplier, setSupplier] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});

    const [settings, setSettings] = useState({
        allow_purchase_invoice_creation_without_purchase_order: 0,
        allow_purchase_invoice_creation_without_purchase_receipt: 0,
        is_frozen: 0,
        disabled: 0,
        on_hold: 0
    });

    const [legacySubTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = legacySubTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';

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
                setEditData({
                    supplier_name: data.supplier_name,
                    supplier_group: data.supplier_group,
                    supplier_type: data.supplier_type,
                    tax_id: data.tax_id,
                    country: data.country,
                    address_line1: data.address_details?.address_line1,
                    city: data.address_details?.city,
                    full_name: data.contact_details?.full_name || data.contact_details?.first_name,
                    mobile_no: data.contact_details?.mobile_no,
                    email_id: data.contact_details?.email_id
                });
                setSettings({
                    allow_purchase_invoice_creation_without_purchase_order: data.allow_purchase_invoice_creation_without_purchase_order || 0,
                    allow_purchase_invoice_creation_without_purchase_receipt: data.allow_purchase_invoice_creation_without_purchase_receipt || 0,
                    is_frozen: data.is_frozen || 0,
                    disabled: data.disabled || 0,
                    on_hold: data.on_hold || 0
                });
            }
            setDashboardData(dashRes.data.message || dashRes.data);
        } catch (err) {
            setError('DATA_FETCH_ERROR');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
            <Loader2 size={48} className="animate-spin" style={{ color: themeColor }} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading Intelligence...</p>
        </div>
    );
    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            
            // Re-structure data for nested updates (Address/Contact)
            const payload = {
                supplier_name: editData.supplier_name,
                supplier_group: editData.supplier_group,
                supplier_type: editData.supplier_type,
                tax_id: editData.tax_id,
                country: editData.country,
                address_details: {
                    address_line1: editData.address_line1,
                    city: editData.city
                },
                contact_details: {
                    first_name: editData.full_name,
                    mobile_no: editData.mobile_no,
                    email_id: editData.email_id
                }
            };

            const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
                supplier_name: name,
                data: payload
            }, { withCredentials: true });

            if (res.data.message?.status === 'success') {
                Swal.fire({ icon: 'success', title: 'Profile Updated', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                setIsEditing(false);
                fetchData();
            } else {
                const errorMsg = res.data.message?.message || 'Update failed';
                throw new Error(errorMsg);
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleEditChange = (key, val) => {
        setEditData(prev => ({ ...prev, [key]: val }));
    };

    const handleSaveSettings = async () => {
        try {
            setSaving(true);
            const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
                supplier_name: name,
                data: settings
            }, { withCredentials: true });

            if (res.data.message?.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Settings Updated',
                    text: 'Supplier configuration successfully synchronized.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
                fetchData(); // Refresh data
            } else {
                const errorMsg = res.data.message?.message || 'Update failed';
                throw new Error(errorMsg);
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = (key) => {
        setSettings(prev => ({ ...prev, [key]: prev[key] === 1 ? 0 : 1 }));
    };
    if (error || !supplier) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10">
            <div className="bg-rose-50 p-6 rounded-full mb-6"><AlertCircle size={40} className="text-rose-400" /></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase mb-2">System Outage</h2>
            <p className="text-slate-500 font-bold mb-8 uppercase text-xs tracking-wider">Failed to retrieve supplier profile</p>
            <button onClick={() => navigate(-1)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Back to Inventory</button>
        </div>
    );

    const isActive = supplier.disabled === 0;

    return (
        <div className="so-page animate-fadeIn pb-20 px-8 max-w-7xl mx-auto" style={{ minHeight: '100vh', overflowY: 'auto' }}>
            
            {/* Bold Header Identity */}
            <div className="flex flex-col lg:flex-row items-center gap-12 py-10">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-white border-[6px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden transition-transform group-hover:scale-105">
                        {supplier.image ? (
                            <img src={supplier.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-50" style={{ color: themeColor }}>
                                <Building2 size={50} className="opacity-20" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 text-center lg:text-left space-y-4">
                    <div className="flex items-center justify-center lg:justify-start gap-4">
                        <span className="text-[10px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase tracking-widest border border-slate-200">
                            {supplier.supplier_group}
                        </span>
                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {isActive ? '● ACTIVE' : '● DISABLED'}
                        </div>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 leading-none tracking-tighter uppercase">
                        {supplier.supplier_name}
                    </h1>
                    <div className="flex items-center justify-center lg:justify-start gap-6 text-slate-400">
                        <div className="flex items-center gap-2">
                            <Globe size={16} />
                            <span className="text-xs font-black uppercase tracking-[0.15em]">{supplier.country}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Tag size={16} />
                            <span className="text-xs font-black uppercase tracking-[0.15em]">{supplier.name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setIsEditing(false)} 
                                className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveProfile} 
                                disabled={saving}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Info
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <User size={12} /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            {/* POS-8 Style Tab Navigation */}
            <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm inline-flex items-center mb-12">
                {[
                    { id: 'Dashboard', icon: Activity },
                    { id: 'Information', icon: Info },
                    { id: 'Contact', icon: Users },
                    { id: 'Settings', icon: Settings }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-10 py-4 rounded-2xl transition-all font-black text-[11px] uppercase tracking-[0.2em] ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon size={16} style={activeTab === tab.id ? { color: themeColor } : {}} />
                        {tab.id}
                    </button>
                ))}
            </div>

            {/* Dashboard Content */}
            {activeTab === 'Dashboard' && (
                <div className="space-y-12 animate-slideUp">
                    {/* Key Stats Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="so-card" style={{ borderRadius: '2.5rem', borderBottom: `8px solid ${themeColor}` }}>
                            <div className="p-10 flex items-center justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Turnover</p>
                                    <h4 className="text-4xl font-black text-slate-900 leading-none">
                                        <span className="text-sm font-bold opacity-30 mr-2">{dashboardData?.stats?.currency}</span>
                                        {parseFloat(dashboardData?.stats?.annual_billing || 0).toLocaleString()}
                                    </h4>
                                </div>
                                <div className="p-5 bg-emerald-50 rounded-3xl"><Receipt size={32} className="text-emerald-500" /></div>
                            </div>
                        </div>

                        <div className="so-card" style={{ borderRadius: '2.5rem', borderBottom: '8px solid #f43f5e' }}>
                            <div className="p-10 flex items-center justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unpaid Balance</p>
                                    <h4 className="text-4xl font-black text-rose-600 leading-none">
                                        <span className="text-sm font-bold opacity-30 mr-2">{dashboardData?.stats?.currency}</span>
                                        {parseFloat(dashboardData?.stats?.total_unpaid || 0).toLocaleString()}
                                    </h4>
                                </div>
                                <div className="p-5 bg-rose-50 rounded-3xl"><AlertCircle size={32} className="text-rose-500" /></div>
                            </div>
                        </div>

                        <div className="so-card" style={{ borderRadius: '2.5rem', borderBottom: '8px solid #1e293b', background: '#0f172a' }}>
                            <div className="p-10 flex items-center justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">System Links</p>
                                    <h4 className="text-4xl font-black text-white leading-none">
                                        {Object.values(dashboardData?.counts || {}).reduce((a, b) => a + b, 0)}
                                    </h4>
                                </div>
                                <div className="p-5 bg-white/10 rounded-3xl"><Layers size={32} className="text-white/40" /></div>
                            </div>
                        </div>
                    </div>

                    {/* Document Connections Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {dashboardData?.connections && Object.entries(dashboardData.connections).map(([category, links]) => {
                            if (links.length === 0) return null;
                            return (
                                <div key={category} className="so-card" style={{ borderRadius: '2.5rem', overflow: 'hidden' }}>
                                    <div className="p-6 bg-slate-50 border-b border-slate-100"><h5 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{category}</h5></div>
                                    <div className="p-8 space-y-3">
                                        {links.map((link, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(name)}`)}
                                                className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center grayscale group-hover:grayscale-0 transition-all">
                                                        <Tag size={18} style={{ color: themeColor }} />
                                                    </div>
                                                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{link.doctype}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-slate-400 group-hover:text-slate-900">{link.count}</span>
                                                    <ArrowRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Information Content */}
            {activeTab === 'Information' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 animate-slideUp">
                    <div className="so-card p-10 space-y-8" style={{ borderRadius: '2.5rem' }}>
                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Corporate Info</h5>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Supplier Name</label>
                                {isEditing ? <input type="text" value={editData.supplier_name} onChange={e => handleEditChange('supplier_name', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-800 text-sm uppercase" /> : <p className="font-black text-slate-800 text-lg uppercase">{supplier.supplier_name}</p>}
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Supplier Type</label>
                                {isEditing ? <select value={editData.supplier_type} onChange={e => handleEditChange('supplier_type', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-800 text-sm uppercase"><option value="Company">Company</option><option value="Individual">Individual</option></select> : <p className="font-black text-slate-800 text-lg uppercase">{supplier.supplier_type}</p>}
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">TRN Registration</label>
                                {isEditing ? <input type="text" value={editData.tax_id} onChange={e => handleEditChange('tax_id', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-800 text-sm uppercase" /> : <p className="font-black text-slate-800 text-lg uppercase">{supplier.tax_id || 'NONE'}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="so-card p-10 space-y-8" style={{ borderRadius: '2.5rem' }}>
                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Registered Address</h5>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Street Address</label>
                                {isEditing ? <textarea rows={2} value={editData.address_line1} onChange={e => handleEditChange('address_line1', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-800 text-sm uppercase" /> : <p className="font-black text-slate-800 text-lg uppercase leading-relaxed">{supplier.address_details?.address_line1 || 'No Registered Address'}</p>}
                            </div>
                            <div className="pt-4 flex gap-4">
                                <div className="p-3 bg-slate-50 rounded-2xl shrink-0"><MapPin size={24} style={{ color: themeColor }} /></div>
                                <div className="space-y-1 flex-1">
                                    <p className="text-[9px] text-slate-400 font-black uppercase">City</p>
                                    {isEditing ? <input type="text" value={editData.city} onChange={e => handleEditChange('city', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-1.5 rounded-lg font-black text-slate-800 text-xs uppercase" /> : <p className="text-sm font-black text-slate-800 uppercase">{supplier.address_details?.city || 'Local'}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="so-card p-10 space-y-8" style={{ borderRadius: '2.5rem' }}>
                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">System Identity</h5>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Supplier Group</label>
                                {isEditing ? <input type="text" value={editData.supplier_group} onChange={e => handleEditChange('supplier_group', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-800 text-sm uppercase" /> : <p className="font-black text-slate-800 text-lg uppercase">{supplier.supplier_group}</p>}
                            </div>
                            <div><label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Since</label><p className="font-black text-slate-500 text-sm uppercase">{new Date(supplier.creation).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Content ... */}
            {activeTab === 'Contact' && (
                <div className="so-card p-10 max-w-4xl mx-auto" style={{ borderRadius: '3rem' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-10">
                            <div>
                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] block mb-4">Contact Person</label>
                                {isEditing ? <input type="text" value={editData.full_name} onChange={e => handleEditChange('full_name', e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-slate-900 text-xl uppercase" /> : <p className="text-3xl font-black text-slate-900 uppercase leading-none">{supplier.contact_details?.full_name || 'No Direct Contact'}</p>}
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center shadow-inner"><Phone size={28} style={{ color: themeColor }} /></div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobile / Direct</p>
                                    {isEditing ? <input type="text" value={editData.mobile_no} onChange={e => handleEditChange('mobile_no', e.target.value)} className="w-full bg-transparent border-b border-slate-200 p-1 font-black text-slate-800 text-lg" /> : <p className="text-xl font-black text-slate-800">{supplier.contact_details?.mobile_no || 'N/A'}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center shadow-inner"><Mail size={28} style={{ color: themeColor }} /></div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operational Email</p>
                                    {isEditing ? <input type="email" value={editData.email_id} onChange={e => handleEditChange('email_id', e.target.value)} className="w-full bg-transparent border-b border-slate-200 p-1 font-black text-slate-800 text-lg" /> : <p className="text-xl font-black text-slate-800">{supplier.contact_details?.email_id || 'N/A'}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center space-y-6">
                            <Users size={64} className="opacity-10" />
                            <p className="text-xs font-black text-slate-400 uppercase leading-relaxed tracking-widest px-8">Ensure your contact network is verified for secure transactions.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Content */}
            {activeTab === 'Settings' && (
                <div className="space-y-10 animate-slideUp max-w-4xl mx-auto">
                    <div className="so-card" style={{ borderRadius: '3rem' }}>
                        <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configuration Matrix</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Direct Operational Overrides</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-3xl"><Settings size={24} className="opacity-20" /></div>
                        </div>

                        <div className="p-12 space-y-8">
                            {[
                                { key: 'on_hold', label: 'Block Supplier', desc: 'Prevent any new transactions or selections' },
                                { key: 'disabled', label: 'System Deactivation', desc: 'Soft-remove from active inventory selection' },
                                { key: 'is_frozen', label: 'Freeze Account', desc: 'Lock the account for auditing purpose' },
                                { key: 'allow_purchase_invoice_creation_without_purchase_order', label: 'Bypass Purchase Orders', desc: 'Direct invoice creation without preceding PO' },
                                { key: 'allow_purchase_invoice_creation_without_purchase_receipt', label: 'Bypass Receipts', desc: 'Allow invoicing before items are physically received' }
                            ].map(item => (
                                <div 
                                    key={item.key} 
                                    onClick={() => toggleSetting(item.key)}
                                    className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:border-emerald-300 transition-all cursor-pointer group"
                                >
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.desc}</p>
                                    </div>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${settings[item.key] === 1 ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-200 group-hover:border-slate-300'}`}>
                                        {settings[item.key] === 1 ? <Check size={20} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-10 bg-slate-50/50 border-t border-slate-50 flex justify-end px-12 pb-12">
                            <button 
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="flex items-center gap-4 px-12 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} style={{ color: themeColor }} />}
                                {saving ? 'Syncing...' : 'Commit Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierDetails;
