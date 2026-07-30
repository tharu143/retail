import React, { useState, useEffect } from 'react';
import { Printer, X, Calculator, Scan, CheckCircle2, Copy, FileText, Sparkles, Hash, DollarSign } from 'lucide-react';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';

const PAPER_SIZES = [
    { id: 'A5', label: 'A5', desc: '148 × 210 mm', defaultRate: 0.25 },
    { id: 'A4', label: 'A4', desc: '210 × 297 mm', defaultRate: 0.50 },
    { id: 'A3', label: 'A3', desc: '297 × 420 mm', defaultRate: 2.00 },
    { id: 'A2', label: 'A2', desc: '420 × 594 mm', defaultRate: 8.00 },
    { id: 'A1', label: 'A1', desc: '594 × 841 mm', defaultRate: 15.00 },
    { id: 'A0', label: 'A0', desc: '841 × 1189 mm', defaultRate: 30.00 },
    { id: '4x6', label: '4" × 6"', desc: 'Photo Print', defaultRate: 1.00 },
    { id: '8x10', label: '8" × 10"', desc: 'Photo Print', defaultRate: 5.00 },
];

export default function PrintJobModal({ isOpen, onClose, onAddJobToCart, themeColor = '#10b981' }) {
    const [selectedSize, setSelectedSize] = useState('A4');
    const [pageCount, setPageCount] = useState(1);
    const [copies, setCopies] = useState(1);
    const [unitRate, setUnitRate] = useState(0.50);
    const [emcBarcode, setEmcBarcode] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Auto set default rate when size changes
    const handleSizeSelect = (sizeObj) => {
        setSelectedSize(sizeObj.id);
        setUnitRate(sizeObj.defaultRate);
    };

    const totalPages = (parseInt(pageCount) || 1) * (parseInt(copies) || 1);
    const totalAmount = (totalPages * (parseFloat(unitRate) || 0)).toFixed(2);

    const handleSaveJob = async (autoAddCart = false) => {
        if (totalPages <= 0) {
            Swal.fire('Invalid Quantity', 'Pages and copies must be at least 1', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const jobData = await frappeCall({
                method: 'kyle_retail.retail_api.api.save_printing_job',
                type: 'POST',
                args: {
                    paper_size: selectedSize,
                    page_count: parseInt(pageCount) || 1,
                    copies: parseInt(copies) || 1,
                    unit_rate: parseFloat(unitRate) || 0.0,
                    existing_bar_code: emcBarcode.trim() || null,
                    notes: notes.trim() || null,
                    item_code: 'Document Print',
                    item_name: `Print Job (${selectedSize}) - ${totalPages} Pgs`
                }
            });

            if (jobData && jobData.status === 'success') {

                if (autoAddCart && onAddJobToCart) {
                    onAddJobToCart({
                        id: jobData.item_code || 'Document Print',
                        item_code: jobData.item_code || 'Document Print',
                        name: `PRINT JOB [${jobData.paper_size}] - ${jobData.total_qty} PAGES (${jobData.barcode})`,
                        price: jobData.unit_rate,
                        local_qty: jobData.total_qty,
                        stock_uom: 'Nos',
                        custom_job_barcode: jobData.barcode,
                        is_print_job: true
                    }, 'Nos', jobData.total_qty);
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    Toast.fire({ icon: 'success', title: `Print Job Loaded to Bill: AED ${jobData.total_amount}` });
                    onClose();
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Print Job Saved!',
                        html: `
                            <div style="text-align: center; padding: 10px;">
                                <p style="font-size: 14px; font-weight: 700; color: #1e293b;">Job Barcode Tag:</p>
                                <div style="background: #f8fafc; border: 2px dashed #059669; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 20px; font-weight: 900; color: #059669; letter-spacing: 2px;">
                                    ${jobData.barcode}
                                </div>
                                <p style="font-size: 12px; color: #64748b; margin-top: 10px;">Scan this barcode at POS checkout to auto-load this bill.</p>
                            </div>
                        `,
                        confirmButtonColor: themeColor
                    });
                    onClose();
                }
            } else {
                throw new Error('Save failed');
            }
        } catch (err) {
            Swal.fire('Error', err.message || 'Failed to save print job', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
                zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
            }}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#ffffff', borderRadius: '1rem', width: '100%', maxWidth: '650px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#ffffff',
                    padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '8px', borderRadius: '10px' }}>
                            <Printer size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>Print Job Calculator</h2>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Configure paper size, page count, and EMC machine barcodes.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto' }}>
                    {/* Paper Size Presets */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                            Select Paper Size
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {PAPER_SIZES.map(s => {
                                const isSelected = selectedSize === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => handleSizeSelect(s)}
                                        style={{
                                            padding: '10px 6px', borderRadius: '10px',
                                            border: isSelected ? `2px solid ${themeColor}` : '1.5px solid #e2e8f0',
                                            background: isSelected ? 'linear-gradient(135deg, #f0fdf4, #ffffff)' : '#ffffff',
                                            boxShadow: isSelected ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                                            cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                                        }}
                                    >
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: isSelected ? themeColor : '#1e293b' }}>{s.label}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{s.desc}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: isSelected ? themeColor : '#64748b', marginTop: '4px' }}>AED {s.defaultRate.toFixed(2)}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Inputs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                                Pages per Copy
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={pageCount}
                                onChange={e => setPageCount(e.target.value)}
                                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '0 10px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                                Number of Copies
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={copies}
                                onChange={e => setCopies(e.target.value)}
                                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '0 10px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                                Rate per Page (AED)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={unitRate}
                                onChange={e => setUnitRate(e.target.value)}
                                style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '0 10px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}
                            />
                        </div>
                    </div>

                    {/* EMC Machine Sticker Barcode */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Scan size={16} color={themeColor} />
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                                Machine / EMC Barcode (Optional)
                            </label>
                        </div>
                        <input
                            type="text"
                            placeholder="Scan existing machine sticker (e.g. EMC-890123)"
                            value={emcBarcode}
                            onChange={e => setEmcBarcode(e.target.value)}
                            style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '0.85rem', fontWeight: 600 }}
                        />
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                            If scanned, customers can checkout at POS simply by scanning this machine sticker.
                        </p>
                    </div>

                    {/* Total Summary Display */}
                    <div style={{
                        background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', border: '1.5px solid #a7f3d0',
                        borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857' }}>Total Volume</span>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#065f46' }}>{totalPages} Total Pages</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857' }}>Calculated Total</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>AED {totalAmount}</div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSaveJob(false)}
                        disabled={isSaving}
                        style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: `1.5px solid ${themeColor}`, background: '#ffffff', color: themeColor, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        Save Job Barcode
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSaveJob(true)}
                        disabled={isSaving}
                        style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: themeColor, color: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
                    >
                        Add to Bill Now →
                    </button>
                </div>
            </div>
        </div>
    );
}
