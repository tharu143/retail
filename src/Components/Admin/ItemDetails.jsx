import React, { useState, useEffect, useRef } from 'react';
import {
  Package, Tag, MapPin, Hash, Layers, Anchor, Bookmark, Box, Archive,
  ArrowRight, ShieldCheck, Activity, AlertCircle, FileText, Palette, FileBox,
  TrendingUp, Warehouse, DollarSign, Loader2, Info, Users
} from 'lucide-react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SupplierDetails.css'; // Reusing premium styles

/* ========== DESIGN TOKENS ========== */
const T = {
  bg: '#F7F8FA', surface: '#FFFFFF', border: '#E8ECF0', borderLight: '#F1F4F8',
  text: '#0D1117', textSub: '#5A6478', textMuted: '#9CA8BB',
  blue: '#2563EB', blueLight: '#EEF3FF', blueMid: '#DBEAFE',
  green: '#16A34A', greenLight: '#F0FDF4', amber: '#D97706', amberLight: '#FFFBEB',
  red: '#DC2626', redLight: '#FEF2F2', purple: '#7C3AED', purpleLight: '#F5F3FF',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.06)', radius: '10px', radiusMd: '14px',
};

import { ChevronDown, Search } from 'lucide-react';
import { useMemo } from 'react';

const DashboardDocRow = ({ title, docs, search, fromDate, toDate, themeColor }) => {
  const [isOpen, setIsOpen] = useState(false);

  const filteredDocs = useMemo(() => {
    return (docs || []).filter(doc => {
      const s = (search || '').toLowerCase();
      const d = doc.posting_date || doc.modified?.split(' ')?.[0] || '';
      const nameMatch = (doc.name || '').toLowerCase().includes(s) || (doc.parent || '').toLowerCase().includes(s);
      const dateMatch = (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      return nameMatch && dateMatch;
    }).sort((a, b) => (b.posting_date || b.modified || '').localeCompare(a.posting_date || a.modified || ''));
  }, [docs, search, fromDate, toDate]);

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? `${themeColor}15` : '#fff' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: isOpen ? themeColor : T.text }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, background: isOpen ? themeColor : T.bg, color: isOpen ? '#fff' : themeColor, padding: '2px 8px', borderRadius: 10, transition: '0.2s' }}>{filteredDocs.length}</span>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s', color: T.textMuted }} />
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: 0, borderTop: `1px solid ${T.borderLight}`, background: '#fff' }}>
          {filteredDocs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                <thead>
                  <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                    <th style={{ padding: '10px 18px', paddingLeft: 20, textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Ref ID</th>
                    <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Qty</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Rate</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Total</th>
                    <th style={{ padding: '10px 18px', paddingRight: 20, textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Serial / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: '13px 18px', paddingLeft: 20 }}>
                        <div style={{ fontWeight: 600, color: themeColor, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{doc.name || doc.parent}</div>
                        <div style={{ fontSize: 10, color: T.green, fontWeight: 700, textTransform: 'uppercase' }}>{doc.status || 'Submitted'}</div>
                      </td>
                      <td style={{ padding: '13px 18px', fontSize: 12, color: T.textSub, fontFamily: "'DM Mono', monospace" }}>{doc.posting_date || doc.modified?.split(' ')?.[0] || '—'}</td>
                      <td style={{ padding: '13px 18px', textAlign: 'right', fontWeight: 600 }}>{doc.qty || 0} <span style={{ fontWeight: 400, color: T.textMuted, fontSize: 11 }}>{doc.uom || 'Nos'}</span></td>
                      <td style={{ padding: '13px 18px', textAlign: 'right', fontWeight: 600 }}>{Number(doc.rate || 0).toFixed(2)}</td>
                      <td style={{ padding: '13px 18px', textAlign: 'right', fontWeight: 700, color: themeColor }}>{Number(doc.amount || (doc.qty * doc.rate) || 0).toFixed(2)}</td>
                      <td style={{ padding: '13px 18px', paddingRight: 20 }}>
                        <code style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: '2px 6px', borderRadius: 4 }}>{doc.custom_supplier_sl_num || doc.serial_no || '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: T.textMuted, fontSize: 12, fontWeight: 600 }}>
              No records found matching filters
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ==================== UI COMPONENTS ==================== */
const ScrollReveal = ({ children, delay = 0, className = '', style = {} }) => {
   const [isVisible, setIsVisible] = useState(false);
   const domRef = useRef();

   useEffect(() => {
      const observer = new IntersectionObserver(entries => {
         entries.forEach(entry => {
            if (entry.isIntersecting) {
               setIsVisible(true);
               observer.unobserve(domRef.current);
            }
         });
      }, { threshold: 0.1 });
      
      const { current } = domRef;
      if (current) observer.observe(current);
      
      return () => {
         if (current) observer.unobserve(current);
      };
   }, []);

   return (
      <div
         ref={domRef}
         className={className}
         style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
            willChange: 'opacity, transform',
            height: '100%',
            ...style
         }}
      >
         {children}
      </div>
   );
};

const InfoSection = ({ title, children, icon: Icon, themeColor, style }) => (
  <div className="info-panel-card" style={style}>
    <div className="info-panel-header">
      <Icon size={18} style={{ color: themeColor }} strokeWidth={2.5} />
      <h5 className="info-panel-title">{title}</h5>
    </div>
    <div className="info-panel-body">
      {children}
    </div>
  </div>
);

const ItemDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGreen, themeColor, toggleTheme } = useLegacyTheme();
  
  const { user_roles, warehouse } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [activeTab, setActiveTab] = useState('General');
  
  const [dashboardData, setDashboardData] = useState(null);
  const [valuationData, setValuationData] = useState(null);
  const [priceData, setPriceData] = useState({ prices: [], metrics: {}, warehouse_breakdown: [] });
  const [barcodes, setBarcodes] = useState([]);
  const [dashSubTab, setDashSubTab] = useState('Procurement');
  const [connectionSearch, setConnectionSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // Fetch Item Master Data
      const res = await axios.get(`/api/resource/Item/${encodeURIComponent(id)}`);
      if (res.data && res.data.data) {
        setItem(res.data.data);
      }
      
      // Fetch rich dashboard details
      const dashRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_dashboard_details', { params: { item_code: id, warehouse: !isAdmin ? warehouse : undefined }, withCredentials: true });
      if (dashRes.data && dashRes.data.message) {
        setDashboardData(dashRes.data.message);
        if (dashRes.data.message.item_details?.barcodes) setBarcodes(dashRes.data.message.item_details.barcodes);
      }

      // Fetch linked documents (connections)
      try {
        const connRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', {
          params: { doctype: 'Item', name: id, warehouse: localStorage.getItem('warehouse') },
          withCredentials: true
        });
        if (connRes.data?.message?.categories) {
          setDashboardData(prev => ({ ...prev, connections: connRes.data.message.categories }));
        }
      } catch {}

      // Fetch valuation
      const valRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_valuation_retail', {
        params: { item_code: id, warehouse: localStorage.getItem('warehouse') },
        withCredentials: true
      });
      if (valRes.data && valRes.data.message) {
        setValuationData(valRes.data.message);
      }

      // Fetch prices
      const priceRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_prices', {
        params: { item_code: id, warehouse: localStorage.getItem('warehouse') },
        withCredentials: true
      });
      if (priceRes.data && priceRes.data.message) {
        const r = priceRes.data.message;
        setPriceData({ prices: r?.data || [], metrics: r?.metrics || {}, warehouse_breakdown: r?.warehouse_breakdown || [] });
      }

    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  if (loading) return null;

  if (!item) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfdfe] text-center p-8">
      <div className="p-10 bg-rose-50 rounded-[3rem] mb-8">
        <AlertCircle size={64} className="text-rose-400" />
      </div>
      <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-3">Item Not Found</h2>
      <p className="text-sm font-medium text-gray-400 max-w-xs mb-10">The requested item does not exist in the catalog.</p>
      <button onClick={() => navigate('/itemlist')} className="px-10 py-4 bg-gray-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:shadow-xl transition-all active:scale-95">Return Back</button>
    </div>
  );

  const isActive = item.disabled === 0;

  return (
    <div className="supplier-page-container">
      {/* Profile Header Overlay Card */}
      <div className="profile-header-container">
        <div className="header-actions-row">
          <div className="left-controls-group">
            <button onClick={() => navigate('/itemlist')} className="btn-modern-ghost" title="Go Back">
              <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back
            </button>
          </div>
          <div className="right-controls-group">
            <button
              onClick={toggleTheme}
              className="btn-modern-secondary"
              style={{ borderColor: themeColor, color: themeColor }}
            >
              <Palette size={14} />
              <span style={{ fontSize: '0.75rem' }}>{isGreen ? 'BLUE' : 'GREEN'}</span>
            </button>
          </div>
        </div>

        {/* Item Header Content */}
        <div className="profile-header-content">
          <div className="supplier-avatar-container" style={{ borderLeft: `5px solid ${themeColor}` }}>
            <Package size={48} style={{ color: '#0f172a' }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {item.item_name}
            </h1>

            <div className="meta-badges-flex">
              <div className="badge-pill-modern" style={{ borderColor: isActive ? '#bbf7d0' : '#fecaca', backgroundColor: isActive ? '#f0fdf4' : '#fdf2f2' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: '6px', height: '6px', borderRadius: '50%' }} />
                <span style={{ color: isActive ? '#15803d' : '#b91c1c', fontWeight: 700, fontSize: '0.75rem' }}>
                  {isActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="badge-pill-modern">
                <Hash size={12} style={{ color: themeColor }} />
                <span className="badge-label-muted">Code:</span>
                <span className="badge-value-dark">{item.item_code}</span>
              </div>

              <div className="badge-pill-modern">
                <Layers size={12} style={{ color: themeColor }} />
                <span className="badge-label-muted">Group:</span>
                <span className="badge-value-dark">{item.item_group}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-navigation-panel">
        <div className="tabs-navigation-container">
          {[
            { id: 'General', icon: FileText },
            { id: 'Dashboard', icon: Activity },
            { id: 'Pricing & Stock', icon: Tag },
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
        {activeTab === 'General' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <ScrollReveal delay={0}>
              <InfoSection title="Core Details" icon={Hash} themeColor={themeColor} style={{ height: '100%', margin: 0 }}>
                <div className="info-fields-grid">
                  <div className="info-field-box">
                    <span className="info-field-label">Item Code</span>
                    <span className="info-field-value font-bold text-slate-800">{item.item_code}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Item Name</span>
                    <span className="info-field-value font-bold text-slate-800">{item.item_name}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Item Group</span>
                    <span className="info-field-value font-bold text-slate-800">{item.item_group}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Brand</span>
                    <span className="info-field-value font-bold text-slate-800">{item.brand || 'N/A'}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Barcodes</span>
                    <span className="info-field-value font-bold text-slate-800">
                      {barcodes?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                          {barcodes.map((b, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                              {b.barcode} <span style={{ color: T.textMuted }}>· {b.uom}</span>
                            </span>
                          ))}
                        </div>
                      ) : 'None'}
                    </span>
                  </div>
                  <div className="info-field-box" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <span className="info-field-label">Description</span>
                    <span className="info-field-value font-bold text-slate-800" dangerouslySetInnerHTML={{ __html: item.description || 'N/A' }}></span>
                  </div>
                </div>
              </InfoSection>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <InfoSection title="Inventory Profile" icon={Box} themeColor={themeColor} style={{ margin: 0 }}>
                <div className="info-fields-grid">
                  <div className="info-field-box">
                    <span className="info-field-label">Default UOM</span>
                    <span className="info-field-value font-bold" style={{ color: themeColor }}>{item.stock_uom}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Valuation Method</span>
                    <span className="info-field-value font-bold text-slate-800">{item.valuation_method || 'FIFO'}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Default Warehouse</span>
                    <span className="info-field-value font-bold text-slate-800">{item.default_warehouse || 'N/A'}</span>
                  </div>
                  <div className="info-field-box" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <span className="info-field-label">End of Life</span>
                    <span className="info-field-value font-bold text-slate-800">{item.end_of_life || 'Not Set'}</span>
                  </div>
                </div>
              </InfoSection>
            </ScrollReveal>
          </div>
        )}

        {activeTab === 'Dashboard' && (
          <ScrollReveal delay={0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Search & Date Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
                  <input
                    style={{ paddingLeft: 40, background: 'transparent', border: 'none', width: '100%', outline: 'none', fontSize: 14 }}
                    placeholder="Search records..."
                    value={connectionSearch}
                    onChange={e => setConnectionSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: T.bg, outline: 'none' }} />
                  <span style={{ color: T.textMuted }}>—</span>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: T.bg, outline: 'none' }} />
                </div>
              </div>

              {/* Sub Tabs */}
              <div>
                <div style={{ display: 'flex', borderBottom: `1.5px solid ${T.borderLight}`, gap: 24, padding: '0 4px' }}>
                  {['Procurement', 'Sales', 'Inventory'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDashSubTab(tab)}
                      style={{
                        padding: '12px 0',
                        fontSize: 13,
                        fontWeight: 700,
                        color: dashSubTab === tab ? themeColor : T.textMuted,
                        border: 'none',
                        background: 'none',
                        borderBottom: dashSubTab === tab ? `2.5px solid ${themeColor}` : '2.5px solid transparent',
                        cursor: 'pointer',
                        marginBottom: -1.5,
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const connections = dashboardData?.connections || dashboardData?.categories || {};
                    const currentGroupDocs = connections[dashSubTab] || {};
                    const docTypes = Object.entries(currentGroupDocs);

                    if (docTypes.length === 0) {
                      return (
                        <div style={{ padding: '40px', textAlign: 'center', background: T.bg, borderRadius: 12, border: `1px dotted ${T.border}` }}>
                          <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>No {dashSubTab} records available</div>
                        </div>
                      );
                    }

                    return docTypes.map(([title, docs]) => (
                      <DashboardDocRow
                        key={title}
                        title={title}
                        docs={docs}
                        search={connectionSearch}
                        fromDate={fromDate}
                        toDate={toDate}
                        themeColor={themeColor}
                      />
                    ));
                  })()}
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        {activeTab === 'Pricing & Stock' && (
          <div className="grid grid-cols-1 gap-6">
            <ScrollReveal delay={0}>
              <InfoSection title="Valuation & Pricing Metrics" icon={Activity} themeColor={themeColor} style={{ margin: 0 }}>
                <div className="info-fields-grid">
                  <div className="info-field-box">
                    <span className="info-field-label">Total Stock</span>
                    <span className="info-field-value font-bold text-slate-800">{(valuationData?.stock_qty || priceData?.metrics?.total_stock || 0)} {item.stock_uom}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Stock Value</span>
                    <span className="info-field-value font-bold text-slate-800"><span className="flex items-center gap-1"><DirhamIcon size={14} /> {Number(valuationData?.stock_value || priceData?.metrics?.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Standard Rate</span>
                    <span className="info-field-value font-bold text-slate-800">{item.standard_rate || '0.00'}</span>
                  </div>
                  <div className="info-field-box">
                    <span className="info-field-label">Valuation Rate</span>
                    <span className="info-field-value font-bold text-slate-800">{Number(valuationData?.valuation_rate || item.valuation_rate || 0).toFixed(2)}</span>
                  </div>
                </div>
              </InfoSection>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <InfoSection title="Price Lists" icon={Tag} themeColor={themeColor} style={{ margin: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                    <thead>
                      <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                        <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Price List</th>
                        <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>UOM</th>
                        <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceData?.prices?.length > 0 ? priceData.prices.map((p, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                          <td style={{ padding: '13px 18px', fontWeight: 600 }}>{p.price_list}</td>
                          <td style={{ padding: '13px 18px' }}><span style={{ fontSize: 11, background: T.bg, padding: '4px 8px', borderRadius: 6, color: T.textSub, fontWeight: 600 }}>{p.uom}</span></td>
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{Number(p.price_list_rate || 0).toFixed(2)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No prices configured</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </InfoSection>
            </ScrollReveal>
          </div>
        )}

        {activeTab === 'Settings' && (
          <ScrollReveal delay={0}>
            <InfoSection title="Item Configurations" icon={ShieldCheck} themeColor={themeColor} style={{ margin: 0 }}>
              <div className="settings-grid-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                {[
                  { label: "Is Stock Item", value: item.is_stock_item },
                  { label: "Include Item in Manufacturing", value: item.include_item_in_manufacturing },
                  { label: "Has Variants", value: item.has_variants },
                  { label: "Has Batch No", value: item.has_batch_no },
                  { label: "Has Serial No", value: item.has_serial_no },
                  { label: "Is Fixed Asset", value: item.is_fixed_asset },
                ].map((setting, idx) => (
                  <div key={idx} className="settings-card-toggle">
                    <span className="toggle-label-bold">{setting.label}</span>
                    <div className={`checkbox-visual-box ${setting.value ? 'checked-active' : ''}`} style={setting.value ? { background: themeColor, borderColor: themeColor } : {}}>
                      {setting.value === 1 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                  </div>
                ))}
              </div>
            </InfoSection>
          </ScrollReveal>
        )}
      </div>
    </div>
  );
};

export default ItemDetails;
