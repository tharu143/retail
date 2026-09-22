import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package, Users,
  DollarSign, ShoppingCart, Save, Send, Trash2, Plus, Box, Scan, ChevronDown, ChevronUp, History,
  Search, File, Camera, X, Upload, Image as ImageIcon, Zap, Palette, ArrowRightLeft, ArrowLeft
} from 'lucide-react';
import CustomSearchDropdown from './CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './Purchase.css';
import '../Headers/LegacyPOS.css';
import '../Admin/SalesOrder.css';

const PRItemModel = {
  item_code: null,
  item_name: '',
  rate: 0,
  amount: 0,
  qty: 0,
  received_qty: 0,
  accepted_qty: 0,
  rejected_qty: 0,
  custom_supplier_sl_num: '',
  custom_ref_sl_no: '',
  supplier_part_no: '',
  custom_box_qty: 0,
  custom_pieces_per_box: 1,
  custom_box_price: 0,
  uom: 'Nos',
  stock_uom: 'Nos',
  rejected_warehouse: ''
};

function PurchaseReturn() {
  const theme = useSelector((state) => state.user.theme);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [formData, setFormData] = useState({
    name: '',
    supplier: null,
    posting_date: new Date().toISOString().slice(0, 10),
    company: localStorage.getItem('company') || '',
    currency: 'AED',
    set_warehouse: '',
    is_return: 1,
    return_against: '',
    items: [],
    taxes: [],
    grand_total: 0,
    docstatus: 0
  });

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkedCategories, setLinkedCategories] = useState({});
  const [linkedDocStatuses, setLinkedDocStatuses] = useState({});
  const [loadingLinks, setLoadingLinks] = useState(false);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = `/api/method/kyle_retail.retail_api.api`;
  const RESOURCE_API = `/api/resource/Purchase Receipt`;

  useEffect(() => {
    if (viewMode === 'list') {
      fetchReturns();
    }
  }, [viewMode]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const filters = JSON.stringify([["is_return", "=", 1], ["company", "=", formData.company]]);
      const res = await fetch(`${RESOURCE_API}?filters=${encodeURIComponent(filters)}&fields=["name","supplier","grand_total","posting_date","status","docstatus"]&order_by=creation desc`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setReturns(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReturn = async (name) => {
    setLoading(true);
    try {
      const res = await fetch(`${RESOURCE_API}/${name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const doc = data.data;
        setFormData({
          ...doc,
          supplier: { name: doc.supplier, supplier_name: doc.supplier_name || doc.supplier },
          items: (doc.items || []).map(it => ({ ...PRItemModel, ...it })),
          taxes: doc.taxes || []
        });
        setViewMode('detail');
        fetchLinkedDocs(name);
      }
    } catch (err) {
      setError("Failed to load return details");
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedDocs = async (name) => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`${API_PATH}.get_linked_documents?doctype=Purchase Receipt&name=${name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedCategories(data.message?.categories || {});
        // Fetch statuses...
      }
    } catch (err) { console.error(err); }
    finally { setLoadingLinks(false); }
  };

  if (viewMode === 'list') {
    return (
      <div className="erp-page so-page animate-in fade-in duration-300">
        <PageHeader className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <ArrowRightLeft size={20} className="text-orange-500" />
              Purchase Returns
            </h1>
            <p className="so-page-subtitle">Debit Notes & Stock Corrections</p>
          </div>
          <button
            onClick={() => {/* TODO: Implement Create Return from Original PR */ }}
            className="erp-button erp-button-primary so-btn-primary"
          >
            <Plus size={16} />
            New Purchase Return
          </button>
        </PageHeader>

        <div className="so-content">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-tighter">Syncing directory...</p>
            </div>
          ) : (
            <div className="erp-table-card so-table-card">
              <div className="erp-table-scroll so-table-wrapper">
                <table className="erp-table so-table">
                  <thead>
                    <tr>
                      <th>Identity</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Value</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ width: '48px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map(ret => (
                      <tr key={ret.name} onClick={() => loadReturn(ret.name)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileText size={16} />
                            </div>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{ret.name}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#475569' }}>{ret.supplier}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#94a3b8' }}>{ret.posting_date}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#334155' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {renderCurrency(ret.currency || formData.currency, 12)}
                            <span>{parseFloat(ret.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`so-badge ${ret.docstatus === 1 ? 'so-badge-submitted' : 'so-badge-draft'}`}>
                            {ret.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); loadReturn(ret.name); }}
                            className="so-btn-ghost"
                            style={{ padding: '0.25rem' }}
                          >
                            <Zap size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detail View (Similar to PO but for Returns)
  return (
    <div className="erp-page so-page animate-in fade-in duration-500">
      {/* 1. Page Header */}
      <PageHeader className="so-page-header">
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode('list')} className="erp-button erp-button-secondary so-btn-secondary" style={{ padding: '0.5rem', minWidth: 'auto' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col text-left">
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <RotateCw size={18} className="text-orange-500" />
              Return Document: {formData.name}
            </h1>
            <p className="so-page-subtitle">
              Against Reference: {formData.return_against}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${formData.docstatus === 1 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
            {formData.status}
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="erp-button erp-button-secondary so-btn-secondary"
            style={{ color: '#475569' }}
          >
            Back
          </button>
        </div>
      </PageHeader>

      {/* 2. Main Page Layout */}
      <div className="so-layout" style={{ paddingTop: '1.5rem', paddingBottom: '5rem' }}>
        <div className="so-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {/* Summary Bar for Stats */}
          <div className="so-summary-bar">
            <div className="so-summary-item">
              <span className="so-summary-label">Debit Valuation</span>
              <span className="so-summary-value grand" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <DirhamIcon size={14} className="text-slate-400" />
                <span>{Math.abs(formData.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Quantity Returned</span>
              <span className="so-summary-value">
                {formData.items ? formData.items.reduce((acc, it) => acc + Math.abs(it.qty), 0) : 0} Units
              </span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Lifecycle Status</span>
              <span className="so-badge" style={{
                background: formData.docstatus === 1 ? '#dcfce7' : (formData.docstatus === 2 ? '#fee2e2' : '#fef9c3'),
                color: formData.docstatus === 1 ? '#156534' : (formData.docstatus === 2 ? '#b91c1c' : '#854d0e'),
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.25rem 0.6rem',
                borderRadius: '9999px',
                textTransform: 'uppercase'
              }}>
                {formData.docstatus === 1 ? 'Submitted' : (formData.docstatus === 2 ? 'Cancelled' : 'Draft')}
              </span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item" style={{ textAlign: 'right' }}>
              <span className="so-summary-label">Posting Date</span>
              <span className="so-summary-value" style={{ fontSize: '0.85rem' }}>{formData.posting_date}</span>
            </div>
          </div>

          {/* Main Detail Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="erp-card so-card">
              <div className="erp-section-header so-card-header">
                <h5 className="so-card-title">Debit Properties</h5>
              </div>
              <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Supplier</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{formData.supplier?.supplier_name || formData.supplier?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Original Reference</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>{formData.return_against}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Warehouse</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{formData.set_warehouse}</span>
                </div>
              </div>
            </div>

            <div className="erp-card so-card">
              <div className="erp-section-header so-card-header">
                <h5 className="so-card-title">Linked Records</h5>
              </div>
              <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Original Receipt Reference</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textDecoration: 'underline' }}>{formData.return_against || 'None'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table Presentation */}
          <div className="erp-table-card so-table-card">
            <div className="erp-section-header so-card-header" style={{ padding: '0.75rem 1.25rem' }}>
              <h5 className="so-card-title">Debit Item Matrix</h5>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>
                {formData.items ? formData.items.length : 0} ACTIVE ITEMS
              </span>
            </div>
            <div className="erp-table-scroll so-table-wrapper" style={{ maxHeight: 'none' }}>
              <table className="erp-table so-table">
                <thead>
                  <tr>
                    <th>Asset Specification</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Credit Rate</th>
                    <th style={{ textAlign: 'right' }}>Extension</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items?.map((item, idx) => (
                    <tr key={idx} style={{ cursor: 'default' }}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.item_code}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{item.item_name}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: '#475569' }}>
                        {Math.abs(item.qty)} <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{item.uom}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <DirhamIcon size={12} className="text-slate-400" />
                          <span>{parseFloat(item.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <DirhamIcon size={12} className="text-slate-400" />
                          <span>{Math.abs(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchaseReturn;