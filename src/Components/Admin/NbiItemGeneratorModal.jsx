import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './NbiItemGeneratorModal.css';

export default function NbiItemGeneratorModal({ isOpen, onClose, onItemCreated, activeBranchCode }) {
  const { user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [useBranchPrefix, setUseBranchPrefix] = useState(true);
  const [nbiCode, setNbiCode] = useState('');
  const [itemName, setItemName] = useState('');

  // Main Group & Subgroup
  const [groupHierarchy, setGroupHierarchy] = useState([]);
  const [mainGroup, setMainGroup] = useState('');
  const [subgroup, setSubgroup] = useState('');

  // UOMs & Prices
  const [stockUom, setStockUom] = useState('Nos');
  const [nosPrice, setNosPrice] = useState('');
  const [enableBox, setEnableBox] = useState(false);
  const [piecesPerBox, setPiecesPerBox] = useState(12);
  const [boxPrice, setBoxPrice] = useState('');

  // Image Upload
  const [imagePreview, setImagePreview] = useState(null);
  const [imageData, setImageData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [warehousesList, setWarehousesList] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');

  const uoms = ['Nos', 'Pcs', 'Box', 'Kg', 'Ltr', 'Set', 'Packet'];

  const getBranchShortcode = (raw) => {
    if (!raw) return 'NS';
    if (raw.includes('Abu Dhabi')) return 'AD';
    if (raw.includes('Shamkha')) return 'SH';
    if (raw.includes('Khalifa City')) return 'KC';
    if (raw.includes('Ajman')) return 'AJ';
    if (raw.includes('Al Falah Village 4')) return 'F4';
    if (raw.includes('Al Falah Village 2')) return 'F2';
    if (raw.includes('Al Rayyana')) return 'RM';
    if (raw.includes('Stores')) return 'ST';
    return raw;
  };

  const rawBranch = selectedBranch || activeBranchCode || localStorage.getItem('warehouse') || '';
  const cleanBranchCode = getBranchShortcode(rawBranch);

  useEffect(() => {
    if (isOpen) {
      fetchWarehouses();
      fetchNbiCode();
      fetchGroupHierarchy();
    }
  }, [isOpen, useBranchPrefix, cleanBranchCode]);

  // Auto-calculate Box Selling Price based on (Nos Selling Price * Pieces per Box)
  useEffect(() => {
    const nosVal = parseFloat(nosPrice);
    const pcsVal = parseInt(piecesPerBox);
    if (!isNaN(nosVal) && nosVal > 0 && !isNaN(pcsVal) && pcsVal > 0) {
      setBoxPrice((nosVal * pcsVal).toFixed(2));
    }
  }, [nosPrice, piecesPerBox]);


  const fetchWarehouses = async () => {
    try {
      const res = await axios.get('/api/resource/Warehouse', {
        params: {
          filters: JSON.stringify([['is_group', '=', 0]]),
          fields: JSON.stringify(['name', 'warehouse_name']),
          limit_page_length: 100
        }
      });
      if (res.data?.data) {
        setWarehousesList(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch warehouses list.');
    }
  };

  const fetchNbiCode = async () => {
    try {
      setLoading(true);
      setError('');
      const branchParam = useBranchPrefix ? cleanBranchCode : null;
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.generate_nbi_code', {
        params: { branch_code: branchParam }
      });

      if (res.data?.message?.status === 'success') {
        setError('');
        setNbiCode(res.data.message.nbi_code);
      } else {
        setError(res.data?.message?.message || 'Error generating NBI code.');
      }
    } catch (err) {
      setError('Failed to contact server for NBI sequence.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupHierarchy = async () => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_group_hierarchy');
      if (res.data?.message?.status === 'success') {
        const list = res.data.message.hierarchy || [];
        setGroupHierarchy(list);
        if (list.length > 0) {
          setMainGroup(list[0].main_group);
          setSubgroup(list[0].subgroups?.[0] || list[0].main_group);
        }
      }
    } catch (err) {
      console.warn('Could not fetch group hierarchy');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageData(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!itemName.trim()) {
      setError('Please enter Item Name.');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.create_nbi_item', {
        item_code: nbiCode,
        item_name: itemName.trim(),
        main_group: mainGroup,
        subgroup: subgroup,
        stock_uom: stockUom,
        nos_price: nosPrice ? parseFloat(nosPrice) : 0,
        box_price: boxPrice ? parseFloat(boxPrice) : 0,
        pieces_per_box: piecesPerBox ? parseInt(piecesPerBox) : 12,
        enable_box: enableBox ? 1 : 0,
        image_data: imageData
      });

      if (res.data?.message?.status === 'success') {
        setSuccessMsg(`NBI Item ${nbiCode} created successfully!`);
        if (onItemCreated) {
          onItemCreated(res.data.message.item);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.data?.message?.message || 'Failed to create NBI item.');
      }
    } catch (err) {
      setError(err.response?.data?.exception || err.message || 'Server error creating item.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentSubgroups = groupHierarchy.find(h => h.main_group === mainGroup)?.subgroups || [];

  return (
    <div className="nbi-modal-overlay">
      <div className="nbi-modal-content">
        <div className="nbi-modal-header">
          <h3>🏷️ Create No Barcode Item (NBI)</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="nbi-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <div className="nbi-config-banner">
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={useBranchPrefix} 
                onChange={(e) => setUseBranchPrefix(e.target.checked)} 
              />
              <span>Branch-Wise NBI Suffix ({cleanBranchCode})</span>
            </label>
            <span className="nbi-preview-badge">{nbiCode || 'Generating...'}</span>
          </div>

          {isAdmin && warehousesList.length > 0 && (
            <div className="form-group">
              <label>Select Store Branch (Admin Only)</label>
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                <option value="">-- Current Logged-in Branch ({cleanBranchCode}) --</option>
                {warehousesList.map(w => (
                  <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Generated NBI Item Code *</label>
            <div className="nbi-code-input-group">
              <input type="text" value={nbiCode} readOnly className="nbi-code-field" />
              <button type="button" className="btn-refresh" onClick={fetchNbiCode} title="Regenerate Next Number">
                🔄
              </button>
            </div>
            <small className="help-text">Unique item code generated automatically for items without physical barcodes.</small>
          </div>

          <div className="form-group">
            <label>Item Name / Description *</label>
            <input 
              type="text" 
              value={itemName} 
              onChange={(e) => setItemName(e.target.value)} 
              placeholder="e.g. Eraser (Unbranded)"
              required
            />
          </div>

          {/* Group & Subgroup Cascading */}
          <div className="form-row">
            <div className="form-group">
              <label>Main Category</label>
              <select 
                value={mainGroup} 
                onChange={(e) => {
                  setMainGroup(e.target.value);
                  const subs = groupHierarchy.find(h => h.main_group === e.target.value)?.subgroups || [];
                  setSubgroup(subs[0] || e.target.value);
                }}
              >
                {groupHierarchy.map(h => (
                  <option key={h.main_group} value={h.main_group}>{h.main_group}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Item Subgroup</label>
              <select value={subgroup} onChange={(e) => setSubgroup(e.target.value)}>
                {currentSubgroups.length > 0 ? (
                  currentSubgroups.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))
                ) : (
                  <option value={mainGroup}>{mainGroup}</option>
                )}
              </select>
            </div>
          </div>

          {/* Stock UOM & Nos Price */}
          <div className="form-row">
            <div className="form-group">
              <label>Stock UOM</label>
              <select 
                value={stockUom} 
                onChange={(e) => {
                  const val = e.target.value;
                  setStockUom(val);
                  if (val === 'Box') {
                    setEnableBox(true);
                  }
                }}
              >
                {uoms.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {stockUom === 'Box' ? 'Nos' : stockUom} Selling Price (<DirhamIcon size={12} />)
              </label>
              <input 
                type="number" 
                step="0.01"
                value={nosPrice} 
                onChange={(e) => setNosPrice(e.target.value)} 
                placeholder={`Rate per ${stockUom === 'Box' ? 'Nos' : stockUom}`}
              />
            </div>
          </div>


          {/* Multi-UOM Box & Packing Section */}
          <div className="multi-uom-box-container" style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 15 }}>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
              <input 
                type="checkbox" 
                checked={enableBox} 
                onChange={(e) => setEnableBox(e.target.checked)} 
              />
              <span>Enable Box Packing (Multi-UOM)</span>
            </label>

            {enableBox && (
              <div className="form-row" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label>Packing (Nos / Box)</label>
                  <input 
                    type="number" 
                    value={piecesPerBox} 
                    onChange={(e) => setPiecesPerBox(e.target.value)} 
                    placeholder="e.g. 12"
                  />
                  <small className="help-text">{piecesPerBox || 12} Nos per 1 Box</small>
                </div>


                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Box Selling Price (<DirhamIcon size={12} />)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={boxPrice} 
                    onChange={(e) => setBoxPrice(e.target.value)} 
                    placeholder="Rate per Box"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div className="form-group">
            <label>Item Image (Optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {imagePreview ? (
                <div style={{ position: 'relative', width: 50, height: 50, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button" 
                    onClick={() => { setImagePreview(null); setImageData(null); }}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="btn-upload-img" style={{ background: '#f1f5f9', border: '1px dashed #94a3b8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  📷 Upload Image
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>

          <div className="nbi-modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading || !nbiCode}>
              {loading ? 'Creating...' : 'Create & Assign NBI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
