import React, { useState, useEffect, useRef } from 'react';
import {
   X, Save, Building2, ChevronLeft, ShieldCheck, Globe,
   Mail, Phone, MapPin, CreditCard, Tag, Loader2,
   Lock, Snowflake, PauseCircle, UserCheck, Truck, Bell, AlertTriangle, ShieldAlert, Shield, FileText
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SupplierFormModal.css';

const ScrollReveal = ({ children, delay = 0 }) => {
   const [isVisible, setIsVisible] = useState(false);
   const domRef = useRef();

   useEffect(() => {
      const observer = new IntersectionObserver(entries => {
         entries.forEach(entry => {
            if (entry.isIntersecting) {
               setIsVisible(true);
               observer.unobserve(domRef.current);
            }
         });
      }, { threshold: 0.1 });
      
      const { current } = domRef;
      if (current) observer.observe(current);
      
      return () => {
         if (current) observer.unobserve(current);
      };
   }, []);

   return (
      <div
         ref={domRef}
         style={{ transitionDelay: `${delay}ms` }}
         className={`h-full transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
         {children}
      </div>
   );
};

const SupplierFormModal = ({ isOpen, onClose, onSave, editingSupplier = null, userWarehouse = null, inline = false }) => {
   const { themeColor, isGreen } = useLegacyTheme();
   const [focusedField, setFocusedField] = useState(null);

   const getInputStyle = (fieldId) => ({
      borderColor: focusedField === fieldId ? themeColor : '#cbd5e1',
      boxShadow: focusedField === fieldId ? `0 0 0 3px ${themeColor}15` : 'none',
      backgroundColor: focusedField === fieldId ? '#ffffff' : '#f8fafc',
      transition: 'all 0.2s ease-in-out',
      outline: 'none'
   });

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
            // Map Address Details
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
            // Map Contact Details
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
         Swal.fire({ icon: 'warning', title: 'Missing Data', text: 'Supplier Name and Group are mandatory.' });
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
            currency: form.default_currency, // Map for backend create_supplier function
            custom_branch: form.custom_branch || userWarehouse
         };
         let response;
         if (editingSupplier) {
            response = await axios.post('/api/method/kyle_retail.retail_api.api.update_retail_supplier', {
               supplier_name: editingSupplier.name,
               data: payload
            }, { withCredentials: true });
         } else {
            // Use specialized creation API that handles Price List, Address, and Contact creation
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

   if (!isOpen && !inline) return null;

   const containerClass = inline
      ? "supplier-edit-page bg-[#f8fafc] w-full min-h-screen flex flex-col"
      : "supplier-edit-page bg-[#f8fafc] w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200";

   const formContent = (
      <div className={containerClass}>
         {/* Modal Header */}
         <div className="sticky top-0 bg-white border-b border-slate-100 px-6 h-[52px] flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
               <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${themeColor}0c`, color: themeColor }}>
                  <Building2 size={16} />
               </div>
               <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider leading-none m-0">
                     {editingSupplier ? 'Edit Supplier Registry' : 'New Supplier Registry'}
                  </h2>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-500 transition-colors"
               >
                  Discard
               </button>
               <button onClick={handleSave} disabled={saving} className="px-5 py-1.5 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-95" style={{ backgroundColor: themeColor }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{saving ? 'Saving...' : (editingSupplier ? 'Save Supplier' : 'Create Supplier')}</span>
               </button>
            </div>
         </div>

         {/* Form Body - Direct 2-Column Grid to align Heights perfectly across Row 1 and Row 2 */}
         <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12 items-stretch">

               {/* Row 1 - Col 1: Section 1 (General Specification) */}
               <ScrollReveal delay={0}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        1
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Opportunity Details</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Basic supplier and profile information</p>
                     </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                     <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Supplier Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('supplier_name')}
                           onFocus={() => setFocusedField('supplier_name')}
                           onBlur={() => setFocusedField(null)}
                           value={form.supplier_name}
                           onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                           placeholder="e.g. Acme Corp - Primary Vendor"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Business Group <span className="text-rose-500">*</span>
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('supplier_group'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('supplier_group')}
                           onBlur={() => setFocusedField(null)}
                           value={form.supplier_group}
                           onChange={e => setForm({ ...form, supplier_group: e.target.value })}
                        >
                           <option value="">Select Group</option>
                           {meta.supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Supplier Type
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('supplier_type'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('supplier_type')}
                           onBlur={() => setFocusedField(null)}
                           value={form.supplier_type}
                           onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                        >
                           <option value="Company">Company</option>
                           <option value="Individual">Individual</option>
                           <option value="Partnership">Partnership</option>
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Country
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('country'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('country')}
                           onBlur={() => setFocusedField(null)}
                           value={form.country}
                           onChange={e => setForm({ ...form, country: e.target.value })}
                        >
                           <option value="">Select Country</option>
                           {meta.countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Supplier Name (Arabic)
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('supplier_name_in_arabic')}
                           onFocus={() => setFocusedField('supplier_name_in_arabic')}
                           onBlur={() => setFocusedField(null)}
                           value={form.supplier_name_in_arabic}
                           onChange={e => setForm({ ...form, supplier_name_in_arabic: e.target.value })}
                           placeholder="الاسم باللغة العربية"
                        />
                     </div>

                     <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Website
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('website')}
                           onFocus={() => setFocusedField('website')}
                           onBlur={() => setFocusedField(null)}
                           value={form.website}
                           onChange={e => setForm({ ...form, website: e.target.value })}
                           placeholder="https://www.example.com"
                        />
                     </div>
                     <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Branch (Warehouse)
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 bg-slate-100 cursor-not-allowed transition-all duration-200"
                           style={getInputStyle('custom_branch')}
                           value={form.custom_branch}
                           readOnly
                           placeholder="Current Login Branch"
                        />
                     </div>
                  </div>
               </div>
               </ScrollReveal>

               {/* Row 1 - Col 2: Section 2 (Address Information) */}
               <ScrollReveal delay={150}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        2
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Address Information</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Address and location details</p>
                     </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Address Title
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('address_title')}
                           onFocus={() => setFocusedField('address_title')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_title}
                           onChange={e => setForm({ ...form, address_title: e.target.value })}
                           placeholder="e.g. Head Office"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Address Type
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('address_type'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('address_type')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_type}
                           onChange={e => setForm({ ...form, address_type: e.target.value })}
                        >
                           <option value="Office">Office</option>
                           <option value="Personal">Personal</option>
                           <option value="Billing">Billing</option>
                           <option value="Shipping">Shipping</option>
                           <option value="Shop">Shop</option>
                           <option value="Warehouse">Warehouse</option>
                           <option value="Other">Other</option>
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Address Line 1
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('address_line1')}
                           onFocus={() => setFocusedField('address_line1')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_line1}
                           onChange={e => setForm({ ...form, address_line1: e.target.value })}
                           placeholder="Building No, Street Name"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Address Line 2
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('address_line2')}
                           onFocus={() => setFocusedField('address_line2')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_line2}
                           onChange={e => setForm({ ...form, address_line2: e.target.value })}
                           placeholder="Area, Landmark"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           City
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('city')}
                           onFocus={() => setFocusedField('city')}
                           onBlur={() => setFocusedField(null)}
                           value={form.city}
                           onChange={e => setForm({ ...form, city: e.target.value })}
                           placeholder="City"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Emirate
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('emirate'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('emirate')}
                           onBlur={() => setFocusedField(null)}
                           value={form.emirate}
                           onChange={e => setForm({ ...form, emirate: e.target.value })}
                        >
                           <option value="Dubai">Dubai</option>
                           <option value="Abu Dhabi">Abu Dhabi</option>
                           <option value="Sharjah">Sharjah</option>
                           <option value="Ajman">Ajman</option>
                           <option value="Umm Al Quwain">Umm Al Quwain</option>
                           <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                           <option value="Fujairah">Fujairah</option>
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           State / Region
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('state')}
                           onFocus={() => setFocusedField('state')}
                           onBlur={() => setFocusedField(null)}
                           value={form.state}
                           onChange={e => setForm({ ...form, state: e.target.value })}
                           placeholder="State"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Postal Code / Zip
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('postal_code')}
                           onFocus={() => setFocusedField('postal_code')}
                           onBlur={() => setFocusedField(null)}
                           value={form.postal_code}
                           onChange={e => setForm({ ...form, postal_code: e.target.value })}
                           placeholder="00000"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Email Address (Address)
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('address_email')}
                           onFocus={() => setFocusedField('address_email')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_email}
                           onChange={e => setForm({ ...form, address_email: e.target.value })}
                           placeholder="email@example.com"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Phone (Address)
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('address_phone')}
                           onFocus={() => setFocusedField('address_phone')}
                           onBlur={() => setFocusedField(null)}
                           value={form.address_phone}
                           onChange={e => setForm({ ...form, address_phone: e.target.value })}
                           placeholder="+00 000 0000"
                        />
                     </div>
                  </div>
               </div>
               </ScrollReveal>

               {/* Row 2 - Col 1: Section 3 (Contact Information) */}
               <ScrollReveal delay={0}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        3
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Contact Information</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Primary contact person details</p>
                     </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                     {/* Contact Section */}
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Salutation
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('salutation'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('salutation')}
                           onBlur={() => setFocusedField(null)}
                           value={form.salutation}
                           onChange={e => setForm({ ...form, salutation: e.target.value })}
                        >
                           <option value="">Select Salutation</option>
                           {meta.salutations.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           First Name
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('first_name')}
                           onFocus={() => setFocusedField('first_name')}
                           onBlur={() => setFocusedField(null)}
                           value={form.first_name}
                           onChange={e => setForm({ ...form, first_name: e.target.value })}
                           placeholder="First Name"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Middle Name
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('middle_name')}
                           onFocus={() => setFocusedField('middle_name')}
                           onBlur={() => setFocusedField(null)}
                           value={form.middle_name}
                           onChange={e => setForm({ ...form, middle_name: e.target.value })}
                           placeholder="Middle Name"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Last Name
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('last_name')}
                           onFocus={() => setFocusedField('last_name')}
                           onBlur={() => setFocusedField(null)}
                           value={form.last_name}
                           onChange={e => setForm({ ...form, last_name: e.target.value })}
                           placeholder="Last Name"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Email Id
                        </label>
                        <input
                           type="email"
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('email_id')}
                           onFocus={() => setFocusedField('email_id')}
                           onBlur={() => setFocusedField(null)}
                           value={form.email_id}
                           onChange={e => setForm({ ...form, email_id: e.target.value })}
                           placeholder="email@example.com"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Mobile No
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('mobile_no')}
                           onFocus={() => setFocusedField('mobile_no')}
                           onBlur={() => setFocusedField(null)}
                           value={form.mobile_no}
                           onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                           placeholder="+00 000 0000"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Designation
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('designation')}
                           onFocus={() => setFocusedField('designation')}
                           onBlur={() => setFocusedField(null)}
                           value={form.designation}
                           onChange={e => setForm({ ...form, designation: e.target.value })}
                           placeholder="e.g. Manager"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Company Name
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('company_name')}
                           onFocus={() => setFocusedField('company_name')}
                           onBlur={() => setFocusedField(null)}
                           value={form.company_name}
                           onChange={e => setForm({ ...form, company_name: e.target.value })}
                           placeholder="Defaults to Supplier Name"
                        />
                     </div>

                     <div className="pt-6 w-full sm:w-auto">
                        <label className="cursor-pointer block w-full sm:w-max m-0">
                           <div className="flex flex-row items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg transition-all hover:bg-slate-100/80">
                              <input
                                 type="checkbox"
                                 className="rounded border-slate-300 transition-all cursor-pointer focus:ring-0 w-4 h-4 shrink-0 m-0"
                                 style={{ accentColor: themeColor }}
                                 checked={form.is_primary_contact}
                                 onChange={e => setForm({ ...form, is_primary_contact: e.target.checked })}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap m-0">Is Primary Contact</span>
                           </div>
                        </label>
                     </div>

                  </div>
               </div>
               </ScrollReveal>

               {/* Row 2 - Col 2: Section 4 (Settings & Controls) */}
               <ScrollReveal delay={150}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        4
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Settings & Controls</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Supplier status and operational settings</p>
                     </div>
                  </div>
                  <div className="p-6 flex flex-col justify-between flex-1 space-y-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3">
                        {[
                           { id: 'disabled', label: 'Disabled', icon: Lock, color: '#ef4444' },
                           { id: 'is_frozen', label: 'Is Frozen', icon: Snowflake, color: '#3b82f6' },
                           { id: 'on_hold', label: 'On Hold', icon: PauseCircle, color: '#f59e0b' },
                           { id: 'is_internal_supplier', label: 'Internal Supplier', icon: UserCheck, color: '#f59e0b' },
                           { id: 'is_transporter', label: 'Is Transporter', icon: Truck, color: '#10b981' },
                           { id: 'warn_rfqs', label: 'Warn RFQs', icon: Bell, color: '#f59e0b' },
                           { id: 'warn_pos', label: 'Warn POs', icon: AlertTriangle, color: '#f59e0b' },
                           { id: 'prevent_rfqs', label: 'Prevent RFQs', icon: ShieldAlert, color: '#ef4444' },
                           { id: 'prevent_pos', label: 'Prevent POs', icon: Shield, color: '#ef4444' },
                           { id: 'allow_purchase_invoice_creation_without_purchase_order', label: 'Bill Without PO', icon: FileText, color: '#10b981' },
                           { id: 'allow_purchase_invoice_creation_without_purchase_receipt', label: 'Bill Without Receipt', icon: FileText, color: '#10b981' }
                        ].map(check => {
                           const Icon = check.icon;
                           return (
                           <label key={check.id} className="cursor-pointer block w-full m-0">
                              <div className="flex flex-row items-center justify-start px-4 py-3 gap-3 bg-white border border-slate-200 rounded-lg transition-all group-hover:border-slate-300 shadow-sm group w-full">
                                 <input
                                    type="checkbox"
                                    className="rounded border-slate-300 transition-all cursor-pointer focus:ring-0 w-4 h-4 shrink-0"
                                    style={{ accentColor: themeColor }}
                                    checked={form[check.id]}
                                    onChange={e => setForm({ ...form, [check.id]: e.target.checked })}
                                 />
                                 <Icon size={14} color={check.color} strokeWidth={2.5} className="shrink-0" />
                                 <span className="text-[10px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors uppercase tracking-wider whitespace-nowrap m-0">{check.label}</span>
                              </div>
                           </label>
                        )})}
                     </div>

                     <div className="space-y-1.5 flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Supplier Details
                        </label>
                        <textarea
                           className="w-full px-4 py-3 border rounded-xl text-xs font-medium text-slate-700 bg-white min-h-[85px] resize-none flex-1 focus:ring-0"
                           style={getInputStyle('supplier_details')}
                           onFocus={() => setFocusedField('supplier_details')}
                           onBlur={() => setFocusedField(null)}
                           value={form.supplier_details}
                           onChange={e => setForm({ ...form, supplier_details: e.target.value })}
                           placeholder="Enter supplier details or description notes..."
                        />
                     </div>
                  </div>
               </div>
               </ScrollReveal>

               {/* Row 3 - Col 1: Section 5 (Source & Assignment) */}
               <ScrollReveal delay={0}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        5
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Source & Assignment</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Tax and assignment information</p>
                     </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Tax Id
                        </label>
                        <input
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200"
                           style={getInputStyle('tax_id')}
                           onFocus={() => setFocusedField('tax_id')}
                           onBlur={() => setFocusedField(null)}
                           value={form.tax_id}
                           onChange={e => setForm({ ...form, tax_id: e.target.value })}
                           placeholder="Tax Id"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Tax Category
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('tax_category'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('tax_category')}
                           onBlur={() => setFocusedField(null)}
                           value={form.tax_category}
                           onChange={e => setForm({ ...form, tax_category: e.target.value })}
                        >
                           <option value="">Select Category</option>
                           {meta.taxCategories.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Withholding Category
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('tax_withholding_category'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('tax_withholding_category')}
                           onBlur={() => setFocusedField(null)}
                           value={form.tax_withholding_category}
                           onChange={e => setForm({ ...form, tax_withholding_category: e.target.value })}
                        >
                           <option value="">Select Category</option>
                           {meta.taxWithholdingCategories.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Default Currency
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('default_currency'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('default_currency')}
                           onBlur={() => setFocusedField(null)}
                           value={form.default_currency}
                           onChange={e => setForm({ ...form, default_currency: e.target.value })}
                        >
                           <option value="">Select Currency</option>
                           {meta.currencies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Default Price List
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('default_price_list'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('default_price_list')}
                           onBlur={() => setFocusedField(null)}
                           value={form.default_price_list}
                           onChange={e => setForm({ ...form, default_price_list: e.target.value })}
                        >
                           <option value="">Select Price List</option>
                           {meta.priceLists.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                           Payment Terms
                        </label>
                        <select
                           className="w-full h-11 px-4 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 bg-white appearance-none bg-no-repeat bg-[right_1rem_center]"
                           style={{
                              ...getInputStyle('payment_terms'),
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                              backgroundSize: '1.25rem'
                           }}
                           onFocus={() => setFocusedField('payment_terms')}
                           onBlur={() => setFocusedField(null)}
                           value={form.payment_terms}
                           onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                        >
                           <option value="">Select Template</option>
                           {meta.paymentTerms.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                     </div>
                  </div>
               </div>
               </ScrollReveal>

               {/* Row 3 - Col 2: Section 6 (Branch Availability) */}
               <ScrollReveal delay={150}>
               <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: themeColor }}>
                        6
                     </div>
                     <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none m-0">Branch Availability</h3>
                        <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5 m-0">Select branches where this supplier can be used</p>
                     </div>
                  </div>
                  <div className="p-6 space-y-4 flex-1">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto p-1">
                        {meta.warehouses.map(wh => {
                           const isChecked = form.branch_availability.some(b => b.warehouse === wh);
                           return (
                           <label key={wh} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100/80 border-slate-100'}`}>
                              <input
                                 type="checkbox"
                                 className="rounded border-slate-300"
                                 style={{ accentColor: '#10b981' }}
                                 checked={isChecked}
                                 onChange={e => {
                                    const updated = e.target.checked
                                       ? [...form.branch_availability, { warehouse: wh }]
                                       : form.branch_availability.filter(b => b.warehouse !== wh);
                                    setForm({ ...form, branch_availability: updated });
                                 }}
                              />
                              <span className="text-[11px] font-bold text-slate-600">{wh}</span>
                           </label>
                        )})}
                     </div>
                  </div>
               </div>
               </ScrollReveal>

            </div>
         </div>
      </div>
   );

   if (inline) {
      return formContent;
   }

   return (
      <div className="fixed inset-0 z-[11000] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
         {formContent}
      </div>
   );
};

export default SupplierFormModal;