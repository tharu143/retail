import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, RotateCw, Filter, ArrowRight, Check
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SalesOrder.css';

const API_BASE = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

function PurchaseReturnList() {
  const { themeColor, themeLight, isGreen, toggleTheme, legacySubTheme } = useLegacyTheme();
  
  // View States
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  
  // Data States
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Create Flow States
  const [originalInvoices, setOriginalInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedReturnDoc, setSelectedReturnDoc] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_returns_list`, { params: { doctype: 'Purchase Invoice' } });
      const data = res.data.message?.data || res.data.message || [];
      setReturns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch returns', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOriginalInvoices = async (q = '') => {
    try {
      setLoadingInvoices(true);
      const res = await axios.get(`/api/resource/Purchase Invoice`, {
        params: {
          filters: JSON.stringify([
            ['docstatus', '=', 1],
            ['is_return', '=', 0],
            ['name', 'like', `%${q}%`]
          ]),
          fields: '["name", "supplier_name", "grand_total", "posting_date", "currency"]',
          limit_page_length: 20,
          order_by: 'modified desc'
        }
      });
      setOriginalInvoices(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  /* ────────────────────── ACTIONS ────────────────────── */
  const startReturnFlow = () => {
    setShowCreateFlow(true);
    setInvoiceSearch('');
    fetchOriginalInvoices();
  };

  const handleSelectOriginal = async (invName) => {
    try {
      setLoadingInvoices(true);
      const res = await axios.get(`${API_BASE}.make_return_doc_from_original`, {
        params: { doctype: 'Purchase Invoice', original_name: invName }
      });
      if (res.data.message) {
        setSelectedReturnDoc(res.data.message);
        setView('detail');
        setShowCreateFlow(false);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const loadReturnDetails = async (name) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/resource/Purchase Invoice/${name}`);
      setSelectedReturnDoc(res.data.data);
      setView('detail');
    } catch (err) {
      Swal.fire('Error', 'Failed to load details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentAction = async (action) => {
    if (!selectedReturnDoc) return;
    
    if (action === 'submit') {
      const result = await Swal.fire({
        title: 'Confirm Submission',
        text: 'This will finalize the Purchase Return and debit the supplier account.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Submit'
      });
      if (!result.isConfirmed) return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}.handle_document_action`, {
        doctype: 'Purchase Invoice',
        docname: selectedReturnDoc.name,
        action: action
      });
      
      if (res.data.message?.success) {
        Swal.fire('Success', `Return ${action}ted successfully`, 'success');
        if (action === 'submit' || action === 'cancel') {
          fetchReturns();
          setView('list');
        } else {
          loadReturnDetails(selectedReturnDoc.name);
        }
      } else {
        throw new Error(res.data.message?.message || 'Action failed');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ────────────────────── DATA COMPUTE ────────────────────── */
  const filtered = useMemo(() => {
    if (!Array.isArray(returns)) return [];
    return returns.filter(r => {
      const q = searchTerm.toLowerCase();
      return (r.name?.toLowerCase().includes(q) || 
              r.supplier_name?.toLowerCase().includes(q) || 
              r.return_against?.toLowerCase().includes(q));
    });
  }, [returns, searchTerm]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .p-card { background: #fff; border-radius: 1.5rem; border: 1.5px solid #f1f5f9; transition: 0.3s; }
        .p-card:hover { border-color: ${themeColor}40; shadow: 0 10px 30px rgba(0,0,0,0.04); }
        .btn-action { height: 56px; padding: 0 2rem; borderRadius: 16px; fontWeight: 900; fontSize: 14px; display: flex; items-center: center; gap: 10px; cursor: pointer; transition: 0.2s; border: none; }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="animate-in fade-in duration-500">
          <div style={{ padding: '3rem 4rem', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem', color: '#0f172a' }}>
                  <RotateCw size={36} style={{ color: themeColor }} /> Purchase Returns
                </h1>
                <p style={{ fontSize: '14px', fontWeight: 850, color: '#94a3b8', marginTop: '4px' }}>{returns.length} DEBIT VOUCHERS INDEXED</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={toggleTheme} className="so-btn-secondary" style={{ color: themeColor }}>
                  <Palette size={16} /> {legacySubTheme.toUpperCase()}
                </button>
                <button className="so-btn-primary" style={{ background: themeColor, gap: '0.75rem', height: '56px', padding: '0 2.5rem' }} onClick={startReturnFlow}>
                  <Plus size={22} /> Initiate Debit Note
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 4rem' }}>
            <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
              <Search size={24} style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
              <input 
                style={{ width: '100%', height: '72px', borderRadius: '1.25rem', border: '2px solid #e2e8f0', paddingLeft: '4.5rem', fontSize: '1.1rem', background: '#fff', fontWeight: 800, outline: 'none' }} 
                placeholder="Probe registry for Debit ID, Supplier or Original PINV..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table className="so-table">
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '1.5rem 2.5rem' }}>Supplier Node</th>
                    <th>Status Node</th>
                    <th>Original Invoice</th>
                    <th style={{ textAlign: 'right' }}>Debit Value</th>
                    <th>Registry Key</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px' }}><Loader2 size={48} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} /></td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '150px', color: '#cbd5e1', fontWeight: 950, fontSize: '20px' }}>NO DEBIT SHARDS DETECTED</td></tr>
                  ) : (
                    paginated.map(r => (
                      <tr key={r.name} onClick={() => loadReturnDetails(r.name)} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '1.5rem 2.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Building2 size={24} />
                            </div>
                            <div>
                              <p style={{ fontWeight: 900, color: '#0f172a' }}>{r.supplier_name}</p>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8' }}>{r.posting_date}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            padding: '6px 14px', borderRadius: '12px', fontSize: '10px', fontWeight: 950, textTransform: 'uppercase',
                            background: r.status === 'Submitted' ? '#ecfdf5' : '#f1f5f9',
                            color: r.status === 'Submitted' ? '#10b981' : '#64748b',
                            border: `1px solid ${r.status === 'Submitted' ? '#10b98130' : '#e2e8f0'}`
                          }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: '#475569', fontSize: '13px' }}>{r.return_against}</td>
                        <td style={{ textAlign: 'right', fontWeight: 950, color: '#334155', fontSize: '1rem' }}>
                          {r.currency} {Math.abs(parseFloat(r.rounded_total || r.grand_total || r.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td><span style={{ fontWeight: 950, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '5px 12px', borderRadius: '8px', fontSize: '11px' }}>{r.name}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── INITIAL RETURN EXPLORER (Selection Flow) ────────────────────── */}
      {showCreateFlow && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="animate-in zoom-in-95 duration-300" style={{ background: '#fff', width: '100%', maxWidth: '900px', borderRadius: '2.5rem', overflow: 'hidden', shadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '3rem', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 950, color: '#0f172a', tracking: '-0.03em' }}>Select Original Purchase Invoice</h2>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>PROBE ACCOUNT REGISTRY FOR RETURN MAPPING</p>
               </div>
               <button onClick={() => setShowCreateFlow(false)} style={{ height: '56px', width: '56px', borderRadius: '18px', background: '#f8fafc', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={28} style={{ color: '#94a3b8' }} />
               </button>
            </div>
            
            <div style={{ padding: '3rem' }}>
               <div style={{ position: 'relative', marginBottom: '2rem' }}>
                  <Search size={22} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                  <input 
                    style={{ width: '100%', height: '64px', borderRadius: '1.25rem', border: '2px solid #e2e8f0', paddingLeft: '4rem', fontSize: '1rem', fontWeight: 800, outline: 'none' }} 
                    placeholder="Query Purchase ID or Supplier Name..." 
                    value={invoiceSearch}
                    onChange={e => {
                      setInvoiceSearch(e.target.value);
                      fetchOriginalInvoices(e.target.value);
                    }}
                  />
               </div>

               <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {loadingInvoices ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin text-slate-300" /></div>
                  ) : originalInvoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#cbd5e1', fontWeight: 950 }}>NO COMPATIBLE INVOICES DETECTED</div>
                  ) : (
                    originalInvoices.map(inv => (
                      <div key={inv.name} onClick={() => handleSelectOriginal(inv.name)} className="p-card" style={{ padding: '1.5rem 2rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                            <div style={{ height: '48px', width: '48px', borderRadius: '14px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><FileText size={22} /></div>
                            <div>
                               <p style={{ fontWeight: 900, color: '#0f172a' }}>{inv.name}</p>
                               <span style={{ fontSize: '12px', fontWeight: 850, color: '#94a3b8' }}>{inv.supplier_name} • {inv.posting_date}</span>
                            </div>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 950, color: '#0f172a', fontSize: '1.1rem' }}>{inv.currency} {inv.grand_total.toLocaleString()}</p>
                            <span style={{ fontSize: '10px', fontWeight: 950, color: themeColor, textTransform: 'uppercase' }}>INVOKE RETURN FLOW <ArrowRight size={10} style={{ marginLeft: '4px' }} /></span>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── RETURN DETAIL & EDIT VIEW ────────────────────── */}
      {view === 'detail' && selectedReturnDoc && (
        <div className="animate-in fade-in duration-500" style={{ minHeight: '100vh', background: '#fff' }}>
           <div style={{ background: '#0f172a', padding: '4rem 5rem 3rem', color: '#fff' }}>
              <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <div style={{ display: 'flex', gap: '3rem' }}>
                    <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.06)', height: '64px', width: '64px', borderRadius: '20px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                      <ArrowLeft size={32} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
                           <span style={{ background: '#6366f1', color: '#fff', padding: '0.4rem 1.25rem', borderRadius: '10px', fontSize: '11px', fontWeight: 950, textTransform: 'uppercase' }}>Purchase Return (Debit Note)</span>
                           <span style={{ height: '1.5px', width: '40px', background: 'rgba(255,255,255,0.2)' }} />
                           <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>Against: {selectedReturnDoc.return_against}</span>
                        </div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-0.05em', lineHeight: 1 }}>{selectedReturnDoc.supplier_name}</h1>
                        <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: '13px' }}>Identity Key: {selectedReturnDoc.name || 'DEBIT_NOTE_DRAFT'}</p>
                    </div>
                 </div>
                 
                 {selectedReturnDoc.docstatus === 0 && (
                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => handleDocumentAction('save')} disabled={saving} className="btn-action" style={{ background: '#1e293b', color: '#fff', border: '2px solid rgba(255,255,255,0.1)' }}>
                         {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={20} />} Sync Draft
                      </button>
                      <button onClick={() => handleDocumentAction('submit')} disabled={saving} className="btn-action" style={{ background: themeColor, color: '#fff' }}>
                         {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={20} />} Finalize Debit
                      </button>
                   </div>
                 )}

                 {selectedReturnDoc.docstatus === 1 && (
                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 185, 129, 0.15)', padding: '0.75rem 1.5rem', borderRadius: '16px', border: '1.5px solid #10b98140' }}>
                         <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                         <span style={{ fontWeight: 950, fontSize: '14px', color: '#10b981', tracking: '0.05em' }}>LEDGER SUBMITTED</span>
                      </div>
                      <button onClick={() => handleDocumentAction('cancel')} disabled={saving} className="btn-action" style={{ background: '#fef2f2', color: '#ef4444', border: '2.5px solid #fee2e2' }}>
                         {saving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={20} />} Nullify Transaction
                      </button>
                   </div>
                 )}
              </div>
           </div>

           <div style={{ maxWidth: '1400px', margin: '4rem auto', padding: '0 5rem 6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '4rem' }}>
                 
                 {/* Item List Shard */}
                 <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '2rem' }}>Debit Item Matrix</h3>
                    <div style={{ background: '#f8fafc', borderRadius: '2.5rem', border: '3px solid #f1f5f9', overflow: 'hidden' }}>
                       <table className="so-table">
                          <thead style={{ background: '#fff' }}>
                             <tr>
                                <th style={{ padding: '1.5rem 2.5rem' }}>Asset Specification</th>
                                <th style={{ textAlign: 'center' }}>Quantity</th>
                                <th style={{ textAlign: 'right' }}>Debit Rate</th>
                                <th style={{ textAlign: 'right' }}>Extension</th>
                             </tr>
                          </thead>
                          <tbody>
                             {selectedReturnDoc.items?.map((item, idx) => (
                                <tr key={idx}>
                                   <td style={{ padding: '1.5rem 2.5rem' }}>
                                      <p style={{ fontWeight: 900, color: '#1e293b' }}>{item.item_name}</p>
                                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', fontFamily: 'monospace' }}>{item.item_code}</span>
                                   </td>
                                   <td style={{ textAlign: 'center', fontWeight: 950, color: '#334155' }}>
                                      {Math.abs(item.qty)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>{item.uom}</span>
                                   </td>
                                   <td style={{ textAlign: 'right', fontWeight: 850, color: '#475569' }}>
                                      {selectedReturnDoc.currency} {item.rate.toLocaleString()}
                                   </td>
                                   <td style={{ textAlign: 'right', fontWeight: 950, color: '#1e293b' }}>
                                      {selectedReturnDoc.currency} {Math.abs(item.amount).toLocaleString()}
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Financial Vector Shard */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ background: '#1e293b', padding: '3.5rem', borderRadius: '3rem', color: '#fff' }}>
                       <h4 style={{ fontSize: '11px', fontWeight: 950, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '2.5rem', tracking: '0.2em' }}>Financial Debit Impact</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <FinRow label="Net Asset Reversal" value={selectedReturnDoc.total} currency={selectedReturnDoc.currency} />
                          <FinRow label="Fiscal Tax Reversal" value={selectedReturnDoc.total_taxes_and_charges} currency={selectedReturnDoc.currency} />
                          <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', margin: '1rem 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '13px', fontWeight: 950, color: 'rgba(255,255,255,0.6)' }}>Total Debit Value</span>
                             <span style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', color: '#fff' }}>
                                {selectedReturnDoc.currency} {Math.abs(selectedReturnDoc.grand_total).toLocaleString()}
                             </span>
                          </div>
                       </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '3rem', borderRadius: '3rem', border: '3px solid #f1f5f9' }}>
                       <h4 style={{ fontSize: '11px', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2rem', tracking: '0.15em' }}>Ledger Parameters</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <ParamRow icon={Calendar} label="Posting Signal" value={selectedReturnDoc.posting_date} />
                          <ParamRow icon={Hash} label="Original Purchase" value={selectedReturnDoc.return_against} />
                          <ParamRow icon={Layers} label="Update Stock" value={selectedReturnDoc.update_stock ? 'ENABLED' : 'DISABLED'} />
                       </div>
                    </div>
                 </div>

              </div>
           </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */
const FinRow = ({ label, value, currency }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <span style={{ fontSize: '13px', fontWeight: 850, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
     <span style={{ fontSize: '15px', fontWeight: 900 }}>{currency} {Math.abs(value).toLocaleString()}</span>
  </div>
);

const ParamRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
     <div style={{ height: '42px', width: '42px', borderRadius: '12px', background: '#fff', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <Icon size={18} />
     </div>
     <div>
        <p style={{ fontSize: '10px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</p>
        <p style={{ fontSize: '14px', fontWeight: 850, color: '#1e293b' }}>{value}</p>
     </div>
  </div>
);

export default PurchaseReturnList;
