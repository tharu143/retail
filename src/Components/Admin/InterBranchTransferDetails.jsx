import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { 
  ArrowLeft, Save, CheckCircle2, XCircle, Package, Building2, 
  Search, Trash2, Loader2, AlertTriangle, ArrowRight, Info, Plus, Scan, MapPin, X, Copy, Edit3
} from 'lucide-react';
import { format } from 'date-fns';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import Swal from 'sweetalert2';
import '../Purchase/Purchase.css'; // Import standard PO/PI/PR styles
import DirhamIcon from '../../assets/Currency/DirhamIcon';

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
    items: isNew ? [{ item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0, rate: 0 }] : [],
    status: 'Draft',
    docstatus: 0
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
  const [isViewOnly, setIsViewOnly] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    if (!isNew) {
      fetchRequest();
    } else {
      setIsViewOnly(false);
    }
  }, [name]);

  // Sync currentWarehouse to set_warehouse when it loads asynchronously for new requests
  useEffect(() => {
    if (isNew && currentWarehouse && !doc.set_warehouse) {
      setDoc(prev => ({
        ...prev,
        set_warehouse: currentWarehouse
      }));
    }
  }, [currentWarehouse, isNew]);

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
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses', {
        headers: { 'X-Frappe-SID': getSession() },
        withCredentials: true
      });
      const list = res.data?.message || res.data || [];
      const results = list.map(w => ({
        value: w.name,
        label: w.warehouse_name || w.name
      }));
      setWarehouses(results);
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
      setWarehouses([]);
    }
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
          const loadedDoc = data.data || (Array.isArray(data) ? data[0] : data);
          setDoc(loadedDoc);
          setIsViewOnly(loadedDoc.docstatus > 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAddItemRow = () => {
    setDoc(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0, rate: 0 }]
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
      rate: it.last_buying_rate || it.valuation_rate || it.rate || 0,
      source_stock: 0
    };
    setDoc(prev => ({ ...prev, items: newItems }));
    setActiveItemIndex(idx);
    setModalOpen(true);
  };

  const handleBranchSelectFromModal = (wh, stock, price) => {
    const newItems = [...doc.items];
    if (activeItemIndex !== null) {
        newItems[activeItemIndex].source_stock = stock;
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
    
    if (val) {
        const updatedItems = await Promise.all(doc.items.map(async (item) => {
            if (!item.item_code) return item;
            try {
                const r = await axios.get(`${API_PATH}.get_retail_item_details`, { 
                    params: { searchTerm: item.item_code, warehouse: val },
                    headers: { 'X-Frappe-SID': getSession() },
                    withCredentials: true
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

  // ----- SAVE DRAFT (REST API wrapper) -----
  const handleSaveDraft = async () => {
    const validItems = doc.items.filter(i => i.item_code && i.qty > 0);
    if (!doc.set_from_warehouse || validItems.length === 0) {
        Swal.fire('Required', "Source branch and at least one item with quantity are required.", 'warning');
        return;
    }

    const missingPrice = validItems.find(it => !it.rate || it.rate <= 0);
    if (missingPrice) {
        Swal.fire('Price Required', `Please enter a valid price for ${missingPrice.item_name || missingPrice.item_code}`, 'warning');
        return;
    }

    try {
        setSaving(true);
        const sid = getSession();
        const headers = { 'Content-Type': 'application/json', 'X-Frappe-SID': sid };
        const companyName = doc.company || localStorage.getItem('company') || 'Kyle Solutions Pvt Ltd';
        
        const payload = {
            material_request_type: "Material Transfer",
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            company: companyName,
            set_from_warehouse: doc.set_from_warehouse,
            set_warehouse: doc.set_warehouse,
            items: validItems.map(it => ({
                item_code: it.item_code,
                qty: it.qty,
                rate: it.rate,
                uom: it.uom || 'Nos',
                warehouse: doc.set_warehouse,
                from_warehouse: doc.set_from_warehouse,
                schedule_date: format(new Date(), 'yyyy-MM-dd')
            })),
            description: `Inter-Branch Request from ${doc.set_warehouse} to ${doc.set_from_warehouse}`
        };

        let res;
        if (isNew) {
            res = await axios.post(`/api/resource/Material Request`, payload, {
                headers,
                withCredentials: true
            });
        } else {
            res = await axios.put(`/api/resource/Material Request/${name}`, payload, {
                headers,
                withCredentials: true
            });
        }

        const dataName = res.data?.data?.name || res.data?.name;
        if (dataName) {
            Swal.fire({
                title: 'Saved Draft!',
                text: `Material Request draft ${dataName} has been saved successfully.`,
                icon: 'success',
                timer: 2000
            });
            if (isNew) {
                navigate(`/interbranchrequest/${dataName}`);
            } else {
                fetchRequest();
                setIsViewOnly(true);
            }
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Failed', err.response?.data?.message || err.message || "Save failed", 'error');
    } finally {
        setSaving(false);
    }
  };

  // ----- SUBMIT DRAFT REQUEST -----
  const handleSubmitRequest = async () => {
    const result = await Swal.fire({
      title: 'Submit Request?',
      text: "Submit this stock transfer request to the source branch? Once submitted, it cannot be modified.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Submit'
    });

    if (!result.isConfirmed) return;

    try {
        setSaving(true);
        const sid = getSession();
        const headers = { 'Content-Type': 'application/json', 'X-Frappe-SID': sid };
        
        const validItems = doc.items.filter(i => i.item_code && i.qty > 0);
        const companyName = doc.company || localStorage.getItem('company') || 'Kyle Solutions Pvt Ltd';
        const payload = {
            material_request_type: "Material Transfer",
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            company: companyName,
            set_from_warehouse: doc.set_from_warehouse,
            set_warehouse: doc.set_warehouse,
            items: validItems.map(it => ({
                item_code: it.item_code,
                qty: it.qty,
                rate: it.rate,
                uom: it.uom || 'Nos',
                warehouse: doc.set_warehouse,
                from_warehouse: doc.set_from_warehouse,
                schedule_date: format(new Date(), 'yyyy-MM-dd')
            })),
            docstatus: 1 // SUBMIT DOC
        };

        const res = await axios.put(`/api/resource/Material Request/${name}`, payload, {
            headers,
            withCredentials: true
        });

        const dataName = res.data?.data?.name || res.data?.name;
        if (dataName) {
            Swal.fire('Submitted!', `Material Request ${dataName} has been submitted successfully to ${doc.set_from_warehouse}.`, 'success');
            fetchRequest();
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Failed', err.response?.data?.message || err.message || "Submit failed", 'error');
    } finally {
        setSaving(false);
    }
  };

  // ----- DELETE DRAFT REQUEST -----
  const handleDeleteRequest = async () => {
    const result = await Swal.fire({
      title: 'Delete Draft?',
      text: "Are you sure you want to permanently delete this Draft stock request?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete'
    });

    if (!result.isConfirmed) return;

    try {
        setSaving(true);
        const sid = getSession();
        const headers = { 'X-Frappe-SID': sid };
        
        await axios.delete(`/api/resource/Material Request/${name}`, {
            headers,
            withCredentials: true
        });

        Swal.fire('Deleted!', `Material Request ${name} has been deleted successfully.`, 'success');
        navigate('/interbranchrequests');
    } catch (err) {
        console.error(err);
        Swal.fire('Failed', err.response?.data?.message || err.message || "Delete failed", 'error');
    } finally {
        setSaving(false);
    }
  };

  // ----- DUPLICATE REQUEST -----
  const handleDuplicate = () => {
    const clonedItems = (doc.items || []).map(({ name, parent, parenttype, parentfield, creation, modified, ...rest }) => ({
        ...rest,
        source_stock: 0
    }));

    setDoc({
        set_from_warehouse: doc.set_from_warehouse,
        set_warehouse: currentWarehouse,
        items: clonedItems,
        status: 'Draft',
        docstatus: 0
    });

    navigate('/newinterbranchrequest');
    setIsViewOnly(false);
    Swal.fire({
        icon: 'success',
        title: 'Duplicated!',
        text: 'You are now editing a new Draft copy of this request.',
        timer: 2000
    });
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
        Swal.fire('Action Complete', res.data.message.message, 'success');
        fetchRequest();
      } else {
        Swal.fire('Action Failed', res.data?.message?.message || 'Action failed', 'error');
      }
    } catch (err) { Swal.fire('Error', 'Request failed', 'error'); }
    finally { setDecisionLoading(null); }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={40} /></div>;

  return (
    <div className="purchase-container po-layout-container text-slate-900 bg-[#f8fafc] min-h-screen">
      <BranchAvailabilityModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        itemCode={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_code : ''}
        itemName={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_name : ''}
        currentWarehouse={currentWarehouse}
        onSelectBranch={handleBranchSelectFromModal}
      />

      {/* Header Bar */}
      <div className="po-header-container bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/interbranchrequests')} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-800">
                {isNew ? 'New Inter-Branch Request' : `Inter-Branch Request: ${name}`}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                      doc.status === 'Requested' ? 'bg-blue-500' : 
                      doc.status === 'Transferred' ? 'bg-emerald-500' :
                      doc.status === 'Stopped' ? 'bg-rose-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{doc.status || 'Draft'}</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC ACTIONS TOOLBAR */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* 1. DUPLICATE BUTTON */}
            {!isNew && (
              <button 
                onClick={handleDuplicate}
                className="po-btn-secondary flex items-center gap-1.5"
                style={{ height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
              >
                <Copy size={13} /> Duplicate
              </button>
            )}

            {/* 2. DELETE DRAFT BUTTON */}
            {!isNew && doc.docstatus === 0 && (
              <button 
                onClick={handleDeleteRequest}
                disabled={saving}
                className="po-btn-secondary border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
                style={{ height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
              >
                <Trash2 size={13} /> Delete Draft
              </button>
            )}

            {/* 3. EDIT DRAFT BUTTON */}
            {!isNew && doc.docstatus === 0 && isViewOnly && (
              <button 
                onClick={() => setIsViewOnly(false)}
                className="po-btn-secondary flex items-center gap-1.5"
                style={{ height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
              >
                <Edit3 size={13} /> Edit Request
              </button>
            )}

            {/* 4. DRAFT PRIMARY CONTROLS (Save & Submit) */}
            {(!isNew && doc.docstatus === 0 && !isViewOnly) || isNew ? (
              <>
                <button 
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="po-btn-secondary flex items-center gap-1.5"
                  style={{ height: '2.25rem', padding: '0 1.25rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} 
                  {isNew ? 'Save Draft' : 'Save Changes'}
                </button>
                
                {!isNew && (
                  <button 
                    onClick={handleSubmitRequest}
                    disabled={saving}
                    className="po-btn-primary flex items-center gap-1.5"
                    style={{ height: '2.25rem', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', background: themeColor, borderColor: themeColor, borderRadius: '0.5rem' }}
                  >
                    <CheckCircle2 size={13} /> Submit Request
                  </button>
                )}
              </>
            ) : null}

            {/* 5. DECISION CONTROLS (For Submitted requests) */}
            {!isNew && doc.docstatus === 1 && (doc.status === 'Requested' || doc.status === 'Pending') ? (
              <div className="flex items-center gap-3">
                {doc.set_from_warehouse === currentWarehouse ? (
                  <>
                    <button 
                      onClick={() => handleDecision('reject')} 
                      disabled={decisionLoading} 
                      className="po-btn-secondary border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
                      style={{ height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
                    >
                       <XCircle size={13} /> Stop / Reject
                    </button>
                    <button 
                      onClick={() => handleDecision('accept')} 
                      disabled={decisionLoading} 
                      className="po-btn-primary flex items-center gap-1.5"
                      style={{ height: '2.25rem', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', background: '#10b981', borderColor: '#10b981', borderRadius: '0.5rem' }}
                    >
                       <CheckCircle2 size={13} /> Accept & Transfer
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-blue-100 flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Awaiting Branch Approval
                  </div>
                )}
              </div>
            ) : null}

            {/* 6. COMPLETED/CANCELLED INDICATORS */}
            {!isNew && doc.status === 'Stopped' && (
              <div className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-red-100 flex items-center gap-1.5">
                <XCircle size={13} /> Request Stopped
              </div>
            )}
            {!isNew && doc.status === 'Transferred' && (
              <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Transfer Complete
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto space-y-6 mt-6">
        
        {/* Route Selector Card - Redesigned to po-card */}
        <div className="po-card animate-fadeIn">
          <div className="po-card-header">
            <h3 className="po-card-title flex items-center gap-2">
              <Building2 size={14} style={{ color: themeColor }} />
              STOCK ROUTING BRANCHES
            </h3>
          </div>
          <div className="po-card-body grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="po-label">Source Branch</label>
                {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                    <div className="relative group">
                        <select 
                            value={doc.set_from_warehouse} 
                            onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                            className="summary-select po-input"
                        >
                            <option value="">Choose source branch...</option>
                            {warehouses.filter(w => w.value !== currentWarehouse).map(w => (
                                <option key={w.value} value={w.value}>{w.label || w.value}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="premium-cell-readonly font-bold flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      {doc.set_from_warehouse}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="po-label">Destination Branch</label>
                <div className="premium-cell-readonly font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      {doc.set_warehouse || doc.warehouse}
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Requesting Branch (YOU)</span>
                </div>
            </div>
          </div>
        </div>

        {/* Item Selection Card - Redesigned to po-card with purchase-table */}
        <div className="po-card animate-fadeIn">
            <div className="po-card-header flex items-center justify-between">
                <h3 className="po-card-title flex items-center gap-2">
                  <Package size={14} style={{ color: themeColor }} />
                  PRODUCT ITEM SELECTION
                </h3>
                {(isNew || (doc.docstatus === 0 && !isViewOnly)) && (
                    <button 
                      onClick={handleAddItemRow} 
                      className="po-btn-secondary flex items-center gap-1"
                      style={{ height: '1.75rem', fontSize: '0.65rem', padding: '0 0.75rem', borderRadius: '0.375rem' }}
                    >
                        <Plus size={12} /> Add Row
                    </button>
                )}
            </div>
            
            <div className="purchase-table-container">
                <table className="purchase-table">
                    <thead>
                        <tr>
                            <th className="purchase-th" style={{ padding: '0.75rem 1.5rem' }}>Product Details</th>
                            <th className="purchase-th text-center" style={{ width: '140px' }}>Quantity</th>
                            <th className="purchase-th text-right" style={{ width: '180px' }}>Request price / unit</th>
                            <th className="purchase-th text-right" style={{ width: '180px' }}>Source Stock</th>
                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) && <th className="purchase-th text-center" style={{ width: '60px' }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {doc.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                {/* column 1: product details */}
                                <td className="purchase-td" style={{ padding: '0.5rem 1.5rem' }}>
                                    <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
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
                                            ) : (
                                                <div className="premium-cell-readonly font-bold">{item.item_name}</div>
                                            )}
                                        </div>
                                        {item.item_code && <span className="premium-subtext">{item.item_code}</span>}
                                    </div>
                                </td>
                                
                                {/* column 2: quantity */}
                                <td className="purchase-td text-center">
                                    <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                                                <input 
                                                    type="number" 
                                                    className="po-input text-center font-bold"
                                                    value={item.qty === 0 ? '' : item.qty}
                                                    placeholder="0"
                                                    onChange={(e) => handleQtyChange(e.target.value, idx)}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            ) : (
                                                <div className="premium-cell-readonly premium-cell-readonly-center font-bold">{item.qty}</div>
                                            )}
                                        </div>
                                        <span className="premium-subtext">{item.uom || 'Nos'}</span>
                                    </div>
                                </td>
                                
                                {/* column 3: rate / price */}
                                <td className="purchase-td text-right">
                                    <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                                                <input 
                                                    type="number" 
                                                    className="po-input text-right font-bold"
                                                    value={item.rate === 0 ? '' : item.rate}
                                                    placeholder="0.00"
                                                    onChange={(e) => {
                                                        const ni = [...doc.items];
                                                        ni[idx].rate = parseFloat(e.target.value) || 0;
                                                        setDoc(prev => ({...prev, items: ni}));
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            ) : (
                                                <div className="premium-cell-readonly premium-cell-readonly-right font-bold flex items-center justify-end gap-1"><DirhamIcon size={12} /> {parseFloat(item.rate || 0).toFixed(2)}</div>
                                            )}
                                        </div>
                                        <span className="premium-subtext flex items-center gap-1"><DirhamIcon size={8} /> per Unit</span>
                                    </div>
                                </td>
                                
                                {/* column 4: source stock */}
                                <td className="purchase-td text-right">
                                    <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                            <div className={`premium-cell-readonly premium-cell-readonly-right font-bold ${item.source_stock >= item.qty ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {item.source_stock || 0}
                                            </div>
                                        </div>
                                        <span className="premium-subtext">at {doc.set_from_warehouse?.replace(' - KSPL', '') || 'Source'}</span>
                                    </div>
                                </td>
                                
                                {/* column 5: delete action row */}
                                {(isNew || (doc.docstatus === 0 && !isViewOnly)) && (
                                    <td className="purchase-td text-center" style={{ verticalAlign: 'middle' }}>
                                        <button 
                                          onClick={() => handleRemoveItemRow(idx)} 
                                          className="text-slate-300 hover:text-rose-500 transition-all"
                                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(isNew || (doc.docstatus === 0 && !isViewOnly)) && (
                <div className="p-6 border-t border-slate-100 flex items-center justify-center bg-slate-50/20">
                    <button 
                        onClick={handleAddItemRow}
                        className="po-btn-secondary flex items-center gap-1.5"
                        style={{ height: '2.25rem', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', borderRadius: '0.5rem' }}
                    >
                        <Plus size={14} /> Add Product Row
                    </button>
                </div>
            )}
        </div>

        {/* Set Local Price lists for Transferred Items */}
        {doc.status === 'Transferred' && doc.set_warehouse === currentWarehouse && (
            <div className="po-card shadow-xl shadow-blue-50/50 space-y-6 animate-fadeIn" style={{ border: '1px solid #bfdbfe' }}>
                <div className="po-card-header bg-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-xl text-white">
                            <Save size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Set Your Local Selling Price</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Update local price list to start selling</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleUpdateSellingPrices}
                        disabled={updatingPrices}
                        className="po-btn-primary flex items-center gap-2"
                        style={{ height: '2.25rem', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', background: '#2563eb', borderColor: '#2563eb', borderRadius: '0.5rem' }}
                    >
                        {updatingPrices ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Update Price List
                    </button>
                </div>

                <div className="po-card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase flex items-center gap-1"><DirhamIcon size={10} /> AED</span>
                                <label className="absolute -top-2 left-3 px-2 bg-white text-[8px] font-black text-blue-500 uppercase tracking-widest">Branch Selling Price</label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Status Guide Footer */}
        {doc.status === 'Transferred' ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4 animate-fadeIn">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Transfer Complete</p>
                    <p className="text-xs text-emerald-700 leading-relaxed font-semibold">
                        Material transfer stock entry has been successfully submitted. Local branch levels are synchronized.
                    </p>
                </div>
            </div>
        ) : !isNew && (
            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-4">
                <Info size={20} className="text-blue-400 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-950 uppercase tracking-wide">Request Processing</p>
                    <p className="text-xs text-blue-700 leading-relaxed font-semibold">
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
