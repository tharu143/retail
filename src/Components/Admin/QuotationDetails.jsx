import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ShoppingCart, Package, MapPin, Phone, Mail, ChevronLeft, Loader2,
  AlertCircle, Globe, Tag, Receipt, Layers, CreditCard,
  ArrowRight, Settings, Edit2, Save, X, CheckCircle2, Clock,
  Plus, Search, ScanLine, Trash2, Calendar, User, FileText, Info, Camera, Copy, Printer,
  ChevronDown, Zap, Link as LinkIcon, XCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import '../Headers/LegacyPOS.css';
import './Quotation.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';

const DEFAULT_QUOTATION_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 130 },
  { id: 'custom_ref_sl_no', label: 'Ref / SL #', visible: true, width: 110 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 95 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 95 },
  { id: 'is_tax_inclusive', label: 'Tax Inc/Exc', visible: true, width: 100 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 100 }
];

const QuotationItemModel = {
  item_code: '',
  item_name: '',
  rate: 0,
  amount: 0,
  custom_ref_sl_no: '',
  custom_box_qty: 1,
  custom_pieces_per_box: 1,
  custom_boxes_per_master_box: 1,
  custom_box_price: 0,
  custom_master_box_price: 0,
  use_box_entry: false,
  uom: 'Nos',
  stock_uom: 'Nos',
  uom_list: [],
  is_tax_inclusive: true
};

