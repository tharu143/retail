import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShoppingCart, Package, MapPin, Phone, Mail, ChevronLeft, Loader2, 
  AlertCircle, Globe, Tag, Receipt, Layers, CreditCard, 
  ArrowRight, Settings, Edit2, Save, X, CheckCircle2, Clock,
  Plus, Search, ScanLine, Trash2, Calendar, User, FileText, Info
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

/* ==================== CORE LOGIC ==================== */
function recalcForm(form) {
    const items = form.items || [];
    const taxes = form.taxes || [];
  
    const total_qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const base_total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  
    let total_taxes = 0;
    let prev_total = base_total;
  
    const updatedTaxes = taxes.map(tax => {
      const rate = parseFloat(tax.rate) || 0;
      let taxAmount = 0;
      if (tax.charge_type === 'Actual') {
        taxAmount = parseFloat(tax.tax_amount) || 0;
      } else if (tax.charge_type === 'On Previous Row Amount') {
        taxAmount = prev_total * (rate / 100);
      } else {
        taxAmount = base_total * (rate / 100);
      }
      const signed = tax.add_deduct_tax === 'Add' ? taxAmount : -taxAmount;
      total_taxes += signed;
      prev_total += signed;
      return {
        ...tax,
        tax_amount: tax.charge_type === 'Actual' ? parseFloat(tax.tax_amount || 0) : parseFloat(taxAmount.toFixed(3)),
        total: signed.toFixed(3),
      };
    });
  
    const net = base_total + total_taxes;
    const disc_perc = parseFloat(form.additional_discount_percentage) || 0;
    const disc_amt = parseFloat(form.discount_amount) || 0;
    const discount = form.apply_discount_on === 'Grand Total'
      ? (net * disc_perc / 100) + disc_amt
      : (base_total * disc_perc / 100) + disc_amt;
  
    const grand_total = net - discount;
    const rounded_total = Math.round(grand_total * 100) / 100;
  
    return {
      ...form,
      total_qty,
      base_total,
      total: base_total,
      total_taxes_and_charges: parseFloat(total_taxes.toFixed(2)),
      grand_total: parseFloat(grand_total.toFixed(2)),
      rounded_total: parseFloat(rounded_total.toFixed(2)),
      rounding_adjustment: parseFloat((rounded_total - grand_total).toFixed(2)),
      taxes: updatedTaxes,
    };
}

const emptyForm = () => ({
    naming_series: 'SAL-ORD-.YYYY.-',
    transaction_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    customer: '',
    customer_name: '',
    order_type: 'Sales',
    currency: 'AED',
    selling_price_list: 'Standard Selling',
    price_list_currency: 'AED',
    items: [],
    taxes_and_charges: '',
    taxes: [],
    apply_discount_on: 'Grand Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    total_qty: 0,
    base_total: 0,
    total: 0,
    total_taxes_and_charges: 0,
    grand_total: 0,
    rounding_adjustment: 0,
    rounded_total: 0,
    docstatus: 0
});

/* ==================== UI COMPONENTS ==================== */
const StatCard = ({ label, value, currency, icon: Icon, color }) => (
  <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-2">
        {currency && <span className="text-sm font-bold text-gray-400">{currency}</span>}
        <h4 className="text-2xl font-black text-gray-900 leading-none" style={{ color: color || '#111827' }}>
          {value}
        </h4>
      </div>
    </div>
    <div className="p-4 rounded-xl transition-colors" style={{ backgroundColor: `${color}10` || '#f8fafc' }}>
      <Icon size={24} style={{ color: color || '#94a3b8' }} />
    </div>
  </div>
);

