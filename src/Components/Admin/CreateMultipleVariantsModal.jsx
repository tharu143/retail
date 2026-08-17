import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Layers, Check, X, Box, Plus, Trash2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

export default function CreateMultipleVariantsModal({ isOpen, onClose, onVariantsCreated, templateItemCode }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateDetails, setTemplateDetails] = useState(null);
  
  // Selected attribute values: { "Size": ["Small", "Medium"], "Colour": ["Red", "Blue"] }
  const [selectedAttrMap, setSelectedAttrMap] = useState({});
  const [activeDropdownAttr, setActiveDropdownAttr] = useState(null);
  const [searchTermMap, setSearchTermMap] = useState({});

  // Generated Variant Matrix: [ { id, attribute_values, custom_item_code, item_name, standard_rate, enabled: true } ]
  const [variantRows, setVariantRows] = useState([]);
  const [codePrefix, setCodePrefix] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (templateItemCode) {
        handleTemplateChange(templateItemCode);
      }
    } else {
      resetState();
    }
  }, [isOpen, templateItemCode]);

  const resetState = () => {
    setSelectedTemplate('');
    setTemplateDetails(null);
    setSelectedAttrMap({});
    setActiveDropdownAttr(null);
    setSearchTermMap({});
    setVariantRows([]);
    setCodePrefix('');
    setDefaultRate('');
    setError('');
    setSuccessMsg('');
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/resource/Item', {
        params: {
          filters: JSON.stringify([['has_variants', '=', 1]]),
          fields: JSON.stringify(['name', 'item_name', 'item_group', 'standard_rate']),
          limit_page_length: 200
        }
      });
      setTemplates(res.data?.data || []);
    } catch (err) {
      setError('Failed to load item templates.');
    }
  };

  const handleTemplateChange = async (templateCode) => {
    setSelectedTemplate(templateCode);
    setTemplateDetails(null);
    setSelectedAttrMap({});
    setVariantRows([]);
    setError('');

    if (!templateCode) return;

    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_template_details', {
        params: { template_item_code: templateCode }
      });

      if (res.data?.message?.status === 'success') {
        const details = res.data.message;
        setTemplateDetails(details);
        setCodePrefix(details.template_item_code || templateCode);

        // Pre-select empty lists for all attributes
        const initialMap = {};
        (details.attributes || []).forEach(attr => {
          initialMap[attr.attribute] = [];
        });
        setSelectedAttrMap(initialMap);
      } else {
        setError(res.data?.message?.message || 'Error fetching template details.');
      }
    } catch (err) {
      setError('Failed to fetch template attributes.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection of attribute value
  const handleToggleValue = (attrName, value) => {
    const current = selectedAttrMap[attrName] || [];
    let updated;
    if (current.includes(value)) {
      updated = current.filter(v => v !== value);
    } else {
      updated = [...current, value];
    }
    const nextMap = { ...selectedAttrMap, [attrName]: updated };
    setSelectedAttrMap(nextMap);
    generateCombinations(nextMap, codePrefix, defaultRate);
  };

  // Select all values for an attribute
  const handleSelectAllForAttr = (attrName, allVals) => {
    const nextMap = { ...selectedAttrMap, [attrName]: allVals.map(v => v.attribute_value) };
    setSelectedAttrMap(nextMap);
    generateCombinations(nextMap, codePrefix, defaultRate);
  };

  // Clear values for an attribute
  const handleClearAttr = (attrName) => {
    const nextMap = { ...selectedAttrMap, [attrName]: [] };
    setSelectedAttrMap(nextMap);
    generateCombinations(nextMap, codePrefix, defaultRate);
  };

  // Cartesian product algorithm to generate all combinations (ERPNext logic)
  const generateCombinations = (attrMap, prefix, rate) => {
    const entries = Object.entries(attrMap).filter(([_, vals]) => vals && vals.length > 0);
    if (entries.length === 0) {
      setVariantRows([]);
      return;
    }

    // Check if every attribute defined on template has at least one value
    const totalTemplateAttrs = (templateDetails?.attributes || []).length;
    if (entries.length < totalTemplateAttrs) {
      // Incomplete attributes selected
      setVariantRows([]);
      return;
    }

    let combinations = [{}];
    entries.forEach(([attrName, values]) => {
      const temp = [];
      combinations.forEach(combo => {
        values.forEach(val => {
          temp.push({ ...combo, [attrName]: val });
        });
      });
      combinations = temp;
    });

    const rows = combinations.map((combo, idx) => {
      const valArray = Object.values(combo);
      const valString = valArray.join('-');
      const pfx = prefix || templateDetails?.template_item_code || 'ITEM';
      const autoCode = `${pfx}-${valString}`.toUpperCase();
      const autoName = `${templateDetails?.item_name || pfx} ${valString}`;

      return {
        id: `var-${idx}-${Date.now()}`,
        attribute_values: combo,
        custom_item_code: autoCode,
        item_name: autoName,
        barcode: '',
        image: templateDetails?.image || '',
        standard_rate: rate !== '' ? rate : (templateDetails?.standard_rate || 0),
        enabled: true
      };
    });

    setVariantRows(rows);
  };

  const handleUpdateRow = (idx, field, val) => {
    setVariantRows(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleRemoveRow = (idx) => {
    setVariantRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleApplyGlobalRate = () => {
    if (defaultRate === '') return;
    setVariantRows(prev => prev.map(r => ({ ...r, standard_rate: defaultRate })));
  };

  const handleRegenerateCodes = () => {
    if (!codePrefix.trim()) return;
    setVariantRows(prev => prev.map(r => {
      const valString = Object.values(r.attribute_values).join('-');
      return {
        ...r,
        custom_item_code: `${codePrefix.trim()}-${valString}`.toUpperCase()
      };
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const enabledRows = variantRows.filter(r => r.enabled);
    if (enabledRows.length === 0) {
      setError('No variants selected for creation.');
      return;
    }

    // Check duplicate codes in payload
    const codes = enabledRows.map(r => r.custom_item_code.trim());
    const uniqueCodes = new Set(codes);
    if (codes.some(c => !c)) {
      setError('All variants must have a valid Item Code.');
      return;
    }
    if (uniqueCodes.size !== codes.length) {
      setError('Duplicate Item Codes detected among variants. Please ensure all codes are unique.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = enabledRows.map(r => ({
        attribute_values: r.attribute_values,
        custom_item_code: r.custom_item_code.trim(),
        item_name: r.item_name.trim(),
        barcode: (r.barcode || '').trim() || null,
        image: r.image || null,
        standard_rate: r.standard_rate ? parseFloat(r.standard_rate) : 0
      }));

      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.create_multiple_custom_item_variants', {
        template_item_code: selectedTemplate,
        variants_data: JSON.stringify(payload)
      });

      const data = res.data?.message || {};
      if (data.status === 'success' || data.created_count > 0) {
        setSuccessMsg(data.message || `Successfully created ${data.created_count} variants!`);
        if (onVariantsCreated) {
          onVariantsCreated(data);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(data.message || 'Failed to create variants. Check console for details.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Server error creating variants.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalPossibleCombos = (templateDetails?.attributes || []).reduce((acc, a) => {
    const count = (selectedAttrMap[a.attribute] || []).length;
    return acc * (count > 0 ? count : 0);
  }, (templateDetails?.attributes || []).length > 0 ? 1 : 0);

  return (
    <div className="variant-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.75)', zIndex: 10000 }}>
      <div 
        className="variant-modal-content" 
        style={{ 
          maxWidth: '920px', 
          width: '95vw', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #4338ca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} color="#c7d2fe" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                Select Attribute Values (Multiple Variants)
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#a5b4fc' }}>
                Choose attribute values to generate all variant combinations with custom codes
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, color: '#166534', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Template Selector */}
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
              Select Item Template *
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600, background: '#fff', color: '#0f172a', outline: 'none' }}
              required
            >
              <option value="">-- Choose Template Item --</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name} — {t.item_name} ({t.item_group})</option>
              ))}
            </select>
          </div>

          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#4f46e5', fontWeight: 700, fontSize: '0.9rem' }}>
              Loading Template Attributes & Values...
            </div>
          )}

          {templateDetails && (
            <>
              {/* STEP 1: Attribute Value Multi-Select Tag Controls (ERPNext Exact Style) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. Select Attribute Values
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    Select at least one value per attribute to generate combinations
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(templateDetails.attributes || []).map(attr => {
                    const selectedVals = selectedAttrMap[attr.attribute] || [];
                    const allVals = attr.values || [];
                    const searchTerm = (searchTermMap[attr.attribute] || '').toLowerCase();
                    const filteredVals = allVals.filter(v => 
                      v.attribute_value.toLowerCase().includes(searchTerm) || 
                      (v.abbr && v.abbr.toLowerCase().includes(searchTerm))
                    );

                    return (
                      <div 
                        key={attr.attribute}
                        style={{
                          background: '#fff',
                          border: '1.5px solid #e0e7ff',
                          borderRadius: 12,
                          padding: '14px 16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b' }}>
                              {attr.attribute}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: selectedVals.length > 0 ? '#e0e7ff' : '#f1f5f9', color: selectedVals.length > 0 ? '#4338ca' : '#64748b', padding: '2px 8px', borderRadius: 12 }}>
                              {selectedVals.length} selected
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleSelectAllForAttr(attr.attribute, allVals)}
                              style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
                            >
                              Select All
                            </button>
                            {selectedVals.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearAttr(attr.attribute)}
                                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Selected Tag Pills Box */}
                        <div 
                          style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 8, 
                            minHeight: 44, 
                            padding: '8px 10px', 
                            background: '#f8fafc', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: 8,
                            alignItems: 'center'
                          }}
                        >
                          {selectedVals.map(val => (
                            <span
                              key={val}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#ffffff',
                                border: '1.5px solid #818cf8',
                                color: '#1e1b4b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: 8,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                            >
                              {val}
                              <X
                                size={13}
                                style={{ cursor: 'pointer', color: '#6366f1' }}
                                onClick={() => handleToggleValue(attr.attribute, val)}
                              />
                            </span>
                          ))}

                          {/* Inline Search Input */}
                          <input
                            type="text"
                            placeholder={selectedVals.length === 0 ? `Click to choose or type ${attr.attribute}...` : 'Type to filter options...'}
                            value={searchTermMap[attr.attribute] || ''}
                            onFocus={() => setActiveDropdownAttr(attr.attribute)}
                            onChange={(e) => setSearchTermMap({ ...searchTermMap, [attr.attribute]: e.target.value })}
                            style={{
                              flex: 1,
                              minWidth: 160,
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.84rem',
                              color: '#334155',
                              padding: '4px'
                            }}
                          />
                        </div>

                        {/* Attribute Value Selection Dropdown / Badges */}
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 130, overflowY: 'auto', padding: '4px 2px' }}>
                          {filteredVals.map(val => {
                            const isSelected = selectedVals.includes(val.attribute_value);
                            return (
                              <button
                                key={val.attribute_value}
                                type="button"
                                onClick={() => handleToggleValue(attr.attribute, val.attribute_value)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: 8,
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  border: isSelected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                                  background: isSelected ? '#4f46e5' : '#ffffff',
                                  color: isSelected ? '#ffffff' : '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}
                              >
                                {isSelected && <Check size={12} />}
                                <span>{val.attribute_value}</span>
                                {val.abbr && (
                                  <span style={{ fontSize: '0.7rem', opacity: isSelected ? 0.85 : 0.6 }}>
                                    ({val.abbr})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {filteredVals.length === 0 && (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '4px' }}>
                              No matching attribute values found.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: Combinations Generation & Custom Code / Rate Override */}
              {variantRows.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f3ff', padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd6fe' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={18} color="#7c3aed" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#5b21b6' }}>
                        2. Generated Variants Matrix ({variantRows.length} combinations)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', background: '#fff', padding: '3px 10px', borderRadius: 20, border: '1px solid #c4b5fd' }}>
                      Ready to create in ERPNext
                    </span>
                  </div>

                  {/* Batch Controls Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Item Code Prefix
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          value={codePrefix}
                          onChange={(e) => setCodePrefix(e.target.value)}
                          placeholder="e.g. TSHIRT"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          onClick={handleRegenerateCodes}
                          style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Apply Prefix
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        Standard Selling Rate (<DirhamIcon size={10} />)
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          step="0.01"
                          value={defaultRate}
                          onChange={(e) => setDefaultRate(e.target.value)}
                          placeholder="Rate override"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyGlobalRate}
                          style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Apply Rate
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 2 }}>
                          <th style={{ padding: '10px 12px', width: 40 }}>
                            <input
                              type="checkbox"
                              checked={variantRows.every(r => r.enabled)}
                              onChange={(e) => setVariantRows(prev => prev.map(r => ({ ...r, enabled: e.target.checked })))}
                            />
                          </th>
                          <th style={{ padding: '10px 12px' }}>Variant Combination</th>
                          <th style={{ padding: '10px 12px' }}>Variant Item Code *</th>
                          <th style={{ padding: '10px 12px' }}>Variant Item Name</th>
                          <th style={{ padding: '10px 12px' }}>Barcode</th>
                          <th style={{ padding: '10px 12px', width: 100 }}>Rate (<DirhamIcon size={10} />)</th>
                          <th style={{ padding: '10px 12px', width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantRows.map((row, idx) => (
                          <tr 
                            key={row.id} 
                            style={{ 
                              borderBottom: '1px solid #f1f5f9', 
                              background: row.enabled ? '#fff' : '#f8fafc',
                              opacity: row.enabled ? 1 : 0.6
                            }}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="checkbox"
                                checked={row.enabled}
                                onChange={(e) => handleUpdateRow(idx, 'enabled', e.target.checked)}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#4338ca' }}>
                              {Object.entries(row.attribute_values).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.custom_item_code}
                                onChange={(e) => handleUpdateRow(idx, 'custom_item_code', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace' }}
                                required
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.item_name}
                                onChange={(e) => handleUpdateRow(idx, 'item_name', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.barcode || ''}
                                placeholder="Scan/Enter barcode"
                                onChange={(e) => handleUpdateRow(idx, 'barcode', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                step="0.01"
                                value={row.standard_rate}
                                onChange={(e) => handleUpdateRow(idx, 'standard_rate', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                                title="Remove variant combination"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            {variantRows.filter(r => r.enabled).length} of {variantRows.length} variant(s) selected
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 20px', borderRadius: 8, background: '#fff', border: '1.5px solid #cbd5e1', color: '#475569', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || variantRows.filter(r => r.enabled).length === 0}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: submitting || variantRows.filter(r => r.enabled).length === 0 ? 'not-allowed' : 'pointer',
                opacity: submitting || variantRows.filter(r => r.enabled).length === 0 ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Creating Variants...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Create {variantRows.filter(r => r.enabled).length} Variant(s)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
