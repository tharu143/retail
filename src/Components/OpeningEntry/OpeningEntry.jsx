import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, User, Building2, CreditCard, Plus, Trash2, Check, X } from 'lucide-react';
import { db } from '../../db';

function OpeningEntry({ company: propCompany, posProfile: propPosProfile, user: propUser, onOpeningEntrySuccess }) {
    const navigate = useNavigate();
    const location = useLocation();
    const userData = useSelector((state) => state.user);

    const getCurrentISTDateTime = () => {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        return istTime.toISOString().slice(0, 16);
    };

    const [periodStartDate, setPeriodStartDate] = useState(getCurrentISTDateTime());
    const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
    const [company, setCompany] = useState(propCompany || '');
    const [user, setUser] = useState(propUser || '');
    const [posProfile, setPosProfile] = useState(propPosProfile || '');
    const [balanceDetails, setBalanceDetails] = useState([{ mode_of_payment: '', opening_amount: '' }]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const { user: navUser, pos_profile: navPosProfile, company: navCompany } = location.state || {};
        const reduxUser = userData?.user || localStorage.getItem('user') || '';
        const reduxPosProfile = userData?.posProfile || localStorage.getItem('pos_profile') || '';
        const reduxCompany = userData?.company || localStorage.getItem('company') || '';

        setUser(propUser || navUser || reduxUser);
        setPosProfile(propPosProfile || navPosProfile || reduxPosProfile);
        setCompany(propCompany || navCompany || reduxCompany);
        console.log('OpeningEntry - posProfile:', propPosProfile || reduxPosProfile);
    }, [location.state, userData, propCompany, propPosProfile, propUser]);

    const handleAddBalanceDetail = () => {
        setBalanceDetails((prev) => [...prev, { mode_of_payment: '', opening_amount: '' }]);
    };

    const handleBalanceDetailChange = (index, field, value) => {
        setBalanceDetails((prev) =>
            prev.map((detail, i) => (i === index ? { ...detail, [field]: value } : detail))
        );
    };

    const handleRemoveBalanceDetail = (index) => {
        setBalanceDetails((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        const missingFields = [];
        if (!periodStartDate) missingFields.push('Period Start Date');
        if (!postingDate) missingFields.push('Posting Date');
        if (!company) missingFields.push('Company');
        if (!user) missingFields.push('User');
        if (!posProfile) missingFields.push('POS Profile');
        if (balanceDetails.length === 0 || balanceDetails.some((d) => !d.mode_of_payment || !d.opening_amount || parseFloat(d.opening_amount) < 0)) {
            missingFields.push('Balance Details (complete all rows with valid amounts)');
        }

        if (missingFields.length > 0) {
            alert(`Please fill in the following required fields: ${missingFields.join(', ')}`);
            return;
        }

        setLoading(true);
        const livePeriodStartDate = getCurrentISTDateTime();
        const payload = {
            period_start_date: livePeriodStartDate,
            posting_date: postingDate,
            company,
            user,
            pos_profile: posProfile,
            balance_details: balanceDetails,
            status: 'Open',
            docstatus: 1,
        };
        console.log('OpeningEntry - Payload:', payload);

        try {
            if (!navigator.onLine) {
                const dummyId = `OFFLINE-SHIFT-${new Date().getTime()}`;
                const offlineEntry = {
                    ...payload,
                    offline_id: dummyId,
                    is_synced: 0,
                    timestamp: new Date().toISOString()
                };

                await db.opening_entries.add(offlineEntry);

                if (onOpeningEntrySuccess) {
                    onOpeningEntrySuccess(dummyId, company, posProfile);
                } else {
                    localStorage.setItem('posOpeningEntry', dummyId);
                    localStorage.setItem('company', company);
                    localStorage.setItem('pos_profile', posProfile);
                    alert(`Offline Shift Started: ${dummyId}. It will be synced automatically when online.`);
                    navigate('/homepage', {
                        state: { posOpeningEntry: dummyId, company, pos_profile: posProfile },
                    });
                }
                setLoading(false);
                return;
            }

            const session = localStorage.getItem('session') || userData.session;
            const response = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_opening_entry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session ? { 'X-Frappe-SID': session } : {}),
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            let result;
            try {
                result = await response.json();
            } catch (err) {
                throw new Error("Unable to parse server response - it may be unreachable");
            }

            console.log('OpeningEntry API Response:', { status: response.status, result });

            const responseData = result.message || result;

            if (response.status >= 200 && response.status < 300 && responseData.status === 'success') {
                const posOpeningEntry = responseData.name;
                if (onOpeningEntrySuccess) {
                    onOpeningEntrySuccess(posOpeningEntry, company, posProfile);
                } else {
                    localStorage.setItem('posOpeningEntry', posOpeningEntry);
                    localStorage.setItem('company', company);
                    localStorage.setItem('pos_profile', posProfile);
                    alert(`POS Opening Entry created successfully: ${posOpeningEntry}`);
                    navigate('/homepage', {
                        state: {
                            posOpeningEntry,
                            company,
                            pos_profile: posProfile,
                        },
                    });
                }
            } else if (response.ok && responseData.status === 'success') {
                const posOpeningEntry = responseData.name;

                if (onOpeningEntrySuccess) {
                    onOpeningEntrySuccess(posOpeningEntry);
                } else {
                    localStorage.setItem('posOpeningEntry', posOpeningEntry);
                    alert(`POS Opening Entry created: ${posOpeningEntry}`);
                    navigate('/homepage');
                }
            } else {
                const errorMessage = responseData.message || 'Unknown error occurred';
                alert(`Failed to create POS Opening Entry: ${errorMessage}`);
            }
        } catch (error) {
            console.error('OpeningEntry Network Error:', error);
            alert(`Network error occurred while creating POS Opening Entry: ${error.message || ''}`);
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = balanceDetails.reduce((sum, detail) => sum + (parseFloat(detail.opening_amount) || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <DollarSign className="w-8 h-8" />
                            Create POS Opening Entry
                        </h1>
                        <p className="text-slate-200 mt-2">Initialize your point of sale system for the day</p>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    Period Start Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={periodStartDate}
                                    onChange={(e) => setPeriodStartDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    Posting Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={postingDate}
                                    onChange={(e) => setPostingDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Building2 className="w-4 h-4 text-slate-500" />
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={company}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <User className="w-4 h-4 text-slate-500" />
                                    User
                                </label>
                                <input
                                    type="text"
                                    value={user}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <CreditCard className="w-4 h-4 text-slate-500" />
                                    POS Profile
                                </label>
                                <input
                                    type="text"
                                    value={posProfile}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Payment Mode Balances
                            </h2>

                            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                                {balanceDetails.map((detail, index) => (
                                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Mode of Payment
                                                </label>
                                                <select
                                                    value={detail.mode_of_payment}
                                                    onChange={(e) => handleBalanceDetailChange(index, 'mode_of_payment', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                                >
                                                    <option value="">Select payment mode</option>
                                                    <option value="Cash">Cash</option>
                                                    <option value="Credit Card">Credit Card</option>
                                                    <option value="UPI">UPI</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Opening Amount
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative">

                                                        <input
                                                            type="number"
                                                            value={detail.opening_amount}
                                                            onChange={(e) => handleBalanceDetailChange(index, 'opening_amount', e.target.value)}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveBalanceDetail(index)}
                                                        disabled={balanceDetails.length === 1}
                                                        className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={handleAddBalanceDetail}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:bg-white hover:text-slate-700 transition-all flex items-center justify-center gap-2 font-medium"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Payment Mode
                                </button>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 mb-8">
                            <div className="flex items-center justify-between text-white">
                                <span className="text-lg font-semibold">Total Opening Amount</span>
                                <span className="text-3xl font-bold">AED {totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-end">
                            <button
                                onClick={() => navigate('/')}
                                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <X className="w-5 h-5" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-lg font-semibold hover:from-slate-700 hover:to-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Submit Opening Entry
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OpeningEntry;