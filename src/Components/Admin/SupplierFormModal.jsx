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
    supplier_group: '',
    supplier_type: 'Company',
    disabled: false,
    tax_id: '',
    website: '',
    email_id: '',
    mobile_no: '',
    address: '',
    contact_person: '',
    currency: 'AED'
  });

  const [saving, setSaving] = useState(false);
  const [supplierGroups, setSupplierGroups] = useState(['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler', 'Retailer']);

  useEffect(() => {
    if (editingSupplier) {
      setForm({ ...editingSupplier, disabled: !!editingSupplier.disabled });
    } else {
      setForm({
        supplier_name: '', supplier_group: '', supplier_type: 'Company',
        disabled: false, tax_id: '', website: '', email_id: '', mobile_no: '',
        address: '', contact_person: '', currency: 'AED'
      });
    }
  }, [editingSupplier, isOpen]);

  useEffect(() => {
     const fetchMeta = async () => {
        try {
           const res = await axios.get('/api/resource/Supplier Group?fields=["name"]&limit=50', { withCredentials: true });
           const groups = (res.data?.data || []).map(g => g.name).filter(Boolean);
           if (groups.length > 0) setSupplierGroups(groups);
        } catch (e) { /* keep defaults */ }
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
      const payload = { ...form, disabled: form.disabled ? 1 : 0 };
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
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                       {editingSupplier ? 'Revise Partner Profile' : 'Onboard New Partner'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Authority Control</p>
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
                {saving ? 'Processing...' : 'Confirm Registration'}
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
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Primary Metadata</h3>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier Heading *</label>
                      <input className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 font-sans" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="Organization Name" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Business Group *</label>
                      <select className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 appearance-none font-sans" value={form.supplier_group} onChange={e => setForm({ ...form, supplier_group: e.target.value })}>
                         <option value="">Select Group</option>
                         {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Entity Classification</label>
                      <select className="w-full h-14 px-6 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-xs font-bold text-slate-700 appearance-none font-sans" value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value })}>
                         <option value="Company">Corporate / B2B</option>
                         <option value="Individual">Individual / B2C</option>
                      </select>
                   </div>
                </div>
             </div>

             {/* Communication & Physics */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                   <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                      <Globe size={18} className="text-emerald-500" strokeWidth={3} />
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Connective Vectors</h3>
                   </div>
                   <div className="p-10 space-y-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Digital Protocol (Email)</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" type="email" value={form.email_id} onChange={e => setForm({ ...form, email_id: e.target.value })} placeholder="email@organization.com" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile Vector</label>
                         <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.mobile_no} onChange={e => setForm({ ...form, mobile_no: e.target.value })} placeholder="+00 000 0000" />
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                   <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                      <MapPin size={18} className="text-emerald-500" strokeWidth={3} />
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Geographic Hub</h3>
                   </div>
                   <div className="p-10">
                      <textarea className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold min-h-[148px]" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full Logistic Coordinates" />
                   </div>
                </div>
             </div>

             {/* Fiscal Framework */}
             <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                   <CreditCard size={18} className="text-emerald-500" strokeWidth={3} />
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Economic Sovereignty</h3>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tax Registry ID (TRN)</label>
                      <input className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} placeholder="VAT # / TRN #" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Base Currency</label>
                      <select className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                         <option value="AED">AED - Dirham</option>
                         <option value="USD">USD - Dollar</option>
                         <option value="EUR">EUR - Euro</option>
                      </select>
                   </div>
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};

export default SupplierFormModal;
