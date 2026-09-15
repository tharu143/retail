import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, X, Save, User, ChevronLeft, 
  Trash2, Edit2, Palette, Loader2, ChevronRight, Eye, 
  Mail, Phone as PhoneIcon, Building2, Filter, MoreHorizontal, MoreVertical
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './SalesOrder.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const ContactList = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openActionId, setOpenActionId] = useState(null);

  // Theme (Emerald & Slate)
  const themeColor = '#10b981';
  const themeLight = '#f0fdf4';

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    salutation: '',
    designation: '',
    gender: '',
    email_ids: [],
    phone_nos: [],
    links: []
  });
  const [metaOptions, setMetaOptions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchMeta();
    const handleClickOutside = () => setOpenActionId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchMeta = async () => {
    try {
      const res = await axios.get(`${API_PATH}.get_address_contact_meta_options`, { withCredentials: true });
      if (res.data.message?.success) {
        setMetaOptions(res.data.message.data);
      }
    } catch (err) {
      console.error("Meta fetch failed:", err);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Contact', {
        params: {
          fields: JSON.stringify([
            'name', 'first_name', 'last_name', 'designation', 'email_id', 'mobile_no'
          ]),
          order_by: 'modified desc',
          limit_page_length: 1000
        },
        withCredentials: true
      });
      setContacts(res.data.data || []);
      setTotal(res.data.data.length);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const fetchContactDetails = async (name) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_contact_details`, {
        params: { contact_id: name },
        withCredentials: true
      });
      if (res.data.message?.success) {
        setFormData(res.data.message.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.first_name) {
      Swal.fire('Required Fields', 'First Name is mandatory.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_PATH}.save_contact`, {
        contact_data: formData
      }, { withCredentials: true });

      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Contact Saved', timer: 1500, showConfirmButton: false });
        closeModal();
        fetchContacts();
      } else {
        throw new Error(res.data.message?.message || 'Save failed');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c) => {
    setIsEditMode(true);
    setIsViewMode(false);
    fetchContactDetails(c.name);
    setShowModal(true);
  };

  const handleView = (c) => {
    setIsViewMode(true);
    setIsEditMode(false);
    fetchContactDetails(c.name);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setIsViewMode(false);
    setFormData({
      first_name: '', last_name: '', salutation: '',
      designation: '', gender: '', email_ids: [],
      phone_nos: [], links: []
    });
  };

  const addEmail = () => {
    setFormData({
      ...formData,
      email_ids: [...formData.email_ids, { email_id: '', is_primary: 0 }]
    });
  };

  const updateEmail = (index, field, value) => {
    const newEmails = [...formData.email_ids];
    newEmails[index][field] = value;
    setFormData({ ...formData, email_ids: newEmails });
  };

  const removeEmail = (index) => {
    setFormData({
      ...formData,
      email_ids: formData.email_ids.filter((_, i) => i !== index)
    });
  };

  const addPhone = () => {
    setFormData({
      ...formData,
      phone_nos: [...formData.phone_nos, { phone: '', is_primary_phone: 0, is_primary_mobile_no: 0 }]
    });
  };

  const updatePhone = (index, field, value) => {
    const newPhones = [...formData.phone_nos];
    newPhones[index][field] = value;
    setFormData({ ...formData, phone_nos: newPhones });
  };

  const removePhone = (index) => {
    setFormData({
      ...formData,
      phone_nos: formData.phone_nos.filter((_, i) => i !== index)
    });
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const q = filterSearch.toLowerCase();
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      const matchesSearch = !filterSearch || 
        name.includes(q) || 
        c.email_id?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q);
      const matchesDesignation = !filterDesignation || c.designation === filterDesignation;
      return matchesSearch && matchesDesignation;
    });
  }, [contacts, filterSearch, filterDesignation]);

  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const paginatedData = filteredContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="so-page">
      <div className="so-page-header">
        <div className="so-page-left">
          <h1 className="so-page-title">
            <User size={20} /> PERSONNEL & CONTACTS
          </h1>
          <p className="so-page-subtitle">MANAGED COMMUNICATIONS & REPRESENTATIVE REGISTRY</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="so-btn-primary" onClick={() => { setIsEditMode(false); setIsViewMode(false); setShowModal(true); }}>
            <Plus size={16} /> ADD PERSONNEL
          </button>
        </div>
      </div>

      <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>
        <div className="so-filter-bar" style={{ padding: '0 0 1.25rem 0', background: 'transparent', border: 'none', boxShadow: 'none', display: 'flex', gap: '1.25rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label className="so-filter-label">SEARCH IDENTITY</label>
            <input 
              className="so-filter-input" 
              placeholder="Name, Email, Reference..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
            />
          </div>
          <div style={{ width: '220px' }}>
            <label className="so-filter-label">DESIGNATION FILTER</label>
            <select className="so-filter-input" value={filterDesignation} onChange={e => setFilterDesignation(e.target.value)}>
              <option value="">ALL DESIGNATIONS</option>
              {metaOptions.designations?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="so-content" style={{ padding: 0, flex: 1, background: 'transparent' }}>
          <div className="so-table-card">
            <div className="so-table-wrapper">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>CONTACT IDENTITY</th>
                    <th>COMMUNICATION CHANNELS</th>
                    <th>PROFESSIONAL ROLE</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="4" className="so-empty"><Loader2 className="so-spinner" /></td></tr>
                  ) : paginatedData.length === 0 ? (
                    <tr><td colSpan="4" className="so-empty">NO PERSONNEL REGISTRATIONS FOUND.</td></tr>
                  ) : (
                    paginatedData.map(c => (
                      <tr key={c.name} onClick={() => handleView(c)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', background: themeLight, color: themeColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem' }}>
                              {c.first_name?.[0]}{c.last_name?.[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--so-text-heading)' }}>{c.first_name} {c.last_name}</div>
                              <div style={{ fontSize: '0.68rem', opacity: 0.6, fontFamily: 'monospace' }}>{c.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {c.email_id && <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={12} /> {c.email_id}</div>}
                            {c.mobile_no && <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PhoneIcon size={12} /> {c.mobile_no}</div>}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{c.designation || 'General'}</div>
                        </td>
                        <td style={{ textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="so-btn-ghost"
                            style={{ padding: '0.35rem', borderRadius: '0.375rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId(openActionId === c.name ? null : c.name);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionId === c.name && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '1rem',
                                top: '80%',
                                zIndex: 100,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                minWidth: '140px',
                                overflow: 'hidden',
                                padding: '0.35rem'
                              }}
                            >
                              <button
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  width: '100%',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#334155',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);
                                  handleView(c);
                                }}
                              >
                                <Eye size={14} style={{ color: '#0082f6' }} /> VIEW DETAILS
                              </button>
                              <button
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  width: '100%',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#334155',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);
                                  handleEdit(c);
                                }}
                              >
                                <Edit2 size={14} style={{ color: '#d97706' }} /> EDIT RECORD
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="so-modal-overlay">
          <div className="so-modal" style={{ maxWidth: '850px' }}>
            <div className="so-modal-header">
              <h2 className="so-modal-title">
                {isViewMode ? 'PERSONNEL PROFILE' : isEditMode ? 'MODIFY IDENTITY PARAMETERS' : 'REGISTER NEW PERSONNEL'}
              </h2>
              <button className="so-modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="so-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="so-card" style={{ marginBottom: 0 }}>
                <div className="so-card-header"><p className="so-card-title">CORE IDENTITY</p></div>
                <div className="so-card-body">
                  <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 2fr 2fr' }}>
                    <div className="so-field">
                      <label className="so-label">SALUTATION</label>
                      <select 
                        className="so-select"
                        value={formData.salutation}
                        onChange={e => setFormData({...formData, salutation: e.target.value})}
                        disabled={isViewMode}
                      >
                        <option value="">SELECT</option>
                        {metaOptions.salutations?.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="so-field">
                      <label className="so-label">FIRST NAME *</label>
                      <input 
                        className="so-input"
                        value={formData.first_name}
                        onChange={e => setFormData({...formData, first_name: e.target.value})}
                        readOnly={isViewMode}
                      />
                    </div>
                    <div className="so-field">
                      <label className="so-label">LAST NAME</label>
                      <input 
                        className="so-input"
                        value={formData.last_name}
                        onChange={e => setFormData({...formData, last_name: e.target.value})}
                        readOnly={isViewMode}
                      />
                    </div>
                    <div className="so-field">
                      <label className="so-label">DESIGNATION</label>
                      <select 
                        className="so-select"
                        value={formData.designation}
                        onChange={e => setFormData({...formData, designation: e.target.value})}
                        disabled={isViewMode}
                      >
                        <option value="">SELECT DESIGNATION</option>
                        {metaOptions.designations?.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="so-field">
                      <label className="so-label">GENDER</label>
                      <select 
                        className="so-select"
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value})}
                        disabled={isViewMode}
                      >
                        <option value="">SELECT</option>
                        {metaOptions.genders?.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="so-card" style={{ marginBottom: 0 }}>
                <div className="so-card-header"><p className="so-card-title">COMMUNICATION FRAMEWORK</p></div>
                <div className="so-card-body">
                   <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                         <label className="so-label" style={{ margin: 0 }}>DIGITAL CHANNELS (EMAILS)</label>
                         {!isViewMode && <button onClick={addEmail} className="so-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}><Plus size={12} /> ADD CHANNEL</button>}
                      </div>
                      <div className="so-table-wrapper" style={{ border: '1px solid var(--so-border)', borderRadius: '0.5rem' }}>
                         <table className="so-table">
                            <thead>
                               <tr>
                                  <th>EMAIL ADDRESS</th>
                                  <th style={{ width: '100px', textAlign: 'center' }}>PRIMARY</th>
                                  {!isViewMode && <th style={{ width: '50px' }}></th>}
                               </tr>
                            </thead>
                            <tbody>
                               {formData.email_ids.map((em, idx) => (
                                  <tr key={idx}>
                                     <td>
                                        <input 
                                           className="so-input" 
                                           style={{ height: '32px', fontSize: '0.75rem' }} 
                                           value={em.email_id} 
                                           onChange={e => updateEmail(idx, 'email_id', e.target.value)}
                                           readOnly={isViewMode}
                                        />
                                     </td>
                                     <td style={{ textAlign: 'center' }}>
                                        <input 
                                           type="checkbox" 
                                           checked={em.is_primary} 
                                           onChange={e => updateEmail(idx, 'is_primary', e.target.checked ? 1 : 0)} 
                                           disabled={isViewMode}
                                        />
                                     </td>
                                     {!isViewMode && (
                                        <td>
                                           <button onClick={() => removeEmail(idx)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                                        </td>
                                     )}
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>

                   <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                         <label className="so-label" style={{ margin: 0 }}>VOICE CHANNELS (PHONE/MOBILE)</label>
                         {!isViewMode && <button onClick={addPhone} className="so-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}><Plus size={12} /> ADD LINE</button>}
                      </div>
                      <div className="so-table-wrapper" style={{ border: '1px solid var(--so-border)', borderRadius: '0.5rem' }}>
                         <table className="so-table">
                            <thead>
                               <tr>
                                  <th>PHONE NUMBER</th>
                                  <th style={{ width: '80px', textAlign: 'center' }}>MOBILE</th>
                                  <th style={{ width: '80px', textAlign: 'center' }}>PRIMARY</th>
                                  {!isViewMode && <th style={{ width: '50px' }}></th>}
                               </tr>
                            </thead>
                            <tbody>
                               {formData.phone_nos.map((pn, idx) => (
                                  <tr key={idx}>
                                     <td>
                                        <input 
                                           className="so-input" 
                                           style={{ height: '32px', fontSize: '0.75rem' }} 
                                           value={pn.phone} 
                                           onChange={e => updatePhone(idx, 'phone', e.target.value)}
                                           readOnly={isViewMode}
                                        />
                                     </td>
                                     <td style={{ textAlign: 'center' }}>
                                        <input 
                                           type="checkbox" 
                                           checked={pn.is_primary_mobile_no} 
                                           onChange={e => updatePhone(idx, 'is_primary_mobile_no', e.target.checked ? 1 : 0)} 
                                           disabled={isViewMode}
                                        />
                                     </td>
                                     <td style={{ textAlign: 'center' }}>
                                        <input 
                                           type="checkbox" 
                                           checked={pn.is_primary_phone} 
                                           onChange={e => updatePhone(idx, 'is_primary_phone', e.target.checked ? 1 : 0)} 
                                           disabled={isViewMode}
                                        />
                                     </td>
                                     {!isViewMode && (
                                        <td>
                                           <button onClick={() => removePhone(idx)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                                        </td>
                                     )}
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>
              </div>
            </div>
            {!isViewMode && (
              <div className="so-modal-footer">
                <button className="so-btn-secondary" onClick={closeModal} disabled={saving}>DISCARD REVISION</button>
                <button className="so-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={16} className="so-spinner" /> : <Save size={16} />}
                  AUTHORIZE REGISTRY SAVE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactList;
