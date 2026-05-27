import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Plus, X, Search, Filter, ChevronDown, FileText,
  Loader2, ChevronLeft, ChevronRight, ArrowLeft, Palette
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const SalesInvoiceList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { company: loggedCompany, warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [returnAgainst, setReturnAgainst] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Theme toggle (synced with POS & Sales Order)
  const [siTheme, setSiTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = siTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', siTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [siTheme, themeColor, themeColorHover, themeLight]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [form, setForm] = useState({
    name: '',
    status: 'Draft',
    posting_date: new Date().toISOString().split('T')[0],
    customer: '',
    customer_name: '',
    due_date: '',
    is_pos: false,
    set_warehouse: '',
    update_stock: false,
    is_return: 0,
    return_against: '',
    currency: 'AED',
    selling_price_list: 'Standard Selling',
    update_outstanding_amount_in_self: false,
    update_billed_amount_in_delivery_note: false,
    items: [],
    taxes_and_charges: '',
    taxes: [],
    total_qty: 0,
    base_total: 0,
    total_taxes_and_charges: 0,
    grand_total: 0,
    rounded_total: 0,
    in_words: ''
  });

  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [itemQueries, setItemQueries] = useState({});
  const [activeItemRow, setActiveItemRow] = useState(null);
  const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');

  const company = loggedCompany || '';

  const getCurrencySymbol = (curr = form.currency) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'AED': return 'د.إ';
      case 'USD': return '$';
      default: return 'د.إ';
    }
  };

  const numberToWords = (num) => {
    if (form.currency !== 'INR' || !num) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];
    let rupees = Math.floor(Math.abs(num));
    let paise = Math.round((Math.abs(num) - rupees) * 100);
    const convert = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    };
    let words = '';
    let scaleIndex = 0;
    while (rupees > 0) {
      let part = rupees % 1000;
      if (part !== 0) {
        words = convert(part) + (scaleIndex > 0 ? ' ' + scales[scaleIndex] : '') + (words ? ' ' + words : '');
      }
      rupees = Math.floor(rupees / 1000);
      scaleIndex++;
    }
    return (words.trim() || 'Zero') + ' Rupees' + (paise > 0 ? ' and ' + paise + ' Paise' : '') + ' Only';
  };

  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      const barcode = barcodeInput.trim();

      try {
        // Use safe backend method (bypasses child table permission)
        const checkRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', {
          params: { barcode }
        });

        if (checkRes.data.message.exists) {
          const itemCode = checkRes.data.message.item;

          // Fetch full item details
          const itemRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si', {
            params: { query: itemCode }
          });

          const itemsList = itemRes.data.message || [];
          if (itemsList.length > 0) {
            const item = itemsList[0];

            // Fetch rate
            let rate = 0;
            try {
              const rateRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', {
                params: {
                  item_code: item.item_code,
                  price_list: form.selling_price_list
                }
              });
              rate = rateRes.data.rate || rateRes.data.message?.rate || 0;
            } catch (err) { }

            // Add to table
            setForm(prev => ({
              ...prev,
              items: [...prev.items, {
                item_code: item.item_code,
                item_name: item.item_name,
                qty: 1,
                uom: item.stock_uom || 'Nos',
                rate: rate,
                amount: rate * 1,
                income_account: defaultIncomeAccount
              }]
            }));

            calculateTotals();
            setBarcodeInput('');
            // Focus back
            setTimeout(() => {
              const el = document.getElementById('barcode-scan-input');
              if (el) el.focus();
            }, 100);
          } else {
            alert("Item details not found");
          }
        } else {
          alert("Invalid barcode - No item found");
        }
      } catch (err) {
        console.error(err);
        alert("Error scanning barcode: " + (err.response?.data?.message || err.message));
      }
    }
  };

  useEffect(() => {
    if (!company) return;
    const fetchDefaultIncomeAccount = async () => {
      try {
        const res = await axios.get(`/api/resource/Company/${company}`);
        setDefaultIncomeAccount(res.data.data.default_income_account || '');
      } catch (err) {
        setDefaultIncomeAccount('');
      }
    };
    fetchDefaultIncomeAccount();
  }, [company]);

  // Handle returnData from Delivery Note Return → Credit Note
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnData = params.get('returnData');
    const autoOpen = params.get('autoOpen') === 'true';
    const dnName = params.get('dn');

    if (returnData) {
      try {
        const data = JSON.parse(returnData);
        setIsReturnMode(true);

        setReturnAgainst(data.return_against || '');
        setForm(prev => ({
          ...prev,
          ...data,
          status: 'Draft',
          is_return: 1,
          posting_date: new Date().toISOString().split('T')[0],
          update_billed_amount_in_delivery_note: true,
          return_against: undefined,
          items: data.items.map(i => ({
            ...i,
            qty: Math.abs(i.qty),
            amount: Math.abs(i.amount)
          }))
        }));
        setSearchCustomer(data.customer_name || '');
        if (autoOpen) setShowModal(true);
        navigate('/salesinvoice', { replace: true });
      } catch (e) {
        console.error('Failed to parse return data', e);
      }
    } else if (dnName) {
      const fetchMappedDN = async () => {
        try {
          setLoading(true);
          const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_mapped_doc_retail', {
            params: { from_doctype: 'Delivery Note', to_doctype: 'Sales Invoice', source_name: dnName },
            withCredentials: true
          });
          if (res.data.message?.status === 'success') {
            const mappedData = res.data.message.data;
            setForm(prev => ({
              ...prev,
              ...mappedData,
              name: '', // New draft
              status: 'Draft',
              docstatus: 0,
              posting_date: new Date().toISOString().split('T')[0],
              update_billed_amount_in_delivery_note: true,
              items: (mappedData.items || []).map(i => ({
                ...i,
                amount: (parseFloat(i.qty) * parseFloat(i.rate)).toFixed(2)
              }))
            }));
            setSearchCustomer(mappedData.customer_name || '');
            setShowModal(true);
            setIsViewOnly(false);
          }
        } catch (err) {
          console.error('Failed to map DN', err);
        } finally {
          setLoading(false);
          // Clear param
          navigate('/salesinvoice', { replace: true });
        }
      };
      fetchMappedDN();
    }
  }, [location.search, navigate]);

  // Load master data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [custRes, whRes, taxRes, invRes] = await Promise.all([
          axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_si', { params: { warehouse } }),
          axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_si', { params: { warehouse } }),
          axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si'),
          axios.get('/api/resource/Sales Invoice', {
            params: {
              fields: '["name","customer_name","posting_date","grand_total","status","title","outstanding_amount","currency","is_return"]',
              filters: !isAdmin && warehouse ? JSON.stringify([['set_warehouse', '=', warehouse]]) : undefined,
              limit_page_length: 2000,
              order_by: 'modified desc'
            }
          })
        ]);
        setCustomers(Array.isArray(custRes.data.message) ? custRes.data.message : []);
        setWarehouses(Array.isArray(whRes.data.message) ? whRes.data.message : []);
        setTaxTemplates(Array.isArray(taxRes.data.message) ? taxRes.data.message : []);
        setInvoices(Array.isArray(invRes.data.data) ? invRes.data.data : []);
        setFilteredInvoices(Array.isArray(invRes.data.data) ? invRes.data.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filtering logic
  useEffect(() => {
    let filtered = invoices;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.name?.toLowerCase().includes(term) ||
        inv.customer_name?.toLowerCase().includes(term) ||
        inv.title?.toLowerCase().includes(term)
      );
    }
    if (titleFilter) filtered = filtered.filter(inv => (inv.title || '').toLowerCase().includes(titleFilter.toLowerCase()));
    if (customerFilter) filtered = filtered.filter(inv => inv.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
    if (statusFilter !== 'all') filtered = filtered.filter(inv => inv.status === statusFilter);
    if (minAmount || maxAmount) {
      filtered = filtered.filter(inv => {
        const amount = Math.abs(Number(inv.grand_total || 0));
        if (minAmount && amount < Number(minAmount)) return false;
        if (maxAmount && amount > Number(maxAmount)) return false;
        return true;
      });
    }
    setFilteredInvoices(filtered);
    setCurrentPage(1);
  }, [searchTerm, titleFilter, customerFilter, statusFilter, minAmount, maxAmount, invoices]);


  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Submitted': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Totals calculation
  const calculateTotals = () => {
    const items = form.items || [];
    const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const taxTotal = form.taxes.reduce((s, t) => s + (netTotal * (parseFloat(t.rate) || 0) / 100), 0);
    const grand = netTotal + taxTotal;
    const rounded = Math.round(grand);
    setForm(prev => ({
      ...prev,
      total_qty: totalQty,
      base_total: netTotal,
      total_taxes_and_charges: taxTotal,
      grand_total: grand,
      rounded_total: rounded,
      in_words: numberToWords(rounded)
    }));
  };

  useEffect(() => calculateTotals(), [form.items, form.taxes]);

  const searchItems = async (query) => {
    if (!query || query.trim().length < 2) return;
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si', { params: { query } });
      setAllItems(res.data.message || []);
    } catch (err) { }
  };

  const applyTaxTemplate = async (template) => {
    if (!template) {
      setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
      calculateTotals();
      return;
    }
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si', { params: { template } });
      setForm(prev => ({ ...prev, taxes: res.data.message || [], taxes_and_charges: template }));
      calculateTotals();
    } catch (err) { }
  };

  const addItemRow = () => {
    // 1. Safety check for Return Mode
    if (isReturnMode) return;

    // 2. ഈ ഭാഗം നമ്മൾ ലളിതമാക്കുന്നു (നിബന്ധനകൾ ഒഴിവാക്കി)
    const newItem = {
      row_id: Date.now() + Math.random(), // കൂടുതൽ സുരക്ഷിതമായ ID
      item_code: '',
      item_name: '',
      qty: 1,
      uom: 'Nos',
      rate: 0,
      amount: 0,
      income_account: defaultIncomeAccount || ''
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));


    setTimeout(() => {
      const body = document.querySelector('.so-modal-body');
      if (body) {
        body.scrollTo({
          top: body.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 50);
  };

  const selectItem = async (idx, item) => {
    if (isReturnMode) return;
    const items = [...form.items];
    items[idx] = {
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.stock_uom || 'Nos',
      qty: items[idx].qty || 1,
      rate: 0,
      amount: 0
    };
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', {
        params: {
          item_code: item.item_code,
          price_list: form.selling_price_list
        }
      });
      items[idx].rate = res.data.message?.rate || 0;
    } catch (e) {
      console.error(e);
    }
    items[idx].amount = items[idx].qty * items[idx].rate;
    setForm(prev => ({ ...prev, items }));
    setItemQueries(prev => ({ ...prev, [idx]: '' }));
    setActiveItemRow(null);
    setDropdownPosition(null);
    calculateTotals();
  };


  const updateItem = (i, field, value) => {
    if (isReturnMode && (field === 'qty' || field === 'rate')) return;
    const items = [...form.items];
    items[i][field] = value;
    if (field === 'qty' || field === 'rate') {
      items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
    }
    setForm(prev => ({ ...prev, items }));
    calculateTotals();
  };

  const resetForm = () => {
    setForm({
      name: '',
      status: 'Draft',
      posting_date: new Date().toISOString().split('T')[0],
      customer: '',
      customer_name: '',
      due_date: '',
      is_pos: false,
      set_warehouse: '',
      update_stock: false,
      is_return: 0,
      return_against: '',
      currency: 'AED',
      selling_price_list: 'Standard Selling',
      update_outstanding_amount_in_self: false,
      update_billed_amount_in_delivery_note: false,
      items: [],
      taxes_and_charges: '',
      taxes: [],
      total_qty: 0,
      base_total: 0,
      total_taxes_and_charges: 0,
      grand_total: 0,
      rounded_total: 0,
      in_words: ''
    });
    setIsReturnMode(false);
    setReturnAgainst(null);
    setSearchCustomer('');
    setItemQueries({});
    setActiveItemRow(null);
    setDropdownPosition(null);
  };

  const createSalesInvoice = async (submit = false) => {
    if (!form.customer || form.items.length === 0 || form.items.some(i => !i.item_code)) {
      alert("Please fill required fields and items");
      return;
    }
    setSaving(true);

    const payload = {
      posting_date: form.posting_date,
      customer: form.customer,
      due_date: form.due_date || form.posting_date,
      is_return: form.is_return ? 1 : 0,
      ...(form.is_return && returnAgainst && returnAgainst.startsWith('ACC-SINV') ? { return_against: returnAgainst } : {}),
      currency: form.currency,
      selling_price_list: form.selling_price_list,
      update_billed_amount_in_delivery_note: form.update_billed_amount_in_delivery_note ? 1 : 0,
      items: form.items.map(i => ({
        item_code: i.item_code,
        qty: form.is_return ? -Math.abs(i.qty) : i.qty,
        rate: i.rate,
        amount: form.is_return ? -Math.abs(i.amount) : i.amount,
        uom: i.uom,
        income_account: i.income_account || defaultIncomeAccount
      })),
      taxes_and_charges: form.taxes_and_charges || undefined,
      taxes: form.taxes
    };

    try {
      let invoiceName = form.name;

      // Save draft first
      if (form.name) {
        await axios.put(`/api/resource/Sales Invoice/${form.name}`, payload);
      } else {
        const res = await axios.post('/api/resource/Sales Invoice', payload);
        invoiceName = res.data.data.name;
        setForm(prev => ({ ...prev, name: invoiceName }));
      }

      if (submit) {
        // Reload latest doc before submit
        const latestDocRes = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
        const latestDoc = latestDocRes.data.data;

        // Submit
        await axios.post('/api/method/frappe.client.submit', {
          doc: JSON.stringify({
            ...latestDoc,
            doctype: 'Sales Invoice',
            name: invoiceName
          })
        });

        // === NEW FIX: DN Return aanengil original DN status "Completed" aakkum ===
        if (isReturnMode && returnAgainst && !returnAgainst.startsWith('ACC-SINV')) {
          // returnAgainst = original DN name (e.g., MAT-DN-XXXX)
          try {
            await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.update_dn_status_on_credit_note', {
              original_dn_name: returnAgainst  // Pass original DN to find Return DN
            });
          } catch (e) {
            console.warn("Failed to update Return DN status to Completed", e);
          }
        }
        // Direct SI return aanengil mark original SI
        if (form.is_return && returnAgainst && returnAgainst.startsWith('ACC-SINV')) {
          await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.mark_si_credit_note_issued', {
            original_si_name: returnAgainst
          });
        }
      }

      // Refresh list
      const invRes = await axios.get('/api/resource/Sales Invoice', {
        params: {
          fields: '["name","customer_name","posting_date","grand_total","status","title","outstanding_amount","currency","is_return"]',
          filters: !isAdmin && warehouse ? JSON.stringify([['set_warehouse', '=', warehouse]]) : undefined,
          limit_page_length: 2000,
          order_by: 'modified desc'
        }
      });
      setInvoices(invRes.data.data || []);
      setFilteredInvoices(invRes.data.data || []);

      alert(submit ? (isReturnMode ? "Credit Note Submitted!" : "Invoice Submitted!") : "Saved as Draft");

      if (submit) {
        setShowModal(false);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Failed";
      alert("Error: " + msg);
      if (msg.includes("modified after you have opened it")) {
        alert("Document modified by someone else. Refresh and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const loadInvoiceForEdit = async (invoiceName) => {
    try {
      const res = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
      const inv = res.data.data;
      setIsReturnMode(inv.is_return === 1);
      setReturnAgainst(inv.return_against || null);
      setForm({
        name: inv.name,
        status: inv.status || 'Draft',
        posting_date: inv.posting_date,
        customer: inv.customer,
        customer_name: inv.customer_name,
        due_date: inv.due_date || '',
        is_pos: inv.is_pos === 1,
        set_warehouse: inv.set_warehouse || '',
        update_stock: inv.update_stock === 1,
        is_return: inv.is_return ? 1 : 0,
        return_against: inv.return_against || '',
        currency: inv.currency || 'AED',
        selling_price_list: inv.selling_price_list || 'Standard Selling',
        update_outstanding_amount_in_self: inv.update_outstanding_amount_in_self === 1,
        update_billed_amount_in_delivery_note: inv.update_billed_amount_in_delivery_note === 1,
        payments: inv.payments || [],
        outstanding_amount: inv.outstanding_amount || 0,
        paid_amount: inv.paid_amount || 0,
        items: inv.items.map(i => ({
          item_code: i.item_code,
          item_name: i.item_name,
          qty: inv.is_return ? Math.abs(i.qty) : i.qty,
          rate: i.rate,
          amount: Math.abs(i.amount),
          uom: i.uom || 'Nos',
          conversion_factor: i.conversion_factor || 1,
          base_rate: i.base_rate || i.rate,
          base_amount: i.base_amount || Math.abs(i.amount),
          income_account: i.income_account || defaultIncomeAccount
        })),
        taxes_and_charges: inv.taxes_and_charges || '',
        taxes: inv.taxes || [],
        total_qty: 0,
        base_total: 0,
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounded_total: 0,
        in_words: ''
      });
      setSearchCustomer(inv.customer_name || '');
      setIsViewOnly(true);
      setShowModal(true);
      calculateTotals();
    } catch (err) {
      alert("Error loading invoice for edit");
      console.error(err);
    }
  };

  const loadForReturn = async (invoiceName) => {
    try {
      const res = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
      const inv = res.data.data;
      setIsReturnMode(true);
      setReturnAgainst(inv.name);
      setForm({
        name: '',
        status: 'Draft',
        posting_date: new Date().toISOString().split('T')[0],
        customer: inv.customer,
        customer_name: inv.customer_name,
        due_date: inv.due_date || '',
        is_return: 1,
        return_against: inv.name,
        currency: inv.currency || 'AED',
        selling_price_list: inv.selling_price_list || 'Standard Selling',
        update_outstanding_amount_in_self: true,
        update_billed_amount_in_delivery_note: true, // Always true for direct SI return
        items: inv.items.map(i => ({
          item_code: i.item_code,
          item_name: i.item_name,
          qty: Math.abs(i.qty),
          rate: i.rate,
          amount: Math.abs(i.amount),
          uom: i.uom || 'Nos'
        })),
        taxes_and_charges: inv.taxes_and_charges || '',
        taxes: inv.taxes || []
      });
      setSearchCustomer(inv.customer_name || '');
      setShowModal(true);
      calculateTotals();
    } catch (err) {
      alert("Error loading for return");
    }
  };

  const filteredCustomers = useMemo(() => customers.filter(c =>
    c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchCustomer.toLowerCase())
  ).slice(0, 10), [searchCustomer, customers]);

  const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const canSubmit = !form.name || form.status !== 'Submitted';

  return (
    <>
      <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <FileText size={20} /> Sales Invoice
            </h1>
            <p className="so-page-subtitle">Manage and track all invoices</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setSiTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {siTheme.toUpperCase()}
            </button>
            <button
              className="so-btn-primary"
              onClick={() => navigate('/homepage')}
            >
              <Plus size={16} /> Create Invoice
            </button>
          </div>
        </div>





        <div className="so-layout" style={{ flexDirection: 'column' }}>
          {/* Top Filters Bar */}
          <div className="so-filter-bar" style={{
            background: 'white',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end'
          }}>
            <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
              <label className="so-filter-label">Search</label>
              <input className="so-filter-input" placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
              <label className="so-filter-label">Title</label>
              <input className="so-filter-input" placeholder="e.g., Cash" value={titleFilter} onChange={e => setTitleFilter(e.target.value)} />
            </div>

            <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
              <label className="so-filter-label">Customer</label>
              <input className="so-filter-input" placeholder="Customer name..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} />
            </div>

            <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
              <label className="so-filter-label">Status</label>
              <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.5rem' }}>
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            <div className="so-filter-group" style={{ minWidth: '140px', flex: 1 }}>
              <label className="so-filter-label">Amount Range</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
            </div>

            <button className="so-clear-btn" style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1rem' }} onClick={() => { setSearchTerm(''); setTitleFilter(''); setCustomerFilter(''); setStatusFilter('all'); setMinAmount(''); setMaxAmount(''); }}>
              Clear Filters
            </button>
          </div>

          <div className="so-content" style={{ padding: '1.5rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{filteredInvoices.length} record(s) found</p>
            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Grand Total</th>
                      <th>ID</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="so-empty"><Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} /></td></tr>
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan="6" className="so-empty">No invoices found</td></tr>
                    ) : (
                      paginated.map(inv => (
                        <tr key={inv.name} onClick={() => loadInvoiceForEdit(inv.name)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 600 }}>{inv.title || 'Invoice'}</td>
                          <td>
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                              backgroundColor: (inv.status === 'Paid' || inv.status === 'Submitted') ? `${themeColor}20` : (inv.status === 'Draft' ? '#f1f5f9' : (inv.status === 'Unpaid' ? '#fef9c3' : '#fee2e2')),
                              color: (inv.status === 'Paid' || inv.status === 'Submitted') ? themeColor : (inv.status === 'Draft' ? '#64748b' : (inv.status === 'Unpaid' ? '#854d0e' : '#ef4444')),
                              border: `1px solid ${(inv.status === 'Paid' || inv.status === 'Submitted') ? `${themeColor}40` : (inv.status === 'Draft' ? '#e2e8f0' : (inv.status === 'Unpaid' ? '#fde047' : '#fecaca'))}`
                            }}>
                              {inv.status || 'Draft'} {inv.is_return ? '(CN)' : ''}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{inv.customer_name || 'Customer'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {getCurrencySymbol(inv.currency || 'AED')}{inv.is_return ? '-' : ''}{Math.abs(Number(inv.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.name}</td>
                          <td onClick={e => e.stopPropagation()}>
                            {(inv.status === 'Submitted' || inv.status === 'Unpaid') && !inv.is_return && (
                              <button
                                onClick={(e) => { e.stopPropagation(); loadForReturn(inv.name); }}
                                className="so-btn-primary"
                                style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
                              >
                                <ArrowLeft size={10} /> Credit Note
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredInvoices.length > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {Math.min((currentPage - 1) * pageSize + 1, filteredInvoices.length)}–{Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 100, 500].map(num => (
                        <button key={num} onClick={() => { setPageSize(num); setCurrentPage(1); }} className={`so-page-btn ${pageSize === num ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{num}</button>
                      ))}
                    </div>

                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>








        {/* Modal */}
        {/* Modal */}
        {showModal && (


          <div className="so-modal-overlay" onClick={e => e.target === e.currentTarget && (setShowModal(false), resetForm())} style={{ padding: 0, position: 'fixed', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="so-modal" style={{ maxWidth: 'none', width: '100vw', height: '100vh', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

              {/* Header */}
              <div className="so-modal-header" style={{ padding: '1rem 1.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="so-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                  {isReturnMode ? (
                    <><ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem' }} /> Credit Note — Return Against: {returnAgainst}</>
                  ) : (
                    form.name ? `Edit — ${form.name}` : 'New Sales Invoice'
                  )}
                </h2>
                <button className="so-modal-close" onClick={() => { setShowModal(false); resetForm(); }} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#64748b' }}><X size={20} /></button>
              </div>

              {/* Body - Alignment Fix Here */}
              <div className="so-modal-body" style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {isViewOnly ? (
                  /* GORGEOUS SALES INVOICE DETAILS VIEW */
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                    {/* Header Summary Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                      <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Grand Total</span>
                          <h3 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0.25rem 0 0", color: themeColor }}>
                            {getCurrencySymbol()}{form.rounded_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </h3>
                        </div>
                        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: themeLight, display: "flex", alignItems: "center", justifyContent: "center", color: themeColor }}>
                          <FileText size={22} />
                        </div>
                      </div>

                      <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
                          <div style={{ marginTop: "0.4rem" }}>
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                              backgroundColor: (form.status === "Paid" || form.status === "Submitted") ? `${themeColor}20` : (form.status === "Draft" ? "#f1f5f9" : (form.status === "Unpaid" ? "#fef9c3" : "#fee2e2")),
                              color: (form.status === "Paid" || form.status === "Submitted") ? themeColor : (form.status === "Draft" ? "#64748b" : (form.status === "Unpaid" ? "#854d0e" : "#ef4444")),
                              border: `1px solid ${(form.status === "Paid" || form.status === "Submitted") ? `${themeColor}40` : (form.status === "Draft" ? "#e2e8f0" : (form.status === "Unpaid" ? "#fde047" : "#fecaca"))}`
                            }}>
                              {form.status || "Draft"} {form.is_return ? "(CN)" : ""}
                            </span>
                          </div>
                        </div>
                        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          <Palette size={20} />
                        </div>
                      </div>

                      <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Posting Date</span>
                          <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0.25rem 0 0", color: "#1e293b" }}>
                            {form.posting_date}
                          </h3>
                        </div>
                        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          <ChevronRight size={20} />
                        </div>
                      </div>

                      <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Items & Quantity</span>
                          <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0.25rem 0 0", color: "#1e293b" }}>
                            {form.items?.length || 0} Items / {form.items?.reduce((acc, curr) => acc + (curr.qty || 0), 0) || 0} Qty
                          </h3>
                        </div>
                        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          <ChevronLeft size={20} />
                        </div>
                      </div>
                    </div>

                    {/* Customer & System Detail Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
                      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                          Customer details
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Customer Name</span>
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.customer_name || "N/A"}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Customer ID</span>
                            <span style={{ color: "#64748b", fontWeight: 700, fontFamily: "monospace" }}>{form.customer || "N/A"}</span>
                          </div>
                          {form.due_date && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                              <span style={{ color: "#94a3b8", fontWeight: 600 }}>Due Date</span>
                              <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.due_date}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                          System & Options
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.875rem" }}>
                          <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Branch / Warehouse</span>
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.set_warehouse ? form.set_warehouse.split(" - ")[0] : "N/A"}</span>
                          </div>
                          <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Price List</span>
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.selling_price_list || "Standard Selling"}</span>
                          </div>
                          <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>POS Transaction</span>
                            <span style={{
                              color: form.is_pos ? themeColor : "#f59e0b",
                              fontWeight: 800,
                              background: form.is_pos ? `${themeColor}15` : "#f59e0b15",
                              padding: "0.1rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              display: "inline-block"
                            }}>{form.is_pos ? "YES" : "NO"}</span>
                          </div>
                          <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Update Stock</span>
                            <span style={{
                              color: form.update_stock ? themeColor : "#64748b",
                              fontWeight: 800,
                              background: form.update_stock ? `${themeColor}15` : "#64748b15",
                              padding: "0.1rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              display: "inline-block"
                            }}>{form.update_stock ? "YES" : "NO"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Static Items Table */}
                    <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                          Invoice Items
                        </h3>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Item Details</th>
                              <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Qty</th>
                              <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>UOM</th>
                              <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "140px" }}>Rate</th>
                              <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "140px", paddingRight: "1.5rem" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.map((item, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "1rem 1.5rem" }}>
                                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.875rem" }}>{item.item_name}</div>
                                  <div style={{ fontSize: "0.7rem", color: themeColor, fontWeight: 800, marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.item_code}</div>
                                </td>
                                <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#334155" }}>{item.qty}</td>
                                <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: "0.75rem" }}>{item.uom || "-"}</td>
                                <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                                  {getCurrencySymbol()}{item.rate?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 800, color: themeColor, paddingRight: "1.5rem" }}>
                                  {getCurrencySymbol()}{item.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Taxes & Summary Panels */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem", alignItems: "stretch" }}>
                      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                          Taxes & Charges
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, justifyContent: "center" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Tax Template</span>
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.taxes_and_charges || "No Tax Applied"}</span>
                          </div>
                          {form.taxes?.map((t, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: "1px dashed #f1f5f9", paddingTop: "0.5rem" }}>
                              <span style={{ color: "#64748b", fontWeight: 600 }}>{t.account_head || "Tax Account"} ({t.rate || 0}%)</span>
                              <span style={{ color: "#1e293b", fontWeight: 700 }}>{getCurrencySymbol()}{t.tax_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payment Mode & Details */}
                      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                          Payment Details
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, justifyContent: "center" }}>
                          {form.payments && form.payments.some(p => parseFloat(p.amount) > 0) ? (
                            form.payments.filter(p => parseFloat(p.amount) > 0).map((p, idx) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: idx > 0 ? "1px dashed #f1f5f9" : "none", paddingTop: idx > 0 ? "0.5rem" : "0", marginTop: idx > 0 ? "0.5rem" : "0" }}>
                                <span style={{ color: "#64748b", fontWeight: 600 }}>{p.mode_of_payment}</span>
                                <span style={{ color: "#1e293b", fontWeight: 800 }}>{getCurrencySymbol()}{parseFloat(p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))
                          ) : form.outstanding_amount > 0 ? (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                              <span style={{ color: "#ef4444", fontWeight: 700 }}>Credit Amount (Credit Sale)</span>
                              <span style={{ color: "#ef4444", fontWeight: 800 }}>{getCurrencySymbol()}{parseFloat(form.outstanding_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : (
                            <div style={{ color: "#94a3b8", fontSize: "0.875rem", textAlign: "center" }}>No payment details recorded</div>
                          )}

                          {form.outstanding_amount > 0 && form.payments && form.payments.some(p => parseFloat(p.amount) > 0) && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: "1px dashed #ef4444", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
                              <span style={{ color: "#ef4444", fontWeight: 700 }}>Outstanding Balance (Credit)</span>
                              <span style={{ color: "#ef4444", fontWeight: 800 }}>{getCurrencySymbol()}{parseFloat(form.outstanding_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: "2px solid #e2e8f0", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
                            <span style={{ color: "#475569", fontWeight: 800 }}>Total Paid Amount</span>
                            <span style={{ color: themeColor, fontWeight: 900 }}>{getCurrencySymbol()}{parseFloat(form.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderRadius: "0.75rem", background: isGreen ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)" : "linear-gradient(135deg, #0c4a6e 0%, #075985 100%)", color: "white", padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
                        <p style={{ color: "white", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem", marginBottom: "1rem", fontWeight: 800, textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Final Summary</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9, fontSize: "0.875rem" }}>
                            <span>Subtotal</span>
                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.base_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9, fontSize: "0.875rem" }}>
                            <span>Taxes</span>
                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.total_taxes_and_charges?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "1rem", fontWeight: 700 }}>Grand Total</span>
                            <span style={{ fontSize: "1.8rem", fontWeight: 900 }}>{getCurrencySymbol()}{form.rounded_total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* PREMIUM SALES INVOICE EDIT FORM */
                  <>
                    {/* Basic Info Card */}
                    <div className="so-card" style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div className="so-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                        <p className="so-card-title" style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Basic Information</p>
                      </div>
                      <div className="so-card-body" style={{ padding: '1.25rem' }}>
                        <div className="so-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                          <div className="so-field">
                            <label className="so-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Posting Date <span style={{ color: 'red' }}>*</span></label>
                            <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="so-input" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                          </div>
                          <div className="so-field">
                            <label className="so-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Customer <span style={{ color: 'red' }}>*</span></label>
                            <div className="relative">
                              <input
                                type="text"
                                value={searchCustomer}
                                onChange={e => setSearchCustomer(e.target.value)}
                                onFocus={() => setShowCustomerDropdown(true)}
                                placeholder="Search customer..."
                                className="so-input"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                              />
                              {showCustomerDropdown && filteredCustomers.length > 0 && (
                                <div className="so-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', zIndex: 50, border: '1px solid #e2e8f0', borderRadius: '0.375rem', marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                  {filteredCustomers.map(c => (
                                    <div key={c.name} onClick={() => { setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name })); setSearchCustomer(c.customer_name); setShowCustomerDropdown(false); }} className="so-dropdown-item" style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                                      <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{c.name}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="so-field">
                            <label className="so-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Due Date</label>
                            <input type="date" value={form.due_date} onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))} className="so-input" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                          </div>
                          <div className="so-field">
                            <label className="so-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Branch</label>
                            <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="so-select" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}>
                              <option value="">Select Branch</option>
                              {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem', padding: '0.25rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                            <input type="checkbox" checked={form.is_pos} onChange={e => setForm(prev => ({ ...prev, is_pos: e.target.checked }))} style={{ width: '18px', height: '18px' }} /> Is POS
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                            <input type="checkbox" checked={form.update_stock} onChange={e => setForm(prev => ({ ...prev, update_stock: e.target.checked }))} style={{ width: '18px', height: '18px' }} /> Update Stock
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Area */}
                    <div className="so-card" style={{ background: isGreen ? '#f0fdf4' : '#f0f9ff', border: `2px dashed ${themeColor}`, borderRadius: '0.75rem' }}>
                      <div className="so-card-body" style={{ padding: '1.25rem' }}>
                        <div className="so-barcode-area" style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', gap: '1rem' }}>
                          <Search size={20} style={{ color: themeColor }} />
                          <input
                            id="barcode-scan-input"
                            type="text"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            onKeyDown={handleBarcodeScan}
                            placeholder="Scan or type barcode and press Enter..."
                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <p className="so-card-title">Items Information</p>
                        {!isReturnMode && (
                          <button
                            onClick={addItemRow}
                            className="so-btn-ghost"
                            style={{ fontSize: '0.7rem', color: 'var(--so-primary)' }}
                          >
                            <Plus size={14} /> Add New Row
                          </button>
                        )}
                      </div>
                      <div className="so-card-body" style={{ padding: 0 }}>
                        <div className="so-table-wrapper" style={{ boxShadow: 'none', borderRadius: 0, border: 'none' }}>
                          <table className="so-items-table">
                            <thead>
                              <tr>
                                <th style={{ paddingLeft: '1.5rem' }}>Item Details</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>UOM</th>
                                <th style={{ width: '140px', textAlign: 'right' }}>Rate</th>
                                <th style={{ width: '140px', textAlign: 'right', paddingRight: '1.5rem' }}>Amount</th>
                                <th style={{ width: '50px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.items.map((item, i) => (
                                <tr key={i}>
                                  <td style={{ paddingLeft: '1.5rem' }}>
                                    <div style={{ position: 'relative' }}>
                                      {!isReturnMode ? (
                                        <>
                                          <input
                                            type="text"
                                            value={itemQueries[i] || ''}
                                            onChange={(e) => {
                                              const q = e.target.value;
                                              setItemQueries(prev => ({ ...prev, [i]: q }));
                                              if (q.length >= 2) searchItems(q);
                                            }}
                                            onFocus={(e) => {
                                              const input = e.target;
                                              const rect = input.getBoundingClientRect();
                                              setDropdownPosition({
                                                top: rect.bottom + window.scrollY + 8,
                                                left: rect.left + window.scrollX,
                                                width: rect.width
                                              });
                                              setActiveItemRow(i);
                                            }}
                                            placeholder="Search item..."
                                            className="so-input"
                                            style={{ height: '36px', fontSize: '0.85rem', fontWeight: 600 }}
                                          />
                                          {activeItemRow === i && dropdownPosition && itemQueries[i] && allItems.length > 0 && createPortal(
                                            <div
                                              className="so-dropdown"
                                              style={{
                                                position: 'fixed',
                                                top: dropdownPosition.top + 'px',
                                                left: dropdownPosition.left + 'px',
                                                width: dropdownPosition.width + 'px',
                                                zIndex: 9999
                                              }}
                                            >
                                              {allItems
                                                .filter(it =>
                                                  it.item_name?.toLowerCase().includes((itemQueries[i] || '').toLowerCase()) ||
                                                  it.item_code?.toLowerCase().includes((itemQueries[i] || '').toLowerCase())
                                                )
                                                .slice(0, 20)
                                                .map(it => (
                                                  <div
                                                    key={it.item_code}
                                                    onClick={() => {
                                                      selectItem(i, it);
                                                      setDropdownPosition(null);
                                                    }}
                                                    className="so-dropdown-item"
                                                  >
                                                    <div style={{ fontWeight: 700 }}>{it.item_name}</div>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{it.item_code}</div>
                                                  </div>
                                                ))}
                                            </div>,
                                            document.body
                                          )}
                                        </>
                                      ) : (
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.item_name}</div>
                                      )}
                                      {item.item_name && (
                                        <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--so-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.item_code}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      value={item.qty || ''}
                                      onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                                      className="so-input"
                                      style={{ textAlign: 'center', height: '36px', fontWeight: 700 }}
                                      disabled={isReturnMode}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--so-text-muted)' }}>{item.uom || '-'}</td>
                                  <td>
                                    <input
                                      type="number"
                                      value={item.rate || ''}
                                      onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
                                      className="so-input"
                                      style={{ textAlign: 'right', height: '36px', fontWeight: 700 }}
                                      step="0.01"
                                      disabled={isReturnMode}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', paddingRight: '1.5rem', color: 'var(--so-primary)' }}>
                                    {getCurrencySymbol(form.currency)}{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {!isReturnMode && (
                                      <button
                                        onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))}
                                        className="so-btn-danger"
                                        style={{ padding: '0.25rem', borderRadius: '0.4rem' }}
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Taxes & Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
                      {/* Taxes Card */}
                      <div className="so-card" style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                        <div className="so-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                          <p className="so-card-title" style={{ margin: 0, fontWeight: 700 }}>Taxes & Charges</p>
                        </div>
                        <div className="so-card-body" style={{ padding: '1.25rem' }}>
                          <label className="so-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Tax Template</label>
                          <select value={form.taxes_and_charges} onChange={e => applyTaxTemplate(e.target.value)} className="so-select" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}>
                            <option value="">No Tax</option>
                            {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Summary Card */}
                      <div className="so-card" style={{ borderRadius: '0.75rem', background: isGreen ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' : 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)', color: 'white', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p className="so-card-title" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>Final Summary</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                            <span>Subtotal</span>
                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.base_total.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                            <span>Taxes</span>
                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.total_taxes_and_charges.toLocaleString()}</span>
                          </div>
                          <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1rem' }}>Grand Total</span>
                            <span style={{ fontSize: '2rem', fontWeight: 900 }}>{getCurrencySymbol()}{form.rounded_total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="so-modal-footer">
                <button className="so-btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Close
                </button>

                <div style={{ display: 'flex', gap: '0.75rem' }}>

                  {isViewOnly ? (
                    <>
                      <button
                        className="so-btn-secondary"
                        onClick={() => window.print()}
                        style={{ background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600 }}
                      >
                        Print Invoice
                      </button>
                      <button
                        className="so-btn-primary"
                        onClick={() => setIsViewOnly(false)}
                        style={{ minWidth: '120px', backgroundColor: themeColor }}
                      >
                        Edit Invoice
                      </button>
                    </>
                  ) : (

                    <>
                      <button className="so-btn-secondary" onClick={() => createSalesInvoice(false)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Draft'}
                      </button>
                      <button className="so-btn-primary" onClick={() => createSalesInvoice(true)} disabled={saving}>
                        {saving ? 'Submitting...' : 'Submit Invoice'}
                      </button>
                    </>
                  )}
                </div>
              </div>            </div>
          </div>
        )}




      </div>
    </>
  );
};

export default SalesInvoiceList;