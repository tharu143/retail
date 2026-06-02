import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package, ArrowLeft, Calculator, Search, Trash2, Plus, Box, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './Purchase.css';

export default function PurchaseTools() {
  const navigate = useNavigate();
  const warehouse = useSelector((s) => s.user.warehouse);

  const [supplier, setSupplier] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState([{ 
    item_code: '', 
    item_name: '', 
    purchase_rate: 0, 
    selling_update_type: 'Amount', 
    markup_value: 0, 
    calculated_price: 0,
    custom_supplier_sl_no: '',
    custom_box_qty: 0,
    custom_pieces_per_box: 1,
    custom_box_price: 0,
    use_box_entry: false
  }]);

  useEffect(() => {
    if (supplier.trim().length < 2) { setSupplierResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await frappeCall({
          method: 'kyle_retail.retail_api.api.get_suppliers',
          args: { search: supplier.trim() },
          type: 'GET'
        });
        setSupplierResults(res || []);
        setShowSupplierDropdown(true);
      } catch { setSupplierResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [supplier]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await frappeCall({
          method: 'kyle_retail.retail_api.api.get_retail_item_details',
          args: { warehouse },
          type: 'GET'
        });
        setItems(res || []);
      } catch { }
    };
    fetchItems();
  }, [warehouse]);

  const updateRow = (index, field, value) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      let updated = { ...row, [field]: value };

      if (['custom_box_qty', 'custom_pieces_per_box', 'custom_box_price'].includes(field)) {
        const pPerB = parseFloat(updated.custom_pieces_per_box) || 1;
        const bPrice = parseFloat(updated.custom_box_price) || 0;
        updated.purchase_rate = pPerB > 0 ? parseFloat((bPrice / pPerB).toFixed(4)) : 0;
      }

      if (field === 'purchase_rate' || field === 'selling_update_type' || field === 'markup_value' || ['custom_box_qty', 'custom_pieces_per_box', 'custom_box_price'].includes(field)) {
        const rate = parseFloat(updated.purchase_rate) || 0;
        const markup = parseFloat(updated.markup_value) || 0;
        if (updated.selling_update_type === 'Percentage') {
          updated.calculated_price = parseFloat((rate + (rate * markup / 100)).toFixed(2));
        } else {
          updated.calculated_price = parseFloat((rate + markup).toFixed(2));
        }
      }
      return updated;
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, { item_code: '', item_name: '', purchase_rate: 0, selling_update_type: 'Amount', markup_value: 0, calculated_price: 0, custom_supplier_sl_no: '', custom_box_qty: 0, custom_pieces_per_box: 1, custom_box_price: 0, use_box_entry: false }]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!supplier.trim()) {
      Swal.fire('Please Select Supplier', 'Supplier is required for submission.', 'warning');
      return;
    }
    const validRows = rows.filter(r => r.item_code && r.purchase_rate > 0);
    if (validRows.length === 0) {
      Swal.fire('No Valid Items', 'Add at least one item with a valid rate.', 'info');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplier: supplier.trim(),
        warehouse,
        items: validRows.map(r => ({
          item_code: r.item_code,
          purchase_rate: r.purchase_rate,
          selling_update_type: r.selling_update_type,
          markup_value: r.markup_value,
          new_selling_rate: r.calculated_price,
          custom_supplier_sl_no: r.custom_supplier_sl_no,
          custom_box_qty: r.custom_box_qty,
          custom_pieces_per_box: r.custom_pieces_per_box,
          custom_box_price: r.custom_box_price
        }))
      };

      await frappeCall({
        method: 'kyle_retail.retail_api.api.submit_purchase_entry',
        args: { data: JSON.stringify(payload) }
      });

      Swal.fire({
        icon: 'success',
        title: 'Entry Submitted',
        text: 'Purchase record and prices updated successfully.',
        timer: 3000,
        showConfirmButton: false
      });

      setRows([{ item_code: '', item_name: '', purchase_rate: 0, selling_update_type: 'Amount', markup_value: 0, calculated_price: 0, custom_supplier_sl_no: '', custom_box_qty: 0, custom_pieces_per_box: 1, custom_box_price: 0, use_box_entry: false }]);
      setSupplier('');
    } catch (err) {
      Swal.fire('Submission Failed', typeof err === 'string' ? err : err.message || 'Error occurred during submission.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
      
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-100">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Tools</h1>
              </div>
              <p className="text-slate-500 font-medium text-sm">Quickly update purchase rates and selling prices</p>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Submit Purchase Entry
          </button>
        </div>

        {/* Global Supplier Search Card */}
        <div className="purchase-card mb-10 overflow-visible">
          <div className="purchase-header flex items-center gap-3">
            <Search className="w-4 h-4 text-indigo-500" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Select Supplier</h3>
          </div>
          <div className="p-6 relative">
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Type supplier name to search..."
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700 shadow-inner"
              />
            </div>

            {showSupplierDropdown && supplierResults.length > 0 && (
              <div className="absolute left-6 right-6 top-[calc(100%-8px)] z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                {supplierResults.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => { setSupplier(s.name || s); setShowSupplierDropdown(false); }}
                    className="px-6 py-4 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors"
                  >
                    <div className="font-bold text-slate-900">{s.supplier_name || s.name || s}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Supplier Code: {s.name || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items List Card */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <Package className="w-6 h-6 text-indigo-600" /> 
              Item Inventory Lines
            </h2>
            <button 
              onClick={addRow} 
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Line
            </button>
          </div>

          <div className="purchase-table-container">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th className="purchase-th min-w-[300px]">Item & Calculation</th>
                  <th className="purchase-th w-[180px]">Reference / SL #</th>
                  <th className="purchase-th w-[140px] text-right">Purchase Rate</th>
                  <th className="purchase-th w-[180px]">Update Type</th>
                  <th className="purchase-th w-[120px] text-right">Markup</th>
                  <th className="purchase-th w-[160px] text-right">New Price</th>
                  <th className="purchase-th w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={index} className="purchase-tr group">
                    <td className="purchase-td">
                      <select
                        value={row.item_code}
                        onChange={(e) => {
                          const itm = items.find(it => it.name === e.target.value);
                          updateRow(index, 'item_code', e.target.value);
                          if (itm) {
                            updateRow(index, 'item_name', itm.item_name);
                            if (itm.custom_pieces_per_box) {
                              updateRow(index, 'custom_pieces_per_box', itm.custom_pieces_per_box);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                      >
                        <option value="">Select Item...</option>
                        {items.map(it => (
                          <option key={it.name} value={it.name}>{it.item_name} ({it.name})</option>
                        ))}
                      </select>

                      <button 
                        onClick={() => updateRow(index, 'use_box_entry', !row.use_box_entry)}
                        className={`mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${row.use_box_entry ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        <Box className="w-3 h-3" />
                        {row.use_box_entry ? 'Hide Box Calc' : 'Use Box Calculation'}
                      </button>

                      {row.use_box_entry && (
                        <div className="box-entry-panel grid grid-cols-3 gap-2 mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                          <div>
                            <label className="box-entry-label text-indigo-400">Qty</label>
                            <input type="number" value={row.custom_box_qty || ''} onChange={(e) => updateRow(index, 'custom_box_qty', e.target.value)} className="box-entry-input !bg-white" placeholder="Boxes" />
                          </div>
                          <div>
                            <label className="box-entry-label text-indigo-400">Pcs/Bx</label>
                            <input type="number" value={row.custom_pieces_per_box || ''} onChange={(e) => updateRow(index, 'custom_pieces_per_box', e.target.value)} className="box-entry-input !bg-white" placeholder="1" />
                          </div>
                          <div>
                            <label className="box-entry-label text-indigo-400">Price</label>
                            <input type="number" value={row.custom_box_price || ''} onChange={(e) => updateRow(index, 'custom_box_price', e.target.value)} className="box-entry-input !bg-white" placeholder="0.00" />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="purchase-td">
                      <input
                        type="text"
                        value={row.custom_supplier_sl_no || ''}
                        onChange={(e) => updateRow(index, 'custom_supplier_sl_no', e.target.value)}
                        placeholder="Supplier SL #"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium placeholder:text-slate-300"
                      />
                    </td>

                    <td className="purchase-td text-right">
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          value={row.purchase_rate || ''}
                          onChange={(e) => updateRow(index, 'purchase_rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          readOnly={row.use_box_entry}
                          className={`rate-input w-28 text-right ${row.use_box_entry ? '!bg-slate-50' : ''}`}
                        />
                        {row.use_box_entry && (
                           <span className="text-[9px] font-black text-indigo-500 uppercase">Calculated</span>
                        )}
                      </div>
                    </td>

                    <td className="purchase-td">
                      <select
                        value={row.selling_update_type}
                        onChange={(e) => updateRow(index, 'selling_update_type', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600"
                      >
                        <option value="Amount">Fixed Mark-up</option>
                        <option value="Percentage">Percentage %</option>
                      </select>
                    </td>

                    <td className="purchase-td text-right">
                      <input
                        type="number"
                        value={row.markup_value || ''}
                        onChange={(e) => updateRow(index, 'markup_value', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-right text-sm font-black text-slate-700"
                      />
                    </td>

                    <td className="purchase-td text-right">
                      <div className={`px-4 py-3 rounded-xl font-black text-sm transition-all shadow-sm border ${row.calculated_price > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        {row.calculated_price > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <DirhamIcon size={12} /> {row.calculated_price.toFixed(2)}
                          </span>
                        ) : '—'}
                      </div>
                    </td>

                    <td className="purchase-td text-center">
                      <button
                        onClick={() => removeRow(index)}
                        disabled={rows.length <= 1}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
