import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2, 
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart, 
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
  ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, color, delay }) => (
  <div 
    className="bg-white p-8 rounded-[2.5rem] border border-gray-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] hover:-translate-y-1.5 transition-all duration-500 flex items-center justify-between group relative overflow-hidden"
    style={{ animation: `fadeIn 0.6s ease-out forwards ${delay}s`, opacity: 0 }}
  >
    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-gray-50 rounded-full opacity-40 group-hover:scale-150 transition-transform duration-700" />
    <div className="relative z-10 space-y-4">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">{label}</p>
      <div className="flex items-baseline gap-2">
        {currency && <span className="text-[13px] font-black text-gray-300 uppercase tracking-widest">{currency}</span>}
        <h4 className="text-3xl font-black text-gray-900 leading-none tracking-tight">
          {value}
        </h4>
      </div>
    </div>
    <div className={`relative z-10 p-5 rounded-[1.5rem] transition-all duration-500 shadow-inner group-hover:scale-110`} style={{ backgroundColor: `${color}10` || '#f8fafc' }}>
      <Icon size={28} style={{ color: color || '#94a3b8' }} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName, icon: Icon }) => (
  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col h-full hover:shadow-[0_15px_45px_rgba(0,0,0,0.05)] transition-all duration-500 group">
    <div className="px-10 py-7 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
            <Icon size={16} className="text-blue-500" />
        </div>
        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{title}</h5>
      </div>
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
    </div>
    <div className="p-6 flex-1">
      <div className="space-y-3">
        {links.map((link, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
            className="flex items-center justify-between p-5 rounded-[1.5rem] hover:bg-blue-50/50 transition-all cursor-pointer group/item border border-transparent hover:border-blue-100/50"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-black text-gray-700 group-hover/item:text-blue-600 transition-colors">{link.doctype}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-black px-3 py-1 bg-gray-50 text-gray-400 group-hover/item:bg-blue-600 group-hover/item:text-white rounded-full transition-all">{link.count}</span>
              <ArrowRight size={14} className="text-gray-300 group-hover/item:text-blue-500 group-hover/item:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
        {links.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center opacity-30 grayscale">
            <Layers size={40} className="mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">No Registry Links</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const InfoSection = ({ title, children, icon: Icon }) => (
  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-500">
    <div className="px-10 py-7 border-b border-gray-50 bg-gray-50/20 flex items-center gap-4">
      <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
        <Icon size={20} className="text-white" />
      </div>
      <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">{title}</h5>
    </div>
    <div className="p-10">
      {children}
    </div>
  </div>
);

const SupplierDetails = () => {
    const { name } = useParams();
    const navigate = useNavigate();
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
        email_id: '',
        mobile_no: '',
        address: '',
        city: '',
        country: 'United Arab Emirates'
    });

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
                    email_id: data.contact_details?.email_id || '',
                    mobile_no: data.contact_details?.mobile_no || '',
                    address: data.address || data.address_details?.address_line1 || '',
                    city: data.address_details?.city || '',
                    country: data.country || 'United Arab Emirates'
                });
            }
            setDashboardData(dashRes.data.message || dashRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setTimeout(() => setLoading(false), 600);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
                supplier_name: name,
                data: form
            }, { withCredentials: true });

            if (res.data.message?.status === 'success') {
                Swal.fire({ 
                    icon: 'success', 
                    title: 'System Authorized', 
                    text: 'Partner profile has been successfully synchronized.',
                    borderRadius: '2rem',
                    confirmButtonColor: '#2563eb'
                });
                setShowEditModal(false);
                fetchData();
            } else {
                throw new Error(res.data.message?.message || 'Update rejected by server.');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Authorization Refused', text: err.message, borderRadius: '2rem' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfdfe] gap-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full animate-ping opacity-20" />
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

    const isActive = supplier.disabled === 0;

    return (
        <>
        <div className="min-h-screen bg-[#fcfdfe] pb-32 pt-10 font-sans">
            
            {/* 1. Premium Identity Canvas */}
            <div className="max-w-[1400px] mx-auto px-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] p-12 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50/50 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110" />
                    
                    <div className="w-32 h-32 bg-gradient-to-br from-gray-50 to-white rounded-[2.5rem] flex items-center justify-center border border-gray-100/50 overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                        {supplier.image ? (
                            <img src={supplier.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <Building2 size={56} className="text-gray-200" />
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left relative z-10 space-y-4">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <span className="text-[10px] font-black px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full uppercase tracking-widest border border-blue-100 shadow-sm">
                                {supplier.supplier_group}
                            </span>
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border flex items-center gap-2 shadow-sm ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                <span className={`w-2 h-2 rounded-full animate-pulse ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                {isActive ? 'Operational' : 'Restricted'}
                            </span>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-none">{supplier.supplier_name}</h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-8">
                            <div className="flex items-center gap-3 group/meta">
                                <div className="p-2 bg-gray-50 rounded-xl group-hover/meta:bg-blue-50 transition-colors">
                                    <MapPin size={14} className="text-gray-400 group-hover/meta:text-blue-500" />
                                </div>
                                <span className="text-[13px] font-bold text-gray-500">{supplier.country || 'United Arab Emirates'}</span>
                            </div>
                            <div className="flex items-center gap-3 group/meta">
                                <div className="p-2 bg-gray-50 rounded-xl group-hover/meta:bg-blue-50 transition-colors">
                                    <Tag size={14} className="text-gray-400 group-hover/meta:text-blue-500" />
                                </div>
                                <span className="text-[13px] font-black text-gray-400 uppercase tracking-widest">{supplier.name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="md:ml-auto relative z-10">
                        <button 
                            onClick={() => setShowEditModal(true)} 
                            className="px-8 py-4 bg-white border border-gray-100 text-gray-900 rounded-[1.5rem] text-[12px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300 flex items-center gap-3 shadow-sm hover:shadow-xl active:scale-95"
                        >
                            <Edit2 size={16} strokeWidth={3} /> Authorize Revision
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Structured Intelligence Navigation */}
            <div className="max-w-[1400px] mx-auto px-12 mb-12">
                <div className="flex gap-12 border-b border-gray-50/80 px-4">
                    {[
                        { id: 'Overview', icon: Layers },
                        { id: 'Intelligence', icon: FileText },
                        { id: 'Connectivity', icon: Globe },
                        { id: 'Protocols', icon: ShieldCheck }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-5 px-2 text-[11px] font-black uppercase tracking-[0.25em] transition-all relative group ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-300 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2.5">
                                <tab.icon size={14} className={activeTab === tab.id ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'} />
                                {tab.id}
                            </div>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-[-1.5px] left-0 right-0 h-[3px] bg-blue-600 rounded-full animate-in fade-in zoom-in-50 duration-500" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. High Performance Content Shard */}
            <div className="max-w-[1400px] mx-auto px-6">
                {activeTab === 'Overview' && dashboardData && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
                        {/* Highlights Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            <StatCard 
                                label="Annualized Expenditure" 
                                value={parseFloat(dashboardData.stats?.annual_billing || 0).toLocaleString()} 
                                currency={dashboardData.stats?.currency || 'AED'} 
                                icon={TrendingUp} 
                                color="#2563eb"
                                delay={0.1}
                            />
                            <StatCard 
                                label="Liability exposure" 
                                value={parseFloat(dashboardData.stats?.total_unpaid || 0).toLocaleString()} 
                                currency={dashboardData.stats?.currency || 'AED'} 
                                icon={Activity} 
                                color="#f43f5e" 
                                delay={0.2}
                            />
                            <StatCard 
                                label="Graph Connectivity" 
                                value={Object.values(dashboardData.counts || {}).reduce((a, b) => a + b, 0)} 
                                icon={Layers} 
                                color="#8b5cf6" 
                                delay={0.3}
                            />
                        </div>

                        {/* Connection Matrices */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
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
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'Intelligence' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <InfoSection title="Core Specifications" icon={Hash}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Legal Name</label>
                                    <p className="text-base font-black text-gray-900">{supplier.supplier_name}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Industrial Cluster</label>
                                    <p className="text-base font-black text-gray-900">{supplier.supplier_group}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Structural Format</label>
                                    <p className="text-base font-black text-gray-900">{supplier.supplier_type}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Tax Identity (TRN)</label>
                                    <p className="text-base font-black text-gray-900 font-mono tracking-tight">{supplier.tax_id || 'NOT REGISTERED'}</p>
                                </div>
                            </div>
                        </InfoSection>

                        <InfoSection title="Metadata Registry" icon={Calendar}>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">System Key</label>
                                    <p className="text-sm font-black text-blue-600 font-mono">{supplier.name}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Default Currency</label>
                                    <p className="text-base font-black text-gray-900">{supplier.default_currency || 'AED'}</p>
                                </div>
                            </div>
                        </InfoSection>
                    </div>
                )}

                {activeTab === 'Connectivity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <InfoSection title="Global Channels" icon={Globe}>
                            <div className="space-y-10">
                                <div className="flex items-start gap-6 group">
                                    <div className="p-4 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm"><Mail size={24} /></div>
                                    <div className="space-y-2 flex-1">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Operational Email Protocol</label>
                                        <p className="text-lg font-black text-gray-900 tracking-tight">{supplier.contact_details?.email_id || 'UNKNOWN CHANNEL'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-6 group">
                                    <div className="p-4 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm"><Phone size={24} /></div>
                                    <div className="space-y-2 flex-1">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Secure Voice Line</label>
                                        <p className="text-lg font-black text-gray-900 tracking-tight">{supplier.contact_details?.mobile_no || 'UNKNOWN CHANNEL'}</p>
                                    </div>
                                </div>
                            </div>
                        </InfoSection>

                        <InfoSection title="Geospatial Hub" icon={MapPin}>
                            <div className="flex flex-col justify-center h-full space-y-8">
                                <div className="p-8 bg-gray-50/50 rounded-[2rem] border border-gray-100 flex flex-col gap-6">
                                    <p className="text-lg font-black text-gray-900 leading-relaxed tracking-tight">
                                        {supplier.address || supplier.address_details?.address_line1 || 'No Geospatial Metadata Authorized'}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="px-5 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 shadow-sm">
                                            {supplier.address_details?.city || 'Regional Hub'}
                                        </div>
                                        <div className="px-5 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 shadow-sm">
                                            {supplier.country || 'Global Site'}
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-colors">
                                    <Globe size={16} /> View in Global Map
                                </button>
                            </div>
                        </InfoSection>
                    </div>
                )}

                {activeTab === 'Protocols' && (
                    <div className="max-w-2xl">
                        <InfoSection title="Security Framework" icon={ShieldCheck}>
                            <div className="flex items-center justify-between bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100">
                                <div className="space-y-2">
                                    <h5 className="text-xl font-black text-gray-900 tracking-tight">Lifecycle Status</h5>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current operational permission profile</p>
                                </div>
                                <div className={`relative flex items-center gap-4 ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    <span className="text-sm font-black uppercase tracking-[0.2em]">{isActive ? 'Authorization Granted' : 'Authorization Suspended'}</span>
                                    <div className={`p-4 rounded-2xl ${isActive ? 'bg-emerald-50' : 'bg-rose-50'} shadow-sm`}><Activity size={24} /></div>
                                </div>
                            </div>
                        </InfoSection>
                    </div>
                )}
            </div>
        </div>

        {/* Premium Edit Modal Canvas */}
        {showEditModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-300">
            <div className="bg-[#fcfdfe] w-full max-w-5xl h-full lg:h-[90vh] rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500">
              
              {/* Modal Header */}
              <div className="px-12 py-10 flex justify-between items-center bg-white border-b border-gray-50/80 shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-500/20">
                      <Building2 size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Modify Credentials</h2>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-3">Partner Identity & Procurement Framework</p>
                    </div>
                 </div>
                 <button onClick={() => setShowEditModal(false)} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-[1.5rem] text-gray-400 hover:text-gray-900 transition-all active:scale-95">
                    <X size={28} />
                 </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-12 bg-[#fcfdfe]">
                 <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    
                    {/* Identification */}
                    <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100/60 shadow-[0_15px_60px_-15px_rgba(0,0,0,0.02)] space-y-10">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                        <div className="w-3 h-8 bg-blue-600 rounded-full" />
                        Registry Identity
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Organization Title *</label>
                          <input 
                            type="text" 
                            value={form.supplier_name} 
                            onChange={e => setForm({...form, supplier_name: e.target.value})} 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Activity Group *</label>
                          <select 
                            value={form.supplier_group} 
                            onChange={e => setForm({...form, supplier_group: e.target.value})} 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none outline-none"
                            style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
                          >
                            {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Tax Registration (TRN)</label>
                          <input 
                            type="text" 
                            value={form.tax_id} 
                            onChange={e => setForm({...form, tax_id: e.target.value})} 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Logistics */}
                    <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100/60 shadow-[0_15px_60px_-15px_rgba(0,0,0,0.02)] space-y-10">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                        <div className="w-3 h-8 bg-blue-600 rounded-full" />
                        Communication & Site
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Authorized Email</label>
                          <input 
                            type="email" 
                            value={form.email_id} 
                            onChange={e => setForm({...form, email_id: e.target.value})} 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Global Mobile Path</label>
                          <input 
                            type="text" 
                            value={form.mobile_no} 
                            onChange={e => setForm({...form, mobile_no: e.target.value})} 
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all" 
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Primary Operational Hub (Address)</label>
                          <textarea 
                            rows={4} 
                            value={form.address} 
                            onChange={e => setForm({...form, address: e.target.value})} 
                            className="w-full px-6 py-6 bg-gray-50 border-none rounded-[2rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-500/5 transition-all resize-none" 
                          />
                        </div>
                      </div>
                    </div>
                 </div>
              </div>

              {/* Modal Footer */}
              <div className="px-12 py-10 border-t border-gray-50 flex justify-end items-center gap-6 shrink-0 bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.03)]">
                 <button 
                   onClick={() => setShowEditModal(false)} 
                   className="px-10 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-all"
                 >
                   Discard
                 </button>
                 <button 
                   onClick={handleSave} 
                   disabled={saving} 
                   className="px-12 py-4 bg-blue-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-4 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50"
                 >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={3} />}
                    {saving ? 'Synchronizing...' : 'Authorize Updates'}
                 </button>
              </div>

            </div>
          </div>
        )}
        </>
    );
};

const linkTypeToIcon = (type) => {
    const map = {
        'Procurement': ShoppingCart,
        'Accounts': Receipt,
        'Logistics': Package,
        'Financial': CreditCard
    };
    return map[Object.keys(map).find(k => type.includes(k))] || Layers;
}

export default SupplierDetails;
