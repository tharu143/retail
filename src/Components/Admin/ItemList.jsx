// src/Components/Admin/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle, Trash2, ChevronDown, Palette, Loader2, ChevronRight,
  Edit2, ShoppingCart, Barcode, Tag, Box, Info, ShieldCheck, Scale, MapPin, Activity, FileText, Calendar,
  LayoutGrid, List, TrendingUp, Warehouse, DollarSign, BarChart2, RefreshCw, Zap
} from 'lucide-react';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import Swal from 'sweetalert2';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './SalesOrder.css';

/* ========== DESIGN TOKENS ========== */
const T = {
  bg: '#f8fafc',
  surface: '#FFFFFF',
  border: '#C3CDE4',
  borderLight: '#f1f5f9',
  text: '#302D3D',
  textSub: '#969DB6',
  textMuted: '#969DB6',
  blue: '#604BE8',
  blueLight: '#f0f2fe',
  blueMid: '#C3CDE4',
  green: '#06D6A0',
  greenLight: '#e6fcf5',
  amber: '#FF9F04',
  amberLight: '#fffbeb',
  red: '#FF595E',
  redLight: '#fef2f2',
  purple: '#604BE8',
  purpleLight: '#f0f2fe',
  shadow: '0 4px 20px rgba(195, 205, 228, 0.15)',
  shadowMd: '0 10px 30px rgba(96, 75, 232, 0.15)',
  radius: '12px',
  radiusMd: '16px',
};