const ConnectionCard = ({ title, links, onTransistion, loadingLinks }) => (
    <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/30">
        <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{title}</h5>
      </div>
      <div className="p-4 flex-1">
        <div className="space-y-2">
          {links && links.map((link, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">{link}</span>
              </div>
              <ArrowRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          ))}
          {(!links || links.length === 0) && (
            <div className="py-10 text-center flex flex-col items-center gap-3">
               <AlertCircle size={32} className="text-gray-100" />
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Active Connections</p>
               <button 
                onClick={onTransistion} 
                disabled={loadingLinks}
                className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:-translate-y-0.5 transition-all disabled:opacity-50"
               >
                 {loadingLinks ? 'Syncing...' : `Generate ${title.split(' ')[0]}`}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
);

export default function SalesOrderDetails() {
    const { name } = useParams();
    const navigate = useNavigate();
    const isNew = name === 'create';
    
    // States
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(isNew);
    const [activeTab, setActiveTab] = useState('Overview');
    const [form, setForm] = useState(emptyForm());
    const [linkedDocs, setLinkedDocs] = useState({});
    const [loadingLinks, setLoadingLinks] = useState(false);
    
    // Dropdowns
    const [customers, setCustomers] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [itemSearches, setItemSearches] = useState({});
    const [showItemDropdowns, setShowItemDropdowns] = useState({});

    // Fetch Initial Data
    useEffect(() => {
        fetchMetadata();
        if (!isNew) {
            fetchOrder();
            fetchLinkedDocs();
        }
    }, [name]);

    const fetchMetadata = async () => {
        try {
            const [custRes, taxRes] = await Promise.all([
                axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list_so', { withCredentials: true }),
                axios.get('/api/method/kyle_retail.retail_api.api.get_sales_taxes_templates_so', { withCredentials: true })
            ]);
            setCustomers(custRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
        } catch (err) { console.error(err); }
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/resource/Sales Order/${name}`, { withCredentials: true });
            const d = res.data.data;
            setForm({
                ...d,
                items: d.items || [],
                taxes: d.taxes || []
            });
            setSearchCustomer(d.customer_name || d.customer);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Load Failed', text: 'Could not retrieve Sales Order' });
        } finally {
            setLoading(false);
        }
    };

    const fetchLinkedDocs = async () => {
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', {
                params: { doctype: 'Sales Order', name },
                withCredentials: true
            });
            setLinkedDocs(res.data.message || {});
        } catch (err) { console.error(err); }
    };

    const handleSave = async (submit = false) => {
        if (!form.customer) return Swal.fire('Error', 'Customer is required', 'warning');
        if (!form.items.length) return Swal.fire('Error', 'Add at least one item', 'warning');

        try {
            setSaving(true);
            const payload = {
                ...form,
                docstatus: submit ? 1 : 0,
                delivery_date: form.delivery_date || form.transaction_date,
                items: form.items.filter(i => i.item_code).map(i => ({
                    ...i,
                    delivery_date: i.delivery_date || form.delivery_date || form.transaction_date
                }))
            };

            let res;
            if (isNew) {
                res = await axios.post('/api/resource/Sales Order', payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Order Created', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                navigate(`/salesorder-details/${res.data.data.name}`);
            } else {
                await axios.put(`/api/resource/Sales Order/${name}`, payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Order Synchronized', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                setIsEditing(false);
                fetchOrder();
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Action Failed', text: err.response?.data?._server_messages || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTransistion = async (type) => {
        try {
            setLoadingLinks(true);
            const endpoint = type === 'Delivery Note' ? 'create_delivery_note_from_so' : 'create_sales_invoice_from_so';
            const res = await axios.post(`/api/method/kyle_retail.retail_api.api.${endpoint}`, {
                so_name: name,
                submit_doc: true
            }, { withCredentials: true });

            if (res.data.message?.status === 'success') {
                Swal.fire({ icon: 'success', title: `${type} Created`, text: res.data.message.name });
                fetchLinkedDocs();
            } else {
                throw new Error(res.data.message?.message || 'Transition failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Transition Failed', text: err.message });
        } finally {
            setLoadingLinks(false);
        }
    };

    // Item Management
    const addItemRow = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos' }]
        }));
    };

    const removeItemRow = (idx) => {
        setForm(prev => recalcForm({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
    };

    const searchItems = async (query, idx) => {
        if (!query.trim()) {
            setItemsList([]);
            setShowItemDropdowns(p => ({ ...p, [idx]: false }));
            return;
        }
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_items_so', { params: { query }, withCredentials: true });
            setItemsList(res.data.message || []);
            setShowItemDropdowns(p => ({ ...p, [idx]: true }));
        } catch { setItemsList([]); }
    };

    const selectItem = async (idx, item) => {
        try {
            const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
                params: { item_code: item.item_code, price_list: form.selling_price_list },
                withCredentials: true
            });
            const rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || 0;

            setForm(prev => {
                const items = [...prev.items];
                items[idx] = {
                    item_code: item.item_code,
                    item_name: item.item_name,
                    uom: item.stock_uom || 'Nos',
                    qty: 1,
                    rate,
                    amount: rate
                };
                return recalcForm({ ...prev, items });
            });
        } catch (err) { console.error(err); }
        setShowItemDropdowns(p => ({ ...p, [idx]: false }));
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-gray-50">
            <Loader2 size={40} className="animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Order Artifacts...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-24">
            
            {/* 1. Dynamic Header */}
            <div className="bg-white border-b border-gray-100 px-6 lg:px-12 py-6 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <button onClick={() => navigate('/salesorderlist')} className="px-4 py-2.5 bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-colors shadow-sm flex items-center gap-2">
                            <ChevronLeft size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    {isNew ? 'Generate Sales Order' : (isEditing ? 'Modify Active Order' : name)}
                                </h1>
                                {!isEditing && (
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${form.docstatus === 1 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                        {form.docstatus === 1 ? 'Submitted' : 'Draft'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-0.5">
                                {isNew ? 'New Orchestration' : `Customer: ${form.customer_name || 'Individual Partner'}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isEditing ? (
                            <>
                                <button onClick={() => isNew ? navigate('/salesorderlist') : setIsEditing(false)} className="px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Discard Changes</button>
                                <button onClick={() => handleSave(false)} disabled={saving} className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-3 disabled:opacity-50 hover:-translate-y-0.5 transition-all">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Artifact
                                </button>
                                {!isNew && form.docstatus === 0 && (
                                    <button onClick={() => handleSave(true)} disabled={saving} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center gap-3 disabled:opacity-50 hover:-translate-y-0.5 transition-all">
                                        <CheckCircle2 size={16} /> Finalize Order
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} className="px-8 py-3 bg-white border border-gray-100 text-gray-600 rounded-2xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm hover:border-gray-300 transition-all">
                                    <Edit2 size={14} /> Modify Detail
                                </button>
                                {form.docstatus === 1 && (
                                    <div className="h-10 w-px bg-gray-100 mx-2" />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 lg:px-12 mt-10">
                {isEditing ? (
                    /* EDITING / CREATION VIEW (Full View Form) */
                    <div className="space-y-10 animate-slideUp">
                        {/* Section 1: Partner & Timeline */}
                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-10">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                                <div className="w-2.5 h-8 bg-blue-600 rounded-full" /> Partner & Timeline
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                <div className="space-y-2 relative">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Target Customer Partner *</label>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                        <input 
                                            type="text" 
                                            value={searchCustomer} 
                                            onChange={(e) => {
                                                setSearchCustomer(e.target.value);
                                                setShowCustomerDropdown(true);
                                            }}
                                            placeholder="Lookup registered customer..."
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all shadow-inner"
                                        />
                                        {showCustomerDropdown && (
                                            <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-x-hidden p-2 animate-fadeIn">
                                                {customers.filter(c => c.customer_name.toLowerCase().includes(searchCustomer.toLowerCase())).map(c => (
                                                    <div key={c.name} onClick={() => {
                                                        setForm({ ...form, customer: c.name, customer_name: c.customer_name });
                                                        setSearchCustomer(c.customer_name);
                                                        setShowCustomerDropdown(false);
                                                    }} className="p-4 hover:bg-blue-50 rounded-xl cursor-pointer text-sm font-bold text-gray-700 transition-colors flex justify-between items-center group">
                                                        {c.customer_name}
                                                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-blue-600 transition-all" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Date of Issuance</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={16} />
                                        <input 
                                            type="date" 
                                            value={form.transaction_date} 
                                            onChange={e => setForm({...form, transaction_date: e.target.value})}
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Fulfillment Target</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={16} />
                                        <input 
                                            type="date" 
                                            value={form.delivery_date} 
                                            onChange={e => setForm({...form, delivery_date: e.target.value})}
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Items Orchestration */}
                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-8 overflow-visible">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                                    <div className="w-2.5 h-8 bg-indigo-600 rounded-full" /> Order Items
                                </h3>
                                <button onClick={addItemRow} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2">
                                    <Plus size={14} /> Add Line Item
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto overflow-y-visible">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-50">
                                            <th className="pb-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/3 pl-4">Product Catalog</th>
                                            <th className="pb-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quantity</th>
                                            <th className="pb-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Rate</th>
                                            <th className="pb-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Amount</th>
                                            <th className="pb-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {form.items.map((item, idx) => (
                                            <tr key={idx} className="group">
                                                <td className="py-6 pl-4 relative">
                                                    <div className="relative group/search">
                                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                                        <input 
                                                            type="text" 
                                                            value={item.item_code} 
                                                            autoFocus={!item.item_code}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const itms = [...form.items];
                                                                itms[idx].item_code = val;
                                                                setForm({...form, items: itms});
                                                                searchItems(val, idx);
                                                            }}
                                                            placeholder="SKU or Item Name..."
                                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-600/30 transition-all outline-none"
                                                        />
                                                        {showItemDropdowns[idx] && (
                                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto p-1.5 animate-fadeIn">
                                                                {itemsList.map(it => (
                                                                    <div key={it.item_code} onClick={() => selectItem(idx, it)} className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer text-xs font-bold text-gray-700 flex flex-col gap-0.5">
                                                                        <span>{it.item_name}</span>
                                                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{it.item_code}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4">
                                                    <input 
                                                        type="number" 
                                                        step="any"
                                                        value={item.qty} 
                                                        onChange={e => {
                                                            const itms = [...form.items];
                                                            itms[idx].qty = e.target.value;
                                                            itms[idx].amount = (parseFloat(e.target.value) || 0) * (parseFloat(itms[idx].rate) || 0);
                                                            setForm(recalcForm({...form, items: itms}));
                                                        }}
                                                        className="w-24 mx-auto text-center py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-black text-gray-900 outline-none focus:bg-white focus:border-blue-600/30"
                                                    />
                                                </td>
                                                <td className="py-6 px-4">
                                                    <input 
                                                        type="number" 
                                                        step="any"
                                                        value={item.rate} 
                                                        onChange={e => {
                                                            const itms = [...form.items];
                                                            itms[idx].rate = e.target.value;
                                                            itms[idx].amount = (parseFloat(itms[idx].qty) || 0) * (parseFloat(e.target.value) || 0);
                                                            setForm(recalcForm({...form, items: itms}));
                                                        }}
                                                        className="w-32 ml-auto text-right py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-black text-gray-900 outline-none focus:bg-white focus:border-blue-600/30"
                                                    />
                                                </td>
                                                <td className="py-6 px-4 text-right">
                                                    <div className="text-sm font-black text-gray-900 px-4">
                                                        {(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4 text-center">
                                                    <button onClick={() => removeItemRow(idx)} className="p-3 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totals & Net Pay */}
                        <div className="max-w-xl ml-auto bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
                             <div className="flex justify-between items-center pb-6 border-b border-gray-50">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Base Orchestration Amount</span>
                                <span className="text-lg font-black text-gray-900">AED {form.base_total.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-emerald-600">
                                <span className="text-[10px] font-bold uppercase tracking-widest">Applied Artifact Discount</span>
                                <span className="text-sm font-black">- AED {form.discount_amount.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center py-6 border-t border-gray-100">
                                <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Payable Net Value</span>
                                <span className="text-4xl font-black text-blue-600 tracking-tighter">AED {form.grand_total.toLocaleString()}</span>
                             </div>
                        </div>
                    </div>
                ) : (
                    /* VIEW MODE (Dashboard-Oriented Detail) */
                    <div className="space-y-10 animate-slideUp">
                        {/* Highlights Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <StatCard label="Total Artifact Value" value={form.grand_total.toLocaleString()} currency="AED" icon={CreditCard} color="#4f46e5" />
                            <StatCard label="Order Quantity" value={form.total_qty} icon={Package} color="#0891b2" />
                            <StatCard label="Lifecycle Progress" value={form.docstatus === 1 ? 'Authorized' : 'Pending Authorization'} icon={form.docstatus === 1 ? CheckCircle2 : Clock} color={form.docstatus === 1 ? '#10b981' : '#f59e0b'} />
                        </div>

                        {/* Connection Matrices */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <ConnectionCard title="Delivery Connections" links={linkedDocs.Delivery_Note} onTransistion={() => handleTransistion('Delivery Note')} loadingLinks={loadingLinks} />
                            <ConnectionCard title="Revenue Triggers" links={linkedDocs.Sales_Invoice} onTransistion={() => handleTransistion('Sales Invoice')} loadingLinks={loadingLinks} />
                            
                            {/* Summary Artifact */}
                            <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-8 flex flex-col justify-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Info size={24} /></div>
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 tracking-tight">Order Artifact</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Created {form.creation?.split(' ')[0]}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span>Items Count</span>
                                        <span className="text-gray-900">{form.items.length}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span>Currency</span>
                                        <span className="text-gray-900">{form.currency}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Presentation */}
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                            <div className="px-10 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Orchestration Itemized Bill</h3>
                            </div>
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product SKU / Desription</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty Authorized</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Authorized Rate</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {form.items.map((i, idx) => (
                                        <tr key={idx}>
                                            <td className="px-10 py-6">
                                                <div className="text-sm font-black text-gray-900">{i.item_code}</div>
                                                <div className="text-[11px] font-bold text-gray-400 uppercase mt-0.5">{i.item_name}</div>
                                            </td>
                                            <td className="px-10 py-6 text-center text-sm font-black text-gray-700">{i.qty}</td>
                                            <td className="px-10 py-6 text-right text-sm font-bold text-gray-700">AED {parseFloat(i.rate || 0).toLocaleString()}</td>
                                            <td className="px-10 py-6 text-right text-sm font-black text-gray-900">AED {parseFloat(i.amount || 0).toLocaleString()}</td>
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
