import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Loader2, ChevronLeft, ChevronRight, Palette, Layers, Edit2, Package, Save, CheckCircle2, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import axios from 'axios';

export default function ItemGroupList() {
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

  // Filters
  const [filterName, setFilterName] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);

  const [form, setForm] = useState({
    item_group_name: '',
    parent_item_group: 'All Item Groups',
    is_group: 0,
    default_price_list: '',
    description: '',
    image: ''
  });

  const [saving, setSaving] = useState(false);
  const [connectedItems, setConnectedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Expand/collapse for tree view
  const [expandedNodes, setExpandedNodes] = useState({ 'All Item Groups': true });

  const toggleNode = (name, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Item Group', {
        params: {
          fields: JSON.stringify(["name", "item_group_name", "parent_item_group", "is_group", "lft", "rgt"]),
          limit_page_length: 1000,
          order_by: 'lft asc'
        },
        withCredentials: true
      });
      setGroups(res.data.data || []);
      
      // Auto-expand root level
      const rootLevel = (res.data.data || []).filter(g => !g.parent_item_group || g.parent_item_group === 'All Item Groups');
      const newExpanded = { 'All Item Groups': true };
      rootLevel.forEach(g => newExpanded[g.name] = true);
      setExpandedNodes(newExpanded);
      
    } catch (err) {
      console.error(err);
      alert('Failed to load item groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (id) => {
    try {
      const res = await axios.get(`/api/resource/Item Group/${encodeURIComponent(id)}`, {
        withCredentials: true
      });
      const data = res.data.data;
      setForm({
        item_group_name: data.item_group_name || '',
        parent_item_group: data.parent_item_group || '',
        is_group: data.is_group || 0,
        default_price_list: data.default_price_list || '',
        description: data.description || '',
        image: data.image || ''
      });
    } catch (err) {
      console.error('Failed to load details', err);
    }
  };

  const fetchConnectedItems = async (groupName) => {
    try {
      setLoadingItems(true);
      const res = await axios.get('/api/resource/Item', {
        params: {
          fields: JSON.stringify(["item_code", "item_name", "standard_rate"]),
          filters: JSON.stringify([["item_group", "=", groupName]]),
          limit_page_length: 100
        },
        withCredentials: true
      });
      setConnectedItems(res.data.data || []);
    } catch (err) {
      console.error('Failed to load items', err);
      setConnectedItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleRowClick = async (group) => {
    setIsViewMode(true);
    setIsEditMode(false);
    setEditingGroupId(group.name);
    setShowForm(true);
    await fetchGroupDetails(group.name);
    fetchConnectedItems(group.name);
  };

  const resetForm = () => {
    setForm({
      item_group_name: '',
      parent_item_group: 'All Item Groups',
      is_group: 0,
      default_price_list: '',
      description: '',
      image: ''
    });
    setIsEditMode(false);
    setIsViewMode(false);
    setEditingGroupId(null);
    setConnectedItems([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_group_name.trim()) return alert('Item Group Name is required.');

    setSaving(true);
    const payload = {
      item_group_name: form.item_group_name,
      parent_item_group: form.parent_item_group || undefined,
      is_group: form.is_group ? 1 : 0,
      default_price_list: form.default_price_list,
      description: form.description
    };

    try {
      if (isEditMode) {
        await axios.put(`/api/resource/Item Group/${encodeURIComponent(editingGroupId)}`, payload, { withCredentials: true });
        alert('Item Group updated!');
      } else {
        await axios.post('/api/resource/Item Group', payload, { withCredentials: true });
        alert('Item Group created!');
      }
      setShowForm(false);
      resetForm();
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Build tree structure for rendering
  const treeData = useMemo(() => {
    const rootNodes = [];
    const map = {};
    
    // First pass: initialize map
    groups.forEach(g => {
      map[g.name] = { ...g, children: [], depth: 0 };
    });
    
    // Second pass: build tree
    groups.forEach(g => {
      const node = map[g.name];
      if (g.parent_item_group && map[g.parent_item_group]) {
        map[g.parent_item_group].children.push(node);
      } else {
        rootNodes.push(node);
      }
    });
    
    // Compute depth recursively
    const computeDepth = (nodes, d) => {
      nodes.forEach(n => {
        n.depth = d;
        computeDepth(n.children, d + 1);
      });
    };
    computeDepth(rootNodes, 0);
    
    // Flatten tree respecting expanded state and filters
    const flat = [];
    const traverse = (node) => {
      let visible = true;
      if (filterName && !node.item_group_name.toLowerCase().includes(filterName.toLowerCase())) {
        visible = false;
        // If child matches, we still want to show parent (but this requires a different filtering logic).
        // For simplicity, we'll do standard flat filtering if filterName is used.
      }
      
      if (!filterName) {
        flat.push(node);
        if (expandedNodes[node.name]) {
          node.children.forEach(traverse);
        }
      } else {
        // If searching, ignore expanded state and show all matching
        if (node.item_group_name.toLowerCase().includes(filterName.toLowerCase())) {
           flat.push(node);
        }
        node.children.forEach(traverse);
      }
    };
    
    rootNodes.forEach(traverse);
    return flat;
  }, [groups, expandedNodes, filterName]);

  const totalPages = Math.ceil(treeData.length / pageSize);
  const paginated = treeData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div className="so-page">
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title">
              <Layers size={20} /> Item Groups structure
            </h1>
            <p className="so-page-subtitle">{treeData.length} group(s) visible</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setItTheme(isGreen ? 'blue' : 'green')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#f8fafc', border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: themeColor, cursor: 'pointer', textTransform: 'uppercase' }}
            >
              <Palette size={13} /> {itTheme}
            </button>

            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="so-btn-primary"
            >
              <Plus size={16} /> New Item Group
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          <div className="so-filter-bar" style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid var(--so-border)', display: 'flex', gap: '1.25rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Search Node</label>
              <input type="text" placeholder="Group name..." value={filterName} onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }} className="so-filter-input" />
            </div>
            <button onClick={() => { setFilterName(''); setCurrentPage(1); }} className="so-clear-btn" style={{ height: '38px', margin: 0, padding: '0 1.5rem', width: 'auto' }}>Clear</button>
          </div>

          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <div className="so-table-card">
              <div className="so-table-wrapper" style={{ overflowX: 'auto' }}>
                {loading ? (
                  <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} />
                    <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading tree...</p>
                  </div>
                ) : (
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th style={{ width: '600px' }}>Item Group Name</th>
                        <th>Parent Node</th>
                        <th style={{ textAlign: 'center' }}>Is Node?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((group) => (
                        <tr key={group.name} onClick={() => handleRowClick(group)} style={{ cursor: 'pointer' }}>
                          <td style={{ paddingLeft: `${1 + (!filterName ? group.depth * 2 : 0)}rem` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {!filterName && group.children && group.children.length > 0 ? (
                                <button onClick={(e) => toggleNode(group.name, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeColor, display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '4px' }}>
                                  {expandedNodes[group.name] ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
                                </button>
                              ) : (
                                <span style={{ width: '20px', display: 'inline-block' }}></span>
                              )}
                              <span style={{ fontWeight: 800, color: group.is_group ? themeColor : '#334155' }}>
                                {group.item_group_name}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{group.parent_item_group || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {group.is_group ? (
                              <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: 800 }}>FOLDER</span>
                            ) : (
                              <span style={{ background: `${themeColor}15`, color: themeColor, padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: 800 }}>LEAF</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {paginated.length === 0 && (
                        <tr><td colSpan="3" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>No item groups found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {!loading && treeData.length > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, treeData.length)} of {treeData.length}</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="so-pagination-btns">
                      <button className="so-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>
                      <button className="so-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRightIcon size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal for View/Edit/Create */}
        {showForm && (
          <div className="so-full-screen-view" style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="so-modal-header" style={{ padding: '1.25rem 2.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <button onClick={() => setShowForm(false)} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '0.75rem' }}><ChevronLeft size={22} /></button>
                <div>
                  <h2 className="so-modal-title" style={{ fontSize: '1.4rem', fontWeight: 900 }}>
                    {isViewMode ? form.item_group_name : (isEditMode ? 'Edit Item Group' : 'New Item Group')}
                  </h2>
                  {isViewMode && <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 800, textTransform: 'uppercase' }}>{editingGroupId}</p>}
                </div>
              </div>
            </div>

            <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', display: 'grid', gridTemplateColumns: isViewMode ? '1fr 380px' : '1fr', gap: '2.5rem', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="so-card" style={{ borderRadius: '1.5rem' }}>
                  <div className="so-card-header" style={{ padding: '1.5rem 2rem' }}>
                    <p className="so-card-title">Node Configuration</p>
                  </div>
                  <div className="so-card-body" style={{ padding: '2rem' }}>
                    <form onSubmit={handleSave} style={{ display: 'grid', gap: '2rem' }}>
                      <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="so-field">
                          <label className="so-label">Group Name *</label>
                          <input type="text" value={form.item_group_name} onChange={e => setForm({ ...form, item_group_name: e.target.value })} disabled={isViewMode} className="so-input" required />
                        </div>
                        <div className="so-field">
                          <label className="so-label">Parent Group</label>
                          <select value={form.parent_item_group} onChange={e => setForm({ ...form, parent_item_group: e.target.value })} disabled={isViewMode} className="so-input">
                            <option value="">No Parent (Root Node)</option>
                            {groups.filter(g => g.is_group).map(g => (
                              <option key={g.name} value={g.name}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="so-field">
                          <label className="so-label">Is Folder Node? (Branch)</label>
                          <select value={form.is_group} onChange={e => setForm({ ...form, is_group: parseInt(e.target.value) })} disabled={isViewMode} className="so-input">
                            <option value={1}>Yes - It is a category</option>
                            <option value={0}>No - It contains items directly</option>
                          </select>
                        </div>
                        <div className="so-field">
                          <label className="so-label">Default Price List</label>
                          <input type="text" value={form.default_price_list} onChange={e => setForm({ ...form, default_price_list: e.target.value })} disabled={isViewMode} className="so-input" placeholder="e.g. Standard Selling" />
                        </div>
                      </div>
                      
                      <div className="so-field">
                        <label className="so-label">Description / Internal Notes</label>
                        <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} disabled={isViewMode} className="so-input" rows={4}></textarea>
                      </div>

                      {!isViewMode && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                          <button type="button" onClick={() => setShowForm(false)} className="so-btn-secondary">Cancel</button>
                          <button type="submit" disabled={saving} className="so-btn-primary" style={{ padding: '0 2rem' }}>{saving ? 'Saving...' : 'Commit Node'}</button>
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </div>

              {isViewMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="so-card" style={{ borderRadius: '1.5rem', background: `${themeColor}05`, border: `1px solid ${themeColor}30` }}>
                    <div className="so-card-body" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <button onClick={() => { setIsViewMode(false); setIsEditMode(true); }} className="so-btn-primary" style={{ height: '3.5rem', width: '100%', fontSize: '1rem', fontWeight: 800, justifyContent: 'center' }}><Edit2 size={18} /> Modify Configuration</button>
                    </div>
                  </div>

                  <div className="so-card" style={{ borderRadius: '1.5rem' }}>
                    <div className="so-card-header" style={{ padding: '1.5rem 2rem', background: '#f8fafc' }}>
                      <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={16} /> Attached Items</p>
                    </div>
                    <div className="so-card-body" style={{ padding: 0 }}>
                      {loadingItems ? (
                        <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 size={24} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} /></div>
                      ) : connectedItems.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                          <Package size={32} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>No items mapped directly to this node.</p>
                        </div>
                      ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {connectedItems.map((item, idx) => (
                            <div key={idx} style={{ padding: '1rem 1.5rem', borderBottom: idx < connectedItems.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{item.item_name}</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>{item.item_code}</span>
                              </div>
                              {item.standard_rate > 0 && <span style={{ fontWeight: 800, color: themeColor, fontSize: '0.85rem' }}>AED {item.standard_rate}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
