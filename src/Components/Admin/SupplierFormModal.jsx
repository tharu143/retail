// src/Components/Admin/SupplierFormModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Building2, Save, X, ChevronDown, Check, Sparkles,
  Lock, Snowflake, PauseCircle, UserCheck, Truck, Bell,
  AlertTriangle, ShieldAlert, Shield, FileText, Loader2,
  ChevronLeft, ChevronRight, Pencil
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './SupplierFormModal.css';
import AttachmentSection from './AttachmentSection';

export default function SupplierFormModal({
  isOpen,
  onClose,
  onSave,
  editingSupplier = null,
  userWarehouse = null,
  inline = false
}) {
  const [activeTab, setActiveTab] = useState(1);

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_name_in_arabic: '',
    supplier_group: '',
    supplier_type: 'Company',
    country: 'United Arab Emirates',
    disabled: false,
    tax_id: '',
    tax_category: '',
    tax_withholding_category: '',
    website: '',
    // Address Details
    address_title: '',
    address_type: 'Office',
    address_line1: '',
    address_line2: '',
    city: '',
    emirate: 'Dubai',
    state: '',
    postal_code: '',
    address_email: '',
    address_phone: '',
    // Contact Details
    salutation: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email_id: '',
    mobile_no: '',
    designation: '',
    gender: '',
    is_primary_contact: true,
    // Internal
    supplier_details: '',
    default_currency: 'AED',
    default_price_list: '',
    payment_terms: '',
    // Settings Checkboxes
    allow_purchase_invoice_creation_without_purchase_order: false,
    allow_purchase_invoice_creation_without_purchase_receipt: false,
    is_frozen: false,
    on_hold: false,
    is_internal_supplier: false,
    is_transporter: false,
    warn_rfqs: false,
    warn_pos: false,
    prevent_rfqs: false,
    prevent_pos: false,
    custom_branch: '',
    branch_availability: []
  });

  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({
    supplierGroups: [],
    priceLists: [],
    countries: [],
    currencies: [],
    taxCategories: [],
    taxWithholdingCategories: [],
    paymentTerms: [],
    warehouses: [],
    salutations: ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'],
    genders: ['Male', 'Female', 'Other']
  });

  useEffect(() => {
    if (editingSupplier) {
      setForm({
        ...editingSupplier,
        supplier_name: editingSupplier.supplier_name || '',
        supplier_name_in_arabic: editingSupplier.supplier_name_in_arabic || '',
        supplier_group: editingSupplier.supplier_group || '',
        supplier_type: editingSupplier.supplier_type || 'Company',
        country: editingSupplier.country || 'United Arab Emirates',
        tax_id: editingSupplier.tax_id || '',
        tax_category: editingSupplier.tax_category || '',
        tax_withholding_category: editingSupplier.tax_withholding_category || '',
        website: editingSupplier.website || '',
        default_currency: editingSupplier.default_currency || 'AED',
        default_price_list: editingSupplier.default_price_list || '',
        payment_terms: editingSupplier.payment_terms || '',
        disabled: !!editingSupplier.disabled,
        allow_purchase_invoice_creation_without_purchase_order: !!editingSupplier.allow_purchase_invoice_creation_without_purchase_order,
        allow_purchase_invoice_creation_without_purchase_receipt: !!editingSupplier.allow_purchase_invoice_creation_without_purchase_receipt,
        is_frozen: !!editingSupplier.is_frozen,
        on_hold: !!editingSupplier.on_hold,
        is_internal_supplier: !!editingSupplier.is_internal_supplier,
        is_transporter: !!editingSupplier.is_transporter,
        warn_rfqs: !!editingSupplier.warn_rfqs,
        warn_pos: !!editingSupplier.warn_pos,
        prevent_rfqs: !!editingSupplier.prevent_rfqs,
        prevent_pos: !!editingSupplier.prevent_pos,
        custom_branch: editingSupplier.custom_branch || '',
        branch_availability: editingSupplier.branch_availability || [],
        address_title: editingSupplier.address_details?.address_title || '',
        address_type: editingSupplier.address_details?.address_type || 'Office',
        address_line1: editingSupplier.address_details?.address_line1 || '',
        address_line2: editingSupplier.address_details?.address_line2 || '',
        city: editingSupplier.address_details?.city || '',
        emirate: editingSupplier.address_details?.emirate || editingSupplier.address_details?.county || 'Dubai',
        state: editingSupplier.address_details?.state || '',
        postal_code: editingSupplier.address_details?.pincode || '',
        address_email: editingSupplier.address_details?.email_id || '',
        address_phone: editingSupplier.address_details?.phone || '',
        salutation: editingSupplier.contact_details?.salutation || '',
        first_name: editingSupplier.contact_details?.first_name || '',
        middle_name: editingSupplier.contact_details?.middle_name || '',
        last_name: editingSupplier.contact_details?.last_name || '',
        email_id: editingSupplier.contact_details?.email_id || editingSupplier.email_id || '',
        mobile_no: editingSupplier.contact_details?.mobile_no || editingSupplier.mobile_no || '',
        designation: editingSupplier.contact_details?.designation || '',
        gender: editingSupplier.contact_details?.gender || '',
        is_primary_contact: editingSupplier.contact_details?.is_primary_contact !== undefined ? !!editingSupplier.contact_details.is_primary_contact : true
      });
    } else {
      setForm({
        supplier_name: '', supplier_name_in_arabic: '', supplier_group: '', supplier_type: 'Company',
        country: 'United Arab Emirates',
        disabled: false, tax_id: '', tax_category: '', tax_withholding_category: '',
        website: '',
        address_title: '', address_type: 'Office', address_line1: '', address_line2: '', city: '', emirate: 'Dubai', state: '', postal_code: '', address_email: '', address_phone: '',
        salutation: '', first_name: '', middle_name: '', last_name: '', email_id: '', mobile_no: '', designation: '', gender: '', is_primary_contact: true,
        supplier_details: '', default_currency: 'AED',
        default_price_list: '', payment_terms: '',
        allow_purchase_invoice_creation_without_purchase_order: false,
        allow_purchase_invoice_creation_without_purchase_receipt: false,
        is_frozen: false, on_hold: false, is_internal_supplier: false,
        is_transporter: false, warn_rfqs: false, warn_pos: false,
        prevent_rfqs: false, prevent_pos: false,
        custom_branch: userWarehouse || '',
        branch_availability: userWarehouse ? [{ warehouse: userWarehouse }] : []
      });
    }
  }, [editingSupplier, isOpen]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [groups, prices, countries, currencies, taxCat, taxWith, payTerms, warehouses] = await Promise.all([
          axios.get('/api/resource/Supplier Group?fields=["name"]&limit=100', { withCredentials: true }),
          axios.get('/api/resource/Price List?fields=["name"]&limit=100', { withCredentials: true }),
          axios.get('/api/resource/Country?fields=["name"]&limit=250', { withCredentials: true }),
          axios.get('/api/resource/Currency?fields=["name"]&limit=250', { withCredentials: true }),
          axios.get('/api/resource/Tax Category?fields=["name"]&limit=100', { withCredentials: true }),
          axios.get('/api/resource/Tax Withholding Category?fields=["name"]&limit=100', { withCredentials: true }),
          axios.get('/api/resource/Payment Terms Template?fields=["name"]&limit=100', { withCredentials: true }),
          axios.get('/api/resource/Warehouse?fields=["name"]&limit=500', { withCredentials: true })
        ]);

        setMeta(prev => ({
          ...prev,
          supplierGroups: (groups.data?.data || []).map(g => g.name),
          priceLists: (prices.data?.data || []).map(g => g.name),
          countries: (countries.data?.data || []).map(g => g.name),
          currencies: (currencies.data?.data || []).map(g => g.name),
          taxCategories: (taxCat.data?.data || []).map(g => g.name),
          taxWithholdingCategories: (taxWith.data?.data || []).map(g => g.name),
          paymentTerms: (payTerms.data?.data || []).map(g => g.name),
          warehouses: (warehouses.data?.data || []).map(g => g.name)
        }));
      } catch (e) { console.error('Meta fetch error:', e); }
    };
    if (isOpen) fetchMeta();
  }, [isOpen]);

  const handleSave = async () => {
    if (!form.supplier_name.trim() || !form.supplier_group) {
      setActiveTab(1);
      Swal.fire({ icon: 'warning', title: 'Missing Data', text: 'Supplier Name and Group are mandatory in Opportunity Details.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        disabled: form.disabled ? 1 : 0,
        is_frozen: form.is_frozen ? 1 : 0,
        on_hold: form.on_hold ? 1 : 0,
        is_internal_supplier: form.is_internal_supplier ? 1 : 0,
        is_transporter: form.is_transporter ? 1 : 0,
        is_primary_contact: form.is_primary_contact ? 1 : 0,
        allow_purchase_invoice_creation_without_purchase_order: form.allow_purchase_invoice_creation_without_purchase_order ? 1 : 0,
        allow_purchase_invoice_creation_without_purchase_receipt: form.allow_purchase_invoice_creation_without_purchase_receipt ? 1 : 0,
        warn_rfqs: form.warn_rfqs ? 1 : 0,
        warn_pos: form.warn_pos ? 1 : 0,
        prevent_rfqs: form.prevent_rfqs ? 1 : 0,
        prevent_pos: form.prevent_pos ? 1 : 0,
        currency: form.default_currency,
        custom_branch: form.custom_branch || userWarehouse
      };

      let response;
      if (editingSupplier) {
        response = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
          supplier_name: editingSupplier.name,
          data: payload
        }, { withCredentials: true });
      } else {
        response = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_supplier',
          payload, { withCredentials: true }
        );
      }

      const successData = response.data.message?.data || response.data.data;
      Swal.fire({ icon: 'success', title: 'Partner Registry Updated', timer: 2000, showConfirmButton: false });
      if (onSave) onSave(successData || payload);
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Registry Error', text: err.response?.data?.message || 'Process failed.' });
    } finally {
      setSaving(false);
    }
  };

  const [editingSummarySection, setEditingSummarySection] = useState(null);
  const [summarySnapshot, setSummarySnapshot] = useState(null);

  const handleStartSummaryEdit = (sectionKey, tabId, elementId, e) => {
    if (e) e.stopPropagation();
    setSummarySnapshot({ ...form });
    setEditingSummarySection(sectionKey);
    handleEditSection(tabId, elementId);
  };

  const handleSaveSummaryEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingSummarySection(null);
    setSummarySnapshot(null);
    Swal.fire({
      icon: 'success',
      title: 'Details Saved',
      text: 'Summary changes applied to form.',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const handleCancelSummaryEdit = (e) => {
    if (e) e.stopPropagation();
    if (summarySnapshot) {
      setForm(summarySnapshot);
    }
    setEditingSummarySection(null);
    setSummarySnapshot(null);
  };

  const handleEditSection = (tabId, elementId) => {
    setActiveTab(tabId);
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = el.querySelector('input, select, textarea');
        if (input) input.focus();
      }
    }, 50);
  };

  if (!isOpen && !inline) return null;

  const containerClass = inline
    ? "supplier-form-canvas w-full min-h-full flex flex-col bg-[#f8fafc]"
    : "supplier-form-canvas bg-[#f8fafc] w-full max-w-[1550px] h-full max-h-[96vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200";

  const tabs = [
    { id: 1, name: '1. OPPORTUNITY DETAILS' },
    { id: 2, name: '2. ADDRESS & CONTACT' },
    { id: 3, name: '3. SOURCE & BRANCH AVAILABILITY' }
  ];

  const formContent = (
    <div className={containerClass}>
      {/* 1. Modal Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-7 py-4 shrink-0">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80 shrink-0">
              <Building2 size={22} />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight m-0" style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                {editingSupplier ? 'EDIT SUPPLIER REGISTRY' : 'NEW SUPPLIER REGISTRY'}
              </h1>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 font-medium text-[12px] rounded-full border border-slate-200/60">
                {editingSupplier ? 'Saved' : 'Draft / not saved'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="supplier-save-btn flex items-center gap-2 px-5 py-2 bg-[#0082f6] hover:bg-[#0070f3] text-white rounded-full text-[13px] font-semibold shadow-xs transition-all cursor-pointer"
              style={{ borderRadius: '9999px' }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving...' : (editingSupplier ? 'Save Supplier' : 'Create Supplier')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Stepper Bar */}
      <div className="stepper-bar-container overflow-x-auto shrink-0">
        <div className="max-w-[1600px] w-full mx-auto flex items-center gap-3 min-w-max">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const isCompleted = activeTab > tab.id;

            return (
              <React.Fragment key={tab.id}>
                {idx > 0 && <div className="stepper-line" />}

                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`stepper-pill ${isActive ? 'active' : isCompleted ? 'completed' : 'inactive'
                    }`}
                >
                  {isCompleted ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-extrabold ${isActive ? 'bg-[#0284c7] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {tab.id}
                    </span>
                  )}
                  <span>{tab.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. Main Two-Column Content Area */}
      <div className="p-6 sm:p-7 bg-[#f1f5f9] flex-1 overflow-y-auto">
        <div className="max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row gap-7 items-start">

          {/* Left Column: Form Cards for Active Tab */}
          <div className="flex-1 w-full space-y-6">

            {/* TAB 1: Opportunity details + Settings & Controls */}
            {activeTab === 1 && (
              <div className="flex flex-col gap-8 animate-fadeIn">
                {/* 1. Opportunity Details Card */}
                <div className="form-card" id="sec-opportunity-details">
                  <div className="form-card-header">
                    <div className="form-card-title-number">1</div>
                    <div>
                      <div className="form-card-title-text">OPPORTUNITY DETAILS</div>
                      <div className="form-card-subtitle-text">Basic supplier and profile information</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        SUPPLIER NAME <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.supplier_name}
                        onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                        placeholder="Acme Corp"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        BUSINESS GROUP <span className="text-rose-500">*</span>
                      </label>
                      <select
                        className="form-field-select"
                        value={form.supplier_group}
                        onChange={e => setForm({ ...form, supplier_group: e.target.value })}
                      >
                        <option value="">Select Group</option>
                        {meta.supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">SUPPLIER TYPE</label>
                      <select
                        className="form-field-select"
                        value={form.supplier_type}
                        onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                      >
                        <option value="Company">Company</option>
                        <option value="Individual">Individual</option>
                        <option value="Partnership">Partnership</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">COUNTRY</label>
                      <select
                        className="form-field-select"
                        value={form.country}
                        onChange={e => setForm({ ...form, country: e.target.value })}
                      >
                        <option value="">Select Country</option>
                        {meta.countries.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="form-field-group md:col-span-2">
                      <label className="form-field-label">SUPPLIER TYPE (ARABIC)</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.supplier_name_in_arabic}
                        onChange={e => setForm({ ...form, supplier_name_in_arabic: e.target.value })}
                        placeholder="اسم المورد باللغة العربية"
                      />
                    </div>

                    <div className="form-field-group md:col-span-2">
                      <label className="form-field-label">WEBSITE</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.website}
                        onChange={e => setForm({ ...form, website: e.target.value })}
                        placeholder="https://www.example.com"
                      />
                    </div>

                    <div className="form-field-group md:col-span-2">
                      <label className="form-field-label">BRANCH</label>
                      <input
                        type="text"
                        className="form-field-input bg-slate-100 cursor-not-allowed"
                        value={form.custom_branch}
                        readOnly
                        placeholder="Khalifa City Warehouse - NS"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Settings & Controls Card */}
                <div className="form-card" id="sec-settings-controls">
                  <div className="form-card-header">
                    <div className="form-card-title-number">2</div>
                    <div>
                      <div className="form-card-title-text">SETTINGS & CONTROLS</div>
                      <div className="form-card-subtitle-text">Controls, flags and special permissions</div>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                      {[
                        { id: 'disabled', label: 'DISABLED', icon: Lock, color: '#ef4444' },
                        { id: 'is_frozen', label: 'IS FROZEN', icon: Snowflake, color: '#3b82f6' },
                        { id: 'on_hold', label: 'ON HOLD', icon: PauseCircle, color: '#f59e0b' },
                        { id: 'is_internal_supplier', label: 'INTERNAL SUPPLIER', icon: UserCheck, color: '#9333ea' },
                        { id: 'is_transporter', label: 'IS TRANSPORTER', icon: Truck, color: '#10b981' },
                        { id: 'warn_rfqs', label: 'WARN RFQS', icon: Bell, color: '#f59e0b' },
                        { id: 'warn_pos', label: 'WARN POS', icon: AlertTriangle, color: '#f59e0b' },
                        { id: 'prevent_rfqs', label: 'PREVENT RFQS', icon: ShieldAlert, color: '#ef4444' },
                        { id: 'prevent_pos', label: 'PREVENT POS', icon: Shield, color: '#ef4444' },
                        { id: 'allow_purchase_invoice_creation_without_purchase_order', label: 'BILL WITHOUT PO', icon: FileText, color: '#10b981' },
                        { id: 'allow_purchase_invoice_creation_without_purchase_receipt', label: 'BILL WITHOUT RECEIPT', icon: FileText, color: '#10b981' }
                      ].map(check => {
                        const Icon = check.icon;
                        return (
                          <label key={check.id} className="cursor-pointer block w-full m-0">
                            <div className={`checkbox-card ${form[check.id] ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer m-0"
                                checked={form[check.id]}
                                onChange={e => setForm({ ...form, [check.id]: e.target.checked })}
                              />
                              <Icon size={15} color={check.color} strokeWidth={2.5} className="shrink-0" />
                              <span className="text-xs font-bold text-slate-700 whitespace-nowrap uppercase m-0">{check.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="form-field-group mt-6 pt-4 border-t border-slate-100">
                      <label className="form-field-label">SUPPLIER DETAILS NOTES</label>
                      <textarea
                        rows={3}
                        className="form-field-input h-auto py-2.5 resize-none text-xs"
                        value={form.supplier_details}
                        onChange={e => setForm({ ...form, supplier_details: e.target.value })}
                        placeholder="Enter supplier details or notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Address & Contact */}
            {activeTab === 2 && (
              <div className="flex flex-col gap-8 animate-fadeIn">
                {/* 3. Address Card */}
                <div className="form-card" id="sec-address-details">
                  <div className="form-card-header">
                    <div className="form-card-title-number">3</div>
                    <div>
                      <div className="form-card-title-text">ADDRESS INFORMATION</div>
                      <div className="form-card-subtitle-text">Address details and location information</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-field-group">
                      <label className="form-field-label">Address Title</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.address_title}
                        onChange={e => setForm({ ...form, address_title: e.target.value })}
                        placeholder="Head Office"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Address Type</label>
                      <select
                        className="form-field-select"
                        value={form.address_type}
                        onChange={e => setForm({ ...form, address_type: e.target.value })}
                      >
                        <option value="Office">Office</option>
                        <option value="Billing">Billing</option>
                        <option value="Shipping">Shipping</option>
                        <option value="Warehouse">Warehouse</option>
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Address Line 1</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.address_line1}
                        onChange={e => setForm({ ...form, address_line1: e.target.value })}
                        placeholder="Building No, Street Name"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Address Line 2</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.address_line2}
                        onChange={e => setForm({ ...form, address_line2: e.target.value })}
                        placeholder="Area, Landmark"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">City</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Emirate</label>
                      <select
                        className="form-field-select"
                        value={form.emirate}
                        onChange={e => setForm({ ...form, emirate: e.target.value })}
                      >
                        <option value="Dubai">Dubai</option>
                        <option value="Abu Dhabi">Abu Dhabi</option>
                        <option value="Sharjah">Sharjah</option>
                        <option value="Ajman">Ajman</option>
                        <option value="Fujairah">Fujairah</option>
                        <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                        <option value="Umm Al Quwain">Umm Al Quwain</option>
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">State / Region</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.state}
                        onChange={e => setForm({ ...form, state: e.target.value })}
                        placeholder="State"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Postal Code / Zip</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.postal_code}
                        onChange={e => setForm({ ...form, postal_code: e.target.value })}
                        placeholder="00000"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Email Address (Address)</label>
                      <input
                        type="email"
                        className="form-field-input"
                        value={form.address_email}
                        onChange={e => setForm({ ...form, address_email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Phone (Address)</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.address_phone}
                        onChange={e => setForm({ ...form, address_phone: e.target.value })}
                        placeholder="+00 000 0000"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Contact Card */}
                <div className="form-card" id="sec-contact-details">
                  <div className="form-card-header">
                    <div className="form-card-title-number">4</div>
                    <div>
                      <div className="form-card-title-text">CONTACT INFORMATION</div>
                      <div className="form-card-subtitle-text">Primary contact person details</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-field-group">
                      <label className="form-field-label">Salutation</label>
                      <select
                        className="form-field-select"
                        value={form.salutation}
                        onChange={e => setForm({ ...form, salutation: e.target.value })}
                      >
                        <option value="">Select Salutation</option>
                        {(meta.salutations || ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof']).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">First Name</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.first_name}
                        onChange={e => setForm({ ...form, first_name: e.target.value })}
                        placeholder="First Name"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Middle Name</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.middle_name}
                        onChange={e => setForm({ ...form, middle_name: e.target.value })}
                        placeholder="Middle Name"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Last Name</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.last_name}
                        onChange={e => setForm({ ...form, last_name: e.target.value })}
                        placeholder="Last Name"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Email Id</label>
                      <input
                        type="email"
                        className="form-field-input"
                        value={form.email_id}
                        onChange={e => setForm({ ...form, email_id: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Mobile No</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.mobile_no}
                        onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                        placeholder="+00 000 0000"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Designation</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.designation}
                        onChange={e => setForm({ ...form, designation: e.target.value })}
                        placeholder="e.g. Manager"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Company Name</label>
                      <input
                        type="text"
                        className="form-field-input bg-slate-50"
                        value={form.supplier_name}
                        readOnly
                        placeholder="Defaults to Supplier Name"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 pt-1">
                      <label className={`checkbox-card inline-flex w-auto max-w-xs ${form.is_primary_contact ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 cursor-pointer"
                          style={{ accentColor: '#0082f6' }}
                          checked={!!form.is_primary_contact}
                          onChange={e => setForm({ ...form, is_primary_contact: e.target.checked ? 1 : 0 })}
                        />
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} className="text-[#0082f6]" />
                          <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase">IS PRIMARY CONTACT</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Attachments & Review */}
            {activeTab === 3 && (
              <div className="flex flex-col gap-8 animate-fadeIn">
                {/* 5. Source & Assignment Card */}
                <div className="form-card" id="sec-financials">
                  <div className="form-card-header">
                    <div className="form-card-title-number">5</div>
                    <div>
                      <div className="form-card-title-text">SOURCE & ASSIGNMENT</div>
                      <div className="form-card-subtitle-text">Financials, tax details and attachments</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                    <div className="form-field-group">
                      <label className="form-field-label">Tax Id</label>
                      <input
                        type="text"
                        className="form-field-input"
                        value={form.tax_id}
                        onChange={e => setForm({ ...form, tax_id: e.target.value })}
                        placeholder="Tax Id"
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Tax Category</label>
                      <select
                        className="form-field-select"
                        value={form.tax_category}
                        onChange={e => setForm({ ...form, tax_category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {(meta.taxCategories || []).map(tc => (
                          <option key={tc.name || tc} value={tc.name || tc}>{tc.name || tc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Withholding Category</label>
                      <select
                        className="form-field-select"
                        value={form.tax_withholding_category}
                        onChange={e => setForm({ ...form, tax_withholding_category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {(meta.taxWithholdingCategories || []).map(twc => (
                          <option key={twc.name || twc} value={twc.name || twc}>{twc.name || twc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Default Currency</label>
                      <select
                        className="form-field-select"
                        value={form.default_currency}
                        onChange={e => setForm({ ...form, default_currency: e.target.value })}
                      >
                        <option value="AED">AED</option>
                        {(meta.currencies || ['USD', 'EUR', 'GBP', 'SAR', 'INR']).map(c => (
                          c !== 'AED' && <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Default Price List</label>
                      <select
                        className="form-field-select"
                        value={form.default_price_list}
                        onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                      >
                        <option value="">Select Price List</option>
                        {(meta.priceLists || []).map(pl => (
                          <option key={pl.name || pl} value={pl.name || pl}>{pl.name || pl}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label className="form-field-label">Payment Terms</label>
                      <select
                        className="form-field-select"
                        value={form.payment_terms}
                        onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                      >
                        <option value="">Select Template</option>
                        {(meta.paymentTerms || []).map(pt => (
                          <option key={pt.name || pt} value={pt.name || pt}>{pt.name || pt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <AttachmentSection doctype="Supplier" docname={editingSupplier ? editingSupplier.name : null} />
                </div>

                {/* 6. Branch Availability Card */}
                <div className="form-card" id="sec-branch-availability">
                  <div className="form-card-header mb-4">
                    <div className="form-card-title-number">6</div>
                    <div>
                      <div className="form-card-title-text">BRANCH AVAILABILITY</div>
                      <div className="form-card-subtitle-text text-slate-500 font-medium text-xs">Select branches where this supplier can be used</div>
                    </div>
                  </div>

                  <div className="branch-availability-scroll">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {(meta.warehouses && meta.warehouses.length > 0
                        ? meta.warehouses
                        : [
                          'Abu Dhabi Warehouse - NS',
                          'Ajman Warehouse - NS',
                          'Al Falah Village 2 Warehouse - NS',
                          'Al Falah Village 4 Warehouse - NS',
                          'Al Rayyana Mall Warehouse - NS',
                          'All Warehouses - NS',
                          'Finished Goods - NS',
                          'Goods In Transit - NS',
                          'Khalifa City Warehouse - NS',
                          'Shamkha Warehouse - NS',
                          'Stores - NS',
                          'Work In Progress - NS'
                        ]
                      ).map(wh => {
                        const isSelected = Array.isArray(form.branch_availability) && form.branch_availability.some(
                          item => (typeof item === 'string' ? item === wh : item.warehouse === wh)
                        );

                        return (
                          <div
                            key={wh}
                            onClick={() => {
                              const current = Array.isArray(form.branch_availability) ? form.branch_availability : [];
                              const exists = current.some(item => (typeof item === 'string' ? item === wh : item.warehouse === wh));
                              let updated;
                              if (exists) {
                                updated = current.filter(item => (typeof item === 'string' ? item !== wh : item.warehouse !== wh));
                              } else {
                                updated = [...current, { warehouse: wh }];
                              }
                              setForm({ ...form, branch_availability: updated });
                            }}
                            className={`branch-card-item ${isSelected ? 'selected' : ''}`}
                          >
                            <div className="branch-checkbox-box">
                              {isSelected && <Check size={14} strokeWidth={3} />}
                            </div>
                            <span className="branch-name-text">{wh}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Live Summary Sidebar */}
          <div className="w-full lg:w-[360px] xl:w-[380px] shrink-0">
            <div className="live-summary-card">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-sky-600" />
                  <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">LIVE SUPPLIER PROFILE</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {form.supplier_type}
                </span>
              </div>

              <div className="live-summary-body max-h-[calc(100vh-230px)] sm:max-h-[620px] overflow-y-auto pr-1">
                {/* 1. Opportunity Details Summary */}
                <div className="supplier-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">1. Opportunity Details</span>
                    <button
                      type="button"
                      onClick={(e) => handleStartSummaryEdit('opportunity', 1, 'sec-opportunity-details', e)}
                      className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>

                  {editingSummarySection === 'opportunity' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Supplier Name *</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.supplier_name}
                          onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Group *</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.supplier_group}
                          onChange={e => setForm({ ...form, supplier_group: e.target.value })}
                        >
                          <option value="">Select Group</option>
                          {(meta.supplierGroups.length > 0 ? meta.supplierGroups : ['All Supplier Groups', 'Services', 'Local', 'Distributor', 'Hardware']).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Type</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.supplier_type}
                          onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                        >
                          <option value="Company">Company</option>
                          <option value="Individual">Individual</option>
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Country</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.country}
                          onChange={e => setForm({ ...form, country: e.target.value })}
                        >
                          {(meta.countries.length > 0 ? meta.countries : ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Bahrain', 'Kuwait', 'India', 'China', 'United States']).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Name (Arabic)</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.supplier_name_in_arabic}
                          onChange={e => setForm({ ...form, supplier_name_in_arabic: e.target.value })}
                          placeholder="الاسم بالعربي"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Website</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.website}
                          onChange={e => setForm({ ...form, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Branch</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.custom_branch}
                          onChange={e => setForm({ ...form, custom_branch: e.target.value })}
                        >
                          <option value="">Select Branch</option>
                          {meta.warehouses.map(w => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>

                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('opportunity', 1, 'sec-opportunity-details', e)}>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Supplier Name:</span>
                        <span className="live-summary-val">{form.supplier_name || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Group:</span>
                        <span className="live-summary-val">{form.supplier_group || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Type:</span>
                        <span className="live-summary-val">{form.supplier_type || 'Company'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Country:</span>
                        <span className="live-summary-val">{form.country || 'United Arab Emirates'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Name (Arabic):</span>
                        <span className="live-summary-val">{form.supplier_name_in_arabic || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Website:</span>
                        <span className="live-summary-val">{form.website || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Branch:</span>
                        <span className="live-summary-val font-extrabold text-slate-900">
                          {form.custom_branch || (Array.isArray(form.branch_availability) && form.branch_availability.length > 0 ? (typeof form.branch_availability[0] === 'string' ? form.branch_availability[0] : form.branch_availability[0].warehouse) : '—')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Address Summary */}
                <div className="supplier-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">2. Address Information</span>
                    <button
                      type="button"
                      onClick={(e) => handleStartSummaryEdit('address', 2, 'sec-address-details', e)}
                      className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>

                  {editingSummarySection === 'address' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Title</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.address_title}
                          onChange={e => setForm({ ...form, address_title: e.target.value })}
                          placeholder="Main Office"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Type</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.address_type}
                          onChange={e => setForm({ ...form, address_type: e.target.value })}
                        >
                          {['Office', 'Billing', 'Shipping', 'Warehouse', 'Plant', 'Postal', 'Subsidiary', 'Other'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Address Line 1</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.address_line1}
                          onChange={e => setForm({ ...form, address_line1: e.target.value })}
                          placeholder="Street 12, Block B"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Address Line 2</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.address_line2}
                          onChange={e => setForm({ ...form, address_line2: e.target.value })}
                          placeholder="Suite 402"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>City</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.city}
                          onChange={e => setForm({ ...form, city: e.target.value })}
                          placeholder="Dubai"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Emirate</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.emirate}
                          onChange={e => setForm({ ...form, emirate: e.target.value })}
                        >
                          {['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map(em => (
                            <option key={em} value={em}>{em}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>State</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.state}
                          onChange={e => setForm({ ...form, state: e.target.value })}
                          placeholder="Dubai"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Postal Code</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.postal_code}
                          onChange={e => setForm({ ...form, postal_code: e.target.value })}
                          placeholder="00000"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Address Email</label>
                        <input
                          type="email"
                          className="live-summary-edit-input"
                          value={form.address_email}
                          onChange={e => setForm({ ...form, address_email: e.target.value })}
                          placeholder="office@example.com"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Address Phone</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.address_phone}
                          onChange={e => setForm({ ...form, address_phone: e.target.value })}
                          placeholder="+971 4 1234567"
                        />
                      </div>

                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('address', 2, 'sec-address-details', e)}>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Title:</span>
                        <span className="live-summary-val">{form.address_title || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Type:</span>
                        <span className="live-summary-val">{form.address_type || 'Office'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Address Line 1:</span>
                        <span className="live-summary-val">{form.address_line1 || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Address Line 2:</span>
                        <span className="live-summary-val">{form.address_line2 || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">City:</span>
                        <span className="live-summary-val">{form.city || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Emirate:</span>
                        <span className="live-summary-val">{form.emirate || 'Dubai'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">State:</span>
                        <span className="live-summary-val">{form.state || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Postal Code:</span>
                        <span className="live-summary-val">{form.postal_code || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Address Email:</span>
                        <span className="live-summary-val">{form.address_email || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Address Phone:</span>
                        <span className="live-summary-val">{form.address_phone || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Contact Summary */}
                <div className="supplier-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">3. Contact Information</span>
                    <button
                      type="button"
                      onClick={(e) => handleStartSummaryEdit('contact', 2, 'sec-contact-details', e)}
                      className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>

                  {editingSummarySection === 'contact' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Salutation</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.salutation}
                          onChange={e => setForm({ ...form, salutation: e.target.value })}
                        >
                          <option value="">None</option>
                          {meta.salutations.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>First Name</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.first_name}
                          onChange={e => setForm({ ...form, first_name: e.target.value })}
                          placeholder="John"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Middle Name</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.middle_name}
                          onChange={e => setForm({ ...form, middle_name: e.target.value })}
                          placeholder=""
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Last Name</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.last_name}
                          onChange={e => setForm({ ...form, last_name: e.target.value })}
                          placeholder="Doe"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Email</label>
                        <input
                          type="email"
                          className="live-summary-edit-input"
                          value={form.email_id}
                          onChange={e => setForm({ ...form, email_id: e.target.value })}
                          placeholder="john.doe@example.com"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Mobile No</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.mobile_no}
                          onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                          placeholder="+971 50 1234567"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Designation</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.designation}
                          onChange={e => setForm({ ...form, designation: e.target.value })}
                          placeholder="Manager"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Gender</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.gender}
                          onChange={e => setForm({ ...form, gender: e.target.value })}
                        >
                          <option value="">Select Gender</option>
                          {meta.genders.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Primary Contact</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.is_primary_contact ? 'yes' : 'no'}
                          onChange={e => setForm({ ...form, is_primary_contact: e.target.value === 'yes' })}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>

                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('contact', 2, 'sec-contact-details', e)}>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Contact Name:</span>
                        <span className="live-summary-val">{[form.salutation, form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ') || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Email:</span>
                        <span className="live-summary-val">{form.email_id || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Mobile No:</span>
                        <span className="live-summary-val">{form.mobile_no || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Designation:</span>
                        <span className="live-summary-val">{form.designation || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Gender:</span>
                        <span className="live-summary-val">{form.gender || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Primary Contact:</span>
                        <span className="live-summary-val">{form.is_primary_contact ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Settings & Financials Summary */}
                <div className="supplier-summary-section-box">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">4. Settings & Financials</span>
                    <button
                      type="button"
                      onClick={(e) => handleStartSummaryEdit('financials', 3, 'sec-financials', e)}
                      className="text-sky-600 hover:text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>

                  {editingSummarySection === 'financials' ? (
                    <div className="live-summary-edit-container">
                      <div className="live-summary-edit-row">
                        <label>Tax ID / TRN</label>
                        <input
                          type="text"
                          className="live-summary-edit-input"
                          value={form.tax_id}
                          onChange={e => setForm({ ...form, tax_id: e.target.value })}
                          placeholder="Tax Id"
                        />
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Tax Category</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.tax_category}
                          onChange={e => setForm({ ...form, tax_category: e.target.value })}
                        >
                          <option value="">Select Tax Category</option>
                          {meta.taxCategories.map(tc => (
                            <option key={tc.name || tc} value={tc.name || tc}>{tc.name || tc}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Withholding Tax</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.tax_withholding_category}
                          onChange={e => setForm({ ...form, tax_withholding_category: e.target.value })}
                        >
                          <option value="">Select Withholding Tax</option>
                          {meta.taxWithholdingCategories.map(tw => (
                            <option key={tw.name || tw} value={tw.name || tw}>{tw.name || tw}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Default Currency</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.default_currency}
                          onChange={e => setForm({ ...form, default_currency: e.target.value })}
                        >
                          {(meta.currencies.length > 0 ? meta.currencies : ['AED', 'USD', 'EUR', 'GBP', 'SAR']).map(cur => (
                            <option key={cur} value={cur}>{cur}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Price List</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.default_price_list}
                          onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                        >
                          <option value="">Select Price List</option>
                          {meta.priceLists.map(pl => (
                            <option key={pl.name || pl} value={pl.name || pl}>{pl.name || pl}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Payment Terms</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.payment_terms}
                          onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                        >
                          <option value="">Select Payment Terms</option>
                          {meta.paymentTerms.map(pt => (
                            <option key={pt.name || pt} value={pt.name || pt}>{pt.name || pt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>Status</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.disabled ? 'disabled' : 'active'}
                          onChange={e => setForm({ ...form, disabled: e.target.value === 'disabled' })}
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>
                      <div className="live-summary-edit-row">
                        <label>On Hold</label>
                        <select
                          className="live-summary-edit-select"
                          value={form.on_hold ? 'yes' : 'no'}
                          onChange={e => setForm({ ...form, on_hold: e.target.value === 'yes' })}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>

                      <div className="live-summary-actions">
                        <button type="button" onClick={handleSaveSummaryEdit} className="live-summary-save-btn">
                          <Save size={13} />
                          <span>Save</span>
                        </button>
                        <button type="button" onClick={handleCancelSummaryEdit} className="live-summary-cancel-btn">
                          <X size={13} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleStartSummaryEdit('financials', 3, 'sec-financials', e)}>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Tax ID / TRN:</span>
                        <span className="live-summary-val">{form.tax_id || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Tax Category:</span>
                        <span className="live-summary-val">{form.tax_category || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Withholding Tax:</span>
                        <span className="live-summary-val">{form.tax_withholding_category || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Default Currency:</span>
                        <span className="live-summary-val">{form.default_currency || 'AED'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Price List:</span>
                        <span className="live-summary-val">{form.default_price_list || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Payment Terms:</span>
                        <span className="live-summary-val">{form.payment_terms || '—'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">Status:</span>
                        <span className="live-summary-val">{form.disabled ? 'Disabled' : 'Active'}</span>
                      </div>
                      <div className="live-summary-row">
                        <span className="live-summary-key">On Hold:</span>
                        <span className="live-summary-val">{form.on_hold ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  if (inline) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 z-[11000] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      {formContent}
    </div>
  );
}