import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setWarehouse as updateActiveWarehouse } from '../../Redux/Slices/userSlice';
import { Loader2, Save, MapPin, AlertCircle, Database, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const Settings = () => {
    const dispatch = useDispatch();
    const activeWarehouse = useSelector((state) => state.user.warehouse);
    const company = useSelector((state) => state.user.company);
    const session = useSelector((state) => state.user.session);

    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(activeWarehouse);
    const [loading, setLoading] = useState(true);

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
        if (company && session) fetchWarehouses();
    }, [company, session]);

    const handleSave = () => {
        if (!selectedWarehouse) {
            Swal.fire('Error', 'Please select a warehouse', 'error');
            return;
        }

        dispatch(updateActiveWarehouse(selectedWarehouse));
        Swal.fire({
            icon: 'success',
            title: 'Settings Saved',
            text: `Active warehouse set to: ${selectedWarehouse}`,
            timer: 2000,
            showConfirmButton: false
        });
    };

    const handleForceReset = async () => {
        if (!navigator.onLine) {
            Swal.fire('Offline', 'You must be online to perform a fresh sync after clear.', 'warning');
            return;
        }

        // Check for unsynced invoices first (CRITICAL SAFETY)
        const unsyncedCount = await db.invoices.where('is_synced').equals(0).count();
        if (unsyncedCount > 0) {
            const result = await Swal.fire({
                title: 'Unsynced Invoices!',
                text: `You have ${unsyncedCount} invoices that are not yet synced to the server. Resetting now might cause issues. Do you want to continue?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, Reset anyway'
            });
            if (!result.isConfirmed) return;
        } else {
            const result = await Swal.fire({
                title: 'Clear Local Cache?',
                text: 'This will wipe all local items, customers, and price lists. A fresh sync will start immediately.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, Clear & Sync'
            });
            if (!result.isConfirmed) return;
        }

        try {
            Swal.fire({
                title: 'Resetting...',
                text: 'Wiping local database and starting fresh sync...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Wipe specific stores (Keep invoices but clear master data)
            await db.items.clear();
            await db.customers.clear();
            await db.tax_templates.clear();

            // Reset sync timestamps
            localStorage.removeItem('last_item_sync_time');

            // Redirect to home which triggers full sync or trigger manually
            Swal.fire({
                icon: 'success',
                title: 'Cache Cleared',
                text: 'Redirecting to homepage for fresh sync...',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = '/homepage'; // Force reload/sync
            });

        } catch (err) {
            console.error("Reset failed:", err);
            Swal.fire('Error', 'Failed to reset local database', 'error');
        }
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading settings...</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm mt-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <MapPin className="text-blue-500" /> POS Settings
            </h2>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Active Warehouse (Stock Source)</label>
                    <p className="text-xs text-gray-500 mb-3">Change this to view stock or bill from a different branch (Manager only logic applies on server).</p>
                    <select
                        value={selectedWarehouse}
                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Select Warehouse</option>
                        {warehouses.map(w => (
                            <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                        ))}
                    </select>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
                    >
                        <Save size={18} /> Save Changes
                    </button>
                </div>

                <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                        <AlertCircle size={18} /> Day End / POS Closing Tip
                    </h3>
                    <p className="text-sm text-amber-700 leading-relaxed">
                        Physical stock levels in ERPNext will only settle after the <strong>POS Closing Entry</strong> process is completed.
                        The "Smart Virtual Stock" you see in the POS reflects pending sales immediately, but official book records update after the daily closing.
                    </p>
                </div>

                <div className="pt-8 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Database className="text-red-500" /> Data Management
                    </h3>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-bold text-red-800">Force Database Reset</p>
                                <p className="text-xs text-red-600 mt-1">If your stock counts or prices look wrong, use this to wipe local cache and fetch everything fresh from the server.</p>
                            </div>
                            <button
                                onClick={handleForceReset}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Reset & Sync
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
