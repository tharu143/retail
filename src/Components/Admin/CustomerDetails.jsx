import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, MapPin, Phone, Mail, ChevronLeft, Loader2,
  AlertCircle, Globe, Tag, Receipt, Layers, ShoppingCart,
  ArrowRight, Settings, Edit2, Save, X, Package, CreditCard,
  ShieldCheck, Activity, TrendingUp, Calendar, Hash, FileText,
  Search, Filter, Lock, Unlock, AlertTriangle, CheckSquare, Square,
  User, CheckCircle2, Clock, Zap
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

const API_BASE = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { themeColor, themeLight } = useLegacyTheme();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Intelligence');
  const [showEditModal, setShowEditModal] = useState(false);

  // Data States
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [meta, setMeta] = useState({
    customer_types: ['Individual', 'Company'],
    customer_groups: [],
    territories: [],
    emirates: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Fujairah', 'Ras Al Khaimah', 'Umm Al Quwain'],
    address_types: ['Billing', 'Shipping', 'Office', 'Personal', 'Plant', 'Postal', 'Shop', 'Subsidiary', 'Warehouse', 'Current', 'Permanent', 'Other']
  });

  // Form State for Create/Edit
  const [form, setForm] = useState({
    customer_name: '',
    customer_type: 'Individual',
    customer_group: 'All Customer Groups',
    territory: 'All Territories',
    mobile_no: '',
    email_id: '',
    tax_id: '',
    // Primary Address
    address_line1: '',
    address_line2: '',
    city: '',
    emirate: '',
    country: 'United Arab Emirates',
    address_type: 'Billing',
    // Primary Contact
    first_name: '',
    last_name: '',
    contact_email: '',
    contact_mobile: ''
  });

  useEffect(() => {
    fetchMeta();
    if (!isNew) {
      fetchCustomerData();
    }
  }, [id]);

  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${API_BASE}.get_customer_meta_options`);
      if (res.data.message) {
        setMeta(prev => ({ ...prev, ...res.data.message }));
      }
    } catch (err) {
      console.error("Meta fetch failed", err);
    }
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_details`, {
        params: { customer_id: id }
      });
      const { customer: cust, addresses: addr, contacts: cont } = res.data.message.data;
      setCustomer(cust);
      setAddresses(addr || []);
      setContacts(cont || []);

      // Populate form for editing
      const primaryAddr = addr?.find(a => a.is_primary_address) || addr?.[0] || {};
      const primaryCont = cont?.find(c => c.is_primary_contact) || cont?.[0] || {};

      setForm({
        customer_name: cust.customer_name || '',
        customer_type: cust.customer_type || 'Individual',
        customer_group: cust.customer_group || 'All Customer Groups',
        territory: cust.territory || 'All Territories',
        mobile_no: cust.mobile_no || '',
        email_id: cust.email_id || '',
        tax_id: cust.tax_id || '',
        address_line1: primaryAddr.address_line1 || '',
        address_line2: primaryAddr.address_line2 || '',
        city: primaryAddr.city || '',
        emirate: primaryAddr.emirate || '',
        country: primaryAddr.country || 'United Arab Emirates',
        address_type: primaryAddr.address_type || 'Billing',
        first_name: primaryCont.first_name || '',
        last_name: primaryCont.last_name || '',
        contact_email: primaryCont.email_id || '',
        contact_mobile: primaryCont.mobile_no || ''
      });
    } catch (err) {
      Swal.fire('Error', 'Failed to retrieve neural customer profile', 'error');
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleSave = async () => {
    if (!form.customer_name) return Swal.fire('Error', 'Target Name is mandatory', 'error');

    try {
      setSaving(true);
      const payload = {
        customer_data: {
          name: isNew ? undefined : id,
          customer_name: form.customer_name,
          customer_type: form.customer_type,
          customer_group: form.customer_group,
          territory: form.territory,
          mobile_no: form.mobile_no,
          email_id: form.email_id,
          tax_id: form.tax_id
        },
        address_data: {
          address_type: form.address_type,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          emirate: form.emirate,
          country: form.country
        },
        contact_data: {
          first_name: form.first_name || form.customer_name,
          last_name: form.last_name,
          mobile_no: form.contact_mobile || form.mobile_no,
          email_id: form.contact_email || form.email_id
        }
      };

      const res = await axios.post(`${API_BASE}.save_customer_details`, payload);

      if (res.data.message?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Profile Synchronized',
          text: `Customer profile ${isNew ? 'initialized' : 'updated'} in the central matrix.`,
          confirmButtonColor: themeColor
        });
        if (isNew) {
          navigate(`/customer-details/${res.data.message.customer_name}`);
        } else {
          setShowEditModal(false);
          fetchCustomerData();
        }
      } else {
        throw new Error(res.data.message?.message || "Sync failed");
      }
    } catch (err) {
      Swal.fire('Sync Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Calibrating Profile Matrix...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">

      {/* Dynamic Header Shard */}
      <div className="bg-white border-b border-gray-100 px-8 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/customerlist')}
              className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-900 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="h-14 w-14 bg-blue-600 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-blue-200">
              <User size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  {isNew ? 'Initialize Customer' : customer?.customer_name}
                </h1>
                {!isNew && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${customer?.disabled === 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                    {customer?.disabled === 0 ? 'Active Stream' : 'Offline'}
                  </span>
                )}
              </div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
                {isNew ? 'New Entry Discovery' : `Identity Ref: ${customer?.name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isNew ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-black hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <Edit2 size={14} /> Refine Profile
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Execute Genesis'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Command Console */}
      <div className="max-w-7xl mx-auto mt-12 px-8">
        {/* Navigation Shard */}
        <div className="flex items-center gap-1 mb-10 bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm w-fit">
          {['Intelligence', 'Geospatial', 'Transactions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Central Intel Core */}
          <div className="lg:col-span-2 space-y-10">
            {activeTab === 'Intelligence' && (
              <>
                {/* Identity Matrix */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-900 tracking-widest uppercase flex items-center gap-4">
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColor }} />
                      Identity Matrix
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <InfoShard label="Legal Entity Classification" value={customer?.customer_type} icon={Building2} />
                    <InfoShard label="Strategic Collective" value={customer?.customer_group} icon={Layers} />
                    <InfoShard label="Territorial Assignment" value={customer?.territory} icon={Globe} />
                    <InfoShard label="Tax Protocol Index" value={customer?.tax_id || 'Not Registered'} icon={FileText} />
                  </div>
                </div>

                {/* Primary Connection Gate */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
                  <h3 className="text-xs font-black text-gray-900 tracking-widest uppercase flex items-center gap-4">
                    <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColor }} />
                    Neural Communication Mesh
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <ContactCard label="Voice Mesh" value={customer?.mobile_no} icon={Phone} />
                    <ContactCard label="Digital Vector" value={customer?.email_id} icon={Mail} />
                    <ContactCard label="Authorized Rep" value={contacts?.[0]?.full_name} icon={Users} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'Geospatial' && (
              <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
                <h3 className="text-xs font-black text-gray-900 tracking-widest uppercase flex items-center gap-4">
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColor }} />
                  Registered Vector Grid (Addresses)
                </h3>
                {addresses.length === 0 ? (
                  <div className="py-20 text-center space-y-4 bg-gray-50 rounded-[2rem]">
                    <MapPin size={40} className="mx-auto text-gray-200" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Geospatial Shards Detected</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {addresses.map((addr, idx) => (
                      <div key={idx} className="p-6 bg-gray-50 rounded-[2rem] border border-transparent hover:border-gray-200 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[8px] font-black uppercase text-gray-500 tracking-widest">
                            {addr.address_type}
                          </div>
                          {addr.is_primary_address === 1 && <CheckCircle2 size={16} className="text-emerald-500" />}
                        </div>
                        <p className="text-sm font-bold text-gray-900 tracking-tight leading-relaxed">
                          {addr.address_line1}, {addr.address_line2 && `${addr.address_line2}, `} {addr.city}, {addr.emirate}, {addr.country}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Transactions' && (
              <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-900 tracking-widest uppercase flex items-center gap-4">
                    <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColor }} />
                    Transaction Hub
                  </h3>
                  <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View Analytics Stream</button>
                </div>
                <div className="py-20 text-center space-y-4 bg-gray-50 rounded-[2rem]">
                  <Activity size={40} className="mx-auto text-gray-200" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Recent Transaction Shards Recorded</p>
                </div>
              </div>
            )}
          </div>

          {/* Side Intel Shard */}
          <div className="space-y-10">
            <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
              <h3 className="text-xs font-black text-gray-900 tracking-widest uppercase flex items-center gap-4">
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColor }} />
                Executive Summary
              </h3>
              <div className="space-y-6">
                <SummaryItem label="Relationship Age" value="Direct Entry" icon={Calendar} />
                <SummaryItem label="System Index" value={customer?.name || 'QUEUED'} icon={Hash} />
                <SummaryItem
                  label="Auth Status"
                  value={customer?.is_active ? 'High Confidence' : 'Restricted'}
                  icon={ShieldCheck}
                />
              </div>
            </div>

            <div className="p-10 rounded-[3rem] bg-gray-900 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp size={120} />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Lifetime Vector Value</p>
                <h4 className="text-4xl font-black tracking-tight mb-8">AED 0.00</h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-t border-white/10 pt-4">
                    <span>Order Velocity</span>
                    <span className="text-gray-400">0 Items</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit / Create Genesis Modal */}
      {(showEditModal || isNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 text-slate-800 rounded-2xl">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{isNew ? 'Initialize Genesis Record' : 'Refine Customer Shards'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Matrix Revision Protocol</p>
                </div>
              </div>
              {!isNew && (
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-all">
                  <X size={24} className="text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-12 pb-24 custom-scrollbar">
              {/* Core Specifications */}
              <div className="space-y-8">
                <SectionLabel text="Core Identity Specifications" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputGroup label="Target Customer Name" value={form.customer_name} onChange={v => setForm({ ...form, customer_name: v })} placeholder="Enter Legal Entity Name" />
                  <SelectGroup label="Identity Classification" value={form.customer_type} options={meta.customer_types} onChange={v => setForm({ ...form, customer_type: v })} />
                  <SelectGroup label="Strategic Collective" value={form.customer_group} options={meta.customer_groups} onChange={v => setForm({ ...form, customer_group: v })} />
                  <SelectGroup label="Territorial Index" value={form.territory} options={meta.territories} onChange={v => setForm({ ...form, territory: v })} />
                </div>
              </div>

              {/* Communication Bridge */}
              <div className="space-y-8">
                <SectionLabel text="Global Communication Channels" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputGroup label="Primary Mobile Lattice" value={form.mobile_no} onChange={v => setForm({ ...form, mobile_no: v })} placeholder="+971 -- --- ----" />
                  <InputGroup label="Primary Digital Mesh" value={form.email_id} onChange={v => setForm({ ...form, email_id: v })} placeholder="entity@neural.link" />
                </div>
              </div>

              {/* Geospatial Index */}
              <div className="space-y-8">
                <SectionLabel text="Geospatial Indexing (Primary Address)" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <InputGroup label="Primary Vector Line 1" value={form.address_line1} onChange={v => setForm({ ...form, address_line1: v })} />
                  </div>
                  <InputGroup label="Postal/City Metrix" value={form.city} onChange={v => setForm({ ...form, city: v })} />
                  <SelectGroup label="Federal Emirate" value={form.emirate} options={meta.emirates} onChange={v => setForm({ ...form, emirate: v })} />
                </div>
              </div>
            </div>

            <div className="px-10 py-8 border-t border-gray-100 bg-gray-50 flex items-center justify-between sticky bottom-0">
              {!isNew && (
                <button onClick={() => setShowEditModal(false)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard Revisions</button>
              )}
              {isNew && (
                <button onClick={() => navigate('/customerlist')} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Abort Genesis</button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: themeColor }}
                className="px-10 py-4 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {saving ? 'Syncing Matrix...' : 'Commit to Neural Mesh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Internal UI Utility Shards */
const InfoShard = ({ label, value, icon: Icon }) => (
  <div className="space-y-2 group">
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-blue-600 transition-colors">
      <Icon size={12} />
      {label}
    </p>
    <p className="text-sm font-black text-gray-800 tracking-tight">{value || 'UNSPECIFIED'}</p>
  </div>
);

const ContactCard = ({ label, value, icon: Icon }) => (
  <div className="p-6 bg-gray-50 rounded-[2rem] space-y-2 group hover:bg-slate-900 transition-all duration-300">
    <Icon size={16} className="text-gray-400 group-hover:text-white transition-colors" />
    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-500">{label}</p>
    <p className="text-xs font-black text-slate-900 group-hover:text-white truncate transition-colors">{value || 'NULL'}</p>
  </div>
);

const SummaryItem = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all">
    <div className="p-2 bg-gray-50 text-gray-400 rounded-lg">
      <Icon size={14} />
    </div>
    <div>
      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-[11px] font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  </div>
);

const SectionLabel = ({ text }) => (
  <div className="flex items-center gap-4">
    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">{text}</h4>
    <div className="h-px w-full bg-slate-100" />
  </div>
);

const InputGroup = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-[13px] font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600/30 focus:shadow-sm transition-all"
    />
  </div>
);

const SelectGroup = ({ label, value, options, onChange }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-[13px] font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600/30 focus:shadow-sm transition-all appearance-none cursor-pointer"
    >
      {options?.map(opt => <option key={opt.name || opt} value={opt.name || opt}>{opt.label || opt.name || opt}</option>)}
    </select>
  </div>
);

export default CustomerDetails;
