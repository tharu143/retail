import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Plus, X, Search, Filter, ChevronDown, FileText,
  Loader2, ChevronLeft, ChevronRight, ArrowLeft, Palette, Truck,
  Zap, Link as LinkIcon
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import AttachmentSection from './AttachmentSection';
import ListCustomizer from './ListCustomizer';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

const SalesInvoiceList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const { company: loggedCompany, warehouse, user_roles, user } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Sales Invoice');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
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
  const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
  const [titleFilter, setTitleFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [form, setForm] = useState({
    name: '',
    status: 'Draft',
    posting_date: new Date().toISOString().split('T')[0],
    posting_time: '',
    discount_amount: 0,
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

  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createDropdownRef = useRef(null);
  const [linkedDocs, setLinkedDocs] = useState({});
  const [loadingLinks, setLoadingLinks] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) {
        setShowCreateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToDoc = (doctype, docname) => {
    const routes = {
      'Sales Order': (id) => `/salesorder-details/${encodeURIComponent(id)}`,
      'Delivery Note': (id) => `/deliverynote-details/${encodeURIComponent(id)}`,
      'Sales Invoice': (id) => `/salesinvoice?invoice=${encodeURIComponent(id)}`,
    };
    const getRoute = routes[doctype];
    if (getRoute) {
      if (doctype === 'Sales Invoice') {
        setShowCreateDropdown(false);
        loadInvoiceForEdit(docname);
      } else {
        setShowModal(false);
        resetForm();
        navigate(getRoute(docname));
      }
    }
  };

  const fetchLinkedDocuments = async (invoiceName) => {
    if (!invoiceName) return;
    setLoadingLinks(true);
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', {
        params: { doctype: 'Sales Invoice', name: invoiceName },
        withCredentials: true
      });
      if (res.data.message?.success || res.data.message?.status === 'success') {
        const payload = res.data.message.data || res.data.message;
        const categories = payload.categories || {};

        const flatDocs = {};
        Object.values(categories).forEach(cat => {
          if (cat && typeof cat === 'object') {
            Object.entries(cat).forEach(([dt, rows]) => {
              if (rows && rows.length > 0) {
                flatDocs[dt] = rows;
              }
            });
          }
        });

        setLinkedDocs(flatDocs);
      }
    } catch (err) {
      console.error('Failed to fetch linked documents', err);
    } finally {
      setLoadingLinks(false);
    }
  };


  const getCurrencySymbol = (curr = form.currency) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'AED': return <DirhamIcon size={12} className="inline mr-1" />;
      case 'USD': return '$';
      default: return <DirhamIcon size={12} className="inline mr-1" />;
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
        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_info_dn');
        const companies = res.data.message || [];
        const currentCompany = companies.find(c => c.name === company);
        setDefaultIncomeAccount(currentCompany?.default_income_account || '');
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
            const mappedItems = (mappedData.items || []).map(i => {
              const isBox = (i.uom || '').toLowerCase() === 'box';
              const pPerBox = parseFloat(i.custom_pieces_per_box || 1);
              return {
                ...i,
                amount: (parseFloat(i.qty) * parseFloat(i.rate)).toFixed(2),
                custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
                custom_box_qty: parseFloat(parseFloat(i.custom_box_qty || 0).toFixed(2)) || (isBox ? parseFloat(parseFloat(i.qty || 0).toFixed(2)) : 0),
                custom_pieces_per_box: pPerBox,
                default_pieces_per_box: pPerBox,
                custom_box_price: parseFloat(parseFloat(i.custom_box_price || 0).toFixed(2)) || (isBox ? parseFloat(parseFloat(i.rate || 0).toFixed(2)) * pPerBox : 0),
                custom_selling_price: parseFloat(parseFloat(i.custom_selling_price || 0).toFixed(2)),
                use_box_entry: isBox,
                uom_list: [],
                delivery_note: dnName,
                dn_detail: i.dn_detail || i.name || '',
              };
            });

            setForm(prev => ({
              ...prev,
              ...mappedData,
              name: '', // New draft
              status: 'Draft',
              docstatus: 0,
              posting_date: new Date().toISOString().split('T')[0],
              update_billed_amount_in_delivery_note: true,
              items: mappedItems
            }));
            setSearchCustomer(mappedData.customer_name || '');
            
            // Async fetch UOM lists
            mappedItems.forEach((item, idx) => {
              fetchItemUOMs(item.item_code).then(fetchedUoms => {
                setForm(p => {
                  const its = [...p.items];
                  if (its[idx]) {
                    its[idx] = { ...its[idx], uom_list: fetchedUoms };
                  }
                  return { ...p, items: its };
                });
              });
            });

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
    } else if (params.get('invoice')) {
      const invoiceName = params.get('invoice');
      loadInvoiceForEdit(invoiceName);
      navigate('/salesinvoice', { replace: true });
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
              fields: JSON.stringify([
                "name", "customer_name", "posting_date", "grand_total",
                "status", "title", "outstanding_amount", "currency", "is_return",
                ...customColumns
              ]),
              filters: !isAdmin && warehouse ? JSON.stringify([['Sales Invoice Item', 'warehouse', '=', warehouse]]) : undefined,
              limit_page_length: 2000,
              order_by: '`tabSales Invoice`.modified desc'
            }
          })
        ]);
        setCustomers(Array.isArray(custRes.data.message) ? custRes.data.message : []);
        setWarehouses(Array.isArray(whRes.data.message) ? whRes.data.message : []);
        setTaxTemplates(Array.isArray(taxRes.data.message) ? taxRes.data.message : []);
        const deduplicateInvoices = (list) => {
          if (!list || !Array.isArray(list)) return [];
          const seen = new Set();
          return list.filter(item => {
            if (!item.name || seen.has(item.name)) return false;
            seen.add(item.name);
            return true;
          });
        };
        const deduped = deduplicateInvoices(invRes.data.data);
        setInvoices(deduped);
        setFilteredInvoices(deduped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [customColumns]);

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
    if (dateStart) {
      filtered = filtered.filter(inv => inv.posting_date >= dateStart);
    }
    if (dateEnd) {
      filtered = filtered.filter(inv => inv.posting_date <= dateEnd);
    }
    setFilteredInvoices(filtered);
    setCurrentPage(1);
  }, [searchTerm, titleFilter, customerFilter, statusFilter, minAmount, maxAmount, dateStart, dateEnd, invoices]);


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
      let rows = res.data.message || [];
      if (rows.length === 0 && template) {
        let rate = 0; let account = "";
        if (template.includes("5%")) { rate = 5; account = "VAT 5% - NS"; }
        else if (template.includes("Zero")) { rate = 0; account = "VAT Zero - NS"; }
        else if (template.includes("Exempted")) { rate = 0; account = "VAT Exempted - NS"; }
        else if (template.includes("50%")) { rate = 50; account = "Excise 50% - NS"; }
        else if (template.includes("100%")) { rate = 100; account = "Excise 100% - NS"; }
        if (account) {
          rows = [{ charge_type: "On Net Total", account_head: account, description: account, rate: rate, add_deduct_tax: "Add", tax_amount: 0, total: 0 }];
        }
      }
      setForm(prev => ({ ...prev, taxes: rows, taxes_and_charges: template }));
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
      income_account: defaultIncomeAccount || '',
      custom_pieces_per_box: 1,
      default_pieces_per_box: 1,
      custom_box_qty: 1,
      custom_box_price: 0,
      custom_ref_sl_no: '',
      use_box_entry: false,
      uom_list: []
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
    const isBox = (item.stock_uom || '').toLowerCase() === 'box' || (item.uom || '').toLowerCase() === 'box';
    const pPerBox = parseFloat(item.custom_pieces_per_box || 1);

    items[idx] = {
      ...items[idx],
      item_code: item.item_code,
      item_name: item.item_name,
      stock_uom: item.stock_uom || 'Nos',
      uom: item.stock_uom || 'Nos',
      uom_list: [],
      use_box_entry: isBox,
      qty: 1,
      rate: 0,
      amount: 0,
      custom_pieces_per_box: 1,
      default_pieces_per_box: pPerBox,
      custom_box_qty: 1,
      custom_box_price: 0,
      custom_selling_price: parseFloat(item.selling_price || 0),
      custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
      is_tax_inclusive: true
    };
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', {
        params: {
          item_code: item.item_code,
          price_list: form.selling_price_list
        }
      });
      const rate = res.data.message?.rate || 0;
      items[idx].rate = rate;
      items[idx].amount = items[idx].qty * rate;
      items[idx].custom_box_price = isBox ? rate * pPerBox : rate;
    } catch (e) {
      console.error(e);
    }
    setForm(prev => ({ ...prev, items }));
    setItemQueries(prev => ({ ...prev, [idx]: '' }));
    setActiveItemRow(null);
    setDropdownPosition(null);

    // Async fetch UOMs
    fetchItemUOMs(item.item_code).then(fetchedUoms => {
      setForm(p => {
        const its = [...p.items];
        const ri = its.findIndex(i => i.item_code === item.item_code);
        if (ri !== -1) its[ri] = { ...its[ri], uom_list: fetchedUoms };
        return { ...p, items: its };
      });
    });

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

  const handleUOMChangeDetails = (uomValue, rowIndex) => {
    setForm(prev => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      const isBox = uomValue.toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((item.rate || 0) * pPerBox).toFixed(2));
      } else {
        item.custom_pieces_per_box = 1;
        item.qty = parseFloat(item.custom_box_qty) || 0;
        item.custom_box_price = item.rate || 0;
      }
      item.amount = (item.qty || 0) * (item.rate || 0);
      items[rowIndex] = item;
      return { ...prev, items };
    });
  };

  const handleInputChangeDetails = (e, rowIndex) => {
    const { name, value } = e.target;
    setForm(prev => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      item[name] = value;

      const val = (value === '' || value === '.') ? 0 : parseFloat(value);
      const isBoxMode = item.use_box_entry;

      if (name === 'qty' || name === 'rate') {
        const q = name === 'qty' ? val : (parseFloat(item.qty) || 0);
        const r = name === 'rate' ? val : (parseFloat(item.rate) || 0);
        item.amount = parseFloat((q * r).toFixed(2));

        if (name === 'rate') {
          item.custom_box_price = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
        } else if (name === 'qty') {
          item.custom_box_qty = (item.custom_pieces_per_box > 0) ? parseFloat((val / item.custom_pieces_per_box).toFixed(2)) : 0;
        }
      } else if (name === 'custom_box_qty') {
        if (isBoxMode) {
          item.qty = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
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
        item.rate = parseFloat((val / (item.custom_pieces_per_box || 1)).toFixed(2));
        item.amount = parseFloat(((parseFloat(item.qty) || 0) * item.rate).toFixed(2));
      }

      items[rowIndex] = item;
      return { ...prev, items };
    });
  };

  const fetchItemUOMs = async (item_code) => {
    try {
      const res = await axios.get(`/api/resource/Item/${encodeURIComponent(item_code)}`, {
        params: { fields: '["uoms","stock_uom"]' }
      });
      const doc = res.data.data || {};
      const uomRows = doc.uoms || [];
      const list = uomRows.map(u => ({ uom: u.uom, conversion_factor: parseFloat(u.conversion_factor) || 1 }));

      const stockUom = doc.stock_uom || 'Nos';
      if (!list.find(u => u.uom === stockUom)) {
        list.unshift({ uom: stockUom, conversion_factor: 1 });
      }

      if (!list.find(u => (u.uom || '').toLowerCase() === "nos")) {
        list.push({ uom: "Nos", conversion_factor: 1 });
      }

      if (!list.find(u => (u.uom || '').toLowerCase() === "box")) {
        list.push({ uom: "Box", conversion_factor: 0 });
      }
      return list;
    } catch (err) {
      return [{ uom: 'Nos', conversion_factor: 1 }, { uom: 'Box', conversion_factor: 0 }];
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      status: 'Draft',
      posting_date: new Date().toISOString().split('T')[0],
      posting_time: '',
      discount_amount: 0,
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
    setLinkedDocs({});
    setShowCreateDropdown(false);
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
        income_account: i.income_account || defaultIncomeAccount,
        conversion_factor: i.use_box_entry ? i.custom_pieces_per_box : (i.conversion_factor || 1.0),
        // Preserve delivery note link
        delivery_note: i.delivery_note || undefined,
        dn_detail: i.dn_detail || undefined,
        // Preserve sales order link
        sales_order: i.sales_order || undefined,
        so_detail: i.so_detail || undefined,
        // Preserve custom fields
        custom_ref_sl_no: i.custom_ref_sl_no || undefined,
        custom_box_qty: i.custom_box_qty || undefined,
        custom_pieces_per_box: i.custom_pieces_per_box || undefined,
        custom_box_price: i.custom_box_price || undefined,
        custom_selling_price: i.custom_selling_price || undefined,
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
          fields: JSON.stringify([
            "name", "customer_name", "posting_date", "grand_total",
            "status", "title", "outstanding_amount", "currency", "is_return",
            ...customColumns
          ]),
          filters: !isAdmin && warehouse ? JSON.stringify([['Sales Invoice Item', 'warehouse', '=', warehouse]]) : undefined,
          limit_page_length: 2000,
          order_by: '`tabSales Invoice`.modified desc'
        }
      });
      const rawInvoices = invRes.data.data || [];
      const seenNames = new Set();
      const dedupedInvoices = rawInvoices.filter(item => {
        if (!item.name || seenNames.has(item.name)) return false;
        seenNames.add(item.name);
        return true;
      });
      setInvoices(dedupedInvoices);
      setFilteredInvoices(dedupedInvoices);

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

      const loadedItems = inv.items.map(i => {
        const isBox = (i.uom || '').toLowerCase() === 'box';
        const pPerBox = parseFloat(i.custom_pieces_per_box || 1);
        return {
          item_code: i.item_code,
          item_name: i.item_name,
          qty: inv.is_return ? Math.abs(i.qty) : i.qty,
          rate: i.rate,
          amount: Math.abs(i.amount),
          uom: i.uom || 'Nos',
          conversion_factor: i.conversion_factor || 1,
          base_rate: i.base_rate || i.rate,
          base_amount: i.base_amount || Math.abs(i.amount),
          income_account: i.income_account || defaultIncomeAccount,
          delivered_qty: i.delivered_qty || 0,
          custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          custom_box_qty: parseFloat(parseFloat(i.custom_box_qty || 0).toFixed(2)) || (isBox ? parseFloat(parseFloat(i.qty || 0).toFixed(2)) : 0),
          custom_pieces_per_box: pPerBox,
          default_pieces_per_box: pPerBox,
          custom_box_price: parseFloat(parseFloat(i.custom_box_price || 0).toFixed(2)) || (isBox ? parseFloat(parseFloat(i.rate || 0).toFixed(2)) * pPerBox : 0),
          custom_selling_price: parseFloat(parseFloat(i.custom_selling_price || 0).toFixed(2)),
          use_box_entry: isBox,
          uom_list: [],
          delivery_note: i.delivery_note || '',
          dn_detail: i.dn_detail || '',
          sales_order: i.sales_order || '',
          so_detail: i.so_detail || '',
        };
      });

      setForm({
        name: inv.name,
        status: inv.status || 'Draft',
        posting_date: inv.posting_date,
        posting_time: inv.posting_time || '',
        discount_amount: inv.discount_amount || 0,
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
        items: loadedItems,
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

      // Async fetch UOM lists for each item
      loadedItems.forEach((item, idx) => {
        fetchItemUOMs(item.item_code).then(fetchedUoms => {
          setForm(p => {
            const its = [...p.items];
            if (its[idx]) {
              its[idx] = { ...its[idx], uom_list: fetchedUoms };
            }
            return { ...p, items: its };
          });
        });
      });

      setIsViewOnly(inv.status !== 'Draft');
      setShowModal(true);
      calculateTotals();
      fetchLinkedDocuments(invoiceName);
    } catch (err) {
      alert("Error loading invoice for edit");
      console.error(err);
    }
  };

  const handlePrint = (invoiceData) => {
    const cashierName = (user || '').split('@')[0].toUpperCase() || 'CASHIER';
    const companyName = company || loggedCompany || 'KYLE RETAIL';
    const storeAddress = invoiceData.set_warehouse ? invoiceData.set_warehouse.split(" - ")[0] : (warehouse || 'Main Store Address');
    const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.name}&scale=2&height=10`;

    // Calculate total paid and change due
    const totalPaidAmount = (invoiceData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const changeDue = Math.max(0, totalPaidAmount - (parseFloat(invoiceData.grand_total) || 0));

    const htmlContent = `
    <html>
        <head>
            <title>Receipt - ${invoiceData.name}</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { 
                    width: 72mm; margin: 0 auto; padding: 10px 0; 
                    font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; color: #000;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                .header p { margin: 2px 0; font-size: 11px; }
                .info { margin: 10px 0; font-size: 11px; }
                .info-row { display: flex; justify-content: space-between; }
                .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 9px; }
                .items-table td { padding: 4px 0; vertical-align: top; font-size: 9px; }
                .text-right { text-align: right; }
                .totals { margin: 8px 0; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
                .grand-total { font-size: 16px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                .barcode { display: block; margin: 15px auto; width: 100%; max-height: 40px; }
                .footer { font-size: 10px; margin-top: 15px; }
                @media print { body { width: 72mm; margin: 0 auto; } }
            </style>
        </head>
        <body>
            <div class="header center">
                <h2 class="bold">${companyName}</h2>
                <p>${storeAddress}</p>
                <p>Tel: +971 00 000 0000</p>
            </div>
            <div class="divider"></div>
            <div class="info">
                <div class="info-row"><span>CASHIER:</span> <span class="bold">#${cashierName}</span></div>
                <div class="info-row"><span>DATE:</span> <span>${invoiceData.posting_date}</span></div>
                <div class="info-row"><span>TIME:</span> <span>${invoiceData.posting_time || 'N/A'}</span></div>
                <div class="info-row"><span>INV NO:</span> <span class="bold">${invoiceData.name}</span></div>
            </div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 30%; text-align: left; font-size: 9px;">ITEM</th>
                        <th class="text-right" style="width: 10%; font-size: 9px;">QTY</th>
                        <th class="text-center" style="width: 10%; font-size: 9px;">UOM</th>
                        <th class="text-right" style="width: 12%; font-size: 9px;">PRICE</th>
                        <th class="text-center" style="width: 10%; font-size: 9px;">VAT</th>
                        <th class="text-right" style="width: 13%; font-size: 9px;">VAT VAL</th>
                        <th class="text-right" style="width: 15%; font-size: 9px;">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    ${(invoiceData.items || []).map(it => {
                      const qty = parseFloat(it.qty) || 1;
                      const price = parseFloat(it.price || it.rate || it.basePrice || 0);
                      const isInc = it.is_tax_inclusive !== false;
                      const taxRatePercent = 5.0; // Standard VAT rate fallback
                      
                      // Calculate VAT for one unit
                      const vatVal = isInc 
                          ? (price - (price / (1 + (taxRatePercent / 100)))) 
                          : (price * (taxRatePercent / 100));
                          
                      // Calculate total line amount
                      const lineTotal = isInc 
                          ? (qty * price) 
                          : (qty * (price + vatVal));

                      return `
                        <tr>
                            <td style="padding-right: 2px; word-break: break-word; font-size: 9px;">${it.item_name || it.item_code || 'ITEM'}</td>
                            <td class="text-right" style="padding-right: 2px; font-size: 9px;">${qty}</td>
                            <td class="text-center" style="padding-right: 2px; font-size: 9px;">${it.uom || ''}</td>
                            <td class="text-right" style="padding-right: 2px; font-size: 9px;">${price.toFixed(2)}</td>
                            <td class="text-center" style="padding-right: 2px; font-size: 9px;">${isInc ? 'INC' : 'EXC'}</td>
                            <td class="text-right" style="padding-right: 2px; font-size: 9px;">${vatVal.toFixed(2)}</td>
                            <td class="text-right" style="font-size: 9px;">${parseFloat(lineTotal).toFixed(2)}</td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
            <div class="divider"></div>
            <div class="totals">
                <div class="total-row">
                    <span>SUB TOTAL</span>
                    <span>AED ${parseFloat(invoiceData.base_total || invoiceData.subtotal || 0).toFixed(2)}</span>
                </div>
                ${parseFloat(invoiceData.discount_amount || 0) > 0 ? `
                    <div class="total-row">
                        <span>DISCOUNT</span>
                        <span>-AED ${parseFloat(invoiceData.discount_amount).toFixed(2)}</span>
                    </div>
                ` : ''}
                ${parseFloat(invoiceData.total_taxes_and_charges || invoiceData.tax_amount || 0) > 0 ? `
                    <div class="total-row">
                        <span>TAX</span>
                        <span>AED ${parseFloat(invoiceData.total_taxes_and_charges || invoiceData.tax_amount || 0).toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="total-row grand-total bold">
                    <span>TOTAL</span>
                    <span>AED ${parseFloat(invoiceData.grand_total || invoiceData.rounded_total || 0).toFixed(2)}</span>
                </div>
                <div style="margin-top: 10px;">
                    ${(invoiceData.payments && invoiceData.payments.some(p => parseFloat(p.amount) > 0)) ? 
                      invoiceData.payments.filter(p => parseFloat(p.amount) > 0).map(p => `
                        <div class="total-row">
                            <span>${(p.mode_of_payment || 'PAYMENT').toUpperCase()}</span>
                            <span>AED ${parseFloat(p.amount || 0).toFixed(2)}</span>
                        </div>
                      `).join('') : `
                        <div class="total-row">
                            <span>${invoiceData.outstanding_amount > 0 ? 'CREDIT' : 'PAID'}</span>
                            <span>AED ${parseFloat(invoiceData.grand_total || invoiceData.rounded_total || 0).toFixed(2)}</span>
                        </div>
                      `
                    }
                </div>
                ${changeDue > 0 ? `
                  <div class="total-row" style="margin-top: 5px; opacity: 0.8;">
                      <span>CHANGE</span>
                      <span class="bold">AED ${changeDue.toFixed(2)}</span>
                  </div>
                ` : ''}
            </div>
            <div class="center">
                <img class="barcode" src="${barCodeUrl}" />
                <div class="footer">
                    <p class="bold" style="font-size: 12px;">THANK YOU!</p>
                    <p>GLAD TO SEE YOU AGAIN!</p>
                    <p style="margin-top: 5px; opacity: 0.7;">Powered by KYLE RETAIL</p>
                </div>
            </div>
            <script>
                window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
            </script>
        </body>
    </html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const printWindow = iframe.contentWindow;
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 5000);
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

  // Global Keyboard Shortcuts hook for Edit Modal
  useEffect(() => {
    if (!showModal) return;
    const handleGlobalShortcuts = (e) => {
      const activeEl = document.activeElement;
      const inItemsTable = activeEl?.closest('table.so-items-table');

      let activeRowIndex = -1;
      if (inItemsTable) {
        const tr = activeEl.closest('tr');
        if (tr && tr.parentNode) {
          const index = Array.from(tr.parentNode.children).indexOf(tr);
          if (index !== -1 && index < form.items.length) {
            activeRowIndex = index;
          }
        }
      }

      // Ctrl+ArrowDown, Ctrl+ArrowUp, or Shift+F3: Jump focus into items table rows
      if ((e.ctrlKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || (e.shiftKey && e.key === 'F3')) {
        const rows = document.querySelectorAll('table.so-items-table tbody tr');
        if (rows.length > 0) {
          e.preventDefault();
          const targetRow = (e.key === 'ArrowUp') ? rows[rows.length - 1] : rows[0];
          if (targetRow) {
            targetRow.focus();
            return;
          }
        }
      }

      // Focus Customer Search
      if (isShortcutPressed(e, 'doc_editor', 'customerSupplier', 'F2')) {
        e.preventDefault();
        const customerInput = document.querySelector('input[placeholder="Search customer..."]');
        if (customerInput) {
          customerInput.focus();
          customerInput.select?.();
        }
      }

      // Focus Item Search (first row if empty, else last row)
      if (isShortcutPressed(e, 'doc_editor', 'itemSearch', 'F3')) {
        e.preventDefault();
        const itemInputs = document.querySelectorAll('input[placeholder="Search item..."]');
        if (itemInputs.length > 0) {
          const firstInput = itemInputs[0];
          const targetInput = (firstInput && !firstInput.value) ? firstInput : itemInputs[itemInputs.length - 1];
          if (targetInput) {
            targetInput.focus();
            targetInput.select?.();
          }
        }
      }

      // Focus Barcode/Scan input
      if (isShortcutPressed(e, 'doc_editor', 'barcode', 'F4')) {
        e.preventDefault();
        const scanInput = document.getElementById('barcode-scan-input');
        if (scanInput) {
          scanInput.focus();
          scanInput.select?.();
        }
      }

      // Bulk Quantity Update popup
      if (isShortcutPressed(e, 'doc_editor', 'bulkQty', 'F6')) {
        e.preventDefault();
        if (isViewOnly) return;
        let rowIndex = inItemsTable ? activeRowIndex : (form.items.length - 1);

        if (rowIndex >= 0 && rowIndex < form.items.length) {
          const item = form.items[rowIndex];
          if (item && item.item_code) {
            Swal.fire({
              title: 'Bulk Quantity',
              html: `<div style="font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; padding: 10px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #10b981; text-align: left;">
                ${item.item_name || item.item_code}
              </div>`,
              input: 'number',
              inputPlaceholder: 'Enter quantity...',
              inputValue: item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || ''),
              showCancelButton: true,
              confirmButtonText: 'Update',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#64748b'
            }).then(result => {
              if (result.isConfirmed && result.value !== undefined) {
                const newQty = parseFloat(result.value) || 0;
                if (item.use_box_entry) {
                  updateItem(rowIndex, 'custom_box_qty', newQty);
                } else {
                  updateItem(rowIndex, 'qty', newQty);
                }
              }
            });
          }
        }
      }

      // Toggle UOM of active row (or last row)
      if (isShortcutPressed(e, 'doc_editor', 'uom', 'F8')) {
        e.preventDefault();
        if (isViewOnly) return;
        let rowIndex = inItemsTable ? activeRowIndex : (form.items.length - 1);

        if (rowIndex >= 0 && rowIndex < form.items.length) {
          const item = form.items[rowIndex];
          if (item && item.item_code) {
            let nextUom = '';
            const currentUom = (item.uom || item.stock_uom || '').toLowerCase();
            const uomList = item.uom_list || [];

            if (uomList.length > 1) {
              const currentIndex = uomList.findIndex(u => u.uom.toLowerCase() === currentUom);
              const nextIndex = (currentIndex + 1) % uomList.length;
              nextUom = uomList[nextIndex].uom;
            } else {
              nextUom = currentUom === 'box' ? (item.stock_uom || 'Nos') : 'Box';
            }

            handleUOMChangeDetails(nextUom, rowIndex);
            Swal.fire({
              icon: 'info',
              title: 'UOM Switched',
              text: `Row ${rowIndex + 1}: Switched UOM to ${nextUom}`,
              toast: true,
              position: 'top-end',
              timer: 2000,
              showConfirmButton: false
            });
          }
        }
      }

      // Save Draft / Update Draft
      if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS'))) {
        e.preventDefault();
        if (isViewOnly) return;
        if (!saving && (form.docstatus === 0 || form.docstatus === undefined)) {
          createSalesInvoice(false);
        }
      }

      // Add Item Row
      if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        if (isViewOnly) return;
        addItemRow();
      }

      // Focus Branch Select
      if (isShortcutPressed(e, 'doc_editor', 'warehouseBranch', 'F9')) {
        e.preventDefault();
        const warehouseSelect = document.querySelector('select.so-select') || document.querySelector('select');
        if (warehouseSelect) {
          warehouseSelect.focus();
        }
      }

      // Submit document
      if (isShortcutPressed(e, 'doc_editor', 'submit', 'F12') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (isViewOnly) return;
        if (!saving && (form.docstatus === 0 || form.docstatus === undefined)) {
          createSalesInvoice(true);
        }
      }

      // Escape: Close configuration modals, reset selection
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowModal(false);
        resetForm();
      }

      // Tab Key Navigation Inside Table (Do not close or leave)
      if (e.key === 'Tab') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            const rowInputs = Array.from(tr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
            const inputIndex = rowInputs.indexOf(activeEl);

            if (inputIndex === rowInputs.length - 1 && !e.shiftKey) {
              e.preventDefault();
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              const isLastRow = rowIndex === form.items.length - 1;

              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const firstInput = newTr.querySelector('input:not([disabled]), select:not([disabled])');
                    if (firstInput) {
                      firstInput.focus();
                      firstInput.select?.();
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input:not([disabled]), select:not([disabled])');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else if (inputIndex === 0 && e.shiftKey) {
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              if (rowIndex > 0) {
                e.preventDefault();
                const prevTr = tr.previousElementSibling;
                if (prevTr) {
                  const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
                  if (prevInputs.length > 0) {
                    const lastInput = prevInputs[prevInputs.length - 1];
                    lastInput.focus();
                    lastInput.select?.();
                  }
                }
              }
            }
          }
        }
      }

      // Enter key inside table inputs: add row or navigate down
      if (e.key === 'Enter') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const isSearchInput = activeEl.placeholder === 'Search item...';
          const isDropdownOpen = document.querySelector('.so-dropdown');
          if (isSearchInput && isDropdownOpen) return; // Let search dropdown handle it

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            const isLastRow = rowIndex === form.items.length - 1;
            const isRateField = activeEl.name === 'rate' || activeEl.name === 'custom_box_price';

            if (isRateField) {
              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const firstInput = newTr.querySelector('input[placeholder="Search item..."]');
                    if (firstInput) {
                      firstInput.focus();
                      firstInput.select?.();
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input[placeholder="Search item..."]');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else {
              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const targetTd = newTr.children[colIndex];
                    if (targetTd) {
                      const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                      if (targetInput) {
                        targetInput.focus();
                        targetInput.select?.();
                      }
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const targetTd = nextTr.children[colIndex];
                  if (targetTd) {
                    const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                    if (targetInput) {
                      targetInput.focus();
                      targetInput.select?.();
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Escape key inside table input to select/focus the parent row (TR) itself
      if (e.key === 'Escape') {
        if (inItemsTable && activeEl && activeEl.tagName !== 'TR') {
          const tr = activeEl.closest('tr');
          if (tr) {
            e.preventDefault();
            tr.focus();
            return;
          }
        }
      }

      // Keyboard actions when the row itself is focused
      if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.so-items-table')) {
        const tr = activeEl;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
          if (targetTr && targetTr.tagName === 'TR') {
            targetTr.focus();
          }
        }

        if (e.key === 'Enter' || e.key === 'F3' || e.key === ' ') {
          e.preventDefault();
          const firstInput = tr.querySelector('input:not([disabled]), select:not([disabled])');
          if (firstInput) {
            firstInput.focus();
            firstInput.select?.();
          }
        }

        if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
          const isPlus = e.key === '+' || e.key === '=';
          const qtyInput = tr.querySelector('input[name="qty"]:not([disabled])') || tr.querySelector('input[name="custom_box_qty"]:not([disabled])');
          if (qtyInput && activeRowIndex !== -1) {
            e.preventDefault();
            const currentVal = parseFloat(qtyInput.value) || 0;
            const diff = isPlus ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            updateItem(activeRowIndex, qtyInput.name, newVal);
          }
        }
      }

      // Arrow Up/Down navigation inside table inputs
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isSearchInput = activeEl.placeholder === 'Search item...';
          const isDropdownOpen = document.querySelector('.so-dropdown');
          if (isSearchInput && isDropdownOpen && !e.altKey && !e.ctrlKey) return;

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
            if (targetTr) {
              const targetTd = targetTr.children[colIndex];
              if (targetTd) {
                const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                if (targetInput) {
                  targetInput.focus();
                  targetInput.select?.();
                }
              }
            }
          }
        }
      }

      // + / -: Increase / Decrease focused row quantity
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isQtyField = activeEl.name === 'qty' || activeEl.name === 'custom_box_qty';
          if (isQtyField && activeRowIndex !== -1) {
            e.preventDefault();
            const currentVal = parseFloat(activeEl.value) || 0;
            const diff = (e.key === '+' || e.key === '=') ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            updateItem(activeRowIndex, activeEl.name, newVal);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [showModal, form, saving, isViewOnly]);

  return (
    <>
      {!showModal && (
        <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header-container">
          <div className="so-page-tabs">
            <span className="so-page-tab active">Sales Invoice</span>
            <span className="so-page-tab" onClick={() => navigate('/salesreport')} style={{ cursor: 'pointer' }}>Reports</span>
          </div>
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">Sales Invoice Management</h1>
              <p className="so-page-subtitle">Manage and track all invoices</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Theme Toggle */}
              <button
                onClick={() => {
                  const nextTheme = siTheme === 'green' ? 'blue' : 'green';
                  setSiTheme(nextTheme);
                }}
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
              <ListCustomizer
                doctype="Sales Invoice"
                onSave={cols => setCustomColumns(cols)}
                themeColor={themeColor}
              />
              <button
                className="so-btn-primary"
                onClick={() => navigate('/homepage')}
              >
                <Plus size={16} /> Create Invoice
              </button>
            </div>
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

            <div className="so-filter-group" style={{ minWidth: '130px', flex: 1 }}>
              <label className="so-filter-label">From Date</label>
              <input className="so-filter-input" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
            </div>

            <div className="so-filter-group" style={{ minWidth: '130px', flex: 1 }}>
              <label className="so-filter-label">To Date</label>
              <input className="so-filter-input" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
            </div>

            <div className="so-filter-group" style={{ minWidth: '140px', flex: 1 }}>
              <label className="so-filter-label">Amount Range</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
            </div>

            <button className="so-clear-btn" style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1rem' }} onClick={() => { setSearchTerm(''); setTitleFilter(''); setCustomerFilter(''); setStatusFilter('all'); setMinAmount(''); setMaxAmount(''); setDateStart(''); setDateEnd(''); }}>
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
                      <th>Date</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Grand Total</th>
                      {customColumns.map(col => (
                        <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6 + customColumns.length} className="so-empty"><Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} /></td></tr>
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan={6 + customColumns.length} className="so-empty">No invoices found</td></tr>
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
                          <td style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                            {inv.posting_date ? new Date(inv.posting_date).toLocaleDateString('en-GB') : '-'}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{inv.customer_name || 'Customer'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {getCurrencySymbol(inv.currency || 'AED')}{inv.is_return ? '-' : ''}{Math.abs(Number(inv.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          {customColumns.map(col => (
                            <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {inv[col] !== undefined && inv[col] !== null ? String(inv[col]) : '-'}
                            </td>
                          ))}
                          <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.name}</td>
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
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="so-page font-sans bg-[#f8fafc] min-h-screen flex flex-col" style={{ flex: 1 }}>
          <div className="so-modal" style={{ maxWidth: 'none', width: '100%', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc', flex: 1 }}>

              {/* Header */}
              <div className="so-modal-header" style={{ padding: '1rem 1.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="so-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                  {isReturnMode ? (
                    <><ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem' }} /> Credit Note — Return Against: {returnAgainst}</>
                  ) : (
                    form.name ? (form.docstatus === 1 || form.status !== 'Draft' ? `View — ${form.name}` : `Edit — ${form.name}`) : 'New Sales Invoice'
                  )}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isViewOnly ? (
                    <>
                      {form.name && (
                        <div className="relative" ref={createDropdownRef}>
                          <button
                            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                            className="so-btn-secondary"
                            style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                          >
                            <Plus size={14} /> CREATE <ChevronDown size={14} />
                          </button>
                          {showCreateDropdown && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 animate-fadeIn text-left" style={{ textTransform: 'none' }}>
                              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                                <Zap className="w-4 h-4 text-indigo-500 opacity-80 shrink-0" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-extrabold">Create & Connections</span>
                              </div>

                              {/* Primary Workflow Actions */}
                              {(() => {
                                const isFullyDelivered = form.update_stock || (form.items && form.items.length > 0 && form.items.every(item => (parseFloat(item.delivered_qty) || 0) >= (parseFloat(item.qty) || 0)));
                                const showCreateDN = form.name && (form.status === 'Submitted' || form.status === 'Paid' || form.status === 'Unpaid') && !form.update_stock && !form.is_return && !isFullyDelivered;
                                if (showCreateDN) {
                                  return (
                                    <div className="flex flex-col gap-2 mb-4">
                                      <button
                                        onClick={() => {
                                          setShowCreateDropdown(false);
                                          setShowModal(false);
                                          resetForm();
                                          navigate(`/deliverynote/create?si=${encodeURIComponent(form.name)}`);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Create Delivery Note
                                      </button>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Connected Docs */}
                              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                                {Object.keys(linkedDocs).some(dt => (linkedDocs[dt] || []).length > 0) ? (
                                  Object.entries(linkedDocs)
                                    .filter(([dt, links]) => links && links.length > 0)
                                    .map(([dt, links]) => (
                                      <div key={dt} className="flex flex-col gap-1.5 text-left">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight text-slate-400">{dt}</span>
                                        <div className="flex flex-wrap gap-1">
                                          {links.map(link => (
                                            <button
                                              key={link.name}
                                              onClick={() => {
                                                setShowCreateDropdown(false);
                                                navigateToDoc(dt, link.name);
                                              }}
                                              className="group/id flex items-center gap-1 p-0.5 px-1.5 bg-white border border-slate-100 rounded transition-all hover:border-indigo-200 hover:shadow-sm"
                                              title={`View ${dt}: ${link.name}`}
                                            >
                                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${link.docstatus === 1 ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : (link.docstatus === 2 ? 'bg-rose-400' : 'bg-orange-400 animate-pulse')}`} />
                                              <span className="text-[9px] font-bold text-slate-700 tabular-nums truncate">{link.name}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="py-2 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 italic text-slate-400 font-semibold">No connections yet</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        className="so-btn-secondary"
                        onClick={() => handlePrint(form)}
                        style={{ background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, padding: '0.45rem 0.9rem', fontSize: '0.75rem' }}
                      >
                        Print Invoice
                      </button>
                      {(form.docstatus === 0 || form.status === 'Draft') && (
                        <button
                          className="so-btn-primary"
                          onClick={() => setIsViewOnly(false)}
                          style={{ minWidth: '120px', backgroundColor: themeColor, padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Edit Invoice
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button 
                        className="so-btn-secondary" 
                        onClick={() => createSalesInvoice(false)} 
                        disabled={saving}
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        {saving ? 'Saving...' : 'Save Draft'}
                      </button>
                      <button 
                        className="so-btn-primary" 
                        onClick={() => createSalesInvoice(true)} 
                        disabled={saving}
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: themeColor }}
                      >
                        {saving ? 'Submitting...' : 'Submit Invoice'}
                      </button>
                    </>
                  )}
                  <button
                    className="so-btn-secondary"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <X size={14} /> Close
                  </button>
                </div>
              </div>
              
              {/* Premium Glassmorphic Keyboard Shortcuts Guide Banner */}
              <div className="w-full bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-sky-50/50 backdrop-blur-md border-b border-emerald-100/60 px-8 py-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] font-medium text-slate-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase tracking-wider text-[10px]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Quick Shortcuts
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Customer</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'itemSearch', 'F3')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Item Search</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'barcode', 'F4')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Barcode</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'bulkQty', 'F6')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Bulk Qty</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'uom', 'F8')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Toggle UOM</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200/80 shadow-sm transition-all hover:scale-105 hover:bg-emerald-50">
                    <kbd className="px-1.5 py-0.5 bg-emerald-200 border border-emerald-300 rounded text-[9px] font-black text-emerald-700 shadow-sm">{getShortcut('doc_editor', 'saveDraft', 'F7')}</kbd>
                    <span className="text-[10px] font-semibold text-emerald-800">Save Draft</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut("doc_editor", "addRowAlt", "Alt+A")}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Add Row</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'warehouseBranch', 'F9')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Branch</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut("doc_editor", "submitAlt", "Ctrl+Enter")} / {getShortcut('doc_editor', 'submit', 'F12')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Submit</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Shift+F3 / Ctrl+↓</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Focus Table</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Escape</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Close / Clear</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">+ / -</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Qty Adjust</span>
                  </div>
                </div>
              </div>

              {/* Body - Alignment Fix Here */}
              <div className="so-modal-body" style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <AttachmentSection doctype="Sales Invoice" docname={form.name} />

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
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>
                              {form.set_warehouse 
                                ? form.set_warehouse.split(" - ")[0] 
                                : (warehouse ? warehouse.split(" - ")[0] : "N/A")}
                            </span>
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
                        {(() => {
                          const hasAnyBox = form.items?.some(i => i.use_box_entry);
                          return (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                  <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Item Details</th>
                                  {hasAnyBox ? (
                                    <>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Box Qty</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>UOM</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Pcs/Box</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "120px" }}>Box Price</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "120px" }}>Rate (Nos)</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Total Qty</th>
                                    </>
                                  ) : (
                                    <>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Qty</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>UOM</th>
                                      <th style={{ padding: "1rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "140px" }}>Rate</th>
                                    </>
                                  )}
                                  <th style={{ padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: "100px" }}>Tax</th>
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
                                    {hasAnyBox ? (
                                      <>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                                          {item.use_box_entry ? `${item.custom_box_qty} Box` : `${item.qty} Nos`}
                                        </td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "left", color: "#64748b", fontSize: "0.75rem", fontWeight: 700 }}>
                                          {item.use_box_entry ? 'Box' : (item.uom || 'Nos')}
                                        </td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                                          {item.use_box_entry ? item.custom_pieces_per_box : '—'}
                                        </td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                                          {item.use_box_entry ? `${getCurrencySymbol()}${parseFloat(item.custom_box_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                                          {getCurrencySymbol()}{parseFloat(item.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 800, color: "#334155" }}>
                                          {item.qty} Nos
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#334155" }}>{item.qty}</td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: "0.75rem" }}>{item.uom || "-"}</td>
                                        <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                                          {getCurrencySymbol()}{item.rate?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>
                                      </>
                                    )}
                                    <td style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        background: item.is_tax_inclusive !== false ? '#e0f2fe' : '#fef3c7',
                                        color: item.is_tax_inclusive !== false ? '#0369a1' : '#b45309'
                                      }}>
                                        {item.is_tax_inclusive !== false ? 'INC' : 'EXC'}
                                      </span>
                                    </td>
                                    <td style={{ padding: "1rem 1.5rem", textAlign: "right", fontWeight: 800, color: themeColor, paddingRight: "1.5rem" }}>
                                      {getCurrencySymbol()}{item.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
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
                              <span style={{ color: "#1e293b", fontWeight: 700 }}>{getCurrencySymbol()}{(t.tax_amount || (form.base_total * (parseFloat(t.rate) || 0) / 100))?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
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
                          {(() => {
                            const hasAnyBox = form.items?.some(it => it.use_box_entry);
                            return (
                              <table className="so-items-table">
                                <thead>
                                  <tr>
                                    <th style={{ paddingLeft: '1.5rem' }}>Item Details</th>
                                    {hasAnyBox ? (
                                      <>
                                        <th style={{ width: '90px', textAlign: 'center' }}>Box Qty</th>
                                        <th style={{ width: '90px', textAlign: 'center' }}>UOM</th>
                                        <th style={{ width: '90px', textAlign: 'center' }}>Pcs/Box</th>
                                        <th style={{ width: '90px', textAlign: 'right' }}>Box Price</th>
                                        <th style={{ width: '90px', textAlign: 'right' }}>Rate (Nos)</th>
                                        <th style={{ width: '90px', textAlign: 'center' }}>Total Qty</th>
                                      </>
                                    ) : (
                                      <>
                                        <th style={{ width: '100px', textAlign: 'center' }}>Qty</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>UOM</th>
                                        <th style={{ width: '140px', textAlign: 'right' }}>Rate</th>
                                      </>
                                    )}
                                    <th style={{ width: '100px', textAlign: 'center' }}>Tax</th>
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

                                      {/* Box Qty column */}
                                      {hasAnyBox && (
                                        <td>
                                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input
                                              className="so-input"
                                              style={{ textAlign: 'center', fontWeight: 'bold', color: item.use_box_entry ? '#0284c7' : '#334155', height: '36px' }}
                                              type="text"
                                              inputMode="decimal"
                                              name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                              value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                              onChange={(e) => handleInputChangeDetails(e, i)}
                                              onFocus={(e) => e.target.select()}
                                              disabled={isReturnMode}
                                            />
                                            {item.item_code && (
                                              <span style={{
                                                position: 'absolute', right: '6px', fontSize: '8px', fontWeight: 'extrabold',
                                                color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                background: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                border: `1px solid ${item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0'}`,
                                                borderRadius: '3px', padding: '1px 3px', pointerEvents: 'none'
                                              }}>
                                                {item.use_box_entry ? 'BOX' : 'NOS'}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      )}

                                      {/* UOM dropdown column */}
                                      <td>
                                        <select
                                          className="so-select"
                                          value={item.uom || 'Nos'}
                                          onChange={e => handleUOMChangeDetails(e.target.value, i)}
                                          style={{ height: '36px', padding: '0.25rem 0.5rem', width: '100%' }}
                                          disabled={isReturnMode}
                                        >
                                          {(() => {
                                            const uniqueUoms = [];
                                            const seen = new Set();
                                            const candidates = [];
                                            if (item.uom_list && Array.isArray(item.uom_list)) {
                                              item.uom_list.forEach(u => { if (u && u.uom) candidates.push(u.uom); });
                                            }
                                            candidates.push(item.stock_uom || 'Nos');
                                            candidates.push(item.uom || 'Nos');
                                            candidates.push('Nos');
                                            candidates.push('Box');

                                            candidates.forEach(u => {
                                              const norm = u.trim().toLowerCase();
                                              let display = u.trim();
                                              if (norm === 'box') display = 'Box';
                                              else if (norm === 'nos') display = 'Nos';

                                              if (!seen.has(norm)) {
                                                seen.add(norm);
                                                uniqueUoms.push(display);
                                              }
                                            });
                                            return uniqueUoms.map(uomVal => (
                                              <option key={uomVal} value={uomVal}>{uomVal}</option>
                                            ));
                                          })()}
                                        </select>
                                      </td>

                                      {/* Pcs/Box column */}
                                      {hasAnyBox && (
                                        <td>
                                          {item.use_box_entry ? (
                                            <input
                                              className="so-input"
                                              style={{ textAlign: 'center', height: '36px' }}
                                              type="text"
                                              inputMode="decimal"
                                              name="custom_pieces_per_box"
                                              value={item.custom_pieces_per_box || ''}
                                              onChange={(e) => handleInputChangeDetails(e, i)}
                                              onFocus={(e) => e.target.select()}
                                              disabled={isReturnMode}
                                            />
                                          ) : (
                                            <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.3 }}>—</div>
                                          )}
                                        </td>
                                      )}

                                      {/* Box Price column */}
                                      {hasAnyBox && (
                                        <td>
                                          {item.use_box_entry ? (
                                            <input
                                              className="so-input"
                                              style={{ textAlign: 'right', fontWeight: 'bold', height: '36px' }}
                                              type="text"
                                              inputMode="decimal"
                                              name="custom_box_price"
                                              value={item.custom_box_price || ''}
                                              onChange={(e) => handleInputChangeDetails(e, i)}
                                              onFocus={(e) => e.target.select()}
                                              disabled={isReturnMode}
                                            />
                                          ) : (
                                            <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.3 }}>—</div>
                                          )}
                                        </td>
                                      )}

                                      {/* Rate (Nos) column */}
                                      <td>
                                        <input
                                          className="so-input"
                                          style={{ textAlign: 'right', fontWeight: 'bold', height: '36px' }}
                                          type="text"
                                          inputMode="decimal"
                                          name="rate"
                                          value={item.rate || ''}
                                          onChange={(e) => handleInputChangeDetails(e, i)}
                                          onFocus={(e) => e.target.select()}
                                          disabled={isReturnMode}
                                        />
                                      </td>

                                      {/* Total Qty column (read-only for boxes) */}
                                      {hasAnyBox && (
                                        <td>
                                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', height: '36px', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                                              {item.qty || 0}
                                            </div>
                                            {item.use_box_entry && (
                                              <span style={{
                                                position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                borderRadius: '3px', padding: '1px 3px', pointerEvents: 'none'
                                              }}>
                                                NOS
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      )}

                                      {/* Simplified Qty column if there are no boxes in the document */}
                                      {!hasAnyBox && (
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
                                      )}

                                      {/* Tax dropdown column */}
                                      <td>
                                        <select
                                          className="so-select"
                                          value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                                          onChange={e => {
                                            const val = e.target.value === 'Inclusive';
                                            setForm(prev => {
                                              const items = [...(prev.items || [])];
                                              items[i] = { ...items[i], is_tax_inclusive: val };
                                              return { ...prev, items };
                                            });
                                            // Trigger total calculation after updating is_tax_inclusive
                                            setTimeout(() => {
                                              calculateTotals();
                                            }, 50);
                                          }}
                                          style={{ height: '36px', padding: '0.25rem 0.5rem', width: '100%' }}
                                          disabled={isReturnMode}
                                        >
                                          <option value="Inclusive">Inclusive</option>
                                          <option value="Exclusive">Exclusive</option>
                                        </select>
                                      </td>

                                      {/* Amount column */}
                                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', paddingRight: '1.5rem', color: 'var(--so-primary)' }}>
                                        {getCurrencySymbol(form.currency)}{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>

                                      {/* Delete action column */}
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
                            );
                          })()}
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
            </div>
          </div>
        )}
      </>
  );
};

export default SalesInvoiceList;