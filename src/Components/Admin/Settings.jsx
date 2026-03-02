import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setWarehouse as updateActiveWarehouse } from '../../Redux/Slices/userSlice';
import { Loader2, Save, MapPin } from 'lucide-react';
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
            </div>
        </div>
    );
};

export default Settings;
