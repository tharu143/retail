import React, { useState, useEffect, useMemo } from 'react';
import kyleLogo from '../../assets/kyleretail.png';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Truck, LogOut, Search, MapPin, Phone, MessageSquare,
  CheckCircle, Clock, AlertCircle, ShoppingBag,
  Calendar, Check, User, Copy, ExternalLink, RefreshCw
} from 'lucide-react';
import POSService from '../../utils/posService';
import { logout } from '../../Redux/Slices/userSlice';

function DriverDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const loggedUser = useSelector((state) => state.user.user);

  const [invoices, setInvoices] = useState([]);
  const [driverName, setDriverName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All'); // 'All', 'Pending', 'In Transit', 'Delivered'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [updatingInvoice, setUpdatingInvoice] = useState(false);

  // Fetch driver invoices
  const fetchDriverData = async () => {
    setLoading(true);
    try {
      const res = await POSService.getDriverSalesInvoices(loggedUser);
      const resp = res.message || res;
      if (resp && resp.status === 'success') {
        setInvoices(resp.invoices || []);
        setDriverName(resp.driver || 'Delivery Driver');
      } else {
        console.error("Failed to load driver invoices:", resp.message);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: resp.message || 'Could not fetch deliveries.',
          timer: 3000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("API error fetching driver data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedUser) {
      fetchDriverData();
    }
  }, [loggedUser]);

  // Handle logout
  const handleLogout = () => {
    Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to log out from the Driver Portal?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Sign Out',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancel',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        // Clear localstorage
        localStorage.removeItem('session');
        localStorage.removeItem('user');
        localStorage.removeItem('pos_profile');
        localStorage.removeItem('company');
        localStorage.removeItem('warehouse');
        localStorage.removeItem('user_roles');
        localStorage.removeItem('posOpeningEntry');

        dispatch(logout());
        navigate('/');
      }
    });
  };

  // Update delivery status
  const handleUpdateStatus = async (invoiceName, newStatus) => {
    setUpdatingInvoice(true);
    try {
      const res = await POSService.updateDeliveryStatus(invoiceName, newStatus);
      const resp = res.message || res;
      if (resp && resp.status === 'success') {
        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `Delivery status set to ${newStatus}`,
          timer: 2000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });

        // Refresh local state or close modal with updated data
        await fetchDriverData();

        // Update selectedInvoice detail in view modal if open
        if (selectedInvoice && selectedInvoice.name === invoiceName) {
          setSelectedInvoice(prev => ({
            ...prev,
            custom_delivery_status: newStatus
          }));
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: resp.message || 'Could not update delivery status.',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch (error) {
      console.error("API Error updating delivery status:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while updating status. Please try again.',
        confirmButtonColor: '#3b82f6'
      });
    } finally {
      setUpdatingInvoice(false);
    }
  };

  // Copy address to clipboard
  const handleCopyAddress = (address) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    Swal.fire({
      icon: 'success',
      title: 'Address Copied',
      timer: 1500,
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false
    });
  };

  // Calculations for Metrics Dashboard
  const metrics = useMemo(() => {
    let pending = 0;
    let transit = 0;
    let completed = 0;
    let todayFees = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    invoices.forEach(inv => {
      const status = inv.custom_delivery_status || 'Pending';
      if (status === 'Pending') pending++;
      else if (status === 'In Transit') transit++;
      else if (status === 'Delivered') {
        completed++;
        // If completed today, add delivery fee
        if (inv.posting_date === todayStr) {
          todayFees += parseFloat(inv.custom_delivery_fee || 0);
        }
      }
    });

    return { pending, transit, completed, todayFees };
  }, [invoices]);

  // Filtered invoices list
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Tab Filter
      const deliveryStatus = inv.custom_delivery_status || 'Pending';
      if (activeTab !== 'All' && deliveryStatus !== activeTab) {
        return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = inv.customer_name?.toLowerCase().includes(query);
        const matchesId = inv.name?.toLowerCase().includes(query);
        const matchesAddress = inv.address_display?.toLowerCase().includes(query) || inv.shipping_address_name?.toLowerCase().includes(query);
        return matchesName || matchesId || matchesAddress;
      }

      return true;
    });
  }, [invoices, activeTab, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-12 font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={kyleLogo} alt="Kyle Retail Logo" className="h-12 object-contain" />
          <div className="h-10 w-px bg-slate-200 mx-2"></div>
          <div>
            <h1 className="text-[10px] font-black tracking-widest text-blue-600 uppercase">Driver Portal</h1>
            <p className="text-[11px] font-semibold text-slate-400">Driver ID: <span className="text-slate-600 font-bold">{driverName}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDriverData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            title="Refresh Deliveries"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 mt-6">

        {/* KPI Dashboard Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pending</span>
              <div className="p-1 bg-amber-50 text-amber-600 rounded-lg">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-black text-slate-800">{metrics.pending}</span>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Orders in Queue</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">In Transit</span>
              <div className="p-1 bg-blue-50 text-blue-600 rounded-lg">
                <Truck size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-black text-slate-800">{metrics.transit}</span>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">On the Road</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Delivered</span>
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-black text-slate-800">{metrics.completed}</span>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Completed</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Today's Fees</span>
              <div className="p-1 bg-teal-50 text-teal-600 rounded-lg">
                <span className="text-xs font-bold font-sans">AED</span>
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl font-black text-slate-800">{metrics.todayFees.toFixed(2)}</span>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Delivery Earnings</p>
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section className="mb-5">
          <div className="relative flex items-center bg-white border border-slate-100 rounded-2xl px-3.5 py-2.5 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <Search size={18} className="text-slate-400 mr-2.5" />
            <input
              type="text"
              placeholder="Search by customer name, address, ID..."
              className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 font-bold text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Tab Filters */}
        <section className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', 'Pending', 'In Transit', 'Delivered'].map(tab => {
            const isActive = activeTab === tab;
            let badgeCount = 0;
            if (tab === 'All') badgeCount = invoices.length;
            else if (tab === 'Pending') badgeCount = metrics.pending;
            else if (tab === 'In Transit') badgeCount = metrics.transit;
            else if (tab === 'Delivered') badgeCount = metrics.completed;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${isActive
                    ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm'
                  }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {badgeCount}
                </span>
              </button>
            );
          })}
        </section>

        {/* Deliveries List */}
        <section>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw size={36} className="text-blue-500 animate-spin mb-4" />
              <p className="text-slate-500 font-bold text-sm">Loading your deliveries...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl py-12 px-6 text-center">
              <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-800">No Deliveries Found</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                {activeTab === 'All'
                  ? "You don't have any deliveries assigned to you yet."
                  : `You don't have any deliveries in status "${activeTab}".`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredInvoices.map((inv) => {
                const status = inv.custom_delivery_status || 'Pending';
                const isCOD = inv.outstanding_amount > 0;

                let badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                if (status === 'In Transit') badgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
                else if (status === 'Delivered') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';

                return (
                  <div
                    key={inv.name}
                    onClick={() => setSelectedInvoice(inv)}
                    className="bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-300 shadow-sm rounded-3xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3"
                  >
                    {/* Invoice ID & Status */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 tracking-wide">{inv.name}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border ${badgeClass}`}>
                          {status}
                        </span>
                      </div>

                      {/* COD vs Prepaid */}
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${isCOD ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-green-50 text-green-600 border border-green-100'
                        }`}>
                        {isCOD ? 'COD' : 'Paid'}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" />
                        <h4 className="text-sm font-black text-slate-800">{inv.customer_name}</h4>
                      </div>

                      {/* Address */}
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-500 font-semibold line-clamp-2 leading-relaxed">
                          {inv.address_display || inv.shipping_address_name || 'No address specified'}
                        </p>
                      </div>
                    </div>

                    {/* Financials & Action hint */}
                    <div className="border-t border-slate-100 pt-3 mt-1 flex justify-between items-center">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Grand Total</p>
                          <span className="text-xs font-black text-slate-800">AED {inv.grand_total?.toFixed(2)}</span>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Delivery Fee</p>
                          <span className="text-xs font-black text-slate-800">AED {inv.custom_delivery_fee?.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800">
                        <span>Details</span>
                        <ExternalLink size={12} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up">

            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 tracking-wide uppercase">{selectedInvoice.name}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${selectedInvoice.custom_delivery_status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      selectedInvoice.custom_delivery_status === 'In Transit' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                    {selectedInvoice.custom_delivery_status || 'Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                  <Calendar size={12} />
                  <span>{selectedInvoice.posting_date}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Customer Contacts */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <User size={16} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Customer Details</h4>
                </div>
                <div className="font-semibold text-xs text-slate-700 space-y-1">
                  <p className="text-sm font-black text-slate-800">{selectedInvoice.customer_name}</p>
                  {selectedInvoice.contact_mobile && (
                    <p className="text-slate-500">Phone: {selectedInvoice.contact_mobile}</p>
                  )}
                </div>

                {/* Call & WhatsApp actions */}
                {selectedInvoice.contact_mobile && (
                  <div className="grid grid-cols-2 gap-3.5 mt-4">
                    <a
                      href={`tel:${selectedInvoice.contact_mobile}`}
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-md shadow-blue-100 hover:bg-blue-700 transition-all text-center"
                    >
                      <Phone size={14} />
                      <span>Call Customer</span>
                    </a>
                    <a
                      href={`https://wa.me/${selectedInvoice.contact_mobile.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-100 hover:bg-emerald-700 transition-all text-center"
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                      <MapPin size={16} />
                    </div>
                    <h4 className="text-sm font-black text-slate-800">Delivery Address</h4>
                  </div>

                  <button
                    onClick={() => handleCopyAddress(selectedInvoice.address_display || selectedInvoice.shipping_address_name)}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Copy</span>
                  </button>
                </div>

                <p className="text-xs text-slate-600 font-semibold leading-relaxed whitespace-pre-line">
                  {selectedInvoice.address_display || selectedInvoice.shipping_address_name || 'No address specified'}
                </p>
              </div>

              {/* Items List */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <ShoppingBag size={16} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Items to Deliver</h4>
                </div>

                <div className="space-y-3.5 max-h-[150px] overflow-y-auto pr-1">
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    selectedInvoice.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-start text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-black text-slate-800">{item.item_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.item_code}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-700">x{item.qty} {item.uom}</span>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">AED {item.rate?.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 font-semibold">No items detailed in invoice.</p>
                  )}
                </div>
              </div>

              {/* Financials & COD instructions */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Grand Total</span>
                  <span className="font-black text-slate-800">AED {selectedInvoice.grand_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Delivery Fee</span>
                  <span className="font-black text-slate-800">AED {selectedInvoice.custom_delivery_fee?.toFixed(2)}</span>
                </div>

                <div className="border-t border-slate-200 my-1"></div>

                {selectedInvoice.outstanding_amount > 0 ? (
                  <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider">Collect Cash (COD)</span>
                      <p className="text-xs font-bold">Outstanding Payment</p>
                    </div>
                    <span className="text-base font-black">AED {selectedInvoice.outstanding_amount?.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="bg-green-50 text-green-700 border border-green-100 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider">No Cash Collection</span>
                      <p className="text-xs font-bold">Fully Prepaid / Paid</p>
                    </div>
                    <span className="text-base font-black flex items-center gap-1">
                      <CheckCircle size={16} />
                      <span>PAID</span>
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-white">
              {selectedInvoice.custom_delivery_status === 'Pending' && (
                <button
                  onClick={() => handleUpdateStatus(selectedInvoice.name, 'In Transit')}
                  disabled={updatingInvoice}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 transition-all cursor-pointer"
                >
                  <Truck size={18} />
                  <span>{updatingInvoice ? 'Updating...' : 'Start Delivery (In Transit)'}</span>
                </button>
              )}

              {selectedInvoice.custom_delivery_status === 'In Transit' && (
                <button
                  onClick={() => handleUpdateStatus(selectedInvoice.name, 'Delivered')}
                  disabled={updatingInvoice}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 transition-all cursor-pointer"
                >
                  <CheckCircle size={18} />
                  <span>{updatingInvoice ? 'Updating...' : 'Mark as Delivered'}</span>
                </button>
              )}

              {selectedInvoice.custom_delivery_status === 'Delivered' && (
                <div className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm">
                  <Check size={18} />
                  <span>Delivery Completed</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;
