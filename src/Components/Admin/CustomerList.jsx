import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, Contact
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SalesOrder.css';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

function CustomerList() {
  const { themeColor, themeLight, isGreen, toggleTheme, legacySubTheme } = useLegacyTheme();
  
  // View States
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  
  // Data States
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterSearch, setFilterSearch] = useState('');
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('Information');
  const [dashboardData, setDashboardData] = useState({ 
    counts: { sales_orders: 0, sales_invoices: 0, delivery_notes: 0, payment_entries: 0, quotations: 0 }, 
    current_balance: 0 
  });
  
  const [meta, setMeta] = useState({
    customer_group: [], territory: [], customer_type: ['Individual', 'Company'],
    salutations: [], address_type: [], emirates: [], countries: [],
    price_lists: [], tax_categories: [], payment_terms: [], loyalty_programs: []
  });

  // EXHAUSTIVE FORM STATE (Matches all requested fields for Create & Edit)
  const [form, setForm] = useState({
    customer_name: '', mobile_no: '', email_id: '', salutation: '',
    customer_type: 'Individual', customer_group: 'All Customer Groups',
    territory: 'All Territories', gender: '', tax_id: '',
    account_manager: '', prospect_name: '', image: '',
    default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
    customer_details: '', tax_category: '', payment_terms: '',
    loyalty_program: '', loyalty_program_tier: '',
    disabled: 0, is_frozen: 0,
    // Spatial Coordinate (Address)
    address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
    // Personnel Profile (Primary Contact)
    first_name: '', middle_name: '', last_name: '', designation: '', 
    contact_email: '', contact_mobile: '', status: 'Passive'
  });

  const [saving, setSaving] = useState(false);

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    fetchCustomers();
    fetchMeta();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customers_list`, { params: { order_by: 'modified desc' } });
      setCustomers(res.data.message?.data || []);
    } catch (err) { console.error('List failed', err); }
    finally { setLoading(false); }
  };

  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${API_BASE}.get_customer_meta_options`);
      const data = res.data.message?.data;
      if (data) setMeta(prev => ({ ...prev, ...data }));
    } catch (err) { console.error('Meta failed', err); }
  };

  const fetchFullDetails = async (id) => {
    try {
      const [detailRes, dashRes] = await Promise.all([
        axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } }),
        axios.get(`${API_BASE}.get_customer_dashboard_data`, { params: { customer_id: id } })
      ]);
      
      const data = detailRes.data.message?.data;
      if (data) {
        setSelectedCustomer({
          ...data.customer,
          addresses: data.addresses || [],
          contacts: data.contacts || []
        });
      }
      if (dashRes.data.message?.success) setDashboardData(dashRes.data.message.data);
    } catch (err) { console.error('Detail fetch failed', err); }
  };

  /* ────────────────────── ACTIONS ────────────────────── */
  const handleCustomerClick = (c) => {
    const id = c.name || c.value;
    setSelectedCustomer({ customer_name: c.customer_name || c.label, name: id });
    setView('detail');
    setActiveDetailTab('Information');
    fetchFullDetails(id);
  };

  const openAddModal = () => {
    setModalMode('create');
    setForm({
      customer_name: '', mobile_no: '', email_id: '', salutation: '',
      customer_type: 'Individual', customer_group: 'All Customer Groups',
      territory: 'All Territories', gender: '', tax_id: '',
      account_manager: '', prospect_name: '', image: '',
      default_price_list: '', is_internal_customer: 0, customer_pos_id: '',
      customer_details: '', tax_category: '', payment_terms: '',
      loyalty_program: '', loyalty_program_tier: '',
      disabled: 0, is_frozen: 0,
      address_type: 'Billing', address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
      first_name: '', middle_name: '', last_name: '', designation: '', 
      contact_email: '', contact_mobile: '', status: 'Passive'
    });
    setShowModal(true);
  };

  const openEditModal = () => {
    if (!selectedCustomer) return;
    setModalMode('edit');
    const addr = selectedCustomer.addresses?.[0] || {};
    const cont = selectedCustomer.contacts?.[0] || {};
    setForm({
      customer_name: selectedCustomer.customer_name || '',
      mobile_no: selectedCustomer.mobile_no || '',
      email_id: selectedCustomer.email_id || '',
      salutation: selectedCustomer.salutation || '',
      customer_type: selectedCustomer.customer_type || 'Individual',
      customer_group: selectedCustomer.customer_group || 'All Customer Groups',
      territory: selectedCustomer.territory || 'All Territories',
      gender: selectedCustomer.gender || '',
      tax_id: selectedCustomer.tax_id || '',
      account_manager: selectedCustomer.account_manager || '',
      prospect_name: selectedCustomer.prospect_name || '',
      image: selectedCustomer.image || '',
      default_price_list: selectedCustomer.default_price_list || '',
      is_internal_customer: selectedCustomer.is_internal_customer || 0,
      customer_pos_id: selectedCustomer.customer_pos_id || '',
      customer_details: selectedCustomer.customer_details || '',
      tax_category: selectedCustomer.tax_category || '',
      payment_terms: selectedCustomer.payment_terms || '',
      loyalty_program: selectedCustomer.loyalty_program || '',
      loyalty_program_tier: selectedCustomer.loyalty_program_tier || '',
      disabled: selectedCustomer.disabled || 0,
      is_frozen: selectedCustomer.is_frozen || 0,
      // Address Shard
      address_type: addr.address_type || 'Billing',
      address_line1: addr.address_line1 || '',
      address_line2: addr.address_line2 || '',
      city: addr.city || '',
      emirate: addr.state || addr.emirate || '',
      country: addr.country || 'United Arab Emirates',
      // Personnel Profile
      first_name: cont.first_name || '',
      middle_name: cont.middle_name || '',
      last_name: cont.last_name || '',
      designation: cont.designation || '',
      contact_email: cont.email_id || '',
      contact_mobile: cont.mobile_no || '',
      status: cont.status || 'Passive'
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.customer_name) return Swal.fire('Error', 'Legal Identity Name is required', 'warning');
    setSaving(true);
    try {
      const payload = {
        customer_data: { 
          ...form, 
          name: modalMode === 'edit' ? selectedCustomer.name : undefined 
        },
        address_data: form.address_line1 ? {
          address_type: form.address_type,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          state: form.emirate,
          country: form.country
        } : null,
        contact_data: form.first_name ? {
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name,
          email_id: form.contact_email,
          mobile_no: form.contact_mobile,
          designation: form.designation,
          status: form.status,
          is_primary_contact: 1
        } : null
      };
      
      const res = await axios.post(`${API_BASE}.save_customer_details_retail`, payload);
      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Neural Matrix Sync Complete', confirmButtonColor: themeColor, text: 'Identity registry updated.' });
        setShowModal(false);
        if (view === 'detail') fetchFullDetails(selectedCustomer.name);
        fetchCustomers();
      } else throw new Error(res.data.message?.message);
    } catch (err) { Swal.fire('Sync Failure', err.message, 'error'); }
    finally { setSaving(false); }
  };

  /* ────────────────────── DATA COMPUTE ────────────────────── */
  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = filterSearch.toLowerCase();
      const name = (c.customer_name || c.label || '').toLowerCase();
      const id = (c.name || c.value || '').toLowerCase();
      return !filterSearch || name.includes(q) || id.includes(q);
    });
  }, [customers, filterSearch]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  /* ────────────────────── STYLES ────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.975); } to { opacity: 1; transform: scale(1); } }
        .p-modal { position: fixed; inset: 0; z-index: 2000; background: #fff; display: flex; flex-direction: column; animation: scaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .m-header { height: 90px; padding: 0 50px; border-bottom: 2px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
        .m-body { flex: 1; overflow-y: auto; padding: 60px 80px; background: #fff; }
        .m-footer { height: 100px; padding: 0 50px; background: #fdfdfd; border-top: 2px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
        .f-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px 60px; }
        .f-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px; display: block; }
        .f-input, .f-select { width: 100%; height: 56px; padding: 0 20px; border: 2.5px solid #e2e8f0; border-radius: 16px; font-size: 16px; font-weight: 800; color: #0f172a; background: #fff; transition: all 0.25s; }
        .f-input:focus { outline: none; border-color: ${themeColor}; background: #fff; box-shadow: 0 0 0 6px ${themeColor}12; }
        .f-input:disabled { background: #f8fafc; color: #cbd5e1; font-family: 'DM Mono', monospace; font-size: 13px; }
        .section-label { display: flex; align-items: center; gap: 20px; margin: 60px 0 40px; }
        .section-label-text { font-size: 14px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em; white-space: nowrap; }
        .tab-btn { padding: 1.5rem 0; font-size: 13px; font-weight: 900; text-transform: uppercase; color: #94a3b8; border-bottom: 3px solid transparent; transition: 0.2s; cursor: pointer; background: none; }
        .tab-btn.active { color: #0f172a; border-bottom-color: ${themeColor}; }
        @media (max-width: 1200px) { .f-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 768px) { .f-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="animate-in fade-in duration-500">
           <div style={{ padding: '3rem 4rem', background: '#fff' }}>
             <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem', tracking: '-0.04em' }}>
                    <Users size={40} style={{ color: themeColor }} /> Identity Shards
                  </h1>
                  <p style={{ fontSize: '14px', fontWeight: 900, color: '#94a3b8', marginTop: '6px' }}>{filtered.length} NEURAL ENTITIES REGISTERED</p>
               </div>
               <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <button onClick={toggleTheme} style={{ height: '56px', padding: '0 1.5rem', borderRadius: '16px', border: '2px solid #e2e8f0', background: '#fff', color: themeColor, fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <Palette size={18} /> {legacySubTheme.toUpperCase()}
                  </button>
                  <button 
                    onClick={openAddModal}
                    style={{ height: '56px', padding: '0 2rem', borderRadius: '16px', background: themeColor, color: '#fff', border: 'none', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', shadow: `0 10px 25px ${themeColor}40` }}
                  >
                    <Plus size={22} /> Forge Identity
                  </button>
               </div>
             </div>
           </div>

           <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 4rem 4rem' }}>
              <div style={{ position: 'relative', marginBottom: '3rem' }}>
                <Search size={28} style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                <input 
                  style={{ width: '100%', height: '80px', borderRadius: '1.5rem', border: '3px solid #e2e8f0', paddingLeft: '5rem', fontSize: '1.35rem', background: '#fff', fontWeight: 900, outline: 'none' }} 
                  placeholder="Matrix Probe (Search Name, Key, Signal)..." 
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                />
              </div>

              <div style={{ background: '#fff', borderRadius: '2rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table className="so-table">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '1.75rem 3rem' }}>Identity Profile</th>
                      <th>Signal Hub</th>
                      <th>Shard Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '100px' }}><Loader2 size={48} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} /></td></tr>
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '150px', color: '#cbd5e1', fontWeight: 950, fontSize: '20px' }}>NO ASSETS MATCH THE PROBE QUERY</td></tr>
                    ) : (
                      paginated.map(c => (
                        <tr key={c.name || c.value} onClick={() => handleCustomerClick(c)} style={{ cursor: 'pointer', transition: '0.2s' }}>
                          <td style={{ padding: '1.75rem 3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserCircle2 size={32} />
                              </div>
                              <div>
                                <p style={{ fontWeight: 900, color: '#0f172a', fontSize: '1.2rem', tracking: '-0.02em' }}>{c.customer_name || c.label}</p>
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>{c.customer_group}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 900, color: '#334155' }}>{c.mobile || c.mobile_no || 'SIGNAL-OFF'}</span>
                              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800 }}>{c.email || c.email_id || 'NULL-NODE'}</span>
                            </div>
                          </td>
                          <td><span style={{ fontWeight: 950, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '5px 12px', borderRadius: '8px', fontSize: '12px' }}>{c.name || c.value}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {!loading && filtered.length > 0 && (
                  <div style={{ padding: '2rem 4rem', background: '#f8fafc', borderTop: '2.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '12px', fontWeight: 950, color: '#64748b' }}>SYNCHRONIZED SHARD COUNT: {filtered.length}</span>
                     <div style={{ display: 'flex', gap: '1rem' }}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="so-page-btn" style={{ padding: '0.75rem 1.5rem' }}>PREV</button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="so-page-btn" style={{ padding: '0.75rem 1.5rem' }}>NEXT</button>
                     </div>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* ────────────────────── EXHAUSTIVE DETAIL EXPLORER ────────────────────── */}
      {view === 'detail' && selectedCustomer && (
        <div style={{ background: '#fff', minHeight: '100vh', animation: 'scaleUp 0.4s ease' }}>
           <div style={{ background: '#0f172a', padding: '5rem 5rem 4rem', color: '#fff' }}>
             <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '4rem' }}>
                   <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.06)', height: '72px', width: '72px', borderRadius: '24px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                     <ArrowLeft size={36} />
                   </button>
                   <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        <span style={{ background: themeColor, color: '#fff', padding: '0.4rem 1.25rem', borderRadius: '12px', fontSize: '11px', fontWeight: 950, textTransform: 'uppercase' }}>{selectedCustomer.customer_group}</span>
                        <div style={{ height: '8px', width: '8px', borderRadius: '50%', background: !selectedCustomer.disabled ? '#10b981' : '#ef4444', boxShadow: !selectedCustomer.disabled ? '0 0 12px #10b981' : 'none' }} />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>MATRIX_ID: {selectedCustomer.name}</span>
                      </div>
                      <h1 style={{ fontSize: '4rem', fontWeight: 950, letterSpacing: '-0.05em', lineHeight: 1 }}>{selectedCustomer.customer_name}</h1>
                      <div style={{ display: 'flex', gap: '3rem', marginTop: '1.5rem', opacity: 0.5, fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                         <span style={{ display: 'flex', gap: '8px' }}><Smartphone size={14} /> Signal: {selectedCustomer.mobile_no || 'OFFLINE'}</span>
                         <span style={{ display: 'flex', gap: '8px' }}><Award size={14} /> Loyalty: {selectedCustomer.loyalty_program || 'NULL'}</span>
                         <span style={{ display: 'flex', gap: '8px' }}><Briefcase size={14} /> POS: {selectedCustomer.customer_pos_id || 'LOCAL-AUT'}</span>
                      </div>
                   </div>
                </div>
                <button 
                  onClick={openEditModal}
                  style={{ height: '72px', padding: '0 3.5rem', background: themeColor, borderRadius: '24px', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', shadow: `0 15px 40px ${themeColor}60` }}
                >
                  <Edit2 size={24} /> Revise Portfolio
                </button>
             </div>
           </div>

           <div style={{ sticky: 'top', top: 0, zIndex: 10, background: '#fff', borderBottom: '3px solid #f1f5f9' }}>
              <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 5rem', display: 'flex', gap: '5rem' }}>
                {['Information', 'Dashboard', 'Geospatial', 'Personnel'].map(tab => (
                   <button key={tab} className={`tab-btn ${activeDetailTab === tab ? 'active' : ''}`} onClick={() => setActiveDetailTab(tab)}>{tab}</button>
                ))}
              </div>
           </div>

           <div style={{ maxWidth: '1600px', margin: '4rem auto', padding: '0 5rem 6rem' }}>
              {activeDetailTab === 'Information' && (
                <div className="animate-in fade-in duration-700">
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4rem' }}>
                      <DetailCard title="Registry Shard Specs">
                        <DataInfo label="Entity Shard Type" value={selectedCustomer.customer_type} icon={Building2} />
                        <DataInfo label="Identity Salutation" value={selectedCustomer.salutation} icon={User} />
                        <DataInfo label="Market Segment" value={selectedCustomer.customer_group} icon={Layers} />
                        <DataInfo label="Territorial Hub" value={selectedCustomer.territory} icon={Globe} />
                        <DataInfo label="Account Supervisor" value={selectedCustomer.account_manager} icon={Briefcase} />
                        <DataInfo label="Prospect Identity" value={selectedCustomer.prospect_name} icon={Award} />
                      </DetailCard>
                      <DetailCard title="Fiscal & Logic Parameters">
                        <DataInfo label="Fiscal Hub (Tax ID)" value={selectedCustomer.tax_id} icon={Hash} />
                        <DataInfo label="Tax Classification" value={selectedCustomer.tax_category} icon={Percent} />
                        <DataInfo label="Pricing Matrix" value={selectedCustomer.default_price_list} icon={DollarSign} />
                        <DataInfo label="Payment Protocol" value={selectedCustomer.payment_terms} icon={Clock} />
                        <DataInfo label="Internal Shard" value={selectedCustomer.is_internal_customer ? 'YES' : 'NO'} icon={ShieldCheck} />
                        <DataInfo label="Loyalty Tier" value={selectedCustomer.loyalty_program_tier} icon={Award} color="#f59e0b" />
                      </DetailCard>
                      <DetailCard title="Signal Connectivity">
                        <DataInfo label="Mobile Signal" value={selectedCustomer.mobile_no} icon={Smartphone} />
                        <DataInfo label="Digital Hub (Email)" value={selectedCustomer.email_id} icon={Mail} />
                        <DataInfo label="Gender Profile" value={selectedCustomer.gender} icon={User} />
                        <DataInfo label="Identity Profile Pic" value={selectedCustomer.image ? 'LINKED' : 'NOT DETECTED'} icon={ImageIcon} />
                        <DataInfo label="Account Status" value={selectedCustomer.disabled ? 'RESTRICTED' : 'OPERATIONAL'} icon={Activity} color={selectedCustomer.disabled ? '#ef4444' : '#10b981'} />
                        <DataInfo label="Global Sync" value={selectedCustomer.is_frozen ? 'FROZEN' : 'ACTIVE'} icon={Shield} color={selectedCustomer.is_frozen ? '#ef4444' : '#10b981'} />
                      </DetailCard>
                   </div>
                   <div style={{ marginTop: '5rem', background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2rem', letterSpacing: '0.2em' }}>Shard Narrative & Identity Logs</h4>
                      <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155', lineHeight: 1.75 }}>{selectedCustomer.customer_details || 'Critical narrative data log is currently null for this identity shard. Registry remains synchronized.'}</p>
                   </div>
                </div>
              )}

              {activeDetailTab === 'Dashboard' && (
                <div className="animate-in fade-in duration-500">
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem', marginBottom: '4rem' }}>
                      <OrbStat label="Liability Flow" value={dashboardData.current_balance} currency="AED" icon={TrendingUp} color="#ef4444" />
                      <OrbStat label="Interaction Pulse" value={Object.values(dashboardData.counts).reduce((a,b)=>a+b,0)} icon={Zap} color={themeColor} />
                      <OrbStat label="Registry Stability" value={!selectedCustomer.disabled ? "Stable" : "Isolated"} icon={HeartPulse} color={!selectedCustomer.disabled ? "#10b981" : "#f59e0b"} />
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                      <GridPanel title="Sales Orders" count={dashboardData.counts.sales_orders} icon={ShoppingCart} color={themeColor} />
                      <GridPanel title="Sales Invoices" count={dashboardData.counts.sales_invoices} icon={Receipt} color={themeColor} />
                      <GridPanel title="Delivery Notes" count={dashboardData.counts.delivery_notes} icon={Package} color={themeColor} />
                      <GridPanel title="Identity Ledger" count="QUERY" icon={HardDrive} color="#6366f1" />
                   </div>
                </div>
              )}

              {activeDetailTab === 'Geospatial' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4rem' }}>
                   {selectedCustomer.addresses?.map((a, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9', position: 'relative' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <span style={{ fontSize: '10px', fontWeight: 950, background: '#fff', color: '#64748b', padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', textTransform: 'uppercase' }}>{a.address_type} Node</span>
                            {a.is_primary_address === 1 && <div style={{ background: themeColor, color: '#fff', padding: '0.5rem 1.5rem', borderRadius: '12px', fontSize: '10px', fontWeight: 950 }}>PRIMARY HUB</div>}
                         </div>
                         <h4 style={{ fontSize: '1.75rem', fontWeight: 950, color: '#0f172a', marginBottom: '12px' }}>{a.address_title}</h4>
                         <p style={{ fontSize: '1.15rem', color: '#64748b', fontWeight: 600, lineHeight: 1.75 }}>{a.address_line1}<br/>{a.address_line2 && a.address_line2 + ', '}{a.city}, {a.country}</p>
                      </div>
                   ))}
                   {selectedCustomer.addresses?.length === 0 && <p style={{ gridColumn: 'span 2', textAlign: 'center', padding: '10rem', color: '#cbd5e1', fontWeight: 950, fontSize: '24px' }}>NO SPATIAL COORDINATES DETECTED</p>}
                </div>
              )}

              {activeDetailTab === 'Personnel' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem' }}>
                   {selectedCustomer.contacts?.map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '3.5rem', borderRadius: '3rem', border: '3px solid #f1f5f9', textAlign: 'center' }}>
                         <div style={{ height: '100px', width: '100px', borderRadius: '32px', background: '#fff', border: '3px solid #e2e8f0', margin: '0 auto 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                            <User size={56} />
                         </div>
                         <h4 style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a' }}>{c.full_name}</h4>
                         <p style={{ fontSize: '12px', fontWeight: 950, color: themeColor, textTransform: 'uppercase', tracking: '0.15em', marginTop: '6px' }}>{c.designation || 'ACCESS NODAL SPECIALIST'}</p>
                         <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b', fontWeight: 700, fontSize: '15px' }}><Mail size={16} /> {c.email_id || 'NULL-VEC'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b', fontWeight: 700, fontSize: '15px' }}><Phone size={16} /> {c.mobile_no || 'OFFLINE'}</div>
                         </div>
                         {c.is_primary_contact === 1 && <div style={{ marginTop: '2.5rem', background: '#ecfdf5', color: '#10b981', padding: '10px 0', borderRadius: '14px', fontSize: '10px', fontWeight: 950 }}>PRIMARY ACCESS HUB</div>}
                      </div>
                   ))}
                   {selectedCustomer.contacts?.length === 0 && <p style={{ gridColumn: 'span 3', textAlign: 'center', padding: '10rem', color: '#cbd5e1', fontWeight: 950, fontSize: '24px' }}>NO PERSONNEL SHARDS LINKED</p>}
                </div>
              )}
           </div>
        </div>
      )}

      {/* ────────────────────── THE ALL-INCLUSIVE IDENTITY FORGE ────────────────────── */}
      {showModal && (
        <div className="p-modal">
           <div className="m-header">
              <h2 style={{ fontSize: '32px', fontWeight: 950, color: '#0f172a', tracking: '-0.04em', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ height: '56px', width: '56px', borderRadius: '18px', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {modalMode === 'create' ? <UserPlus size={28} /> : <Edit size={28} />}
                 </div>
                 {modalMode === 'create' ? 'Universal Identity Forge' : 'Identity Matrix Revision'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ height: '64px', width: '64px', borderRadius: '20px', background: '#f8fafc', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <X size={32} style={{ color: '#94a3b8' }} />
              </button>
           </div>

           <div className="m-body">
              <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                 
                 {/* Section: Core Shard Metadata */}
                 <div className="section-label"><span className="section-label-text">Core Shard Metadata</span><div style={{ height: '3px', flex: 1, background: '#f1f5f9' }} /></div>
                 <div className="f-grid">
                    <div className="cm-field"><label className="f-label">Legal Identity Name *</label><input className="f-input" value={form.customer_name} onChange={v => setForm({...form, customer_name: v.target.value})} placeholder="Full Verified Identity" /></div>
                    <div className="cm-field"><label className="f-label">Identity Salutation</label><select className="f-select" value={form.salutation} onChange={v => setForm({...form, salutation: v.target.value})}><option value="">NA</option>{meta.salutations?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Primary Signal (Mobile)</label><input className="f-input" value={form.mobile_no} onChange={v => setForm({...form, mobile_no: v.target.value})} placeholder="+971 -- --- ----" /></div>
                    <div className="cm-field"><label className="f-label">Digital Vector (Email)</label><input className="f-input" value={form.email_id} onChange={v => setForm({...form, email_id: v.target.value})} placeholder="node@network-matrix.com" /></div>
                    <div className="cm-field"><label className="f-label">Identity Shard Type</label><select className="f-select" value={form.customer_type} onChange={v => setForm({...form, customer_type: v.target.value})}>{meta.customer_type?.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Neural Gender Hub</label><select className="f-select" value={form.gender} onChange={v => setForm({...form, gender: v.target.value})}><option value="">NA</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                 </div>

                 {/* Section: Market & Fiscal Classification */}
                 <div className="section-label"><span className="section-label-text">Market & Fiscal Classification</span><div style={{ height: '3px', flex: 1, background: '#f1f5f9' }} /></div>
                 <div className="f-grid">
                    <div className="cm-field"><label className="f-label">Identity Group</label><select className="f-select" value={form.customer_group} onChange={v => setForm({...form, customer_group: v.target.value})}>{meta.customer_group?.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Territorial Vector</label><select className="f-select" value={form.territory} onChange={v => setForm({...form, territory: v.target.value})}>{meta.territory?.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Fiscal Shard (Tax ID)</label><input className="f-input" value={form.tax_id} onChange={v => setForm({...form, tax_id: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Tax Category Hub</label><select className="f-select" value={form.tax_category} onChange={v => setForm({...form, tax_category: v.target.value})}><option value="">Default</option>{meta.tax_categories?.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Pricing Matrix</label><select className="f-select" value={form.default_price_list} onChange={v => setForm({...form, default_price_list: v.target.value})}><option value="">System Standard</option>{meta.price_lists?.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Payment Terms Protocol</label><select className="f-select" value={form.payment_terms} onChange={v => setForm({...form, payment_terms: v.target.value})}><option value="">Direct</option>{meta.payment_terms?.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                 </div>

                 {/* Section: Operational Parameters */}
                 <div className="section-label"><span className="section-label-text">Operational Parameters</span><div style={{ height: '3px', flex: 1, background: '#f1f5f9' }} /></div>
                 <div className="f-grid">
                    <div className="cm-field"><label className="f-label">Loyalty Hub Link</label><select className="f-select" value={form.loyalty_program} onChange={v => setForm({...form, loyalty_program: v.target.value})}><option value="">None</option>{meta.loyalty_programs?.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Account Supervisor</label><input className="f-input" value={form.account_manager} onChange={v => setForm({...form, account_manager: v.target.value})} placeholder="Supervisor ID" /></div>
                    <div className="cm-field"><label className="f-label">Prospect Alias</label><input className="f-input" value={form.prospect_name} onChange={v => setForm({...form, prospect_name: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Customer POS Ident</label><input className="f-input" value={form.customer_pos_id} onChange={v => setForm({...form, customer_pos_id: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Internal Shard Link</label>
                      <button onClick={() => setForm({...form, is_internal_customer: form.is_internal_customer ? 0 : 1})} style={{ height: '56px', border: 'none', background: form.is_internal_customer ? '#0f172a' : '#f1f5f9', color: form.is_internal_customer ? '#fff' : '#64748b', borderRadius: '16px', fontWeight: 950, fontSize: '13px', cursor: 'pointer' }}>
                        INTERNAL ASSET: {form.is_internal_customer ? 'YES' : 'NO'}
                      </button>
                    </div>
                    <div className="cm-field"><label className="f-label">Identity Shard Status</label>
                       <div style={{ display: 'flex', gap: '1rem' }}>
                          <button onClick={() => setForm({...form, disabled: form.disabled ? 0 : 1})} style={{ flex: 1, height: '56px', background: form.disabled ? '#ef4444' : '#f1f5f9', color: form.disabled ? '#fff' : '#ef4444', border: 'none', borderRadius: '16px', fontWeight: 950, fontSize: '12px', cursor: 'pointer' }}>DISABLED: {form.disabled ? 'YES' : 'NO'}</button>
                          <button onClick={() => setForm({...form, is_frozen: form.is_frozen ? 0 : 1})} style={{ flex: 1, height: '56px', background: form.is_frozen ? '#1e293b' : '#f1f5f9', color: form.is_frozen ? '#fff' : '#1e293b', border: 'none', borderRadius: '16px', fontWeight: 950, fontSize: '12px', cursor: 'pointer' }}>FROZEN: {form.is_frozen ? 'YES' : 'NO'}</button>
                       </div>
                    </div>
                 </div>

                 {/* Section: Spatial Coordinate (Address) */}
                 <div className="section-label"><span className="section-label-text">Spatial Coordinate (Address)</span><div style={{ height: '3px', flex: 1, background: '#f1f5f9' }} /></div>
                 <div className="f-grid">
                    <div className="cm-field"><label className="f-label">Address Shard Type</label><select className="f-select" value={form.address_type} onChange={v => setForm({...form, address_type: v.target.value})}>{meta.address_type?.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                    <div className="cm-field"><label className="f-label">Building / Street Line</label><input className="f-input" value={form.address_line1} onChange={v => setForm({...form, address_line1: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">City Station</label><input className="f-input" value={form.city} onChange={v => setForm({...form, city: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Emirate Hub</label><select className="f-select" value={form.emirate} onChange={v => setForm({...form, emirate: v.target.value})}><option value="">Select</option>{meta.emirates?.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                 </div>

                 {/* Section: Personnel Profile (Primary Contact) */}
                 <div className="section-label"><span className="section-label-text">Personnel Profile (Primary Access Node)</span><div style={{ height: '3px', flex: 1, background: '#f1f5f9' }} /></div>
                 <div className="f-grid" style={{ marginBottom: '80px' }}>
                    <div className="cm-field"><label className="f-label">Personnel First Name</label><input className="f-input" value={form.first_name} onChange={v => setForm({...form, first_name: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Personnel Last Name</label><input className="f-input" value={form.last_name} onChange={v => setForm({...form, last_name: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Designation Shard</label><input className="f-input" value={form.designation} onChange={v => setForm({...form, designation: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Contact Mobile Link</label><input className="f-input" value={form.contact_mobile} onChange={v => setForm({...form, contact_mobile: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Contact Digital Link</label><input className="f-input" value={form.contact_email} onChange={v => setForm({...form, contact_email: v.target.value})} /></div>
                    <div className="cm-field"><label className="f-label">Personnel Status</label><select className="f-select" value={form.status} onChange={v => setForm({...form, status: v.target.value})}><option value="Active">Active</option><option value="Passive">Passive</option><option value="Isolated">Isolated</option></select></div>
                 </div>

              </div>
           </div>

           <div className="m-footer">
              <span style={{ fontSize: '13px', fontWeight: 950, color: '#ced4da', textTransform: 'uppercase', tracking: '0.2em' }}>MATRIX VECTOR: 0x{modalMode.toUpperCase()}-SYNC-FINAL-ALPHA</span>
              <div style={{ display: 'flex', gap: '2rem' }}>
                 <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '17px', fontWeight: 950, cursor: 'pointer' }}>TERMINATE PROTOCOL</button>
                 <button 
                  disabled={saving || !form.customer_name} 
                  onClick={handleSave} 
                  style={{ height: '72px', padding: '0 4.5rem', background: themeColor, color: '#fff', borderRadius: '24px', border: 'none', fontWeight: 950, fontSize: '1.25rem', cursor: 'pointer', shadow: `0 15px 40px ${themeColor}60`, opacity: (saving || !form.customer_name) ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 size={28} className="animate-spin" /> : <ShieldCheck size={28} />}
                  COMMIT SYNC
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */
const DataInfo = ({ icon: Icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', py: '4px' }}>
     <div style={{ height: '52px', width: '52px', borderRadius: '16px', background: '#fff', border: '2.5px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <Icon size={22} />
     </div>
     <div style={{ flex: 1 }}>
        <p style={{ fontSize: '11px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', tracking: '0.05em', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '1.1rem', fontWeight: 850, color: color || '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '⎯⎯⎯'}</p>
     </div>
  </div>
);

const DetailCard = ({ title, children }) => (
  <div style={{ background: '#f8fafc', padding: '3rem', borderRadius: '3.5rem', border: '4px solid #f1f5f9' }}>
     <h3 style={{ fontSize: '14px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3rem' }}>{title}</h3>
     <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>{children}</div>
  </div>
);

const OrbStat = ({ label, value, currency, icon: Icon, color }) => (
  <div style={{ background: '#fff', padding: '3rem', borderRadius: '4rem', border: '5px solid #f8fafc', display: 'flex', gap: '2.5rem', alignItems: 'center', shadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
     <div style={{ height: '90px', width: '90px', borderRadius: '32px', background: `${color}10`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={44} />
     </div>
     <div>
        <p style={{ fontSize: '12px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em' }}>{label}</p>
        <p style={{ fontSize: '3rem', fontWeight: 950, color: '#0f172a', tracking: '-0.04em', lineHeight: 1 }}>
           {currency && <span style={{ fontSize: '16px', color: '#cbd5e1', marginRight: '8px', verticalAlign: 'middle' }}>{currency}</span>}
           {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
     </div>
  </div>
);

const GridPanel = ({ title, count, icon: Icon, color }) => (
  <div style={{ background: '#f8fafc', padding: '2.5rem', borderRadius: '2.5rem', border: '3px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Icon size={28} style={{ color: '#94a3b8' }} />
        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{title}</span>
     </div>
     <span style={{ fontSize: '15px', fontWeight: 950, background: '#fff', color: '#0f172a', padding: '8px 24px', borderRadius: '16px', border: '2.5px solid #e2e8f0' }}>{count}</span>
  </div>
);

export default CustomerList;