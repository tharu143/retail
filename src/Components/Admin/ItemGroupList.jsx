import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Loader2, ChevronLeft, ChevronRight, Palette, Layers } from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

function ItemGroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Theme toggle (synced across pages)
  const [itTheme, setItTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = itTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', itTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [itTheme, themeColor, themeColorHover, themeLight]);

  const [filterName, setFilterName] = useState('');
  const [filterPath, setFilterPath] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_group_name: '',
    parent_item_group: 'All Item Groups'
  });
  const [saving, setSaving] = useState(false);

  const [parentGroups, setParentGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (groupSearch.trim()) {
        fetchParentGroups(groupSearch);
      } else {
        setParentGroups([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearch]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
        { withCredentials: true }
      );
      if (res.data.message?.success) {
        setGroups(res.data.message.data || []);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load item groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchParentGroups = async (q) => {
    try {
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
        { params: { search: q }, withCredentials: true }
      );
      if (res.data.success) {
        setParentGroups(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.item_group_name.trim()) {
      alert('Item Group Name is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item_group',
        {
          item_group_name: form.item_group_name.trim(),
          parent_item_group: form.parent_item_group
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        alert(res.data.message);
        setShowForm(false);
        setForm({ item_group_name: '', parent_item_group: 'All Item Groups' });
        fetchGroups();
      } else {
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return groups.filter(g => {
      const nameMatch = !filterName || g.label.toLowerCase().includes(filterName.toLowerCase());
      const pathMatch = !filterPath || g.label.toLowerCase().includes(filterPath.toLowerCase());
      return nameMatch && pathMatch;
    });
  }, [groups, filterName, filterPath]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title">
              <Layers size={20} /> Item Groups
            </h1>
            <p className="so-page-subtitle">{filtered.length} group(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setItTheme(isGreen ? 'blue' : 'green')}
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
              {itTheme.toUpperCase()}
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="so-btn-primary"
            >
              <Plus size={16} /> Add Item Group
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          {/* Top Filters Bar */}
          <div className="so-filter-bar" style={{ 
            background: 'white', 
            padding: '1.25rem 2rem', 
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end'
          }}>
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Group Name</label>
              <input
                type="text"
                placeholder="Search by name..."
                value={filterName}
                onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Full Path</label>
              <input
                type="text"
                placeholder="Search by path..."
                value={filterPath}
                onChange={e => { setFilterPath(e.target.value); setCurrentPage(1); }}
                className="so-filter-input"
              />
            </div>

            <button
              onClick={() => { setFilterName(''); setFilterPath(''); setCurrentPage(1); }}
              className="so-clear-btn"
              style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}
            >
              Clear
            </button>
          </div>

          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{filtered.length} record(s) found</p>
            <div className="so-table-card">
              <div className="so-table-wrapper">
                {loading ? (
                  <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading groups...</p>
                  </div>
                ) : paginated.length === 0 ? (
                  <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--so-text-heading)' }}>
                      No groups found
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--so-text-muted)', marginTop: '0.5rem' }}>
                      {groups.length === 0 ? 'Start by adding your first group.' : 'Try adjusting your filters.'}
                    </p>
                  </div>
                ) : (
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Full Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((group) => (
                        <tr key={group.value}>
                          <td style={{ fontWeight: 700, color: themeColor }}>
                            {group.label.split(' > ').pop()}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--so-text-muted)' }}>
                            {group.label}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {!loading && filtered.length > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 50, 100, 500].map(size => (
                        <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{size}</button>
                      ))}
                    </div>
                    
                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages || 1}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Group Modal */}
        {showForm && (
          <div className="so-modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
            <div className="so-modal" style={{ maxWidth: '450px' }}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">New Item Group</h2>
                <button onClick={() => setShowForm(false)} className="so-modal-close">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="so-modal-body" style={{ gap: '1.5rem' }}>
                <div className="so-field">
                  <label className="so-label">Item Group Name <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                  <input
                    type="text"
                    value={form.item_group_name}
                    onChange={e => setForm({ ...form, item_group_name: e.target.value })}
                    className="so-input"
                    placeholder="e.g., Electronics"
                    required
                    autoFocus
                  />
                </div>

                <div className="so-field">
                  <label className="so-label">Parent Item Group</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      placeholder="Search for parent group..."
                      className="so-input"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    
                    {groupSearch && (
                      <div className="so-dropdown" style={{ top: '100%', left: 0, right: 0, marginTop: '4px' }}>
                        {parentGroups.length === 0 ? (
                          <div className="so-dropdown-item" style={{ color: 'var(--so-text-muted)', textAlign: 'center' }}>No groups found</div>
                        ) : (
                          parentGroups.map((group) => (
                            <div
                              key={group.value}
                              onClick={() => {
                                setForm({ ...form, parent_item_group: group.value });
                                setGroupSearch('');
                              }}
                              className="so-dropdown-item"
                            >
                              {group.label}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>
                    Selected: <span style={{ color: themeColor }}>{form.parent_item_group}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="so-btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="so-btn-primary"
                    style={{ flex: 1, minWidth: '100px' }}
                  >
                    {saving ? <><Loader2 size={14} className="so-spinner" /> Saving...</> : 'Save Group'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ItemGroupList;
