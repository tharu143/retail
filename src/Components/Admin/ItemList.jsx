// src/Components/Admin/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle, Trash2, ChevronDown, Palette, Loader2, ChevronRight,
  Edit2, ShoppingCart, Barcode, Tag, Box, Boxes, Info, ShieldCheck, Scale, MapPin, Activity, FileText, Calendar,
  LayoutGrid, List, TrendingUp, Warehouse, DollarSign, BarChart2, RefreshCw, Zap, Layers, Sparkles, Scan, Copy
} from 'lucide-react';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import Swal from 'sweetalert2';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './SalesOrder.css';
import ListCustomizer from './ListCustomizer';
import CreateVariantModal from './CreateVariantModal';
import CreateMultipleVariantsModal from './CreateMultipleVariantsModal';
import NbiItemGeneratorModal from './NbiItemGeneratorModal';
import SubgroupFilterNavbar from './SubgroupFilterNavbar';
import BarcodePrintModal from './BarcodePrintModal';


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
    .il-modal-panel { position: fixed; top: 56px; bottom: 0; left: 280px; right: 0; z-index: 10000; background: ${T.bg}; display: flex; flex-direction: column; overflow: hidden; transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .sidebar-nav.collapsed ~ .right-content-panel .il-modal-panel { left: 80px; }
    @media (max-width: 768px) {
      .il-modal-panel { left: 0 !important; }
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
    .il-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; user-select: none; }
    .il-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .il-switch-track { position: relative; width: 38px; height: 22px; background-color: #cbd5e1; border-radius: 20px; transition: background-color 0.25s ease; flex-shrink: 0; }
    .il-switch input:checked + .il-switch-track { background-color: #2563eb; }
    .il-switch input:checked + .il-switch-track.purple { background-color: #7c3aed; }
    .il-switch input:disabled + .il-switch-track { opacity: 0.5; cursor: not-allowed; }
    .il-switch-thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background-color: #ffffff; border-radius: 50%; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .il-switch input:checked + .il-switch-track .il-switch-thumb { transform: translateX(16px); }

    /* SweetAlert Custom Popup & Buttons */
    .swal2-container { z-index: 30000 !important; }
    .swal2-popup.swal2-popup-custom {
      border-radius: 20px !important;
      padding: 24px 28px !important;
      font-family: 'Gilroy', sans-serif !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
      border: 1px solid #e2e8f0 !important;
    }
    .swal2-title.swal2-title-custom {
      font-size: 20px !important;
      font-weight: 800 !important;
      color: #0f172a !important;
      margin-bottom: 8px !important;
    }
    .swal2-html-container.swal2-text-custom {
      font-size: 14px !important;
      font-weight: 500 !important;
      color: #64748b !important;
      margin: 8px 0 20px !important;
      line-height: 1.5 !important;
    }
    .swal2-actions.swal2-actions-custom {
      display: flex !important;
      gap: 12px !important;
      justify-content: center !important;
      margin-top: 14px !important;
      width: 100% !important;
    }
    .swal2-confirm-btn-custom {
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      color: #ffffff !important;
      font-family: 'Gilroy', sans-serif !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      padding: 10px 22px !important;
      border-radius: 12px !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3) !important;
    }
    .swal2-confirm-btn-custom:hover {
      background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 18px rgba(239, 68, 68, 0.4) !important;
    }
    .swal2-cancel-btn-custom {
      background: #f1f5f9 !important;
      color: #475569 !important;
      font-family: 'Gilroy', sans-serif !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      padding: 10px 20px !important;
      border-radius: 12px !important;
      border: 1.5px solid #e2e8f0 !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    .swal2-cancel-btn-custom:hover {
      background: #e2e8f0 !important;
      color: #1e293b !important;
    }
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.blue}`, borderRadius: T.radius, zIndex: 1100, marginTop: 4, maxHeight: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: T.shadowMd }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.borderLight}`, background: T.bg, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="il-input" style={{ height: 34, fontSize: 13 }} autoFocus placeholder="Type to search..." value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} />
            {onAction && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAction(search); setOpen(false); }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: T.blueLight,
                  color: T.blue,
                  border: `1.5px dashed ${T.blue}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e0e7ff'}
                onMouseOut={e => e.currentTarget.style.background = T.blueLight}
              >
                <Plus size={14} /> + Create New {label?.replace(/Select/gi, '') || 'Item'}...
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: T.textMuted }}>No matching results found for "{search}"</span>
                {onAction && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAction(search); setOpen(false); }}
                    style={{
                      padding: '8px 14px',
                      background: T.blue,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Plus size={14} /> Create "{search}" as {label || 'Option'}
                  </button>
                )}
              </div>
            ) : filtered.map(o => (
              <div key={o.value} onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); setSearch(''); }} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', background: String(value) === String(o.value) ? T.blueLight : 'transparent', color: String(value) === String(o.value) ? T.blue : T.text, fontWeight: String(value) === String(o.value) ? 600 : 500, borderBottom: `1px solid ${T.borderLight}` }} onMouseOver={e => e.currentTarget.style.background = T.bg} onMouseOut={e => e.currentTarget.style.background = String(value) === String(o.value) ? T.blueLight : 'transparent'}>
                {o.label}
              </div>
            ))}
          </div>
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
  const filtered = (options || []).map(o => typeof o === 'string' ? { label: o, value: o } : o).filter(o => String(o.label || o.value || '').toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = (options || []).map(o => typeof o === 'string' ? { label: o, value: o } : o).find(o => String(o.value) === String(value))?.label || value;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        onClick={() => setOpen(!open)}
        className="il-input"
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 32,
          padding: '0 8px',
          background: '#ffffff',
          fontSize: 12,
          border: `1.5px solid ${open ? '#8b5cf6' : '#cbd5e1'}`,
          borderRadius: 6,
          boxShadow: open ? '0 0 0 2px rgba(139, 92, 246, 0.12)' : 'none',
          userSelect: 'none',
          transition: 'all 0.15s'
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: value ? '#1e293b' : '#94a3b8' }}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={13} style={{ color: '#64748b', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', marginLeft: 4 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, minWidth: 200, background: '#ffffff', border: '1.5px solid #8b5cf6', borderRadius: 8, zIndex: 1200, marginTop: 4, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ padding: 6, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <input
              style={{ width: '100%', height: 28, fontSize: 11, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 5, outline: 'none' }}
              autoFocus
              placeholder="Filter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>No matches</div> : filtered.map(o => (
              <div
                key={o.value}
                onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); setSearch(''); }}
                style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', background: String(value) === String(o.value) ? '#f5f3ff' : 'transparent', color: String(value) === String(o.value) ? '#7c3aed' : '#1e293b', fontWeight: String(value) === String(o.value) ? 700 : 500, borderBottom: '1px solid #f8fafc' }}
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

/* ========== SEARCHABLE SELECT COMPACT (FOR PRICE LISTS / MINI DROPDOWNS / ATTRIBUTES) ========== */
const SearchableSelectCompact = ({ value, options = [], onChange, placeholder = 'Select...', onAction, actionLabel, style, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const normOptions = useMemo(() => {
    return options.map(o => typeof o === 'string' ? { label: o, value: o } : o);
  }, [options]);

  const filtered = useMemo(() => {
    if (!search) return normOptions;
    const q = search.toLowerCase();
    return normOptions.filter(o => String(o.label || o.value || '').toLowerCase().includes(q));
  }, [normOptions, search]);

  const selectedItem = normOptions.find(o => String(o.value) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        onClick={() => { if (!disabled) setOpen(!open); }}
        className="il-input"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 36,
          padding: '0 10px',
          background: disabled ? '#f1f5f9' : '#ffffff',
          opacity: disabled ? 0.85 : 1,
          fontSize: 13,
          border: `1.5px solid ${open && !disabled ? '#8b5cf6' : '#cbd5e1'}`,
          borderRadius: 8,
          boxShadow: open && !disabled ? '0 0 0 3px rgba(139, 92, 246, 0.15)' : 'none',
          userSelect: 'none',
          transition: 'all 0.15s'
        }}
      >
        <span style={{ color: value ? '#1e293b' : '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedItem?.label || value || placeholder}
        </span>
        <ChevronDown size={14} style={{ color: disabled ? '#94a3b8' : '#64748b', flexShrink: 0, transform: open && !disabled ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          minWidth: 220,
          background: '#ffffff',
          border: '1.5px solid #8b5cf6',
          borderRadius: 8,
          zIndex: 1200,
          marginTop: 4,
          maxHeight: 240,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)'
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              style={{
                width: '100%',
                height: 30,
                fontSize: 12,
                padding: '0 10px',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                outline: 'none',
                background: '#fff'
              }}
              autoFocus
              placeholder="Search / Filter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {onAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onAction(search);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#f5f3ff',
                  color: '#6d28d9',
                  border: '1px dashed #8b5cf6',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                <Plus size={12} /> {actionLabel || 'Create New'}
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 170 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                No options found
              </div>
            ) : (
              filtered.map(o => {
                const isSelected = String(value) === String(o.value);
                return (
                  <div
                    key={o.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(o.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      background: isSelected ? '#f5f3ff' : 'transparent',
                      color: isSelected ? '#6d28d9' : '#334155',
                      fontWeight: isSelected ? 700 : 500,
                      borderBottom: '1px solid #f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{o.label}</span>
                    {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />}
                  </div>
                );
              })
            )}
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
  attributes: [],
  opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0, brand: '',
  default_uom: 'Nos', description: '', image: null, imagePreview: null,
  uoms: [{ uom: 'Nos', conversion_factor: 1 }], hsn_code: '', country_of_origin: '', custom_loyalty_eligible: 0, custom_allow_discount: 1,
  is_stock_item: 1, is_sales_item: 1, is_purchase_item: 1, supplier_items: [],
  branch_availability: [], custom_pieces_per_box: 0,
  buying_price_list: 'Standard Buying', buying_price: 0,
  selling_price_list: 'Standard Selling', selling_price: 0,
  box_buying_price_list: 'Standard Buying', box_buying_price: 0,
  box_selling_price_list: 'Standard Selling', box_selling_price: 0,
  master_box_buying_price_list: 'Standard Buying', master_box_buying_price: 0,
  master_box_selling_price_list: 'Standard Selling', master_box_selling_price: 0
});

/* ========== MAIN COMPONENT ========== */
export default function ItemList() {
  const navigate = useNavigate();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Item');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
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

  // New POS 5 features states
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showMultipleVariantModal, setShowMultipleVariantModal] = useState(false);
  const [showHeaderCreateDropdown, setShowHeaderCreateDropdown] = useState(false);
  const headerCreateMenuRef = useRef(null);
  const [showNbiModal, setShowNbiModal] = useState(false);
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false);
  const [selectedBarcodeItem, setSelectedBarcodeItem] = useState(null);
  const [subgroupFilterMain, setSubgroupFilterMain] = useState('All');
  const [subgroupFilterSub, setSubgroupFilterSub] = useState('All');
  const [groupHierarchy, setGroupHierarchy] = useState([]);
  const [formMainGroup, setFormMainGroup] = useState('');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerCreateMenuRef.current && !headerCreateMenuRef.current.contains(e.target)) {
        setShowHeaderCreateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeUom, setBarcodeUom] = useState('Nos');

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
  const [masterPriceLists, setMasterPriceLists] = useState([]);
  const [onlyPackingUoms, setOnlyPackingUoms] = useState(() => {
    const saved = localStorage.getItem('uom_filter_packing_only');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    const handleUomSettingChanged = () => {
      const saved = localStorage.getItem('uom_filter_packing_only');
      setOnlyPackingUoms(saved !== null ? saved === 'true' : true);
    };
    window.addEventListener('uom_setting_changed', handleUomSettingChanged);
    return () => window.removeEventListener('uom_setting_changed', handleUomSettingChanged);
  }, []);

  const isPackingUom = (uomValue) => {
    if (!uomValue) return false;
    const val = String(uomValue).trim().toLowerCase();
    const packingKeywords = [
      'nos', 'no', 'box', 'boxes', 'pcs', 'piece', 'pieces', 'pkt', 'packet', 'packets',
      'ctn', 'carton', 'cartons', 'doz', 'dozen', 'set', 'sets', 'pack', 'packs',
      'pair', 'pairs', 'bag', 'bags', 'bundle', 'bundles', 'roll', 'rolls',
      'bottle', 'bottles', 'can', 'cans', 'jar', 'jars', 'tin', 'tins', 'strip', 'strips',
      'unit', 'units', 'case', 'cases', 'crate', 'crates', 'bale', 'bales'
    ];
    return packingKeywords.some(k => val === k || val === `${k}.` || val.startsWith(`${k} `) || val.endsWith(` ${k}`));
  };

  const baseUomOptions = useMemo(() => {
    if (!onlyPackingUoms) return uoms;
    const filtered = uoms.filter(u => isPackingUom(u.value) || isPackingUom(u.label) || u.value === form.default_uom);
    const defaultPacking = [
      { label: 'Nos', value: 'Nos' },
      { label: 'Box', value: 'Box' },
      { label: 'Pcs', value: 'Pcs' },
      { label: 'Pkt', value: 'Pkt' },
      { label: 'Carton', value: 'Carton' },
      { label: 'Set', value: 'Set' },
      { label: 'Pack', value: 'Pack' },
      { label: 'Dozen', value: 'Dozen' }
    ];
    const merged = [...filtered];
    defaultPacking.forEach(dp => {
      if (!merged.some(m => String(m.value).toLowerCase() === dp.value.toLowerCase())) {
        merged.push(dp);
      }
    });
    return merged;
  }, [uoms, onlyPackingUoms, form.default_uom]);

  const [countries, setCountries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [attributeValuesMap, setAttributeValuesMap] = useState({});
  const [variantForm, setVariantForm] = useState({
    create_first_variant: true,
    initial_variants: [
      {
        id: 'var-1',
        selected_attributes: {},
        variant_item_code: '',
        variant_item_name: '',
        variant_barcode: '',
        use_custom_code: true
      }
    ]
  });
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  // ── Item Group Modal ──
  const [showItemGroupModal, setShowItemGroupModal] = useState(false);
  const [itemGroupModalForm, setItemGroupModalForm] = useState({
    item_group_name: '',
    parent_item_group: 'All Item Groups',
    is_group: false,
  });
  const [savingItemGroup, setSavingItemGroup] = useState(false);

  // ── Add Attribute / Value Modal ──
  const [showAddAttrValueModal, setShowAddAttrValueModal] = useState(false);
  const [attrModalData, setAttrModalData] = useState({
    attribute_name: '',
    attribute_value: '',
    abbr: '',
    targetRowIndex: null,
    isNewAttribute: false,
    attributeIndex: null
  });
  const [savingAttrValue, setSavingAttrValue] = useState(false);

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

  // ── Branch & Price List resolution for logged-in user ──
  const userWarehouse = localStorage.getItem('warehouse') || warehouse || '';
  const userBranchClean = useMemo(() => {
    if (!userWarehouse) return '';
    return userWarehouse
      .replace(/\s*(?:Warehouse|-|\(.*?\)).*$/i, '')
      .replace(' - kyle', '')
      .trim();
  }, [userWarehouse]);

  const buyingPriceListOptions = useMemo(() => {
    const fromMaster = (masterPriceLists || [])
      .filter(p => p.buying === 1)
      .map(p => p.name)
      .filter(n => n.toLowerCase().includes('buying') || n.toLowerCase().includes('standard'));
    const fromItem = (priceData?.prices || [])
      .filter(p => p.buying === 1)
      .map(p => p.price_list)
      .filter(n => n && (n.toLowerCase().includes('buying') || n.toLowerCase().includes('standard')));
    
    let all = Array.from(new Set(['Standard Buying', ...fromMaster, ...fromItem].filter(Boolean)));
    
    // If user has a branch (e.g. Al Rayyana Mall), filter only their branch price lists & Standard Buying
    if (userBranchClean) {
      const branchBuyingName = `${userBranchClean} Buying`;
      const branchMatches = all.filter(n => n.toLowerCase().includes(userBranchClean.toLowerCase()));
      all = Array.from(new Set([
        branchMatches.find(n => n.toLowerCase() === branchBuyingName.toLowerCase()) || branchMatches[0] || branchBuyingName,
        'Standard Buying',
        ...branchMatches
      ].filter(Boolean)));
    }

    return all;
  }, [masterPriceLists, priceData?.prices, userBranchClean]);

  const sellingPriceListOptions = useMemo(() => {
    const fromMaster = (masterPriceLists || [])
      .filter(p => p.selling === 1)
      .map(p => p.name)
      .filter(n => n.toLowerCase().includes('selling') || n.toLowerCase().includes('standard'));
    const fromItem = (priceData?.prices || [])
      .filter(p => p.selling === 1)
      .map(p => p.price_list)
      .filter(n => n && (n.toLowerCase().includes('selling') || n.toLowerCase().includes('standard')));
    
    let all = Array.from(new Set(['Standard Selling', ...fromMaster, ...fromItem].filter(Boolean)));

    // If user has a branch (e.g. Al Rayyana Mall), filter only their branch price lists & Standard Selling
    if (userBranchClean) {
      const branchSellingName = `${userBranchClean} Selling`;
      const branchMatches = all.filter(n => n.toLowerCase().includes(userBranchClean.toLowerCase()));
      all = Array.from(new Set([
        branchMatches.find(n => n.toLowerCase() === branchSellingName.toLowerCase()) || branchMatches[0] || branchSellingName,
        'Standard Selling',
        ...branchMatches
      ].filter(Boolean)));
    }

    return all;
  }, [masterPriceLists, priceData?.prices, userBranchClean]);
  const [toDate, setToDate] = useState('');
  const [connectionActiveTab, setConnectionActiveTab] = useState(null);
  const [valuationData, setValuationData] = useState(null);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [templateVariants, setTemplateVariants] = useState([]);
  const [loadingTemplateVariants, setLoadingTemplateVariants] = useState(false);
  const [productBundleData, setProductBundleData] = useState(null);
  const [loadingProductBundle, setLoadingProductBundle] = useState(false);

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

  useEffect(() => { fetchBrands(); fetchUoms(); fetchCountries(); fetchSuppliers(); fetchWarehouses(); fetchItemAttributes(); fetchMasterPriceLists(); }, []);

  const handleAdd = () => {
    resetForm();
    const myWh = localStorage.getItem('warehouse');
    const myBranch = myWh ? myWh.replace(/\s*(?:Warehouse|-|\(.*?\)).*$/i, '').replace(' - kyle', '').trim() : '';
    const defBuying = myBranch ? `${myBranch} Buying` : 'Standard Buying';
    const defSelling = myBranch ? `${myBranch} Selling` : 'Standard Selling';
    
    if (myWh) {
      setForm(p => ({
        ...p,
        branch_availability: [{ warehouse: myWh }],
        buying_price_list: defBuying,
        selling_price_list: defSelling,
        box_buying_price_list: defBuying,
        box_selling_price_list: defSelling,
        master_box_buying_price_list: defBuying,
        master_box_selling_price_list: defSelling
      }));
    }
    setShowForm(true); fetchItemGroups(); fetchBrands(); fetchUoms(); fetchCountries(); fetchItemAttributes(); fetchMasterPriceLists();
  };

  useEffect(() => {
    fetchItems();
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('action') === 'new' || location.state?.action === 'new') {
      setTimeout(() => {
        handleAdd();
      }, 300);
    }
  }, [customColumns, location.search]);

  useEffect(() => {
    const handleCloseModalEvent = () => {
      setShowForm(false);
    };
    window.addEventListener('close-item-modal', handleCloseModalEvent);
    return () => window.removeEventListener('close-item-modal', handleCloseModalEvent);
  }, []);

  useEffect(() => {
    if (showForm) {
      window.history.pushState({ modal: 'item-details' }, '');
      const handlePopState = () => {
        setShowForm(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [showForm]);

  useEffect(() => {
    if (showForm || isEditMode) { const t = setTimeout(() => fetchItemGroups(groupSearch), 300); return () => clearTimeout(t); }
  }, [groupSearch, showForm, isEditMode]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      // Use the custom retail API which returns barcodes and other retail-ready data
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
        params: {
          warehouse: !isAdmin ? warehouse : undefined,
          extra_fields: JSON.stringify(customColumns),
          include_templates: 1
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
      // Fetch full Item doc using frappe method to get full attributes and settings
      try {
        let itm = null;
        try {
          const fullItemRes = await axios.get(`/api/resource/Item/${encodeURIComponent(code)}`, { withCredentials: true });
          itm = fullItemRes.data?.data;
        } catch {
          const clientGetRes = await axios.get('/api/method/frappe.client.get', {
            params: { doctype: 'Item', name: code },
            withCredentials: true
          });
          itm = clientGetRes.data?.message;
        }

        if (itm) {
          const rawAttrs = itm.attributes || [];
          const formattedAttrs = rawAttrs.map(a => {
            if (typeof a === 'object' && a !== null) {
              return {
                attribute: a.attribute || a.attribute_name || a.name,
                attribute_value: a.attribute_value || undefined
              };
            }
            return { attribute: a };
          }).filter(a => a.attribute);

          const isVar = Boolean(itm.variant_of);
          setForm(prev => ({
            ...prev,
            has_variants: itm.has_variants === 1,
            attributes: formattedAttrs,
            is_stock_item: isVar ? 1 : itm.is_stock_item,
            is_sales_item: isVar ? (itm.is_sales_item !== undefined && itm.is_sales_item !== null ? itm.is_sales_item : 1) : itm.is_sales_item,
            is_purchase_item: isVar ? (itm.is_purchase_item !== undefined && itm.is_purchase_item !== null ? itm.is_purchase_item : 1) : itm.is_purchase_item,
            maintain_stock: isVar ? 1 : (itm.has_variants ? 0 : 1),
            variant_of: itm.variant_of || '',
            variant_based_on: itm.variant_based_on || (itm.variant_of ? 'Item Attribute' : undefined),
            brand: itm.brand || prev.brand,
            country_of_origin: itm.country_of_origin || prev.country_of_origin,
            custom_pieces_per_box: itm.custom_pieces_per_box || prev.custom_pieces_per_box,
            hsn_code: itm.hsn_code || prev.hsn_code,
            description: itm.description || prev.description
          }));

          // If template item, fetch all created variants and populate editable cards
          if (itm.has_variants === 1) {
            setLoadingTemplateVariants(true);
            try {
              const varRes = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_template_variants', {
                params: { template_item_code: code },
                withCredentials: true
              });
              if (varRes.data?.message?.status === 'success') {
                const fetchedVariants = varRes.data.message.data || [];
                setTemplateVariants(fetchedVariants);

                if (fetchedVariants.length > 0) {
                  const mappedVariants = fetchedVariants.map((v, idx) => {
                    const attrMap = {};
                    (v.attributes || []).forEach(a => {
                      if (a.attribute && a.attribute_value) {
                        attrMap[a.attribute] = a.attribute_value;
                      }
                    });

                    // Barcodes
                    let nosBarcode = '';
                    let boxBarcode = '';
                    (v.barcodes || []).forEach(b => {
                      if (b.uom === 'Box') boxBarcode = b.barcode;
                      else if (!nosBarcode) nosBarcode = b.barcode;
                    });

                    return {
                      id: `var-existing-${v.name || idx}-${Date.now()}`,
                      is_existing: true,
                      selected_attributes: attrMap,
                      variant_item_code: v.name,
                      variant_item_name: v.item_name || '',
                      variant_barcode: nosBarcode,
                      nos_barcode: nosBarcode,
                      box_barcode: boxBarcode,
                      buying_price: v.buying_price !== undefined ? v.buying_price : '',
                      selling_price: v.selling_price !== undefined ? v.selling_price : (v.standard_rate || ''),
                      box_buying_price: v.box_buying_price !== undefined ? v.box_buying_price : '',
                      box_selling_price: v.box_selling_price !== undefined ? v.box_selling_price : '',
                      custom_pieces_per_box: v.custom_pieces_per_box !== undefined ? v.custom_pieces_per_box : '',
                      image: v.image || '',
                      imagePreview: v.image || '',
                      use_custom_code: true,
                      disabled: Boolean(v.disabled),
                      brand: v.brand || itm.brand || '',
                      country_of_origin: v.country_of_origin || itm.country_of_origin || '',
                      item_group: v.item_group || itm.item_group || '',
                      stock_uom: v.stock_uom || itm.stock_uom || 'Nos',
                      is_stock_item: v.is_stock_item !== undefined ? v.is_stock_item : 1,
                      is_sales_item: v.is_sales_item !== undefined ? v.is_sales_item : 1,
                      is_purchase_item: v.is_purchase_item !== undefined ? v.is_purchase_item : 1,
                      custom_loyalty_eligible: v.custom_loyalty_eligible !== undefined ? v.custom_loyalty_eligible : 1,
                      custom_allow_discount: v.custom_allow_discount !== undefined ? v.custom_allow_discount : 1,
                      branch_availability: v.branch_availability || [],
                      supplier_items: v.supplier_items || []
                    };
                  });

                  setVariantForm({
                    create_first_variant: true,
                    initial_variants: mappedVariants
                  });
                }
              }
            } catch (vErr) {
              console.warn('Error fetching template variants:', vErr);
            } finally {
              setLoadingTemplateVariants(false);
            }
          } else {
            setTemplateVariants([]);
          }

          // Check and fetch Product Bundle data if this item is a bundle
          setLoadingProductBundle(true);
          try {
            const bundleRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_product_bundle', {
              params: { item_code: code, warehouse: localStorage.getItem('warehouse') || warehouse },
              withCredentials: true
            });
            if (bundleRes.data?.message?.status === 'success' && bundleRes.data.message.is_bundle) {
              setProductBundleData(bundleRes.data.message.bundle);
            } else if (bundleRes.data?.status === 'success' && bundleRes.data?.is_bundle) {
              setProductBundleData(bundleRes.data.bundle);
            } else {
              setProductBundleData(null);
            }
          } catch (bErr) {
            console.warn('Error fetching bundle:', bErr);
            setProductBundleData(null);
          } finally {
            setLoadingProductBundle(false);
          }
        }
      } catch (errDoc) {
        console.warn('Full item fetch error:', errDoc);
      }
    } catch {
      setDashboardData({});
    } finally {
      setLoadingDashboard(false);
    }
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
      // Fetch hierarchy structure for main group / subgroup pairing
      const hRes = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_group_hierarchy');
      if (hRes.data?.message?.status === 'success') {
        setGroupHierarchy(hRes.data.message.hierarchy || []);
      }
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

  const fetchMasterPriceLists = async () => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_price_lists', { withCredentials: true });
      const raw = res.data?.data || res.data?.message?.data || res.data?.message || [];
      if (Array.isArray(raw)) {
        setMasterPriceLists(raw.map(p => ({
          name: p.name,
          buying: Number(p.buying),
          selling: Number(p.selling),
          enabled: p.enabled === undefined ? 1 : Number(p.enabled)
        })).filter(p => p.enabled !== 0));
      }
    } catch (e) {
      console.warn('Failed to fetch master price lists:', e);
    }
  };

  const DEFAULT_ATTRS = ['Colour', 'Size', 'Pack Size', 'GSM', 'Brand', 'Pages', 'Binding', 'Type'];
  const HARDCODED_ATTR_VALUES = {
    'Colour': [
      { attribute_value: 'Blue', abbr: 'BLU' },
      { attribute_value: 'Black', abbr: 'BLA' },
      { attribute_value: 'Red', abbr: 'RED' },
      { attribute_value: 'Green', abbr: 'GRE' },
      { attribute_value: 'White', abbr: 'WHI' },
      { attribute_value: 'Orange', abbr: 'Org' },
      { attribute_value: 'Yellow', abbr: 'Yellow' },
      { attribute_value: 'Pink', abbr: 'Pink' },
      { attribute_value: 'Transparent', abbr: 'Transparent' }
    ],
    'Size': [
      { attribute_value: 'Small', abbr: 'S' },
      { attribute_value: 'Medium', abbr: 'M' },
      { attribute_value: 'Large', abbr: 'L' },
      { attribute_value: 'Extra Large', abbr: 'XL' },
      { attribute_value: 'Extra Small', abbr: 'XS' },
      { attribute_value: 'A4', abbr: 'A4' },
      { attribute_value: 'A3', abbr: 'A3' },
      { attribute_value: 'A5', abbr: 'A5' },
      { attribute_value: 'B5', abbr: 'B5' }
    ],
    'Pack Size': [
      { attribute_value: 'Single', abbr: '1' },
      { attribute_value: 'Pack of 10', abbr: '10' },
      { attribute_value: 'Pack of 50', abbr: '50' }
    ],
    'GSM': [
      { attribute_value: '70 GSM', abbr: '70' },
      { attribute_value: '80 GSM', abbr: '80' },
      { attribute_value: '100 GSM', abbr: '100' }
    ],
    'Pages': [
      { attribute_value: '100 Pages', abbr: '100P' },
      { attribute_value: '200 Pages', abbr: '200P' },
      { attribute_value: '300 Pages', abbr: '300P' },
      { attribute_value: '400 Pages', abbr: '400P' }
    ],
    'Binding': [
      { attribute_value: 'Hard Bound', abbr: 'HB' },
      { attribute_value: 'Spiral Bound', abbr: 'SB' },
      { attribute_value: 'Soft Cover', abbr: 'SC' }
    ],
    'Type': [
      { attribute_value: 'Ruled', abbr: 'RUL' },
      { attribute_value: 'Unruled', abbr: 'UNR' },
      { attribute_value: 'Grid', abbr: 'GRD' },
      { attribute_value: 'Dotted', abbr: 'DOT' }
    ]
  };

  const fetchItemAttributes = async () => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_all_item_attributes_and_values', { withCredentials: true });
      const data = res.data?.message || {};
      
      const list = data.attributes || [];
      let attrList = (Array.isArray(list) ? list : []).map(a => ({
        label: a.attribute_name || a.name,
        value: a.attribute_name || a.name
      }));

      // Combine with default stationery/retail attributes if not in list
      DEFAULT_ATTRS.forEach(dAttr => {
        if (!attrList.some(x => x.value === dAttr)) {
          attrList.push({ label: dAttr, value: dAttr });
        }
      });

      setAvailableAttributes(attrList);

      const map = { ...HARDCODED_ATTR_VALUES };
      const values = data.values || [];
      (Array.isArray(values) ? values : []).forEach(v => {
        const p = v.parent;
        if (p) {
          if (!map[p]) map[p] = [];
          if (!map[p].some(x => x.attribute_value === v.attribute_value)) {
            map[p].push(v);
          }
        }
      });
      setAttributeValuesMap(map);
    } catch (err) {
      console.warn('Using local fallback for item attributes:', err);
      setAvailableAttributes(DEFAULT_ATTRS.map(a => ({ label: a, value: a })));
      setAttributeValuesMap(HARDCODED_ATTR_VALUES);
    }
  };

  const handleSaveNewAttributeValue = async () => {
    const { attribute_name, attribute_value, abbr, targetRowIndex } = attrModalData;
    if (!attribute_name || !attribute_value) {
      alert('Attribute name and value are required.');
      return;
    }
    try {
      setSavingAttrValue(true);
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.add_custom_item_attribute_value', {
        attribute_name: attribute_name.trim(),
        attribute_value: attribute_value.trim(),
        abbr: (abbr || '').trim() || attribute_value.trim()
      });

      const data = res.data?.message || {};
      if (data.status === 'success' || data.attribute_value) {
        const newVal = { attribute_value: data.attribute_value, abbr: data.abbr || '' };
        
        // Update local attributeValuesMap
        setAttributeValuesMap(prev => {
          const currentList = prev[attribute_name] || [];
          if (!currentList.some(x => x.attribute_value === newVal.attribute_value)) {
            return { ...prev, [attribute_name]: [...currentList, newVal] };
          }
          return prev;
        });

        // If this is a new attribute created from template attributes section
        if (attrModalData.isNewAttribute) {
          const newAttrName = attribute_name.trim();
          setForm(prevForm => {
            const currentAttrs = [...(prevForm.attributes || [])];
            if (attrModalData.attributeIndex !== null && attrModalData.attributeIndex !== undefined && currentAttrs[attrModalData.attributeIndex]) {
              currentAttrs[attrModalData.attributeIndex] = { attribute: newAttrName };
            } else if (!currentAttrs.some(a => (a.attribute || a) === newAttrName)) {
              currentAttrs.push({ attribute: newAttrName });
            }
            return { ...prevForm, attributes: currentAttrs };
          });

          // Also set first attribute value on variant rows
          setVariantForm(vf => {
            const updatedVariants = (vf.initial_variants || []).map(v => {
              const currentSelected = { ...(v.selected_attributes || {}) };
              if (!currentSelected[newAttrName]) {
                currentSelected[newAttrName] = newVal.attribute_value;
              }
              const attrStr = Object.values(currentSelected).filter(Boolean).join('-');
              return {
                ...v,
                selected_attributes: currentSelected,
                variant_item_code: attrStr ? `${form.item_code || 'ITEM'}-${attrStr}`.toUpperCase() : '',
                variant_item_name: attrStr ? `${form.item_name || 'Item'} ${attrStr}` : ''
              };
            });
            return { ...vf, initial_variants: updatedVariants };
          });
        }

        // If this was opened from a specific variant row, select it immediately
        if (targetRowIndex !== null && targetRowIndex !== undefined) {
          setVariantForm(vf => {
            const updatedVariants = [...(vf.initial_variants || [])];
            if (updatedVariants[targetRowIndex]) {
              const currentSelected = { ...(updatedVariants[targetRowIndex].selected_attributes || {}) };
              currentSelected[attribute_name] = newVal.attribute_value;
              const attrStr = Object.values(currentSelected).filter(Boolean).join('-');
              updatedVariants[targetRowIndex] = {
                ...updatedVariants[targetRowIndex],
                selected_attributes: currentSelected,
                variant_item_code: attrStr ? `${form.item_code || 'ITEM'}-${attrStr}`.toUpperCase() : '',
                variant_item_name: attrStr ? `${form.item_name || 'Item'} ${attrStr}` : ''
              };
            }
            return { ...vf, initial_variants: updatedVariants };
          });
        }

        // Refresh global attribute list
        fetchItemAttributes();
        setShowAddAttrValueModal(false);
        setAttrModalData({ attribute_name: '', attribute_value: '', abbr: '', targetRowIndex: null, isNewAttribute: false, attributeIndex: null });
      } else {
        alert(data.message || 'Failed to add attribute value.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error adding attribute value.');
    } finally {
      setSavingAttrValue(false);
    }
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
  const handleCreateBrand = async () => {
    const { value: name } = await Swal.fire({
      title: 'Create New Brand',
      input: 'text',
      inputLabel: 'Brand Name',
      inputPlaceholder: 'Enter brand name...',
      showCancelButton: true,
      confirmButtonText: 'Create Brand',
      confirmButtonColor: T.blue,
      cancelButtonText: 'Cancel',
      inputValidator: (val) => {
        if (!val || !val.trim()) return 'Brand name is required!';
      }
    });

    if (!name) return;

    try {
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_brand', { brand_name: name.trim() }, { withCredentials: true });
      const resData = res.data?.message || res.data;
      if (resData?.status === 'success' || resData?.name || res.status === 200) {
        await fetchBrands();
        setForm(p => ({ ...p, brand: name.trim() }));
        Swal.fire({ icon: 'success', title: 'Created!', text: `Brand "${name.trim()}" created successfully.`, timer: 1800, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: resData?.message || 'Failed to create brand' });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || e.message || 'Failed to create brand' });
    }
  };

  const handleCreateUom = async () => {
    const { value: name } = await Swal.fire({
      title: 'Create New Base UOM',
      input: 'text',
      inputLabel: 'UOM Name',
      inputPlaceholder: 'e.g. Nos, Box, Pcs, Kg...',
      showCancelButton: true,
      confirmButtonText: 'Create UOM',
      confirmButtonColor: T.blue,
      cancelButtonText: 'Cancel',
      inputValidator: (val) => {
        if (!val || !val.trim()) return 'UOM name is required!';
      }
    });

    if (!name) return;

    try {
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_uom', { uom_name: name.trim() }, { withCredentials: true });
      const resData = res.data?.message || res.data;
      if (resData?.status === 'success' || resData?.name || res.status === 200) {
        await fetchUoms();
        setForm(p => ({ ...p, default_uom: name.trim() }));
        Swal.fire({ icon: 'success', title: 'Created!', text: `UOM "${name.trim()}" created successfully.`, timer: 1800, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: resData?.message || 'Failed to create UOM' });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || e.message || 'Failed to create UOM' });
    }
  };

  const handleOpenCreateItemGroup = (defaultParent = '', initialName = '') => {
    setItemGroupModalForm({
      item_group_name: typeof initialName === 'string' ? initialName : '',
      parent_item_group: defaultParent || formMainGroup || 'All Item Groups',
      is_group: false,
    });
    setShowItemGroupModal(true);
  };

  const handleSaveItemGroup = async (e) => {
    if (e) e.preventDefault();
    if (!itemGroupModalForm.item_group_name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Item Group Name is required.' });
      return;
    }

    setSavingItemGroup(true);
    try {
      const payload = {
        item_group_name: itemGroupModalForm.item_group_name.trim(),
        parent_item_group: itemGroupModalForm.parent_item_group || 'All Item Groups',
        is_group: itemGroupModalForm.is_group ? 1 : 0
      };

      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_item_group_retail', {
        data: payload
      }, { withCredentials: true });

      const resData = res.data?.message || res.data;
      if (resData?.status === 'success' || resData?.name) {
        const createdName = resData.name || itemGroupModalForm.item_group_name.trim();
        await fetchItemGroups();

        // If it's a main group (parent is All Item Groups or is_group is true)
        if (payload.parent_item_group === 'All Item Groups' || payload.is_group === 1) {
          setFormMainGroup(createdName);
          setForm(p => ({ ...p, item_group: '' }));
        } else {
          // It's a subgroup
          setForm(p => ({ ...p, item_group: createdName }));
          if (payload.parent_item_group && payload.parent_item_group !== 'All Item Groups') {
            setFormMainGroup(payload.parent_item_group);
          }
        }

        setShowItemGroupModal(false);
        Swal.fire({
          icon: 'success',
          title: 'Created!',
          text: `Item Group "${createdName}" created successfully.`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(resData?.message || 'Failed to create Item Group');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error Creating Group',
        text: err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to create Item Group'
      });
    } finally {
      setSavingItemGroup(false);
    }
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

  const addBarcode = async (code, uomToUse) => {
    if (!code?.trim()) return;
    code = code.trim();
    const uom = uomToUse || barcodeUom || form.default_uom || 'Nos';
    if (barcodes.some(b => b.barcode === code)) { alert('Barcode already added'); return; }
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', { params: { barcode: code }, withCredentials: true });
      if (res.data?.message?.exists) { alert(`Already used by: ${res.data.message.item}`); return; }
    } catch { }
    setBarcodes(p => [...p, { barcode: code, uom }]);
    setBarcodeInput(''); setIsScanning(false);
  };

  const handlePiecesPerBoxChange = (val) => {
    const pcs = parseFloat(val) || 0;
    const baseUom = form.default_uom || 'Nos';
    
    // Auto rebuild UOM table: base uom (factor 1) + Box (factor pcs if pcs > 1)
    let newUoms = [{ uom: baseUom, conversion_factor: 1 }];
    if (pcs > 1) {
      newUoms.push({ uom: 'Box', conversion_factor: pcs });
    }
    
    // Preserve any custom non-box/non-base UOMs added previously
    (form.uoms || []).forEach(existing => {
      if (existing.uom && existing.uom !== baseUom && existing.uom !== 'Box') {
        newUoms.push(existing);
      }
    });

    setForm(prev => ({
      ...prev,
      custom_pieces_per_box: val,
      uoms: newUoms
    }));
  };

  const handleDefaultUomChange = (val) => {
    const baseUom = val || 'Nos';
    const pcs = parseFloat(form.custom_pieces_per_box) || 0;
    let newUoms = [{ uom: baseUom, conversion_factor: 1 }];
    if (pcs > 1) {
      newUoms.push({ uom: 'Box', conversion_factor: pcs });
    }
    (form.uoms || []).forEach(existing => {
      if (existing.uom && existing.uom !== baseUom && existing.uom !== 'Box') {
        newUoms.push(existing);
      }
    });

    setForm(prev => ({
      ...prev,
      default_uom: baseUom,
      uoms: newUoms
    }));
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
    
    let finalAttributes = [];
    if (form.has_variants) {
      finalAttributes = (form.attributes || [])
        .map(a => (typeof a === 'object' && a !== null ? a.attribute : a))
        .filter(a => a && typeof a === 'string' && a.trim() !== '')
        .map(a => ({ attribute: a.trim() }));
    } else if (form.variant_of) {
      finalAttributes = (form.attributes || [])
        .filter(a => typeof a === 'object' && a !== null && a.attribute && a.attribute_value)
        .map(a => ({
          attribute: a.attribute.trim(),
          attribute_value: String(a.attribute_value).trim()
        }));
    }

    if (form.has_variants && finalAttributes.length === 0) {
      alert('Please select at least one valid Variant Attribute (e.g., Size, Colour) for Template Item.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        item_code: form.item_code,
        item_name: form.item_name,
        item_group: form.item_group,
        stock_uom: form.default_uom,
        standard_rate: parseFloat(form.standard_selling_rate) || 0,
        disabled: form.disabled ? 1 : 0,
        maintain_stock: form.has_variants ? 0 : (form.is_stock_item ? 1 : 0),
        has_variants: form.has_variants ? 1 : 0,
        variant_based_on: (form.has_variants || form.variant_of) ? 'Item Attribute' : undefined,
        attributes: finalAttributes,
        is_variant: form.variant_of ? 1 : 0,
        variant_of: form.variant_of || '',
        description: form.description || '',
        image: form.image || form.imagePreview || '',
        hsn_code: form.hsn_code,
        brand: form.brand,
        country_of_origin: form.country_of_origin,
        custom_loyalty_eligible: form.custom_loyalty_eligible ? 1 : 0,
        custom_allow_discount: form.custom_allow_discount ? 1 : 0,
        is_stock_item: form.has_variants ? 0 : (form.is_stock_item ? 1 : 0),
        is_sales_item: form.has_variants ? 0 : (form.is_sales_item ? 1 : 0),
        is_purchase_item: form.has_variants ? 0 : (form.is_purchase_item ? 1 : 0),
        custom_pieces_per_box: parseFloat(form.custom_pieces_per_box) || 0,
        barcodes: barcodes.map(b => ({ barcode: b.barcode, uom: b.uom })),
        uoms: form.uoms.map(u => ({ uom: u.uom, conversion_factor: u.conversion_factor })),
        supplier_items: form.supplier_items,
        branch_availability: form.branch_availability
          .filter(b => b.warehouse && b.warehouse !== 'undefined' && b.warehouse !== 'null')
          .map(b => ({ warehouse: b.warehouse }))
      };
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', { doctype: 'Item', data }, { withCredentials: true });
      if (res.data?.status === 'error' || res.data?.message?.status === 'error') {
        throw new Error(res.data?.message?.message || res.data?.message || 'Save failed');
      }
      
      // If template has variants to create (in create or edit mode), create them in bulk now
      if (form.has_variants && variantForm.create_first_variant && (variantForm.initial_variants || []).length > 0) {
        try {
          const variantsPayload = variantForm.initial_variants
            .filter(v => Object.keys(v.selected_attributes || {}).length > 0 && (v.variant_item_code || '').trim() !== '')
            .map(v => {
              const bPrice = v.buying_price !== undefined && v.buying_price !== '' ? parseFloat(v.buying_price) : (parseFloat(form.buying_price) || 0);
              const sPrice = v.selling_price !== undefined && v.selling_price !== '' ? parseFloat(v.selling_price) : (parseFloat(form.selling_price) || 0);
              const boxBPrice = v.box_buying_price !== undefined && v.box_buying_price !== '' ? parseFloat(v.box_buying_price) : (parseFloat(form.box_buying_price) || 0);
              const boxSPrice = v.box_selling_price !== undefined && v.box_selling_price !== '' ? parseFloat(v.box_selling_price) : (parseFloat(form.box_selling_price) || 0);
              const pcsPerBox = v.custom_pieces_per_box !== undefined && v.custom_pieces_per_box !== '' ? parseFloat(v.custom_pieces_per_box) : (parseFloat(form.custom_pieces_per_box) || 0);

              const nosBc = (v.nos_barcode !== undefined ? v.nos_barcode : (v.variant_barcode || '')).trim();
              const boxBc = (v.box_barcode || '').trim();

              return {
                attribute_values: v.selected_attributes,
                custom_item_code: (v.variant_item_code || '').trim() || null,
                item_name: (v.variant_item_name || '').trim() || null,
                barcode: nosBc || null,
                nos_barcode: nosBc || null,
                box_barcode: boxBc || null,
                image: v.image || v.imagePreview || null,
                buying_price: bPrice || 0,
                selling_price: sPrice || 0,
                standard_rate: sPrice || 0,
                box_buying_price: boxBPrice || 0,
                box_selling_price: boxSPrice || 0,
                custom_pieces_per_box: pcsPerBox || 0,
                brand: v.brand !== undefined ? v.brand : form.brand || null,
                country_of_origin: v.country_of_origin !== undefined ? v.country_of_origin : form.country_of_origin || null,
                item_group: v.item_group !== undefined ? v.item_group : form.item_group || null,
                stock_uom: v.stock_uom !== undefined ? v.stock_uom : form.default_uom || null,
                is_stock_item: v.is_stock_item !== undefined ? v.is_stock_item : 1,
                is_sales_item: v.is_sales_item !== undefined ? v.is_sales_item : 1,
                is_purchase_item: v.is_purchase_item !== undefined ? v.is_purchase_item : 1,
                custom_loyalty_eligible: v.custom_loyalty_eligible !== undefined ? v.custom_loyalty_eligible : 1,
                custom_allow_discount: v.custom_allow_discount !== undefined ? v.custom_allow_discount : 1,
                disabled: v.disabled !== undefined ? (v.disabled ? 1 : 0) : 0,
                branch_availability: v.branch_availability !== undefined ? v.branch_availability : (data.branch_availability || form.branch_availability || []),
                supplier_items: v.supplier_items !== undefined ? v.supplier_items : (form.supplier_items || [])
              };
            });

          if (variantsPayload.length > 0) {
            Swal.fire({
              title: 'Creating Template & Variants...',
              html: `<div style="font-size: 13px; color: #64748b; margin-top: 6px;">Generating <b>${variantsPayload.length}</b> variant item(s) in background...</div>`,
              allowOutsideClick: false,
              didOpen: () => Swal.showLoading()
            });

            const varRes = await axios.post('/api/method/custom_retailpos.custom_pos_features.create_multiple_custom_item_variants', {
              template_item_code: form.item_code,
              variants_data: JSON.stringify(variantsPayload),
              branch_availability: JSON.stringify(data.branch_availability || [])
            });
            if (varRes.data?.message?.status === 'error') {
              console.warn('Variants creation notice:', varRes.data.message.message);
            }
          }
        } catch (vErr) {
          console.warn('Initial variants creation note:', vErr);
        }
      }

      // Save buying / selling prices if filled in (Nos, Box, Master Box)
      const priceOps = [];
      // 1. Nos Prices
      if (form.buying_price > 0 || (form.buying_price === 0 && form.buying_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.buying_price_list || 'Standard Buying', uom: form.default_uom || 'Nos', price_list_rate: form.buying_price || 0, buying: 1, selling: 0, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      if (form.selling_price > 0 || (form.selling_price === 0 && form.selling_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.selling_price_list || 'Standard Selling', uom: form.default_uom || 'Nos', price_list_rate: form.selling_price || 0, buying: 0, selling: 1, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      // 2. Box Prices
      if (form.box_buying_price > 0 || (form.box_buying_price === 0 && form.box_buying_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.box_buying_price_list || 'Standard Buying', uom: 'Box', price_list_rate: form.box_buying_price || 0, buying: 1, selling: 0, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      if (form.box_selling_price > 0 || (form.box_selling_price === 0 && form.box_selling_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.box_selling_price_list || 'Standard Selling', uom: 'Box', price_list_rate: form.box_selling_price || 0, buying: 0, selling: 1, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      // 3. Master Box Prices
      if (form.master_box_buying_price > 0 || (form.master_box_buying_price === 0 && form.master_box_buying_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.master_box_buying_price_list || 'Standard Buying', uom: 'Master Box', price_list_rate: form.master_box_buying_price || 0, buying: 1, selling: 0, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      if (form.master_box_selling_price > 0 || (form.master_box_selling_price === 0 && form.master_box_selling_price_list)) {
        priceOps.push(axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
          item_code: form.item_code,
          data: { price_list: form.master_box_selling_price_list || 'Standard Selling', uom: 'Master Box', price_list_rate: form.master_box_selling_price || 0, buying: 0, selling: 1, name: '' }
        }, { withCredentials: true }).catch(() => {}));
      }
      if (priceOps.length > 0) await Promise.all(priceOps);


      Swal.fire({
        icon: 'success',
        title: isEditMode ? 'Item Updated!' : (form.has_variants && variantForm.create_first_variant ? 'Template & Variants Created!' : 'Item Created!'),
        text: isEditMode 
          ? 'The item details have been saved successfully.' 
          : (form.has_variants && variantForm.create_first_variant 
              ? `Template item and ${(variantForm.initial_variants || []).length} variant(s) generated successfully.` 
              : 'New item added successfully.'),
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true
      });


      setShowForm(false); 
      resetForm(); 
      fetchItems();
    } catch (e) { 
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: e.response?.data?.message || e.message || 'Could not save item.'
      });
    } finally { 
      setSaving(false); 
    }
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
      is_stock_item: item.has_variants === 1 ? 0 : 1,
      is_sales_item: item.has_variants === 1 ? 0 : 1,
      is_purchase_item: item.has_variants === 1 ? 0 : 1,
      maintain_stock: item.has_variants === 1 ? 0 : 1,
      default_uom: item.stock_uom || 'Nos',
      standard_selling_rate: item.standard_rate || 0,
      imagePreview: item.image,
      brand: item.brand || '',
      country_of_origin: item.country_of_origin || '',
      custom_pieces_per_box: item.custom_pieces_per_box || 0,
      branch_availability: []
    });
    setBarcodes([]); setShowForm(true); setActiveTab('General'); setDashboardData(null); setConnectionActiveTab(null); setProductBundleData(null);
    fetchPriceList(item.item_code);
    fetchItemDashboardDetails(item.item_code);
    fetchItemValuation(item.item_code);
    fetchProductBundle(item.item_code);
  };

  const fetchProductBundle = async (code) => {
    try {
      setLoadingProductBundle(true);
      const bundleRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_product_bundle', {
        params: { item_code: code, warehouse: localStorage.getItem('warehouse') || warehouse },
        withCredentials: true
      });
      if (bundleRes.data?.message?.status === 'success' && bundleRes.data.message.is_bundle) {
        setProductBundleData(bundleRes.data.message.bundle);
      } else if (bundleRes.data?.status === 'success' && bundleRes.data?.is_bundle) {
        setProductBundleData(bundleRes.data.bundle);
      } else {
        setProductBundleData(null);
      }
    } catch (bErr) {
      console.warn('Error fetching bundle:', bErr);
      setProductBundleData(null);
    } finally {
      setLoadingProductBundle(false);
    }
  };

  const resetForm = () => { 
    setForm(defaultForm()); 
    setBarcodes([]); 
    setIsEditMode(false); 
    setIsViewMode(false); 
    setEditingItemCode(null); 
    setValuationData(null); 
    setProductBundleData(null); 
    setVariantForm({
      create_first_variant: true,
      initial_variants: [
        {
          id: `var-1-${Date.now()}`,
          selected_attributes: {},
          variant_item_code: '',
          variant_item_name: '',
          variant_barcode: '',
          use_custom_code: true
        }
      ]
    });
  };

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
              <ListCustomizer
                doctype="Item"
                onSave={cols => setCustomColumns(cols)}
                themeColor={T.blue}
                btnClassName="il-btn il-btn-secondary"
                btnStyle={{ gap: 6 }}
              />
              <button
                className="il-btn il-btn-secondary"
                onClick={openSyncModal}
                style={{ color: '#604BE8', borderColor: '#C3CDE4', background: '#f0f2fe', gap: 6 }}
              >
                <Warehouse size={14} />Sync Items to Branch
              </button>
              {/* NBI button hidden for now
              <button 
                className="il-btn il-btn-secondary" 
                onClick={() => setShowNbiModal(true)}
                style={{ color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4', gap: 6 }}
              >
                <Tag size={14} />No Barcode Item (NBI)
              </button>
              */}
              <button className="il-btn il-btn-primary" onClick={() => {
                resetForm();
                const myWh = localStorage.getItem('warehouse');
                if (myWh) setForm(p => ({ ...p, branch_availability: [{ warehouse: myWh }] }));
                setShowForm(true); fetchItemGroups(); fetchBrands(); fetchUoms(); fetchCountries();
              }}><Plus size={14} />Add Item</button>
            </div>
          </div>
        </div>


        {/* SUBGROUP HIERARCHY FILTER NAVBAR */}
        <div style={{ padding: '10px 28px 0 28px' }}>
          <SubgroupFilterNavbar 
            activeMainGroup={subgroupFilterMain}
            activeSubgroup={subgroupFilterSub}
            onSelectMainGroup={(g) => {
              setSubgroupFilterMain(g);
              if (g === 'All') setFilterGroup('');
              else setFilterGroup(g);
            }}
            onSelectSubgroup={(sub) => {
              setSubgroupFilterSub(sub);
              if (sub !== 'All') setFilterGroup(sub);
              else setFilterGroup(subgroupFilterMain === 'All' ? '' : subgroupFilterMain);
            }}
          />
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
                      {customColumns.map(col => (
                        <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{item.item_name}</div>
                              {(item.has_variants === 1 || item.has_variants === true) && (
                                <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '1px 6px', borderRadius: 6 }}>
                                  Template
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{item.item_code}</div>
                          </td>
                          <td style={{ fontSize: 13, color: T.textSub }}>{item.item_group}</td>
                          <td><span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>{item.stock_uom || 'Nos'}</span></td>
                          <td><StatusBadge disabled={item.disabled} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{Number(item.valuation_rate || 0).toFixed(2)}</td>
                          {customColumns.map(col => (
                             <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                               {item[col] !== undefined && item[col] !== null ? String(item[col]) : '-'}
                             </td>
                           ))}
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
                        <input type="checkbox" className="il-check" checked={allSyncSelected} onChange={() => { }} />
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
                            <input type="checkbox" className="il-check" checked={checked} onChange={() => { }} />
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
              <button
                type="button"
                onClick={handleCloseForm}
                className="il-btn il-btn-secondary"
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  border: `1.5px solid ${T.border}`,
                  fontWeight: 700,
                  fontSize: 12
                }}
                title="Back to Item List Table"
              >
                <ChevronLeft size={16} />
                <span>Item List</span>
              </button>

              <span style={{ color: T.textMuted, fontSize: 16, fontWeight: 300 }}>/</span>

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
                    {productBundleData && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 10, fontWeight: 800 }}>
                        <Boxes size={12} style={{ color: '#059669' }} />
                        <span>PRODUCT BUNDLE ({productBundleData.items?.length || 0})</span>
                      </div>
                    )}
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
                    style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      setSelectedBarcodeItem(itemDoc || { item_code: editingItemCode, item_name: form.item_name, stock_uom: form.stock_uom, standard_rate: form.standard_rate });
                      setShowBarcodePrintModal(true);
                    }}
                  >
                    <Barcode size={14} /> <span style={{ fontSize: 11, fontWeight: 800 }}>Print Barcode</span>
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

              {!isViewMode && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    height: 38,
                    padding: '0 20px',
                    borderRadius: 10,
                    background: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
                    opacity: saving ? 0.7 : 1,
                    transition: 'all 0.15s'
                  }}
                >
                  {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  <span>{saving ? 'Saving...' : 'Save Item'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCloseForm}
                className="il-btn il-btn-secondary"
                style={{ height: 36, width: 36, padding: 0, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1.5px solid ${T.border}` }}
                title="Close"
              >
                <X size={16} />
              </button>
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

                    {/* Product Bundle Package Components Section - Top Highlight */}
                    {productBundleData && (
                      <div style={{ width: '100%' }}>
                        <CardSection
                          title={`Product Bundle Package Components (${productBundleData.items?.length || 0})`}
                          icon={<Boxes size={16} style={{ color: '#059669' }} />}
                          action={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: 20 }}>
                                Available Sets: {productBundleData.available_bundle_qty || 0}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', background: '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>
                                Calculated Value: AED {Number(productBundleData.calculated_price || 0).toFixed(2)}
                              </span>
                            </div>
                          }
                        >
                          <div style={{ padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="il-table" style={{ border: 'none', width: '100%' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ paddingLeft: 20, width: 45, textAlign: 'center' }}>#</th>
                                    <th>Child Item Code</th>
                                    <th>Item Name</th>
                                    <th style={{ textAlign: 'center' }}>Qty</th>
                                    <th style={{ textAlign: 'center' }}>UOM</th>
                                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                                    <th style={{ textAlign: 'center' }}>Stock</th>
                                    <th style={{ textAlign: 'right', paddingRight: 20 }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(productBundleData.items || []).map((child, idx) => (
                                    <tr key={idx} style={{ cursor: 'default' }}>
                                      <td style={{ paddingLeft: 20, textAlign: 'center', fontWeight: 800, color: '#94a3b8' }}>
                                        {idx + 1}
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 700, color: '#059669', fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
                                          {child.item_code}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                                          {child.item_name}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{ padding: '2px 8px', background: '#ecfdf5', color: '#059669', borderRadius: 6, border: '1px solid #a7f3d0', fontWeight: 800, fontSize: 12 }}>
                                          {child.qty}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 12 }}>
                                        {child.uom}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                        AED {Number(child.rate || 0).toFixed(2)}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 13 }}>
                                        AED {Number(child.amount || (child.qty * child.rate) || 0).toFixed(2)}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                          padding: '2px 8px',
                                          borderRadius: 6,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          background: child.actual_qty > 0 ? '#ecfdf5' : '#fee2e2',
                                          color: child.actual_qty > 0 ? '#15803d' : '#b91c1c',
                                          border: `1px solid ${child.actual_qty > 0 ? '#a7f3d0' : '#fecaca'}`
                                        }}>
                                          {child.actual_qty || 0}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'right', paddingRight: 20 }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const target = items.find(i => i.item_code === child.item_code);
                                            if (target) {
                                              handleRowClick(target);
                                            } else {
                                              handleRowClick({ item_code: child.item_code, item_name: child.item_name, stock_uom: child.uom, standard_rate: child.rate });
                                            }
                                          }}
                                          className="il-btn il-btn-secondary"
                                          style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: '#fff' }}
                                        >
                                          View →
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </CardSection>
                      </div>
                    )}

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
                            ['Main Category', formMainGroup || '—'],
                            ['Subgroup / Item Group', form.item_group || '—'],
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

                      {/* Template Item Variants Section */}
                      {form.has_variants && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <CardSection 
                            title={`Variants of this Template (${templateVariants.length})`} 
                            icon={<Layers size={14} style={{ color: '#7c3aed' }} />}
                            action={
                              <button
                                className="il-btn il-btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 11, background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', fontWeight: 700 }}
                                onClick={() => { setIsViewMode(false); setIsEditMode(true); }}
                              >
                                <Plus size={12} /> + Add More Variants
                              </button>
                            }
                          >
                            <div style={{ padding: 0 }}>
                              {loadingTemplateVariants ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                  <Loader2 size={24} style={{ color: '#7c3aed', margin: '0 auto' }} className="spin" />
                                </div>
                              ) : templateVariants.length > 0 ? (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}`, textAlign: 'left' }}>
                                        <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Variant Code</th>
                                        <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Variant Name</th>
                                        <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Attributes</th>
                                        <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Barcode</th>
                                        <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>UOM</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Rate</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Status</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {templateVariants.map((v, idx) => (
                                        <tr key={v.name || idx} style={{ borderBottom: `1px solid ${T.borderLight}`, transition: 'background 0.15s' }}>
                                          <td style={{ padding: '10px 14px', fontWeight: 700, color: T.blue, fontFamily: "'DM Mono', monospace" }}>
                                            {v.name}
                                          </td>
                                          <td style={{ padding: '10px 14px', fontWeight: 600, color: T.text }}>
                                            {v.item_name}
                                          </td>
                                          <td style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                              {(v.attributes || []).map((at, ai) => (
                                                <span key={ai} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#f5f3ff', color: '#7c3aed', borderRadius: 4, border: '1px solid #ddd6fe' }}>
                                                  {at.attribute_value}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td style={{ padding: '10px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSub }}>
                                            {v.barcodes && v.barcodes.length > 0 ? v.barcodes[0].barcode : '—'}
                                          </td>
                                          <td style={{ padding: '10px 14px', color: T.textSub }}>
                                            {v.stock_uom || 'Nos'}
                                          </td>
                                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                              <DirhamIcon size={11} /> {Number(v.standard_rate || 0).toFixed(2)}
                                            </span>
                                          </td>
                                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '2px 6px',
                                              borderRadius: 4,
                                              fontSize: 10,
                                              fontWeight: 700,
                                              background: v.disabled ? '#fee2e2' : '#dcfce7',
                                              color: v.disabled ? '#b91c1c' : '#15803d'
                                            }}>
                                              {v.disabled ? 'Disabled' : 'Active'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                            <button
                                              onClick={() => {
                                                handleRowClick({
                                                  item_code: v.name,
                                                  item_name: v.item_name,
                                                  item_group: form.item_group,
                                                  stock_uom: v.stock_uom,
                                                  standard_rate: v.standard_rate,
                                                  disabled: v.disabled,
                                                  has_variants: 0,
                                                  image: v.image
                                                });
                                              }}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: 6,
                                                background: T.bg,
                                                border: `1px solid ${T.border}`,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: T.text,
                                                cursor: 'pointer'
                                              }}
                                            >
                                              View Details →
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div style={{ padding: '30px 20px', textAlign: 'center', color: T.textMuted }}>
                                  <Layers size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 2 }}>No variants created yet</div>
                                  <div style={{ fontSize: 11 }}>Click "+ Add More Variants" to generate item variants.</div>
                                </div>
                              )}
                            </div>
                          </CardSection>
                        </div>
                      )}

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
                {/* Has Variants (Template) toggle & Options Selection - Split Layout matching Reference UI */}
                {!form.variant_of && (
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: '280px 1px 1fr',
                    gap: 24,
                    alignItems: 'stretch',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}>
                    {/* Left Column: Has Variants Checkbox */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', width: '100%' }}>
                        <input
                          type="checkbox"
                          className="il-check"
                          checked={form.has_variants === 1}
                          onChange={e => {
                            const checked = e.target.checked;
                            const updatedForm = { ...form, has_variants: checked ? 1 : 0 };
                            if (checked) {
                              updatedForm.is_sales_item = 0;
                              updatedForm.is_purchase_item = 0;
                              updatedForm.is_stock_item = 0;
                            }
                            setForm(updatedForm);
                          }}
                          tabIndex={showForm ? 0 : -1}
                          style={{
                            width: 22,
                            height: 22,
                            accentColor: '#7c3aed',
                            marginTop: 2,
                            cursor: 'pointer',
                            borderRadius: 6
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', lineHeight: 1.3 }}>
                            Has Variants (Template Item)
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                            Mark this as an Item Template to configure attributes & initial variants
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Vertical Divider */}
                    <div style={{ background: '#f1f5f9', width: 1, minHeight: '100%' }} />

                    {/* Right Column: Attribute Options Or Placeholder */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {form.has_variants !== 1 ? (
                        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                          Tick the checkbox to configure item variant options here.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Header + Add Option button */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                                <Layers size={14} />
                              </div>
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>Item Variants & Options</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAttrModalData({
                                  attribute_name: '',
                                  attribute_value: '',
                                  abbr: '',
                                  targetRowIndex: null,
                                  isNewAttribute: true,
                                  attributeIndex: null
                                });
                                setShowAddAttrValueModal(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 14px',
                                borderRadius: 8,
                                border: '1.5px solid #7c3aed',
                                background: '#ffffff',
                                color: '#7c3aed',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Plus size={13} /> Add Option
                            </button>
                          </div>

                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Choose options for this item — e.g. size, colour, pack. Multi-select supported.
                          </div>

                          {/* 3-Column Attributes Grid with Checkboxes */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 10,
                            marginTop: 4
                          }}>
                            {availableAttributes.map(attr => {
                              const isSelected = (form.attributes || []).some(a => (a.attribute || a) === attr.value);
                              return (
                                <label
                                  key={attr.value}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: isSelected ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                                    background: isSelected ? '#faf5ff' : '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      let nextAttrs = [];
                                      if (isSelected) {
                                        nextAttrs = (form.attributes || []).filter(a => (a.attribute || a) !== attr.value);
                                      } else {
                                        nextAttrs = [...(form.attributes || []), { attribute: attr.value }];
                                      }
                                      setForm(p => ({ ...p, attributes: nextAttrs }));

                                      // Update initial variants
                                      setVariantForm(vf => {
                                        const currentVars = (vf.initial_variants || []).length > 0
                                          ? vf.initial_variants
                                          : (!isSelected && nextAttrs.length > 0 ? [{ id: `var-1-${Date.now()}`, is_existing: false, selected_attributes: {}, variant_barcode: '', nos_barcode: '', box_barcode: '', use_custom_code: true }] : []);

                                        const updatedVariants = currentVars.map(v => {
                                          const updatedVals = { ...(v.selected_attributes || {}) };
                                          if (isSelected) {
                                            delete updatedVals[attr.value];
                                          } else {
                                            const possibleVals = attributeValuesMap[attr.value] || [];
                                            if (possibleVals.length > 0 && !updatedVals[attr.value]) {
                                              updatedVals[attr.value] = possibleVals[0].attribute_value;
                                            }
                                          }

                                          const orderedCodes = [];
                                          const orderedNames = [];
                                          nextAttrs.forEach(a => {
                                            const aName = typeof a === 'object' && a !== null ? a.attribute : a;
                                            const val = updatedVals[aName];
                                            if (val) {
                                              const pVals = attributeValuesMap[aName] || [];
                                              const matched = pVals.find(x => x.attribute_value === val);
                                              orderedCodes.push((matched?.abbr || val).toUpperCase());
                                              orderedNames.push(val);
                                            }
                                          });

                                          const codeSuffix = orderedCodes.join('-');
                                          const nameSuffix = orderedNames.join(' ');

                                          return {
                                            ...v,
                                            selected_attributes: updatedVals,
                                            variant_item_code: codeSuffix ? `${form.item_code || 'ITEM'}-${codeSuffix}`.toUpperCase() : '',
                                            variant_item_name: nameSuffix ? `${form.item_name || 'Item'} ${nameSuffix}` : ''
                                          };
                                        });
                                        return { ...vf, initial_variants: updatedVariants };
                                      });
                                    }}
                                    style={{
                                      width: 16,
                                      height: 16,
                                      accentColor: '#7c3aed',
                                      margin: 0,
                                      cursor: 'pointer'
                                    }}
                                  />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#7c3aed' : '#334155' }}>
                                    {attr.value}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specifications */}
                <CardSection 
                  title="Specifications" 
                  icon={
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f5f3ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', marginRight: 4 }}>
                      <Boxes size={14} />
                    </div>
                  }
                >
                  <div style={{ padding: 20 }}>
                    <div className="il-form-grid">
                      {/* ROW 1: 1. Barcode (Hidden when Has Variants is enabled because each variant has its own barcodes) */}
                      {!Boolean(form.has_variants) && (
                        <div className="il-form-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <label className="il-form-label" style={{ margin: 0 }}>Barcode</label>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" className="il-btn il-btn-secondary" style={{ padding: '2px 7px', fontSize: 11, height: 22 }} onClick={() => setShowCameraScanner(true)} title="Camera Scan">
                                <Camera size={11} /> Camera
                              </button>
                              <button type="button" className="il-btn il-btn-secondary" style={{ padding: '2px 7px', fontSize: 11, height: 22, color: isScanning ? T.blue : T.textSub, borderColor: isScanning ? T.blue : T.border }} onClick={() => setIsScanning(s => !s)} title="Hardware Scan">
                                {isScanning ? '● Scanning' : 'HW Scan'}
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              ref={barcodeInputRef}
                              className="il-input"
                              style={{ flex: 1 }}
                              value={barcodeInput}
                              onChange={e => setBarcodeInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addBarcode(barcodeInput, barcodeUom);
                                }
                              }}
                              placeholder="Type barcode and press Enter..."
                            />
                            <select
                              className="il-select"
                              style={{ width: 110, height: 38, fontSize: 12, fontWeight: 700, background: '#fff' }}
                              value={barcodeUom}
                              onChange={e => setBarcodeUom(e.target.value)}
                            >
                              <option value={form.default_uom || 'Nos'}>{form.default_uom || 'Nos'} (Base)</option>
                              <option value="Box">Box</option>
                              {(form.uoms || []).filter(u => u.uom && u.uom !== form.default_uom && u.uom !== 'Box' && u.uom !== 'Master Box').map(u => (
                                <option key={u.uom} value={u.uom}>{u.uom}</option>
                              ))}
                            </select>
                            <button type="button" className="il-btn il-btn-primary" style={{ padding: '0 12px', fontSize: 12, fontWeight: 700 }} onClick={() => addBarcode(barcodeInput, barcodeUom)}>
                              Add
                            </button>
                          </div>
                          {barcodes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {barcodes.map((b, i) => (
                                <span
                                  key={i}
                                  className="il-chip"
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    background: b.uom === 'Box' ? '#fef3c7' : (b.uom === 'Master Box' ? '#f5f3ff' : '#eff6ff'),
                                    color: b.uom === 'Box' ? '#92400e' : (b.uom === 'Master Box' ? '#6d28d9' : '#1d4ed8'),
                                    border: `1px solid ${b.uom === 'Box' ? '#fde68a' : (b.uom === 'Master Box' ? '#ddd6fe' : '#bfdbfe')}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}
                                >
                                  <span style={{ fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>{b.barcode}</span>
                                  <select
                                    value={b.uom || form.default_uom || 'Nos'}
                                    onChange={e => {
                                      const next = [...barcodes];
                                      next[i] = { ...b, uom: e.target.value };
                                      setBarcodes(next);
                                    }}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'inherit',
                                      outline: 'none',
                                      padding: 0
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <option value={form.default_uom || 'Nos'}>{form.default_uom || 'Nos'}</option>
                                    <option value="Box">Box</option>
                                    {(form.uoms || []).filter(u => u.uom && u.uom !== form.default_uom && u.uom !== 'Box' && u.uom !== 'Master Box').map(u => (
                                      <option key={u.uom} value={u.uom}>{u.uom}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setBarcodes(p => p.filter((_, idx) => idx !== i))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, display: 'flex', padding: 0 }}
                                    title="Remove barcode"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ROW 1: 2. Item Code */}
                      <div className="il-form-field">
                        <label className="il-form-label req">Item Code</label>
                        <input
                          className="il-input"
                          value={form.item_code}
                          onChange={e => setForm({ ...form, item_code: e.target.value })}
                          onBlur={async () => {
                            if (isEditMode || !form.item_code.trim()) return;
                            try {
                              const code = form.item_code.trim();
                              const res = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', { search_term: code }, { withCredentials: true });
                              const raw = res.data?.message;
                              const results = (raw?.success && Array.isArray(raw?.data)) ? raw.data : [];
                              const exactMatch = results.find(it => (it.name || '').toLowerCase() === code.toLowerCase() || (it.item_code || '').toLowerCase() === code.toLowerCase());
                              
                              if (exactMatch) {
                                Swal.fire({
                                  title: 'Item Code Already Exists!',
                                  html: `
                                    <div style="text-align: left; padding: 6px;">
                                      <p style="font-size: 13px; color: #334155; margin-bottom: 8px;">Item <b>${exactMatch.item_name}</b> (<code>${exactMatch.name}</code>) is already registered in the system.</p>
                                      <p style="font-size: 11px; color: #0284c7; font-weight: 700;">Active in: ${exactMatch.active_branches || 'Other Branches'}</p>
                                    </div>
                                  `,
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonText: '⚡ Sync to Current Branch',
                                  cancelButtonText: 'Use Different Code',
                                  confirmButtonColor: '#0284c7',
                                  cancelButtonColor: '#64748b'
                                }).then(async (result) => {
                                  if (result.isConfirmed) {
                                    try {
                                      Swal.fire({ title: 'Syncing Item...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                                      const syncRes = await axios.post('/api/method/kyle_retail.retail_api.api.enable_item_for_branch_retail', {
                                        item_code: exactMatch.name,
                                        warehouse: localStorage.getItem('warehouse')
                                      }, { withCredentials: true });
                                      if (syncRes.data.message?.success) {
                                        Swal.fire('Success', 'Item synced to your branch!', 'success');
                                        setShowModal(false);
                                        fetchItems();
                                      }
                                    } catch (err) {
                                      Swal.fire('Error', err.message, 'error');
                                    }
                                  } else {
                                    setForm(prev => ({ ...prev, item_code: '' }));
                                  }
                                });
                              }
                            } catch (e) {
                              console.error('Item code check error:', e);
                            }
                          }}
                          disabled={isEditMode}
                          placeholder="e.g. ITM-001"
                        />
                      </div>

                      {/* ROW 1: 3. Item Name */}
                      <div className="il-form-field">
                        <label className="il-form-label req">Item Name</label>
                        <input className="il-input" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="Full item name" />
                      </div>

                      {/* ROW 2: 4. Main Item Category */}
                      <SearchableSelect
                        label="Main Item Category"
                        value={formMainGroup}
                        options={groupHierarchy.map(h => ({ label: h.main_group, value: h.main_group }))}
                        placeholder="Select Main Category"
                        onChange={val => {
                          setFormMainGroup(val);
                          setForm({ ...form, item_group: '' });
                        }}
                        onAction={(search) => handleOpenCreateItemGroup('All Item Groups', search)}
                      />

                      {/* ROW 2: 5. Item Subgroup */}
                      <SearchableSelect
                        label="Item Subgroup"
                        value={form.item_group}
                        options={
                          formMainGroup && groupHierarchy.find(h => h.main_group === formMainGroup)
                            ? (groupHierarchy.find(h => h.main_group === formMainGroup).subgroups || []).map(s => ({ label: s, value: s }))
                            : itemGroups
                        }
                        required
                        placeholder="Select Subgroup"
                        onChange={val => setForm({ ...form, item_group: val })}
                        onAction={(search) => handleOpenCreateItemGroup(formMainGroup || '', search)}
                      />

                      {/* ROW 2: 6. Brand */}
                      <SearchableSelect
                        label="Brand"
                        value={form.brand}
                        options={brands}
                        placeholder="Select Brand"
                        onChange={val => setForm({ ...form, brand: val })}
                        onAction={handleCreateBrand}
                      />

                      {/* ROW 3: 7. Country of Origin */}
                      <div className="il-form-field">
                        <SearchableSelect
                          label="Country of Origin"
                          value={form.country_of_origin}
                          options={countries}
                          placeholder="Select Country"
                          onChange={val => setForm({ ...form, country_of_origin: val })}
                        />
                      </div>

                      {/* ROW 3: 8. Base UOM */}
                      {!isEditMode ? (
                        <SearchableSelect
                          label="Base UOM"
                          value={form.default_uom}
                          options={baseUomOptions}
                          required
                          placeholder="Select UOM"
                          onChange={handleDefaultUomChange}
                          onAction={handleCreateUom}
                        />
                      ) : (
                        <div className="il-form-field">
                          <label className="il-form-label req">Base UOM</label>
                          <input className="il-input" value={form.default_uom || 'Nos'} disabled />
                        </div>
                      )}

                      {/* ROW 3: 9. No of units in box (Only shown for non-variant items) */}
                      {!Boolean(form.has_variants) && (
                        <div className="il-form-field">
                          <label className="il-form-label">No of units in box</label>
                          <input type="number" className="il-input" value={form.custom_pieces_per_box} onChange={e => handlePiecesPerBoxChange(e.target.value)} placeholder="Conversion factor (e.g. 12)" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardSection>

                {/* ROW 4: Price Lists (Nos, Box) - Only shown for Standard Single Items */}
                {!Boolean(form.has_variants) && (
                  <CardSection
                    title="Price Lists (Nos · Box)"
                    icon={<Tag size={14} />}
                    action={
                      isEditMode && (
                        <button
                          type="button"
                          className="il-btn il-btn-ghost"
                          style={{ padding: '4px 9px', fontSize: 11, color: T.blue }}
                          onClick={() => { setIsViewMode(true); setIsEditMode(false); setActiveTab('Prices'); }}
                        >
                          <Edit2 size={12} /> Full Price Manager
                        </button>
                      )
                    }
                  >
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                        {/* 1. NOS PRICE */}
                        <div style={{ background: '#f8fafc', border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: T.blue, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.blue }} />
                              Nos Price <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>({form.default_uom || 'Nos'})</span>
                            </div>
                            <span className="il-chip" style={{ fontSize: 10, padding: '1px 7px', background: '#eff6ff', color: T.blue, border: '1px solid #bfdbfe', fontWeight: 700 }}>Base UOM</span>
                          </div>

                          {/* Nos Buying Price */}
                          <div style={{ background: '#fffbeb', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T.amber, textTransform: 'uppercase', marginBottom: 6 }}>
                              ● Buying Price
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 2 }}>Price List</label>
                                <SearchableSelectCompact
                                  value={form.buying_price_list || 'Standard Buying'}
                                  options={buyingPriceListOptions}
                                  placeholder="Select Buying Price List"
                                  onChange={pl => {
                                    setForm(p => ({ ...p, buying_price_list: pl }));
                                    if (isEditMode && editingItemCode) {
                                      const found = (priceData.prices || []).find(p => p.price_list === pl && p.buying === 1 && p.uom === (form.default_uom || 'Nos'));
                                      if (found) setForm(prev => ({ ...prev, buying_price_list: pl, buying_price: found.price_list_rate }));
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 2 }}>Rate (AED)</label>
                                <input
                                  type="number"
                                  className="il-input"
                                  style={{ fontWeight: 800, fontSize: 14, color: T.amber, background: '#fff', height: 32 }}
                                  value={form.buying_price || (priceData.prices || []).find(p => p.price_list === (form.buying_price_list || 'Standard Buying') && p.buying === 1 && p.uom === (form.default_uom || 'Nos'))?.price_list_rate || 0}
                                  onChange={e => setForm(p => ({ ...p, buying_price: Number(e.target.value) }))}
                                  onBlur={async () => {
                                    if (!isEditMode || !editingItemCode) return;
                                    try {
                                      const pl = form.buying_price_list || 'Standard Buying';
                                      const existing = (priceData.prices || []).find(p => p.price_list === pl && p.buying === 1 && p.uom === (form.default_uom || 'Nos'));
                                      await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
                                        item_code: editingItemCode,
                                        data: { price_list: pl, uom: form.default_uom || 'Nos', price_list_rate: form.buying_price || 0, buying: 1, selling: 0, name: existing?.name || '' }
                                      }, { withCredentials: true });
                                      fetchPriceList(editingItemCode);
                                    } catch (err) { console.warn('Price save err:', err); }
                                  }}
                                  placeholder="0.00"
                                  onFocus={e => e.target.select()}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Nos Selling Price */}
                          <div style={{ background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T.green, textTransform: 'uppercase', marginBottom: 6 }}>
                              ● Selling Price
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#14532d', display: 'block', marginBottom: 2 }}>Price List</label>
                                <SearchableSelectCompact
                                  value={form.selling_price_list || 'Standard Selling'}
                                  options={sellingPriceListOptions}
                                  placeholder="Select Selling Price List"
                                  onChange={pl => {
                                    setForm(p => ({ ...p, selling_price_list: pl }));
                                    if (isEditMode && editingItemCode) {
                                      const found = (priceData.prices || []).find(p => p.price_list === pl && p.selling === 1 && p.uom === (form.default_uom || 'Nos'));
                                      if (found) setForm(prev => ({ ...prev, selling_price_list: pl, selling_price: found.price_list_rate }));
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#14532d', display: 'block', marginBottom: 2 }}>Rate (AED)</label>
                                <input
                                  type="number"
                                  className="il-input"
                                  style={{ fontWeight: 800, fontSize: 14, color: T.green, background: '#fff', height: 32 }}
                                  value={form.selling_price || (priceData.prices || []).find(p => p.price_list === (form.selling_price_list || 'Standard Selling') && p.selling === 1 && p.uom === (form.default_uom || 'Nos'))?.price_list_rate || 0}
                                  onChange={e => setForm(p => ({ ...p, selling_price: Number(e.target.value) }))}
                                  onBlur={async () => {
                                    if (!isEditMode || !editingItemCode) return;
                                    try {
                                      const pl = form.selling_price_list || 'Standard Selling';
                                      const existing = (priceData.prices || []).find(p => p.price_list === pl && p.selling === 1 && p.uom === (form.default_uom || 'Nos'));
                                      await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
                                        item_code: editingItemCode,
                                        data: { price_list: pl, uom: form.default_uom || 'Nos', price_list_rate: form.selling_price || 0, buying: 0, selling: 1, name: existing?.name || '' }
                                      }, { withCredentials: true });
                                      fetchPriceList(editingItemCode);
                                    } catch (err) { console.warn('Price save err:', err); }
                                  }}
                                  placeholder="0.00"
                                  onFocus={e => e.target.select()}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. BOX PRICE */}
                        <div style={{ background: '#f8fafc', border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                              Box Price <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>(Box = {form.custom_pieces_per_box || 1} {form.default_uom || 'Nos'})</span>
                            </div>
                            <span className="il-chip" style={{ fontSize: 10, padding: '1px 7px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}>Box UOM</span>
                          </div>

                          {/* Box Buying Price */}
                          <div style={{ background: '#fffbeb', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T.amber, textTransform: 'uppercase', marginBottom: 6 }}>
                              ● Buying Price
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 2 }}>Price List</label>
                                <SearchableSelectCompact
                                  value={form.box_buying_price_list || 'Standard Buying'}
                                  options={buyingPriceListOptions}
                                  placeholder="Select Buying Price List"
                                  onChange={pl => {
                                    setForm(p => ({ ...p, box_buying_price_list: pl }));
                                    if (isEditMode && editingItemCode) {
                                      const found = (priceData.prices || []).find(p => p.price_list === pl && p.buying === 1 && p.uom === 'Box');
                                      if (found) setForm(prev => ({ ...prev, box_buying_price_list: pl, box_buying_price: found.price_list_rate }));
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 2 }}>Rate (AED)</label>
                                <input
                                  type="number"
                                  className="il-input"
                                  style={{ fontWeight: 800, fontSize: 14, color: T.amber, background: '#fff', height: 32 }}
                                  value={form.box_buying_price || (priceData.prices || []).find(p => p.price_list === (form.box_buying_price_list || 'Standard Buying') && p.buying === 1 && p.uom === 'Box')?.price_list_rate || 0}
                                  onChange={e => setForm(p => ({ ...p, box_buying_price: Number(e.target.value) }))}
                                  onBlur={async () => {
                                    if (!isEditMode || !editingItemCode) return;
                                    try {
                                      const pl = form.box_buying_price_list || 'Standard Buying';
                                      const existing = (priceData.prices || []).find(p => p.price_list === pl && p.buying === 1 && p.uom === 'Box');
                                      await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
                                        item_code: editingItemCode,
                                        data: { price_list: pl, uom: 'Box', price_list_rate: form.box_buying_price || 0, buying: 1, selling: 0, name: existing?.name || '' }
                                      }, { withCredentials: true });
                                      fetchPriceList(editingItemCode);
                                    } catch (err) { console.warn('Price save err:', err); }
                                  }}
                                  placeholder="0.00"
                                  onFocus={e => e.target.select()}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Box Selling Price */}
                          <div style={{ background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T.green, textTransform: 'uppercase', marginBottom: 6 }}>
                              ● Selling Price
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#14532d', display: 'block', marginBottom: 2 }}>Price List</label>
                                <SearchableSelectCompact
                                  value={form.box_selling_price_list || 'Standard Selling'}
                                  options={sellingPriceListOptions}
                                  placeholder="Select Selling Price List"
                                  onChange={pl => {
                                    setForm(p => ({ ...p, box_selling_price_list: pl }));
                                    if (isEditMode && editingItemCode) {
                                      const found = (priceData.prices || []).find(p => p.price_list === pl && p.selling === 1 && p.uom === 'Box');
                                      if (found) setForm(prev => ({ ...prev, box_selling_price_list: pl, box_selling_price: found.price_list_rate }));
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: '#14532d', display: 'block', marginBottom: 2 }}>Rate (AED)</label>
                                <input
                                  type="number"
                                  className="il-input"
                                  style={{ fontWeight: 800, fontSize: 14, color: T.green, background: '#fff', height: 32 }}
                                  value={form.box_selling_price || (priceData.prices || []).find(p => p.price_list === (form.box_selling_price_list || 'Standard Selling') && p.selling === 1 && p.uom === 'Box')?.price_list_rate || 0}
                                  onChange={e => setForm(p => ({ ...p, box_selling_price: Number(e.target.value) }))}
                                  onBlur={async () => {
                                    if (!isEditMode || !editingItemCode) return;
                                    try {
                                      const pl = form.box_selling_price_list || 'Standard Selling';
                                      const existing = (priceData.prices || []).find(p => p.price_list === pl && p.selling === 1 && p.uom === 'Box');
                                      await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
                                        item_code: editingItemCode,
                                        data: { price_list: pl, uom: 'Box', price_list_rate: form.box_selling_price || 0, buying: 0, selling: 1, name: existing?.name || '' }
                                      }, { withCredentials: true });
                                      fetchPriceList(editingItemCode);
                                    } catch (err) { console.warn('Price save err:', err); }
                                  }}
                                  placeholder="0.00"
                                  onFocus={e => e.target.select()}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Existing prices summary */}
                      {isEditMode && priceData.prices?.length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
                          {priceData.prices.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: p.buying ? T.amber : T.green }}>
                                {p.buying ? '▲ BUY' : '▼ SELL'}
                              </span>
                              <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{p.price_list}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: T.text }}>AED {Number(p.price_list_rate).toFixed(2)}</span>
                              <span style={{ fontSize: 10, color: T.blue, fontWeight: 700, background: '#eff6ff', padding: '1px 5px', borderRadius: 4 }}>{p.uom}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardSection>
                )}

                {/* Variant Items List (Inline Editable for Existing & New Variants) */}
                {Boolean(form.has_variants) && (form.attributes || []).length > 0 && (
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                          Variant Setup
                        </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {isEditMode 
                                  ? `Item variants configured (${(variantForm.initial_variants || []).length})`
                                  : `Variant items to create (${(variantForm.initial_variants || []).length})`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const newId = `var-${(variantForm.initial_variants || []).length + 1}-${Date.now()}`;
                                  // Pre-fill initial attribute values from template
                                  const initialAttrs = {};
                                  const orderedCodes = [];
                                  const orderedNames = [];

                                  (form.attributes || []).forEach(a => {
                                    const attrName = typeof a === 'object' && a !== null ? a.attribute : a;
                                    const possibleVals = attributeValuesMap[attrName] || [];
                                    if (possibleVals.length > 0) {
                                      const firstVal = possibleVals[0].attribute_value;
                                      initialAttrs[attrName] = firstVal;
                                      orderedCodes.push((possibleVals[0].abbr || firstVal).toUpperCase());
                                      orderedNames.push(firstVal);
                                    }
                                  });

                                  const codeSuffix = orderedCodes.join('-');
                                  const nameSuffix = orderedNames.join(' ');

                                  setVariantForm(vf => ({
                                    ...vf,
                                    create_first_variant: true,
                                    initial_variants: [
                                      ...(vf.initial_variants || []),
                                      {
                                        id: newId,
                                        is_existing: false,
                                        selected_attributes: initialAttrs,
                                        variant_item_code: codeSuffix ? `${form.item_code || 'ITEM'}-${codeSuffix}`.toUpperCase() : '',
                                        variant_item_name: nameSuffix ? `${form.item_name || 'Item'} ${nameSuffix}` : '',
                                        variant_barcode: '',
                                        nos_barcode: '',
                                        box_barcode: '',
                                        image: '',
                                        imagePreview: '',
                                        use_custom_code: true,
                                        is_stock_item: 1,
                                        is_sales_item: 1,
                                        is_purchase_item: 1
                                      }
                                    ]
                                  }));
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '7px 16px',
                                  background: '#2563eb',
                                  border: 'none',
                                  color: '#fff',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <Plus size={14} />
                                <span>Add Variant</span>
                              </button>
                            </div>
                          </div>

                          {variantForm.create_first_variant && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {(variantForm.initial_variants || []).map((vRow, vIdx) => {
                                const pcsBox = Number(vRow.custom_pieces_per_box !== undefined ? vRow.custom_pieces_per_box : (form.custom_pieces_per_box || 0));
                                const isExpanded = vRow._isExpanded !== undefined ? Boolean(vRow._isExpanded) : true;

                                return (
                                  <div
                                    key={vRow.id || vIdx}
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: 12,
                                      padding: '16px 20px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                      position: 'relative',
                                      zIndex: (variantForm.initial_variants || []).length - vIdx + 10,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 16
                                    }}
                                  >
                                    {/* Variant Header Row: Clean 3-Column Grid with Variant Sequence Number */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(260px, 1.4fr) minmax(200px, 1.2fr)', gap: 14, alignItems: 'center' }}>
                                      {/* Dynamic Attribute Selectors */}
                                      {(form.attributes || []).map(a => (typeof a === 'object' && a !== null ? a.attribute : a)).filter(Boolean).map(attrName => {
                                        const possibleVals = attributeValuesMap[attrName] || [];
                                        const attrOptions = possibleVals.map(val => ({
                                          label: `${val.attribute_value}${val.abbr ? ` (${val.abbr})` : ''}`,
                                          value: val.attribute_value
                                        }));

                                        return (
                                          <div key={attrName} className="il-form-field">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                              <span style={{ fontSize: 10, fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, border: '1px solid #bfdbfe' }}>
                                                #{vIdx + 1}
                                              </span>
                                              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>{attrName}</label>
                                            </div>
                                            <SearchableSelectCompact
                                              disabled={Boolean(vRow.is_existing)}
                                              value={vRow.selected_attributes?.[attrName] || ''}
                                              options={attrOptions}
                                              placeholder={`Select ${attrName}...`}
                                              onAction={(typedVal) => {
                                                setAttrModalData({
                                                  attribute_name: attrName,
                                                  attribute_value: typedVal || '',
                                                  abbr: (typedVal || '').slice(0, 3).toUpperCase(),
                                                  targetRowIndex: vIdx,
                                                  isNewAttribute: false,
                                                  attributeIndex: null
                                                });
                                                setShowAddAttrValueModal(true);
                                              }}
                                              actionLabel={`+ Add ${attrName} Value`}
                                              onChange={val => {
                                                const nextSelected = { ...(vRow.selected_attributes || {}), [attrName]: val };
                                                const orderedCodes = [];
                                                const orderedNames = [];
                                                (form.attributes || []).forEach(attr => {
                                                  const aName = typeof attr === 'object' && attr !== null ? attr.attribute : attr;
                                                  const vVal = nextSelected[aName];
                                                  if (vVal) {
                                                    const pVals = attributeValuesMap[aName] || [];
                                                    const matched = pVals.find(x => x.attribute_value === vVal);
                                                    orderedCodes.push((matched?.abbr || vVal).toUpperCase());
                                                    orderedNames.push(vVal);
                                                  }
                                                });

                                                const codeSuffix = orderedCodes.join('-');
                                                const nameSuffix = orderedNames.join(' ');

                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = {
                                                  ...vRow,
                                                  selected_attributes: nextSelected,
                                                  variant_item_code: codeSuffix ? `${form.item_code || 'ITEM'}-${codeSuffix}`.toUpperCase() : '',
                                                  variant_item_name: nameSuffix ? `${form.item_name || 'Item'} ${nameSuffix}` : ''
                                                };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                            />
                                          </div>
                                        );
                                      })}

                                      {/* Variant Type / Name */}
                                      <div className="il-form-field">
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>VARIANT NAME / TYPE</label>
                                        <input
                                          type="text"
                                          className="il-input"
                                          style={{ height: 38, fontSize: 13, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 12px' }}
                                          value={vRow.variant_item_name || ''}
                                          onChange={e => {
                                            const updatedVariants = [...variantForm.initial_variants];
                                            updatedVariants[vIdx] = { ...vRow, variant_item_name: e.target.value };
                                            setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                          }}
                                          placeholder="e.g. Ruled (RUL)"
                                        />
                                      </div>

                                      {/* Item Code & Expand Toggle */}
                                      <div className="il-form-field">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>ITEM CODE</label>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {(variantForm.initial_variants || []).length > 1 && !vRow.is_existing && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setVariantForm(vf => ({
                                                    ...vf,
                                                    initial_variants: vf.initial_variants.filter((_, i) => i !== vIdx)
                                                  }));
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600 }}
                                                title="Remove variant"
                                              >
                                                <Trash2 size={12} /> Remove
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, _isExpanded: !isExpanded };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              style={{
                                                background: isExpanded ? '#eff6ff' : '#f1f5f9',
                                                border: `1px solid ${isExpanded ? '#bfdbfe' : '#cbd5e1'}`,
                                                color: isExpanded ? '#2563eb' : '#475569',
                                                cursor: 'pointer',
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: 11,
                                                fontWeight: 700
                                              }}
                                              title={isExpanded ? "Collapse specifications" : "Expand specifications"}
                                            >
                                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                              {isExpanded ? 'Collapse' : 'Details'}
                                            </button>
                                          </div>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                          <input
                                            type="text"
                                            className="il-input"
                                            readOnly={Boolean(vRow.is_existing)}
                                            style={{
                                              height: 38,
                                              fontSize: 13,
                                              fontWeight: 700,
                                              fontFamily: "'DM Mono', monospace",
                                              color: '#1e293b',
                                              background: vRow.is_existing ? '#f1f5f9' : '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              borderRadius: 8,
                                              padding: '0 32px 0 12px'
                                            }}
                                            value={vRow.variant_item_code || ''}
                                            onChange={e => {
                                              if (vRow.is_existing) return;
                                              const updatedVariants = [...variantForm.initial_variants];
                                              updatedVariants[vIdx] = { ...vRow, variant_item_code: e.target.value };
                                              setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                            }}
                                            placeholder="ITEM-RUL"
                                          />
                                          {vRow.variant_item_code && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(vRow.variant_item_code || '');
                                              }}
                                              style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#94a3b8',
                                                padding: 2,
                                                display: 'flex',
                                                alignItems: 'center'
                                              }}
                                              title="Copy Item Code"
                                            >
                                              <Copy size={14} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expanded Details Section */}
                                    {isExpanded && (
                                      <>
                                        {/* Middle Row: Two Clean Cards - Nos Unit (Blue Left Accent) & Box Package (Amber Left Accent) */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
                                      {/* Column 1: Nos Unit */}
                                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3.5px solid #2563eb', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                                            Nos Unit <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>({vRow.stock_uom || form.default_uom || 'Nos'})</span>
                                          </div>
                                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: '#eff6ff', color: '#2563eb', borderRadius: 4, border: '1px solid #bfdbfe' }}>Base Unit</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8, alignItems: 'flex-end' }}>
                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>BUYING PRICE NOS</label>
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="il-input"
                                              style={{ height: 34, fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                              value={vRow.buying_price !== undefined ? vRow.buying_price : (form.buying_price || '')}
                                              onChange={e => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, buying_price: e.target.value };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>SELLING PRICE NOS</label>
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="il-input"
                                              style={{ height: 34, fontSize: 13, fontWeight: 700, color: '#16a34a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                              value={vRow.selling_price !== undefined ? vRow.selling_price : (form.selling_price || '')}
                                              onChange={e => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, selling_price: e.target.value };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>BARCODE NOS</label>
                                            <div style={{ position: 'relative' }}>
                                              <input
                                                type="text"
                                                className="il-input"
                                                style={{ height: 34, fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace", background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, paddingRight: 28 }}
                                                value={vRow.nos_barcode !== undefined ? vRow.nos_barcode : (vRow.variant_barcode || '')}
                                                onChange={e => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, nos_barcode: e.target.value, variant_barcode: e.target.value };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                                placeholder="Scan / Type Nos Barcode"
                                              />
                                              <Scan size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Column 2: Box Package */}
                                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3.5px solid #d97706', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                                            Box Package <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>(Box)</span>
                                          </div>
                                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: '#fffbeb', color: '#b45309', borderRadius: 4, border: '1px solid #fde68a' }}>Box Unit</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 0.9fr', gap: 8, alignItems: 'flex-end' }}>
                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>BUYING PRICE BOX</label>
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="il-input"
                                              style={{ height: 34, fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                              value={vRow.box_buying_price !== undefined ? vRow.box_buying_price : (form.box_buying_price || '')}
                                              onChange={e => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, box_buying_price: e.target.value };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>SELLING PRICE BOX</label>
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="il-input"
                                              style={{ height: 34, fontSize: 13, fontWeight: 700, color: '#d97706', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                              value={vRow.box_selling_price !== undefined ? vRow.box_selling_price : (form.box_selling_price || '')}
                                              onChange={e => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, box_selling_price: e.target.value };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <div>
                                            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>BARCODE BOX</label>
                                            <div style={{ position: 'relative' }}>
                                              <input
                                                type="text"
                                                className="il-input"
                                                style={{ height: 34, fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace", background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, paddingRight: 28 }}
                                                value={vRow.box_barcode || ''}
                                                onChange={e => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, box_barcode: e.target.value };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                                placeholder="Scan / Type Box Barcode"
                                              />
                                              <Scan size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                                            </div>
                                          </div>

                                          <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>NOS IN BOX</label>
                                              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Pcs / Box</span>
                                            </div>
                                            <input
                                              type="number"
                                              step="1"
                                              min="0"
                                              className="il-input"
                                              style={{ height: 34, fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                              value={vRow.custom_pieces_per_box !== undefined ? vRow.custom_pieces_per_box : (form.custom_pieces_per_box || '')}
                                              onChange={e => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                updatedVariants[vIdx] = { ...vRow, custom_pieces_per_box: e.target.value };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              placeholder="e.g. 12"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Full Specifications Section: Classification, UOM, Toggles & Supplier */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
                                      {/* General Item Classification & Units Header */}
                                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                          <div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>General Item Classification & Units</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Inherited from template — override as needed</div>
                                          </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
                                          {/* Left: 2x2 Grid (Row 1: Main Category, Item Subgroup; Row 2: Base UOM, Units in Box) */}
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            {/* Row 1, Col 1: Main Category */}
                                            <div className="il-form-field">
                                              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>MAIN CATEGORY</label>
                                              <SearchableSelectInline
                                                value={vRow.main_group !== undefined ? vRow.main_group : formMainGroup}
                                                options={groupHierarchy.map(h => ({ label: h.main_group, value: h.main_group }))}
                                                placeholder="Select Main Category"
                                                onChange={val => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, main_group: val, item_group: '' };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                              />
                                            </div>

                                            {/* Row 1, Col 2: Item Subgroup */}
                                            <div className="il-form-field">
                                              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>ITEM SUBGROUP</label>
                                              <SearchableSelectInline
                                                value={vRow.item_group !== undefined ? vRow.item_group : form.item_group}
                                                options={
                                                  (vRow.main_group || formMainGroup) && groupHierarchy.find(h => h.main_group === (vRow.main_group || formMainGroup))
                                                    ? (groupHierarchy.find(h => h.main_group === (vRow.main_group || formMainGroup)).subgroups || []).map(s => ({ label: s, value: s }))
                                                    : itemGroups
                                                }
                                                placeholder="Select Subgroup"
                                                onChange={val => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, item_group: val };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                              />
                                            </div>

                                            {/* Row 2, Col 1: Base UOM */}
                                            <div className="il-form-field">
                                              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>BASE UOM</label>
                                              <SearchableSelectInline
                                                value={vRow.stock_uom !== undefined ? vRow.stock_uom : (form.default_uom || 'Nos')}
                                                options={baseUomOptions}
                                                placeholder="Base UOM"
                                                onChange={val => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, stock_uom: val };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                              />
                                            </div>

                                            {/* Row 2, Col 2: No of units in box */}
                                            <div className="il-form-field">
                                              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>NO OF UNITS IN BOX</label>
                                              <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                className="il-input"
                                                style={{ height: 34, fontSize: 13, fontWeight: 600, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                                value={vRow.custom_pieces_per_box !== undefined ? vRow.custom_pieces_per_box : (form.custom_pieces_per_box || '')}
                                                onChange={e => {
                                                  const updatedVariants = [...variantForm.initial_variants];
                                                  updatedVariants[vIdx] = { ...vRow, custom_pieces_per_box: e.target.value };
                                                  setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                }}
                                                placeholder="e.g. 12"
                                              />
                                            </div>
                                          </div>

                                          {/* Right: UOM Conversions Table Widget */}
                                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                              <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>UOM Conversions</span>
                                              <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>Auto</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>
                                              Base: {vRow.stock_uom || form.default_uom || 'Nos'} | Box Factor: {pcsBox || 0}
                                            </div>
                                            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                              <thead>
                                                <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>UOM</th>
                                                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>FACTOR</th>
                                                  <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>TYPE</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                <tr>
                                                  <td style={{ padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>{vRow.stock_uom || form.default_uom || 'Nos'}</td>
                                                  <td style={{ padding: '5px 6px', color: '#475569' }}>1 {vRow.stock_uom || form.default_uom || 'Nos'}</td>
                                                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: '#eff6ff', color: '#2563eb', borderRadius: 3 }}>Base</span>
                                                  </td>
                                                </tr>
                                                {pcsBox > 0 && (
                                                  <tr>
                                                    <td style={{ padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Box</td>
                                                    <td style={{ padding: '5px 6px', color: '#475569' }}>{pcsBox} {vRow.stock_uom || form.default_uom || 'Nos'}</td>
                                                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: '#fef3c7', color: '#b45309', borderRadius: 3 }}>Box</span>
                                                    </td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Bottom 3-Card Row: Inventory & Sales, Loyalty & Status, Supplier Mapping */}
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                                        {/* 1. Inventory & Sales Switches */}
                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                                            INVENTORY & SALES
                                          </div>
                                          {[
                                            { key: 'is_stock_item', label: 'Track Stock', desc: 'Enables inventory ledger', lockedForExisting: true },
                                            { key: 'is_sales_item', label: 'Allow Sales', desc: 'Show in POS & Sales Orders' },
                                            { key: 'is_purchase_item', label: 'Allow Purchase', desc: 'Available for procurement' },
                                          ].map(f => {
                                            const checked = vRow[f.key] !== undefined ? vRow[f.key] === 1 : true;
                                            const isFieldLocked = f.lockedForExisting && Boolean(vRow.is_existing);
                                            return (
                                              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                                                <div>
                                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                                    {f.label} {isFieldLocked && <span style={{ fontSize: 10, color: '#64748b' }}>(Locked)</span>}
                                                  </div>
                                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.desc}</div>
                                                </div>
                                                <label className="il-switch">
                                                  <input
                                                    type="checkbox"
                                                    disabled={isFieldLocked}
                                                    checked={checked}
                                                    onChange={e => {
                                                      if (isFieldLocked) return;
                                                      const updatedVariants = [...variantForm.initial_variants];
                                                      updatedVariants[vIdx] = { ...vRow, [f.key]: e.target.checked ? 1 : 0 };
                                                      setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                    }}
                                                  />
                                                  <span className="il-switch-track">
                                                    <span className="il-switch-thumb" />
                                                  </span>
                                                </label>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {/* 2. Loyalty & Status Switches */}
                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                                            LOYALTY & STATUS
                                          </div>
                                          {[
                                            { key: 'custom_loyalty_eligible', label: 'Loyalty Points', desc: 'Earn points on purchase' },
                                            { key: 'custom_allow_discount', label: 'Allow Discount', desc: 'Enable manual overrides' },
                                            { key: 'disabled', label: 'Disable Item', desc: 'Hide from active registries' },
                                          ].map(f => {
                                            const checked = f.key === 'disabled' 
                                              ? (vRow.disabled !== undefined ? Boolean(vRow.disabled) : false)
                                              : (vRow[f.key] !== undefined ? vRow[f.key] === 1 : true);
                                            return (
                                              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                                                <div>
                                                  <div style={{ fontSize: 13, fontWeight: 700, color: f.key === 'disabled' && checked ? '#b91c1c' : '#1e293b' }}>{f.label}</div>
                                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.desc}</div>
                                                </div>
                                                <label className="il-switch">
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={e => {
                                                      const updatedVariants = [...variantForm.initial_variants];
                                                      if (f.key === 'disabled') {
                                                        updatedVariants[vIdx] = { ...vRow, disabled: e.target.checked };
                                                      } else {
                                                        updatedVariants[vIdx] = { ...vRow, [f.key]: e.target.checked ? 1 : 0 };
                                                      }
                                                      setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                    }}
                                                  />
                                                  <span className="il-switch-track" style={{ backgroundColor: checked && f.key === 'disabled' ? '#ef4444' : undefined }}>
                                                    <span className="il-switch-thumb" />
                                                  </span>
                                                </label>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {/* 3. Supplier Mapping Card */}
                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                              SUPPLIER MAPPING
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updatedVariants = [...variantForm.initial_variants];
                                                const currSups = updatedVariants[vIdx].supplier_items || [...(form.supplier_items || [])];
                                                updatedVariants[vIdx] = {
                                                  ...vRow,
                                                  supplier_items: [...currSups, { supplier: '', supplier_part_no: '' }]
                                                };
                                                setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                              }}
                                              style={{ background: '#2563eb', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                            >
                                              <Plus size={12} /> Add Supplier
                                            </button>
                                          </div>
                                          {((vRow.supplier_items !== undefined ? vRow.supplier_items : form.supplier_items) || []).length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              {((vRow.supplier_items !== undefined ? vRow.supplier_items : form.supplier_items) || []).map((s, sIdx) => (
                                                <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                  <div style={{ flex: 1.2 }}>
                                                    <SearchableSelectInline
                                                      value={s.supplier}
                                                      options={suppliers.map(sup => ({ label: sup.supplier_name, value: sup.name }))}
                                                      placeholder="Select Supplier"
                                                      onChange={val => {
                                                        const updatedVariants = [...variantForm.initial_variants];
                                                        const currSups = [...((vRow.supplier_items !== undefined ? vRow.supplier_items : form.supplier_items) || [])];
                                                        currSups[sIdx] = { ...currSups[sIdx], supplier: val };
                                                        updatedVariants[vIdx] = { ...vRow, supplier_items: currSups };
                                                        setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                      }}
                                                    />
                                                  </div>
                                                  <input
                                                    type="text"
                                                    className="il-input"
                                                    style={{ flex: 1, height: 32, fontSize: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                                    placeholder="Supplier SKU / Part No"
                                                    value={s.supplier_part_no || ''}
                                                    onChange={e => {
                                                      const updatedVariants = [...variantForm.initial_variants];
                                                      const currSups = [...((vRow.supplier_items !== undefined ? vRow.supplier_items : form.supplier_items) || [])];
                                                      currSups[sIdx] = { ...currSups[sIdx], supplier_part_no: e.target.value };
                                                      updatedVariants[vIdx] = { ...vRow, supplier_items: currSups };
                                                      setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const updatedVariants = [...variantForm.initial_variants];
                                                      const currSups = [...((vRow.supplier_items !== undefined ? vRow.supplier_items : form.supplier_items) || [])];
                                                      updatedVariants[vIdx] = { ...vRow, supplier_items: currSups.filter((_, i) => i !== sIdx) };
                                                      setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div style={{ textAlign: 'center', padding: '16px 8px', color: '#94a3b8', fontSize: 11 }}>
                                              <Users size={20} style={{ margin: '0 auto 4px', opacity: 0.4, display: 'block' }} />
                                              <span style={{ fontWeight: 600 }}>No suppliers linked</span>
                                              <div style={{ fontSize: 10, marginTop: 2 }}>Add a supplier to map this variant.</div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Branch Visibility (Only show Branch Visibility if not cashier) */}
                                      {!((user_roles || []).includes("Cashier") && !isAdmin) && (
                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <MapPin size={14} color="#ea580c" />
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Branch Visibility:</span>
                                            {((vRow.branch_availability !== undefined ? vRow.branch_availability : form.branch_availability) || []).length > 0 ? (
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {((vRow.branch_availability !== undefined ? vRow.branch_availability : form.branch_availability) || []).map((b, bIdx) => (
                                                  <span key={bIdx} style={{ fontSize: 11, fontWeight: 700, background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    {b.warehouse}
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const updatedVariants = [...variantForm.initial_variants];
                                                        const currBranches = ((vRow.branch_availability !== undefined ? vRow.branch_availability : form.branch_availability) || []).filter((_, i) => i !== bIdx);
                                                        updatedVariants[vIdx] = { ...vRow, branch_availability: currBranches };
                                                        setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                                      }}
                                                      style={{ background: 'none', border: 'none', color: '#ea580c', cursor: 'pointer', padding: 0 }}
                                                    >
                                                      ×
                                                    </button>
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Global / Inherit from Template</span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedVariants = [...variantForm.initial_variants];
                                              const currBranches = updatedVariants[vIdx].branch_availability || [...(form.branch_availability || [])];
                                              updatedVariants[vIdx] = {
                                                ...vRow,
                                                branch_availability: [...currBranches, { warehouse: '' }]
                                              };
                                              setVariantForm(vf => ({ ...vf, initial_variants: updatedVariants }));
                                            }}
                                            style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
                                          >
                                            + Add Branch
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}

                              {/* Bottom Add Variant Action Row */}
                              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newId = `var-${(variantForm.initial_variants || []).length + 1}-${Date.now()}`;
                                    const initialAttrs = {};
                                    const orderedCodes = [];
                                    const orderedNames = [];

                                    (form.attributes || []).forEach(a => {
                                      const attrName = typeof a === 'object' && a !== null ? a.attribute : a;
                                      const possibleVals = attributeValuesMap[attrName] || [];
                                      if (possibleVals.length > 0) {
                                        const firstVal = possibleVals[0].attribute_value;
                                        initialAttrs[attrName] = firstVal;
                                        orderedCodes.push((possibleVals[0].abbr || firstVal).toUpperCase());
                                        orderedNames.push(firstVal);
                                      }
                                    });

                                    const codeSuffix = orderedCodes.join('-');
                                    const nameSuffix = orderedNames.join(' ');

                                    setVariantForm(vf => ({
                                      ...vf,
                                      create_first_variant: true,
                                      initial_variants: [
                                        ...(vf.initial_variants || []),
                                        {
                                          id: newId,
                                          is_existing: false,
                                          selected_attributes: initialAttrs,
                                          variant_item_code: codeSuffix ? `${form.item_code || 'ITEM'}-${codeSuffix}`.toUpperCase() : '',
                                          variant_item_name: nameSuffix ? `${form.item_name || 'Item'} ${nameSuffix}` : '',
                                          variant_barcode: '',
                                          nos_barcode: '',
                                          box_barcode: '',
                                          image: '',
                                          imagePreview: '',
                                          use_custom_code: true,
                                          is_stock_item: 1,
                                          is_sales_item: 1,
                                          is_purchase_item: 1
                                        }
                                      ]
                                    }));
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 24px',
                                    background: '#f8fafc',
                                    border: '1.5px dashed #2563eb',
                                    color: '#2563eb',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  <Plus size={16} />
                                  <span>+ Add Another Variant</span>
                                </button>
                              </div>
                            </div>
                          )}
                  </div>
                )}

                {/* Controls row: Inventory & Sales + Loyalty & Status (Hidden when Has Variants is checked because each variant configures its own) */}
                {!Boolean(form.has_variants) && (
                  <>
                    <div className="il-form-grid-2">
                      {/* Inventory & Sales */}
                      <CardSection title="Inventory & Sales" icon={<BarChart2 size={14} />}>
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { key: 'is_stock_item', label: 'Track Stock', desc: 'Enables inventory ledger' },
                            { key: 'is_sales_item', label: 'Allow Sales', desc: 'Show in POS & Sales Orders' },
                            { key: 'is_purchase_item', label: 'Allow Purchase', desc: 'Available for procurement' },
                          ].map(f => (
                            <label
                              key={f.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                background: form[f.key] === 1 ? T.blueLight : T.bg,
                                borderRadius: 9,
                                cursor: 'pointer',
                                border: `1.5px solid ${form[f.key] === 1 ? T.blueMid : T.border}`,
                                transition: 'all 0.15s'
                              }}
                            >
                              <input
                                type="checkbox"
                                className="il-check"
                                checked={form[f.key] === 1}
                                onChange={e => setForm({ ...form, [f.key]: e.target.checked ? 1 : 0 })}
                              />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{f.label}</div>
                                <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </CardSection>

                      {/* Loyalty & Status */}
                      <CardSection title="Loyalty & Status" icon={<Tag size={14} />}>
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { key: 'custom_loyalty_eligible', label: 'Loyalty Points', desc: 'Earn points on purchase' },
                            { key: 'custom_allow_discount', label: 'Allow Discount', desc: 'Enable manual overrides' },
                            { key: 'disabled', label: 'Disable Item', desc: 'Hide from active registries' }
                          ].map(f => {
                            const isChecked = f.key === 'disabled' ? Boolean(form.disabled) : form[f.key] === 1;
                            return (
                              <label
                                key={f.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '10px 12px',
                                  background: isChecked ? (f.key === 'disabled' ? '#fee2e2' : T.blueLight) : T.bg,
                                  borderRadius: 9,
                                  cursor: 'pointer',
                                  border: `1.5px solid ${isChecked ? (f.key === 'disabled' ? '#fca5a5' : T.blueMid) : T.border}`,
                                  transition: 'all 0.15s'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="il-check"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (f.key === 'disabled') {
                                      setForm({ ...form, disabled: e.target.checked });
                                    } else {
                                      setForm({ ...form, [f.key]: e.target.checked ? 1 : 0 });
                                    }
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: f.key === 'disabled' && isChecked ? '#b91c1c' : T.text }}>
                                    {f.label}
                                  </div>
                                  <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </CardSection>
                    </div>

                    {/* UOM + Suppliers */}
                    <div className="il-form-grid-2">
                      <CardSection 
                        title="UOM Conversions (Auto-Calculated)" 
                        icon={<Scale size={14} />}
                        badge={<span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: '#ecfdf5', color: '#059669', borderRadius: 6, border: '1px solid #a7f3d0' }}>Auto Synced</span>}
                      >
                        {form.uoms.length > 0 ? (
                          <div style={{ padding: '6px 12px' }}>
                            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, fontStyle: 'italic' }}>
                              * Generated automatically from <b>Base UOM ({form.default_uom || 'Nos'})</b> and <b>Pieces Per Box ({form.custom_pieces_per_box || 0})</b>.
                            </div>
                            <table className="il-table" style={{ width: '100%' }}>
                              <thead>
                                <tr style={{ background: T.bg }}>
                                  <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: T.textMuted }}>UOM UNIT</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: T.textMuted }}>CONVERSION FACTOR</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textMuted }}>TYPE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.uoms.map((u, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: u.uom === (form.default_uom || 'Nos') ? T.blue : '#059669' }}>
                                      {u.uom}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontFamily: "'DM Mono', monospace", color: T.text }}>
                                      {u.conversion_factor} {form.default_uom || 'Nos'}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                      <span style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        background: u.uom === (form.default_uom || 'Nos') ? '#eff6ff' : '#f0fdf4',
                                        color: u.uom === (form.default_uom || 'Nos') ? '#2563eb' : '#16a34a',
                                        border: `1px solid ${u.uom === (form.default_uom || 'Nos') ? '#bfdbfe' : '#bbf7d0'}`
                                      }}>
                                        {u.uom === (form.default_uom || 'Nos') ? 'Base Unit' : 'Box Package'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : <div style={{ padding: '18px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No UOM Conversions</div>}
                      </CardSection>

                      {!((user_roles || []).includes("Cashier") && !isAdmin) && (
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
                      )}

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
                  </>
                )}

                {/* Product Image */}
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
      {/* Modals for POS 5 Features */}
      <CreateVariantModal 
        isOpen={showVariantModal} 
        onClose={() => setShowVariantModal(false)}
        onVariantCreated={() => fetchItems()}
      />
      <CreateMultipleVariantsModal 
        isOpen={showMultipleVariantModal} 
        onClose={() => setShowMultipleVariantModal(false)}
        onVariantsCreated={() => fetchItems()}
      />
      <NbiItemGeneratorModal 
        isOpen={showNbiModal} 
        onClose={() => setShowNbiModal(false)}
        onItemCreated={() => fetchItems()}
      />
      <BarcodePrintModal 
        isOpen={showBarcodePrintModal} 
        selectedItem={selectedBarcodeItem}
        onClose={() => {
          setShowBarcodePrintModal(false);
          setSelectedBarcodeItem(null);
        }}
      />

      {/* Add Attribute Value Quick Modal */}
      {showAddAttrValueModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 16000,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'slideUp 0.2s ease-out'
          }}>
            <div style={{
              padding: '16px 20px',
              background: '#1e1b4b',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#c7d2fe" />
                <span style={{ fontSize: 14, fontWeight: 800 }}>
                  {attrModalData.isNewAttribute ? 'Create New Attribute' : `Add Value to ${attrModalData.attribute_name}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAttrValueModal(false)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Attribute Name * (e.g. Size, Colour, Paper GSM, Material)
                </label>
                <input
                  type="text"
                  className="il-input"
                  value={attrModalData.attribute_name}
                  readOnly={!attrModalData.isNewAttribute}
                  onChange={e => setAttrModalData({ ...attrModalData, attribute_name: e.target.value })}
                  placeholder="e.g. Size or Material"
                  autoFocus={attrModalData.isNewAttribute}
                  style={!attrModalData.isNewAttribute ? { background: '#f8fafc', color: '#64748b' } : {}}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  {attrModalData.isNewAttribute ? 'Initial Value * (e.g. Small, 80 GSM, Cotton)' : 'New Value * (e.g. 50 Pages, 120 GSM, Lavender)'}
                </label>
                <input
                  type="text"
                  className="il-input"
                  value={attrModalData.attribute_value}
                  onChange={e => setAttrModalData({ ...attrModalData, attribute_value: e.target.value })}
                  placeholder="Enter attribute value"
                  autoFocus={!attrModalData.isNewAttribute}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Abbreviation / Short Code (Optional)
                </label>
                <input
                  type="text"
                  className="il-input"
                  value={attrModalData.abbr}
                  onChange={e => setAttrModalData({ ...attrModalData, abbr: e.target.value })}
                  placeholder="e.g. 50P or S or LAV"
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAddAttrValueModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewAttributeValue}
                disabled={savingAttrValue || !attrModalData.attribute_name?.trim() || !attrModalData.attribute_value?.trim()}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  background: '#6d28d9',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: savingAttrValue || !attrModalData.attribute_name?.trim() || !attrModalData.attribute_value?.trim() ? 'not-allowed' : 'pointer',
                  opacity: savingAttrValue || !attrModalData.attribute_name?.trim() || !attrModalData.attribute_value?.trim() ? 0.6 : 1
                }}
              >
                {savingAttrValue ? 'Saving...' : (attrModalData.isNewAttribute ? 'Create & Select Attribute' : 'Add & Select Value')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Group / Subgroup Creation Modal */}
      {showItemGroupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 15000,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: `1.5px solid ${T.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: T.blueLight,
                  color: T.blue,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  <Tag size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: T.text, margin: 0 }}>
                    Create Item Group / Subgroup
                  </h3>
                  <p style={{ fontSize: '12px', color: T.textMuted, margin: 0, marginTop: '2px' }}>
                    Add a new category or subgroup into ERPNext
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowItemGroupModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.textMuted,
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.background = T.bg}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveItemGroup} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="il-form-field">
                <label className="il-form-label req" style={{ fontWeight: 700 }}>
                  Item Group Name
                </label>
                <input
                  type="text"
                  className="il-input"
                  placeholder="e.g. Beverages, Hot Drinks, Dairy..."
                  value={itemGroupModalForm.item_group_name}
                  onChange={e => setItemGroupModalForm({ ...itemGroupModalForm, item_group_name: e.target.value })}
                  autoFocus
                  required
                  style={{ height: '42px', fontSize: '14px' }}
                />
              </div>

              <div className="il-form-field">
                <label className="il-form-label" style={{ fontWeight: 700 }}>
                  Parent Item Group
                </label>
                <select
                  className="il-select"
                  value={itemGroupModalForm.parent_item_group}
                  onChange={e => setItemGroupModalForm({ ...itemGroupModalForm, parent_item_group: e.target.value })}
                  style={{ height: '42px', fontSize: '14px' }}
                >
                  <option value="All Item Groups">All Item Groups (Top-level / Main Category)</option>
                  {groupHierarchy.map(h => (
                    <option key={h.main_group} value={h.main_group}>
                      {h.main_group}
                    </option>
                  ))}
                  {itemGroups
                    .filter(g => g.value !== 'All Item Groups' && !groupHierarchy.some(h => h.main_group === g.value))
                    .map(g => (
                      <option key={g.value} value={g.value}>
                        {g.label || g.value}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>
                  {itemGroupModalForm.parent_item_group === 'All Item Groups'
                    ? 'This will be created as a Main Category.'
                    : `This will be created as a Subgroup under "${itemGroupModalForm.parent_item_group}".`}
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                background: T.bg,
                borderRadius: '10px',
                border: `1px solid ${T.borderLight}`,
                marginTop: '4px'
              }}>
                <input
                  type="checkbox"
                  id="ig-is-group"
                  className="il-check"
                  checked={itemGroupModalForm.is_group}
                  onChange={e => setItemGroupModalForm({ ...itemGroupModalForm, is_group: e.target.checked })}
                />
                <label htmlFor="ig-is-group" style={{ fontSize: '13px', fontWeight: 600, color: T.text, cursor: 'pointer' }}>
                  Group Node (Can contain child subgroups)
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '12px',
                paddingTop: '16px',
                borderTop: `1px solid ${T.borderLight}`
              }}>
                <button
                  type="button"
                  className="il-btn il-btn-secondary"
                  onClick={() => setShowItemGroupModal(false)}
                  disabled={savingItemGroup}
                  style={{ height: '40px', padding: '0 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="il-btn il-btn-primary"
                  disabled={savingItemGroup || !itemGroupModalForm.item_group_name.trim()}
                  style={{ height: '40px', padding: '0 22px', minWidth: '120px' }}
                >
                  {savingItemGroup ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      Creating...
                    </>
                  ) : (
                    'Save Group'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

}