import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2, 
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart, 
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../Nav/NavBar';

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, color, trend }) => (
  <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-2">
        {currency && <span className="text-sm font-bold text-gray-400">{currency}</span>}
        <h4 className="text-2xl font-black text-gray-900 leading-none" style={color ? { color } : {}}>
          {value}
        </h4>
      </div>
    </div>
    <div className="p-4 rounded-xl transition-colors" style={{ backgroundColor: `${color}10` || '#f8fafc' }}>
      <Icon size={24} style={{ color: color || '#94a3b8' }} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, navigate, supplierName }) => (
  <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
    <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/30">
      <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{title}</h5>
    </div>
    <div className="p-4 flex-1">
      <div className="space-y-2">
        {links.map((link, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(`/${link.doctype.toLowerCase().replace(/ /g, '')}list?supplier=${encodeURIComponent(supplierName)}`)}
            className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">{link.doctype}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-400 group-hover:text-gray-900">{link.count}</span>
              <ArrowRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
        {links.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-xs italic">No active links</div>
        )}
      </div>
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
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});

    // Theme Support
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
                    email_id: data.contact_details?.email_id || '',
                    mobile_no: data.contact_details?.mobile_no || '',
                    address_line1: data.address_details?.address_line1 || '',
                    city: data.address_details?.city || '',
                    country: data.country || 'United Arab Emirates'
                });
            }
            setDashboardData(dashRes.data.message || dashRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                supplier_name: editData.supplier_name,
                supplier_group: editData.supplier_group,
                supplier_type: editData.supplier_type,
                tax_id: editData.tax_id,
                email_id: editData.email_id,
                mobile_no: editData.mobile_no,
                address_line1: editData.address_line1,
                city: editData.city,
                country: editData.country
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
                throw new Error(res.data.message?.message || 'Update failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-gray-50">
            <Loader2 size={40} className="animate-spin text-gray-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Dashboard...</p>
        </div>
    );

    if (!supplier) return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 uppercase">Supplier Not Found</h2>
        <button onClick={() => navigate(-1)} className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest">Return to List</button>
      </div>
    );

    const isActive = supplier.disabled === 0;

    return (
        <>
        <NavBar />
        <div className="min-h-screen bg-[#f8fafc] pb-20 pt-8 px-6 lg:px-12">
            
            {/* 1. Header Identity Card */}
            <div className="max-w-7xl mx-auto bg-white rounded-[2rem] border border-gray-100 shadow-sm p-10 flex flex-col md:flex-row items-center gap-10 mb-8 relative">
                <div className="w-24 h-24 bg-gray-50 rounded-[1.5rem] flex items-center justify-center border border-gray-100 overflow-hidden shrink-0">
                    {supplier.image ? (
                        <img src={supplier.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <Building2 size={40} className="text-gray-300" />
                    )}
                </div>

                <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                        <span className="text-[9px] font-bold px-2.5 py-1 bg-gray-100 text-gray-500 rounded-md uppercase tracking-wider border border-gray-200">
                            {supplier.supplier_group}
                        </span>
                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border flex items-center gap-1.5 ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            {isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-2">{supplier.supplier_name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-5 text-gray-400">
                        <div className="flex items-center gap-2">
                            <MapPin size={14} className="opacity-60" />
                            <span className="text-xs font-semibold">{supplier.country || 'United Arab Emirates'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Tag size={14} className="opacity-60" />
                            <span className="text-xs font-semibold">{supplier.name}</span>
                        </div>
                    </div>
                </div>

                <div className="md:ml-auto">
                    {!isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Users size={14} /> Edit Profile
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-widest">Discard</button>
                            <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg hover:shadow-gray-900/20">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Commit Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Responsive Tabs */}
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex gap-10 border-b border-gray-100 px-4">
                    {[
                        { id: 'Dashboard', icon: Layers },
                        { id: 'Information', icon: Tag },
                        { id: 'Contact', icon: Phone },
                        { id: 'Settings', icon: Settings }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 px-2 text-[11px] font-extrabold uppercase tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {tab.id}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-600 rounded-full animate-fadeIn" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Main Content Area */}
            <div className="max-w-7xl mx-auto">
                {activeTab === 'Dashboard' && dashboardData && (
                    <div className="space-y-10 animate-slideUp">
                        {/* Highlights Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <StatCard 
                                label="Annual Billing" 
                                value={parseFloat(dashboardData.stats?.annual_billing || 0).toLocaleString()} 
                                currency={dashboardData.stats?.currency} 
                                icon={CreditCard} 
                                color="#4f46e5"
                            />
                            <StatCard 
                                label="Total Unpaid" 
                                value={parseFloat(dashboardData.stats?.total_unpaid || 0).toLocaleString()} 
                                currency={dashboardData.stats?.currency} 
                                icon={AlertCircle} 
                                color="#ef4444" 
                            />
                            <StatCard 
                                label="Total Links" 
                                value={Object.values(dashboardData.counts || {}).reduce((a, b) => a + b, 0)} 
                                icon={Layers} 
                                color="#0891b2" 
                            />
                        </div>

                        {/* Connection Matrices */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {dashboardData.connections && Object.entries(dashboardData.connections).map(([category, links]) => {
                                if (!links || links.length === 0) return null;
                                return (
                                    <ConnectionCard 
                                        key={category} 
                                        title={category} 
                                        links={links} 
                                        navigate={navigate} 
                                        supplierName={name}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'Information' && (
                    <div className="animate-slideUp max-w-4xl">
                        <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/30">
                                <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Base Specifications</h5>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier Name</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.supplier_name} onChange={e => setEditData({...editData, supplier_name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        ) : (
                                            <p className="text-sm font-extrabold text-gray-800">{supplier.supplier_name}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier Group</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.supplier_group} onChange={e => setEditData({...editData, supplier_group: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        ) : (
                                            <p className="text-sm font-extrabold text-gray-800">{supplier.supplier_group}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entity Type</label>
                                        <p className="text-sm font-extrabold text-gray-800">{supplier.supplier_type}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TRN Registration</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.tax_id} onChange={e => setEditData({...editData, tax_id: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        ) : (
                                            <p className="text-sm font-extrabold text-gray-800">{supplier.tax_id || 'NONE'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Contact' && (
                    <div className="animate-slideUp max-w-4xl">
                        <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/30">
                                <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Communication Identity</h5>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-50 rounded-xl"><Mail size={20} className="text-blue-500" /></div>
                                            <div className="space-y-1.5 flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operational Email</label>
                                                {isEditing ? (
                                                    <input type="email" value={editData.email_id} onChange={e => setEditData({...editData, email_id: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold" />
                                                ) : (
                                                    <p className="text-sm font-extrabold text-gray-800">{supplier.contact_details?.email_id || 'N/A'}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-indigo-50 rounded-xl"><Phone size={20} className="text-indigo-500" /></div>
                                            <div className="space-y-1.5 flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Direct Mobile</label>
                                                {isEditing ? (
                                                    <input type="text" value={editData.mobile_no} onChange={e => setEditData({...editData, mobile_no: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold" />
                                                ) : (
                                                    <p className="text-sm font-extrabold text-gray-800">{supplier.contact_details?.mobile_no || 'N/A'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-6 rounded-2xl flex flex-col justify-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <MapPin size={18} className="text-blue-600" />
                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Physical Address</p>
                                        </div>
                                        {isEditing ? (
                                            <textarea rows={3} value={editData.address_line1} onChange={e => setEditData({...editData, address_line1: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm font-bold resize-none" />
                                        ) : (
                                            <p className="text-sm font-extrabold text-gray-800 leading-relaxed">
                                                {supplier.address_details?.address_line1 || 'No Registered Address'}
                                                {supplier.address_details?.city && <span className="block italic mt-1 text-gray-500 text-xs">{supplier.address_details.city}</span>}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Settings' && (
                    <div className="animate-slideUp max-w-2xl">
                        <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-8 flex items-center justify-between">
                            <div className="space-y-2">
                                <h5 className="text-lg font-black text-gray-900 uppercase">Operational Status</h5>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Configure partner availability</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl grayscale opacity-40"><Settings size={30} /></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default SupplierDetails;
