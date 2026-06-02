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
      <div className="purchase-container p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <ArrowRightLeft className="w-8 h-8 text-orange-500" />
              Purchase Returns
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 italic">Debit Notes & Stock Corrections</p>
          </div>
          <button 
            onClick={() => {/* TODO: Implement Create Return from Original PR */}}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-100 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Purchase Return
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-tighter">Syncing directory...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Identity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right flex items-center justify-end gap-1">Value (<DirhamIcon size={9} />)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {returns.map(ret => (
                  <tr key={ret.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                          <FileText size={16} />
                        </div>
                        <span className="text-xs font-black text-slate-700">{ret.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600">{ret.supplier}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{ret.posting_date}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-black text-slate-800 tabular-nums">
                        {parseFloat(ret.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${ret.docstatus === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => loadReturn(ret.name)}
                        className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-orange-500 transition-all translate-x-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      >
                        <Zap size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Detail View (Similar to PO but for Returns)
  return (
    <div className="purchase-container animate-slideIn">
      <div className="bg-white px-6 py-2 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-all"><ArrowLeft size={18} /></button>
          <div className="flex flex-col text-left">
            <h1 className="text-[18px] font-bold text-[#0f172a] leading-tight tracking-tight">
              Return Document: {formData.name}
            </h1>
            <p className="text-[11px] font-normal text-slate-400 mt-0.5">Procurement / Purchase Return</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest ${formData.docstatus === 1 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
          {formData.status}
        </div>
      </div>

      <div className="po-layout-container !pt-6 pb-20">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            {/* Connection Dashboard */}
            <div className="mb-6 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Zap className="w-3 h-3 text-orange-500" />
                Linked Records Dashboard
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Simplified categories for return */}
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase">Original Receipt</span>
                  <span className="text-xs font-black text-slate-600 underline cursor-pointer hover:text-orange-500">{formData.return_against || 'None'}</span>
                </div>
              </div>
            </div>

            {/* Main Return Body */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Supplier</label>
                  <p className="text-sm font-black text-slate-800">{formData.supplier?.supplier_name || formData.supplier?.name}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                  <p className="text-sm font-black text-slate-800">{formData.posting_date}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Warehouse</label>
                  <p className="text-sm font-black text-slate-800">{formData.set_warehouse}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Return Against</label>
                  <p className="text-sm font-bold text-orange-600 italic underline">{formData.return_against}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Return Qty</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Rate</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, i) => (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-xs text-slate-800">{item.item_name}</div>
                          <div className="text-[9px] font-bold text-slate-400">{item.item_code}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-black text-red-500">{item.qty}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-bold text-slate-600">{parseFloat(item.rate).toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-black text-slate-800">{parseFloat(item.amount).toFixed(2)}</span>
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
    </div>
  );
}

export default PurchaseReturn;
