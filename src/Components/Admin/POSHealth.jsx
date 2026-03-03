import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
    Activity,
    TrendingUp,
    FileText,
    Clock,
    AlertCircle,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';

const POSHealth = () => {
    const posProfile = useSelector((state) => state.user.posProfile);
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localSyncTime, setLocalSyncTime] = useState(localStorage.getItem('last_item_sync_time'));

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
        } catch (err) {
            console.error("Health fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }, [posProfile]);

    useEffect(() => {
        fetchHealthData();
        const interval = setInterval(fetchHealthData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [fetchHealthData]);

    const getSyncStatus = () => {
        if (!healthData?.last_item_update || !localSyncTime) return { label: 'UNKNOWN', color: 'gray' };

        const serverTime = new Date(healthData.last_item_update).getTime();
        const localTime = new Date(localSyncTime).getTime();

        if (serverTime > localTime + 1000) { // 1s tolerance
            return { label: 'OUTDATED', color: 'red' };
        }
        return { label: 'UP TO DATE', color: 'emerald' };
    };

    const syncStatus = getSyncStatus();
    const isOutOfSync = syncStatus.label === 'OUTDATED';

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    );

    if (loading && !healthData) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-blue-500" size={32} /></div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Activity className="text-blue-500" /> POS Health Dashboard
                    </h1>
                    <button
                        onClick={fetchHealthData}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                </div>

                {isOutOfSync && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800">
                        <AlertCircle />
                        <div>
                            <p className="font-semibold">Local cache is out of date</p>
                            <p className="text-sm">The server has newer item data. Please perform a full sync to update prices and stock.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        title="Today's Total Sales"
                        value={`AED ${healthData?.today_total_sales?.toLocaleString() || '0.00'}`}
                        icon={TrendingUp}
                        color="bg-emerald-500"
                    />
                    <StatCard
                        title="Today's Invoices"
                        value={healthData?.today_invoice_count || '0'}
                        icon={FileText}
                        color="bg-blue-500"
                    />
                    <StatCard
                        title="Local Sync Age"
                        value={localSyncTime ? new Date(localSyncTime).toLocaleTimeString() : 'Never'}
                        icon={Clock}
                        color="bg-violet-500"
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800">Sync Details</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Last Server Item Update</p>
                                <p className="text-xs text-gray-500">{healthData?.last_item_update || 'N/A'}</p>
                            </div>
                            <span className={`px-3 py-1 bg-${syncStatus.color}-100 text-${syncStatus.color}-700 text-xs font-bold rounded-full`}>
                                {syncStatus.label}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900">POS Profile</p>
                                <p className="text-xs text-gray-500">{posProfile}</p>
                            </div>
                            <span className="text-xs font-mono text-gray-400">active</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-gray-900">System Connection</p>
                                <p className="text-xs text-gray-500">{navigator.onLine ? 'Broadband / LAN' : 'Disconnected'}</p>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                                {navigator.onLine ? <CheckCircle2 size={14} /> : <AlertCircle size={14} className="text-red-500" />}
                                {navigator.onLine ? 'STABLE' : 'OFFLINE'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POSHealth;
