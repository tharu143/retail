import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

function OpeningEntry({ company: propCompany, posProfile: propPosProfile, user: propUser, onOpeningEntrySuccess }) {
    const navigate = useNavigate();
    const location = useLocation();
    const userData = useSelector((state) => state.user);

    // Initialize periodStartDate with current IST date and time for UI
    const getCurrentISTDateTime = () => {
        const now = new Date();
        // Adjust for IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
        const istTime = new Date(now.getTime() + istOffset);
        return istTime.toISOString().slice(0, 16); // Format as YYYY-MM-DDTHH:mm
    };
    const [periodStartDate, setPeriodStartDate] = useState(getCurrentISTDateTime());
    // Initialize postingDate with current IST date and time
    const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
    const [company, setCompany] = useState(propCompany || '');
    const [user, setUser] = useState(propUser || '');
    const [posProfile, setPosProfile] = useState(propPosProfile || '');
    const [balanceDetails, setBalanceDetails] = useState([{ mode_of_payment: '', opening_amount: '' }]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fallback to location.state or Redux/localStorage if props are not provided
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
        // Set period_start_date to live IST date and time at submission
        const livePeriodStartDate = getCurrentISTDateTime();
        const payload = {
            period_start_date: livePeriodStartDate, // Live IST date and time
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
            const session = localStorage.getItem('session') || userData.session; // Get session from localStorage or Redux
            const response = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_opening_entry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session ? { 'X-Frappe-SID': session } : {}), // Use session token as header
                },
                credentials: 'include', // Include cookies for session
                body: JSON.stringify(payload),
            });

            const result = await response.json();
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
            } else {
                const errorMessage = responseData.message || 'Unknown error occurred';
                alert(`Failed to create POS Opening Entry: ${errorMessage}`);
            }
        } catch (error) {
            console.error('OpeningEntry Network Error:', error);
            alert('Network error occurred while creating POS Opening Entry.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="opening-entry-container container">
            <h2 className="text-center my-4">Create POS Opening Entry</h2>
            <div className="row">
                <div className="col-lg-12">
                    <div className="row mb-3">
                        <div className="col-md-4">
                            <label htmlFor="periodStartDate" className="form-label">Period Start Date and Time</label>
                            <input
                                type="datetime-local"
                                id="periodStartDate"
                                className="form-control"
                                value={periodStartDate}
                                onChange={(e) => setPeriodStartDate(e.target.value)}
                            />
                        </div>
                        <div className="col-md-4">
                            <label htmlFor="postingDate" className="form-label">Posting Date and Time</label>
                            <input
                                type="datetime-local"
                                id="postingDate"
                                className="form-control"
                                value={postingDate}
                                onChange={(e) => setPostingDate(e.target.value)}
                            />
                        </div>
                        <div className="col-md-4">
                            <label htmlFor="company" className="form-label">Company</label>
                            <input
                                type="text"
                                id="company"
                                className="form-control"
                                value={company}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="row mb-3">
                        <div className="col-md-6">
                            <label htmlFor="user" className="form-label">User</label>
                            <input
                                type="text"
                                id="user"
                                className="form-control"
                                value={user}
                                disabled
                            />
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="posProfile" className="form-label">POS Profile</label>
                            <input
                                type="text"
                                id="posProfile"
                                className="form-control"
                                value={posProfile}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="table-responsive mb-3">
                        <table className="table border text-start">
                            <thead>
                                <tr>
                                    <th>Mode of Payment</th>
                                    <th>Opening Amount</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {balanceDetails.map((detail, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select
                                                className="form-control"
                                                value={detail.mode_of_payment}
                                                onChange={(e) => handleBalanceDetailChange(index, 'mode_of_payment', e.target.value)}
                                            >
                                                <option value="">-- Select --</option>
                                                <option value="Cash">Cash</option>
                                                <option value="Credit Card">Credit Card</option>
                                                <option value="UPI">UPI</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={detail.opening_amount}
                                                onChange={(e) => handleBalanceDetailChange(index, 'opening_amount', e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleRemoveBalanceDetail(index)}
                                                disabled={balanceDetails.length === 1}
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button className="btn btn-primary" onClick={handleAddBalanceDetail}>
                            Add Payment Mode
                        </button>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="grand-tot-div">
                                <span>Total Opening Amount:</span>
                                <span>
                                    ₹{balanceDetails.reduce((sum, detail) => sum + (parseFloat(detail.opening_amount) || 0), 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <div className="col-md-6 text-end">
                            <button
                                className="btn btn-success"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? 'Submitting...' : 'Submit POS Opening Entry'}
                            </button>
                            <button
                                className="btn btn-secondary ms-2"
                                onClick={() => navigate('/')}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OpeningEntry;