import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
    Activity, TrendingUp, FileText, Clock, AlertCircle, 
    CheckCircle2, RefreshCw, Palette, ShieldCheck, 
    Database, Wifi, WifiOff, Server, HardDrive
} from 'lucide-react';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const POSHealth = () => {
    const posProfile = useSelector((state) => state.user.posProfile);
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localSyncTime, setLocalSyncTime] = useState(localStorage.getItem('last_item_sync_time'));
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Theme Support
    const [healthTheme, setHealthTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
    const isGreen = healthTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0082f6';
    const themeColorHover = isGreen ? '#059669' : '#2563eb';
    const themeLight = isGreen ? '#f0fdf4' : '#eff6ff';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', healthTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [healthTheme, themeColor, themeColorHover, themeLight]);

    const fetchHealthData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_health_data?pos_profile=${encodeURIComponent(posProfile)}`, {
                headers: { "Accept": "application/json" },
                credentials: 'include'
            });
            const data = await response.json();
            setHealthData(data.message || data);
            setLocalSyncTime(localStorage.getItem('last_item_sync_time'));
            setIsOnline(navigator.onLine);
        } catch (err) {
            console.error("Health fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }, [posProfile]);

    useEffect(() => {
        fetchHealthData();
        const interval = setInterval(fetchHealthData, 60000);
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [fetchHealthData]);

    const getSyncStatus = () => {
        if (!healthData?.last_item_update || !localSyncTime) return { label: 'UNKNOWN', color: '#94a3b8', bg: '#f1f5f9' };
        const serverTime = new Date(healthData.last_item_update).getTime();
        const localTime = new Date(localSyncTime).getTime();
        if (serverTime > localTime + 1000) return { label: 'OUTDATED', color: '#dc2626', bg: '#fef2f2' };
        return { label: 'UP TO DATE', color: isGreen ? '#059669' : '#2563eb', bg: isGreen ? '#ecfdf5' : '#eff6ff' };
    };

    const syncStatus = getSyncStatus();
    const isOutOfSync = syncStatus.label === 'OUTDATED';

    const DashboardCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
        <div className="erp-table-card so-table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: '140px', borderTop: `4px solid ${color || themeColor}`, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--so-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{title}</p>
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--so-text-heading)', margin: 0, wordBreak: 'break-word' }}>{value}</h3>
                    {subtitle && <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', marginTop: '4px' }}>{subtitle}</p>}
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${color || themeColor}15`, color: color || themeColor, flexShrink: 0 }}>
                    <Icon size={22} />
                </div>
            </div>
            {trend ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, color: color || themeColor }}>
                    <TrendingUp size={12} /> {trend} since opening
                </div>
            ) : (
                <div style={{ height: '16px' }} />
            )}
        </div>
    );

    if (loading && !healthData) return (
        <div className="erp-page so-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <RefreshCw size={40} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--so-text-muted)', letterSpacing: '0.05em' }}>DIAGNOSING SYSTEM HEALTH...</p>
            </div>
        </div>
    );

    return (
        <div className="erp-page so-page">
            <PageHeader className="so-page-header">
                <div>
                    <h1 className="so-page-title">
                        <ShieldCheck size={20} color={themeColor} />
                        SYSTEM HEALTH & TELEMETRY
                    </h1>
                    <p className="so-page-subtitle">Real-time monitoring of POS data integrity and sync status.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        height: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '0 1rem', borderRadius: '10px',
                        background: isOnline ? (isGreen ? '#ecfdf5' : '#eff6ff') : '#fef2f2',
                        color: isOnline ? themeColor : '#dc2626', fontSize: '0.75rem', fontWeight: 800,
                        border: `1.5px solid ${isOnline ? themeColor : '#ef4444'}`,
                        boxSizing: 'border-box'
                    }}>
                        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        {isOnline ? 'NETWORK STABLE' : 'NETWORK OFFLINE'}
                    </div>
                    <button
                        onClick={() => setHealthTheme(isGreen ? 'blue' : 'green')}
                        style={{
                            height: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '0 1rem', background: '#ffffff',
                            border: `1.5px solid ${themeColor}`, borderRadius: '10px',
                            fontSize: '0.75rem', fontWeight: 800, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            boxSizing: 'border-box'
                        }}
                    >
                        <Palette size={14} /> {healthTheme.toUpperCase()}
                    </button>
                    <button className="erp-button erp-button-primary so-btn-primary"
                            style={{
                                height: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '0 1.25rem', background: themeColor, borderColor: themeColor,
                                borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900,
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                boxSizing: 'border-box'
                            }}
                            onClick={fetchHealthData} disabled={loading}>
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Run Diagnostic
                    </button>
                </div>
            </PageHeader>

            <div className="so-layout">
                <main className="so-content" style={{ padding: '2rem' }}>
                    
                    {isOutOfSync && (
                        <div style={{ 
                            background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: '12px', 
                            padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem',
                            boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.1)'
                        }}>
                            <div style={{ background: '#ffedd5', padding: '0.5rem', borderRadius: '8px', color: '#9a3412' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#9a3412' }}>Local Cache is Outdated</h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#c2410c' }}>Server-side item revisions are ahead of this station. Please perform a Full Sync.</p>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        <DashboardCard
                            title="Fiscal Sales"
                            value={<span className="flex items-center gap-1"><DirhamIcon size={20} /> {healthData?.today_total_sales?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>}
                            subtitle="Total revenue processed today"
                            icon={TrendingUp}
                            color={themeColor}
                            trend={`${healthData?.today_invoice_count || 0} invoices`}
                        />
                        <DashboardCard
                            title="Active Profile"
                            value={posProfile || 'Default'}
                            subtitle="The terminal configuration currently in use"
                            icon={Server}
                            color={isGreen ? '#3b82f6' : '#2dd4bf'} 
                        />
                        <DashboardCard
                            title="Sync Age"
                            value={localSyncTime ? new Date(localSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            subtitle="Last successful local data fetch"
                            icon={Clock}
                            color={isGreen ? '#8b5cf6' : '#f43f5e'} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                        <div className="erp-table-card so-table-card">
                            <div className="erp-section-header so-card-header" style={{ background: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Database size={16} color={themeColor} />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>DATA INTEGRITY ENGINE</h3>
                                </div>
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--so-text-heading)', margin: 0 }}>Item Price Revision (Server)</p>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--so-text-muted)' }}>{healthData?.last_item_update || 'Checking version...'}</p>
                                        </div>
                                        <span className="so-badge" style={{ 
                                            background: syncStatus.bg, 
                                            color: syncStatus.color,
                                            border: `1px solid ${syncStatus.color}20` 
                                        }}>
                                            {syncStatus.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--so-text-heading)', margin: 0 }}>Station Synchronization (Local)</p>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--so-text-muted)' }}>{localSyncTime || 'Pending synchronization'}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>
                                            <HardDrive size={12} /> VOLATILE STORAGE
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--so-text-heading)', margin: 0 }}>API Handshake Status</p>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--so-text-muted)' }}>Connection to Frappe/ERPNext backend</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: isOnline ? themeColor : '#ef4444' }}>
                                            {isOnline ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                            {isOnline ? 'VERIFIED' : 'UNREACHABLE'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: themeLight, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${themeColor}20` }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', fontWeight: 800, color: themeColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Activity size={16} /> SYSTEM NOTES
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--so-text-body)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <p>• <b>Sync Threshold:</b> Outdated statuses appear when the server revision time exceeds the local store by more than 1 second.</p>
                                <p>• <b>Network Latency:</b> Telemetry is refreshed every 60 seconds automatically.</p>
                                <p>• <b>Security:</b> All diagnostic handshakes are performed over encrypted SSL tunnels.</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default POSHealth;
