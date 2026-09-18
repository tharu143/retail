import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Package, Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette,
    Save, CheckCircle2, Trash2, Edit3, AlertCircle, Printer, Send,
    Settings, Link as LinkIcon, Info, CreditCard, Percent, Eye,
    ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { frappeCall } from '../../utils/frappe';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ListCustomizer from './ListCustomizer';

const CustomerDropdown = ({ query, onSelect, customers, targetRef }) => {
    const results = useMemo(() => {
        if (!query) return customers.slice(0, 10);
        const q = query.toLowerCase();
        return customers.filter(c =>
            (c.customer_name || '').toLowerCase().includes(q) ||
            (c.name || '').toLowerCase().includes(q)
        ).slice(0, 10);
    }, [query, customers]);

    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const updateCoords = () => {
            if (targetRef?.current) {
                const rect = targetRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [targetRef, results]);

    if (results.length === 0) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: Math.max(coords.width, 250),
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            zIndex: 999999,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxHeight: '250px',
            overflowY: 'auto'
        }}>
            {results.map(c => (
                <div
                    key={c.name}
                    onClick={() => onSelect(c)}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.customer_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.name}</div>
                </div>
            ))}
        </div>,
        document.body
    );
};

const ItemDropdown = ({ query, onSelect, warehouse, targetRef }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const fetchItems = async () => {
            if (!query || query.length < 1) return;
            setLoading(true);
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', {
                    params: { search_term: query, warehouse: warehouse }
                });
                setResults(res.data.message || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetchItems, 300);
        return () => clearTimeout(timer);
    }, [query, warehouse]);

    useEffect(() => {
        const updateCoords = () => {
            if (targetRef?.current) {
                const rect = targetRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [targetRef, results, loading]);

    if (!query || query.length < 1) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            minWidth: Math.max(coords.width, 300),
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            zIndex: 999999,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxHeight: '250px',
            overflowY: 'auto'
        }}>
            {loading ? (
                <div style={{ padding: '1rem', textAlign: 'center' }}><Loader2 size={16} className="so-spinner" /></div>
            ) : results.length > 0 ? (
                results.map(item => (
                    <div
                        key={item.item_code}
                        onClick={() => onSelect(item)}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.item_code} | {item.stock_uom}</div>
                        {item.price_list_rate && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={10} /> {item.price_list_rate}</div>}
                    </div>
                ))
            ) : (
                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>No items found</div>
            )}
        </div>,
        document.body
    );
};

