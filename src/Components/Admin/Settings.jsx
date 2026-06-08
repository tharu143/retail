import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setWarehouse as updateActiveWarehouse } from '../../Redux/Slices/userSlice';
import { 
    Loader2, Save, MapPin, AlertCircle, Database, 
    RefreshCw, Trash2, Settings as SettingsIcon,
    Palette, ShieldAlert, Cpu, HardDrive, 
    CheckCircle2, ChevronRight, LayoutDashboard,
    RotateCcw, Award
} from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';


const Settings = () => {
    const dispatch = useDispatch();
    const activeWarehouse = useSelector((state) => state.user.warehouse);
    const company = useSelector((state) => state.user.company);
    const session = useSelector((state) => state.user.session);

    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(activeWarehouse);
    const [loading, setLoading] = useState(true);



    // Theme Hook
    const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();


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
        Swal.fire({
            icon: 'success',
            title: 'Registry Updated',
            text: `Station source redirected to: ${selectedWarehouse}`,
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
