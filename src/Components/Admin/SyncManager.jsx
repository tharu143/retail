import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FastForward } from 'lucide-react';
import Swal from 'sweetalert2';

const SyncManager = () => {
    const [pendingInvoices, setPendingInvoices] = useState([]);
    const [syncLogs, setSyncLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const fetchData = async () => {
        try {
            const pending = await db.invoices.where('is_synced').equals(0).toArray();
            const logs = await db.sync_log.orderBy('timestamp').reverse().limit(50).toArray();
            setPendingInvoices(pending);
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
            // Prepare payload for bulk_sync_invoices
            const payload = invoicesToSync.map(inv => {
                const { id, is_synced, synced_at, server_name, ...cleanInv } = inv;
                return cleanInv;
            });

            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.bulk_sync_invoices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Accept": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({ invoices: payload }),
            });

            if (res.status === 403) {
                Swal.fire('Session Expired', "Please Logout and Login again.", 'error');
                return;
            }

            const data = await res.json();
            const results = data.message || [];

            let successCount = 0;
            let failCount = 0;

            for (const result of results) {
                const originalInvoice = invoicesToSync.find(inv => inv.offline_id === result.offline_id);
                if (!originalInvoice) continue;

                if (result.status === 'success' || result.message?.includes("Duplicate ignored")) {
                    successCount++;
                    const now = new Date().toISOString();
                    const serverName = result.invoice_name || result.name || originalInvoice.offline_id;

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
                    await db.sync_log.add({
                        offline_id: originalInvoice.offline_id,
                        action: 'bulk_sync_failed',
                        timestamp: new Date().toISOString(),
                        status: 'failed',
                        error: result.message || "Unknown server error"
                    });
                }
            }

            Swal.fire('Sync Complete', `Successfully synced ${successCount} invoices. ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
            fetchData();
        } catch (err) {
            console.error("Bulk sync error:", err);
            Swal.fire('Error', `Network error: ${err.message}`, 'error');
        }
    };

    const manualSync = async (invoice, hardProceed = false) => {
        if (!isOnline) {
            Swal.fire('Offline', "No internet connection.", 'warning');
            return;
        }

        setSyncingId(invoice.id);
        try {
            const { id, is_synced, synced_at, server_name, ...payload } = invoice;

            // Add hard_proceed flag if requested
            if (hardProceed) {
                payload.hard_proceed = 1;
            }

            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_pos_invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Accept": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (res.status === 403) {
                Swal.fire('Session Expired', "Please Logout and Login again.", 'error');
                setSyncingId(null);
                return;
            }

            const data = await res.json();
            const result = data.message || data;

            if (result.status === 'success' || (result.message && result.message.includes("Duplicate ignored"))) {
                const now = new Date().toISOString();
                const serverName = result.invoice_name || result.name || invoice.offline_id;

                await db.invoices.update(invoice.id, {
                    is_synced: 1,
                    synced_at: now,
                    server_name: serverName
                });

                await db.sync_log.add({
                    offline_id: invoice.offline_id,
                    action: hardProceed ? 'hard_sync_success' : 'manual_sync_success',
                    timestamp: now,
                    status: 'success',
                    server_name: serverName
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Sync Successful',
                    text: `Invoice: ${serverName}`,
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } else {
                const errorMsg = result.message || "Unknown error from server";
                await db.sync_log.add({
                    offline_id: invoice.offline_id,
                    action: hardProceed ? 'hard_sync_failed' : 'manual_sync_failed',
                    timestamp: new Date().toISOString(),
                    status: 'failed',
                    error: errorMsg
                });

                Swal.fire({
                    title: 'Sync Failed',
                    text: errorMsg,
                    icon: 'error',
                    showCancelButton: true,
                    confirmButtonText: 'Try Hard Proceed',
                    confirmButtonColor: '#ef4444'
                }).then((r) => {
                    if (r.isConfirmed) {
                        manualSync(invoice, true);
                    }
                });
            }
        } catch (err) {
            console.error("Manual sync error:", err);
            Swal.fire('Error', `Network error: ${err.message}`, 'error');
        } finally {
            setSyncingId(null);
        }
    };

    if (loading) return <div className="p-4 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading sync details...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Sync Manager</h2>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2',
                    color: isOnline ? '#059669' : '#dc2626',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: `1px solid ${isOnline ? '#10b981' : '#ef4444'}`
                }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isOnline ? '#10b981' : '#ef4444' }}></div>
                    {isOnline ? 'System Online' : 'System Offline'}
                </div>
            </div>

            {/* Pending Section */}
            <div style={{ marginBottom: '32px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Pending Sync ({pendingInvoices.length})</h3>
                        {pendingInvoices.length > 0 && (
                            <button
                                onClick={() => bulkSync(pendingInvoices)}
                                style={{
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FastForward size={14} /> Sync All
                            </button>
                        )}
                    </div>
                    <button onClick={fetchData} className="btn-refresh" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div style={{ padding: '0' }}>
                    {pendingInvoices.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '12px' }} />
                            <p>All invoices are synced with the server.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', backgroundColor: '#fdfdfd' }}>
                                    <th style={{ padding: '12px 20px' }}>Offline ID</th>
                                    <th style={{ padding: '12px 20px' }}>Customer</th>
                                    <th style={{ padding: '12px 20px' }}>Items</th>
                                    <th style={{ padding: '12px 20px' }}>Amount</th>
                                    <th style={{ padding: '12px 20px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingInvoices.map(inv => (
                                    <React.Fragment key={inv.id}>
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 20px', fontWeight: 600 }}>{inv.offline_id}</td>
                                            <td style={{ padding: '16px 20px' }}>{inv.customer}</td>
                                            <td style={{ padding: '16px 20px' }}>{inv.items?.length || 0} items</td>
                                            <td style={{ padding: '16px 20px', fontWeight: 600 }}>AED {inv.grand_total?.toFixed(2)}</td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <button
                                                    onClick={() => manualSync(inv)}
                                                    disabled={syncingId === inv.id || !isOnline}
                                                    style={{
                                                        padding: '6px 16px',
                                                        borderRadius: '6px',
                                                        backgroundColor: syncingId === inv.id ? '#94a3b8' : '#2563eb',
                                                        color: '#white',
                                                        border: 'none',
                                                        cursor: isOnline ? 'pointer' : 'not-allowed',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 500,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {syncingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    {syncingId === inv.id ? 'Syncing...' : 'Sync Now'}
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Logs Section */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Recent Sync Activity</h3>
                </div>
                <div style={{ padding: '0' }}>
                    {syncLogs.length === 0 ? (
                        <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No activity logs yet.</p>
                    ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {syncLogs.map(log => (
                                <div key={log.id} style={{
                                    padding: '12px 20px',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {log.status === 'success' ? <CheckCircle2 size={20} style={{ color: '#10b981' }} /> : <AlertCircle size={20} style={{ color: '#ef4444' }} />}
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{log.offline_id} - {log.action.replace(/_/g, ' ')}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</div>
                                            {log.error && <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px' }}>Error: {log.error}</div>}
                                            {log.server_name && <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>Server: {log.server_name}</div>}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        backgroundColor: log.status === 'success' ? '#ecfdf5' : '#fef2f2',
                                        color: log.status === 'success' ? '#059669' : '#dc2626'
                                    }}>
                                        {log.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SyncManager;
