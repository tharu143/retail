import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { setWarehouse as updateActiveWarehouse } from '../../Redux/Slices/userSlice';
import { 
    Loader2, Save, MapPin, AlertCircle, Database, 
    RefreshCw, Trash2, Settings as SettingsIcon,
    Palette, ShieldAlert, Cpu, HardDrive, 
    CheckCircle2, ChevronRight, LayoutDashboard,
    RotateCcw, Award, Truck, Package
} from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { useCustomShortcuts, ACTION_LABELS, getShortcutStringFromEvent } from '../../hooks/useCustomShortcuts';



const Settings = () => {
    const dispatch = useDispatch();
    const activeWarehouse = useSelector((state) => state.user.warehouse);
    const company = useSelector((state) => state.user.company);
    const session = useSelector((state) => state.user.session);

    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(activeWarehouse);
    const [loading, setLoading] = useState(true);

    // Shortcuts Hook & State
    const { shortcuts, updateShortcut, resetAllShortcuts } = useCustomShortcuts();
    const [recordingAction, setRecordingAction] = useState(null); // { page, actionId }
    const [activeShortcutTab, setActiveShortcutTab] = useState('pos_home');

    // Theme Hook
    const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();

    useEffect(() => {
        if (!recordingAction) return;

        const handleRecordingKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // If Escape is pressed alone, cancel recording
            if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                setRecordingAction(null);
                const Toast = Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500
                });
                Toast.fire({
                    icon: 'info',
                    title: 'Recording cancelled'
                });
                return;
            }

            const shortcutStr = getShortcutStringFromEvent(e);
            if (shortcutStr) {
                updateShortcut(recordingAction.page, recordingAction.actionId, shortcutStr);
                setRecordingAction(null);
                
                const Toast = Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 2000,
                });
                Toast.fire({
                    icon: 'success',
                    title: `Shortcut updated: ${shortcutStr}`
                });
            }
        };

        window.addEventListener('keydown', handleRecordingKeyDown, true);
        return () => window.removeEventListener('keydown', handleRecordingKeyDown, true);
    }, [recordingAction, updateShortcut]);


    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses?company=${encodeURIComponent(company)}`, {
                    headers: { 'X-Frappe-SID': session },
                    credentials: 'include'
                });
                const data = await res.json();
                const list = data.message || [];
                setWarehouses(list);
            } catch (err) {
                console.error("Failed to fetch warehouses:", err);
            } finally {
                setLoading(false);
            }
        };

        if (company && session) {
            fetchWarehouses();
        }
    }, [company, session]);



    // Loyalty Program Settings
    const [conversionFactor, setConversionFactor] = useState(0.01);
    const [maxLoyaltyRedemption, setMaxLoyaltyRedemption] = useState(0);
    const [savingLoyalty, setSavingLoyalty] = useState(false);

    useEffect(() => {
        const fetchLoyaltySettings = async () => {
            try {
                const res = await fetch('/api/method/kyle_retail.retail_api.api.get_loyalty_settings', {
                    headers: { 'X-Frappe-SID': session },
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.message) {
                    setConversionFactor(data.message.conversion_factor || 0.01);
                    setMaxLoyaltyRedemption(data.message.max_redemption_amount || 0);
                }
            } catch (err) {
                console.error("Failed to fetch loyalty settings:", err);
            }
        };

        if (session) {
            fetchLoyaltySettings();
        }
    }, [session]);

    const handleSaveLoyaltySettings = async () => {
        setSavingLoyalty(true);
        try {
            const res = await fetch('/api/method/kyle_retail.retail_api.api.update_loyalty_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Frappe-SID': session
                },
                credentials: 'include',
                body: JSON.stringify({
                    conversion_factor: parseFloat(conversionFactor),
                    max_redemption_amount: parseFloat(maxLoyaltyRedemption)
                })
            });
            const data = await res.json();
            if (data.message && data.message.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Loyalty Rules Saved',
                    text: 'Points valuation and redemption limit updated across all POS terminals.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error("Failed to update loyalty settings.");
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: err.message
            });
        } finally {
            setSavingLoyalty(false);
        }
    };

    // Purchase Stock Workflow Settings
    const [purchaseWorkflow, setPurchaseWorkflow] = useState('PR_FIRST'); // 'PR_FIRST' or 'PI_DIRECT'

    useEffect(() => {
        const fetchPurchaseWorkflow = async () => {
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_purchase_stock_settings');
                const mode = res.data?.message?.workflow_mode || 'PR_FIRST';
                setPurchaseWorkflow(mode);
                localStorage.setItem('purchase_stock_workflow', mode);
            } catch (err) {
                console.error('Failed to fetch purchase stock settings:', err);
            }
        };
        fetchPurchaseWorkflow();
    }, []);

    const handleSavePurchaseWorkflow = async () => {
        try {
            await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.update_purchase_stock_settings', {
                workflow_mode: purchaseWorkflow
            });
            localStorage.setItem('purchase_stock_workflow', purchaseWorkflow);
        } catch (err) {
            console.error('Failed to update purchase stock settings:', err);
        }
    };

    // Base UOM Filter Settings (Packing UOMs Only)
    const [filterPackingUomsOnly, setFilterPackingUomsOnly] = useState(() => {
        const saved = localStorage.getItem('uom_filter_packing_only');
        return saved !== null ? saved === 'true' : true;
    });

    const handleSave = () => {
        if (!selectedWarehouse) {
            Swal.fire({
                icon: 'error',
                title: 'Required Field',
                text: 'Please select a primary warehouse.',
                confirmButtonColor: themeColor
            });
            return;
        }

        dispatch(updateActiveWarehouse(selectedWarehouse));
        handleSaveLoyaltySettings();
        handleSavePurchaseWorkflow();
        localStorage.setItem('uom_filter_packing_only', filterPackingUomsOnly ? 'true' : 'false');
        window.dispatchEvent(new Event('uom_setting_changed'));
        Swal.fire({
            icon: 'success',
            title: 'Settings Applied',
            text: 'Terminal configuration, UOM filter, and purchase stock workflow updated.',
            timer: 2000,
            showConfirmButton: false
        });
    };

    const handleForceReset = async () => {
        if (!navigator.onLine) {
            Swal.fire({
                title: 'Connection Required',
                text: 'System must be online to reconstruct local cache after reset.',
                icon: 'warning',
                confirmButtonColor: themeColor
            });
            return;
        }

        const unsyncedCount = await db.invoices.where('is_synced').equals(0).count();
        if (unsyncedCount > 0) {
            const result = await Swal.fire({
                title: 'Data Collision Risk!',
                text: `You have ${unsyncedCount} unsynced transactions. Resetting now will cause permanent local data loss.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#94a3b8',
                confirmButtonText: 'I Understand, Wipe Anyway'
            });
            if (!result.isConfirmed) return;
        } else {
            const result = await Swal.fire({
                title: 'Purge Local Cache?',
                text: 'This will reconstruct the items, customers, and pricing databases from scratch.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Commence Reset',
                confirmButtonColor: themeColor
            });
            if (!result.isConfirmed) return;
        }

        try {
            Swal.fire({
                title: 'Executing Purge...',
                text: 'Reconstructing environment...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            await Promise.all([
                db.items.clear(),
                db.customers.clear(),
                db.tax_templates.clear(),
                db.sync_log.clear(),
                db.invoices.clear()
            ]);

            localStorage.removeItem('last_item_sync_time');

            Swal.fire({
                icon: 'success',
                title: 'Environment Restored',
                text: 'The station will perform a fresh synchronization on the next cycle.',
                confirmButtonColor: themeColor
            });
        } catch (err) {
            Swal.fire('Restoration Failed', err.message, 'error');
        }
    };

    if (loading) return (
        <div className="so-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Loader2 size={40} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--so-text-muted)', letterSpacing: '0.05em' }}>LOADING CONFIGURATION...</p>
            </div>
        </div>
    );

    return (
        <div className="so-page">
            {/* Header */}
            <div className="so-page-header">
                <div>
                    <h1 className="so-page-title">
                        <SettingsIcon size={22} color={themeColor} />
                        Terminal Configuration
                    </h1>
                    <p className="so-page-subtitle">Manage regional station settings, stock sources, and data integrity.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={toggleTheme}

                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 1rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
                            fontSize: '0.75rem', fontWeight: 800, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={14} /> {isGreen ? 'BLUE' : 'GREEN'}


                    </button>
                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.25rem' }}></div>
                    <button className="so-btn-primary" onClick={handleSave}>
                        <Save size={18} /> Apply Changes
                    </button>
                </div>
            </div>

            <div className="so-layout">
                <main className="so-content" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
                    
                    {/* Primary Settings Column */}
                    <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Warehouse Mapping Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                <div style={{ background: `${themeColor}15`, color: themeColor, padding: '8px', borderRadius: '10px' }}>
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0 }}>Stock Source</h3>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', margin: 0 }}>Direct the station to a specific regional warehouse or stock point.</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--so-text-muted)', marginBottom: '8px' }}>Primary Warehouse</label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        className="so-filter-select"
                                        style={{ height: '48px', fontSize: '0.85rem', fontWeight: 600, paddingLeft: '1rem', background: '#f8fafc' }}
                                    >
                                        <option value="">-- DEFAULT SYSTEM ALLOCATION --</option>
                                        {warehouses.map(w => (
                                            <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                                    Changing the warehouse redirects all sales, item searches, and stock counts to the selected location instantly.
                                </p>
                            </div>
                        </div>

                        {/* Purchase Stock Workflow Configuration Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem', border: `1.5px solid ${purchaseWorkflow === 'PR_FIRST' ? '#10b98130' : '#3b82f630'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: purchaseWorkflow === 'PR_FIRST' ? '#10b98115' : '#3b82f615', color: purchaseWorkflow === 'PR_FIRST' ? '#10b981' : '#3b82f6', padding: '8px', borderRadius: '10px' }}>
                                        <Truck size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0 }}>Purchase Stock Workflow (PO ➔ PR ➔ PI)</h3>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', margin: 0 }}>Configure when physical warehouse inventory is updated during procurement.</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: purchaseWorkflow === 'PR_FIRST' ? '#059669' : '#2563eb', background: purchaseWorkflow === 'PR_FIRST' ? '#ecfdf5' : '#eff6ff', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', border: `1px solid ${purchaseWorkflow === 'PR_FIRST' ? '#a7f3d0' : '#bfdbfe'}` }}>
                                    {purchaseWorkflow === 'PR_FIRST' ? 'Stock at PR' : 'Stock at PI'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                {/* Option A: PO -> PR -> PI */}
                                <div
                                    onClick={() => setPurchaseWorkflow('PR_FIRST')}
                                    style={{
                                        border: `2px solid ${purchaseWorkflow === 'PR_FIRST' ? '#10b981' : '#e2e8f0'}`,
                                        background: purchaseWorkflow === 'PR_FIRST' ? '#f0fdf4' : '#ffffff',
                                        borderRadius: '0.75rem',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: purchaseWorkflow === 'PR_FIRST' ? '#047857' : '#334155' }}>
                                            PO ➔ PR ➔ PI
                                        </span>
                                        {purchaseWorkflow === 'PR_FIRST' && <CheckCircle2 size={16} color="#10b981" />}
                                    </div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', margin: 0, marginBottom: '6px' }}>
                                        Stock Updated at Purchase Receipt (PR)
                                    </p>
                                    <p style={{ fontSize: '0.63rem', color: '#64748b', margin: 0, lineHeight: 1.3 }}>
                                        PR posts inventory ledger entries (<code style={{ background: '#e2e8f0', padding: '1px 3px', borderRadius: '3px' }}>update_stock=1</code>). Purchase Invoice created from PR is accounting only (<code style={{ background: '#e2e8f0', padding: '1px 3px', borderRadius: '3px' }}>update_stock=0</code>).
                                    </p>
                                </div>

                                {/* Option B: PO -> PI */}
                                <div
                                    onClick={() => setPurchaseWorkflow('PI_DIRECT')}
                                    style={{
                                        border: `2px solid ${purchaseWorkflow === 'PI_DIRECT' ? '#3b82f6' : '#e2e8f0'}`,
                                        background: purchaseWorkflow === 'PI_DIRECT' ? '#eff6ff' : '#ffffff',
                                        borderRadius: '0.75rem',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: purchaseWorkflow === 'PI_DIRECT' ? '#1d4ed8' : '#334155' }}>
                                            PO ➔ PI (Direct)
                                        </span>
                                        {purchaseWorkflow === 'PI_DIRECT' && <CheckCircle2 size={16} color="#3b82f6" />}
                                    </div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', margin: 0, marginBottom: '6px' }}>
                                        Stock Updated Directly at Purchase Invoice (PI)
                                    </p>
                                    <p style={{ fontSize: '0.63rem', color: '#64748b', margin: 0, lineHeight: 1.3 }}>
                                        Purchase Invoice posts inventory ledger entries directly (<code style={{ background: '#e2e8f0', padding: '1px 3px', borderRadius: '3px' }}>update_stock=1</code>). Skips separate PR requirement.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Loyalty Program Configuration Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem', border: `1.5px solid ${themeColor}30` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: `${themeColor}15`, color: themeColor, padding: '8px', borderRadius: '10px' }}>
                                        <Award size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0 }}>Loyalty Points & Redemption Rules</h3>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', margin: 0 }}>Define point-to-Dirham conversion rate and per-customer invoice redemption limits.</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: themeColor, background: `${themeColor}15`, padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                                    Active Program
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                                {/* Point Valuation */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--so-text-muted)', marginBottom: '6px' }}>
                                        Point Valuation (AED per 1 Point)
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={conversionFactor}
                                            onChange={(e) => setConversionFactor(e.target.value)}
                                            style={{
                                                width: '100%', height: '44px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                                padding: '0 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#f8fafc'
                                            }}
                                            placeholder="0.01"
                                        />
                                        <span style={{ position: 'absolute', right: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>
                                            AED / PT
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '6px', lineHeight: '1.3' }}>
                                        Example: <b>0.01</b> means 100 points = AED 1.00 discount.
                                    </p>
                                </div>

                                {/* Max Redemption Limit */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--so-text-muted)', marginBottom: '6px' }}>
                                        Max Redemption Limit (per Bill)
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={maxLoyaltyRedemption}
                                            onChange={(e) => setMaxLoyaltyRedemption(e.target.value)}
                                            style={{
                                                width: '100%', height: '44px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                                padding: '0 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#f8fafc'
                                            }}
                                            placeholder="e.g. 50"
                                        />
                                        <span style={{ position: 'absolute', right: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>
                                            AED MAX
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '6px', lineHeight: '1.3' }}>
                                        Max AED discount allowed per transaction. Set <b>0</b> for unlimited.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Base UOM Master Filter Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem', border: `1.5px solid ${filterPackingUomsOnly ? '#10b98130' : '#e2e8f0'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: filterPackingUomsOnly ? '#10b98115' : '#64748b15', color: filterPackingUomsOnly ? '#10b981' : '#64748b', padding: '8px', borderRadius: '10px' }}>
                                        <Package size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0 }}>Base UOM Filter (Packing UOMs)</h3>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', margin: 0 }}>Control active unit options in Item Master creation form (Nos, Box, etc.).</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: filterPackingUomsOnly ? '#059669' : '#64748b', background: filterPackingUomsOnly ? '#ecfdf5' : '#f1f5f9', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', border: `1px solid ${filterPackingUomsOnly ? '#a7f3d0' : '#cbd5e1'}` }}>
                                    {filterPackingUomsOnly ? 'Packing UOMs Only' : 'All UOMs Enabled'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div
                                    onClick={() => setFilterPackingUomsOnly(true)}
                                    style={{
                                        border: `2px solid ${filterPackingUomsOnly ? '#10b981' : '#e2e8f0'}`,
                                        background: filterPackingUomsOnly ? '#f0fdf4' : '#ffffff',
                                        borderRadius: '0.75rem',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: filterPackingUomsOnly ? '#047857' : '#334155' }}>
                                            Packing UOMs Only
                                        </span>
                                        {filterPackingUomsOnly && <CheckCircle2 size={16} color="#10b981" />}
                                    </div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', margin: 0, marginBottom: '6px' }}>
                                        Nos, Box, Pcs, Pkt, Carton, Set, Pack, etc.
                                    </p>
                                    <p style={{ fontSize: '0.63rem', color: '#64748b', margin: 0, lineHeight: 1.3 }}>
                                        Restricts Base UOM dropdown to packing units. Non-packing units are disabled/hidden.
                                    </p>
                                </div>

                                <div
                                    onClick={() => setFilterPackingUomsOnly(false)}
                                    style={{
                                        border: `2px solid ${!filterPackingUomsOnly ? '#3b82f6' : '#e2e8f0'}`,
                                        background: !filterPackingUomsOnly ? '#eff6ff' : '#ffffff',
                                        borderRadius: '0.75rem',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: !filterPackingUomsOnly ? '#1d4ed8' : '#334155' }}>
                                            Show All UOMs
                                        </span>
                                        {!filterPackingUomsOnly && <CheckCircle2 size={16} color="#3b82f6" />}
                                    </div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', margin: 0, marginBottom: '6px' }}>
                                        All registered system UOMs active
                                    </p>
                                    <p style={{ fontSize: '0.63rem', color: '#64748b', margin: 0, lineHeight: 1.3 }}>
                                        Displays all unit measurements in Base UOM field without filtering.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Keyboard Shortcuts Customization Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: `${themeColor}15`, color: themeColor, padding: '8px', borderRadius: '10px' }}>
                                        <SettingsIcon size={18} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0 }}>Keyboard Shortcuts</h3>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', margin: 0 }}>Configure personalized hotkeys for POS and Document Editors.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        Swal.fire({
                                            title: 'Reset Shortcuts?',
                                            text: 'Are you sure you want to restore all keyboard shortcuts to their factory defaults?',
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonText: 'Reset',
                                            confirmButtonColor: themeColor,
                                            cancelButtonColor: '#94a3b8'
                                        }).then(res => {
                                            if (res.isConfirmed) {
                                                resetAllShortcuts();
                                                Swal.fire('Reset!', 'All shortcuts have been reset.', 'success');
                                            }
                                        });
                                    }}
                                    style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: '#64748b',
                                        background: '#f1f5f9',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
                                    onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
                                >
                                    Reset Defaults
                                </button>
                            </div>

                            {/* Section Selector */}
                            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem', gap: '1rem' }}>
                                <button
                                    onClick={() => setActiveShortcutTab('pos_home')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeShortcutTab === 'pos_home' ? `2px solid ${themeColor}` : '2px solid transparent',
                                        color: activeShortcutTab === 'pos_home' ? themeColor : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        padding: '8px 4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    POS Home Screen
                                </button>
                                <button
                                    onClick={() => setActiveShortcutTab('doc_editor')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeShortcutTab === 'doc_editor' ? `2px solid ${themeColor}` : '2px solid transparent',
                                        color: activeShortcutTab === 'doc_editor' ? themeColor : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        padding: '8px 4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Form / Doc Editors
                                </button>
                            </div>

                            {/* List of shortcuts */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                                {Object.entries(shortcuts[activeShortcutTab] || {}).map(([actionId, currentKey]) => {
                                    const isRecording = recordingAction?.page === activeShortcutTab && recordingAction?.actionId === actionId;
                                    const label = ACTION_LABELS[activeShortcutTab]?.[actionId] || actionId;
                                    return (
                                        <div key={actionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                                                {label}
                                            </div>
                                            <button
                                                onClick={() => setRecordingAction({ page: activeShortcutTab, actionId })}
                                                style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    padding: '6px 12px',
                                                    minWidth: '100px',
                                                    textAlign: 'center',
                                                    borderRadius: '6px',
                                                    border: isRecording ? `1px solid ${themeColor}` : '1px solid #cbd5e1',
                                                    background: isRecording ? `${themeColor}15` : 'white',
                                                    color: isRecording ? themeColor : '#475569',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                {isRecording ? 'Press Key...' : currentKey}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>


                        {/* System Summary Card */}
                        <div className="so-table-card" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '1rem' }}>
                                <Cpu size={16} />
                                <h4 style={{ fontSize: '0.75rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Environmental Metadata</h4>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Active Company</p>
                                    <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{company}</p>
                                </div>
                                <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Runtime Session</p>
                                    <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Verified Secure</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Secondary Info/Danger Column */}
                    <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Maintenance / Danger Zone */}
                        <div className="so-table-card" style={{ border: '1.5px solid #fee2e2', overflow: 'hidden' }}>
                            <div style={{ background: '#fef2f2', padding: '1.25rem', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ShieldAlert size={20} color="#dc2626" />
                                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>CORE MAINTENANCE</h3>
                            </div>
                            <div style={{ padding: '1.25rem' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>Cache Reconstruction</h4>
                                    <p style={{ fontSize: '0.7rem', color: '#b91c1c', lineHeight: '1.4' }}>Wipe item revisions and pricing caches. Useful if local values diverge from the central ERP.</p>
                                </div>
                                <button 
                                    onClick={handleForceReset}
                                    style={{ 
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        gap: '8px', padding: '0.75rem', background: '#dc2626', color: 'white', 
                                        borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '0.75rem',
                                        cursor: 'pointer', transition: 'opacity 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    <RotateCcw size={16} /> RESET TERMINAL CACHE
                                </button>
                            </div>
                        </div>

                        {/* Operational Card */}
                        <div style={{ background: themeLight, padding: '1.5rem', borderRadius: '12px', border: `1.5px dashed ${themeColor}40` }}>
                           <h4 style={{ color: themeColor, fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                              <AlertCircle size={18} /> STATION NOTICE
                           </h4>
                           <div style={{ fontSize: '0.75rem', color: 'var(--so-text-body)', lineHeight: '1.6' }}>
                               <p style={{ marginBottom: '8px' }}>• <b>Virtual Stock:</b> Changes to the Warehouse source will update the "Virtual Stock" counters immediately.</p>
                               <p>• <b>Posting:</b> Book records on the ERP server only reconcile after a daily **POS Closing Entry** is submitted.</p>
                           </div>
                        </div>

                    </div>

                </main>
            </div>
        </div>
    );
};

export default Settings;
