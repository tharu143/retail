import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart,
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
  ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText,
  Search, Filter, Lock, Unlock, AlertTriangle, CheckSquare, Square,
  User, CheckCircle2, Clock, Zap, UserPlus
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, themeColor, isGreen }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between group">
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {currency && <span className="text-[11px] font-bold text-gray-400 uppercase">{currency}</span>}
        <h4 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h4>
      </div>
    </div>
    <div className="p-3.5 rounded-xl transition-colors" style={{ backgroundColor: isGreen ? '#f0fdf4' : '#f0f9ff' }}>
      <Icon size={22} style={{ color: themeColor }} strokeWidth={2.5} />
    </div>
  </div>
);

const ConnectionCard = ({ title, count, total_val, icon: Icon, themeColor, onClick }) => (
  <div onClick={onClick} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-all">
        <Icon size={18} style={{ color: themeColor }} strokeWidth={2} />
      </div>
      <div>
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{title}</h5>
        <p className="text-sm font-black text-gray-900">{count} Records</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-gray-400">{total_val}</span>
      <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-900 transition-all group-hover:translate-x-1" />
    </div>
  </div>
);

const SectionLabel = ({ text }) => (
  <div className="flex items-center gap-4 mb-6">
    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{text}</h4>
    <div className="h-px w-full bg-slate-100" />
  </div>
);

const InfoRow = ({ label, value, icon: Icon, themeColor }) => (
  <div className="space-y-1.5 py-1">
    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
      <Icon size={12} style={{ color: themeColor }} /> {label}
    </div>
    <p className="text-sm font-bold text-gray-900 pl-5">{value || 'Not Defined'}</p>
  </div>
);

const InputGroup = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500/50 transition-all"
    />
  </div>
);

