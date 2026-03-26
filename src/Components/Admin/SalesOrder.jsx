// src/Components/Admin/SalesOrder.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Package, Loader2,
  ChevronLeft, ChevronRight, X, Search, ScanLine, Palette, Zap
} from 'lucide-react';
import axios from 'axios';
import './SalesOrder.css';

const API_PATH_K = '/api/method/kyle_retail.retail_api.api';
const API_PATH_C = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const API_PATH = API_PATH_K;
const RESOURCE_BASE = '/api/resource';

/* ------------------------------------------------------------------ */
/* Recalculation                                                        */
/* ------------------------------------------------------------------ */
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
});

/* ------------------------------------------------------------------ */
function SalesOrder() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDocName, setEditingDocName] = useState(null);
  const [linkedDocs, setLinkedDocs] = useState({});
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  const [soTheme, setSoTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = soTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', soTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [soTheme, themeColor, themeColorHover, themeLight]);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [form, setForm] = useState(emptyForm());
  const [customers, setCustomers] = useState([]);
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});
  const [barcodeInput, setBarcodeInput] = useState('');

  const barcodeRef = useRef(null);

  useEffect(() => {
    let f = orders;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      f = f.filter(o =>
        o.name?.toLowerCase().includes(t) ||
        o.customer_name?.toLowerCase().includes(t)
      );
    }
    if (customerFilter) f = f.filter(o => o.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
    if (statusFilter !== 'all') f = f.filter(o =>
      (statusFilter === 'Submitted' && o.docstatus === 1) ||
      (statusFilter === 'Draft' && o.docstatus === 0)
    );
    if (minAmount) f = f.filter(o => Number(o.grand_total || 0) >= Number(minAmount));
    if (maxAmount) f = f.filter(o => Number(o.grand_total || 0) <= Number(maxAmount));
    setFilteredOrders(f);
  }, [searchTerm, customerFilter, statusFilter, minAmount, maxAmount, orders]);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchTaxTemplates();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'docstatus']),
          order_by: 'modified desc'
        },
        withCredentials: true
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_PATH_K}.get_customers_list_so`, { withCredentials: true });
      setCustomers(res.data.message || []);
    } catch (err) { console.error(err); }
  };

  const fetchTaxTemplates = async () => {
    try {
      const res = await axios.get(`${API_PATH_K}.get_sales_taxes_templates_so`, { withCredentials: true });
      setTaxTemplates(res.data.message || []);
    } catch (err) { console.error(err); }
  };

  const recalculate = useCallback(() => {
    setForm(prev => recalcForm(prev));
  }, []);

  const searchItems = async (query, idx) => {
    if (!query.trim()) {
      setItemsList([]);
      setShowItemDropdowns(p => ({ ...p, [idx]: false }));
      return;
    }
    try {
      const res = await axios.get(`${API_PATH}.get_items_so`, { params: { query }, withCredentials: true });
      setItemsList(res.data.message || []);
      setShowItemDropdowns(p => ({ ...p, [idx]: true }));
    } catch { setItemsList([]); }
  };

  const selectItem = async (idx, item) => {
    try {
      const rateRes = await axios.get(`${API_PATH}.get_item_selling_rate_so`, {
        params: { item_code: item.item_code, price_list: form.selling_price_list },
        withCredentials: true
      });
      const rate =
        rateRes.data?.message?.message?.rate ||
        rateRes.data?.message?.rate ||
        rateRes.data?.rate || 0;

      setForm(prev => {
        const items = [...prev.items];
        items[idx] = {
          item_code: item.item_code,
          item_name: item.item_name,
          uom: item.stock_uom || 'Nos',
          qty: 1,
          rate,
          amount: rate,
          delivery_date: prev.delivery_date || prev.transaction_date
        };
        return recalcForm({ ...prev, items });
      });
    } catch {
      setForm(prev => {
        const items = [...prev.items];
        items[idx] = { ...items[idx], rate: 0, amount: 0 };
        return recalcForm({ ...prev, items });
      });
    }
    setItemSearches(p => ({ ...p, [idx]: '' }));
    setShowItemDropdowns(p => ({ ...p, [idx]: false }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'qty' || field === 'rate') {
        items[idx].amount = (parseFloat(items[idx].qty) || 0) * (parseFloat(items[idx].rate) || 0);
      }
      return recalcForm({ ...prev, items });
    });
  };

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos', delivery_date: prev.delivery_date }]
    }));
  };

  const removeItemRow = idx => {
    setForm(prev => recalcForm({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleBarcodeScan = async e => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    e.preventDefault();
    const barcode = barcodeInput.trim();
    try {
      const res = await axios.get(`${API_PATH}.get_item_by_barcode_retail`, { params: { barcode }, withCredentials: true });
      const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;
      
      if (!item || item.status === 'error' || (!item.item_code && !item.name)) {
        throw new Error(item?.message || 'Item not found');
      }

      // get_retail_item_details should return rate, if not default to 0
      const rate = item.rate || item.last_selling_rate || item.standard_rate || 0;

      setForm(prev => recalcForm({
        ...prev,
        items: [...prev.items, {
          item_code: item.item_code,
          item_name: item.item_name,
          qty: 1,
          uom: item.stock_uom || 'Nos',
          rate,
          amount: rate,
          delivery_date: prev.delivery_date || prev.transaction_date
        }]
      }));
      setBarcodeInput('');
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const loadTaxTemplate = async templateName => {
    if (!templateName) {
      setForm(prev => recalcForm({ ...prev, taxes_and_charges: '', taxes: [] }));
      return;
    }
    try {
      const res = await axios.get(`${API_PATH}.get_sales_taxes_templates_so`, {
        params: { template: templateName }, withCredentials: true
      });
      const newTaxes = (res.data.message || []).map(t => ({ ...t, add_deduct_tax: t.add_deduct_tax || 'Add', total: '0.000' }));
      setForm(prev => recalcForm({ ...prev, taxes_and_charges: templateName, taxes: newTaxes }));
    } catch (err) {
      alert('Could not load tax template: ' + (err.response?.data?.message || err.message));
    }
  };

  const updateTax = (idx, field, value) => {
    setForm(prev => {
      const taxes = [...prev.taxes];
      taxes[idx] = { ...taxes[idx], [field]: value };
      return recalcForm({ ...prev, taxes });
    });
  };

  const removeTaxRow = idx => {
    setForm(prev => recalcForm({ ...prev, taxes: prev.taxes.filter((_, i) => i !== idx) }));
  };

  const addTaxRow = () => {
    setForm(prev => ({
      ...prev,
      taxes: [...prev.taxes, { add_deduct_tax: 'Add', charge_type: 'On Net Total', account_head: '', rate: 0, tax_amount: 0, total: '0.000' }]
    }));
  };

  const handleSave = async (submit = false) => {
    if (!form.customer) return alert('Customer is required');
    if (!form.items.length) return alert('Add at least one item');
    if (form.items.some(i => !i.item_code)) return alert('All items must be selected');

    const setS = submit ? setIsSubmitting : setSaving;
    setS(true);

    const payload = {
      doctype: 'Sales Order',
      naming_series: form.naming_series,
      transaction_date: form.transaction_date,
      delivery_date: form.delivery_date || form.transaction_date,
      customer: form.customer,
      order_type: form.order_type,
      currency: form.currency,
      selling_price_list: form.selling_price_list,
      items: form.items.map(i => ({ item_code: i.item_code, qty: i.qty, rate: i.rate, amount: i.amount })),
      taxes_and_charges: form.taxes_and_charges || undefined,
      taxes: form.taxes.map(t => ({
        charge_type: t.charge_type || 'On Net Total',
        account_head: t.account_head,
        rate: parseFloat(t.rate || 0),
        tax_amount: t.charge_type === 'Actual' ? parseFloat(t.tax_amount || 0) : 0,
        add_deduct_tax: t.add_deduct_tax || 'Add',
        description: t.description || t.account_head
      })),
      additional_discount_percentage: form.additional_discount_percentage || 0,
      discount_amount: form.discount_amount || 0,
      apply_discount_on: form.apply_discount_on,
      rounded_total: form.rounded_total,
      rounding_adjustment: form.rounding_adjustment,
      ...(submit ? { docstatus: 1 } : {})
    };

    try {
      if (editingDocName) {
        await axios.put(`${RESOURCE_BASE}/Sales Order/${editingDocName}`, payload, { withCredentials: true });
        alert(submit ? 'Sales Order Submitted!' : 'Draft Updated!');
      } else {
        const res = await axios.post(`${RESOURCE_BASE}/Sales Order`, payload, { withCredentials: true });
        alert(submit ? 'Sales Order Submitted!' : 'Saved as Draft!');
        if (!submit) setEditingDocName(res.data.data.name);
      }
      if (submit) { setShowModal(false); setEditingDocName(null); }
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleTransition = async (type) => {
    if (!editingDocName) return;
    setLoadingLinks(true);
    try {
      const endpoint = type === 'delivery_note' ? 'create_delivery_note_from_so' : 'create_sales_invoice_from_so';
      const res = await axios.post(`${API_PATH_K}.${endpoint}`, {
        so_name: editingDocName,
        submit_doc: true
      }, { withCredentials: true });

      const apiResp = res.data.message || res.data;
      if (apiResp.status === 'success') {
        alert(`${type === 'delivery_note' ? 'Delivery Note' : 'Sales Invoice'} created: ${apiResp.name}`);
        fetchLinkedDocs(editingDocName);
      } else {
        throw new Error(apiResp.message || 'Failed to create');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoadingLinks(false);
    }
  };

  const deleteOrder = async name => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      setSaving(true);
      await axios.delete(`${RESOURCE_BASE}/Sales Order/${name}`, { withCredentials: true });
      alert('Sales Order deleted!');
      closeModal();
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const fetchLinkedDocs = async (name) => {
    setLoadingLinks(true);
    try {
      const res = await axios.get(`${API_PATH_K}.get_linked_documents`, {
        params: { doctype: 'Sales Order', name },
        withCredentials: true
      });
      setLinkedDocs(res.data.message || {});
    } catch (err) { console.error(err); }
    finally { setLoadingLinks(false); }
  };

  const loadSalesOrder = async docName => {
    try {
      setLoading(true);
      const res = await axios.get(`${RESOURCE_BASE}/Sales Order/${docName}`, { withCredentials: true });
      const d = res.data.data;

      setForm({
        naming_series: d.naming_series || 'SAL-ORD-.YYYY.-',
        transaction_date: d.transaction_date,
        delivery_date: d.delivery_date || '',
        customer: d.customer || '',
        customer_name: d.customer_name || '',
        order_type: d.order_type || 'Sales',
        currency: d.currency || 'AED',
        selling_price_list: d.selling_price_list || 'Standard Selling',
        price_list_currency: d.price_list_currency || 'AED',
        items: (d.items || []).map(i => ({
          item_code: i.item_code || '',
          item_name: i.item_name || '',
          qty: i.qty || 1,
          rate: i.rate || 0,
          amount: i.amount || 0,
          uom: i.uom || 'Nos',
          delivery_date: d.delivery_date || d.transaction_date
        })),
        taxes_and_charges: d.taxes_and_charges || '',
        taxes: (d.taxes || []).map(t => ({ ...t, add_deduct_tax: t.add_deduct_tax || 'Add', total: '0.000' })),
        apply_discount_on: d.apply_discount_on || 'Grand Total',
        additional_discount_percentage: d.additional_discount_percentage || 0,
        discount_amount: d.discount_amount || 0,
        total_qty: d.total_qty || 0,
        base_total: d.base_total || 0,
        total: d.total || 0,
        total_taxes_and_charges: d.total_taxes_and_charges || 0,
        grand_total: d.grand_total || 0,
        rounding_adjustment: d.rounding_adjustment || 0,
        rounded_total: d.rounded_total || 0,
        docstatus: d.docstatus,
      });
      setSearchCustomer(d.customer_name || '');
      setEditingDocName(docName);
      setIsViewMode(true);
      setShowModal(true);
      fetchLinkedDocs(docName);
      setTimeout(() => barcodeRef.current?.focus(), 300);
    } catch { alert('Failed to load Sales Order'); }
    finally { setLoading(false); }
  };

  const openNew = () => {
    setEditingDocName(null);
    setForm(emptyForm());
    setSearchCustomer('');
    setItemSearches({});
    setShowItemDropdowns({});
    setBarcodeInput('');
    setIsViewMode(false);
    setShowModal(true);
    setTimeout(() => barcodeRef.current?.focus(), 300);
  };

  const closeModal = () => { setShowModal(false); setEditingDocName(null); };

  const clearFilters = () => {
    setSearchTerm(''); setCustomerFilter(''); setStatusFilter('all');
    setMinAmount(''); setMaxAmount('');
  };

  /* ================================================================ */
  return (
    <>
      <div className="so-page">

        {/* ---- Page Header ---- */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Package size={20} />
              Sales Orders
            </h1>
            <p className="so-page-subtitle">Manage and track all sales</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setSoTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                background: '#f8fafc',
                border: `1.5px solid ${themeColor}`,
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: themeColor,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {soTheme.toUpperCase()}
            </button>
            <button className="so-btn-primary" onClick={openNew}>
              <Plus size={16} /> New Sales Order
            </button>
          </div>
        </div>

        <div className="so-layout">
          {/* ---- Horizontal Filter Bar ---- */}
          <div className="so-filter-bar">
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Search Orders</label>
              <input
                className="so-filter-input"
                placeholder="Order ID or customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Customer</label>
              <input
                className="so-filter-input"
                placeholder="Customer name..."
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Status</label>
              <select
                className="so-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Amount Range</label>
              <div className="so-amount-range">
                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
            </div>
            <button
              className="so-clear-btn"
              onClick={clearFilters}
              style={{ width: 'auto', margin: 0, padding: '0 1.5rem', height: '38px', fontWeight: 600 }}
            >
              Clear Filters
            </button>
          </div>

          {/* ---- Main Content ---- */}
          <div className="so-content">
            <p className="so-list-meta">{filteredOrders.length} record(s) found</p>
            <div className="so-table-card">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="so-empty">
                        <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="so-empty">No sales orders found</td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.name} onClick={() => loadSalesOrder(order.name)}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{order.name}</td>
                        <td>{order.transaction_date}</td>
                        <td>{order.customer_name}</td>
                        <td>
                          <strong>AED {Number(order.grand_total || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</strong>
                        </td>
                        <td>
                          {order.docstatus === 1 ? (
                            <span className="so-badge" style={{
                              background: isGreen ? '#dcfce7' : '#e0f2fe',
                              color: isGreen ? '#166534' : '#0369a1',
                              border: `1px solid ${isGreen ? '#bbf7d0' : '#bae6fd'}`
                            }}>
                              Submitted
                            </span>
                          ) : (
                            <span className="so-badge so-badge-draft">Draft</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="so-pagination">
              <span>Showing {filteredOrders.length} of {orders.length} records</span>
              <div className="so-pagination-btns">
                <button className="so-page-btn" disabled><ChevronLeft size={14} /></button>
                <button className="so-page-btn active">1</button>
                <button className="so-page-btn" disabled><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Modal — TRUE FULLSCREEN                                          */}
        {/* ================================================================ */}
        {showModal && (
          <div
            className="so-modal-overlay"
            onClick={e => e.target === e.currentTarget && closeModal()}
          >
            <div className="so-modal">

              {/* Modal Header */}
              <div className="so-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={closeModal} className="so-modal-close" style={{ background: '#f8fafc' }}>
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h2 className="so-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {isViewMode ? `Order: ${editingDocName}` : (editingDocName ? 'Edit Sales Order' : 'New Sales Order')}
                    </h2>
                    {isViewMode && <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{form.customer_name}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {isViewMode && form.docstatus === 0 && (
                    <button
                      onClick={() => setIsViewMode(false)}
                      className="so-btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                    >
                      <Plus size={14} /> Edit Order
                    </button>
                  )}
                  {form.docstatus === 1 && (
                    <span className="so-badge" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>SUBMITTED</span>
                  )}
                  <button className="so-modal-close" onClick={closeModal}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="so-modal-body">
                {isViewMode ? (
                  <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

                    {/* Dashboard Connections */}
                    <div className="so-card" style={{ marginBottom: '2rem', border: `1px solid ${themeColor}30`, background: 'white' }}>
                      <div className="so-card-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <p className="so-card-title" style={{ fontSize: '0.7rem', color: themeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard / Connections</p>
                      </div>
                      <div className="so-card-body">
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                          <div style={{ padding: '0.75rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Delivery Notes</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>{linkedDocs.Delivery_Note?.length || 0}</span>
                          </div>
                          <div style={{ padding: '0.75rem 1.25rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#075985', textTransform: 'uppercase' }}>Sales Invoices</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0369a1' }}>{linkedDocs.Sales_Invoice?.length || 0}</span>
                          </div>
                        </div>
                        {form.docstatus === 1 && (
                          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                            <button onClick={() => handleTransition('delivery_note')} disabled={loadingLinks} className="so-btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.75rem' }}>
                              Create Delivery Note
                            </button>
                            <button onClick={() => handleTransition('sales_invoice')} disabled={loadingLinks} className="so-btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.75rem' }}>
                              Create Sales Invoice
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                          {linkedDocs.Delivery_Note?.map(dn => (
                            <span key={dn} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>DN: {dn}</span>
                          ))}
                          {linkedDocs.Sales_Invoice?.map(si => (
                            <span key={si} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>SI: {si}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="so-card">
                          <div className="so-card-header"><p className="so-card-title">Order Summary</p></div>
                          <div className="so-card-body">
                            <div className="so-table-wrapper" style={{ border: '1px solid #f1f5f9' }}>
                              <table className="so-items-table">
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th style={{ textAlign: 'center' }}>Qty</th>
                                    <th style={{ textAlign: 'right' }}>Rate</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {form.items.map((i, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <p style={{ fontWeight: 700, fontSize: '0.8rem' }}>{i.item_code}</p>
                                        <p style={{ fontSize: '0.7rem', color: '#64748b' }}>{i.item_name}</p>
                                      </td>
                                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qty}</td>
                                      <td style={{ textAlign: 'right' }}>{i.rate.toFixed(2)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{i.amount.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="so-card">
                          <div className="so-card-header"><p className="so-card-title">Order Info</p></div>
                          <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Date</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{form.transaction_date}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Delivery</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{form.delivery_date || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
                              <span className="so-badge" style={{
                                background: form.docstatus === 1 ? '#dcfce7' : '#f1f5f9',
                                color: form.docstatus === 1 ? '#166534' : '#64748b'
                              }}>
                                {form.docstatus === 1 ? 'SUBMITTED' : 'DRAFT'}
                              </span>
                            </div>
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Currency</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{form.currency}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 900 }}>Total</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColor }}>AED {form.grand_total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

                    {form.docstatus === 1 && (
                      <div className="so-card" style={{ border: `1.5px solid ${themeColor}`, background: themeLight }}>
                        <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="so-card-title" style={{ color: themeColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap size={14} fill={themeColor} /> Transition & Quick Actions
                          </span>
                          {loadingLinks && <Loader2 size={14} className="so-spinner" />}
                        </div>
                        <div className="so-card-body">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <button className="so-btn-primary" onClick={() => handleTransition('delivery_note')} disabled={loadingLinks} style={{ height: '36px', fontSize: '0.75rem' }}>
                              Create Delivery Note
                            </button>
                            <button className="so-btn-secondary" onClick={() => handleTransition('sales_invoice')} disabled={loadingLinks} style={{ height: '36px', fontSize: '0.75rem', background: '#fff' }}>
                              Create Sales Invoice
                            </button>
                          </div>
                          {(linkedDocs.Delivery_Note?.length > 0 || linkedDocs.Sales_Invoice?.length > 0 || linkedDocs.Payment_Entry?.length > 0) && (
                            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem' }}>
                              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>Linked Documents</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {linkedDocs.Delivery_Note?.map(dn => (
                                  <span key={dn} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>DN: {dn}</span>
                                ))}
                                {linkedDocs.Sales_Invoice?.map(si => (
                                  <span key={si} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>SI: {si}</span>
                                ))}
                                {linkedDocs.Payment_Entry?.map(pe => (
                                  <span key={pe} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>PE: {pe}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Core Details Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <span className="so-card-title">Order Details</span>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid">
                          <div className="so-field so-relative">
                            <label className="so-label">Customer <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                              className="so-input"
                              placeholder="Search customer..."
                              value={searchCustomer}
                              onChange={e => setSearchCustomer(e.target.value)}
                              onFocus={() => setShowCustomerDropdown(true)}
                              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                            />
                            {showCustomerDropdown && customers.length > 0 && (
                              <div className="so-dropdown">
                                {customers
                                  .filter(c => c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()))
                                  .map(c => (
                                    <div key={c.name} className="so-dropdown-item"
                                      onMouseDown={() => {
                                        setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                        setSearchCustomer(c.customer_name);
                                        setShowCustomerDropdown(false);
                                      }}
                                    >
                                      <div className="so-dropdown-item-name">{c.customer_name}</div>
                                      <div className="so-dropdown-item-code">{c.name}</div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Transaction Date</label>
                            <input type="date" className="so-input" value={form.transaction_date}
                              onChange={e => setForm(prev => ({ ...prev, transaction_date: e.target.value }))} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Delivery Date</label>
                            <input type="date" className="so-input" value={form.delivery_date}
                              onChange={e => setForm(prev => ({ ...prev, delivery_date: e.target.value }))} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Price List</label>
                            <select className="so-select" value={form.selling_price_list}
                              onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))}>
                              <option value="Standard Selling">Standard Selling</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Scanner */}
                    <div className="so-barcode-area">
                      <ScanLine size={22} />
                      <input
                        ref={barcodeRef}
                        id="barcode-scan-input-so"
                        className="so-barcode-input"
                        placeholder="Scan barcode and press Enter..."
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeScan}
                      />
                    </div>

                    {/* Items Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <span className="so-card-title">Product Items</span>
                        <button className="so-btn-ghost" onClick={addItemRow}><Plus size={14} /> Add Item</button>
                      </div>
                      <div className="so-items-table-wrap">
                        <table className="so-items-table">
                          <thead>
                            <tr>
                              <th style={{ width: '35%' }}>Item</th>
                              <th style={{ width: '10%' }}>UOM</th>
                              <th style={{ width: '12%' }}>Qty</th>
                              <th style={{ width: '15%' }}>Rate (AED)</th>
                              <th style={{ width: '18%' }}>Amount</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="so-empty">No items yet — scan a barcode or click <strong>Add Item</strong></td>
                              </tr>
                            ) : (
                              form.items.map((item, i) => (
                                <tr key={i}>
                                  <td className="so-relative">
                                    {item.item_code ? (
                                      <div>
                                        <div className="so-item-display-name">{item.item_name}</div>
                                        <div className="so-item-display-code">{item.item_code}</div>
                                      </div>
                                    ) : (
                                      <div className="so-relative">
                                        <input className="so-td-input" placeholder="Search item..."
                                          value={itemSearches[i] || ''}
                                          onChange={e => {
                                            const v = e.target.value;
                                            setItemSearches(p => ({ ...p, [i]: v }));
                                            searchItems(v, i);
                                          }}
                                        />
                                        {showItemDropdowns[i] && itemsList.length > 0 && (
                                          <div className="so-dropdown">
                                            {itemsList.map(itm => (
                                              <div key={itm.item_code} className="so-dropdown-item" onMouseDown={() => selectItem(i, itm)}>
                                                <div className="so-dropdown-item-name">{itm.item_name}</div>
                                                <div className="so-dropdown-item-code">{itm.item_code}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.uom}</td>
                                  <td>
                                    <input type="number" className="so-td-input" style={{ textAlign: 'center' }}
                                      value={item.qty || ''} onChange={e => updateItem(i, 'qty', e.target.value)} />
                                  </td>
                                  <td>
                                    <input type="number" step="0.01" className="so-td-input" style={{ textAlign: 'right' }}
                                      value={item.rate || ''} onChange={e => updateItem(i, 'rate', e.target.value)} />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                    {(parseFloat(item.amount) || 0).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button className="so-btn-danger" onClick={() => removeItemRow(i)}><Trash2 size={14} /></button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Taxes Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <span className="so-card-title">Taxes & Charges</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <select className="so-select"
                            style={{ width: 'auto', minWidth: '180px', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            value={form.taxes_and_charges} onChange={e => loadTaxTemplate(e.target.value)}>
                            <option value="">No Template</option>
                            {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                          </select>
                          <button className="so-btn-ghost" onClick={addTaxRow}><Plus size={14} /> Add Row</button>
                        </div>
                      </div>
                      {form.taxes.length > 0 && (
                        <div className="so-items-table-wrap">
                          <table className="so-taxes-table">
                            <thead>
                              <tr>
                                <th style={{ width: '5%' }}>Add</th>
                                <th style={{ width: '25%' }}>Type</th>
                                <th style={{ width: '30%' }}>Account</th>
                                <th style={{ width: '12%' }}>Rate %</th>
                                <th style={{ width: '15%' }}>Amount</th>
                                <th style={{ width: '13%' }}>Total</th>
                                <th style={{ width: '5%' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.taxes.map((tax, i) => (
                                <tr key={i}>
                                  <td>
                                    <input type="checkbox" checked={tax.add_deduct_tax === 'Add'}
                                      onChange={e => updateTax(i, 'add_deduct_tax', e.target.checked ? 'Add' : 'Deduct')} />
                                  </td>
                                  <td>
                                    <select className="so-td-input" value={tax.charge_type || ''}
                                      onChange={e => updateTax(i, 'charge_type', e.target.value)}>
                                      <option value="On Net Total">On Net Total</option>
                                      <option value="Actual">Actual</option>
                                      <option value="On Previous Row Amount">On Prev Row</option>
                                    </select>
                                  </td>
                                  <td>
                                    <input className="so-td-input" value={tax.account_head || ''}
                                      onChange={e => updateTax(i, 'account_head', e.target.value)} />
                                  </td>
                                  <td>
                                    <input type="number" className="so-td-input" style={{ textAlign: 'right' }}
                                      value={tax.rate || ''} onChange={e => updateTax(i, 'rate', e.target.value)} />
                                  </td>
                                  <td>
                                    <input type="number" className="so-td-input" style={{ textAlign: 'right' }}
                                      value={tax.tax_amount || ''} onChange={e => updateTax(i, 'tax_amount', e.target.value)}
                                      disabled={tax.charge_type !== 'Actual'} />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                    {parseFloat(tax.total || 0).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button className="so-btn-danger" onClick={() => removeTaxRow(i)}><Trash2 size={13} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Summary Bar */}
                    <div className="so-summary-bar">
                      <div className="so-summary-item">
                        <span className="so-summary-label">Total Qty</span>
                        <span className="so-summary-value">{form.total_qty || 0}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Net Total</span>
                        <span className="so-summary-value">AED {Number(form.base_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Taxes</span>
                        <span className="so-summary-value">AED {Number(form.total_taxes_and_charges || 0).toFixed(2)}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Grand Total</span>
                        <span className="so-summary-value grand">AED {Number(form.rounded_total || 0).toFixed(2)}</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {!isViewMode && (
                <div className="so-modal-footer">
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {editingDocName && form.docstatus === 0 && (
                      <button className="so-btn-danger" onClick={() => deleteOrder(editingDocName)}>
                        <Trash2 size={16} /> Delete Order
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="so-btn-secondary" onClick={closeModal}>Cancel</button>
                    {form.docstatus !== 1 && (
                      <button className="so-btn-primary" onClick={() => handleSave(false)} disabled={saving || isSubmitting}>
                        {saving ? <><Loader2 size={14} className="so-spinner" /> Saving...</> : 'Save Draft'}
                      </button>
                    )}
                    {form.docstatus !== 1 && (
                      <button className="so-btn-primary" onClick={() => handleSave(true)} disabled={saving || isSubmitting} style={{ background: themeColor }}>
                        {isSubmitting ? <><Loader2 size={14} className="so-spinner" /> Submitting...</> : 'Submit'}
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default SalesOrder;