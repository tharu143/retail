import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2, FileText, Plus, Receipt, FileText as InvoiceIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Reusable Model for PO Item (reuse across screens)
const POItemModel = {
  item_code: '',
  item_name: '',
  received_qty: 0,  // Received
  qty: 0,  // Accepted
  rejected_qty: 0,
  uom: '',
  retain_sample: 0,
  price_list_rate: 0,
  base_price_list_rate: 0,
  rate: 0,  // Read-only
  amount: 0,
  base_rate: 0,
  base_amount: 0,
  is_free_item: 0,
  net_rate: 0,
  net_amount: 0,
  item_tax_template: '',
  base_net_rate: 0,
  base_net_amount: 0,
  landed_cost_voucher_amount: 0,
  amount_difference_with_purchase_invoice: 0,
  billed_amt: 0,
  warehouse: '',  // Accepted warehouse
  rejected_warehouse: '',
  purchase_order: '',
  allow_zero_valuation_rate: 0,
  return_qty_from_rejected_warehouse: 0,
  schedule_date: ''
};

// Reusable Dashboard Card Component (for totals/history)
const DashboardCard = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border p-6 ${className}`}>
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    {children}
  </div>
);

function PurchaseOrderList() {
  const [poList, setPoList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);  // Reusable for dropdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState('receipt');  // 'receipt' or 'invoice'
  const [selectedPO, setSelectedPO] = useState(null);
  const [poDetails, setPoDetails] = useState(null);
  const [formData, setFormData] = useState({
    posting_date: '',
    posting_time: '',
    due_date: '',
    buying_price_list: '',
    set_warehouse: '',
    currency: '',
    conversion_rate: 1.0
  });
  const [itemData, setItemData] = useState([]);  // Editable items (qty, rejected_qty)
  const [createLoading, setCreateLoading] = useState(false);
  const theme = useSelector(state => state.user.theme);

  const navigate = useNavigate()

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = 'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchPOList();
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_warehouses`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWarehouses(data.message || []);
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const fetchPOList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_PATH}.get_purchase_orders`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPoList(data.message || []);
    } catch (err) {
      setError('Failed to load POs');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (po) => {
    setSelectedPO(po);
    setShowModal(true);
    fetchPODetails(po.name);
  };

  const fetchPODetails = async (po_name) => {
    try {
      const res = await fetch(`${API_PATH}.get_po_for_receipt_invoice?po_name=${po_name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPoDetails(data.message);
      setFormData({
        posting_date: data.message.posting_date?.slice(0, 10) || '',
        posting_time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
        due_date: data.message.posting_date?.slice(0, 10) || '',
        buying_price_list: '',
        set_warehouse: data.message.set_warehouse || '',
        currency: data.message.currency || 'AED',
        conversion_rate: data.message.conversion_rate || 1.0
      });
      // Auto-fill items with pending qty (rate read-only)
      setItemData(data.message.items?.map(item => ({
        ...POItemModel,
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty - (item.received_qty || item.billed_qty || 0),  // Pending accepted qty
        received_qty: item.qty - (item.received_qty || item.billed_qty || 0),  // Received = accepted by default
        uom: item.uom,
        rate: item.rate,  // Read-only
        base_rate: item.rate,  // Read-only
        amount: 0,  // Auto-calc
        base_amount: 0,
        rejected_qty: 0,
        schedule_date: item.schedule_date,
        price_list_rate: item.rate,  // Default
        base_price_list_rate: item.rate,
        net_rate: item.rate,
        base_net_rate: item.rate,
        net_amount: 0,
        base_net_amount: 0,
        retain_sample: 0,
        is_free_item: 0,
        landed_cost_voucher_amount: 0,
        amount_difference_with_purchase_invoice: 0,
        billed_amt: 0,
        warehouse: data.message.set_warehouse || item.warehouse,
        rejected_warehouse: '',
        purchase_order: po_name,
        allow_zero_valuation_rate: 0,
        return_qty_from_rejected_warehouse: 0,
        item_tax_template: ''
      })) || []);
    } catch (err) {
      setError('Failed to load PO details');
    }
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...itemData];
    if (field === 'qty') {
      updated[idx].qty = parseFloat(value) || 0;
      updated[idx].received_qty = updated[idx].qty;  // Received = accepted
      updated[idx].amount = updated[idx].qty * updated[idx].rate;
      updated[idx].base_amount = updated[idx].amount * formData.conversion_rate;
      updated[idx].net_amount = updated[idx].amount;
      updated[idx].base_net_amount = updated[idx].base_amount;
    } else if (field === 'rejected_qty') {
      updated[idx].rejected_qty = parseFloat(value) || 0;
      updated[idx].received_qty = updated[idx].qty + updated[idx].rejected_qty;  // Received = accepted + rejected
    }
    setItemData(updated);
  };

  const handleCreate = async () => {
    if (itemData.some(item => item.qty <= 0)) {
      setError('Qty must be > 0 for all items');
      return;
    }

    setCreateLoading(true);
    try {
      const endpoint = selectedType === 'receipt' ? 'create_purchase_receipt_from_po' : 'create_purchase_invoice_from_po';
      const body = {
        po_name: selectedPO.name,
        posting_date: formData.posting_date,
        posting_time: formData.posting_time,
        due_date: selectedType === 'invoice' ? formData.due_date : undefined,
        buying_price_list: selectedType === 'invoice' ? formData.buying_price_list : undefined,
        set_warehouse: formData.set_warehouse,
        items: itemData.map(item => ({
          item_code: item.item_code,
          qty: item.qty,
          received_qty: item.received_qty,
          rejected_qty: item.rejected_qty,
          uom: item.uom,
          rate: item.rate,
          amount: item.amount,
          base_rate: item.base_rate,
          base_amount: item.base_amount,
          is_free_item: item.is_free_item,
          net_rate: item.net_rate,
          net_amount: item.net_amount,
          base_net_rate: item.base_net_rate,
          base_net_amount: item.base_net_amount,
          item_tax_template: item.item_tax_template,
          price_list_rate: item.price_list_rate,
          base_price_list_rate: item.base_price_list_rate,
          landed_cost_voucher_amount: item.landed_cost_voucher_amount,
          amount_difference_with_purchase_invoice: item.amount_difference_with_purchase_invoice,
          billed_amt: item.billed_amt,
          warehouse: item.warehouse,
          rejected_warehouse: item.rejected_warehouse,
          purchase_order: selectedPO.name,
          allow_zero_valuation_rate: item.allow_zero_valuation_rate,
          return_qty_from_rejected_warehouse: item.return_qty_from_rejected_warehouse,
          schedule_date: item.schedule_date,
          retain_sample: item.retain_sample
        }))
      };
      const res = await fetch(`${API_PATH}.${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const apiResp = data.message || data;
      if (apiResp.status === 'success') {
        setSuccess(`${selectedType.toUpperCase()} ${apiResp.name} created! Total: AED ${apiResp.grand_total || apiResp.total || 0}`);
        setShowModal(false);
        setSelectedPO(null);
        setPoDetails(null);
        setItemData([]);
        fetchPOList();
      } else {
        setError(apiResp.message || 'Failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className={`min-h-screen p-6 ${theme === 'legacy' ? 'theme-legacy' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-700" /> Purchase Orders
          </h1>
          <button className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-2" onClick={() => navigate('/purchaseorder')}>
            <Plus className="w-5 h-5" /> New PO
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        <DashboardCard title="Purchase Orders List">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">PO No.</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Supplier</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {poList.map((po, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{po.name}</td>
                    <td className="py-3 px-4">{po.supplier}</td>
                    <td className="py-3 px-4">{new Date(po.transaction_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right font-mono">AED {po.grand_total?.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right ${po.status === 'To Receive and Bill' ? 'text-green-600' : 'text-amber-600'}`}>
                      {po.status}
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => openCreateModal(po)} className="text-blue-600 hover:underline text-sm">
                        Create Receipt/Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {/* Modal for Create Receipt/Invoice */}
        {showModal && selectedPO && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Create {selectedType.toUpperCase()} from PO {selectedPO.name}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <p className="text-sm text-slate-600">{poDetails?.supplier_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Company</label>
                  <p className="text-sm text-slate-600">{poDetails?.company}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <p className="text-sm text-slate-600">{poDetails?.currency}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select value={selectedType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full px-3 py-2 border rounded">
                    <option value="receipt">Purchase Receipt</option>
                    <option value="invoice">Purchase Invoice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Posting Date *</label>
                  <input type="date" value={formData.posting_date} onChange={(e) => handleFormChange('posting_date', e.target.value)} className="w-full px-3 py-2 border rounded" required />
                </div>
              </div>

              {selectedType === 'receipt' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Posting Time</label>
                  <input type="time" value={formData.posting_time} onChange={(e) => handleFormChange('posting_time', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
              )}

              {selectedType === 'invoice' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input type="date" value={formData.due_date} onChange={(e) => handleFormChange('due_date', e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Buying Price List</label>
                    <input type="text" value={formData.buying_price_list} onChange={(e) => handleFormChange('buying_price_list', e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Warehouse</label>
                <select value={formData.set_warehouse} onChange={(e) => handleFormChange('set_warehouse', e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">Select</option>
                  {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                </select>
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Items (Edit Qty Only)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left py-2 px-3">Item Code</th>
                        <th className="text-left py-2 px-3">Description</th>
                        <th className="text-right py-2 px-3">Received Qty</th>
                        <th className="text-right py-2 px-3">Accepted Qty</th>
                        <th className="text-right py-2 px-3">Rejected Qty</th>
                        <th className="text-right py-2 px-3">Rate (Read-only)</th>
                        <th className="text-right py-2 px-3">Amount</th>
                        <th className="text-left py-2 px-3">Schedule Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemData.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium">{item.item_code}</td>
                          <td className="py-2 px-3">{item.item_name}</td>
                          <td className="py-2 px-3 text-right">
                            <input type="number" value={item.received_qty} onChange={(e) => handleItemChange(i, 'received_qty', e.target.value)} min="0" step="0.01" className="w-16 text-right border rounded px-1" />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input type="number" value={item.qty} onChange={(e) => handleItemChange(i, 'qty', e.target.value)} min="0" step="0.01" className="w-16 text-right border rounded px-1" />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input type="number" value={item.rejected_qty} onChange={(e) => handleItemChange(i, 'rejected_qty', e.target.value)} min="0" step="0.01" className="w-16 text-right border rounded px-1" />
                          </td>
                          <td className="py-2 px-3 text-right bg-slate-100 px-2 rounded">{item.rate}</td>
                          <td className="py-2 px-3 text-right font-medium">AED {item.amount.toFixed(2)}</td>
                          <td className="py-2 px-3">{new Date(item.schedule_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={createLoading || itemData.some(item => item.qty <= 0)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  {createLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Create ${selectedType.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PurchaseOrderList;

