import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { 
    Loader2, RefreshCw, AlertCircle, CheckCircle2, 
    ChevronDown, ChevronUp, FastForward, Cloud, 
    Wifi, WifiOff, Activity, ArrowRight, Palette,
    ArrowUpCircle, ArrowDownCircle, Info
} from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { useSelector } from 'react-redux';
import "../Admin/SalesOrder.css";

const SyncManager = () => {
    const [pendingInvoices, setPendingInvoices] = useState([]);
    const [pendingOpening, setPendingOpening] = useState([]);
    const [pendingClosing, setPendingClosing] = useState([]);
    const [syncLogs, setSyncLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Sync Theme
    const [syncSubTheme, setSyncSubTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = syncSubTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', syncSubTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [syncSubTheme, themeColor, themeColorHover, themeLight]);

    const fetchData = async () => {
        try {
            const pending = await db.invoices.where('is_synced').equals(0).toArray();
            const opening = await db.opening_entries.where('is_synced').equals(0).toArray();
            const closing = await db.closing_entries.where('is_synced').equals(0).toArray();
            const logs = await db.sync_log.orderBy('timestamp').reverse().limit(50).toArray();
            setPendingInvoices(pending);
            setPendingOpening(opening);
            setPendingClosing(closing);
            setSyncLogs(logs);
        } catch (err) {
            console.error("Failed to fetch sync data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    const bulkSync = async (invoicesToSync) => {
        if (!isOnline) {
            Swal.fire('Offline', "No internet connection. Please connect to sync.", 'warning');
            return;
        }

        const count = invoicesToSync.length;
        if (count === 0) return;

        Swal.fire({
            title: `Syncing ${count} Invoices`,
            text: 'Please wait...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const payload = invoicesToSync.map(inv => {
                const { id, is_synced, synced_at, server_name, ...cleanInv } = inv;
                return cleanInv;
            });

            const results = await POSService.bulkSyncInvoices(payload);
            let successCount = 0;
            let failCount = 0;

            for (const result of results) {
                const originalInvoice = invoicesToSync.find(inv => inv.offline_id === result.offline_id);
                if (!originalInvoice) continue;

                if (result.status === 'success' || result.message?.includes("Duplicate ignored")) {
                    const now = new Date().toISOString();
                    const serverName = result.invoice_name || result.name || result.message?.invoice_name || result.message?.name;
                    const isValidERPName = serverName && /^[A-Za-z0-9]{2,}-/.test(serverName);

                    if (isValidERPName) {
                        successCount++;
                        await db.invoices.update(originalInvoice.id, {
                            is_synced: 1,
                            synced_at: now,
                            server_name: serverName
                        });
                        await db.sync_log.add({
                            offline_id: originalInvoice.offline_id,
                            action: 'bulk_sync_success',
                            timestamp: now,
                            status: 'success',
                            server_name: serverName
                        });
                    } else {
                        failCount++;
                        await db.invoices.update(originalInvoice.id, {
                            retry_count: (originalInvoice.retry_count || 0) + 1
                        });
                        const errDump = JSON.stringify(result).substring(0, 100);
                        await db.sync_log.add({
                            offline_id: originalInvoice.offline_id,
                            action: 'bulk_sync_failed',
                            timestamp: now,
                            status: 'failed',
                            error: `Server Response: ${errDump}`
                        });
                    }
                } else {
                    failCount++;
                    await db.sync_log.add({
                        offline_id: originalInvoice.offline_id,
                        action: 'bulk_sync_failed',
                        timestamp: new Date().toISOString(),
                        status: 'failed',
                        error: result.message || "Unknown error"
                    });
                }
            }

            Swal.fire('Sync Complete', `Successfully synced ${successCount} invoices. ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
            fetchData();
        } catch (err) {
            Swal.fire('Error', `Network error: ${err.message}`, 'error');
        }
    };

    const manualSync = async (invoice, hardProceed = false) => {
        if (!isOnline) { Swal.fire('Offline', "No internet connection.", 'warning'); return; }
        setSyncingId(invoice.id);
        try {
            const { id, is_synced, synced_at, server_name, ...cleanInv } = invoice;
            if (hardProceed) {
                cleanInv.hard_proceed = 1;
                if (!cleanInv.customer || cleanInv.customer.trim() === '') cleanInv.customer = 'Cash';
                delete cleanInv.name; 
            }

            const results = await POSService.bulkSyncInvoices([cleanInv]);
            const result = results[0];

            if (!result) throw new Error("No response from server");

            if (result.status === 'success' || result.message?.includes("Duplicate ignored")) {
                const now = new Date().toISOString();
                const serverName = result.invoice_name || result.name || result.message?.invoice_name || result.message?.name;
                const isValidERPName = serverName && /^[A-Za-z0-9]{2,}-/.test(serverName);

                if (isValidERPName) {
                    await db.invoices.update(invoice.id, { is_synced: 1, synced_at: now, server_name: serverName });
                    await db.sync_log.add({ offline_id: invoice.offline_id, action: hardProceed ? 'hard_sync_success' : 'manual_sync_success', timestamp: now, status: 'success', server_name: serverName });
                    Swal.fire({ icon: 'success', title: 'Sync Successful', text: `${serverName}`, timer: 1500, showConfirmButton: false });
                    fetchData();
                } else {
                    await db.invoices.update(invoice.id, { retry_count: (invoice.retry_count || 0) + 1 });
                    const errDump = JSON.stringify(result).substring(0, 150);
                    await db.sync_log.add({ offline_id: invoice.offline_id, action: 'manual_sync_failed', timestamp: now, status: 'failed', error: `Response: ${errDump}` });
                    Swal.fire('Sync Rejected', `Backend failed. Response: ${errDump}`, 'error');
                    fetchData();
                }
            } else {
                const errorMsg = result.message || "Server error";
                await db.sync_log.add({ offline_id: invoice.offline_id, action: 'manual_sync_failed', timestamp: new Date().toISOString(), status: 'failed', error: errorMsg });
                Swal.fire({
                    title: 'Sync Failed',
                    text: errorMsg,
                    icon: 'error',
                    confirmButtonText: 'Try Hard Proceed',
                    confirmButtonColor: '#ef4444',
                    showCancelButton: true
                }).then((r) => { if (r.isConfirmed) manualSync(invoice, true); });
            }
        } catch (err) {
            Swal.fire('Error', `Network error: ${err.message}`, 'error');
        } finally { setSyncingId(null); }
    };

    const syncOpeningEntry = async (entry) => {
        if (!isOnline) { Swal.fire('Offline', 'Connect to internet', 'warning'); return; }
        setSyncingId(`open-${entry.id}`);
        try {
            const { id, is_synced, offline_id, timestamp, ...payload } = entry;
            const res = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_opening_entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const result = await res.json();
            const data = result.message || result;
            if (res.ok && (data.status === 'success' || data.name)) {
                const serverName = data.name;
                await db.opening_entries.update(entry.id, { is_synced: 1 });
                if (localStorage.getItem('posOpeningEntry') === entry.offline_id) {
                    localStorage.setItem('posOpeningEntry', serverName);
                    window.dispatchEvent(new CustomEvent('shift-synced', { detail: { name: serverName } }));
                }
                await db.invoices.where('pos_opening_entry').equals(entry.offline_id).modify({ pos_opening_entry: serverName });
                await db.sync_log.add({ offline_id: entry.offline_id, action: 'opening_sync_success', timestamp: new Date().toISOString(), status: 'success', server_name: serverName });
                Swal.fire('Success', 'Opening Entry Synced', 'success');
                fetchData();
            } else { throw new Error(data.message || "Server error"); }
        } catch (err) { Swal.fire('Sync Failed', err.message, 'error'); } finally { setSyncingId(null); }
    };

    const syncClosingEntry = async (entry) => {
        if (!isOnline) { Swal.fire('Offline', 'Connect to internet', 'warning'); return; }
        setSyncingId(`close-${entry.id}`);
        try {
            const { id, is_synced, offline_id, timestamp, ...payload } = entry;
            const res = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_closing_entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const result = await res.json();
            const data = result.message || result;
            if (res.ok && (data.status === 'success' || data.name)) {
                await db.closing_entries.update(entry.id, { is_synced: 1 });
                await db.sync_log.add({ offline_id: entry.offline_id, action: 'closing_sync_success', timestamp: new Date().toISOString(), status: 'success' });
                Swal.fire('Success', 'Closing Entry Synced', 'success');
                fetchData();
            } else { throw new Error(data.message || "Server error"); }
        } catch (err) { Swal.fire('Sync Failed', err.message, 'error'); } finally { setSyncingId(null); }
    };

    if (loading) return (
        <div className="so-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Loader2 size={40} className="so-spinner" style={{ color: 'var(--so-primary)' }} />
                <p style={{ marginTop: '1rem', fontWeight: 600, color: 'var(--so-text-muted)' }}>Initializing Sync Manager...</p>
            </div>
        </div>
    );

    return (
        <div className="so-page">
            <div className="so-page-header">
                <div>
                    <h1 className="so-page-title"><Activity size={20} /> Data Sync Manager</h1>
                    <p className="so-page-subtitle">Real-time status of local data synchronization and shift states.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '0.45rem 1rem',
                        borderRadius: '99px', background: isOnline ? '#ecfdf5' : '#fef2f2',
                        color: isOnline ? '#059669' : '#dc2626', fontSize: '0.75rem', fontWeight: 700,
                        border: `1.5px solid ${isOnline ? '#10b981' : '#ef4444'}`
                    }}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        {isOnline ? 'SYSTEM CONNECTED' : 'OFFLINE MODE'}
                    </div>
                    <button
                        onClick={() => setSyncSubTheme(isGreen ? 'blue' : 'green')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 1rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
                            fontSize: '0.75rem', fontWeight: 800, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={14} /> {syncSubTheme.toUpperCase()}
                    </button>
                    <button className="so-btn-primary" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
                    </button>
                </div>
            </div>

            <div className="so-layout" style={{ padding: '1.5rem' }}>
                <div style={{ width: '100%' }}>
                    
                    {/* Shift Priority Alerts */}
                    {(pendingOpening.length > 0 || pendingClosing.length > 0) && (
                        <div style={{ marginBottom: '2rem', border: '1.5px solid #6366f1', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.1)' }}>
                            <div style={{ padding: '1rem 1.5rem', background: '#eef2ff', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <AlertCircle size={20} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Urgent: Shift Entries Required for Data Sync
                                </div>
                            </div>
                            <div style={{ background: 'white', padding: '1rem' }}>
                                {pendingOpening.map(entry => (
                                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <ArrowUpCircle size={16} color="#6366f1" /> {entry.offline_id}
                                                <span className="so-badge" style={{ background: '#eef2ff', color: '#6366f1' }}>OPENING</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{entry.company} | {entry.pos_profile}</div>
                                        </div>
                                        <button className="so-btn-primary" style={{ background: '#6366f1', borderColor: '#6366f1' }} onClick={() => syncOpeningEntry(entry)} disabled={syncingId === `open-${entry.id}`}>
                                            {syncingId === `open-${entry.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Post Shift
                                        </button>
                                    </div>
                                ))}
                                {pendingClosing.map(entry => (
                                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <ArrowDownCircle size={16} color="#4338ca" /> {entry.offline_id}
                                                <span className="so-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>CLOSING</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Total Sales: AED {entry.grand_total?.toFixed(2)}</div>
                                        </div>
                                        <button className="so-btn-primary" style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => syncClosingEntry(entry)} disabled={syncingId === `close-${entry.id}`}>
                                            {syncingId === `close-${entry.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Close Shift
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        
                        {/* Pending Invoices Table */}
                        <div className="so-table-card">
                            <div className="so-card-header" style={{ background: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                                        PENDING INVOICES ({pendingInvoices.length})
                                    </h3>
                                    {pendingInvoices.length > 0 && (
                                        <button className="so-btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.7rem' }} onClick={() => bulkSync(pendingInvoices)}>
                                            <FastForward size={14} /> Bulk Sync
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="so-table-wrapper">
                                <table className="so-table">
                                    <thead>
                                        <tr>
                                            <th>Ref & ID</th>
                                            <th>Customer</th>
                                            <th style={{ textAlign: 'right' }}>Total</th>
                                            <th style={{ textAlign: 'center' }}>Status</th>
                                            <th style={{ textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="so-empty" style={{ padding: '4rem' }}>
                                                    <CheckCircle2 size={40} style={{ color: 'var(--so-primary)', marginBottom: '1rem' }} />
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>Everything Up to Date</div>
                                                    <p>All local invoices have been successfully pushed to the server.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingInvoices.map(inv => (
                                                <tr key={inv.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 800, color: 'var(--so-primary)' }}>{inv.offline_id}</div>
                                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(inv.timestamp || 0).toLocaleString()}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{inv.customer}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>AED {inv.grand_total?.toFixed(2)}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="so-badge" style={{ background: '#fef3c7', color: '#92400e' }}>PENDING</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button 
                                                            className="so-btn-ghost" 
                                                            onClick={() => manualSync(inv)}
                                                            disabled={syncingId === inv.id || !isOnline}
                                                        >
                                                            {syncingId === inv.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Activity Logs */}
                        <div className="so-table-card">
                            <div className="so-card-header" style={{ background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--so-text-muted)' }}>
                                    RECENT ACTIVITY LOGS
                                </h3>
                            </div>
                            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {syncLogs.length === 0 ? (
                                    <div className="so-empty" style={{ padding: '3rem' }}>No activity records found.</div>
                                ) : (
                                    syncLogs.map(log => (
                                        <div key={log.id} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem' }}>
                                            <div style={{ marginTop: '0.2rem' }}>
                                                {log.status === 'success' ? 
                                                    <CheckCircle2 size={18} color="#10b981" /> : 
                                                    <AlertCircle size={18} color="#ef4444" />
                                                }
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
                                                        {log.offline_id} 
                                                    </div>
                                                    <span className="so-badge" style={{ 
                                                        background: log.status === 'success' ? '#dcfce7' : '#fee2e2', 
                                                        color: log.status === 'success' ? '#166534' : '#b91c1c',
                                                        fontSize: '0.55rem'
                                                    }}>
                                                        {log.status === 'success' ? 'OK' : 'ERR'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                    {log.action.replace(/_/g, ' ').toUpperCase()} • {new Date(log.timestamp).toLocaleTimeString()}
                                                </div>
                                                {log.server_name && (
                                                    <div style={{ fontSize: '0.7rem', background: 'var(--so-primary-light)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', color: 'var(--so-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Cloud size={10} /> {log.server_name}
                                                    </div>
                                                )}
                                                {log.error && (
                                                    <div style={{ fontSize: '0.7rem', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', color: '#991b1b', fontStyle: 'italic' }}>
                                                        Error: {log.error}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncManager;
