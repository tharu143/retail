import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { 
  ArrowLeft, Save, CheckCircle2, XCircle, Package, Building2, 
  Search, Trash2, Loader2, AlertTriangle, ArrowRight, Info, Plus, Scan, MapPin, X
} from 'lucide-react';
import { format } from 'date-fns';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import Swal from 'sweetalert2';

const API_PATH = '/api/method/kyle_retail.retail_api.api';

// Branch Availability Modal
const BranchAvailabilityModal = ({ isOpen, onClose, itemCode, itemName, currentWarehouse, onSelectBranch }) => {
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (isOpen && itemCode) {
            fetchNearestStock();
        }
    }, [isOpen, itemCode]);

    const fetchNearestStock = async () => {
        try {
            setLoading(true);
            const sid = localStorage.getItem('session') || '';
            const res = await axios.get(`${API_PATH}.find_nearest_stock`, {
                params: { item_code: itemCode, current_warehouse: currentWarehouse },
                headers: { 'X-Frappe-SID': sid }
            });
            // Filter to only show branches with stock
            const stockBranches = (res.data?.message || []).filter(b => b.qty > 0);
            setBranches(stockBranches);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Available Nearby</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                            <Package size={10} /> {itemName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-600">
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white custom-scrollbar">
                    {loading ? (
                        <div className="py-16 text-center space-y-4">
                            <Loader2 className="animate-spin mx-auto text-blue-500" size={28} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Locating Inventory...</p>
                        </div>
                    ) : branches.length > 0 ? (
                        branches.map((b, idx) => (
                            <div key={idx} className="group p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">{b.warehouse}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                            <MapPin size={9} className="text-slate-300" /> {b.distance === 9999 ? 'Nearby' : `${b.distance} km`}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-blue-500 uppercase">Price</div>
                                        <div className="text-sm font-black text-slate-800">
                                            {b.price?.toFixed(2) || '0.00'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base font-black text-emerald-600">
                                            {b.qty} <span className="text-[9px] uppercase ml-0.5">Left</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            onSelectBranch(b.warehouse, b.qty, b.price);
                                            onClose();
                                        }}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md shadow-slate-100"
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 text-center flex flex-col items-center gap-3">
                            <XCircle className="text-slate-200" size={32} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Out of stock globally</p>
                        </div>
                    )}
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-[9px] leading-relaxed text-slate-400 font-bold uppercase tracking-tighter text-center">
                        Select a branch to initiate transfer request
                    </p>
                </div>
            </div>
        </div>
    );
};

function InterBranchTransferDetails() {
  const { name } = useParams();
  const navigate = useNavigate();
  const isNew = !name;
  
  const { themeColor, themeColorHover, themeLight } = useLegacyTheme();
  const currentWarehouse = useSelector((state) => state.user.warehouse);
  
  const [doc, setDoc] = useState({
    set_from_warehouse: '',
    set_warehouse: currentWarehouse || '',
    items: isNew ? [{ item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0 }] : [],
    status: 'Draft'
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [decisionLoading, setDecisionLoading] = useState(null);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  const [sellingPrices, setSellingPrices] = useState({});
  const [updatingPrices, setUpdatingPrices] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    if (!isNew) {
      fetchRequest();
    }
  }, [name]);

  // Sync selling prices from doc when it arrives
  useEffect(() => {
    if (doc.status === 'Transferred' && doc.items) {
        const prices = {};
        doc.items.forEach(it => {
            prices[it.item_code] = it.rate || 0;
        });
        setSellingPrices(prices);
    }
  }, [doc]);

  const getSession = () => localStorage.getItem('session') || '';

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get('/api/method/frappe.desk.search.search_link', {
        params: { doctype: 'Warehouse', txt: '', filters: JSON.stringify({ is_group: 0, disabled: 0 }) },
        withCredentials: true, headers: { 'X-Frappe-SID': getSession() }
      });
      setWarehouses(res.data?.results || []);
    } catch (err) { console.error(err); }
  };

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_inter_branch_requests`, {
        params: { search: name },
        withCredentials: true, headers: { 'X-Frappe-SID': getSession() }
      });
      const data = res.data?.message;
      if (data) {
          setDoc(data.data || (Array.isArray(data) ? data[0] : data));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAddItemRow = () => {
    setDoc(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0 }]
    }));
  };

  const handleRemoveItemRow = (idx) => {
    if (doc.items.length === 1) return;
    const newItems = [...doc.items];
    newItems.splice(idx, 1);
    setDoc(prev => ({ ...prev, items: newItems }));
  };

  const handleItemSelect = (it, idx) => {
    const newItems = [...doc.items];
    newItems[idx] = {
      ...newItems[idx],
      item_code: it.name,
      item_name: it.item_name || it.name,
      uom: it.stock_uom || 'Nos',
      source_stock: 0
    };
    setDoc(prev => ({ ...prev, items: newItems }));
    // Automatically open modal to find source
    setActiveItemIndex(idx);
    setModalOpen(true);
  };

  const handleBranchSelectFromModal = (wh, stock, price) => {
    const newItems = [...doc.items];
    if (activeItemIndex !== null) {
        newItems[activeItemIndex].source_stock = stock;
        // Auto-fill price if it's currently 0 or empty
        if (price && (!newItems[activeItemIndex].rate || newItems[activeItemIndex].rate === 0)) {
            newItems[activeItemIndex].rate = price;
        }
    }
    setDoc(prev => ({ 
        ...prev, 
        set_from_warehouse: wh, 
        items: newItems 
    }));
  };

  const handleQtyChange = (val, idx) => {
    const newItems = [...doc.items];
    newItems[idx].qty = parseFloat(val) || 0;
    setDoc(prev => ({ ...prev, items: newItems }));
  };

  const handleSourceWarehouseChange = async (val) => {
    setDoc(prev => ({ ...prev, set_from_warehouse: val }));
    
    // Refresh stock for all items
    if (val) {
        const updatedItems = await Promise.all(doc.items.map(async (item) => {
            if (!item.item_code) return item;
            try {
                const r = await axios.get(`${API_PATH}.get_retail_item_details`, { 
                    params: { searchTerm: item.item_code, warehouse: val } 
                });
                const details = r.data?.message?.[0];
                const whDetail = details?.warehouse_details?.find(w => w.warehouse === val);
                return { ...item, source_stock: whDetail?.actual_qty || 0 };
            } catch (e) { return item; }
        }));
        setDoc(prev => ({ ...prev, items: updatedItems }));
    }
  };

  const handleUpdateSellingPrices = async () => {
    try {
        setUpdatingPrices(true);
        const itemsToUpdate = Object.keys(sellingPrices).map(code => ({
            item_code: code,
            selling_price: sellingPrices[code]
        }));

        const res = await axios.post(`${API_PATH}.update_ibt_prices`, {
            items: JSON.stringify(itemsToUpdate),
            warehouse: doc.set_warehouse
        }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

        if (res.data?.message?.status === 'success') {
            Swal.fire('Prices Updated', res.data.message.message, 'success');
        } else {
            Swal.fire('Error', res.data?.message?.message || "Price update failed", 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Error', "Failed to update price list", 'error');
    } finally {
        setUpdatingPrices(false);
    }
  };

  const handleSaveRequest = async () => {
    const validItems = doc.items.filter(i => i.item_code && i.qty > 0);
    if (!doc.set_from_warehouse || validItems.length === 0) {
        Swal.fire('Required', "Source branch and at least one item with quantity are required.", 'warning');
        return;
    }

    // Mandatory Price Check
    const missingPrice = validItems.find(it => !it.rate || it.rate <= 0);
    if (missingPrice) {
        Swal.fire('Price Required', `Please enter a valid price for ${missingPrice.item_code}`, 'warning');
        return;
    }
    
    try {
        setSaving(true);
        const res = await axios.post(`${API_PATH}.create_multi_item_material_request`, {
            items: JSON.stringify(validItems.map(it => ({
                item_code: it.item_code,
                qty: it.qty,
                rate: it.rate
            }))),
            from_warehouse: doc.set_from_warehouse,
            to_warehouse: doc.set_warehouse,
            reason: "Inter-Branch Stock Transfer Request"
        }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });
        
        if (res.data?.message?.status === 'success') {
            Swal.fire({
                title: 'REQUEST SENT',
                text: `Material Request ${res.data.message.name} has been submitted successfully to ${doc.set_from_warehouse}.`,
                icon: 'success',
                timer: 3000
            });
            navigate(`/interbranchrequest/${res.data.message.name}`);
        } else {
            Swal.fire('Failed', res.data?.message?.message || "Creation failed", 'error');
        }
    } catch (err) { 
        console.error(err);
        Swal.fire('Error', "Network error or Server failure", 'error'); 
    }
    finally { setSaving(false); }
  };

  const handleDecision = async (decision) => {
    const comment = decision === 'reject' ? prompt("Please enter rejection reason:", "Stock currently unavailable at source.") : null;
    if (decision === 'reject' && comment === null) return;

    try {
      setDecisionLoading(decision);
      const res = await axios.post(`${API_PATH}.handle_inter_branch_decision`, {
        request_name: name,
        decision: decision,
        comment: comment
      }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

      if (res.data?.message?.status === 'success') {
        alert(res.data.message.message);
        fetchRequest();
      } else {
        alert(res.data?.message?.message || 'Action failed');
      }
    } catch (err) { alert('Request failed'); }
    finally { setDecisionLoading(null); }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={40} /></div>;

  return (
    <div className="so-page bg-[#fbfcfd] min-h-screen font-sans text-slate-900">
      <BranchAvailabilityModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        itemCode={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_code : ''}
        itemName={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_name : ''}
        currentWarehouse={currentWarehouse}
        onSelectBranch={handleBranchSelectFromModal}
      />

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0,02)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/interbranchrequests')} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all text-slate-400">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800">
                {isNew ? 'New Stock Request' : name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${doc.status === 'Requested' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{doc.status || 'Draft'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {isNew ? (
              <button 
                onClick={handleSaveRequest} 
                disabled={saving}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 
                Submit Request
              </button>
            ) : (doc.status === 'Requested' || doc.status === 'Pending') ? (
              <div className="flex items-center gap-3">
                {doc.set_from_warehouse === currentWarehouse ? (
                  <>
                    <button 
                      onClick={() => handleDecision('reject')} 
                      disabled={decisionLoading} 
                      className="px-6 py-2.5 text-rose-600 font-bold text-xs uppercase tracking-widest hover:bg-rose-50 rounded-full transition-all flex items-center gap-2"
                    >
                       <XCircle size={14} /> Stop / Reject
                    </button>
                    <button 
                      onClick={() => handleDecision('accept')} 
                      disabled={decisionLoading} 
                      className="px-8 py-2.5 bg-emerald-600 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                       <CheckCircle2 size={14} /> Accept & Transfer
                    </button>
                  </>
                ) : (
                  <div className="px-6 py-2.5 bg-blue-50 text-blue-600 rounded-full font-bold text-[10px] uppercase tracking-widest border border-blue-100 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Awaiting Branch Approval
                  </div>
                )}
              </div>
            ) : doc.status === 'Stopped' ? (
              <div className="px-6 py-2.5 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] uppercase tracking-widest border border-rose-100 flex items-center gap-2">
                <XCircle size={14} /> Request Stopped
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-8">
        
        {/* Simplified Route Selector */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 w-full space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] block ml-1">Source Branch</label>
                {isNew ? (
                    <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={16} />
                        <select 
                            value={doc.set_from_warehouse} 
                            onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-slate-200 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Choose source branch...</option>
                            {warehouses.filter(w => w.value !== currentWarehouse).map(w => (
                                <option key={w.value} value={w.value}>{w.value}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="px-5 py-3 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 border border-slate-100">{doc.set_from_warehouse}</div>
                )}
            </div>

            <div className="hidden md:flex flex-col items-center gap-1 opacity-20 mt-4">
                <div className="w-12 h-[2px] bg-slate-300" />
                <ArrowRight size={14} className="text-slate-400" />
            </div>

            <div className="flex-1 w-full space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] block ml-1">Destination Branch</label>
                <div className="px-5 py-3 bg-slate-50 rounded-2xl font-bold text-sm text-slate-700 border border-slate-100 flex items-center justify-between">
                    {doc.set_warehouse || doc.warehouse}
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">YOU</span>
                </div>
            </div>
        </div>

        {/* Neater Item Selection */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Package size={18} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Inventory Selection</span>
                </div>
                {isNew && (
                    <button onClick={handleAddItemRow} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:bg-white px-3 py-1.5 rounded-lg transition-all">
                        <Plus size={14} /> Add Row
                    </button>
                )}
            </div>
            
            <div className="p-4">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr>
                            <th className="px-6 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Details</th>
                            <th className="px-6 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-40">Quantity</th>
                            <th className="px-6 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest w-48">Source Stock</th>
                            {isNew && <th className="w-12"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {doc.items.map((item, idx) => (
                            <tr key={idx} className="group">
                                <td className="px-6 py-4 bg-slate-50/30 rounded-l-3xl border-y border-l border-slate-50 group-hover:bg-slate-50 transition-all">
                                    {isNew ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <CustomSearchDropdown 
                                                    placeholder="Search item..."
                                                    optionsLabel="item_name"
                                                    value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                    fetchData={async (q) => {
                                                        const r = await axios.get(`${API_PATH}.get_retail_item_details`, { 
                                                            params: { searchTerm: q },
                                                            headers: { 'X-Frappe-SID': getSession() }
                                                        });
                                                        return r.data?.message || [];
                                                    }}
                                                    onSelect={(it) => handleItemSelect(it, idx)}
                                                />
                                            </div>
                                            {item.item_code && (
                                                <button 
                                                    onClick={() => { setActiveItemIndex(idx); setModalOpen(true); }}
                                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-blue-500 hover:text-white hover:bg-blue-500 transition-all shadow-sm"
                                                >
                                                    <Search size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 py-1">
                                            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-100 text-slate-300">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-700 text-sm">{item.item_name}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.item_code}</div>
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 bg-slate-50/30 border-y border-slate-50 group-hover:bg-slate-50 transition-all">
                                    {isNew ? (
                                        <div className="flex justify-center">
                                            <div className="relative w-28 group/q">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-100 rounded-2xl font-bold text-center text-sm outline-none focus:border-blue-500 transition-all"
                                                    value={item.qty === 0 ? '' : item.qty}
                                                    placeholder="0"
                                                    onChange={(e) => handleQtyChange(e.target.value, idx)}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 uppercase opacity-0 group-focus-within/q:opacity-100 transition-opacity">{item.uom || 'Nos'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center font-bold text-slate-700 text-sm">
                                            {item.qty} <span className="text-[10px] text-slate-400 ml-1">{item.uom}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 bg-slate-50/30 border-y border-slate-50 group-hover:bg-slate-50 transition-all">
                                    {isNew ? (
                                        <div className="flex justify-center">
                                            <div className="relative w-32 group/p">
                                                <input 
                                                    type="number" 
                                                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-100 rounded-2xl font-bold text-center text-sm outline-none focus:border-blue-500 transition-all"
                                                    value={item.rate === 0 ? '' : item.rate}
                                                    placeholder="0.00"
                                                    onChange={(e) => {
                                                        const ni = [...doc.items];
                                                        ni[idx].rate = parseFloat(e.target.value) || 0;
                                                        setDoc(prev => ({...prev, items: ni}));
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 uppercase opacity-0 group-focus-within/p:opacity-100 transition-opacity">Price/Unit</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center font-bold text-slate-700 text-sm">
                                            {item.rate || 0}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 bg-slate-50/30 rounded-r-3xl border-y border-r border-slate-50 group-hover:bg-slate-50 transition-all">
                                    <div className="flex flex-col items-end">
                                        <div className={`flex items-center gap-1.5 font-bold text-sm ${item.source_stock >= item.qty ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {item.source_stock || 0}
                                            <div className={`w-1.5 h-1.5 rounded-full ${item.source_stock >= item.qty ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-0.5">at {doc.set_from_warehouse || 'Source'}</span>
                                    </div>
                                </td>
                                {isNew && (
                                    <td className="px-4">
                                        <button onClick={() => handleRemoveItemRow(idx)} className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isNew && (
                <div className="p-8 border-t border-slate-50 flex items-center justify-center bg-slate-50/20">
                    <button 
                        onClick={handleAddItemRow}
                        className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm"
                    >
                        <Plus size={14} className="inline mr-2" /> Add Product
                    </button>
                </div>
            )}
        </div>

        {doc.status === 'Transferred' && doc.set_warehouse === currentWarehouse && (
            <div className="bg-white p-8 rounded-3xl border border-blue-100 shadow-xl shadow-blue-50/50 space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-xl text-white">
                            <Save size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Set Your Branch Selling Price</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update your local price list for these items</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleUpdateSellingPrices}
                        disabled={updatingPrices}
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                        {updatingPrices ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Update Price List
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {doc.items.map((item, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-700 truncate">{item.item_name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{item.item_code}</p>
                                </div>
                            </div>
                            <div className="relative group/sp">
                                <input 
                                    type="number"
                                    className="w-full pl-4 pr-12 py-3 bg-white border-2 border-slate-200 rounded-xl font-black text-sm outline-none focus:border-blue-500 transition-all"
                                    value={sellingPrices[item.item_code] || ''}
                                    onChange={(e) => setSellingPrices(prev => ({...prev, [item.item_code]: parseFloat(e.target.value) || 0}))}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">AED</span>
                                <label className="absolute -top-2 left-3 px-2 bg-white text-[8px] font-black text-blue-500 uppercase tracking-widest">Branch Selling Price</label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Status Help */}
        {doc.status === 'Transferred' ? (
            <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100 flex gap-5 animate-fadeIn">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Transfer Complete</p>
                    <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                        Stock has been successfully moved to your warehouse. Local inventory levels have been updated.
                    </p>
                </div>
            </div>
        ) : !isNew && (
            <div className="p-8 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex gap-5">
                <Info size={24} className="text-blue-400 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Request Processing</p>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        This is an internal stock transfer request. The source warehouse must approve this document to generate the final delivery note.
                    </p>
                </div>
            </div>
        )}

      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}

export default InterBranchTransferDetails;