/* ========== GLOBAL STYLES ========== */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.cdnfonts.com/css/gilroy-bold');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Gilroy', sans-serif; }
    body { font-family: 'Gilroy', sans-serif; background: ${T.bg}; color: ${T.text}; }
    .il-page { min-height: 100vh; background: ${T.bg}; overflow-x: hidden; position: relative; }
    .il-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: ${T.radiusMd}; box-shadow: ${T.shadow}; }
    .il-input { width: 100%; padding: 9px 13px; background: ${T.surface}; border: 1.5px solid ${T.border}; border-radius: ${T.radius}; font-family: 'Gilroy', sans-serif !important; font-size: 14px !important; font-weight: 500; color: ${T.text}; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
    .il-input:focus { border-color: ${T.blue}; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .il-input::placeholder { color: ${T.textMuted}; font-weight: 400; }
    .il-input:disabled { background: ${T.bg}; color: ${T.textMuted}; cursor: not-allowed; }
    .il-select { appearance: none; width: 100%; padding: 9px 34px 9px 13px; background: ${T.surface}; border: 1.5px solid ${T.border}; border-radius: ${T.radius}; font-family: 'Gilroy', sans-serif !important; font-size: 14px !important; font-weight: 500; color: ${T.text}; outline: none; cursor: pointer; transition: border-color 0.15s; }
    .il-select:focus { border-color: ${T.blue}; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .il-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 16px; border-radius: ${T.radius}; font-family: 'Gilroy', sans-serif !important; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; white-space: nowrap; }
    .il-btn-primary { background: ${T.blue}; color: white; }
    .il-btn-primary:hover { background: #1D4ED8; }
    .il-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .il-btn-secondary { background: ${T.surface}; color: ${T.textSub}; border: 1.5px solid ${T.border}; }
    .il-btn-secondary:hover { background: ${T.bg}; border-color: #CBD5E1; }
    .il-btn-ghost { background: transparent; color: ${T.textSub}; border: 1.5px solid transparent; }
    .il-btn-ghost:hover { background: ${T.bg}; }
    .il-btn-danger { background: ${T.redLight}; color: ${T.red}; border: 1.5px solid #FECACA; }
    .il-btn-danger:hover { background: #FEE2E2; }
    .il-table { width: 100%; border-collapse: collapse; }
    .il-table thead th { background: ${T.green} !important; color: white !important; font-size: 14px !important; font-weight: 700 !important; text-transform: capitalize !important; letter-spacing: 0.02em !important; padding: 1rem 1.25rem !important; border: none !important; border-bottom: 1px solid ${T.border} !important; text-align: left !important; }
    .il-table tbody tr { cursor: pointer !important; transition: background 0.15s !important; background: white !important; }
    .il-table tbody tr:hover { background: #f8fafc !important; }
    .il-table tbody td { padding: 1rem 1.25rem !important; font-size: 14px !important; color: ${T.text} !important; border: none !important; border-bottom: 1px solid #f1f5f9 !important; vertical-align: middle; }
    .il-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 600; }
    .il-badge-green { background: ${T.greenLight}; color: ${T.green}; border: 1px solid #BBF7D0; }
    .il-badge-red { background: ${T.redLight}; color: ${T.red}; border: 1px solid #FECACA; }
    .il-badge-blue { background: ${T.blueLight}; color: ${T.blue}; border: 1px solid ${T.blueMid}; }
    .il-badge-amber { background: ${T.amberLight}; color: ${T.amber}; border: 1px solid #FDE68A; }
    .il-tabs { display: flex; background: ${T.bg}; border-radius: ${T.radius}; padding: 3px; gap: 2px; }
    .il-tab { padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: ${T.textSub}; transition: all 0.15s; }
    .il-tab.active { background: ${T.surface}; color: ${T.blue}; box-shadow: ${T.shadow}; }
    .il-section-label { font-size: 11px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 7px; display: block; }
    .il-check { width: 16px; height: 16px; accent-color: ${T.blue}; cursor: pointer; flex-shrink: 0; }
    .il-divider { height: 1.5px; background: ${T.borderLight}; border: none; }
    .il-bulk-bar { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #1e293b; color: #fff; border-radius: 18px; padding: 14px 22px; display: flex; align-items: center; gap: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 8px 24px rgba(37,99,235,0.2); z-index: 5000; min-width: 520px; max-width: 90vw; animation: slideUpBar 0.25s ease-out both; }
    @keyframes slideUpBar { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    .il-bulk-count { background: ${T.blue}; color: #fff; padding: '3px 10px'; border-radius: 100px; font-size: 13px; font-weight: 800; padding: 3px 12px; }
    .il-bulk-btn-sync { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 10px 22px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; white-space: nowrap; }
    .il-bulk-btn-sync:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .il-bulk-btn-sync:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .il-bulk-btn-cancel { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .il-bulk-btn-cancel:hover { background: rgba(255,255,255,0.16); }
    .il-bulk-wh-select { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; min-width: 200px; outline: none; cursor: pointer; }
    .il-bulk-wh-select option { background: #1e293b; color: #fff; }
    /* Sync Modal */
    .il-sync-overlay { position: fixed; inset: 0; z-index: 12000; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .il-sync-panel { background: #fff; border-radius: 28px 28px 0 0; width: 100%; max-width: 820px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 -20px 60px rgba(0,0,0,0.2); animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .il-sync-header { padding: 22px 24px 16px; border-bottom: 1px solid ${T.border}; flex-shrink: 0; }
    .il-sync-search { width: 100%; padding: 11px 16px 11px 42px; border: 1.5px solid ${T.border}; border-radius: 12px; font-size: 14px; font-weight: 500; outline: none; transition: border-color 0.15s; }
    .il-sync-search:focus { border-color: ${T.blue}; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .il-sync-list { flex: 1; overflow-y: auto; padding: 10px 24px; }
    .il-sync-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background 0.1s; border: 1.5px solid transparent; margin-bottom: 4px; }
    .il-sync-row:hover { background: ${T.bg}; }
    .il-sync-row.selected { background: ${T.blueLight}; border-color: ${T.blue}30; }
    .il-sync-footer { padding: 16px 24px; border-top: 1px solid ${T.border}; display: flex; align-items: center; gap: 12px; flex-shrink: 0; background: ${T.bg}; border-radius: 0 0 0 0; }
    .il-modal-panel { position: fixed; top: 56px; bottom: 0; left: 280px; right: 0; z-index: 10000; background: ${T.bg}; display: flex; flex-direction: column; overflow: hidden; }
    @media (max-width: 768px) {
      .il-modal-panel { left: 0; }
    }
    .il-modal-header { background: ${T.surface}; border-bottom: 1.5px solid ${T.border}; padding: 0 28px; height: 60px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0; }
    .il-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
    .il-modal-footer { background: ${T.surface}; border-top: 1.5px solid ${T.border}; padding: 14px 28px; display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
    .il-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .il-form-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
    .il-form-field { display: flex; flex-direction: column; gap: 5px; }
    .il-form-label { font-size: 12px; font-weight: 600; color: ${T.textSub}; }
    .il-form-label.req::after { content: ' *'; color: ${T.red}; }
    .il-card-header { padding: 14px 18px; border-bottom: 1.5px solid ${T.borderLight}; display: flex; align-items: center; justify-content: space-between; }
    .il-card-title { font-size: 13px; font-weight: 700; color: ${T.text}; display: flex; align-items: center; gap: 7px; }
    .il-stat-card { padding: 18px 22px; border-left: 3px solid; }
    .il-stat-label { font-size: 11px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .il-stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .il-stat-sub { font-size: 12px; font-weight: 500; color: ${T.textMuted}; margin-top: 3px; }
    .il-item-card { background: ${T.surface}; border: 1.5px solid ${T.border}; border-radius: ${T.radiusMd}; overflow: hidden; cursor: pointer; transition: all 0.18s; }
    .il-item-card:hover { border-color: #BFDBFE; box-shadow: 0 6px 20px rgba(37,99,235,0.08); transform: translateY(-2px); }
    .il-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; background: ${T.bg}; border: 1.5px solid ${T.border}; border-radius: 8px; font-size: 12px; font-weight: 600; color: ${T.text}; font-family: 'DM Mono', monospace; }
    .il-conn-tab { padding: 9px 18px; font-size: 13px; font-weight: 600; color: ${T.textMuted}; border: none; background: transparent; cursor: pointer; border-bottom: 2.5px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
    .il-conn-tab.active { color: ${T.blue}; border-bottom-color: ${T.blue}; }
    .il-view-tab { padding: 12px 20px; font-size: 13px; font-weight: 700; color: ${T.textMuted}; border: none; background: transparent; cursor: pointer; transition: all 0.2s; position: relative; display: flex; align-items: center; justify-content: center; height: 100%; }
    .il-view-tab.active { color: ${T.blue}; }
    .il-view-tab-indicator { position: absolute; bottom: 0; left: 15px; right: 15px; height: 3px; background: ${T.blue}; border-radius: 10px 10px 0 0; }
    .il-page-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1.5px solid ${T.border}; background: ${T.surface}; color: ${T.textSub}; cursor: pointer; transition: all 0.15s; }
    .il-page-btn:hover:not([disabled]) { border-color: ${T.blue}; color: ${T.blue}; }
    .il-page-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
    .il-price-toggle { flex: 1; padding: 12px 14px; border-radius: 10px; border: 1.5px solid ${T.border}; background: ${T.surface}; cursor: pointer; text-align: left; transition: all 0.15s; }
    .il-price-toggle.buying.on { background: ${T.amberLight}; border-color: #FDE68A; }
    .il-price-toggle.selling.on { background: ${T.greenLight}; border-color: #BBF7D0; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .anim-in { animation: fadeUp 0.2s ease-out both; }
    .spin { animation: spin 0.8s linear infinite; }
    .il-group-tabs-scroll { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; display: flex; gap: 8px; padding: 4px; }
    .il-group-tabs-scroll::-webkit-scrollbar { display: none; }
    
    /* Custom SweetAlert Styles */
    .swal2-container { z-index: 20000 !important; }
    .swal2-popup-custom { border-radius: 32px !important; padding: 2rem !important; font-family: 'DM Sans', sans-serif !important; z-index: 20001 !important; }
    .swal2-title-custom { font-size: 28px !important; font-weight: 800 !important; color: #1e293b !important; margin-bottom: 0.5rem !important; }
    .swal2-text-custom { font-size: 16px !important; font-weight: 500 !important; color: #64748b !important; line-height: 1.6 !important; margin-bottom: 2rem !important; padding: 0 1rem !important; }
    .swal2-confirm-btn-custom { background-color: #ef4444 !important; color: white !important; padding: 14px 40px !important; border-radius: 12px !important; font-size: 15px !important; font-weight: 700 !important; border: none !important; margin: 0 10px !important; cursor: pointer; transition: all 0.2s; }
    .swal2-confirm-btn-custom:hover { background-color: #dc2626 !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
    .swal2-cancel-btn-custom { background-color: #94a3b8 !important; color: white !important; padding: 14px 40px !important; border-radius: 12px !important; font-size: 15px !important; font-weight: 700 !important; border: none !important; margin: 0 10px !important; cursor: pointer; transition: all 0.2s; }
    .swal2-cancel-btn-custom:hover { background-color: #64748b !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(148, 163, 184, 0.2); }
    .swal2-actions-custom { margin-top: 1rem !important; }
    .swal2-icon-custom { border-color: #fdba74 !important; color: #f97316 !important; }
  `}</style>
);

/* ==================== UI COMPONENTS ==================== */
const DashboardDocRow = ({ title, count, docs, search, fromDate, toDate }) => {
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
        style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? T.blueLight : '#fff' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: isOpen ? T.blue : T.text }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, background: isOpen ? T.blue : T.bg, color: isOpen ? '#fff' : T.blue, padding: '2px 8px', borderRadius: 10, transition: '0.2s' }}>{filteredDocs.length}</span>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s', color: T.textMuted }} />
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: 0, borderTop: `1px solid ${T.borderLight}`, background: '#fff' }}>
          {filteredDocs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="il-table" style={{ border: 'none' }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    <th style={{ paddingLeft: 20 }}>Ref ID</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ paddingRight: 20 }}>Serial / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc, idx) => (
                    <tr key={idx} style={{ cursor: 'default' }}>
                      <td style={{ paddingLeft: 20 }}>
                        <div style={{ fontWeight: 600, color: T.blue, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{doc.name || doc.parent}</div>
                        <div style={{ fontSize: 10, color: T.green, fontWeight: 700, textTransform: 'uppercase' }}>{doc.status || 'Submitted'}</div>
                      </td>
                      <td style={{ fontSize: 12, color: T.textSub, fontFamily: "'DM Mono', monospace" }}>{doc.posting_date || doc.modified?.split(' ')?.[0] || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{doc.qty || 0} <span style={{ fontWeight: 400, color: T.textMuted, fontSize: 11 }}>{doc.uom || 'Nos'}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(doc.rate || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: T.blue }}>{Number(doc.amount || (doc.qty * doc.rate) || 0).toFixed(2)}</td>
                      <td style={{ paddingRight: 20 }}>
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

const StatusBadge = ({ disabled }) => (
  <span className={`il-badge ${disabled ? 'il-badge-red' : 'il-badge-green'}`}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: disabled ? T.red : T.green }} />
    {disabled ? 'Disabled' : 'Active'}
  </span>
);

const StatCard = ({ label, value, sub, accent }) => (
  <div className="il-card il-stat-card" style={{ borderLeftColor: accent }}>
    <div className="il-stat-label">{label}</div>
    <div className="il-stat-value" style={{ color: accent === T.blue ? T.text : accent }}>{value}</div>
    {sub && <div className="il-stat-sub">{sub}</div>}
  </div>
);

const CardSection = ({ title, icon, action, children, style }) => (
  <div className="il-card" style={style}>
    <div className="il-card-header">
      <span className="il-card-title">{icon && <span style={{ color: T.blue }}>{icon}</span>}{title}</span>
      {action}
    </div>
    {children}
  </div>
);

const ItemCard = ({ item, onClick }) => (
  <div className="il-item-card" onClick={() => onClick(item)}>
    <div style={{ height: 130, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: 16 }}>
      {item.image ? <img src={item.image} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={item.item_name} /> : <Package size={36} style={{ color: '#D1D9E6' }} />}
      <div style={{ position: 'absolute', top: 8, right: 8 }}><StatusBadge disabled={item.disabled} /></div>
    </div>
    <div style={{ padding: '12px 14px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{item.item_group}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>{item.item_name}</div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>{item.stock_uom || 'Nos'}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, display: 'inline-flex', alignItems: 'center' }}><DirhamIcon size={11} style={{ color: T.textMuted, marginRight: '2px' }} />{Number(item.valuation_rate || 0).toFixed(2)}</span>
      </div>
    </div>
  </div>
);

/* ========== CAMERA SCANNER ========== */
const CameraScanner = ({ onScan, onClose }) => {
  const html5QrcodeRef = useRef(null);

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode("item-camera-scanner-reader");
    html5QrcodeRef.current = html5Qrcode;

    const config = {
      fps: 15,
      qrbox: (width, height) => {
        const boxWidth = Math.min(width * 0.8, 260);
        const boxHeight = Math.min(height * 0.6, 150);
        return { width: boxWidth, height: boxHeight };
      },
      aspectRatio: 1.0
    };

    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.QR_CODE
    ];

    html5Qrcode.start(
      { facingMode: "environment" },
      { ...config, formatsToSupport: formats },
      (decodedText) => {
        onScan(decodedText.trim());
        html5Qrcode.stop().catch(err => console.error(err));
      },
      () => { }
    ).catch(err => {
      console.error("Scanner start error, trying default device:", err);
      html5Qrcode.start(
        { deviceId: undefined },
        { ...config, formatsToSupport: formats },
        (decodedText) => {
          onScan(decodedText.trim());
          html5Qrcode.stop().catch(fallbackErr => console.error(fallbackErr));
        },
        () => { }
      ).catch(finalErr => {
        console.error("All startup options failed:", finalErr);
      });
    });

    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.error(err));
      }
    };
  }, [onScan]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: T.surface, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>Scan Barcode</span>
        <button className="il-btn il-btn-ghost" onClick={onClose}><X size={18} /></button>
      </div>
      <div id="item-camera-scanner-reader" style={{ flex: 1, width: '100%', background: '#000' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 260, height: 150, border: '3px solid #EF4444', borderRadius: 12, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '9px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>Align barcode in frame</span>
      </div>
    </div>
  );
};
/* ========== SEARCHABLE SELECT ========== */
const SearchableSelect = ({ label, value, options, onChange, placeholder, onAction, required }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);
  const filtered = options.filter(o => String(o.label || o.value || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="il-form-field" ref={ref} style={{ position: 'relative' }}>
      <label className={`il-form-label ${required ? 'req' : ''}`}>{label}</label>
      <div className="il-input" onClick={() => setOpen(!open)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, padding: '0 13px', background: T.surface }}>
        <span style={{ color: value ? T.text : T.textMuted, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {options.find(o => String(o.value) === String(value))?.label || placeholder}
        </span>
        <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.blue}`, borderRadius: T.radius, zIndex: 1100, marginTop: 4, maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: T.shadowMd }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.borderLight}`, background: T.bg }}>
            <input className="il-input" style={{ height: 34, fontSize: 13 }} autoFocus placeholder="Type to search..." value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: T.textMuted }}>No results</div> : filtered.map(o => (
              <div key={o.value} onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); setSearch(''); }} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', background: String(value) === String(o.value) ? T.blueLight : 'transparent', color: String(value) === String(o.value) ? T.blue : T.text, fontWeight: String(value) === String(o.value) ? 600 : 500, borderBottom: `1px solid ${T.borderLight}` }} onMouseOver={e => e.currentTarget.style.background = T.bg} onMouseOut={e => e.currentTarget.style.background = String(value) === String(o.value) ? T.blueLight : 'transparent'}>
                {o.label}
              </div>
            ))}
          </div>
          {onAction && (
            <div onClick={(e) => { e.stopPropagation(); onAction(); setOpen(false); }} style={{ padding: 12, borderTop: `1.5px solid ${T.border}`, background: T.bg, color: T.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
              + Create new...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ========== SEARCHABLE SELECT INLINE ========== */
const SearchableSelectInline = ({ value, options, onChange, placeholder, style }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);
  const filtered = options.filter(o => String(o.label || o.value || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: 18, border: 'none', background: 'transparent', fontWeight: 600, fontSize: 13, color: value ? T.text : T.textMuted }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {options.find(o => String(o.value) === String(value))?.label || placeholder}
        </span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, minWidth: 220, background: T.surface, border: `1.5px solid ${T.blue}`, borderRadius: T.radius, zIndex: 1100, marginTop: 4, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: T.shadowMd }}>
          <div style={{ padding: 6, borderBottom: `1px solid ${T.borderLight}`, background: T.bg }}>
            <input
              style={{ width: '100%', height: 30, fontSize: 12, padding: '0 10px', border: `1px solid ${T.border}`, borderRadius: 7, outline: 'none' }}
              autoFocus
              placeholder="Filter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: T.textMuted }}>No matches</div> : filtered.map(o => (
              <div
                key={o.value}
                onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); setSearch(''); }}
                style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', background: String(value) === String(o.value) ? T.blueLight : 'transparent', color: String(value) === String(o.value) ? T.blue : T.text, fontWeight: String(value) === String(o.value) ? 600 : 500, borderBottom: `1px solid ${T.borderLight}` }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


/* ========== DEFAULT FORM ========== */
const defaultForm = () => ({
  item_code: '', item_name: '', item_group: '', disabled: false,
  maintain_stock: true, has_variants: false, is_variant: false, variant_of: '',
  opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0, brand: '',
  default_uom: 'Nos', description: '', image: null, imagePreview: null,
  uoms: [], hsn_code: '', country_of_origin: '', custom_loyalty_eligible: 0, custom_allow_discount: 1,
  is_stock_item: 1, is_sales_item: 1, is_purchase_item: 1, supplier_items: [],
  branch_availability: [], custom_pieces_per_box: 0
});

/* ========== MAIN COMPONENT ========== */
export default function ItemList() {
  const navigate = useNavigate();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewType, setViewType] = useState('list');

  const location = useLocation();
  const [filterName, setFilterName] = useState(location.state?.search || '');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHasVariants, setFilterHasVariants] = useState('');
  const [barcodeFilter, setBarcodeFilter] = useState('');
  const [showGlobalScan, setShowGlobalScan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingItemCode, setEditingItemCode] = useState(null);
  const fileInputRef = useRef(null);

  const [itemGroups, setItemGroups] = useState([]);
  const [brands, setBrands] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [countries, setCountries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [groupSearch] = useState('');

  const [activeTab, setActiveTab] = useState('General');
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [priceData, setPriceData] = useState({ prices: [], metrics: {}, warehouse_breakdown: [] });
  const [warehouses, setWarehouses] = useState([]);
  const [isPriceDetailView, setIsPriceDetailView] = useState(false);
  const [priceForm, setPriceForm] = useState({ price_list: '', uom: '', price_list_rate: 0, buying: 0, selling: 1, name: '' });
  const [expandedLinks, setExpandedLinks] = useState({});
  const [connectionSearch, setConnectionSearch] = useState('');
  const [dashSubTab, setDashSubTab] = useState('Procurement');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [connectionActiveTab, setConnectionActiveTab] = useState(null);
  const [valuationData, setValuationData] = useState(null);
  const [loadingValuation, setLoadingValuation] = useState(false);

  // ── Branch Sync Selection ──
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkTargetWarehouse, setBulkTargetWarehouse] = useState(localStorage.getItem('warehouse') || '');

  // ── Sync Items to Branch Modal ──
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [globalAllItems, setGlobalAllItems] = useState([]);
  const [loadingGlobalItems, setLoadingGlobalItems] = useState(false);
  const [syncSearch, setSyncSearch] = useState('');
  const [syncSelectedItems, setSyncSelectedItems] = useState([]);
  const [syncTargetWarehouse, setSyncTargetWarehouse] = useState(localStorage.getItem('warehouse') || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncGroupFilter, setSyncGroupFilter] = useState('');


  const html5QrcodeRef = useRef(null);
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    const cats = Object.keys(dashboardData?.connections || dashboardData?.categories || {});
    if (cats.length > 0 && !connectionActiveTab) setConnectionActiveTab(cats[0]);
  }, [dashboardData]);

  useEffect(() => {
    if (fromDate && toDate && fromDate > toDate) { setFromDate(toDate); setToDate(fromDate); }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!showForm || !isScanning) return;
    let input = '', timeout;
    const onKey = (e) => {
      if (e.key === 'Enter' && input.trim().length > 3) { e.preventDefault(); addBarcode(input.trim()); input = ''; }
      else if (e.key.length === 1) { input += e.key; clearTimeout(timeout); timeout = setTimeout(() => input = '', 100); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showForm, isScanning]);

  useEffect(() => { fetchItems(); fetchBrands(); fetchUoms(); fetchCountries(); fetchSuppliers(); fetchWarehouses(); }, []);

  useEffect(() => {
    if (showForm || isEditMode) { const t = setTimeout(() => fetchItemGroups(groupSearch), 300); return () => clearTimeout(t); }
  }, [groupSearch, showForm, isEditMode]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      // Use the custom retail API which returns barcodes and other retail-ready data
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
        params: {
          warehouse: !isAdmin ? warehouse : undefined
        },
        withCredentials: true
      });
      setItems(res.data?.message || []);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  const fetchItemDashboardDetails = async (code) => {
    try {
      setLoadingDashboard(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_dashboard_details', { params: { item_code: code, warehouse: !isAdmin ? warehouse : undefined }, withCredentials: true });
      const result = res.data?.message || {};
      setDashboardData(result);
      if (result.item_details) {
        const item = result.item_details;
        setForm(prev => ({ ...prev, brand: item.brand || '', valuation_rate: item.valuation_rate || 0, uoms: item.uoms || [], hsn_code: item.hsn_code || '', country_of_origin: item.country_of_origin || '', custom_loyalty_eligible: item.custom_loyalty_eligible || 0, custom_allow_discount: item.custom_allow_discount || 0, is_stock_item: item.is_stock_item || 0, is_sales_item: item.is_sales_item || 0, is_purchase_item: item.is_purchase_item || 0, supplier_items: item.supplier_items || [], description: item.description || prev.description }));
        if (item.barcodes) setBarcodes(item.barcodes);
        if (item.branch_availability) setForm(prev => ({ ...prev, branch_availability: item.branch_availability }));
      }
      try {
        const connRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', {
          params: {
            doctype: 'Item',
            name: code,
            warehouse: localStorage.getItem('warehouse')
          },
          withCredentials: true
        });
        if (connRes.data?.message?.categories) setDashboardData(prev => ({ ...prev, connections: connRes.data.message.categories }));
      } catch { }
    } catch { setDashboardData({}); } finally { setLoadingDashboard(false); }
  };

  const fetchItemValuation = async (code) => {
    try {
      setLoadingValuation(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_valuation_retail', {
        params: {
          item_code: code,
          warehouse: localStorage.getItem('warehouse')
        },
        withCredentials: true
      });
      setValuationData(res.data?.message || null);
    } catch { setValuationData(null); } finally { setLoadingValuation(false); }
  };

  const fetchPriceList = async (code) => {
    try {
      setLoadingPrices(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_prices', {
        params: {
          item_code: code,
          warehouse: localStorage.getItem('warehouse')
        },
        withCredentials: true
      });
      const r = res.data.message;
      setPriceData({ prices: r?.data || [], metrics: r?.metrics || {}, warehouse_breakdown: r?.warehouse_breakdown || [] });
    } catch { setPriceData({ prices: [], metrics: {}, warehouse_breakdown: [] }); } finally { setLoadingPrices(false); }
  };

  const fetchItemGroups = async (search = '') => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', { params: { search }, withCredentials: true });
      const raw = res.data.message?.data || res.data.message || [];
      setItemGroups((Array.isArray(raw) ? raw : []).map(g => {
        if (typeof g === 'string') return { label: g, value: g };
        const label = g.item_group_name || g.label || g.name || g.value;
        const value = g.name || g.value || g.item_group_name || g.label;
        return { label, value };
      }));
    } catch { }
  };

  const fetchBrands = async () => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_brands', { withCredentials: true });
      const raw = res.data.message?.data || res.data.message || [];
      setBrands((Array.isArray(raw) ? raw : []).map(b => {
        if (typeof b === 'string') return { label: b, value: b };
        const label = b.brand_name || b.label || b.name || b.value;
        const value = b.name || b.value || b.brand_name || b.label;
        return { label, value };
      }));
    } catch { }
  };

  const fetchCountries = async () => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_countries', { withCredentials: true });
      const raw = res.data.data || res.data.message?.data || res.data.message || [];
      setCountries((Array.isArray(raw) ? raw : []).map(c => {
        if (typeof c === 'string') return { label: c, value: c };
        const label = c.country_name || c.label || c.name || c.value;
        const value = c.name || c.value || c.country_name || c.label;
        return { label, value };
      }));
    } catch { }
  };

  const fetchUoms = async () => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_uoms_retail', { withCredentials: true });
      const raw = res.data.message?.data || res.data.message || [];
      setUoms((Array.isArray(raw) ? raw : []).map(u => {
        if (typeof u === 'string') return { label: u, value: u };
        const label = u.uom_name || u.label || u.name || u.uom || u.value;
        const value = u.name || u.uom || u.value || u.uom_name || u.label;
        return { label, value };
      }));
    } catch { }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses', {
        params: { warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      const raw = res.data.message || [];
      setWarehouses((Array.isArray(raw) ? raw : []).map(w => ({
        label: w.warehouse_name || w.name,
        value: w.name
      })));
    } catch { }
  };

  const fetchAllGlobalItems = async () => {
    try {
      setLoadingGlobalItems(true);
      // No warehouse param → returns ALL items from all branches
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
        withCredentials: true
      });
      setGlobalAllItems(res.data?.message || []);
    } catch { setGlobalAllItems([]); } finally { setLoadingGlobalItems(false); }
  };

  const openSyncModal = () => {
    setSyncSearch('');
    setSyncSelectedItems([]);
    setSyncGroupFilter('');
    setSyncTargetWarehouse(localStorage.getItem('warehouse') || '');
    setShowSyncModal(true);
    if (globalAllItems.length === 0) fetchAllGlobalItems();
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("/api/method/kyle_retail.retail_api.api.get_suppliers_list", { params: { limit: 1000 }, withCredentials: true });
      const raw = res.data.message?.data || res.data.message || [];
      setSuppliers(Array.isArray(raw) ? raw : []);
    } catch { }
  };
  const handleCreateBrand = async (name) => {
    try { const res = await axios.post('/api/resource/Brand', { brand: name }, { withCredentials: true }); if (res.data.data) { await fetchBrands(); setForm(p => ({ ...p, brand: name })); } }
    catch (e) { alert('Failed: ' + (e.response?.data?.message || e.message)); }
  };

  const handleCreateUom = async (name) => {
    try { const res = await axios.post('/api/resource/UOM', { uom_name: name }, { withCredentials: true }); if (res.data.data) { await fetchUoms(); setForm(p => ({ ...p, default_uom: name })); } }
    catch (e) { alert('Failed: ' + (e.response?.data?.message || e.message)); }
  };

  const handleDisableToggle = async (checked) => {
    if (checked) {
      const result = await Swal.fire({
        title: 'Deactivate Item?',
        text: "This will hide the item from active registers and transaction lists.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Deactivate',
        cancelButtonText: 'Cancel',
        buttonsStyling: false,
        customClass: {
          popup: 'swal2-popup-custom',
          title: 'swal2-title-custom',
          htmlContainer: 'swal2-text-custom',
          actions: 'swal2-actions-custom',
          confirmButton: 'swal2-confirm-btn-custom',
          cancelButton: 'swal2-cancel-btn-custom',
          icon: 'swal2-icon-custom'
        }
      });
      if (result.isConfirmed) setForm({ ...form, disabled: true });
    } else {
      setForm({ ...form, disabled: false });
    }
  };

  const addBarcode = async (code) => {
    if (!code?.trim()) return;
    code = code.trim();
    if (barcodes.some(b => b.barcode === code)) { alert('Barcode already added'); return; }
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', { params: { barcode: code }, withCredentials: true });
      if (res.data?.message?.exists) { alert(`Already used by: ${res.data.message.item}`); return; }
    } catch { }
    setBarcodes(p => [...p, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput(''); setIsScanning(false);
  };

  const addUomRow = () => setForm(p => ({ ...p, uoms: [...p.uoms, { uom: '', conversion_factor: 1 }] }));
  const removeUomRow = (i) => setForm(p => ({ ...p, uoms: p.uoms.filter((_, idx) => idx !== i) }));
  const updateUomRow = (i, f, v) => { const u = [...form.uoms]; u[i][f] = v; setForm({ ...form, uoms: u }); };

  const addSupplierRow = () => setForm(p => ({ ...p, supplier_items: [...p.supplier_items, { supplier: '', supplier_part_no: '' }] }));
  const removeSupplierRow = (i) => setForm(p => ({ ...p, supplier_items: p.supplier_items.filter((_, idx) => idx !== i) }));
  const updateSupplierRow = (i, f, v) => { const s = [...form.supplier_items]; s[i][f] = v; setForm({ ...form, supplier_items: s }); };

  const addBranchRow = () => setForm(p => ({ ...p, branch_availability: [...p.branch_availability, { warehouse: '' }] }));
  const removeBranchRow = (i) => setForm(p => ({ ...p, branch_availability: p.branch_availability.filter((_, idx) => idx !== i) }));
  const updateBranchRow = (i, v) => { const b = [...form.branch_availability]; b[i].warehouse = v; setForm({ ...form, branch_availability: b }); };

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const s = (filterName || '').toLowerCase();
      const b = (barcodeFilter || '').toLowerCase();

      const matchesBarcode = !barcodeFilter ||
        (item.barcodes || []).some(bc => (bc.barcode || '').toLowerCase().includes(b)) ||
        (item.item_code || '').toLowerCase().includes(b);

      return matchesBarcode
        && (!filterName || item.item_code.toLowerCase().includes(s) || item.item_name.toLowerCase().includes(s))
        && (!filterGroup || item.item_group.toLowerCase().includes(filterGroup.toLowerCase()))
        && (!filterStatus || (filterStatus === 'Enabled' ? !item.disabled : item.disabled))
        && (!filterHasVariants || (filterHasVariants === 'Yes' ? item.has_variants : !item.has_variants));
    });
  }, [items, filterName, barcodeFilter, filterGroup, filterStatus, filterHasVariants]);

  const total = filteredItems.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const startBarcodeScanner = async () => {
    setShowGlobalScan(true);
    setTimeout(() => {
      try {
        const html5Qrcode = new Html5Qrcode("global-list-scanner-reader");
        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: (width, height) => {
            const boxWidth = Math.min(width * 0.8, 450);
            const boxHeight = Math.min(height * 0.6, 250);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.0
        };

        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        html5Qrcode.start(
          { facingMode: "environment" },
          { ...config, formatsToSupport: formats },
          (decodedText) => {
            setBarcodeFilter(decodedText.trim());
            stopBarcodeScanner();
          },
          () => { }
        ).catch(err => {
          console.error("Scanner failed, trying fallback device:", err);
          html5Qrcode.start(
            { deviceId: undefined },
            { ...config, formatsToSupport: formats },
            (decodedText) => {
              setBarcodeFilter(decodedText.trim());
              stopBarcodeScanner();
            },
            () => { }
          ).catch(finalErr => {
            console.error("All startup options failed:", finalErr);
            setShowGlobalScan(false);
          });
        });
      } catch (err) {
        console.error(err);
        setShowGlobalScan(false);
      }
    }, 150);
  };

  const stopBarcodeScanner = () => {
    if (html5QrcodeRef.current) {
      if (html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
      }
    }
    setShowGlobalScan(false);
  };

  const handleBarcodeFileScan = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const html5Qrcode = html5QrcodeRef.current || new Html5Qrcode("global-list-scanner-reader");
      html5Qrcode.scanFile(file, false)
        .then(decodedText => {
          setBarcodeFilter(decodedText.trim());
          stopBarcodeScanner();
        })
        .catch(err => {
          Swal.fire('Error', 'No barcode found in image', 'error');
        });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGlobalSearchMaster = async (term) => {
    try {
      setLoading(true);
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', { search_term: term }, { withCredentials: true });
      const raw = res.data.message;
      const results = (raw?.success && Array.isArray(raw?.data)) ? raw.data : [];
      if (results.length > 0) {
        const html = `
          <div style="text-align: left; max-height: 400px; overflow-y: auto; padding: 10px;">
            ${results.map(it => `
              <div style="display: flex; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 8px; background: #fff;">
                <div style="width: 48px; height: 48px; background: #f1f5f9; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                  ${it.image ? `<img src="${it.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 10px; color: #94a3b8;">NO IMG</span>'}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 14px; color: #1e293b;">${it.item_name}</div>
                  <div style="font-size: 11px; color: #64748b; font-family: monospace;">${it.name}</div>
                  <div style="font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 4px;">ACTIVE IN: ${it.active_branches || 'None'}</div>
                </div>
                <button onclick="window.enableGlobalMaster('${it.name}')" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; height: fit-content; align-self: center; font-size: 11px; font-weight: 900; cursor: pointer;">SYNC ALL TO THIS BRANCH</button>
              </div>
            `).join('')}
          </div>
        `;
        window.enableGlobalMaster = async (code) => {
          try {
            Swal.fire({ title: 'Activating Item...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const syncRes = await axios.post('/api/method/kyle_retail.retail_api.api.enable_item_for_branch_retail', { item_code: code, warehouse: localStorage.getItem('warehouse') }, { withCredentials: true });
            if (syncRes.data.message?.success) {
              Swal.fire('Success', 'Item activated for your branch!', 'success');
              fetchItems();
            }
          } catch (e) { Swal.fire('Error', e.message, 'error'); }
        };
        Swal.fire({ title: 'Industry Registry Discovery', html: html, width: '600px', showConfirmButton: false, showCloseButton: true });
      } else { Swal.fire('No Results', 'No matches found in any branch registry.', 'info'); }
    } catch (e) { Swal.fire('Error', e.message, 'error'); } finally { setLoading(false); }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setForm({ ...form, image: r.result, imagePreview: r.result }); r.readAsDataURL(file); }
  };

  const handleSave = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.item_group || !form.default_uom.trim()) { alert('Please fill all required fields'); return; }
    setSaving(true);
    try {
      const data = {
        item_code: form.item_code,
        item_name: form.item_name,
        item_group: form.item_group,
        stock_uom: form.default_uom,
        standard_rate: parseFloat(form.standard_selling_rate) || 0,
        disabled: form.disabled ? 1 : 0,
        maintain_stock: form.maintain_stock ? 1 : 0,
        has_variants: form.has_variants ? 1 : 0,
        description: form.description || '',
        image: form.image || form.imagePreview || '',
        hsn_code: form.hsn_code,
        brand: form.brand,
        country_of_origin: form.country_of_origin,
        custom_loyalty_eligible: form.custom_loyalty_eligible ? 1 : 0,
        custom_allow_discount: form.custom_allow_discount ? 1 : 0,
        is_stock_item: form.is_stock_item ? 1 : 0,
        is_sales_item: form.is_sales_item ? 1 : 0,
        is_purchase_item: form.is_purchase_item ? 1 : 0,
        custom_pieces_per_box: parseFloat(form.custom_pieces_per_box) || 0,
        barcodes: barcodes.map(b => ({ barcode: b.barcode, uom: b.uom })),
        uoms: form.uoms.map(u => ({ uom: u.uom, conversion_factor: u.conversion_factor })),
        supplier_items: form.supplier_items,
        branch_availability: form.branch_availability
          .filter(b => b.warehouse && b.warehouse !== 'undefined' && b.warehouse !== 'null')
          .map(b => ({ warehouse: b.warehouse }))
      };
      await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', { doctype: 'Item', data }, { withCredentials: true });
      alert(isEditMode ? 'Item updated!' : 'Item created!');
      setShowForm(false); resetForm(); fetchItems();
    } catch (e) { alert(e.response?.data?.message || e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleSavePrice = async () => {
    try {
      setSaving(true);
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', { item_code: editingItemCode, data: priceForm }, { withCredentials: true });
      if (res.data.status === 'success' || res.data.message?.status === 'success') { fetchPriceList(editingItemCode); setIsPriceDetailView(false); }
      else throw new Error(res.data.message?.message || 'Update failed');
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete ${code}?`)) return;
    try { await axios.delete(`/api/resource/Item/${code}`, { withCredentials: true }); setShowForm(false); fetchItems(); }
    catch { alert('Delete failed'); }
  };

  const handleRowClick = async (item) => {
    setIsViewMode(true); setIsEditMode(false); setEditingItemCode(item.item_code);
    setForm({
      ...defaultForm(),
      item_code: item.item_code,
      item_name: item.item_name,
      item_group: item.item_group,
      disabled: item.disabled === 1,
      has_variants: item.has_variants === 1,
      default_uom: item.stock_uom || 'Nos',
      standard_selling_rate: item.standard_rate || 0,
      imagePreview: item.image,
      brand: item.brand || '',
      country_of_origin: item.country_of_origin || '',
      custom_pieces_per_box: item.custom_pieces_per_box || 0,
      branch_availability: []
    });
    setBarcodes([]); setShowForm(true); setActiveTab('General'); setDashboardData(null); setConnectionActiveTab(null);
    fetchPriceList(item.item_code);
    fetchItemDashboardDetails(item.item_code);
    fetchItemValuation(item.item_code);
  };

  const resetForm = () => { setForm(defaultForm()); setBarcodes([]); setIsEditMode(false); setIsViewMode(false); setEditingItemCode(null); setValuationData(null); };

  const handleCloseForm = async () => {
    const dirty = !isViewMode && (form.item_code || form.item_name || form.item_group || barcodes.length > 0 || form.image);
    if (dirty) {
      const result = await Swal.fire({
        title: 'Discard Changes?',
        text: 'You have unsaved changes that will be lost.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Discard',
        cancelButtonText: 'No, Keep Editing',
        buttonsStyling: false,
        customClass: {
          popup: 'swal2-popup-custom',
          title: 'swal2-title-custom',
          htmlContainer: 'swal2-text-custom',
          actions: 'swal2-actions-custom',
          confirmButton: 'swal2-confirm-btn-custom',
          cancelButton: 'swal2-cancel-btn-custom',
          icon: 'swal2-icon-custom'
        }
      });
      if (!result.isConfirmed) return;
    }
    setShowForm(false); setBarcodes([]);
    setForm(p => ({ ...p, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
  };

  const clearFilters = () => { setFilterName(''); setFilterGroup(''); setFilterStatus(''); setFilterHasVariants(''); setCurrentPage(1); };
  const hasFilters = filterName || filterGroup || filterStatus || filterHasVariants;

  // ── Branch Sync Helpers ──
  const toggleSelectItem = (e, itemCode) => {
    e.stopPropagation();
    setSelectedItems(prev =>
      prev.includes(itemCode) ? prev.filter(c => c !== itemCode) : [...prev, itemCode]
    );
  };
  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedItems.map(i => i.item_code));
    }
  };
  const handleBulkSyncToBranch = async () => {
    if (!bulkTargetWarehouse) { Swal.fire('Error', 'Please select a target branch first.', 'error'); return; }
    if (selectedItems.length === 0) return;
    const confirm = await Swal.fire({
      title: `Sync ${selectedItems.length} item(s)?`,
      html: `Enable <strong>${selectedItems.length}</strong> item(s) for branch:<br/><code style="font-size:13px;color:#2563eb;">${bulkTargetWarehouse}</code>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Sync to Branch',
      cancelButtonText: 'Cancel',
      buttonsStyling: false,
      customClass: {
        popup: 'swal2-popup-custom', title: 'swal2-title-custom',
        htmlContainer: 'swal2-text-custom', actions: 'swal2-actions-custom',
        confirmButton: 'swal2-confirm-btn-custom', cancelButton: 'swal2-cancel-btn-custom'
      }
    });
    if (!confirm.isConfirmed) return;
    try {
      setBulkSyncing(true);
      const res = await axios.post(
        '/api/method/kyle_retail.retail_api.api.bulk_enable_items_for_branch',
        { item_codes: JSON.stringify(selectedItems), warehouse: bulkTargetWarehouse },
        { withCredentials: true }
      );
      const result = res.data?.message || res.data;
      Swal.fire({
        icon: result.success ? 'success' : 'error',
        title: result.success ? 'Branch Sync Complete' : 'Sync Failed',
        text: result.message,
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      if (result.success) { setSelectedItems([]); fetchItems(); }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleSyncModalSubmit = async () => {
    if (!syncTargetWarehouse) { Swal.fire('Error', 'Select a target branch.', 'error'); return; }
    if (syncSelectedItems.length === 0) { Swal.fire('Error', 'Select at least one item.', 'error'); return; }
    try {
      setSyncLoading(true);
      const res = await axios.post(
        '/api/method/kyle_retail.retail_api.api.bulk_enable_items_for_branch',
        { item_codes: JSON.stringify(syncSelectedItems), warehouse: syncTargetWarehouse },
        { withCredentials: true }
      );
      const result = res.data?.message || res.data;
      if (result.success) {
        Swal.fire({ icon: 'success', title: 'Sync Complete!', text: result.message, timer: 2500, showConfirmButton: false, toast: true, position: 'top-end' });
        setShowSyncModal(false);
        setSyncSelectedItems([]);
        fetchItems();
      } else {
        Swal.fire('Error', result.message, 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  /* ============================
        RENDER
  ============================ */
  return (
    <>
      <GlobalStyle />
      <div className="il-page">

        {/* PAGE HEADER */}
        <div className="so-page-header-container">
          <div className="so-page-tabs">
            <span className="so-page-tab active">Item</span>
            <span className="so-page-tab" onClick={() => navigate('/stockledgerreport')} style={{ cursor: 'pointer' }}>Reports</span>
          </div>
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">Item Management</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: T.textMuted }}>{total} records</div>
                <div className="il-tabs">
                  <button className={`il-tab ${viewType === 'list' ? 'active' : ''}`} onClick={() => setViewType('list')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><List size={13} />List</button>
                  <button className={`il-tab ${viewType === 'card' ? 'active' : ''}`} onClick={() => setViewType('card')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LayoutGrid size={13} />Grid</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="il-btn il-btn-secondary" onClick={() => navigate('/itempricelist')}><Scale size={14} />Price Master</button>
              <button className="il-btn il-btn-secondary" onClick={fetchItems} title="Refresh"><RefreshCw size={14} /></button>
              <button
                className="il-btn il-btn-secondary"
                onClick={openSyncModal}
                style={{ color: '#604BE8', borderColor: '#C3CDE4', background: '#f0f2fe', gap: 6 }}
              >
                <Warehouse size={14} />Sync Items to Branch
              </button>
              <button className="il-btn il-btn-primary" onClick={() => {
                resetForm();
                const myWh = localStorage.getItem('warehouse');
                if (myWh) setForm(p => ({ ...p, branch_availability: [{ warehouse: myWh }] }));
                setShowForm(true); fetchItemGroups(); fetchBrands(); fetchUoms(); fetchCountries();
              }}><Plus size={14} />Add Item</button>
            </div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div style={{ background: T.surface, borderBottom: `1.5px solid ${T.border}`, padding: '14px 28px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="il-section-label">Barcode / Scan</span>
              <div style={{ position: 'relative' }}>
                <Barcode size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.blue, pointerEvents: 'none' }} />
                <input
                  className="il-input"
                  style={{ paddingLeft: 34, paddingRight: 60, borderColor: barcodeFilter ? T.blue : T.border }}
                  placeholder="Scan or type barcode..."
                  value={barcodeFilter}
                  onChange={e => setBarcodeFilter(e.target.value)}
                />
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                  <button onClick={startBarcodeScanner} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex' }} title="Camera Scan"><Camera size={14} /></button>
                  <label style={{ cursor: 'pointer', color: T.textMuted, display: 'flex' }} title="Image Scan">
                    <Upload size={14} />
                    <input type="file" hidden accept="image/*" onChange={handleBarcodeFileScan} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ flex: 1.5, minWidth: 280 }}>
              <span className="il-section-label">Name or Code</span>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
                <input className="il-input" style={{ paddingLeft: 34 }} placeholder="Search items..." value={filterName} onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }} />
              </div>
            </div>
            <div style={{ width: 190 }}>
              <span className="il-section-label">Group</span>
              <SearchableSelectInline
                value={filterGroup}
                options={[{ label: 'All Groups', value: '' }, ...itemGroups]}
                placeholder="Filter by group..."
                onChange={val => { setFilterGroup(val); setCurrentPage(1); }}
                style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: '0 12px', minHeight: 38, display: 'flex', alignItems: 'center' }}
              />
            </div>
            <div style={{ width: 150 }}>
              <span className="il-section-label">Status</span>
              <div style={{ position: 'relative' }}>
                <select className="il-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                  <option value="">All</option>
                  <option value="Enabled">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
              </div>
            </div>
            <div style={{ width: 150 }}>
              <span className="il-section-label">Variants</span>
              <div style={{ position: 'relative' }}>
                <select className="il-select" value={filterHasVariants} onChange={e => { setFilterHasVariants(e.target.value); setCurrentPage(1); }}>
                  <option value="">All</option>
                  <option value="Yes">Has Variants</option>
                  <option value="No">No Variants</option>
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
              </div>
            </div>
            {hasFilters && (
              <button className="il-btn il-btn-ghost" onClick={clearFilters} style={{ color: T.red, alignSelf: 'flex-end' }}><X size={13} />Clear</button>
            )}
          </div>
        </div>

        {/* GROUP TABS SCROLL */}
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '4px 28px' }}>
          <div className="il-group-tabs-scroll" style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '8px 0', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => { setFilterGroup(''); setCurrentPage(1); }}
              style={{
                padding: '7px 16px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                border: 'none',
                transition: 'all 0.2s',
                background: filterGroup === '' ? T.text : T.bg,
                color: filterGroup === '' ? '#fff' : T.textSub,
                boxShadow: filterGroup === '' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              All Assets
            </button>
            {itemGroups.map(g => (
              <button
                key={g.value}
                onClick={() => { setFilterGroup(g.value); setCurrentPage(1); }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  transition: 'all 0.2s',
                  background: filterGroup === g.value ? T.blue : T.bg,
                  color: filterGroup === g.value ? '#fff' : T.textSub,
                  boxShadow: filterGroup === g.value ? '0 4px 12px rgba(37,99,235,0.2)' : 'none'
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ padding: '20px 28px' }}>
          {loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <Loader2 size={28} style={{ color: T.blue, margin: '0 auto' }} className="spin" />
            </div>
          ) : paginatedItems.length > 0 ? (
            viewType === 'card' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                {paginatedItems.map(item => <ItemCard key={item.item_code} item={item} onClick={handleRowClick} />)}
              </div>
            ) : (
              <div className="il-card" style={{ overflow: 'hidden' }}>
                <table className="il-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, paddingLeft: 18 }}>
                        <input
                          type="checkbox"
                          className="il-check"
                          checked={paginatedItems.length > 0 && selectedItems.length === paginatedItems.length}
                          onChange={toggleSelectAll}
                          title="Select all on this page"
                          onClick={e => e.stopPropagation()}
                        />
                      </th>
                      <th style={{ width: 52 }}></th>
                      <th>Item</th>
                      <th>Group</th>
                      <th>UOM</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}><span className="flex items-center justify-end gap-1">Valuation Rate (<DirhamIcon size={10} />)</span></th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => {
                      const isChecked = selectedItems.includes(item.item_code);
                      return (
                        <tr
                          key={item.item_code}
                          onClick={() => handleRowClick(item)}
                          style={{ background: isChecked ? '#EFF6FF' : undefined }}
                        >
                          <td style={{ paddingLeft: 18 }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="il-check"
                              checked={isChecked}
                              onChange={e => toggleSelectItem(e, item.item_code)}
                            />
                          </td>
                          <td>
                            <div style={{ width: 36, height: 36, background: T.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${T.border}` }}>
                              {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Package size={15} style={{ color: '#D1D9E6' }} />}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{item.item_name}</div>
                            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{item.item_code}</div>
                          </td>
                          <td style={{ fontSize: 13, color: T.textSub }}>{item.item_group}</td>
                          <td><span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>{item.stock_uom || 'Nos'}</span></td>
                          <td><StatusBadge disabled={item.disabled} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{Number(item.valuation_rate || 0).toFixed(2)}</td>
                          <td style={{ paddingRight: 16 }}><ChevronRight size={15} style={{ color: T.textMuted }} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div style={{ padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 64, height: 64, background: T.bg, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                {barcodeFilter ? <Barcode size={32} color={T.blue} strokeWidth={1.5} /> : <Package size={32} color={T.textMuted} strokeWidth={1.5} />}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, textAlign: 'center' }}>
                {barcodeFilter ? `Barcode Unrecognized` : `Inventory Exhausted`}
              </div>
              <p style={{ fontSize: 14, color: T.textMuted, marginTop: 8, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                {barcodeFilter
                  ? <>The barcode <strong>{barcodeFilter}</strong> is not registered for <strong>{localStorage.getItem('warehouse') || 'Current Branch'}</strong>.</>
                  : <>No items match your current filters in this branch. Expand your search to the global registry.</>
                }
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                {hasFilters && <button className="il-btn il-btn-secondary" onClick={clearFilters} style={{ height: 44, borderRadius: 12, padding: '0 24px' }}>Clear Local Filters</button>}
                <button
                  onClick={() => handleGlobalSearchMaster(barcodeFilter || filterName)}
                  className="il-btn il-btn-secondary"
                  style={{ padding: '0 28px', fontSize: 13, height: 44, borderRadius: 12 }}
                >
                  <Search size={15} style={{ marginRight: 8 }} />
                  {barcodeFilter ? 'Deep Scan Registry' : 'Search Industry Registry'}
                </button>
                <button
                  onClick={openSyncModal}
                  className="il-btn il-btn-primary"
                  style={{ padding: '0 28px', fontSize: 13, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}
                >
                  <Warehouse size={15} style={{ marginRight: 8 }} />
                  Sync Items to Branch
                </button>
              </div>
            </div>
          )}

          {/* ── FLOATING BRANCH SYNC ACTION BAR ── */}
          {selectedItems.length > 0 && (
            <div className="il-bulk-bar">
              <span className="il-bulk-count">{selectedItems.length} selected</span>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Sync to Branch:</span>
              <select
                className="il-bulk-wh-select"
                value={bulkTargetWarehouse}
                onChange={e => setBulkTargetWarehouse(e.target.value)}
              >
                <option value="">— Choose Branch —</option>
                {warehouses.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
              <button
                className="il-bulk-btn-sync"
                onClick={handleBulkSyncToBranch}
                disabled={bulkSyncing || !bulkTargetWarehouse}
              >
                {bulkSyncing
                  ? <><Loader2 size={14} className="spin" />Syncing...</>
                  : <><Warehouse size={14} />Enable for Branch</>}
              </button>
              <button
                className="il-bulk-btn-cancel"
                onClick={() => setSelectedItems([])}
              >
                <X size={13} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════
             SYNC ITEMS TO BRANCH MODAL
        ══════════════════════════════════ */}
        {showSyncModal && (() => {
          const syncGroups = [...new Set(globalAllItems.map(i => i.item_group).filter(Boolean))].sort();
          const filteredSync = globalAllItems.filter(item => {
            const s = syncSearch.toLowerCase();
            const groupMatch = !syncGroupFilter || item.item_group === syncGroupFilter;
            const nameMatch = !syncSearch ||
              (item.item_name || '').toLowerCase().includes(s) ||
              (item.item_code || '').toLowerCase().includes(s) ||
              (item.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(s));
            return groupMatch && nameMatch;
          });
          const allSyncSelected = filteredSync.length > 0 && filteredSync.every(i => syncSelectedItems.includes(i.item_code));
          return (
            <div className="il-sync-overlay" onClick={() => setShowSyncModal(false)}>
              <div className="il-sync-panel" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="il-sync-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: '#F5F3FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Warehouse size={18} color="#7C3AED" />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Sync Items to Branch</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>Select items from global registry → enable for a branch</div>
                      </div>
                    </div>
                    <button onClick={() => setShowSyncModal(false)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                  </div>
                  {/* Search + Group Filter */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
                      <input
                        className="il-sync-search"
                        autoFocus
                        placeholder="Search by name, code or barcode..."
                        value={syncSearch}
                        onChange={e => setSyncSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ position: 'relative', minWidth: 160 }}>
                      <select
                        style={{ appearance: 'none', width: '100%', padding: '11px 32px 11px 14px', border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: T.text, outline: 'none', background: T.surface, cursor: 'pointer' }}
                        value={syncGroupFilter}
                        onChange={e => setSyncGroupFilter(e.target.value)}
                      >
                        <option value="">All Groups</option>
                        {syncGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
                    </div>
                  </div>
                </div>

                {/* Item List */}
                <div className="il-sync-list">
                  {loadingGlobalItems ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Loader2 size={26} color={T.blue} className="spin" style={{ margin: '0 auto' }} />
                      <div style={{ marginTop: 10, fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Loading global registry...</div>
                    </div>
                  ) : filteredSync.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No items found</div>
                  ) : (
                    <>
                      {/* Select all filtered */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: T.bg, marginBottom: 8, cursor: 'pointer' }}
                        onClick={() => {
                          if (allSyncSelected) {
                            setSyncSelectedItems(prev => prev.filter(c => !filteredSync.map(i => i.item_code).includes(c)));
                          } else {
                            const codes = filteredSync.map(i => i.item_code);
                            setSyncSelectedItems(prev => [...new Set([...prev, ...codes])]);
                          }
                        }}
                      >
                        <input type="checkbox" className="il-check" checked={allSyncSelected} onChange={() => { }} onClick={e => e.stopPropagation()} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>
                          {allSyncSelected ? 'Deselect All' : `Select All (${filteredSync.length})`}
                        </span>
                        {syncSelectedItems.length > 0 && (
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, background: '#7C3AED', color: '#fff', padding: '2px 10px', borderRadius: 100 }}>
                            {syncSelectedItems.length} selected
                          </span>
                        )}
                      </div>
                      {filteredSync.map(item => {
                        const checked = syncSelectedItems.includes(item.item_code);
                        return (
                          <div
                            key={item.item_code}
                            className={`il-sync-row${checked ? ' selected' : ''}`}
                            onClick={() => setSyncSelectedItems(prev =>
                              prev.includes(item.item_code) ? prev.filter(c => c !== item.item_code) : [...prev, item.item_code]
                            )}
                          >
                            <input type="checkbox" className="il-check" checked={checked} onChange={() => { }} onClick={e => e.stopPropagation()} />
                            <div style={{ width: 40, height: 40, background: T.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: `1px solid ${T.border}` }}>
                              {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Package size={16} color={T.textMuted} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name}</div>
                              <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{item.item_code}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.textSub, background: T.bg, padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{item.item_group}</span>
                            <span style={{ fontSize: 11, color: T.textMuted, padding: '2px 8px', borderRadius: 6, background: T.bg, flexShrink: 0 }}>{item.stock_uom || 'Nos'}</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="il-sync-footer">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Branch</span>
                    <div style={{ position: 'relative', width: 260 }}>
                      <select
                        style={{ appearance: 'none', width: '100%', padding: '9px 32px 9px 14px', border: `1.5px solid ${syncTargetWarehouse ? '#7C3AED' : T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, outline: 'none', background: '#fff', cursor: 'pointer', boxShadow: syncTargetWarehouse ? '0 0 0 3px rgba(124,58,237,0.1)' : 'none' }}
                        value={syncTargetWarehouse}
                        onChange={e => setSyncTargetWarehouse(e.target.value)}
                      >
                        <option value="">— Choose Branch —</option>
                        {warehouses.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSyncModal(false)}
                    style={{ background: T.bg, border: `1.5px solid ${T.border}`, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.textSub }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSyncModalSubmit}
                    disabled={syncLoading || syncSelectedItems.length === 0 || !syncTargetWarehouse}
                    style={{ background: syncLoading || syncSelectedItems.length === 0 || !syncTargetWarehouse ? '#a78bfa' : 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: syncLoading || syncSelectedItems.length === 0 || !syncTargetWarehouse ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(124,58,237,0.3)', transition: 'all 0.15s' }}
                  >
                    {syncLoading ? <><Loader2 size={14} className="spin" />Syncing...</> : <><Warehouse size={14} />Sync {syncSelectedItems.length > 0 ? syncSelectedItems.length : ''} Items to Branch</>}
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* PAGINATION */}
        {!loading && total > 0 && (
          <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: `1.5px solid ${T.border}`, padding: '11px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: T.textMuted }}>
              <strong style={{ color: T.text }}>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)}</strong> of <strong style={{ color: T.text }}>{total}</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="il-tabs">
                {[20, 50, 100].map(s => <button key={s} className={`il-tab ${pageSize === s ? 'active' : ''}`} onClick={() => { setPageSize(s); setCurrentPage(1); }}>{s}</button>)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="il-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={15} /></button>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textSub, minWidth: 80, textAlign: 'center' }}>
                  {currentPage} / {totalPages}
                </span>
                <button className="il-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}><ChevronRight size={15} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== ITEM MODAL ========== */}
      {showForm && (
        <div className="il-modal-panel anim-in">
          <div className="il-modal-header" style={{ height: 'auto', minHeight: 64, padding: '12px 28px', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 'fit-content' }}>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
                  {isViewMode ? form.item_name : (isEditMode ? 'Edit Item Master' : 'New Item Master')}
                </div>
                {isViewMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{editingItemCode}</div>
                    <div style={{ width: 1, height: 10, background: T.border }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: form.disabled ? T.red : T.green }}>{form.disabled ? '● INACTIVE' : '● ACTIVE'}</span>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 6 }}>
                        <input
                          type="checkbox"
                          className="il-check"
                          checked={form.disabled}
                          onChange={e => handleDisableToggle(e.target.checked)}
                          style={{ margin: 0, width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 800, color: T.textSub }}>DEACTIVATE</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {isViewMode && (
                <div className="il-tabs" style={{ background: T.bg, padding: '3px', borderRadius: 12 }}>
                  {['General', 'Dashboard', 'Prices', 'Stock'].map(t => (
                    <button
                      key={t}
                      className={`il-tab ${activeTab === t ? 'active' : ''}`}
                      style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800, borderRadius: 9 }}
                      onClick={() => { setActiveTab(t); if (t !== 'Prices') setIsPriceDetailView(false); }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {isViewMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="il-btn il-btn-secondary"
                    style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => navigate(`/stockledgerreport?item_code=${editingItemCode}`)}
                    title="Stock Ledger Report"
                  >
                    <Activity size={14} /> <span style={{ fontSize: 11, fontWeight: 800 }}>Stock Ledger</span>
                  </button>
                  <button
                    className="il-btn il-btn-secondary"
                    style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => navigate(`/stockbalancereport?item_code=${editingItemCode}`)}
                    title="Stock Balance Report"
                  >
                    <Warehouse size={14} /> <span style={{ fontSize: 11, fontWeight: 800 }}>Stock Balance</span>
                  </button>
                  <button
                    className="il-btn il-btn-secondary"
                    style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#fff' }}
                    onClick={() => { setIsViewMode(false); setIsEditMode(true); }}
                  >
                    <Edit2 size={14} /> <span style={{ fontSize: 11, fontWeight: 800 }}>Edit</span>
                  </button>
                  <button className="il-btn il-btn-danger" style={{ height: 36, padding: '0 12px', borderRadius: 10 }} onClick={() => handleDelete(editingItemCode)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}


            </div>
          </div>

          {/* Body */}
          <div className="il-modal-body">

            {/* ===== VIEW MODE ===== */}
            {isViewMode && (
              <div className="anim-in">

                {/* GENERAL */}
                {activeTab === 'General' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                      <StatCard label="Valuation Rate" value={<span className="flex items-center gap-1"><DirhamIcon size={20} /> {Number(valuationData?.valuation_rate || form.valuation_rate || 0).toFixed(2)}</span>} accent={T.blue} />
                      <StatCard label="Last Buy Price" value={<span className="flex items-center gap-1"><DirhamIcon size={20} /> {Number(priceData.metrics?.last_buying_price || 0).toFixed(2)}</span>} accent={T.amber} />
                      <StatCard label="Total Stock" value={`${valuationData?.stock_qty || priceData.metrics?.total_stock || 0} ${form.default_uom}`} accent={T.purple} />
                      <StatCard label="Stock Value" value={<span className="flex items-center gap-1"><DirhamIcon size={20} /> {Number(valuationData?.stock_value || priceData.metrics?.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>} accent={T.green} />
                    </div>

                    {/* Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 280px', gap: 16 }}>
                      {/* Prices */}
                      <CardSection title="Price Lists" icon={<Tag size={14} />} action={<button className="il-btn il-btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setActiveTab('Prices')}><Edit2 size={12} />Manage</button>}>
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {dashboardData?.item_prices?.length > 0
                            ? dashboardData.item_prices.slice(0, 4).map((p, i) => (
                              <div key={i} className="group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: T.bg, borderRadius: 8, cursor: 'pointer' }} onClick={() => {
                                setActiveTab('Prices');
                                const found = (priceData.prices || []).find(pr => pr.price_list === p.price_list && pr.uom === p.uom);
                                if (found) { setPriceForm({ ...found }); setIsPriceDetailView(true); }
                                else { setPriceForm({ price_list: p.price_list, uom: p.uom, price_list_rate: p.price_list_rate, buying: p.price_list.toLowerCase().includes('buying') ? 1 : 0, selling: p.price_list.toLowerCase().includes('selling') ? 1 : 0, name: '' }); setIsPriceDetailView(true); }
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>{p.price_list}</div>
                                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{p.uom || 'Nos'}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{Number(p.price_list_rate || 0).toFixed(2)}</span>
                                  <div className="group-hover:opacity-100 opacity-0 transition-opacity" style={{ padding: 4, borderRadius: 6, background: T.blueLight, color: T.blue }}>
                                    <Edit2 size={12} />
                                  </div>
                                </div>
                              </div>
                            ))
                            : <div style={{ padding: '16px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No prices set</div>}
                        </div>
                      </CardSection>

                      {/* Catalog Info */}
                      <CardSection title="Catalog Info" icon={<Info size={14} />}>
                        <div style={{ padding: '14px 16px' }}>
                          {[
                            ['Group', form.item_group],
                            ['Brand', form.brand || '—'],
                            ['Base UOM', form.default_uom],
                            ['Valuation', `AED ${Number(form.valuation_rate || 0).toFixed(2)}`],
                            ['HSN Code', form.hsn_code || '—'],
                            ['Origin', form.country_of_origin || '—'],
                            ['Packing', `${form.custom_pieces_per_box || 0} ${form.default_uom} / Box`],
                          ].map(([l, v]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.borderLight}`, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>{l}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </CardSection>

                      <CardSection title="Branch Availability" icon={<MapPin size={14} />}>
                        <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {form.branch_availability?.length > 0
                            ? form.branch_availability.map((b, i) => (
                              <div key={i} style={{ padding: '6px 12px', background: T.blueLight, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Warehouse size={12} color={T.blue} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.blue }}>{b.warehouse}</span>
                              </div>
                            ))
                            : (
                              <div style={{ width: '100%', padding: '16px', textAlign: 'center', background: T.bg, borderRadius: 12 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>GLOBAL VISIBILITY</p>
                                <p style={{ fontSize: 10, color: T.textMuted }}>Available everywhere</p>
                              </div>
                            )}
                        </div>
                      </CardSection>

                      {/* Image + Barcodes — tall */}
                      <div className="il-card" style={{ gridRow: 'span 3', display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <div className="il-card-header"><span className="il-card-title">Identification</span></div>
                        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ aspectRatio: '1', background: T.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {form.imagePreview ? <img src={form.imagePreview} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={form.item_name} /> : <Package size={36} style={{ color: '#D1D9E6' }} />}
                          </div>
                          {barcodes?.length > 0 && (
                            <div style={{ padding: '10px 12px', background: T.surface, borderRadius: 10, border: `1.5px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                              <img
                                src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcodes[0].barcode)}&code=Code128`}
                                style={{ height: 38, maxWidth: '100%', filter: 'contrast(1.1)' }}
                                alt="Item Barcode"
                              />
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.5px' }}>{barcodes[0].barcode}</span>
                            </div>
                          )}
                          <div style={{ padding: '9px 12px', borderRadius: 9, background: form.disabled ? T.redLight : T.greenLight, border: `1.5px solid ${form.disabled ? '#FECACA' : '#BBF7D0'}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <ShieldCheck size={15} style={{ color: form.disabled ? T.red : T.green }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: form.disabled ? T.red : T.green }}>{form.disabled ? 'DISABLED' : 'OPERATIONAL'}</span>
                          </div>
                          <div>
                            <span className="il-section-label">Barcodes</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {barcodes?.length > 0
                                ? barcodes.map((b, i) => <span key={i} className="il-chip">{b.barcode}<span style={{ color: T.textMuted, fontFamily: 'inherit' }}>·{b.uom}</span></span>)
                                : <span style={{ fontSize: 12, color: T.textMuted }}>No barcodes</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description + Features */}
                      <div className="il-card" style={{ gridColumn: 'span 3' }}>
                        <div className="il-card-header"><span className="il-card-title"><FileText size={14} style={{ color: T.blue }} />Description & Features</span></div>
                        <div style={{ padding: '14px 16px' }}>
                          <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, marginBottom: 14 }}>{dashboardData?.item_details?.description || 'No description available.'}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[
                              ['Stock Tracking', form.is_stock_item === 1],
                              ['Sales', form.is_sales_item === 1],
                              ['Purchase', form.is_purchase_item === 1],
                              ['Loyalty Points', form.custom_loyalty_eligible === 1],
                              ['Discount', form.custom_allow_discount === 1],
                              ['Has Variants', form.has_variants === 1],
                            ].map(([l, on]) => (
                              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: on ? T.greenLight : T.bg, color: on ? T.green : T.textMuted, border: `1.5px solid ${on ? '#BBF7D0' : T.border}` }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: on ? T.green : T.border }} />{l}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ gridColumn: 'span 3' }}>
                        <CardSection title="Suppliers" icon={<Users size={14} />}>
                          <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {form.supplier_items?.length > 0
                              ? form.supplier_items.map((s, i) => (
                                <div key={i} style={{ padding: '10px 14px', background: T.bg, borderRadius: 12, border: `1px solid ${T.borderLight}`, flex: '1 1 200px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.supplier}</div>
                                  <div style={{ fontSize: 11, color: T.blue, fontWeight: 700, marginTop: 2 }}>Part: {s.supplier_part_no || '—'}</div>
                                </div>
                              ))
                              : <div style={{ width: '100%', padding: '16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No suppliers linked</div>}
                          </div>
                        </CardSection>
                      </div>

                    </div>
                  </div>
                )}

                {/* DASHBOARD */}
                {activeTab === 'Dashboard' && (
                  <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {loadingDashboard ? (
                      <div style={{ padding: '80px', textAlign: 'center' }}><Loader2 size={28} style={{ color: T.blue, margin: '0 auto' }} className="spin" /></div>
                    ) : (
                      <>
                        {/* Search & Date Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
                            <input
                              className="il-input"
                              style={{ paddingLeft: 40, background: 'transparent', border: 'none' }}
                              placeholder="Search records..."
                              value={connectionSearch}
                              onChange={e => setConnectionSearch(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: T.bg }} />
                            <span style={{ color: T.textMuted }}>—</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: T.bg }} />
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
                                  color: dashSubTab === tab ? T.blue : T.textMuted,
                                  border: 'none',
                                  background: 'none',
                                  borderBottom: dashSubTab === tab ? `2.5px solid ${T.blue}` : '2.5px solid transparent',
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
                                />
                              ));
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* PRICES */}
                {activeTab === 'Prices' && (
                  <div className="anim-in">
                    {!isPriceDetailView ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Price Registry</div>
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{priceData.prices?.length || 0} definitions for {editingItemCode}</div>
                          </div>
                          <button className="il-btn il-btn-primary" onClick={() => { setPriceForm({ price_list: 'Standard Selling', uom: form.default_uom, price_list_rate: 0, buying: 0, selling: 1, name: '' }); setIsPriceDetailView(true); }}>
                            <Plus size={14} />New Price
                          </button>
                        </div>
                        <div className="il-card" style={{ overflow: 'hidden' }}>
                          <table className="il-table">
                            <thead><tr><th>Price List</th><th>UOM</th><th>Type</th><th style={{ textAlign: 'right' }}><span className="flex items-center justify-end gap-1">Rate (<DirhamIcon size={10} />)</span></th><th style={{ width: 36 }}></th></tr></thead>
                            <tbody>
                              {loadingPrices ? (
                                <tr><td colSpan={5} style={{ padding: '50px', textAlign: 'center' }}><Loader2 size={24} style={{ color: T.blue, margin: '0 auto' }} className="spin" /></td></tr>
                              ) : priceData.prices?.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No prices configured</td></tr>
                              ) : priceData.prices.map((p, i) => (
                                <tr key={i} onClick={() => { setPriceForm({ ...p }); setIsPriceDetailView(true); }}>
                                  <td style={{ fontWeight: 600 }}>{p.price_list}</td>
                                  <td><span style={{ fontSize: 11, background: T.bg, padding: '2px 7px', borderRadius: 6, color: T.textSub, fontWeight: 600 }}>{p.uom}</span></td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                      {p.buying === 1 && <span className="il-badge il-badge-amber">Buying</span>}
                                      {p.selling === 1 && <span className="il-badge il-badge-green">Selling</span>}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{Number(p.price_list_rate || 0).toFixed(2)}</td>
                                  <td><ChevronRight size={14} style={{ color: T.textMuted }} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="anim-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                          <button className="il-btn il-btn-secondary" style={{ padding: '7px 9px' }} onClick={() => setIsPriceDetailView(false)}><ChevronLeft size={17} /></button>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>Price Configuration</div>
                            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>{priceForm.name || 'NEW RECORD'}</div>
                          </div>
                        </div>
                        <div className="il-card" style={{ maxWidth: 560, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                          <div className="il-form-grid-2">
                            <div className="il-form-field">
                              <label className="il-form-label">Price List</label>
                              <div style={{ position: 'relative' }}>
                                <select className="il-select" value={priceForm.price_list} onChange={e => setPriceForm(p => ({ ...p, price_list: e.target.value, buying: e.target.value.toLowerCase().includes('buying') ? 1 : p.buying, selling: e.target.value.toLowerCase().includes('selling') ? 1 : p.selling }))}>
                                  <option>Standard Selling</option><option>Standard Buying</option><option>Cash Selling</option><option>Retail Buying</option>
                                </select>
                                <ChevronDown size={13} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
                              </div>
                            </div>
                            <div className="il-form-field">
                              <label className="il-form-label">Unit (UOM)</label>
                              <div style={{ position: 'relative' }}>
                                <select className="il-select" value={priceForm.uom} onChange={e => setPriceForm(p => ({ ...p, uom: e.target.value }))}>
                                  {[form.default_uom, ...(form.uoms || []).map(u => u.uom), ...uoms.map(u => u.value)].filter((v, i, a) => v && a.indexOf(v) === i).map(u => <option key={u}>{u}</option>)}
                                </select>
                                <ChevronDown size={13} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
                              </div>
                            </div>
                          </div>
                          <div className="il-form-field">
                            <label className="il-form-label flex items-center gap-1">Rate (<DirhamIcon size={10} />)</label>
                            <input type="number" className="il-input" style={{ fontSize: 22, fontWeight: 700, height: 52, color: T.blue }} value={priceForm.price_list_rate} onChange={e => setPriceForm(p => ({ ...p, price_list_rate: Number(e.target.value) }))} onFocus={e => e.target.select()} />
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button className={`il-price-toggle buying ${priceForm.buying ? 'on' : ''}`} onClick={() => setPriceForm(p => ({ ...p, buying: p.buying ? 0 : 1 }))}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Buying</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: priceForm.buying ? T.amber : T.textMuted }}>{priceForm.buying ? 'Enabled' : 'Disabled'}</div>
                            </button>
                            <button className={`il-price-toggle selling ${priceForm.selling ? 'on' : ''}`} onClick={() => setPriceForm(p => ({ ...p, selling: p.selling ? 0 : 1 }))}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Selling</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: priceForm.selling ? T.green : T.textMuted }}>{priceForm.selling ? 'Enabled' : 'Disabled'}</div>
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6, borderTop: `1.5px solid ${T.borderLight}` }}>
                            <button className="il-btn il-btn-secondary" onClick={() => setIsPriceDetailView(false)}>Cancel</button>
                            <button className="il-btn il-btn-primary" onClick={handleSavePrice} disabled={saving}>{saving ? 'Saving...' : (priceForm.name ? 'Update' : 'Create')}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STOCK */}
                {activeTab === 'Stock' && (
                  <div className="anim-in">
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>Warehouse Stock</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Real-time inventory by location</div>
                    </div>
                    <div className="il-card" style={{ overflow: 'hidden' }}>
                      <table className="il-table">
                        <thead><tr><th>Warehouse</th><th style={{ textAlign: 'center' }}>On Hand</th><th style={{ textAlign: 'center' }}>Avg Buy Price</th><th style={{ textAlign: 'right' }}>Stock Value</th></tr></thead>
                        <tbody>
                          {loadingPrices ? (
                            <tr><td colSpan={4} style={{ padding: '50px', textAlign: 'center' }}><Loader2 size={24} style={{ color: T.blue, margin: '0 auto' }} className="spin" /></td></tr>
                          ) : priceData.warehouse_breakdown?.length > 0 ? (
                            priceData.warehouse_breakdown
                              .filter(w => !localStorage.getItem('warehouse') || w.warehouse === localStorage.getItem('warehouse'))
                              .map((w, i) => (
                                <tr key={i}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                      <div style={{ width: 30, height: 30, background: T.blueLight, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Warehouse size={14} color={T.blue} />
                                      </div>
                                      <span style={{ fontWeight: 600 }}>{w.warehouse}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: T.blue }}>{w.stock}</span>
                                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 3 }}>{form.default_uom}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <DirhamIcon size={11} style={{ color: T.textMuted, marginRight: 2 }} />
                                    <span style={{ fontWeight: 600 }}>{Number(w.avg_buying_price || 0).toFixed(2)}</span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <DirhamIcon size={11} style={{ color: T.textMuted, marginRight: 2 }} />
                                    <span style={{ fontWeight: 700, color: T.green }}>{Number(w.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </td>
                                </tr>
                              ))
                          ) : <tr><td colSpan={4} style={{ padding: '50px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No stock data found</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {/* Check All Branches Button */}
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                      <button
                        className="il-btn il-btn-secondary"
                        style={{ height: 44, padding: '0 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}
                        onClick={() => {
                          const html = `
                            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead style="position: sticky; top: 0; background: #fff; border-bottom: 2px solid #e2e8f0;">
                                  <tr>
                                    <th style="padding: 12px; text-align: left;">Warehouse</th>
                                    <th style="padding: 12px; text-align: right;">On Hand</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${priceData.warehouse_breakdown.map(w => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                      <td style="padding: 12px; font-weight: 600;">${w.warehouse}</td>
                                      <td style="padding: 12px; text-align: right; font-weight: 700; color: #2563eb;">${w.stock} ${form.default_uom}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                            </div>
                          `;
                          Swal.fire({
                            title: 'Global Stock Inventory',
                            html: html,
                            width: '500px',
                            showConfirmButton: false,
                            showCloseButton: true,
                            customClass: { popup: 'swal2-popup-custom' }
                          });
                        }}
                      >
                        <Search size={16} />
                        <span style={{ fontSize: 13, fontWeight: 800 }}>Check All Branches Stock</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ===== EDIT/CREATE FORM ===== */}
            {!isViewMode && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Specifications */}
                <CardSection title="Specifications" icon={<Package size={14} />}>
                  <div style={{ padding: 20 }}>
                    <div className="il-form-grid">
                      <div className="il-form-field">
                        <label className="il-form-label req">Item Code</label>
                        <input className="il-input" value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} disabled={isEditMode} placeholder="e.g. ITM-001" />
                      </div>
                      <div className="il-form-field">
                        <label className="il-form-label req">Item Name</label>
                        <input className="il-input" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="Full item name" />
                      </div>
                      <SearchableSelect
                        label="Item Group"
                        value={form.item_group}
                        options={itemGroups}
                        required
                        placeholder="Select Group"
                        onChange={val => setForm({ ...form, item_group: val })}
                        onAction={() => { const n = prompt('New Item Group:'); if (n) fetchItemGroups(); }}
                      />
                      <SearchableSelect
                        label="Brand"
                        value={form.brand}
                        options={brands}
                        placeholder="Select Brand"
                        onChange={val => setForm({ ...form, brand: val })}
                        onAction={() => { const n = prompt('New brand name:'); if (n) handleCreateBrand(n); }}
                      />
                      {!isEditMode && (
                        <SearchableSelect
                          label="Base UOM"
                          value={form.default_uom}
                          options={uoms}
                          required
                          placeholder="Select UOM"
                          onChange={val => setForm({ ...form, default_uom: val })}
                          onAction={() => { const n = prompt('New UOM name:'); if (n) handleCreateUom(n); }}
                        />
                      )}
                      <div className="il-form-field">
                        <label className="il-form-label">HSN / SAC Code</label>
                        <input className="il-input" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} placeholder="For GST mapping" />
                      </div>
                      <div className="il-form-field">
                        <SearchableSelect
                          label="Country of Origin"
                          value={form.country_of_origin}
                          options={countries}
                          placeholder="Select Country"
                          onChange={val => setForm({ ...form, country_of_origin: val })}
                        />
                      </div>
                      <div className="il-form-field">
                        <label className="il-form-label">Pieces Per Box</label>
                        <input type="number" className="il-input" value={form.custom_pieces_per_box} onChange={e => setForm({ ...form, custom_pieces_per_box: e.target.value })} placeholder="Conversion factor" />
                      </div>
                    </div>
                  </div>
                </CardSection>

                {/* Controls row */}
                <div className="il-form-grid-2">
                  <CardSection title="Inventory & Sales" icon={<BarChart2 size={14} />}>
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { key: 'is_stock_item', label: 'Track Stock', desc: 'Enables inventory ledger' },
                        { key: 'is_sales_item', label: 'Allow Sales', desc: 'Show in POS & Sales Orders' },
                        { key: 'is_purchase_item', label: 'Allow Purchase', desc: 'Available for procurement' },
                      ].map(f => (
                        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: form[f.key] === 1 ? T.blueLight : T.bg, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${form[f.key] === 1 ? T.blueMid : T.border}`, transition: 'all 0.15s' }}>
                          <input
                            type="checkbox"
                            className="il-check"
                            checked={form[f.key] === 1}
                            onChange={e => setForm({ ...form, [f.key]: e.target.checked ? 1 : 0 })}
                            tabIndex={showForm ? 0 : -1}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.label}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </CardSection>
                  <CardSection title="Loyalty & Status" icon={<Tag size={14} />}>
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { key: 'custom_loyalty_eligible', label: 'Loyalty Points', desc: 'Earn points on purchase' },
                        { key: 'custom_allow_discount', label: 'Allow Discount', desc: 'Enable manual overrides' },
                      ].map(f => (
                        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: form[f.key] === 1 ? T.blueLight : T.bg, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${form[f.key] === 1 ? T.blueMid : T.border}`, transition: 'all 0.15s' }}>
                          <input
                            type="checkbox"
                            className="il-check"
                            checked={form[f.key] === 1}
                            onChange={e => setForm({ ...form, [f.key]: e.target.checked ? 1 : 0 })}
                            tabIndex={showForm ? 0 : -1}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
                          </div>
                        </label>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: form.disabled ? T.redLight : T.bg, borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${form.disabled ? '#FECACA' : T.border}`, transition: 'all 0.15s' }}>
                        <input type="checkbox" className="il-check" checked={form.disabled} onChange={e => handleDisableToggle(e.target.checked)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.red }}>Disable Item</div>
                          <div style={{ fontSize: 11, color: '#FCA5A5' }}>Hide from active registries</div>
                        </div>
                      </label>
                    </div>
                  </CardSection>
                </div>

                {/* Barcodes */}
                <CardSection title="Barcodes" icon={<Barcode size={14} />}
                  action={
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="il-btn il-btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setShowCameraScanner(true)}><Camera size={12} />Camera</button>
                      <button className="il-btn il-btn-secondary" style={{ padding: '5px 10px', fontSize: 12, color: isScanning ? T.blue : T.textSub, borderColor: isScanning ? T.blue : T.border }} onClick={() => setIsScanning(s => !s)}>
                        {isScanning ? '● Scanning' : 'HW Scan'}
                      </button>
                    </div>
                  }
                >
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input ref={barcodeInputRef} className="il-input" style={{ flex: 1 }} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBarcode(barcodeInput)} placeholder="Type barcode and press Enter..." />
                      <button className="il-btn il-btn-primary" onClick={() => addBarcode(barcodeInput)}>Add</button>
                    </div>
                    {barcodes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {barcodes.map((b, i) => (
                          <span key={i} className="il-chip">
                            {b.barcode}<span style={{ color: T.textMuted }}>·{b.uom}</span>
                            <button onClick={() => setBarcodes(p => p.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardSection>

                {/* UOM + Suppliers */}
                <div className="il-form-grid-2">
                  <CardSection title="UOM Conversions" icon={<Scale size={14} />}
                    action={<button className="il-btn il-btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={addUomRow}><Plus size={12} />Add</button>}
                  >
                    {form.uoms.length > 0 ? (
                      <table className="il-table">
                        <thead><tr><th>UOM</th><th style={{ textAlign: 'right' }}>Factor</th><th style={{ width: 40 }}></th></tr></thead>
                        <tbody>
                          {form.uoms.map((u, i) => (
                            <tr key={i}>
                              <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                                <SearchableSelectInline
                                  value={u.uom}
                                  options={uoms}
                                  placeholder="Select UOM"
                                  onChange={val => updateUomRow(i, 'uom', val)}
                                />
                              </td>
                              <td style={{ paddingTop: 8, paddingBottom: 8 }}><input type="number" style={{ border: 'none', background: 'transparent', fontWeight: 600, width: '100%', textAlign: 'right', outline: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }} value={u.conversion_factor} onChange={e => updateUomRow(i, 'conversion_factor', Number(e.target.value))} /></td>
                              <td><button onClick={() => removeUomRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex' }}><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div style={{ padding: '18px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No additional UOMs</div>}
                  </CardSection>

                  <CardSection title="Branch Visibility" icon={<MapPin size={14} />}
                    action={<button className="il-btn il-btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={addBranchRow}><Plus size={12} />Add Branch</button>}
                  >
                    {form.branch_availability.length > 0 ? (
                      <table className="il-table">
                        <thead><tr><th>Target Warehouse</th><th style={{ width: 40 }}></th></tr></thead>
                        <tbody>
                          {form.branch_availability.map((b, i) => (
                            <tr key={i}>
                              <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                                <SearchableSelectInline
                                  value={b.warehouse}
                                  options={warehouses.length > 0 ? warehouses : (priceData.warehouse_breakdown?.map(w => ({ label: w.warehouse, value: w.warehouse })) || [])}
                                  placeholder="Select Branch"
                                  onChange={val => updateBranchRow(i, val)}
                                />
                              </td>
                              <td><button onClick={() => removeBranchRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex' }}><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div style={{ padding: '18px', textAlign: 'center', background: T.bg, borderRadius: 12, margin: 10 }}><p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>GLOBAL ALLOCATION</p></div>}
                  </CardSection>

                  <CardSection title="Supplier Mapping" icon={<Users size={14} />}
                    action={<button className="il-btn il-btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={addSupplierRow}><Plus size={12} />Add</button>}
                  >
                    {form.supplier_items.length > 0 ? (
                      <table className="il-table">
                        <thead><tr><th>Supplier</th><th>Part No</th><th style={{ width: 40 }}></th></tr></thead>
                        <tbody>
                          {form.supplier_items.map((s, i) => (
                            <tr key={i}>
                              <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                                <SearchableSelectInline
                                  value={s.supplier}
                                  options={suppliers.map(sup => ({ label: sup.supplier_name, value: sup.name }))}
                                  placeholder="Select"
                                  onChange={val => updateSupplierRow(i, 'supplier', val)}
                                />
                              </td>
                              <td style={{ paddingTop: 8, paddingBottom: 8 }}><input style={{ border: 'none', background: 'transparent', fontWeight: 600, width: '100%', outline: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }} value={s.supplier_part_no} onChange={e => updateSupplierRow(i, 'supplier_part_no', e.target.value)} placeholder="SKU / Part no" /></td>
                              <td><button onClick={() => removeSupplierRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex' }}><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div style={{ padding: '18px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No suppliers linked</div>}
                  </CardSection>
                </div>

                {/* Image */}
                <CardSection title="Product Image" icon={<Upload size={14} />}>
                  <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 72, height: 72, background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {form.imagePreview ? <img src={form.imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} style={{ color: '#D1D9E6' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="il-btn il-btn-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={13} />Upload Image</button>
                      {form.imagePreview && <button className="il-btn il-btn-danger" onClick={() => setForm({ ...form, image: null, imagePreview: null })}><X size={13} />Remove</button>}
                    </div>
                    <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleImageChange} />
                  </div>
                </CardSection>
              </div>
            )}
          </div>

          {/* Footer (edit/create only) */}
          {!isViewMode && (
            <div className="il-modal-footer">
              <button className="il-btn il-btn-secondary" onClick={handleCloseForm}>Discard</button>
              <button className="il-btn il-btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 110 }}>
                {saving ? <><Loader2 size={13} className="spin" />Saving...</> : (isEditMode ? 'Update Item' : 'Create Item')}
              </button>
            </div>
          )}
        </div>
      )}

      {showCameraScanner && <CameraScanner onScan={c => { addBarcode(c); setShowCameraScanner(false); }} onClose={() => setShowCameraScanner(false)} />}
      {showGlobalScan && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Camera Scanner</div>
              <button onClick={stopBarcodeScanner} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div id="global-list-scanner-reader" style={{ width: '100%', aspectRatio: '1.0', borderRadius: 16, overflow: 'hidden', background: '#000' }}></div>
              <button onClick={stopBarcodeScanner} style={{ width: '100%', marginTop: 20, padding: 12, background: T.blue, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700 }}>Stop Scanner</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}