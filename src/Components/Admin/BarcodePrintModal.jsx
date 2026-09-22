import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BarcodePrintModal.css';

export default function BarcodePrintModal({ isOpen, onClose, selectedItem }) {
  const [uom, setUom] = useState('Nos');
  const [conversionFactor, setConversionFactor] = useState(1.0);
  const [barcode, setBarcode] = useState('');
  const [labelSize, setLabelSize] = useState('50x25_1up'); // 50x25_1up, 50x25_2up, 38x25_1up, custom
  const [customWidth, setCustomWidth] = useState(50);
  const [customHeight, setCustomHeight] = useState(25);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [printQty, setPrintQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [labelStyle, setLabelStyle] = useState('standard'); // 'standard' (Item + UOM + Divider + Barcode), 'barcode_only' (Barcode bars + number only)
  const [attachLoading, setAttachLoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedItem) {
      setUom(selectedItem.stock_uom || 'Nos');
      fetchOrGenerateBarcode(selectedItem.item_code, selectedItem.stock_uom || 'Nos');
    }
  }, [isOpen, selectedItem]);

  const fetchOrGenerateBarcode = async (itemCode, targetUom) => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_uom_barcodes', {
        params: { item_code: itemCode }
      });

      if (res.data?.message?.status === 'success') {
        const barcodes = res.data.message.barcodes || [];
        const match = barcodes.find(b => b.uom.toUpperCase() === targetUom.toUpperCase());
        if (match) {
          setBarcode(match.barcode);
          setLoading(false);
          return;
        }
      }

      const genRes = await axios.get('/api/method/custom_retailpos.custom_pos_features.generate_uom_barcode', {
        params: { item_code: itemCode, uom: targetUom }
      });

      if (genRes.data?.message?.status === 'success') {
        setBarcode(genRes.data.message.barcode);
      }
    } catch (err) {
      setError('Failed to fetch/generate barcode.');
    } finally {
      setLoading(false);
    }
  };

  const handleUomChange = (newUom) => {
    setUom(newUom);
    if (newUom === 'Box') {
      setConversionFactor(10.0);
    } else {
      setConversionFactor(1.0);
    }
    if (selectedItem) {
      fetchOrGenerateBarcode(selectedItem.item_code, newUom);
    }
  };

  const handleSaveBarcode = async () => {
    if (!selectedItem || !barcode) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.save_uom_barcode', {
        item_code: selectedItem.item_code,
        uom: uom,
        barcode: barcode
      });

      if (res.data?.message?.status === 'success') {
        setSuccessMsg(res.data.message.message);
      } else {
        setError(res.data?.message?.message || 'Error saving barcode.');
      }
    } catch (err) {
      setError('Failed to save barcode to item record.');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachToERPNext = async () => {
    if (!selectedItem || !barcode) return;
    try {
      setAttachLoading(true);
      setSuccessMsg('');
      setError('');

      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.generate_and_attach_barcode_image', {
        item_code: selectedItem.item_code,
        uom: uom
      });

      if (res.data?.message?.status === 'success') {
        setSuccessMsg(`✅ Barcode sticker attached to ERPNext Item record! File: ${res.data.message.file_url}`);
      } else {
        setError(res.data?.message?.message || 'Failed to attach barcode to ERPNext.');
      }
    } catch (err) {
      setError('Error communicating with ERPNext server.');
    } finally {
      setAttachLoading(false);
    }
  };

  const handleTriggerPrint = () => {
    if (!selectedItem || !barcode) return;

    let widthMm = 50;
    let heightMm = 25;
    if (labelSize === '38x25_1up') {
      widthMm = 38;
      heightMm = 25;
    } else if (labelSize === 'custom') {
      widthMm = customWidth;
      heightMm = customHeight;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=600');
    
    const labelsHtml = Array.from({ length: printQty }).map(() => `
      <div class="sticker-label ${labelStyle}">
        ${labelStyle === 'standard' ? `
          ${showStoreName ? '<div class="store-name">RETAIL SUPERSTORE</div>' : ''}
          <div class="item-name">${selectedItem.item_name || selectedItem.item_code}</div>
          <div class="uom-badge">UOM: ${uom}</div>
          <div class="divider"></div>
        ` : ''}
        <div class="barcode-svg-container">
          <svg id="barcode-svg-${barcode}"></svg>
          <div class="barcode-num">${barcode}</div>
        </div>
        ${(labelStyle === 'standard' && showPrice) ? `<div class="price-tag">AED ${parseFloat(selectedItem.standard_rate || 0).toFixed(2)}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Labels</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: ${widthMm}mm ${heightMm}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: #fff;
            }
            .sticker-label {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              box-sizing: border-box;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-after: always;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .store-name { font-size: 7px; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; }
            .item-name { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1.1; max-width: 95%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .uom-badge { font-size: 9px; font-weight: 600; color: #222; margin-bottom: 2px; }
            .divider { width: 95%; height: 1px; background-color: #000; margin: 2px 0 4px 0; }
            .barcode-svg-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 2px 0; }
            .barcode-svg-container svg { width: 90%; height: auto; max-height: 12mm; }
            .barcode-num { font-size: 10px; font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 1px; margin-top: 1px; }
            .price-tag { font-size: 9px; font-weight: bold; margin-top: 2px; }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              const svgElements = document.querySelectorAll("svg[id^='barcode-svg-']");
              svgElements.forEach(el => {
                JsBarcode(el, "${barcode}", { format: "CODE128", width: 1.4, height: 35, displayValue: false });
              });
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen || !selectedItem) return null;

  return (
    <div className="erp-overlay barcode-modal-overlay">
      <div className="erp-dialog barcode-modal-content">
        <div className="erp-dialog-edge barcode-modal-header">
          <h3>🖨️ Barcode Generator & Thermal Label Print</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="erp-dialog-body barcode-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <div className="erp-card item-info-card">
            <strong>Item:</strong> {selectedItem.item_code} - {selectedItem.item_name}
          </div>

          {/* UOM Selector & Conversion */}
          <div className="form-row">
            <div className="form-group">
              <label>Target UOM (Unit)</label>
              <select value={uom} onChange={(e) => handleUomChange(e.target.value)}>
                <option value="Nos">Nos (Single Piece)</option>
                <option value="Pcs">Pcs (Piece)</option>
                <option value="Box">Box (Carton / Pack)</option>
                <option value="Kg">Kg</option>
                <option value="Dozen">Dozen</option>
              </select>
            </div>

            <div className="form-group">
              <label>UOM Conversion Factor</label>
              <input 
                type="number" 
                value={conversionFactor} 
                onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Assigned UOM Barcode *</label>
            <div className="barcode-input-row">
              <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              <button className="erp-button erp-button-secondary btn-secondary" onClick={handleSaveBarcode} disabled={loading}>
                Save Barcode
              </button>
              <button className="btn-attach-erp" onClick={handleAttachToERPNext} disabled={attachLoading || !barcode}>
                {attachLoading ? 'Attaching...' : '🏷️ Attach to ERPNext'}
              </button>
            </div>
          </div>

          {/* Sticker Style Preset Option */}
          <div className="form-group">
            <label>Sticker Style Format</label>
            <div className="style-toggle-buttons">
              <button 
                type="button" 
                className={`style-btn ${labelStyle === 'standard' ? 'active' : ''}`}
                onClick={() => setLabelStyle('standard')}
              >
                🏷️ Standard (Item Name + UOM + Barcode)
              </button>
              <button 
                type="button" 
                className={`style-btn ${labelStyle === 'barcode_only' ? 'active' : ''}`}
                onClick={() => setLabelStyle('barcode_only')}
              >
                📊 Compact (Barcode Bars Only)
              </button>
            </div>
          </div>

          {/* Live Barcode Preview Box (Matching user attached image) */}
          <div className="live-preview-box">
            <span className="preview-tag">LIVE STICKER PREVIEW</span>
            <div className={`sticker-preview-card ${labelStyle}`}>
              {labelStyle === 'standard' && (
                <>
                  <div className="preview-item-name">{selectedItem.item_name || selectedItem.item_code}</div>
                  <div className="preview-uom">UOM: {uom}</div>
                  <div className="preview-divider"></div>
                </>
              )}
              <div className="preview-barcode-bars">
                <svg width="180" height="40" viewBox="0 0 180 40">
                  <rect x="10" y="5" width="3" height="30" fill="#000"/>
                  <rect x="16" y="5" width="2" height="30" fill="#000"/>
                  <rect x="22" y="5" width="5" height="30" fill="#000"/>
                  <rect x="30" y="5" width="2" height="30" fill="#000"/>
                  <rect x="35" y="5" width="4" height="30" fill="#000"/>
                  <rect x="42" y="5" width="2" height="30" fill="#000"/>
                  <rect x="47" y="5" width="6" height="30" fill="#000"/>
                  <rect x="56" y="5" width="2" height="30" fill="#000"/>
                  <rect x="61" y="5" width="4" height="30" fill="#000"/>
                  <rect x="68" y="5" width="3" height="30" fill="#000"/>
                  <rect x="74" y="5" width="2" height="30" fill="#000"/>
                  <rect x="80" y="5" width="5" height="30" fill="#000"/>
                  <rect x="88" y="5" width="2" height="30" fill="#000"/>
                  <rect x="93" y="5" width="4" height="30" fill="#000"/>
                  <rect x="100" y="5" width="2" height="30" fill="#000"/>
                  <rect x="105" y="5" width="6" height="30" fill="#000"/>
                  <rect x="114" y="5" width="2" height="30" fill="#000"/>
                  <rect x="119" y="5" width="4" height="30" fill="#000"/>
                  <rect x="126" y="5" width="3" height="30" fill="#000"/>
                  <rect x="132" y="5" width="2" height="30" fill="#000"/>
                  <rect x="138" y="5" width="5" height="30" fill="#000"/>
                  <rect x="146" y="5" width="2" height="30" fill="#000"/>
                  <rect x="151" y="5" width="4" height="30" fill="#000"/>
                  <rect x="158" y="5" width="2" height="30" fill="#000"/>
                  <rect x="163" y="5" width="4" height="30" fill="#000"/>
                </svg>
              </div>
              <div className="preview-barcode-num">{barcode || '2001234567890'}</div>
            </div>
          </div>

          <div className="printer-config-box">
            <h4>⚙️ Thermal Label Print Settings</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Sticker Paper Preset</label>
                <select value={labelSize} onChange={(e) => setLabelSize(e.target.value)}>
                  <option value="50x25_1up">50mm x 25mm (1-up Standard)</option>
                  <option value="50x25_2up">50mm x 25mm (2-up Dual Column)</option>
                  <option value="38x25_1up">38mm x 25mm (1-up Compact)</option>
                  <option value="custom">Custom Dimensions (mm)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Number of Labels to Print</label>
                <input 
                  type="number" 
                  min="1" 
                  max="500" 
                  value={printQty} 
                  onChange={(e) => setPrintQty(parseInt(e.target.value) || 1)} 
                />
              </div>
            </div>

            {labelSize === 'custom' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Width (mm)</label>
                  <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Height (mm)</label>
                  <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} />
                </div>
              </div>
            )}

            <div className="checkbox-options">
              <label><input type="checkbox" checked={showStoreName} onChange={(e) => setShowStoreName(e.target.checked)} /> Store Name</label>
              <label><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> MRP / Price</label>
            </div>
          </div>

          <div className="erp-dialog-edge barcode-modal-footer">
            <button className="btn-cancel" onClick={onClose}>Close</button>
            <button className="btn-print-action" onClick={handleTriggerPrint}>
              🖨️ Print Label ({printQty})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

