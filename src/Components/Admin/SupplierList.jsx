// src/Components/Admin/SupplierList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Building2, ChevronLeft,
  Users, Trash2, Edit2, Filter, ChevronDown,
  Palette, Loader2, ChevronRight, Eye, Mail, Phone,
  CheckCircle, XCircle, Globe, CreditCard, ShieldCheck,
  TrendingUp, Activity, MapPin, Tag
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

/* ==================== UI COMPONENTS ==================== */
const StatusBadge = ({ isInactive }) => (
  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
    !isInactive 
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' 
      : 'bg-rose-50 text-rose-700 border border-rose-100 shadow-sm'
  }`}>
    <span className={`w-2 h-2 rounded-full mr-2 animate-pulse ${!isInactive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
    {!isInactive ? 'Operational' : 'Restricted'}
  </span>
);

const StatCard = ({ icon: Icon, label, value, trend, color, delay }) => (
  <div 
    className="bg-white rounded-[2rem] border border-gray-100/80 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-500 group relative overflow-hidden"
    style={{ animation: `fadeIn 0.6s ease-out forwards ${delay}s`, opacity: 0 }}
  >
    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-gray-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700" />
    <div className="relative z-10 flex items-center justify-between">
      <div>
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">{label}</p>
        <div className="flex items-baseline gap-3">
          <h4 className="text-3xl font-black text-gray-900 tracking-tight">{value}</h4>
          {trend && (
            <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingUp size={10} className="mr-1" />
              {trend}
            </span>
          )}
        </div>
      </div>
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
        <Icon size={24} className={color} />
      </div>
    </div>
  </div>
);

