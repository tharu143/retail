import React, { useState, useEffect } from 'react';
import { Zap, X, Scan, DollarSign } from 'lucide-react';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';

export default function FastPrintModal({ isOpen, onClose, onAddJobToCart, themeColor = '#10b981' }) {
    const [amount, setAmount] = useState('');
    const [emcBarcode, setEmcBarcode] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSaveJob = async (autoAddCart = false) => {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Swal.fire('Invalid Amount', 'Please enter a valid total amount greater than 0', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const jobData = await frappeCall({
                method: 'kyle_retail.retail_api.api.save_printing_job',
                type: 'POST',
                args: {
                    paper_size: 'Fast Print',
                    page_count: 1,
                    copies: 1,
                    unit_rate: parsedAmount,
                    existing_bar_code: emcBarcode.trim() || null,
                    notes: notes.trim() || null,
                    item_code: 'Document Print',
                    item_name: `Fast Print Job (AED ${parsedAmount.toFixed(2)})`,
                    pos_profile: localStorage.getItem('pos_profile') || null
                }
            });

            if (jobData && jobData.status === 'success') {
                if (autoAddCart && onAddJobToCart) {
                    onAddJobToCart({
                        id: jobData.item_code || 'Document Print',
                        item_code: jobData.item_code || 'Document Print',
                        name: `FAST PRINT [AED ${parsedAmount.toFixed(2)}] (${jobData.barcode})`,
                        price: parsedAmount,
                        actual_qty: 1,
                        local_qty: 1,
                        stock_uom: 'Nos',
                        custom_job_barcode: jobData.barcode,
                        is_print_job: true,
                        is_tax_inclusive: true
                    }, 'Nos', 1);

                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    Toast.fire({ icon: 'success', title: `Fast Print Loaded to Bill: AED ${parsedAmount.toFixed(2)}` });
                    onClose();
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Fast Print Job Saved!',
                        html: `
                            <div style="text-align: center; padding: 10px;">
                                <p style="font-size: 14px; font-weight: 700; color: #1e293b;">Job Barcode Tag:</p>
                                <div style="background: #f8fafc; border: 2px dashed #e11d48; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 20px; font-weight: 900; color: #e11d48; letter-spacing: 2px;">
                                    ${jobData.barcode}
                                </div>
                                <p style="font-size: 12px; color: #64748b; margin-top: 10px;">Scan this barcode at POS checkout to auto-load this bill.</p>
                            </div>
                        `,
                        confirmButtonColor: '#e11d48'
                    });
                    onClose();
                }
            } else {
                throw new Error('Save failed');
            }
        } catch (err) {
            Swal.fire('Error', err.message || 'Failed to save Fast Print job', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNumpadClick = (val) => {
        if (val === 'C') {
            setAmount('');
        } else if (val === '⌫') {
            setAmount(prev => prev.slice(0, -1));
        } else if (val === '.') {
            if (!amount.includes('.')) {
                setAmount(prev => prev + '.');
            }
        } else {
            setAmount(prev => prev + val);
        }
    };

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
                    background: '#ffffff', borderRadius: '1rem', width: '100%', maxWidth: '480px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #881337, #e11d48)', color: '#ffffff',
                    padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '8px', borderRadius: '10px' }}>
                            <Zap size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>Fast Print (Direct Amount)</h2>
                            <p style={{ fontSize: '0.75rem', color: '#fecdd3', margin: 0 }}>Enter total amount directly & assign machine barcode</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Amount Input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                            Total Amount (AED)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: '#e11d48', fontSize: '1.1rem' }}>
                                AED
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{
                                    width: '100%', height: '48px', borderRadius: '10px',
                                    border: '2px solid #fda4af', paddingLeft: '55px', paddingRight: '12px',
                                    fontSize: '1.4rem', fontWeight: 900, color: '#881337', background: '#fff1f2'
                                }}
                            />
                        </div>
                    </div>

                    {/* Calculator Numpad */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '.', '0', '00', '5', '10'].map((btn, idx) => {
                            let bg = '#f8fafc';
                            let color = '#1e293b';
                            if (btn === 'C' || btn === '⌫') {
                                bg = '#ffe4e6';
                                color = '#e11d48';
                            } else if (btn === '5' || btn === '10') {
                                bg = '#fff1f2';
                                color = '#be123c';
                            }
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        if (btn === '5' || btn === '10') {
                                            setAmount(btn);
                                        } else {
                                            handleNumpadClick(btn);
                                        }
                                    }}
                                    style={{
                                        height: '44px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                        background: bg, color: color, fontSize: '1rem', fontWeight: 800,
                                        cursor: 'pointer', transition: 'all 0.1s'
                                    }}
                                >
                                    {btn === '5' || btn === '10' ? `AED ${btn}` : btn}
                                </button>
                            );
                        })}
                    </div>

                    {/* Machine Barcode Input */}
                    <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Scan size={16} color="#e11d48" />
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                                Machine / EMC Barcode (Optional)
                            </label>
                        </div>
                        <input
                            type="text"
                            placeholder="Scan machine sticker (e.g. EMC-890123)"
                            value={emcBarcode}
                            onChange={e => setEmcBarcode(e.target.value)}
                            style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.85rem', fontWeight: 600 }}
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                        style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1.5px solid #e11d48', background: '#ffffff', color: '#e11d48', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        Save Job Barcode
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSaveJob(true)}
                        disabled={isSaving}
                        style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,29,72,0.3)' }}
                    >
                        Add to Bill Now →
                    </button>
                </div>
            </div>
        </div>
    );
}