const SelectGroup = ({ label, value, options, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500/50 transition-all cursor-pointer"
    >
      {options?.map(opt => <option key={opt.name || opt} value={opt.name || opt}>{opt.label || opt.name || opt}</option>)}
    </select>
  </div>
);

/* ==================== MAIN COMPONENT ==================== */
const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { themeColor, themeLight, isGreen } = useLegacyTheme();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('General');
  const [showEditModal, setShowEditModal] = useState(false);

  // Data States
  const [customer, setCustomer] = useState(null);
  const [dashboard, setDashboard] = useState({
    counts: { sales_orders: 0, sales_invoices: 0, delivery_notes: 0, payment_entries: 0, quotations: 0 },
    current_balance: 0
  });
  const [addresses, setAddresses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [meta, setMeta] = useState({
    customer_types: ['Individual', 'Company'],
    customer_groups: [],
    territories: [],
    emirates: [],
    address_types: [],
    countries: []
  });

  // ERPNext Consistent Form State
  const [form, setForm] = useState({
    customer_name: '',
    customer_type: 'Individual',
    customer_group: 'All Customer Groups',
    territory: 'All Territories',
    mobile_no: '', email_id: '', tax_id: '',
    disabled: 0
  });

  useEffect(() => {
    fetchMeta();
    if (!isNew && id && id !== 'undefined') {
      fetchCustomerData();
      fetchDashboard();
    }
  }, [id, isNew]);

  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${API_BASE}.get_customer_meta_options`);
      const data = res.data.message?.data || {};
      if (data) {
        setMeta(prev => ({ 
          ...prev, 
          customer_groups: data.customer_group || [],
          territories: data.territory || [],
          countries: data.countries || [],
          address_types: data.address_type || [],
          emirates: data.emirates || []
        }));
      }
    } catch (err) { console.error("Meta failed", err); }
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } });
      const { customer: cust, addresses: addr, contacts: cont } = res.data.message.data;
      setCustomer(cust);
      setAddresses(addr || []);
      setContacts(cont || []);
      setForm({
        customer_name: cust.customer_name || '',
        customer_type: cust.customer_type || 'Individual',
        customer_group: cust.customer_group || 'All Customer Groups',
        territory: cust.territory || 'All Territories',
        mobile_no: cust.mobile_no || '',
        email_id: cust.email_id || '',
        tax_id: cust.tax_id || '',
        disabled: cust.disabled || 0
      });
    } catch (err) { Swal.fire('Error', 'Failed to retrieve profile data', 'error'); }
    finally { setTimeout(() => setLoading(false), 500); }
  };

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API_BASE}.get_customer_dashboard_data`, { params: { customer_id: id } });
      if (res.data.message?.success) setDashboard(res.data.message.data);
    } catch (err) { console.error('Dashboard failed', err); }
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) return Swal.fire('Field Missing', 'Customer Name is mandatory', 'warning');
    try {
      setSaving(true);
      const payload = {
        customer_data: { ...form, name: isNew ? undefined : id },
        address_data: {}, 
        contact_data: {}
      };
      const res = await axios.post(`${API_BASE}.save_customer_details_retail`, payload);
      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Saved Successfully', text: isNew ? 'Customer created.' : 'Customer profile updated.', confirmButtonColor: themeColor });
        if (isNew) navigate(`/customer-details/${res.data.message.customer_name}`);
        else { setShowEditModal(false); fetchCustomerData(); }
      } else throw new Error(res.data.message?.message);
    } catch (err) { Swal.fire('Save Failure', err.message, 'error'); }
    finally { setSaving(false); }
  };

  const isActive = customer?.disabled === 0;

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={36} />
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Customer Details...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/customerlist')} className="p-2.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-all shadow-sm">
              <ChevronLeft size={20} />
            </button>
            <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center">
               <User size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{isNew ? 'New Customer' : customer?.customer_name}</h1>
                {!isNew && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${customer?.disabled === 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                    {customer?.disabled === 0 ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
              {!isNew && <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{customer?.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isNew ? (
              <button onClick={() => setShowEditModal(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
                <Edit2 size={14} /> Edit Profile
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 px-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-fit">
          {['General', 'Dashboard', 'Addresses', 'Contacts'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:text-gray-900'}`}
            >
              {tab === 'Contacts' ? `Contacts (${contacts.length})` : tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {activeTab === 'General' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <SectionLabel text="General Information" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <InfoRow label="Customer Name" value={customer?.customer_name} icon={User} themeColor={themeColor} />
                    <InfoRow label="Customer Type" value={customer?.customer_type} icon={Building2} themeColor={themeColor} />
                    <InfoRow label="Customer Group" value={customer?.customer_group} icon={Layers} themeColor={themeColor} />
                    <InfoRow label="Territory" value={customer?.territory} icon={Globe} themeColor={themeColor} />
                    <InfoRow label="Tax ID / TRN" value={customer?.tax_id} icon={FileText} themeColor={themeColor} />
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <SectionLabel text="Contact Details" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                       <Phone size={14} className="text-gray-400" />
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Mobile No</p>
                       <p className="text-xs font-bold text-gray-900">{customer?.mobile_no || 'No Mobile'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                       <Mail size={14} className="text-gray-400" />
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
                       <p className="text-xs font-bold text-gray-900 truncate">{customer?.email_id || 'No Email'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                       <Users size={14} className="text-gray-400" />
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Primary Contact</p>
                       <p className="text-xs font-bold text-gray-900">{contacts?.[0]?.full_name || 'None'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatCard label="Total Outstanding" value={dashboard.current_balance?.toLocaleString()} currency="AED" icon={Activity} themeColor="#ef4444" isGreen={false} />
                  <StatCard label="Transaction Volume" value={Object.values(dashboard.counts).reduce((a,b)=>a+b,0)} icon={Layers} themeColor={themeColor} isGreen={isGreen} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  <ConnectionCard title="Sales Orders" count={dashboard.counts.sales_orders} total_val="View List" icon={ShoppingCart} themeColor={themeColor} onClick={() => navigate(`/salesorderlist?customer=${id}`)} />
                  <ConnectionCard title="Sales Invoices" count={dashboard.counts.sales_invoices} total_val="View List" icon={Receipt} themeColor={themeColor} onClick={() => navigate(`/salesinvoicelist?customer=${id}`)} />
                  <ConnectionCard title="Delivery Notes" count={dashboard.counts.delivery_notes} total_val="View List" icon={Package} themeColor={themeColor} onClick={() => navigate(`/deliverynotelist?customer=${id}`)} />
                  <ConnectionCard title="Payments" count={dashboard.counts.payment_entries} total_val="View List" icon={CreditCard} themeColor={themeColor} onClick={() => navigate(`/paymententrylist?customer=${id}`)} />
                </div>
              </div>
            )}

            {activeTab === 'Addresses' && (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <SectionLabel text={`Linked Addresses (${addresses.length})`} />
                </div>
                {addresses.length === 0 ? <p className="text-center py-12 text-gray-400 text-xs font-bold uppercase tracking-widest">No Addresses Linked</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {addresses.map((addr, i) => (
                      <div key={i} onClick={() => navigate(`/addresslist?name=${addr.name}`)} className="p-5 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 bg-white rounded text-[8px] font-bold uppercase text-gray-500 tracking-widest border border-gray-100">{addr.address_type}</span>
                          {addr.is_primary_address === 1 && <CheckCircle2 size={16} className="text-emerald-500" />}
                        </div>
                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-tight mb-1">{addr.address_title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed font-medium">{addr.address_line1}, {addr.city}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Contacts' && (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6 animate-in fade-in duration-500">
                <SectionLabel text={`Linked Contacts (${contacts.length})`} />
                {contacts.length === 0 ? <p className="text-center py-12 text-gray-400 text-xs font-bold uppercase tracking-widest">No Contacts Found</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {contacts.map((con, i) => (
                      <div key={i} onClick={() => navigate(`/contactlist?name=${con.name}`)} className="p-5 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-all cursor-pointer flex items-center gap-4">
                        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-xs font-bold text-gray-900 border border-gray-100">{con.first_name?.[0]}{con.last_name?.[0]}</div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight">{con.first_name} {con.last_name}</h4>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{con.designation || 'Specialist'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-6">Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Created On</span>
                  <span className="text-[11px] font-bold text-gray-900">{new Date(customer?.creation).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Status</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">ID Alias</span>
                  <span className="text-[10px] font-bold text-blue-600 font-mono italic">{customer?.name}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10">
                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Balance Due</p>
                 <div className="flex items-baseline gap-2 mb-6">
                   <span className="text-lg font-bold text-gray-500 uppercase">AED</span>
                   <h4 className="text-3xl font-black tracking-tight" style={{ color: dashboard.current_balance > 0 ? '#fca5a5' : '#86efac' }}>
                     {dashboard.current_balance?.toLocaleString()}
                   </h4>
                 </div>
                 <button onClick={() => navigate(`/ledger?party=${id}&party_type=Customer`)} className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all">Account Statement</button>
               </div>
               <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                 <TrendingUp size={100} />
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal (Standard Clean Design) */}
      {(showEditModal || isNew) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-gray-900 text-white rounded-lg shadow-md"><Edit2 size={20} /></div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">{isNew ? 'New Customer' : 'Edit Customer Profile'}</h2>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Revise Registry Specifications</p>
                </div>
              </div>
              {!isNew && <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"><X size={22} /></button>}
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12 pb-24 custom-scrollbar bg-white">
              <div className="space-y-8">
                <SectionLabel text="Registration Details" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputGroup label="Customer Name" value={form.customer_name} onChange={v => setForm({ ...form, customer_name: v })} />
                  <SelectGroup label="Customer Type" value={form.customer_type} options={meta.customer_types} onChange={v => setForm({ ...form, customer_type: v })} />
                  <SelectGroup label="Customer Group" value={form.customer_group} options={meta.customer_groups} onChange={v => setForm({ ...form, customer_group: v })} />
                  <SelectGroup label="Territory" value={form.territory} options={meta.territories} onChange={v => setForm({ ...form, territory: v })} />
                </div>
              </div>
              <div className="space-y-8">
                <SectionLabel text="Contact Hub" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <InputGroup label="Mobile No" value={form.mobile_no} onChange={v => setForm({ ...form, mobile_no: v })} placeholder="+971 -- --- ----" />
                   <InputGroup label="Email Address" value={form.email_id} onChange={v => setForm({ ...form, email_id: v })} />
                   <InputGroup label="Tax ID (TRN)" value={form.tax_id} onChange={v => setForm({ ...form, tax_id: v })} />
                   <div className="flex items-center gap-4 mt-6">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Status</label>
                      <button 
                        onClick={() => setForm({...form, disabled: form.disabled ? 0 : 1})}
                        className={`flex items-center gap-3 px-6 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${!form.disabled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                      >
                         {!form.disabled ? 'Active' : 'Disabled'}
                         <div className={`w-1.5 h-1.5 rounded-full ${!form.disabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                      </button>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between sticky bottom-0">
               <button onClick={() => isNew ? navigate('/customerlist') : setShowEditModal(false)} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest transition-colors">{isNew ? 'Cancel' : 'Discard'}</button>
               <button onClick={handleSave} disabled={saving} style={{ backgroundColor: themeColor }} className="px-10 py-3 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                 {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                 {saving ? 'Saving...' : 'Save Profile'}
               </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default CustomerDetails;
