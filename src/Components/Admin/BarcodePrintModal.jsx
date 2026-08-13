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
      // Check existing barcodes
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

      // If not present, generate unique UOM barcode
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

    const printWindow = window.open('', '_blank', 'width=500,height=500');
    
    // Generate repeated labels for printQty
    const labelsHtml = Array.from({ length: printQty }).map(() => `
      <div className="sticker-label">
        ${showStoreName ? '<div className="store-name">RETAIL SUPERSTORE</div>' : ''}
        <div className="item-name">${selectedItem.item_name || selectedItem.item_code}</div>
        <div className="uom-badge">UOM: ${uom} ${uom === 'Box' ? `(Pack of ${conversionFactor})` : ''}</div>
        <div className="barcode-svg-container">
          <svg id="barcode-svg-${barcode}"></svg>
          <div className="barcode-num">${barcode}</div>
        </div>
        ${showPrice ? `<div className="price-tag">MRP: AED ${parseFloat(selectedItem.standard_rate || 0).toFixed(2)}</div>` : ''}
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
            }
            .sticker-label {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              box-sizing: border-box;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              page-break-after: always;
            }
            .store-name { font-size: 8px; font-weight: bold; }
            .item-name { font-size: 9px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
            .uom-badge { font-size: 7px; color: #444; }
            .barcode-num { font-size: 9px; font-family: monospace; font-weight: bold; }
            .price-tag { font-size: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              const svgElements = document.querySelectorAll("svg[id^='barcode-svg-']");
              svgElements.forEach(el => {
                JsBarcode(el, "${barcode}", { format: "CODE128", width: 1.2, height: 25, displayValue: false });
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
    <div className="barcode-modal-overlay">
      <div className="barcode-modal-content">
        <div className="barcode-modal-header">
          <h3>🖨️ Barcode Generator & Thermal Label Print</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="barcode-modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          <div className="item-info-card">
            <strong>Item:</strong> {selectedItem.item_code} - {selectedItem.item_name}
          </div>

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
              <button className="btn-secondary" onClick={handleSaveBarcode} disabled={loading}>
                Save to Item
              </button>
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

          <div className="barcode-modal-footer">
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
