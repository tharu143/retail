import React, { useState, useEffect } from 'react';
import { 
  X, Save, Building2, ChevronLeft, ShieldCheck, Globe, 
  Mail, Phone, MapPin, CreditCard, Tag, Loader2 
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const SupplierFormModal = ({ isOpen, onClose, onSave, editingSupplier = null }) => {
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
    address: '',
    contact_person: '',
    supplier_details: '',
    default_currency: 'AED',
    default_price_list: '',
    payment_terms: '',
    supplier_primary_address: '',
    supplier_primary_contact: '',
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
    prevent_pos: false
  });

  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({
    supplierGroups: [],
    priceLists: [],
    countries: [],
    currencies: [],
    taxCategories: [],
    taxWithholdingCategories: [],
    paymentTerms: []
  });

  useEffect(() => {
    if (editingSupplier) {
      setForm({ 
        ...editingSupplier, 
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
        prevent_pos: !!editingSupplier.prevent_pos
      });
    } else {
      setForm({
        supplier_name: '', supplier_name_in_arabic: '', supplier_group: '', supplier_type: 'Company',
        country: 'United Arab Emirates',
        disabled: false, tax_id: '', tax_category: '', tax_withholding_category: '',
        website: '', email_id: '', mobile_no: '', address: '',
        contact_person: '', supplier_details: '', default_currency: 'AED',
        default_price_list: '', payment_terms: '',
        supplier_primary_address: '', supplier_primary_contact: '',
        allow_purchase_invoice_creation_without_purchase_order: false,
        allow_purchase_invoice_creation_without_purchase_receipt: false,
        is_frozen: false, on_hold: false, is_internal_supplier: false,
        is_transporter: false, warn_rfqs: false, warn_pos: false,
        prevent_rfqs: false, prevent_pos: false
      });
    }
  }, [editingSupplier, isOpen]);

  useEffect(() => {
     const fetchMeta = async () => {
        try {
           const [groups, prices, countries, currencies, taxCat, taxWith, payTerms] = await Promise.all([
              axios.get('/api/resource/Supplier Group?fields=["name"]&limit=100', { withCredentials: true }),
              axios.get('/api/resource/Price List?fields=["name"]&limit=100', { withCredentials: true }),
              axios.get('/api/resource/Country?fields=["name"]&limit=250', { withCredentials: true }),
              axios.get('/api/resource/Currency?fields=["name"]&limit=250', { withCredentials: true }),
              axios.get('/api/resource/Tax Category?fields=["name"]&limit=100', { withCredentials: true }),
              axios.get('/api/resource/Tax Withholding Category?fields=["name"]&limit=100', { withCredentials: true }),
              axios.get('/api/resource/Payment Terms Template?fields=["name"]&limit=100', { withCredentials: true })
           ]);

           setMeta({
              supplierGroups: (groups.data?.data || []).map(g => g.name),
              priceLists: (prices.data?.data || []).map(g => g.name),
              countries: (countries.data?.data || []).map(g => g.name),
              currencies: (currencies.data?.data || []).map(g => g.name),
              taxCategories: (taxCat.data?.data || []).map(g => g.name),
              taxWithholdingCategories: (taxWith.data?.data || []).map(g => g.name),
              paymentTerms: (payTerms.data?.data || []).map(g => g.name)
           });
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
        allow_purchase_invoice_creation_without_purchase_order: form.allow_purchase_invoice_creation_without_purchase_order ? 1 : 0,
        allow_purchase_invoice_creation_without_purchase_receipt: form.allow_purchase_invoice_creation_without_purchase_receipt ? 1 : 0,
        warn_rfqs: form.warn_rfqs ? 1 : 0,
        warn_pos: form.warn_pos ? 1 : 0,
        prevent_rfqs: form.prevent_rfqs ? 1 : 0,
        prevent_pos: form.prevent_pos ? 1 : 0
      };
      let response;
      if (editingSupplier) {
        response = await axios.put(`/api/resource/Supplier/${editingSupplier.name}`, payload, { withCredentials: true });
      } else {
        response = await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc',
          { doctype: "Supplier", data: payload }, { withCredentials: true }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-white flex flex-col animate-slideUp font-sans">
       {/* UI Header */}
       <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-6">
             <button onClick={onClose} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors uppercase text-[10px] font-black tracking-widest">
                <ChevronLeft size={16} /> BACK
             </button>
             <div className="h-6 w-[1.5px] bg-slate-200 mx-2" />
             <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                   <Building2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                       {editingSupplier ? 'Edit Supplier' : 'Create Supplier'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Authority</p>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={onClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all">Discard</button>
             <button
                onClick={handleSave}
                disabled={saving}
                className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
             >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : (editingSupplier ? 'Save' : 'Create')}
             </button>
          </div>
       </div>

       {/* Form Body */}
       <div className="flex-1 overflow-y-auto bg-slate-50/50 p-12">
          <div className="max-w-[1200px] mx-auto space-y-10 pb-20">
             
             {/* General Specification */}
             <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                   <ShieldCheck size={18} className="text-emerald-500" strokeWidth={3} />
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">General</h3>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Name *</label>
                      <input className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 font-sans" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier Name" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Business Group *</label>
                      <select className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 appearance-none font-sans" value={form.supplier_group} onChange={e => setForm({ ...form, supplier_group: e.target.value })}>
                         <option value="">Select Group</option>
                         {meta.supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Type</label>
                      <select className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 appearance-none font-sans" value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value })}>
                         <option value="Company">Company</option>
                         <option value="Individual">Individual</option>
                         <option value="Partnership">Partnership</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Country</label>
                      <select className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 appearance-none font-sans" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>
                         <option value="">Select Country</option>
                         {meta.countries.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Name (Arabic)</label>
                      <input className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 font-sans" value={form.supplier_name_in_arabic} onChange={e => setForm({ ...form, supplier_name_in_arabic: e.target.value })} placeholder="الاسم باللغة العربية" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Website</label>
                      <input className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 font-sans" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://www.example.com" />
                   </div>
                </div>
             </div>

              {/* Communication & Physics */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                   <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                      <Globe size={18} className="text-emerald-500" strokeWidth={3} />
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Contact Info</h3>
                   </div>
                   <div className="p-10 space-y-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Id</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" type="email" value={form.email_id} onChange={e => setForm({ ...form, email_id: e.target.value })} placeholder="email@example.com" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile No</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.mobile_no} onChange={e => setForm({ ...form, mobile_no: e.target.value })} placeholder="+00 000 0000" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Primary Contact</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.supplier_primary_contact} onChange={e => setForm({ ...form, supplier_primary_contact: e.target.value })} placeholder="Contact ID" />
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                   <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                      <MapPin size={18} className="text-emerald-500" strokeWidth={3} />
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Address</h3>
                   </div>
                   <div className="p-10 space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Primary Address</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.supplier_primary_address} onChange={e => setForm({ ...form, supplier_primary_address: e.target.value })} placeholder="Address ID" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Address</label>
                         <textarea className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold min-h-[148px]" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address Details" />
                      </div>
                   </div>
                </div>
             </div>

             {/* Fiscal Framework */}
             <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                   <CreditCard size={18} className="text-emerald-500" strokeWidth={3} />
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Currency and Price List</h3>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tax Id</label>
                      <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} placeholder="Tax Id" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tax Category</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.tax_category} onChange={e => setForm({ ...form, tax_category: e.target.value })}>
                         <option value="">Select Category</option>
                         {meta.taxCategories.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Withholding Category</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.tax_withholding_category} onChange={e => setForm({ ...form, tax_withholding_category: e.target.value })}>
                         <option value="">Select Category</option>
                         {meta.taxWithholdingCategories.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Default Currency</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.default_currency} onChange={e => setForm({ ...form, default_currency: e.target.value })}>
                         <option value="">Select Currency</option>
                         {meta.currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Default Price List</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.default_price_list} onChange={e => setForm({ ...form, default_price_list: e.target.value })}>
                         <option value="">Select Price List</option>
                         {meta.priceLists.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Payment Terms</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                         <option value="">Select Template</option>
                         {meta.paymentTerms.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                   </div>
                </div>
             </div>

             {/* Settings & Controls */}
             <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                   <Tag size={18} className="text-emerald-500" strokeWidth={3} />
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Settings</h3>
                </div>
                <div className="p-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {[
                         { id: 'disabled', label: 'Disabled' },
                         { id: 'is_frozen', label: 'Is Frozen' },
                         { id: 'on_hold', label: 'On Hold' },
                         { id: 'is_internal_supplier', label: 'Internal Supplier' },
                         { id: 'is_transporter', label: 'Is Transporter' },
                         { id: 'warn_rfqs', label: 'Warn RFQs' },
                         { id: 'warn_pos', label: 'Warn POs' },
                         { id: 'prevent_rfqs', label: 'Prevent RFQs' },
                         { id: 'prevent_pos', label: 'Prevent POs' },
                         { id: 'allow_purchase_invoice_creation_without_purchase_order', label: 'Bill without PO' },
                         { id: 'allow_purchase_invoice_creation_without_purchase_receipt', label: 'Bill without Receipt' }
                      ].map(check => (
                         <label key={check.id} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl cursor-pointer hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100 group">
                            <input
                               type="checkbox"
                               className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                               checked={form[check.id]}
                               onChange={e => setForm({ ...form, [check.id]: e.target.checked })}
                            />
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest group-hover:text-emerald-700">{check.label}</span>
                         </label>
                      ))}
                   </div>
                   
                   <div className="mt-10 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Details</label>
                      <textarea 
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold min-h-[100px]" 
                        value={form.supplier_details} 
                        onChange={e => setForm({ ...form, supplier_details: e.target.value })} 
                        placeholder="Supplier Details" 
                      />
                   </div>
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};

export default SupplierFormModal;
