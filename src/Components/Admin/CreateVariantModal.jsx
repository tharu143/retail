import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './CreateVariantModal.css';

export default function CreateVariantModal({ isOpen, onClose, onVariantCreated, templateItemCode }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateDetails, setTemplateDetails] = useState(null);
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [useCustomCode, setUseCustomCode] = useState(true);
  const [customItemCode, setCustomItemCode] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantBarcode, setVariantBarcode] = useState('');
  const [standardRate, setStandardRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (templateItemCode) {
        handleTemplateChange(templateItemCode);
      }
    } else {
      setSelectedTemplate('');
      setTemplateDetails(null);
      setSelectedAttributes({});
      setCustomItemCode('');
      setVariantName('');
      setVariantBarcode('');
      setStandardRate('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, templateItemCode]);

  const fetchTemplates = async () => {
    try {
      // Fetch items where has_variants = 1
      const res = await axios.get('/api/resource/Item', {
        params: {
          filters: JSON.stringify([['has_variants', '=', 1]]),
          fields: JSON.stringify(['name', 'item_name', 'item_group']),
          limit_page_length: 100
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
    setSelectedAttributes({});
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
        // Pre-fill initial attribute selections
        const initial = {};
        details.attributes.forEach(attr => {
          if (attr.values && attr.values.length > 0) {
            initial[attr.attribute] = attr.values[0].attribute_value;
          }
        });
        setSelectedAttributes(initial);
        generateAutoVariantCode(templateCode, initial);
      } else {
        setError(res.data?.message?.message || 'Error fetching template details.');
      }
    } catch (err) {
      setError('Failed to fetch template attribute configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeChange = (attributeName, value) => {
    const updated = { ...selectedAttributes, [attributeName]: value };
    setSelectedAttributes(updated);
    if (!useCustomCode) {
      generateAutoVariantCode(selectedTemplate, updated);
    }
  };

  const generateAutoVariantCode = (tmplCode, attrs) => {
    const attrString = Object.values(attrs).join('-');
    const autoCode = `${tmplCode}-${attrString}`.toUpperCase();
    if (!useCustomCode) {
      setCustomItemCode(autoCode);
    }
    setVariantName(`${templateDetails?.item_name || tmplCode} ${attrString}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedTemplate) {
      setError('Please select an Item Template.');
      return;
    }

    if (useCustomCode && !customItemCode.trim()) {
      setError('Please enter a custom Item Code for the variant.');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.create_custom_item_variant', {
        template_item_code: selectedTemplate,
        attribute_values: JSON.stringify(selectedAttributes),
        custom_item_code: useCustomCode ? customItemCode.trim() : null,
        item_name: variantName.trim(),
        standard_rate: standardRate ? parseFloat(standardRate) : 0,
        barcode: variantBarcode.trim() || null
      });

      if (res.data?.message?.status === 'success') {
        setSuccessMsg(res.data.message.message);
        if (onVariantCreated) {
          onVariantCreated(res.data.message);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.data?.message?.message || 'Failed to create item variant.');
      }
    } catch (err) {
      setError(err.message || 'Server error creating item variant.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="variant-modal-overlay">
      <div className="variant-modal-content">
        <div className="variant-modal-header">
          <h3>📦 Create Item Variant</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="variant-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <div className="form-group">
            <label>Select Item Template *</label>
            <select 
              value={selectedTemplate} 
              onChange={(e) => handleTemplateChange(e.target.value)}
              required
            >
              <option value="">-- Choose Template --</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name} - {t.item_name}</option>
              ))}
            </select>
          </div>

          {loading && <div className="loading-spinner">Loading Attributes...</div>}

          {templateDetails && (
            <>
              <div className="attributes-section">
                <h4>Variant Attributes</h4>
                <div className="attributes-grid">
                  {templateDetails.attributes.map(attr => (
                    <div key={attr.attribute} className="form-group">
                      <label>{attr.attribute}</label>
                      <select
                        value={selectedAttributes[attr.attribute] || ''}
                        onChange={(e) => handleAttributeChange(attr.attribute, e.target.value)}
                      >
                        {attr.values.map(val => (
                          <option key={val.attribute_value} value={val.attribute_value}>
                            {val.attribute_value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="code-mode-section">
                <label className="toggle-label">
                  <input 
                    type="checkbox" 
                    checked={useCustomCode} 
                    onChange={(e) => setUseCustomCode(e.target.checked)} 
                  />
                  <span>Manual / Custom Variant Item Code</span>
                </label>

                <div className="form-group">
                  <label>Variant Item Code *</label>
                  <input 
                    type="text" 
                    value={customItemCode} 
                    onChange={(e) => setCustomItemCode(e.target.value)} 
                    readOnly={!useCustomCode}
                    placeholder="e.g. TSHIRT-RED-XL or VAR-1004"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Variant Item Name</label>
                  <input 
                    type="text" 
                    value={variantName} 
                    onChange={(e) => setVariantName(e.target.value)} 
                    placeholder="e.g. Red T-Shirt - XL"
                  />
                </div>

                <div className="form-group">
                  <label>Variant Barcode</label>
                  <input 
                    type="text" 
                    value={variantBarcode} 
                    onChange={(e) => setVariantBarcode(e.target.value)} 
                    placeholder="Scan or enter barcode"
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Standard Selling Price (<DirhamIcon size={12} />)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={standardRate} 
                    onChange={(e) => setStandardRate(e.target.value)} 
                    placeholder="Rate override (optional)"
                  />
                </div>
              </div>
            </>
          )}

          <div className="variant-modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading || !templateDetails}>
              {loading ? 'Creating...' : 'Create Variant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