const DeliveryNoteList = () => {
    const navigate = useNavigate();
    const { warehouse, user_roles } = useSelector(state => state.user || {});
    const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
    const customerInputRef = useRef(null);
    const itemInputRefs = useRef({});

    const DEFAULT_DN_LIST_COLUMNS = [
        { key: 'title', label: 'TITLE' },
        { key: 'docstatus', label: 'STATUS' },
        { key: 'customer_name', label: 'CUSTOMER' },
        { key: 'grand_total', label: 'GRAND TOTAL' },
        { key: 'name', label: 'ID' }
    ];

    const [hiddenDefaults, setHiddenDefaults] = useState(() => {
        try {
            const u = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
            const configKey = `custom_columns_config_${u}_Delivery Note`;
            const saved = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Delivery Note');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.hiddenDefaults)) return parsed.hiddenDefaults;
            }
        } catch (e) {}
        return [];
    });

    const [customColumns, setCustomColumns] = useState(() => {
        try {
            const u = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
            const configKey = `custom_columns_config_${u}_Delivery Note`;
            const savedConfig = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Delivery Note');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                if (Array.isArray(parsed.customColumns)) return parsed.customColumns;
            }
            const saved = localStorage.getItem(`custom_columns_${u}_Delivery Note`) || localStorage.getItem('custom_columns_Delivery Note');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Sorting
    const [sortField, setSortField] = useState('modified');
    const [sortDirection, setSortDirection] = useState('desc');
    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnSourceDN, setReturnSourceDN] = useState(null);
    const [submittedReturnData, setSubmittedReturnData] = useState(null);
    const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('details'); // details, connections
    const [connections, setConnections] = useState({});
    const [namingSeriesOptions, setNamingSeriesOptions] = useState([]);
    const [allowedActions, setAllowedActions] = useState(['save', 'submit', 'delete']);

    // Search states for items in rows
    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [searchResults, setSearchResults] = useState({});
    const [showItemDropdowns, setShowItemDropdowns] = useState({});
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');

    // Theme toggle
    const [dnTheme, setDnTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = dnTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0082f6';
    const themeColorHover = isGreen ? '#059669' : '#0070d8';
    const themeLight = isGreen ? '#f0fdf4' : '#ebf4fe';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', dnTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [dnTheme, themeColor, themeColorHover, themeLight]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.so-modal')) return; // Ignore if modal is not open
            // Simple logic: if not clicking an input, close dropdowns
            if (!e.target.closest('input')) {
                setShowCustomerDropdown(false);
                setActiveItemRow(null);
                setShowCreateMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filters
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
    const [titleFilter, setTitleFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const getTodayDate = () => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
    };
    const [filterDateFrom, setFilterDateFrom] = useState(() => getTodayDate());
    const [filterDateTo, setFilterDateTo] = useState(() => getTodayDate());
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Form state
    const [form, setForm] = useState({
        name: '',
        title: '',
        naming_series: '',
        posting_date: new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().slice(0, 5),
        customer: '',
        customer_name: '',
        docstatus: 0,
        is_return: 0,
        return_against: '',
        set_warehouse: '',
        currency: 'AED',
        selling_price_list: 'Standard Selling',
        ignore_pricing_rule: 0,
        items: [],
        taxes_and_charges: '',
        taxes: [],
        apply_discount_on: 'Grand Total',
        additional_discount_percentage: 0,
        discount_amount: 0,
        total_qty: 0,
        base_total: 0,
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounded_total: 0,
        in_words: ''
    });

    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [allItems, setAllItems] = useState([]);

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return <DirhamIcon size={12} className="inline mr-1" />;
            case 'USD': return '$';
            default: return '₹';
        }
    };

    const getCurrencyName = (currency) => {
        switch (currency) {
            case 'INR': return 'Rupees';
            case 'USD': return 'Dollars';
            case 'AED': return currency;
            default: return '';
        }
    };

    const numToWords = (num) => {
        if (!num) return 'Zero';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
            'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
            'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
            return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        };
        return convert(num).trim();
    };

    const numberToWords = (num, currency) => {
        if (!num) return '';
        const words = numToWords(Math.floor(Math.abs(num)));
        const currencyStr = getCurrencyName(currency);
        return currencyStr ? `${currencyStr} ${words} Only` : `${currency} ${words} Only.`;
    };
    const setDefaultBranch = async () => {
        if (!isAdmin && warehouse) {
            setForm(prev => ({ ...prev, set_warehouse: warehouse }));
            return warehouse;
        }
        return null;
    };


    // ─── Data Loading ───────────────────────────────────────────────────────────

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [custRes, whRes, taxRes, plRes, dnRes, companyRes, nsRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn', {
                    params: { warehouse: !isAdmin ? warehouse : undefined }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn', {
                    params: { warehouse: !isAdmin ? warehouse : undefined }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                axios.get('/api/method/frappe.client.get_list', {
                    params: { doctype: 'Price List', filters: { selling: 1 }, fields: ['name'] }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_delivery_note_list_retail', {
                    params: { 
                        limit: 2000, 
                        warehouse: !isAdmin ? warehouse : undefined,
                        extra_fields: JSON.stringify(customColumns)
                    }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_info_dn'),
                axios.get('/api/method/kyle_retail.retail_api.api.get_naming_series_retail', { params: { doctype: 'Delivery Note' } })
            ]);

            setCustomers(Array.isArray(custRes.data.message) ? custRes.data.message : []);
            setWarehouses(Array.isArray(whRes.data.message) ? whRes.data.message : []);
            setTaxTemplates(Array.isArray(taxRes.data.message) ? taxRes.data.message : []);
            setPriceLists(Array.isArray(plRes.data.data) ? plRes.data.data.map(pl => pl.name) : ['Standard Selling']);
            setDeliveryNotes(Array.isArray(dnRes.data.message) ? dnRes.data.message : []);
            setFilteredNotes(Array.isArray(dnRes.data.message) ? dnRes.data.message : []);

            const nsData = nsRes.data.message || {};
            const nsOptions = nsData.options || [];
            setNamingSeriesOptions(nsOptions);

            if (nsOptions.length > 0 && !form.naming_series) {
                setForm(prev => ({ ...prev, naming_series: nsOptions[0] }));
            }

            if (companyRes.data.message?.length > 0) {
                setDefaultIncomeAccount(companyRes.data.message[0].default_income_account || '');
            }

            // SET DEFAULT BRANCH/WAREHOUSE
            await setDefaultBranch();

            // SET DEFAULT TAX
            const taxes = taxRes.data.message || [];
            if (taxes.length > 0 && !form.taxes_and_charges) {
                const vat5 = taxes.find(t => t.name.includes('VAT 5%'));
                const toApply = vat5 || taxes[0];
                applyTaxTemplate(toApply.name);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadInitialData(); }, [customColumns]);

    // ─── Filters ────────────────────────────────────────────────────────────────

    useEffect(() => {
        let filtered = deliveryNotes;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(dn =>
                dn.name?.toLowerCase().includes(term) ||
                dn.customer_name?.toLowerCase().includes(term) ||
                (dn.title || 'Cash').toLowerCase().includes(term) ||
                dn.company?.toLowerCase().includes(term)
            );
        }
        if (titleFilter) filtered = filtered.filter(dn => (dn.title || 'Cash').toLowerCase().includes(titleFilter.toLowerCase()));
        if (customerFilter) filtered = filtered.filter(dn => dn.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
        if (companyFilter) filtered = filtered.filter(dn => dn.company?.toLowerCase().includes(companyFilter.toLowerCase()));
        if (statusFilter !== 'all') filtered = filtered.filter(dn => (dn.status || 'Draft') === statusFilter);
        if (filterDateFrom) {
            filtered = filtered.filter(dn => String(dn.posting_date || '').slice(0, 10) >= String(filterDateFrom).slice(0, 10));
        }
        if (filterDateTo) {
            filtered = filtered.filter(dn => String(dn.posting_date || '').slice(0, 10) <= String(filterDateTo).slice(0, 10));
        }
        if (minAmount || maxAmount) {
            filtered = filtered.filter(dn => {
                const amount = Number(dn.grand_total || 0);
                if (minAmount && amount < Number(minAmount)) return false;
                if (maxAmount && amount > Number(maxAmount)) return false;
                return true;
            });
        }
        setFilteredNotes(filtered);
        setCurrentPage(1);
    }, [searchTerm, titleFilter, customerFilter, companyFilter, statusFilter, filterDateFrom, filterDateTo, minAmount, maxAmount, deliveryNotes]);

    // ─── Item Management ────────────────────────────────────────────────────────

    const [dropdownPosition, setDropdownPosition] = useState(null);

    const handleBarcodeScan = async (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', {
                    params: { search_term: barcodeInput, warehouse: form.set_warehouse }
                });
                const items = res.data.message || [];
                if (items.length > 0) {
                    selectItem(items[0]);
                    setBarcodeInput('');
                } else {
                    Swal.fire({ icon: 'error', title: 'Not Found', text: 'Item not found.', timer: 1000, showConfirmButton: false, target: '.so-modal' });
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const selectItem = (item) => {
        const newItem = {
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.description,
            uom: item.stock_uom,
            qty: 1,
            rate: item.price_list_rate || item.valuation_rate || 0,
            amount: item.price_list_rate || item.valuation_rate || 0,
            warehouse: form.set_warehouse || item.default_warehouse,
            rate_stock_uom: item.price_list_rate || item.valuation_rate || 0,
            stock_qty: 1
        };
        setForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setIsDirty(true);
    };

    const addItemRow = () => {
        const newItem = {
            item_code: '',
            item_name: '',
            description: '',
            qty: 0,
            rate: 0,
            amount: 0,
            uom: 'Nos',
            warehouse: form.set_warehouse
        };
        setForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setIsDirty(true);
    };

    const applyTaxTemplate = async (templateName) => {
        if (!templateName) {
            setForm(prev => ({ ...prev, taxes_and_charges: '', taxes: [] }));
            return;
        }
        try {
            const res = await axios.get('/api/method/erpnext.controllers.accounts_controller.get_taxes_and_charges', {
                params: { master_doctype: 'Sales Taxes and Charges Template', master_name: templateName }
            });
            if (res.data.message) {
                setForm(prev => ({
                    ...prev,
                    taxes_and_charges: templateName,
                    taxes: res.data.message.map(t => ({
                        charge_type: t.charge_type,
                        account_head: t.account_head,
                        rate: t.rate,
                        description: t.description,
                        cost_center: t.cost_center
                    }))
                }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updateItem = (i, field, value) => {
        if (isViewOnly) return;
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            const q = parseFloat(items[i].qty) || 0;
            const r = parseFloat(items[i].rate) || 0;
            items[i].amount = q * r;
        }
        setForm(prev => ({ ...prev, items }));
        setIsDirty(true);
    };

    const removeItem = (i) => {
        if (isViewOnly) return;
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
        setIsDirty(true);
    };

    // ─── Totals ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const items = form.items || [];
        const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        let discount = 0;
        if (form.apply_discount_on === 'Net Total') {
            discount = form.additional_discount_percentage ? (netTotal * form.additional_discount_percentage / 100) : (form.discount_amount || 0);
        }

        const baseForTax = netTotal - discount;
        const taxTotal = form.taxes.reduce((s, t) => s + (baseForTax * (parseFloat(t.rate) || 0) / 100), 0);

        let grand = baseForTax + taxTotal;
        if (form.apply_discount_on === 'Grand Total') {
            const grandDiscount = form.additional_discount_percentage ? (grand * form.additional_discount_percentage / 100) : (form.discount_amount || 0);
            grand -= grandDiscount;
        }

        const rounded = Math.round(grand);
        setForm(prev => ({
            ...prev,
            total_qty: Math.abs(totalQty),
            base_total: Math.abs(netTotal),
            total_taxes_and_charges: Math.abs(taxTotal),
            grand_total: grand,
            rounded_total: rounded,
            in_words: numberToWords(rounded, form.currency)
        }));
    }, [form.items, form.taxes, form.currency, form.apply_discount_on, form.additional_discount_percentage, form.discount_amount]);

    // Tracking dirty state
    useEffect(() => {
        if (showModal) setIsDirty(true);
    }, [form.items, form.customer, form.set_warehouse, form.posting_date]);

    // ─── Items ──────────────────────────────────────────────────────────────────

    const searchItems = async (query) => {
        if (!query || query.trim().length < 2) return;
        try {
            const res = await axios.get(
                '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_dn',
                { params: { query, warehouse: !isAdmin ? warehouse : undefined } }
            );
            setAllItems(res.data.message || []);
        } catch (err) { /* silent */ }
    };

    // ─── Actions ────────────────────────────────────────────────────────────────

    const handleCreateInvoice = () => {
        if (!form.name) return;
        navigate(`/salesinvoice?dn=${encodeURIComponent(form.name)}`);
        setShowModal(false);
    };

    const handleDocAction = async (action) => {
        if (!form.customer || !form.set_warehouse) {
            Swal.fire({ icon: 'warning', title: 'Missing Info', text: 'Customer and Branch are required.', target: '.so-modal' });
            return;
        }

        if (form.items.length === 0) {
            Swal.fire({ icon: 'warning', title: 'No Items', text: 'At least one item is required.', target: '.so-modal' });
            return;
        }

        const confirmText = {
            submit: "Are you sure you want to SUBMIT this Delivery Note? This will update stock.",
            cancel: "Are you sure you want to CANCEL this Delivery Note?",
            delete: "Are you sure you want to DELETE this Draft?",
            amend: "This will create a new Draft based on this Cancelled document. Proceed?"
        };

        if (confirmText[action]) {
            const result = await Swal.fire({
                title: 'Confirm Action',
                text: confirmText[action],
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: themeColor,
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, proceed',
                target: '.so-modal'
            });
            if (!result.isConfirmed) return;
        }

        setSaving(true);
        try {
            if (action === 'save') {
                const payload = {
                    ...form,
                    doctype: 'Delivery Note',
                    items: form.items.map(i => ({
                        ...i,
                        warehouse: i.warehouse || form.set_warehouse,
                        qty: form.is_return ? -Math.abs(i.qty) : Math.abs(i.qty)
                    }))
                };

                let res;
                if (form.name) {
                    res = await frappeCall({ method: 'frappe.client.save', args: { doc: payload } });
                } else {
                    res = await frappeCall({ method: 'frappe.client.insert', args: { doc: payload } });
                }

                if (res) {
                    setForm(prev => ({ ...prev, ...res }));
                    setIsDirty(false);
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Document saved as Draft.', timer: 1500, showConfirmButton: false, target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'submit') {
                const payload = {
                    ...form,
                    doctype: 'Delivery Note',
                    items: form.items.map(i => ({
                        ...i,
                        warehouse: i.warehouse || form.set_warehouse,
                        qty: form.is_return ? -Math.abs(i.qty) : Math.abs(i.qty)
                    }))
                };
                const res = await frappeCall({
                    method: 'frappe.client.submit',
                    args: { doc: payload }
                });
                if (res) {
                    setForm(prev => ({ ...prev, ...res }));
                    setIsDirty(false);
                    setIsViewOnly(true);
                    Swal.fire({ icon: 'success', title: 'Submitted', text: 'Delivery Note submitted successfully.', target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'cancel') {
                const res = await frappeCall({
                    method: 'frappe.client.set_value',
                    args: { doctype: 'Delivery Note', name: form.name, fieldname: 'docstatus', value: 2 }
                });
                if (res) {
                    setForm(prev => ({ ...prev, docstatus: 2 }));
                    Swal.fire({ icon: 'info', title: 'Cancelled', text: 'Delivery Note has been cancelled.', target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'delete') {
                await frappeCall({ method: 'frappe.client.delete', args: { doctype: 'Delivery Note', name: form.name } });
                setShowModal(false);
                resetForm();
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Draft deleted.', timer: 1500, showConfirmButton: false });
                loadInitialData();
            }
            else if (action === 'amend') {
                const res = await frappeCall({
                    method: 'custom_retailpos.custom_retailpos.retail_api.retail.amend_document',
                    args: { doctype: 'Delivery Note', name: form.name }
                });
                if (res) {
                    setForm({ ...res, name: '' });
                    setIsViewOnly(false);
                    setIsDirty(true);
                    Swal.fire({ icon: 'success', title: 'Amended', text: 'New Draft created from previous document.', target: '.so-modal' });
                }
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Action Failed', text: err.message || 'Something went wrong', target: '.so-modal' });
        } finally {
            setSaving(false);
        }
    };

    const loadDeliveryNote = async (dnName) => {
        try {
            setLoading(true);
            const [dnRes, statusRes, connectionsRes] = await Promise.all([
                axios.get(`/api/resource/Delivery Note/${dnName}`),
                axios.get('/api/method/kyle_retail.retail_api.api.get_document_status_details', { params: { doctype: 'Delivery Note', docname: dnName } }),
                axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', { params: { doctype: 'Delivery Note', name: dnName } })
            ]);

            const dn = dnRes.data.data;
            setForm({ ...dn });
            setCustomerQuery(dn.customer_name || '');
            setAllowedActions(statusRes.data.data?.allowed_actions || []);
            setConnections(connectionsRes.data.data || {});

            setShowModal(true);
            setIsViewOnly(dn.docstatus !== 0);
            setIsDirty(false);
            setActiveTab('details');
        } catch (err) {
            alert('Error loading Delivery Note');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({
            name: '', title: '',
            naming_series: namingSeriesOptions[0] || 'MAT-DN-.YYYY.-',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: '',
            docstatus: 0,
            is_return: 0, return_against: '', currency: 'AED',
            selling_price_list: 'Standard Selling', items: [],
            taxes_and_charges: taxTemplates.length > 0 ? taxTemplates[0].name : '', taxes: [],
            apply_discount_on: 'Grand Total',
            additional_discount_percentage: 0,
            discount_amount: 0,
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
            grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsReturnMode(false);
        setReturnSourceDN(null);
        setCustomerQuery('');
        setBarcodeInput('');
        setItemQueries({});
        setActiveItemRow(null);
        setDropdownPosition(null);
        setIsDirty(false);
        setAllowedActions(['save', 'submit', 'delete']);
        setConnections({});
        setDefaultBranch();
    };

    // ─── Derived ─────────────────────────────────────────────────────────────────


    // ─── Derived ─────────────────────────────────────────────────────────────────

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedNotes = useMemo(() => {
        if (!sortField) return filteredNotes;
        return [...filteredNotes].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (sortField === 'posting_date' || sortField === 'modified' || sortField === 'creation') {
                const dateA = new Date(valA || 0).getTime();
                const dateB = new Date(valB || 0).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (sortField === 'grand_total' || sortField === 'total_qty') {
                const numA = parseFloat(valA) || 0;
                const numB = parseFloat(valB) || 0;
                return sortDirection === 'asc' ? numA - numB : numB - numA;
            }
            return sortDirection === 'asc'
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA));
        });
    }, [filteredNotes, sortField, sortDirection]);

    const paginatedNotes = sortedNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(sortedNotes.length / pageSize);

    const renderSortIcon = (field) => {
        if (sortField !== field) {
            return <ArrowUpDown size={11} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        }
        return sortDirection === 'asc' 
            ? <ArrowUp size={12} style={{ color: themeColor || '#0082f6', marginLeft: '4px' }} />
            : <ArrowDown size={12} style={{ color: themeColor || '#0082f6', marginLeft: '4px' }} />;
    };

    // ─── Status color ────────────────────────────────────────────────────────────

    const getStatusStyle = (status) => {
        const s = status === 0 ? 'Draft' : status === 1 ? 'Submitted' : 'Cancelled';
        if (s === 'Submitted') return { background: `${themeColor}20`, color: themeColor, border: `1px solid ${themeColor}40` };
        if (s === 'Draft') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
        if (s === 'Cancelled') return { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' };
        return { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
    };

    const fieldStyle = {
        width: '100%', border: '1px solid #d1d5db', borderRadius: '0.375rem',
        padding: '0.55rem 0.875rem', fontSize: '0.875rem', outline: 'none',
        background: 'white', boxSizing: 'border-box', color: '#111827',
    };
    const fieldReadonly = {
        ...fieldStyle, background: '#f9fafb', color: '#6b7280', cursor: 'default',
    };
    const lbl = {
        display: 'block', fontSize: '0.875rem', fontWeight: 500,
        color: '#374151', marginBottom: '0.375rem',
    };

    return (
        <>
            <div className="so-page">
                <div className="so-page-header-container">
                    <div className="so-page-tabs">
                        <span className="so-page-tab active">Delivery Note</span>
                        <span className="so-page-tab" onClick={() => navigate('/salesreport')} style={{ cursor: 'pointer' }}>Reports</span>
                    </div>
                    <div className="so-page-header">
                        <div>
                            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Package size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
                                <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                                    DELIVERY NOTE MANAGEMENT
                                </span>
                            </h1>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                Manage and track all delivery notes
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setDnTheme(isGreen ? 'blue' : 'green')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    height: '38px',
                                    padding: '0 16px',
                                    background: '#ffffff',
                                    color: themeColor || '#0082f6',
                                    border: `1.5px solid ${themeColor || '#0082f6'}`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease-in-out',
                                    boxSizing: 'border-box'
                                }}
                                title="Toggle Theme"
                            >
                                <Palette size={14} />
                                <span>{dnTheme.toUpperCase()}</span>
                            </button>
                            <button
                                type="button"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    height: '38px',
                                    padding: '0 16px',
                                    background: themeColor || '#0082f6',
                                    color: '#ffffff',
                                    border: `1.5px solid ${themeColor || '#0082f6'}`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0, 130, 246, 0.25)',
                                    transition: 'all 0.15s ease-in-out',
                                    boxSizing: 'border-box'
                                }}
                                onClick={() => navigate('/deliverynote/create')}
                            >
                                <Plus size={16} />
                                <span>NEW DELIVERY NOTE</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>
                    <div className="so-filter-bar" style={{ background: '#f8fafc', padding: '0 0 1.25rem 0', borderBottom: 'none', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                        <div className="so-filter-group" style={{ minWidth: '200px', flex: 1 }}>
                            <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.01em', display: 'block', marginBottom: '6px' }}>SEARCH</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
                                <input className="so-filter-input so-filter-input-icon" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.5rem' }} />
                            </div>
                        </div>
                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.01em', display: 'block', marginBottom: '6px' }}>STATUS</label>
                            <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', fontWeight: 600, color: '#0f172a' }}>
                                <option value="all">ALL STATUS</option>
                                <option value="Draft">DRAFT</option>
                                <option value="Submitted">SUBMITTED</option>
                                <option value="Cancelled">CANCELLED</option>
                            </select>
                        </div>
                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.01em', display: 'block', marginBottom: '6px' }}>FROM DATE</label>
                            <input
                                type="date"
                                className="so-filter-input"
                                value={filterDateFrom}
                                onChange={e => setFilterDateFrom(e.target.value)}
                                onFocus={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                                onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', color: filterDateFrom ? '#0f172a' : '#64748b', fontWeight: 500 }}
                            />
                        </div>
                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.01em', display: 'block', marginBottom: '6px' }}>TO DATE</label>
                            <input
                                type="date"
                                className="so-filter-input"
                                value={filterDateTo}
                                onChange={e => setFilterDateTo(e.target.value)}
                                onFocus={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                                onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', color: filterDateTo ? '#0f172a' : '#64748b', fontWeight: 500 }}
                            />
                        </div>
                        <button
                            type="button"
                            className="so-clear-btn"
                            style={{
                                height: '38px',
                                padding: '0 18px',
                                borderRadius: '8px',
                                background: '#ffffff',
                                color: (searchTerm || statusFilter !== 'all' || filterDateFrom || filterDateTo) ? '#ef4444' : '#64748b',
                                border: `1px solid ${(searchTerm || statusFilter !== 'all' || filterDateFrom || filterDateTo) ? '#fecaca' : '#cbd5e1'}`,
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease',
                                textTransform: 'uppercase'
                            }}
                            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
                        >
                            {(searchTerm || statusFilter !== 'all' || filterDateFrom || filterDateTo) ? <X size={14} /> : null}
                            <span>CLEAR</span>
                        </button>
                    </div>

                    <div className="so-content" style={{ padding: 0 }}>
                        <p className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{sortedNotes.length} record(s) found</p>
                        <div className="so-table-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                            <div className="so-table-wrapper">
                                <table className="so-table">
                                    <thead>
                                        <tr>
                                            {!hiddenDefaults.includes('title') && (
                                                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                        <span>TITLE</span>
                                                        {renderSortIcon('title')}
                                                    </div>
                                                </th>
                                            )}
                                            {!hiddenDefaults.includes('docstatus') && (
                                                <th onClick={() => handleSort('docstatus')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                        <span>STATUS</span>
                                                        {renderSortIcon('docstatus')}
                                                    </div>
                                                </th>
                                            )}
                                            {!hiddenDefaults.includes('customer_name') && (
                                                <th onClick={() => handleSort('customer_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                        <span>CUSTOMER</span>
                                                        {renderSortIcon('customer_name')}
                                                    </div>
                                                </th>
                                            )}
                                            {!hiddenDefaults.includes('grand_total') && (
                                                <th onClick={() => handleSort('grand_total')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                                        <span>GRAND TOTAL</span>
                                                        {renderSortIcon('grand_total')}
                                                    </div>
                                                </th>
                                            )}
                                            {customColumns.map(col => (
                                                <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                        <span>{col.replace(/_/g, ' ').toUpperCase()}</span>
                                                        {renderSortIcon(col)}
                                                    </div>
                                                </th>
                                            ))}
                                            {!hiddenDefaults.includes('name') && (
                                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                        <span>ID</span>
                                                        {renderSortIcon('name')}
                                                    </div>
                                                </th>
                                            )}
                                            <th style={{ width: '48px', textAlign: 'center', verticalAlign: 'middle', padding: '0 4px' }}>
                                                <ListCustomizer
                                                    doctype="Delivery Note"
                                                    defaultColumns={DEFAULT_DN_LIST_COLUMNS}
                                                    iconOnly
                                                    onSave={(cols, hidden) => {
                                                        setCustomColumns(cols);
                                                        setHiddenDefaults(hidden);
                                                    }}
                                                    themeColor={themeColor || '#0082f6'}
                                                    title="Configure Columns"
                                                />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={DEFAULT_DN_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} className="so-empty"><Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} /></td></tr>
                                        ) : paginatedNotes.map(dn => (
                                            <tr key={dn.name} onClick={() => navigate(`/deliverynote-details/${encodeURIComponent(dn.name)}`)} style={{ cursor: 'pointer' }}>
                                                {!hiddenDefaults.includes('title') && (
                                                    <td style={{ fontWeight: 600 }}>
                                                        <span 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (dn.title) setSearchTerm(dn.title);
                                                            }}
                                                            title="Click to filter by title"
                                                            style={{ cursor: 'pointer' }}
                                                            onMouseEnter={e => e.currentTarget.style.color = themeColor || '#0082f6'}
                                                            onMouseLeave={e => e.currentTarget.style.color = ''}
                                                        >
                                                            {dn.title || 'Cash'}
                                                        </span>
                                                    </td>
                                                )}
                                                {!hiddenDefaults.includes('docstatus') && (
                                                    <td>
                                                        <span 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setStatusFilter(dn.docstatus === 0 ? 'Draft' : dn.docstatus === 1 ? 'Submitted' : 'Cancelled');
                                                            }}
                                                            title="Click to filter by status"
                                                            style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', ...getStatusStyle(dn.docstatus) }}
                                                        >
                                                            {dn.docstatus === 0 ? 'Draft' : dn.docstatus === 1 ? 'Submitted' : 'Cancelled'}
                                                        </span>
                                                    </td>
                                                )}
                                                {!hiddenDefaults.includes('customer_name') && (
                                                    <td>
                                                        <span 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSearchTerm(dn.customer_name || dn.customer || '');
                                                            }}
                                                            title="Click to filter by customer"
                                                            style={{ cursor: 'pointer', fontWeight: 600 }}
                                                            onMouseEnter={e => e.currentTarget.style.color = themeColor || '#0082f6'}
                                                            onMouseLeave={e => e.currentTarget.style.color = ''}
                                                        >
                                                            {dn.customer_name}
                                                        </span>
                                                    </td>
                                                )}
                                                {!hiddenDefaults.includes('grand_total') && (
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                                                            <DirhamIcon size={12} /> {Number(dn.grand_total).toLocaleString()}
                                                        </span>
                                                    </td>
                                                )}
                                                {customColumns.map(col => (
                                                    <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                        {dn[col] !== undefined && dn[col] !== null ? String(dn[col]) : '-'}
                                                    </td>
                                                ))}
                                                {!hiddenDefaults.includes('name') && (
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{dn.name}</td>
                                                )}
                                                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/deliverynote-details/${encodeURIComponent(dn.name)}`);
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeColor || '#0082f6', padding: '4px', display: 'inline-flex' }}
                                                        title="Open Details"
                                                    >
                                                        <Eye size={16} />
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
            </div>
        </>
    );
};


export default DeliveryNoteList;