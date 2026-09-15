import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, X, Save, MapPin, ChevronLeft, 
  Trash2, Edit2, Palette, Loader2, ChevronRight, Eye, 
  Globe, Building2, User, Filter, MoreHorizontal, MoreVertical
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './SalesOrder.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const AddressList = () => {
  const [addresses, setAddresses] = useState([]);
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
  const [filterType, setFilterType] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState({
    address_title: '',
    address_type: 'Billing',
    address_line1: '',
    address_line2: '',
    city: '',
    county: '',
    state: '',
    country: 'United Arab Emirates',
    pincode: '',
    email_id: '',
    phone: '',
    is_primary_address: 0,
    is_shipping_address: 0,
    links: []
  });
  const [metaOptions, setMetaOptions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
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

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Address', {
        params: {
          fields: JSON.stringify([
            'name', 'address_title', 'address_type', 'address_line1', 
            'city', 'country', 'email_id', 'phone', 'is_primary_address'
          ]),
          order_by: 'modified desc',
          limit_page_length: 1000
        },
        withCredentials: true
      });
      setAddresses(res.data.data || []);
      setTotal(res.data.data.length);
    } catch (err) {
      console.error('Failed to load addresses:', err);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const fetchAddressDetails = async (name) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_address_details`, {
        params: { address_id: name },
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
    if (!formData.address_title || !formData.address_line1 || !formData.city) {
      Swal.fire('Required Fields', 'Please provide Title, Address Line 1 and City.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_PATH}.save_address`, {
        address_data: formData
      }, { withCredentials: true });

      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Address Saved', timer: 1500, showConfirmButton: false });
        closeModal();
        fetchAddresses();
      } else {
        throw new Error(res.data.message?.message || 'Save failed');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr) => {
    setIsEditMode(true);
    setIsViewMode(false);
    fetchAddressDetails(addr.name);
    setShowModal(true);
  };

  const handleView = (addr) => {
    setIsViewMode(true);
    setIsEditMode(false);
    fetchAddressDetails(addr.name);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setIsViewMode(false);
    setFormData({
      address_title: '', address_type: 'Billing', address_line1: '',
      address_line2: '', city: '', state: '', country: 'United Arab Emirates',
      pincode: '', email_id: '', phone: '', is_primary_address: 0,
      is_shipping_address: 0, links: []
    });
  };

  const filteredAddresses = useMemo(() => {
    return addresses.filter(a => {
      const q = filterSearch.toLowerCase();
      const matchesSearch = !filterSearch || 
        a.address_title?.toLowerCase().includes(q) || 
        a.address_line1?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q);
      const matchesType = !filterType || a.address_type === filterType;
      const matchesCity = !filterCity || a.city?.toLowerCase().includes(filterCity.toLowerCase());
      return matchesSearch && matchesType && matchesCity;
    });
  }, [addresses, filterSearch, filterType, filterCity]);

  const totalPages = Math.ceil(filteredAddresses.length / pageSize);
  const paginatedData = filteredAddresses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="so-page">
      <div className="so-page-header">
        <div className="so-page-left">
          <h1 className="so-page-title">
            <MapPin size={20} /> GLOBALLY MANAGED ADDRESSES
          </h1>
          <p className="so-page-subtitle">CENTRALIZED LOGISTICS & LOCATION REGISTRY</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="so-btn-primary" onClick={() => { setIsEditMode(false); setIsViewMode(false); setShowModal(true); }}>
            <Plus size={16} /> NEW LOCATION
          </button>
        </div>
      </div>

      <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>
        <div className="so-filter-bar" style={{ padding: '0 0 1.25rem 0', background: 'transparent', border: 'none', boxShadow: 'none', display: 'flex', gap: '1.25rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label className="so-filter-label">SEARCH ENTRY</label>
            <input 
              className="so-filter-input" 
              placeholder="Title, Name, Street..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
            />
          </div>
          <div style={{ width: '180px' }}>
            <label className="so-filter-label">ADDRESS TYPE</label>
            <select className="so-filter-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">ALL TYPES</option>
              {metaOptions.address_type?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ width: '180px' }}>
            <label className="so-filter-label">CITY FILTERS</label>
            <input 
              className="so-filter-input" 
              placeholder="Dubai, Sharjah..." 
              value={filterCity} 
              onChange={e => setFilterCity(e.target.value)} 
            />
          </div>
        </div>

        <div className="so-content" style={{ padding: 0, flex: 1, background: 'transparent' }}>
          <div className="so-table-card">
            <div className="so-table-wrapper">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>ADDRESS TITLE & REFERENCE</th>
                    <th>LOGISTICS VECTOR</th>
                    <th>CLASSIFICATION</th>
                    <th style={{ textAlign: 'center' }}>IDENTITY</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="so-empty"><Loader2 className="so-spinner" /></td></tr>
                  ) : paginatedData.length === 0 ? (
                    <tr><td colSpan="5" className="so-empty">NO ADDRESS DEFINITIONS FOUND.</td></tr>
                  ) : (
                    paginatedData.map(addr => (
                      <tr key={addr.name} onClick={() => handleView(addr)}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--so-text-heading)' }}>{addr.address_title}</div>
                          <div style={{ fontSize: '0.68rem', opacity: 0.6, fontFamily: 'monospace' }}>{addr.name}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--so-text-muted)' }}>{addr.address_line1}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColor }}>{addr.city}, {addr.country}</div>
                        </td>
                        <td>
                          <span className="so-badge" style={{ background: '#f1f5f9', color: '#475569' }}>{addr.address_type}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {addr.is_primary_address === 1 && <span className="so-badge" style={{ background: '#ecfdf5', color: '#059669', marginRight: '4px' }}>PRIMARY</span>}
                          {addr.is_shipping_address === 1 && <span className="so-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>SHIPPING</span>}
                        </td>
                        <td style={{ textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="so-btn-ghost"
                            style={{ padding: '0.35rem', borderRadius: '0.375rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId(openActionId === addr.name ? null : addr.name);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionId === addr.name && (
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
                                  handleView(addr);
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
                                  handleEdit(addr);
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
          <div className="so-modal" style={{ maxWidth: '800px' }}>
            <div className="so-modal-header">
              <h2 className="so-modal-title">
                {isViewMode ? 'VIEW GLOBAL ADDRESS' : isEditMode ? 'MODIFY REGISTRY ENTRY' : 'DEFINE NEW ADDRESS'}
              </h2>
              <button className="so-modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="so-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="so-card" style={{ marginBottom: 0 }}>
                <div className="so-card-header"><p className="so-card-title">IDENTITY & CLASSIFICATION</p></div>
                <div className="so-card-body">
                  <div className="so-form-grid">
                    <div className="so-field">
                      <label className="so-label">TITLE (IDENTIFICATION) *</label>
                      <input 
                        className="so-input" 
                        value={formData.address_title} 
                        onChange={e => setFormData({...formData, address_title: e.target.value})}
                        readOnly={isViewMode}
                      />
                    </div>
                    <div className="so-field">
                      <label className="so-label">ADDRESS CLASSIFICATION</label>
                      <select 
                        className="so-select" 
                        value={formData.address_type} 
                        onChange={e => setFormData({...formData, address_type: e.target.value})}
                        disabled={isViewMode}
                      >
                        {metaOptions.address_type?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="so-card" style={{ marginBottom: 0 }}>
                <div className="so-card-header"><p className="so-card-title">PHYSICAL LOGISTICS</p></div>
                <div className="so-card-body">
                  <div className="so-field" style={{ marginBottom: '1.25rem' }}>
                    <label className="so-label">ADDRESS LINE 1 (STREET/BUILDING) *</label>
                    <input 
                      className="so-input" 
                      value={formData.address_line1} 
                      onChange={e => setFormData({...formData, address_line1: e.target.value})}
                      readOnly={isViewMode}
                    />
                  </div>
                  <div className="so-field" style={{ marginBottom: '1.25rem' }}>
                    <label className="so-label">ADDRESS LINE 2 (UNIT/LANDMARK)</label>
                    <input 
                      className="so-input" 
                      value={formData.address_line2} 
                      onChange={e => setFormData({...formData, address_line2: e.target.value})}
                      readOnly={isViewMode}
                    />
                  </div>
                  <div className="so-form-grid">
                    <div className="so-field">
                      <label className="so-label">CITY *</label>
                      <input 
                        className="so-input" 
                        value={formData.city} 
                        onChange={e => setFormData({...formData, city: e.target.value})}
                        readOnly={isViewMode}
                      />
                    </div>
                    <div className="so-field">
                      <label className="so-label">COUNTRY</label>
                      <select 
                        className="so-select" 
                        value={formData.country} 
                        onChange={e => setFormData({...formData, country: e.target.value})}
                        disabled={isViewMode}
                      >
                        {metaOptions.countries?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {!isViewMode && (
              <div className="so-modal-footer">
                <button className="so-btn-secondary" onClick={closeModal} disabled={saving}>CANCEL REVISION</button>
                <button className="so-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={16} className="so-spinner" /> : <Save size={16} />}
                  SAVE LOCATION MATRIX
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressList;