export default function QuotationDetails() {
  const { name } = useParams();
  const navigate = useNavigate();
  const isNew = !name || name === 'create';

  const user = useSelector((state) => state.user?.user || state.auth?.user || 'Administrator');
  const user_roles = useSelector((state) => state.user?.user_roles || []);
  const isAdministrator = user_roles.includes('Administrator') || user_roles.includes('System Manager');
  const loggedCompany = useSelector((state) => state.user?.company || state.auth?.company || 'Kyle Retail');
  const loggedWarehouse = useSelector((state) => state.user?.warehouse || state.auth?.warehouse || 'Al Rayyana Mall Warehouse - NS');
  const { themeColor, themeLight } = useLegacyTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  // Form State
  const [form, setForm] = useState({
    name: '',
    naming_series: 'SAL-QTN-.YYYY.-',
    party_name: '',
    customer_name: '',
    customer: '',
    quotation_to: 'Customer',
    order_type: 'Sales',
    transaction_date: new Date().toISOString().split('T')[0],
    valid_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    company: loggedCompany,
    currency: 'AED',
    status: 'Draft',
    docstatus: 0,
    taxes_and_charges: '',
    taxes: [],
    items: [],
    base_total: 0,
    net_total: 0,
    total_qty: 0,
    total_taxes_and_charges: 0,
    discount_amount: 0,
    grand_total: 0
  });

  // Customer State & Modal
  const [customers, setCustomers] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customer_name: '', mobile_no: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Barcode & Items
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [allowedActions, setAllowedActions] = useState([]);

  // Load Initial Metadata & Document
  useEffect(() => {
    fetchMetadata();
    if (!isNew) {
      fetchQuotation(name);
    } else {
      setForm((prev) => ({
        ...prev,
        items: []
      }));
    }
  }, [name, isNew]);

  const fetchMetadata = async () => {
    try {
      const [custRes, taxRes, whRes] = await Promise.all([
        axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list_so', { withCredentials: true }),
        axios.get('/api/method/kyle_retail.retail_api.api.get_sales_taxes_templates_so', { withCredentials: true }),
        axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses', {
          params: { is_group: 0 },
          withCredentials: true
        })
      ]);
      const activeTemplates = (taxRes.data?.message || []).filter((t) => t.name.toUpperCase().includes('NS'));
      setCustomers(custRes.data?.message || []);
      setTaxTemplates(activeTemplates);
      setWarehouses(whRes.data?.message || []);

      if (isNew) {
        const defaultTax =
          activeTemplates.find((t) => t.name.toUpperCase().includes('VAT 5% - NS')) ||
          activeTemplates.find((t) => t.name.toUpperCase().includes('VAT 5%')) ||
          activeTemplates.find((t) => t.name.toUpperCase().includes('5%')) ||
          activeTemplates[0];
        if (defaultTax) {
          setForm((prev) => ({ ...prev, taxes_and_charges: defaultTax.name }));
        }
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const fetchQuotation = async (docName) => {
    setLoading(true);
    try {
      const [qtnRes, statusRes] = await Promise.allSettled([
        axios.get(`/api/resource/Quotation/${encodeURIComponent(docName)}`, { withCredentials: true }),
        axios.get('/api/method/kyle_retail.retail_api.api.get_document_status_details', {
          params: { doctype: 'Quotation', docname: docName },
          withCredentials: true
        })
      ]);

      const doc = qtnRes.status === 'fulfilled' ? (qtnRes.value.data?.data || {}) : {};
      if (statusRes.status === 'fulfilled' && statusRes.value.data?.message?.data?.allowed_actions) {
        setAllowedActions(statusRes.value.data.message.data.allowed_actions);
      }

      const formattedItems = (doc.items || []).map((it) => {
        const normUom = (it.uom || 'Nos').toLowerCase();
        const isMasterBox = normUom === 'master box';
        const isBox = normUom === 'box';
        const ppb = parseFloat(it.custom_pieces_per_box) || 1;
        const bpm = parseFloat(it.custom_boxes_per_master_box) || 1;

        let boxQty = parseFloat(it.custom_box_qty);
        if (isNaN(boxQty) || boxQty <= 0) {
          if (isMasterBox) boxQty = (it.qty || 1) / (ppb * bpm);
          else if (isBox) boxQty = (it.qty || 1) / ppb;
          else boxQty = it.qty || 1;
        }

        return {
          ...it,
          custom_box_qty: parseFloat(boxQty.toFixed(2)),
          custom_pieces_per_box: ppb,
          custom_boxes_per_master_box: bpm,
          use_box_entry: isBox || isMasterBox || (ppb > 1),
          is_tax_inclusive: it.is_tax_inclusive !== false
        };
      });

      const updatedForm = {
        ...doc,
        customer: doc.party_name || '',
        customer_name: doc.customer_name || doc.party_name || '',
        items: formattedItems
      };

      setForm(recalcTotals(updatedForm));
      setSearchCustomer(doc.customer_name || doc.party_name || '');
      setIsEditing(doc.docstatus === 0);
    } catch (err) {
      Swal.fire('Error', 'Failed to load quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate Totals
  const recalcTotals = useCallback((currentForm) => {
    let subtotal = 0;
    let totalQty = 0;

    const items = (currentForm.items || []).map((it) => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.rate) || 0;
      const amt = parseFloat((q * r).toFixed(2));
      subtotal += amt;
      totalQty += q;
      return { ...it, amount: amt };
    });

    const disc = parseFloat(currentForm.discount_amount) || 0;
    const net = Math.max(0, subtotal - disc);

    // Standard VAT 5%
    const taxRate = 0.05;
    let totalTax = 0;
    items.forEach((it) => {
      if (it.is_tax_inclusive) {
        const itemNet = (it.amount || 0) / 1.05;
        totalTax += ((it.amount || 0) - itemNet);
      } else {
        totalTax += ((it.amount || 0) * taxRate);
      }
    });

    const grand = net + (items.some(i => !i.is_tax_inclusive) ? totalTax : 0);

    return {
      ...currentForm,
      items,
      base_total: parseFloat(subtotal.toFixed(2)),
      total_qty: parseFloat(totalQty.toFixed(2)),
      net_total: parseFloat(net.toFixed(2)),
      total_taxes_and_charges: parseFloat(totalTax.toFixed(2)),
      grand_total: parseFloat(grand.toFixed(2))
    };
  }, []);

  // Handle UOM Change in Row
  const handleUOMChange = (uomValue, rowIndex) => {
    setForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      const safeUom = String(uomValue || 'Nos');
      const normUom = safeUom.toLowerCase();
      const isMasterBox = normUom === 'master box';
      const isBox = normUom === 'box';

      item.uom = isMasterBox ? 'Master Box' : (isBox ? 'Box' : safeUom);
      item.use_box_entry = isBox || isMasterBox;

      const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
      const bPerMB = parseFloat(item.custom_boxes_per_master_box) || 1;
      const totalMbPcs = pPerBox * bPerMB;
      const boxQty = parseFloat(item.custom_box_qty) || 1;

      if (isMasterBox) {
        item.qty = parseFloat((boxQty * totalMbPcs).toFixed(2));
        item.custom_master_box_price = parseFloat(((item.rate || 0) * totalMbPcs).toFixed(2));
      } else if (isBox) {
        item.qty = parseFloat((boxQty * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((item.rate || 0) * pPerBox).toFixed(2));
      } else {
        item.qty = boxQty;
      }
      item.amount = parseFloat(((item.qty || 0) * (item.rate || 0)).toFixed(2));
      items[rowIndex] = item;
      return recalcTotals({ ...prev, items });
    });
  };

  // Handle Input Changes in Row
  const handleItemInputChange = (e, rowIndex) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      item[name] = value;

      const val = (value === '' || value === '.') ? 0 : parseFloat(value);
      const ppb = parseFloat(item.custom_pieces_per_box) || 1;
      const bpm = parseFloat(item.custom_boxes_per_master_box) || 1;
      const totalMbPcs = ppb * bpm;
      const normUom = (item.uom || '').toLowerCase();

      if (name === 'qty' || name === 'rate') {
        const q = name === 'qty' ? val : (parseFloat(item.qty) || 0);
        const r = name === 'rate' ? val : (parseFloat(item.rate) || 0);
        item.amount = parseFloat((q * r).toFixed(2));

        if (name === 'rate') {
          item.custom_box_price = parseFloat((val * ppb).toFixed(2));
          item.custom_master_box_price = parseFloat((val * totalMbPcs).toFixed(2));
        } else if (name === 'qty') {
          if (normUom === 'master box' && totalMbPcs > 0) {
            item.custom_box_qty = parseFloat((val / totalMbPcs).toFixed(2));
          } else if (normUom === 'box' && ppb > 0) {
            item.custom_box_qty = parseFloat((val / ppb).toFixed(2));
          } else {
            item.custom_box_qty = val;
          }
        }
      } else if (name === 'custom_box_qty') {
        if (normUom === 'master box') {
          item.qty = parseFloat((val * totalMbPcs).toFixed(2));
        } else if (item.use_box_entry || normUom === 'box') {
          item.qty = parseFloat((val * ppb).toFixed(2));
        } else {
          item.qty = val;
        }
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_pieces_per_box') {
        const pPerBox = Math.max(1, isNaN(val) ? 1 : val);
        item.qty = parseFloat(((parseFloat(item.custom_box_qty) || 0) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((parseFloat(item.rate) || 0) * pPerBox).toFixed(2));
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_box_price') {
        item.rate = parseFloat((val / (ppb || 1)).toFixed(2));
        item.amount = parseFloat(((parseFloat(item.qty) || 0) * item.rate).toFixed(2));
      }

      items[rowIndex] = item;
      return recalcTotals({ ...prev, items });
    });
  };

  // Select Item from Global Search / Dropdown
  const selectItem = async (targetIdx, itm) => {
    try {
      const rawUom = String(itm.scanned_uom || itm.uom || itm.stock_uom || 'Nos').trim();
      const normUom = rawUom.toLowerCase();
      const isMasterBox = normUom === 'master box';
      const isBox = normUom === 'box';
      const isBoxOrMb = isMasterBox || isBox;
      const ppb = parseFloat(itm.custom_pieces_per_box || itm.custom_pcs_per_box) || 1;
      const bpm = parseFloat(itm.custom_boxes_per_master_box) || 1;
      const totalMbPcs = ppb * bpm;

      let unitRate = parseFloat(itm.rate || itm.price || 0);
      if (!unitRate) {
        try {
          const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
            params: { item_code: itm.item_code, price_list: 'Standard Selling' },
            withCredentials: true
          });
          unitRate = rateRes.data?.message?.rate || 0;
        } catch (e) { }
      }

      const selectedUom = isMasterBox ? 'Master Box' : (isBox ? 'Box' : (itm.stock_uom || 'Nos'));
      const initialQty = isMasterBox ? totalMbPcs : (isBox ? ppb : 1);

      const newRow = {
        ...QuotationItemModel,
        item_code: itm.item_code,
        item_name: itm.item_name,
        stock_uom: itm.stock_uom || 'Nos',
        uom: selectedUom,
        custom_box_qty: 1,
        custom_pieces_per_box: ppb,
        custom_boxes_per_master_box: bpm,
        rate: parseFloat(unitRate.toFixed(2)),
        custom_box_price: parseFloat((unitRate * ppb).toFixed(2)),
        custom_master_box_price: parseFloat((unitRate * totalMbPcs).toFixed(2)),
        qty: initialQty,
        amount: parseFloat((initialQty * unitRate).toFixed(2)),
        use_box_entry: isBoxOrMb,
        uom_list: itm.uom_list || []
      };

      setForm((prev) => {
        const items = [...prev.items];
        if (targetIdx < items.length) {
          items[targetIdx] = newRow;
        } else {
          items.push(newRow);
        }
        return recalcTotals({ ...prev, items });
      });
    } catch (err) {
      console.error('Error selecting item:', err);
    }
  };

  // Barcode Scanning Handler
  const handleBarcodeSearch = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = barcodeInput.trim();
      if (!val) return;

      try {
        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_by_barcode_po', {
          params: { barcode: val },
          withCredentials: true
        });
        const itm = res.data?.message;
        if (itm && itm.item_code) {
          selectItem(form.items.length, itm);
          setBarcodeInput('');
        } else {
          Swal.fire('Item Not Found', `No item found for barcode ${val}`, 'warning');
        }
      } catch (err) {
        Swal.fire('Scan Error', 'Failed to fetch item by barcode', 'error');
      }
    }
  };

  const removeItemRow = (idx) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== idx);
      return recalcTotals({ ...prev, items });
    });
  };

  // Save / Submit Document
  const handleSave = async (submitAfterSave = false) => {
    if (!form.customer && !form.party_name && !searchCustomer) {
      return Swal.fire('Validation Error', 'Please select a Customer for this Quotation.', 'warning');
    }
    const validItems = form.items.filter((i) => i.item_code);
    if (validItems.length === 0) {
      return Swal.fire('Validation Error', 'Please add at least one item to the Quotation.', 'warning');
    }

    setSaving(true);
    try {
      const payload = {
        doctype: 'Quotation',
        name: isNew ? undefined : form.name,
        party_name: form.customer || form.party_name || searchCustomer,
        customer_name: form.customer_name || searchCustomer,
        quotation_to: 'Customer',
        order_type: form.order_type || 'Sales',
        transaction_date: form.transaction_date,
        valid_till: form.valid_till,
        company: form.company || loggedCompany,
        currency: form.currency || 'AED',
        taxes_and_charges: form.taxes_and_charges,
        discount_amount: parseFloat(form.discount_amount) || 0,
        items: validItems.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name,
          uom: it.uom,
          stock_uom: it.stock_uom,
          qty: it.qty,
          rate: it.rate,
          amount: it.amount,
          custom_ref_sl_no: it.custom_ref_sl_no || '',
          custom_box_qty: it.custom_box_qty,
          custom_pieces_per_box: it.custom_pieces_per_box,
          custom_boxes_per_master_box: it.custom_boxes_per_master_box,
          custom_box_price: it.custom_box_price
        }))
      };

      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.save_transaction_document',
        {
          doctype: 'Quotation',
          doc_data: payload,
          action: submitAfterSave ? 'submit' : 'save'
        },
        { withCredentials: true }
      );

      const savedDoc = res.data?.data || res.data?.message?.data || res.data?.message?.doc || {};
      const docId = savedDoc.name || form.name;

      Swal.fire({
        icon: 'success',
        title: submitAfterSave ? 'Quotation Submitted!' : 'Quotation Saved!',
        text: `Quotation ${docId} has been successfully ${submitAfterSave ? 'submitted' : 'saved'}.`,
        timer: 1500,
        showConfirmButton: false
      });

      if (isNew && docId) {
        navigate(`/quotation-details/${encodeURIComponent(docId)}`, { replace: true });
      } else {
        fetchQuotation(docId);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message || 'Failed to save Quotation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Convert to Sales Order
  const handleConvertToSalesOrder = async () => {
    const result = await Swal.fire({
      title: 'Create Sales Order?',
      text: `Convert Quotation ${form.name} into a Sales Order?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Create SO',
      confirmButtonColor: '#0082f6'
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_sales_order_from_quotation', {
        quotation_name: form.name
      }, { withCredentials: true });

      if (res.data?.message?.status === 'success' || res.data?.status === 'success') {
        const soName = res.data?.message?.name || res.data?.name;
        Swal.fire({
          icon: 'success',
          title: 'Sales Order Created',
          text: `Sales Order ${soName} generated successfully!`,
          confirmButtonText: 'Open Sales Order',
          confirmButtonColor: '#0082f6'
        }).then(() => {
          navigate(`/salesorder-details/${encodeURIComponent(soName)}`);
        });
      } else {
        Swal.fire('Error', res.data?.message?.message || 'Failed to generate Sales Order', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Convert to Sales Invoice
  const handleConvertToSalesInvoice = async () => {
    const result = await Swal.fire({
      title: 'Create Sales Invoice?',
      text: `Convert Quotation ${form.name} into a Sales Invoice?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Create Invoice',
      confirmButtonColor: '#0082f6'
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_sales_invoice_from_quotation', {
        quotation_name: form.name
      }, { withCredentials: true });

      if (res.data?.message?.status === 'success' || res.data?.status === 'success') {
        const siName = res.data?.message?.name || res.data?.name;
        Swal.fire({
          icon: 'success',
          title: 'Sales Invoice Created',
          text: `Sales Invoice ${siName} generated successfully!`,
          confirmButtonText: 'Open Sales Invoice',
          confirmButtonColor: '#0082f6'
        }).then(() => {
          navigate('/salesinvoice');
        });
      } else {
        Swal.fire('Error', res.data?.message?.message || 'Failed to generate Sales Invoice', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Cancel Quotation
  const handleCancel = async () => {
    if (!form.name) return;
    const result = await Swal.fire({
      title: 'Cancel Quotation?',
      text: `Are you sure you want to cancel Quotation ${form.name}? This action cannot be reversed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Cancel Quotation',
      cancelButtonText: 'No, Keep it'
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.save_transaction_document', {
        doctype: 'Quotation',
        doc_data: { name: form.name },
        action: 'cancel'
      }, { withCredentials: true });

      if (res.data?.success || res.data?.message?.status === 'success' || res.data?.message?.name || res.data?.name) {
        Swal.fire({
          icon: 'success',
          title: 'Quotation Cancelled',
          text: `Quotation ${form.name} is now cancelled.`,
          timer: 1500,
          showConfirmButton: false
        });
        fetchQuotation(form.name);
      } else {
        Swal.fire('Error', res.data?.message?.message || res.data?.message || 'Failed to cancel Quotation', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?._server_messages || err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Duplicate Quotation
  const handleDuplicate = () => {
    setForm((prev) => ({
      ...prev,
      name: '',
      docstatus: 0,
      creation: '',
      amended_from: '',
      naming_series: 'SAL-QTN-.YYYY.-',
      transaction_date: new Date().toISOString().split('T')[0],
      valid_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    setIsEditing(true);
    setIsNew(true);
    navigate('/quotation/new', { replace: true });
    Swal.fire({
      icon: 'info',
      title: 'Quotation Duplicated',
      text: 'A new draft quotation copy has been created. Click Save Draft to save it.',
      timer: 1500,
      showConfirmButton: false
    });
  };

  // Print PDF
  const handlePrintPDF = () => {
    if (!form.name) return;
    window.open(`/api/method/frappe.utils.print_format.download_pdf?doctype=Quotation&name=${encodeURIComponent(form.name)}`, '_blank');
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore when typing inside input or select unless shortcut keys
      const activeEl = document.activeElement;
      const isInput = activeEl && ['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName);

      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.querySelector('.custom-search-dropdown-input, input[placeholder*="Search customer"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (barcodeRef.current) {
          barcodeRef.current.focus();
          barcodeRef.current.select?.();
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (isEditing && !saving) {
          handleSave(false);
        }
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (isEditing && !saving) {
          handleSave(true);
        }
      } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (form.name) {
          handleDuplicate();
        }
      } else if (e.key === 'Escape') {
        if (!isInput) {
          e.preventDefault();
          if (isEditing) {
            if (isNew) navigate('/quotationlist');
            else setIsEditing(false);
          } else {
            navigate('/quotationlist');
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEditing, form, saving, isNew]);

  const isViewOnly = !isEditing || form.docstatus !== 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-slate-50">
        <Loader2 size={40} className="animate-spin text-blue-600" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Quotation...</p>
      </div>
    );
  }

  return (
    <div className="classic-root" style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
      {/* 1. CLASSIC SHORTCUTS GUIDE BANNER */}
      <div className="so-shortcut-guide-banner" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping mr-0.5"></span>
          <span>QUOTATION</span>
        </div>
        <div className="so-shortcut-badges-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
          <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="so-shortcut-key" style={{ background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F2</span>
            <span className="so-shortcut-label" style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>CUSTOMER</span>
          </div>
          <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="so-shortcut-key" style={{ background: '#0ea5e9', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F3</span>
            <span className="so-shortcut-label" style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>SEARCH</span>
          </div>
          <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F4</span>
            <span className="so-shortcut-label" style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>BARCODE</span>
          </div>
          <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="so-shortcut-key" style={{ background: '#eab308', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F7</span>
            <span className="so-shortcut-label" style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>SAVE DRAFT</span>
          </div>
          <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>CTRL+↵</span>
            <span className="so-shortcut-label" style={{ fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>SUBMIT</span>
          </div>
        </div>
      </div>

      {/* 2. CLASSIC HEADER FORM */}
      <div className="classic-header-form" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
        {/* Row 1 */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 w-full">
          {/* Customer Selection */}
          <div className="classic-field flex items-center gap-1.5 relative flex-1 min-w-[200px]">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">CUSTOMER</label>
            <div className="relative group flex-1">
              <CustomSearchDropdown
                placeholder="Search customer..."
                value={form.customer ? { name: form.customer, customer_name: form.customer_name } : null}
                onSelect={(val) => {
                  if (val) {
                    setForm((prev) => ({ ...prev, customer: val.name, customer_name: val.customer_name }));
                    setSearchCustomer(val.customer_name);
                  } else {
                    setForm((prev) => ({ ...prev, customer: '', customer_name: '' }));
                    setSearchCustomer('');
                  }
                }}
                fetchData={async (val) => {
                  const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list_so', { params: { search_term: val }, withCredentials: true });
                  return res.data.message || [];
                }}
                createOption={() => setIsCustomerModalOpen(true)}
                optionsLabel="customer_name"
                globalSearch={true}
                themeColor={themeColor || '#0082f6'}
                disabled={isViewOnly}
              />
            </div>
          </div>

          {/* Branch / Warehouse */}
          <div className="classic-field flex items-center gap-1.5 relative flex-1 min-w-[180px]">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">BRANCH</label>
            <div className="h-9 px-2.5 flex items-center border border-slate-200 bg-slate-50 rounded-lg text-xs font-black uppercase tracking-wider text-slate-700 shadow-2xs w-full overflow-hidden whitespace-nowrap" title={form.set_source_warehouse || loggedWarehouse}>
              <span className="truncate">{form.set_source_warehouse || loggedWarehouse || 'Main Warehouse'}</span>
            </div>
          </div>

          {/* Date */}
          <div className="classic-field flex items-center gap-1.5 shrink-0">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">DATE</label>
            <input
              type="date"
              value={form.transaction_date}
              disabled={isViewOnly}
              onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 w-[120px]"
            />
          </div>

          {/* Valid Till */}
          <div className="classic-field flex items-center gap-1.5 shrink-0">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">VALID TILL</label>
            <input
              type="date"
              value={form.valid_till}
              disabled={isViewOnly}
              onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              onChange={(e) => setForm({ ...form, valid_till: e.target.value })}
              className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 w-[120px]"
            />
          </div>

          {/* Currency */}
          <div className="classic-field flex items-center gap-1.5 shrink-0">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">CURRENCY</label>
            <div className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-800 flex items-center gap-1 shadow-2xs select-none">
              <DirhamIcon size={13} className="text-slate-700" />
              <span>AED</span>
            </div>
          </div>

          {/* QTN NO */}
          <div className="classic-field flex items-center gap-1.5 shrink-0">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">QTN NO</label>
            <div className="h-9 px-2.5 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-black text-slate-800">
              {form.name || form.naming_series || 'NEW-SAL-QTN'}
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 w-full border-t border-dashed border-slate-200 pt-1.5">
          <div className="classic-field flex items-center gap-1.5 flex-1 min-w-[180px]">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">SERIES</label>
            <select
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
              value={form.naming_series || 'SAL-QTN-.YYYY.-'}
              disabled={isViewOnly}
              onChange={(e) => setForm({ ...form, naming_series: e.target.value })}
            >
              <option value="SAL-QTN-.YYYY.-">SAL-QTN-.YYYY.-</option>
            </select>
          </div>

          <div className="classic-field flex items-center gap-1.5 flex-1 min-w-[180px]">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">ORDER TYPE</label>
            <select
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
              value={form.order_type || 'Sales'}
              disabled={isViewOnly}
              onChange={(e) => setForm({ ...form, order_type: e.target.value })}
            >
              <option value="Sales">Sales</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Shopping Cart">Shopping Cart</option>
            </select>
          </div>

          <div className="classic-field flex items-center gap-1.5 flex-1 min-w-[200px]">
            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap">TAX TEMPLATE</label>
            <select
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
              value={form.taxes_and_charges || ''}
              disabled={isViewOnly}
              onChange={(e) => setForm({ ...form, taxes_and_charges: e.target.value })}
            >
              <option value="">No Tax Schedule...</option>
              {taxTemplates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. CLASSIC MAIN BODY: TABLE + BOTTOM CONTROLS */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-2 min-h-0 gap-2">
        {/* Table container (middle section only scrolls) */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          {/* Barcode scan bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.8rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      ref={barcodeRef}
                      type="text"
                      className="so-select"
                      placeholder="Focus here to scan barcode..."
                      disabled={isViewOnly}
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeSearch}
                      style={{ height: '2.1rem', fontSize: '0.75rem', fontWeight: '700', paddingRight: '2.5rem', width: '100%' }}
                    />
                    <ScanLine
                      size={14}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => setShowCamera(!showCamera)}
                    title="Start Camera Scanner"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2.1rem',
                      height: '2.1rem',
                      background: '#0082f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: isViewOnly ? 'not-allowed' : 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Camera size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black uppercase text-slate-400">
                {form.items.filter((it) => it.item_code).length} ITEM(S) IN QUOTATION
              </span>
            </div>
          </div>

          {/* Center Table Area (Only this scrolls) */}
          <div className="erp-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <table
              className="erp-table classic-table"
              style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', background: '#ffffff', tableLayout: 'fixed' }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                  <th style={{ width: '40px', minWidth: '40px', textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>#</th>
                  <th style={{ width: '260px', minWidth: '260px', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>ITEM CODE / NAME</th>
                  <th style={{ width: '110px', minWidth: '110px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>REF / SL #</th>
                  <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>QTY</th>
                  <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>UOM</th>
                  <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>PCS/BOX</th>
                  <th style={{ width: '100px', minWidth: '100px', textAlign: 'right', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>BOX PRICE</th>
                  <th style={{ width: '100px', minWidth: '100px', textAlign: 'right', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>RATE (NOS)</th>
                  <th style={{ width: '100px', minWidth: '100px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>TAX INC/EXC</th>
                  <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>TOTAL QTY</th>
                  <th style={{ width: '110px', minWidth: '110px', textAlign: 'right', padding: '8px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>SUBTOTAL</th>
                  <th style={{ width: '40px', minWidth: '40px', textAlign: 'center', padding: '8px 4px' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => {
                  if (!item.item_code) return null;
                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                      <td className="text-center font-bold text-slate-400 text-xs py-2 border-r border-slate-100">{idx + 1}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 align-middle">
                        <span className="font-black text-slate-900 text-xs leading-tight block truncate" title={item.item_name}>
                          {item.item_name || item.item_code}
                        </span>
                        <div className="text-[10px] text-slate-400 font-bold">{item.item_code}</div>
                      </td>
                      <td className="px-2 py-1 border-r border-slate-100 align-middle">
                        <input
                          type="text"
                          name="custom_ref_sl_no"
                          value={item.custom_ref_sl_no || ''}
                          disabled={isViewOnly}
                          onChange={(e) => handleItemInputChange(e, idx)}
                          placeholder="Ref #"
                          className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 text-center"
                        />
                      </td>
                      <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                        <input
                          type="number"
                          name="custom_box_qty"
                          value={item.custom_box_qty}
                          disabled={isViewOnly}
                          onChange={(e) => handleItemInputChange(e, idx)}
                          className="w-full h-8 px-2 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                        />
                      </td>
                      <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                        <select
                          value={item.uom}
                          disabled={isViewOnly}
                          onChange={(e) => handleUOMChange(e.target.value, idx)}
                          className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
                        >
                          {item.uom_list && item.uom_list.length > 0 ? (
                            item.uom_list.map((u, i) => (
                              <option key={i} value={u.uom}>
                                {u.uom}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Nos">Nos</option>
                              <option value="Box">Box</option>
                              <option value="Master Box">Master Box</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                        <input
                          type="number"
                          name="custom_pieces_per_box"
                          value={item.custom_pieces_per_box}
                          disabled={isViewOnly}
                          onChange={(e) => handleItemInputChange(e, idx)}
                          className="w-full h-8 px-2 text-center font-bold text-xs text-slate-700 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                        />
                      </td>
                      <td className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                        <input
                          type="number"
                          name="custom_box_price"
                          value={item.custom_box_price}
                          disabled={isViewOnly}
                          onChange={(e) => handleItemInputChange(e, idx)}
                          className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                        />
                      </td>
                      <td className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                        <input
                          type="number"
                          name="rate"
                          value={item.rate}
                          disabled={isViewOnly}
                          onChange={(e) => handleItemInputChange(e, idx)}
                          className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                        />
                      </td>
                      <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                        <select
                          value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                          disabled={isViewOnly}
                          onChange={(e) => {
                            const val = e.target.value === 'Inclusive';
                            setForm((prev) => {
                              const items = [...prev.items];
                              items[idx] = { ...items[idx], is_tax_inclusive: val };
                              return recalcTotals({ ...prev, items });
                            });
                          }}
                          className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
                        >
                          <option value="Inclusive">Inclusive</option>
                          <option value="Exclusive">Exclusive</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center border-r border-slate-100 align-middle text-xs font-black text-slate-500">
                        {item.qty}
                      </td>
                      <td className="px-2 py-1 text-right border-r border-slate-100 align-middle text-xs font-black text-slate-900 pr-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <DirhamIcon size={11} className="inline-block align-middle" />
                          <span>{((item.qty || 0) * (item.rate || 0)).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="text-center px-1">
                        {!isViewOnly && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Inline item search row when editing */}
                {isEditing && (
                  <tr className="bg-emerald-50/20 border-b border-dashed border-emerald-300">
                    <td className="text-center font-bold text-emerald-600 text-xs py-2 border-r border-slate-100">+</td>
                    <td className="p-1 border-r border-slate-100 align-middle" style={{ width: '260px', minWidth: '260px', maxWidth: '260px' }}>
                      <CustomSearchDropdown
                        placeholder="Search SKU or Name..."
                        onSelect={(val) => val && selectItem(form.items.length, val)}
                        fetchData={async (val) => {
                          const res = await axios.get('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', {
                            params: { search_term: val },
                            withCredentials: true
                          });
                          return res.data.message?.data || [];
                        }}
                        optionsLabel="item_name"
                        globalSearch={true}
                        themeColor="#10b981"
                      />
                    </td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td></td>
                  </tr>
                )}

                {/* Empty filler rows to preserve table layout */}
                {Array.from({ length: Math.max(0, 7 - form.items.filter((it) => it.item_code).length) }).map((_, i) => (
                  <tr key={`fill-${i}`} className="bg-white/40 border-b border-slate-100 opacity-40">
                    <td className="text-center text-slate-300 font-bold text-xs py-2">{form.items.filter((it) => it.item_code).length + i + 2}</td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td className="border-r border-slate-100"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM ACTION BAR + TOTALS CARD (Fixed bottom, fits nicely in 100vh) */}
        <div className="pt-2 flex-shrink-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
            {/* ACTION BUTTON GRID (LEFT SIDE) */}
            <div className="xl:col-span-7 flex">
              <div className="grid grid-cols-4 grid-rows-2 gap-2.5 w-full h-full p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                {/* Row 1 / Col 1: SAVE DRAFT */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="h-full bg-[#f59e0b] hover:bg-[#d97706] text-white border-2 border-[#f59e0b] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Save size={15} />
                      <span>SAVE DRAFT</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">F7</span>
                  </button>
                )}

                {/* Row 1 / Col 2: SUBMIT */}
                {form.docstatus === 0 && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="h-full bg-[#10b981] hover:bg-[#059669] text-white border-2 border-[#10b981] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <CheckCircle2 size={15} />
                      <span>SUBMIT</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">Ctrl+↵</span>
                  </button>
                )}

                {/* Row 1 / Col 3: CREATE SO */}
                {form.name && form.docstatus === 1 && (
                  <button
                    type="button"
                    onClick={handleConvertToSalesOrder}
                    disabled={saving}
                    className="h-full bg-[#0d9488] hover:bg-[#0f766e] text-white border-2 border-[#0d9488] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                      <Plus size={15} />
                      <span>CREATE SO</span>
                    </div>
                  </button>
                )}

                {/* Row 1 / Col 4: CREATE SI */}
                {form.name && form.docstatus === 1 && (
                  <button
                    type="button"
                    onClick={handleConvertToSalesInvoice}
                    disabled={saving}
                    className="h-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white border-2 border-[#0ea5e9] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                      <Plus size={15} />
                      <span>CREATE SI</span>
                    </div>
                  </button>
                )}

                {/* Row 2 / Col 1: DISCARD (when editing) / CANCEL (when submitted or draft view) */}
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => (isNew ? navigate('/quotationlist') : setIsEditing(false))}
                    className="h-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] border-2 border-[#cbd5e1] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#334155]">
                      <X size={15} />
                      <span>DISCARD</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Esc</span>
                  </button>
                ) : (form.docstatus === 0 || form.docstatus === 1) && form.name ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="h-full bg-[#ef4444] hover:bg-[#dc2626] text-white border-2 border-[#ef4444] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <XCircle size={15} />
                      <span>CANCEL</span>
                    </div>
                  </button>
                ) : (
                  <div></div>
                )}

                {/* Row 2 / Col 2: MODIFY (when draft view) / DUPLICATE */}
                {!isEditing && form.docstatus === 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="h-full bg-[#3b82f6] hover:bg-[#2563eb] text-white border-2 border-[#3b82f6] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Edit2 size={15} />
                      <span>MODIFY</span>
                    </div>
                  </button>
                ) : form.name ? (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="h-full bg-[#7e22ce] hover:bg-[#6b21a8] text-white border-2 border-[#7e22ce] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Copy size={15} />
                      <span>DUPLICATE</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">Alt+D</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {/* Row 2 / Col 3: PRINT PDF */}
                {form.name && (
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="h-full bg-[#0284c7] hover:bg-[#0369a1] text-white border-2 border-[#0284c7] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '18px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Printer size={15} />
                      <span>PRINT PDF</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">PDF</span>
                  </button>
                )}

                {/* Row 2 / Col 4: BACK TO LIST */}
                <button
                  type="button"
                  onClick={() => navigate('/quotationlist')}
                  className="h-full bg-[#f8fafc] hover:bg-slate-100 text-slate-700 border-2 border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                  style={{ borderRadius: '18px' }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <ChevronLeft size={15} />
                    <span>LIST</span>
                  </div>
                  <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Esc</span>
                </button>
              </div>
            </div>

            {/* TOTALS CARD (RIGHT SIDE, col-span-5) */}
            <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">TAX TEMPLATE</span>
                  <select
                    value={form.taxes_and_charges || ''}
                    disabled={isViewOnly}
                    onChange={(e) => setForm({ ...form, taxes_and_charges: e.target.value })}
                    className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer p-0 m-0 border-none"
                  >
                    <option value="">No Tax Schedule...</option>
                    {taxTemplates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">TOTAL QTY:</span>
                  <span className="text-sm font-black text-slate-900">{(form.total_qty || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 pt-0.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">SUBTOTAL</span>
                    <span className="text-slate-800 font-bold text-xs">AED {(form.base_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">TAX (5%)</span>
                    <span className="text-slate-600 font-bold text-xs">AED {(form.total_taxes_and_charges || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">GRAND TOTAL</span>
                  <div className="flex items-center gap-1 text-2xl font-black text-[#10b981]">
                    <DirhamIcon size={20} />
                    <span>{(form.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 m-0">
                <User className="text-blue-600" size={18} />
                Create New Customer
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newCustomer.customer_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, customer_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={newCustomer.mobile_no}
                  onChange={(e) => setNewCustomer({ ...newCustomer, mobile_no: e.target.value })}
                  placeholder="e.g. +971 50 123 4567"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCustomer.customer_name.trim()) {
                    return Swal.fire('Error', 'Customer name is required', 'warning');
                  }
                  setSavingCustomer(true);
                  try {
                    const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_customer_retail', {
                      customer_name: newCustomer.customer_name,
                      mobile_no: newCustomer.mobile_no
                    }, { withCredentials: true });

                    const created = res.data?.message;
                    const custName = created?.customer_name || created?.name || newCustomer.customer_name;
                    setForm((prev) => ({
                      ...prev,
                      customer: created?.name || custName,
                      party_name: created?.name || custName,
                      customer_name: custName
                    }));
                    setSearchCustomer(custName);
                    setIsCustomerModalOpen(false);
                    setNewCustomer({ customer_name: '', mobile_no: '' });
                    fetchMetadata();
                    Swal.fire({
                      icon: 'success',
                      title: 'Customer Created',
                      text: custName,
                      timer: 1200,
                      showConfirmButton: false
                    });
                  } catch (err) {
                    Swal.fire('Error', err.response?.data?.message || 'Failed to create customer', 'error');
                  } finally {
                    setSavingCustomer(false);
                  }
                }}
                disabled={savingCustomer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {savingCustomer ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