export default function SupplierList() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Theme settings
  const [slTheme, setSlTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
  const isIndigo = slTheme === 'blue';
  const primaryColor = isIndigo ? 'blue-600' : 'emerald-600';
  const primaryBg = isIndigo ? 'bg-blue-600' : 'bg-emerald-600';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', slTheme);
  }, [slTheme]);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_group: '',
    supplier_type: 'Company',
    disabled: false,
    tax_id: '',
    website: '',
    email_id: '',
    mobile_no: '',
    address: '',
    contact_person: '',
    currency: 'AED'
  });

  const [supplierGroups] = useState(['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler', 'Retailer']);

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Supplier', {
        params: {
          fields: JSON.stringify(['name', 'supplier_name', 'supplier_group', 'supplier_type', 'disabled', 'email_id', 'mobile_no', 'tax_id']),
          order_by: 'modified desc',
          limit_page_length: 1000
        },
        withCredentials: true
      });
      setSuppliers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      Swal.fire({ icon: 'error', title: 'Connection Failure', text: 'System unable to synchronize with supplier database.', borderRadius: '2rem' });
    } finally {
      setTimeout(() => setLoading(false), 500); // Visual smoothness
    }
  };

  const fetchSupplierDetails = async (name) => {
    try {
      const res = await axios.get(`/api/resource/Supplier/${name}`, { withCredentials: true });
      const data = res.data.data;
      setForm({
        supplier_name: data.supplier_name || '',
        supplier_group: data.supplier_group || '',
        supplier_type: data.supplier_type || 'Company',
        disabled: data.disabled === 1,
        tax_id: data.tax_id || '',
        website: data.website || '',
        email_id: data.email_id || '',
        mobile_no: data.mobile_no || '',
        address: data.address || '',
        contact_person: data.contact_person || '',
        currency: data.currency || 'AED'
      });
    } catch (err) {
      console.error('Failed to load details:', err);
    }
  };

  /* ==================== FILTERING ==================== */
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = filterSearch.toLowerCase();
      const matchesSearch = !filterSearch ||
        s.supplier_name?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.email_id?.toLowerCase().includes(q) ||
        s.mobile_no?.includes(filterSearch);
      
      const matchesGroup = !filterGroup || s.supplier_group === filterGroup;
      const matchesType = !filterType || s.supplier_type === filterType;
      const matchesStatus = !filterStatus || (filterStatus === 'active' ? !s.disabled : s.disabled);
      
      return matchesSearch && matchesGroup && matchesType && matchesStatus;
    });
  }, [suppliers, filterSearch, filterGroup, filterType, filterStatus]);

  const total = filteredSuppliers.length;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const stats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter(s => !s.disabled).length,
    inactive: suppliers.filter(s => s.disabled).length,
    types: [...new Set(suppliers.map(s => s.supplier_type))].length
  }), [suppliers]);

  /* ==================== ACTIONS ==================== */
  const handleSave = async () => {
    if (!form.supplier_name.trim() || !form.supplier_group) {
      Swal.fire({ icon: 'warning', title: 'Missing Metadata', text: 'Supplier Name and Group are mandatory for authorization.', borderRadius: '2rem' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        disabled: form.disabled ? 1 : 0
      };

      if (isEditMode) {
        await axios.put(`/api/resource/Supplier/${editingSupplier.name}`, payload, { withCredentials: true });
        Swal.fire({ icon: 'success', title: 'Profile Updated', text: 'Partner documentation has been successfully revised.', borderRadius: '2rem', showConfirmButton: false, timer: 2000 });
      } else {
        await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', 
          { doctype: "Supplier", data: payload }, 
          { withCredentials: true }
        );
        Swal.fire({ icon: 'success', title: 'Partner Onboarded', text: 'New supplier record initialized in the global registry.', borderRadius: '2rem', showConfirmButton: false, timer: 2000 });
      }
      handleCloseForm();
      fetchSuppliers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Process Rejected', text: err.response?.data?.message || 'Transaction failed.', borderRadius: '2rem' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    const result = await Swal.fire({
      title: 'De-register Partner?',
      text: `Are you certain you want to purge ${supplier.supplier_name}? This will archive historical mappings.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Execute Removal',
      borderRadius: '2rem'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/resource/Supplier/${supplier.name}`, { withCredentials: true });
        Swal.fire({ icon: 'success', title: 'Purged', text: 'Supplier metadata removed.', borderRadius: '2rem' });
        fetchSuppliers();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Access Denied', text: 'System restricted deletion for this entity.', borderRadius: '2rem' });
      }
    }
  };

  const handleEdit = async (supplier) => {
    setEditingSupplier(supplier);
    setIsEditMode(true);
    await fetchSupplierDetails(supplier.name);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      supplier_name: '', supplier_group: '', supplier_type: 'Company',
      disabled: false, tax_id: '', website: '', email_id: '', mobile_no: '',
      address: '', contact_person: '', currency: 'AED'
    });
    setIsEditMode(false);
    setEditingSupplier(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  /* ==================== RENDER ==================== */
  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-[#fcfdfe] pb-20 font-sans selection:bg-blue-100 selection:text-blue-900">
        
        {/* Modern Glass Header */}
        <div className="bg-white/70 backdrop-blur-xl border-b border-gray-100/80 sticky top-0 z-[40] transition-all duration-300 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.01)]">
          <div className="max-w-[1600px] mx-auto px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 ${primaryBg} rounded-xl shadow-lg shadow-blue-500/20`}>
                    <Building2 size={24} className="text-white" />
                  </div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">Suppliers</h1>
                </div>
                <p className="text-[13px] font-medium text-gray-400 pl-1">Authorized Procurement & Vendor Registry</p>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSlTheme(isIndigo ? 'emerald' : 'blue')}
                  className="px-5 py-2.5 rounded-2xl border border-gray-100 bg-white shadow-sm text-[12px] font-bold text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-all flex items-center gap-2 group"
                >
                  <Palette size={16} className="text-gray-400 group-hover:rotate-12 transition-transform" />
                  Visual Config
                </button>
                <div className="w-[1px] h-8 bg-gray-100 mx-2 hidden lg:block" />
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className={`px-8 py-3.5 ${primaryBg} text-white rounded-[1.25rem] text-[13px] font-black uppercase tracking-[0.08em] hover:shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)] flex items-center gap-3 active:scale-95 transition-all duration-300`}
                >
                  <Plus size={20} strokeWidth={3} />
                  Register Partner
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-8 py-10 space-y-10">
          
          {/* Executive Stats Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard icon={Users} label="Total Assets" value={stats.total} trend="+4.2%" color="text-blue-600" delay={0.1} />
            <StatCard icon={ShieldCheck} label="Operational" value={stats.active} color="text-emerald-600" delay={0.2} />
            <StatCard icon={Activity} label="Risk Analysis" value={stats.inactive} color="text-rose-600" delay={0.3} />
            <StatCard icon={Globe} label="Geo Diversity" value={`${stats.types} Types`} color="text-purple-600" delay={0.4} />
          </div>

          {/* Precision Filter Utility */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100/80 p-5 shadow-[0_4px_25px_rgba(0,0,0,0.02)] flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[300px] group relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Global metadata search (Name, ID, Contact...)"
                value={filterSearch}
                onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-14 pr-8 py-4 bg-[#f8fbfe] border-none rounded-[1.5rem] text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="h-10 w-[1px] bg-gray-100 mx-2" />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-3 px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all ${showFilters ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                <Filter size={18} />
                Precision Filter
                <ChevronDown size={14} className={`opacity-50 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showFilters && (
              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 mt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enterprise Group</label>
                  <select
                    value={filterGroup}
                    onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none"
                    style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center' }}
                  >
                    <option value="">All Architectures</option>
                    {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Entity Classification</label>
                  <select
                    value={filterType}
                    onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none"
                    style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center' }}
                  >
                    <option value="">All Classifications</option>
                    <option value="Company">Corporate / B2B</option>
                    <option value="Individual">Personal / B2C</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Operational Status</label>
                  <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none"
                    style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center' }}
                  >
                    <option value="">All Lifecycle States</option>
                    <option value="active">Operational Only</option>
                    <option value="inactive">Restricted Only</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Master Supplier Data Table */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100/80 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.03)] overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-40">
                <div className="relative">
                  <div className={`w-16 h-16 border-4 border-gray-100 border-t-${primaryColor} rounded-full animate-spin`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 ${primaryBg} rounded-full animate-ping opacity-20`} />
                </div>
                <p className="mt-8 text-sm font-black text-gray-400 uppercase tracking-widest">Synchronizing Core Registry</p>
              </div>
            ) : paginatedSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
                <div className="p-8 bg-gray-50 rounded-[3rem]">
                  <Building2 size={80} className="text-gray-200" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Zero Entities Matching Context</h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto font-medium">Reset your filters or register a new partner to populate this registry.</p>
                <button onClick={() => { setFilterSearch(''); setShowFilters(false); }} className="text-blue-600 font-black text-sm uppercase tracking-widest mt-4">Refresh Global Search</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fcfdfe] pt-8">
                      <th className="px-10 py-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Organization Profile</th>
                      <th className="px-10 py-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Network Metrics</th>
                      <th className="px-10 py-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Classification</th>
                      <th className="px-10 py-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Status</th>
                      <th className="px-10 py-6 text-right text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] pr-12">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50/80">
                    {paginatedSuppliers.map((supplier, idx) => (
                      <tr 
                        key={supplier.name} 
                        className="group hover:bg-[#f8fbfe]/50 transition-all duration-300"
                        style={{ animation: `fadeIn 0.5s ease-out forwards ${0.05 * idx}s`, opacity: 0 }}
                      >
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-[1.25rem] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                              <Building2 size={24} className="text-blue-500" />
                            </div>
                            <div>
                              <p 
                                onClick={() => navigate(`/supplier-details/${encodeURIComponent(supplier.name)}`)}
                                className="text-lg font-black text-gray-900 tracking-tight hover:text-blue-600 cursor-pointer transition-colors"
                              >
                                {supplier.supplier_name}
                              </p>
                              <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">{supplier.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="space-y-1.5">
                            {supplier.email_id && (
                              <div className="flex items-center gap-2.5 group/link">
                                <div className="p-1 rounded-md bg-gray-50 group-hover/link:bg-blue-50 transition-colors">
                                  <Mail size={12} className="text-gray-400 group-hover/link:text-blue-500" />
                                </div>
                                <span className="text-[13px] font-bold text-gray-600 truncate max-w-[200px]">{supplier.email_id}</span>
                              </div>
                            )}
                            {supplier.mobile_no && (
                              <div className="flex items-center gap-2.5 group/link">
                                <div className="p-1 rounded-md bg-gray-50 group-hover/link:bg-blue-50 transition-colors">
                                  <Phone size={12} className="text-gray-400 group-hover/link:text-blue-500" />
                                </div>
                                <span className="text-[13px] font-bold text-gray-600">{supplier.mobile_no}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Tag size={12} className="text-blue-400" />
                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{supplier.supplier_group || 'Uncat'}</span>
                            </div>
                            <span className="text-[13px] font-bold text-gray-700">{supplier.supplier_type} Entity</span>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <StatusBadge isInactive={supplier.disabled} />
                        </td>
                        <td className="px-10 py-6 pr-12">
                          <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                             <button
                                onClick={() => navigate(`/supplier-details/${encodeURIComponent(supplier.name)}`)}
                                className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10 rounded-2xl transition-all"
                             >
                                <Eye size={18} />
                             </button>
                             <button
                                onClick={() => handleEdit(supplier)}
                                className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-amber-600 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10 rounded-2xl transition-all"
                             >
                                <Edit2 size={18} />
                             </button>
                             <button
                                onClick={() => handleDelete(supplier)}
                                className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-rose-600 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/10 rounded-2xl transition-all"
                             >
                                <Trash2 size={18} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Premium Pagination */}
            {total > 0 && (
              <div className="px-10 py-8 bg-[#fcfdfe] border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Page Capacity</span>
                    <select
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white border border-gray-100 rounded-xl px-4 py-1.5 text-xs font-bold text-gray-600 focus:outline-none"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-3 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1 ? `${primaryBg} text-white shadow-lg shadow-blue-500/30 active:scale-95` : 'text-gray-400 hover:bg-white hover:text-gray-900'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-3 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Cluster Registry: {total} records</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Premium Onboarding / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-300">
          <div className="bg-[#fcfdfe] w-full max-w-5xl h-full lg:h-[90vh] rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500">
            
            {/* Modal Header */}
            <div className="px-12 py-10 flex justify-between items-center bg-white border-b border-gray-50/80 shrink-0 shadow-[0_5px_40px_rgba(0,0,0,0.01)]">
               <div className="flex items-center gap-6">
                  <div className={`p-4 ${primaryBg} rounded-[1.5rem] shadow-xl shadow-blue-500/20`}>
                    <Building2 size={28} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tighter leading-none">
                        {isEditMode ? 'Authorize Revision' : 'Initialize Partner'}
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-3 ml-0.5">Global Procurement Ecosystem Integration</p>
                  </div>
               </div>
               <button onClick={handleCloseForm} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-[1.5rem] text-gray-400 hover:text-gray-900 transition-all active:scale-95">
                  <X size={28} />
               </button>
            </div>

            {/* Modal Scroll Body */}
            <div className="flex-1 overflow-y-auto p-12 bg-[#fcfdfe]">
               <div className="max-w-4xl mx-auto space-y-12 pb-20">
                  
                  {/* Section 1: Core Specifications */}
                  <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100/60 shadow-[0_15px_60px_-15px_rgba(0,0,0,0.02)] space-y-10 group/section hover:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.04)] transition-all duration-700">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            <div className={`w-3 h-8 ${primaryBg} rounded-full`} />
                            Registry Identification
                        </h3>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-2xl">
                             <ShieldCheck size={16} className="text-blue-500" />
                             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Verified Schema</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Legal Organization Name *</label>
                        <input 
                          type="text" 
                          value={form.supplier_name} 
                          onChange={e => setForm({...form, supplier_name: e.target.value})}
                          placeholder="Corporate Entity Title"
                          className="w-full px-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base placeholder:text-gray-200 focus:ring-4 focus:ring-blue-600/5 transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Ecobomic Activity Group *</label>
                        <select 
                          value={form.supplier_group} 
                          onChange={e => setForm({...form, supplier_group: e.target.value})}
                          className="w-full px-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-600/5 transition-all cursor-pointer appearance-none outline-none"
                          style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
                        >
                          <option value="">Functional Cluster</option>
                          {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Operational Structure</label>
                        <div className="flex items-center gap-10 pl-1 pt-1">
                          {['Company', 'Individual'].map(type => (
                            <label key={type} className="flex items-center gap-4 cursor-pointer group/radio">
                              <div className="relative flex items-center justify-center">
                                <input 
                                  type="radio" 
                                  name="supplier_type" 
                                  value={type}
                                  checked={form.supplier_type === type}
                                  onChange={e => setForm({...form, supplier_type: e.target.value})}
                                  className="peer appearance-none w-7 h-7 border-2 border-gray-200 rounded-full checked:border-blue-600 transition-all duration-300"
                                />
                                <div className="absolute w-3 h-3 bg-blue-600 rounded-full opacity-0 peer-checked:opacity-100 peer-checked:scale-125 transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                              </div>
                              <span className="text-sm font-black text-gray-500 group-hover/radio:text-gray-900 transition-colors uppercase tracking-widest">{type === 'Company' ? 'Enterprise' : 'Proprietor'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Global Tax Registry (TRN)</label>
                        <input 
                          type="text" 
                          value={form.tax_id} 
                          onChange={e => setForm({...form, tax_id: e.target.value})}
                          placeholder="Standard TRN / VAT ID"
                          className="w-full px-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base placeholder:text-gray-200 focus:ring-4 focus:ring-blue-600/5 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Contact & Logistics */}
                  <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100/60 shadow-[0_15px_60px_-15px_rgba(0,0,0,0.02)] space-y-10 hover:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.04)] transition-all duration-700">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                      <div className={`w-3 h-8 ${primaryBg} rounded-full`} />
                      Global Logistics & Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Communication Channel (Email)</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input 
                                type="email" 
                                value={form.email_id} 
                                onChange={e => setForm({...form, email_id: e.target.value})}
                                placeholder="protocol@organization.com"
                                className="w-full pl-16 pr-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base placeholder:text-gray-200 focus:ring-4 focus:ring-blue-600/5 transition-all"
                            />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Encrypted Line (Mobile)</label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input 
                                type="text" 
                                value={form.mobile_no} 
                                onChange={e => setForm({...form, mobile_no: e.target.value})}
                                placeholder="+971 XX XXX XXXX"
                                className="w-full pl-16 pr-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base placeholder:text-gray-200 focus:ring-4 focus:ring-blue-600/5 transition-all"
                            />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Registered HQ / Logistics Hub</label>
                        <div className="relative">
                            <MapPin size={18} className="absolute left-6 top-6 text-gray-300" />
                            <textarea 
                                rows={4}
                                value={form.address} 
                                onChange={e => setForm({...form, address: e.target.value})}
                                placeholder="HQ Address, District, Global Region..."
                                className="w-full pl-16 pr-6 py-6 bg-gray-50/50 border-none rounded-[2rem] font-bold text-gray-800 text-base placeholder:text-gray-200 focus:ring-4 focus:ring-blue-600/5 transition-all resize-none"
                            />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Financial Framework */}
                  <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100/60 shadow-[0_15px_60px_-15px_rgba(0,0,0,0.02)] space-y-10 hover:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.04)] transition-all duration-700">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                      <div className={`w-3 h-8 ${primaryBg} rounded-full`} />
                      Financial Protocols
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Primary Liquidity Currency</label>
                        <div className="relative">
                            <CreditCard size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" />
                            <select 
                                value={form.currency} 
                                onChange={e => setForm({...form, currency: e.target.value})}
                                className="w-full pl-16 pr-6 py-4 bg-gray-50/50 border-none rounded-[1.5rem] font-bold text-gray-800 text-base focus:ring-4 focus:ring-blue-600/5 transition-all appearance-none"
                                style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg%20width%3D"14"%20height%3D"14"%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"><path%20d%3D"m3%205%204%204%204-4"%20fill%3D"none"%20stroke%3D"%23cbd5e1"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"%2F><%2Fsvg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
                            >
                                <option value="AED">AED - United Arab Emirates Dirham</option>
                                <option value="USD">USD - United States Dollar</option>
                                <option value="EUR">EUR - Euro Currency</option>
                            </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pl-1">Entity Lifecycle Override</label>
                        <div 
                          onClick={() => setForm({...form, disabled: !form.disabled})}
                          className={`flex items-center justify-between px-6 py-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 ${!form.disabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                        >
                            <span className="text-sm font-black uppercase tracking-widest">{!form.disabled ? 'Active Protocol' : 'Restricted Access'}</span>
                            <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${!form.disabled ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${!form.disabled ? 'left-7' : 'left-1'}`} />
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>

               </div>
            </div>

            {/* Premium Modal Footer */}
            <div className="px-12 py-10 border-t border-gray-50 flex justify-end items-center gap-6 shrink-0 bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.03)]">
              <button
                onClick={handleCloseForm}
                className="px-10 py-4 text-xs font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-900 hover:bg-gray-50 rounded-[1.25rem] transition-all"
              >
                Discard Draft
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-12 py-4 ${primaryBg} text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.15em] flex items-center gap-4 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 active:scale-95 transition-all duration-300 disabled:opacity-50`}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={3} />}
                {saving ? 'Synchronizing Data...' : (isEditMode ? 'Authorize Revision' : 'Confirm Registration')}
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
}