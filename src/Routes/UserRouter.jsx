import { useEffect, useCallback, useRef } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ScrollToTop from '../Components/ScrollToTop'
import { useSelector, useDispatch } from 'react-redux';
import NavBar from '../Components/Nav/NavBar'
import Swal from 'sweetalert2';
import socket from '../utils/socket';
import { setNotifications } from '../Redux/Slices/userSlice';
import { authFetchBase } from '../utils/authFetch';
import HomePage from '../Pages/HomePage'
import LoginPage from '../Pages/LoginPage'
import OpeningEntryPage from '../Pages/OpeningEntryPage'
import ClosingEntryPage from '../Pages/ClosingEntryPage'
import InvoiceListPage from '../Pages/InvoiceListPage'
import PurchaseOrderPage from '../Pages/PurchaseOrderPage'
import PurchaseOrderListPage from '../Pages/PurchaseOrderListPage'
import SalesReportPage from '../Pages/SalesReportPage'
import DailySalesReportPage from '../Pages/DailySalesReportPage'
import PurchaseReportPage from '../Pages/PurchaseReportPage'
import ItemWiseSalesReportPage from '../Pages/ItemWiseSalesReportPage'
import StockBalanceReportPage from '../Pages/StockBalanceReportPage'
import StockLedgerReportPage from '../Pages/StockLedgerReportPage'
import GeneralLedgerReportPage from '../Pages/GeneralLedgerReportPage'
import DashboardPage from '../Pages/DashboardPage'
import POSHealthPage from '../Pages/POSHealthPage'
import CustomerList from '../Components/Admin/CustomerList'
import CustomerEditPage from '../Pages/CustomerEditPage';
import CustomerDetails from '../Components/Admin/CustomerDetails';
import ItemDetails from '../Components/Admin/ItemDetails';
import ItemGroupList from '../Components/Admin/ItemGroupList'
import ItemList from '../Components/Admin/ItemList'
import ItemPriceList from '../Components/Admin/ItemPriceList'
import PosClosingEntryList from '../Components/Admin/PosClosingEntryList'
import CameraSettings from '../Components/Admin/CameraSettings'
import CashDrawerAuditList from '../Components/Admin/CashDrawerAuditList'
import PosOpeningentryList from '../Components/Admin/PosOpeningentryList'
import PosProfileList from '../Components/Admin/PosProfileList'
import PosProfileEditPage from '../Pages/PosProfileEditPage'
import PurchaseInvoiceList from '../Components/Admin/PurchaseInvoiceList'
import PurchaseReceiptList from '../Components/Admin/PurchaseReceiptList'
import SupplierList from '../Components/Admin/SupplierList'
import QuotationList from '../Components/Admin/QuotationList'
import QuotationDetailsPage from '../Pages/QuotationDetailsPage'
import SalesOrderList from '../Components/Admin/SalesOrderList'
import SalesOrderDetailsPage from '../Pages/SalesOrderDetailsPage'
import SalesInvoiceList from '../Components/Admin/SalesInvoiceList'
import DeliveryNoteList from '../Components/Admin/DeliveryNoteList'
import DeliveryNoteDetailsPage from '../Pages/DeliveryNoteDetailsPage'
import PurchaseOrderLists from '../Components/Admin/PurchaseOrderLists'
import SyncManagerPage from '../Pages/SyncManagerPage'
import SettingsPage from '../Pages/SettingsPage'
import PurchaseToolsPage from '../Pages/PurchaseToolsPage'
import QuickStockInPage from '../Pages/QuickStockInPage'
import PurchaseReturnPage from '../Pages/PurchaseReturnPage'
import SupplierDetailsPage from '../Pages/SupplierDetailsPage'
import SupplierEditPage from '../Pages/SupplierEditPage'
import AddressList from '../Components/Admin/AddressList'
import ContactList from '../Components/Admin/ContactList'
import SalesReturnPage from '../Pages/SalesReturnPage'
import PurchaseReturnList from '../Components/Admin/PurchaseReturnList'
import InterBranchTransferList from '../Components/Admin/InterBranchTransferList'
import InterBranchTransferDetails from '../Components/Admin/InterBranchTransferDetails'
import StockEntryDetails from '../Components/Admin/StockEntryDetails'
import StockEntryList from '../Components/Admin/StockEntryList'
import ProductBundleList from '../Components/Admin/ProductBundleList'
import SidebarLayout from '../Components/Nav/SidebarLayout'
import DriverDashboardPage from '../Pages/DriverDashboardPage'
import DocumentationPage from '../Components/Admin/DocumentationPage'
import ClosingCollectionPage from '../Pages/ClosingCollectionPage'

function UserRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.user.theme);
  const warehouse = useSelector((state) => state.user.warehouse);
  const user = useSelector((state) => state.user.user);
  const user_roles = useSelector((state) => state.user.user_roles);
  const showNavBar = location.pathname !== '/' && location.pathname !== '/homepage' && location.pathname !== '/driver-dashboard';

  // Redirect delivery driver to dashboard
  useEffect(() => {
    if (user && user_roles?.includes("Delivery Driver") && location.pathname !== "/driver-dashboard") {
      navigate("/driver-dashboard");
    }
  }, [user, user_roles, location.pathname, navigate]);

  const seenNotifIdsRef = useRef(new Set());

  // Sound helper for real-time notifications
  const playNotificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio autoplay blocked or unsupported
    }
  };

  // Fetch initial notifications list and trigger popup banners for unread items
  const fetchNotifications = useCallback(async () => {
    // Only fetch if user is logged in and not on login page
    if (!user || location.pathname === '/') return;
    try {
      const response = await authFetchBase('kyle_retail.retail_api.api.get_pos_notifications', {
        method: 'POST',
        body: JSON.stringify({ limit: 50 })
      });
      const resData = await response.json();
      const data = resData.message || resData;
      if (data && data.status === 'success') {
        const notifs = data.notifications || [];
        dispatch(setNotifications(notifs));

        // Auto-popup floating banner on top of screen for unread notifications!
        const unread = notifs.filter(n => !n.read && !seenNotifIdsRef.current.has(n.name));
        if (unread.length > 0) {
          unread.forEach(n => {
            seenNotifIdsRef.current.add(n.name);
            playNotificationChime();

            let titleIcon = '🚨 NEW STOCK REQUEST';
            let btnText = '⚡ VIEW REQUEST';
            let btnColor = '#2563eb';

            if (n.notification_type === 'Dispatch') {
              titleIcon = '📦 STOCK DISPATCHED';
              btnText = '✅ ACCEPT STOCK';
              btnColor = '#059669';
            } else if (n.notification_type === 'Decision') {
              const isReject = (n.title || '').includes('REJECT') || (n.message || '').includes('rejected');
              titleIcon = isReject ? '❌ TRANSFER REJECTED' : '🎉 TRANSFER ACCEPTED';
              btnText = 'VIEW DETAILS';
              btnColor = isReject ? '#ef4444' : '#059669';
            }

            const targetDoc = n.document_name || n.doc_name || n.name;
            Swal.fire({
              title: titleIcon,
              html: `<div style="font-size:13px; text-align:left; color:#1e293b; margin-top:4px;"><b>${n.title || ''}</b><br/>${n.message || ''}</div>`,
              icon: (n.title || '').includes('REJECT') ? 'error' : n.notification_type === 'Dispatch' ? 'success' : 'info',
              toast: true,
              position: 'top',
              showConfirmButton: true,
              confirmButtonText: btnText,
              confirmButtonColor: btnColor,
              timer: 25000,
              timerProgressBar: true
            }).then(async (result) => {
              if (result.isConfirmed && targetDoc) {
                // Mark as read in backend
                try {
                  await authFetchBase('kyle_retail.retail_api.api.mark_notification_as_read', {
                    method: 'POST',
                    body: JSON.stringify({ notification_name: n.name })
                  });
                } catch (e) {
                  console.error('Failed to mark read:', e);
                }
                navigate(`/interbranchrequest/${targetDoc}`);
              }
            });
          });
        }
      }
    } catch (error) {
      console.error("[UserRouter] Failed to fetch notifications:", error);
    }
  }, [user, location.pathname, dispatch, navigate]);

  useEffect(() => {
    if (!user || location.pathname === '/') return;
    // Initial fetch on login / navigation
    fetchNotifications();

    // Fetch when user returns/focuses the window/tab
    const onWindowFocus = () => {
      fetchNotifications();
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [user, location.pathname, fetchNotifications]);

  // Global socket listener for real-time stock notifications
  useEffect(() => {
    if (!socket || !warehouse || !user || location.pathname === '/') return;

    // Force connection if disconnected (handles case where socket failed to connect initially before login)
    if (!socket.connected) {
      console.log("[Socket] Socket is not connected on UserRouter mount. Attempting connection...");
      socket.connect();
    }

    const onConnect = () => {
      console.log("[Socket] Connected successfully to server. Socket ID:", socket.id);
      fetchNotifications();
    };

    const onConnectError = (err) => {
      console.error("[Socket] Connection error:", err.message);
    };

    const onDisconnect = (reason) => {
      console.log("[Socket] Disconnected from server. Reason:", reason);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    const handleNewRequest = (data) => {
      console.log("[Socket] New Inter-Branch Request Received:", data);
      // Notify if we are the SOURCE warehouse (Case-insensitive check)
      if (!data.from_warehouse || data.from_warehouse?.toLowerCase() === warehouse?.toLowerCase()) {
        fetchNotifications();
        playNotificationChime();
        const description = data.item_code
          ? `is requesting <b>${data.qty}</b> of <b>${data.item_code}</b>.`
          : `is requesting <b>${data.item_count || 'multiple'} items</b> (Total Qty: ${data.qty || ''}).`;

        Swal.fire({
          title: '🚨 NEW STOCK REQUEST',
          html: `<div style="font-size:13px; text-align:left;">Branch <b>${data.to_warehouse || 'Target Branch'}</b> ${description}</div>`,
          icon: 'info',
          toast: true,
          position: 'top',
          showConfirmButton: true,
          confirmButtonText: '⚡ VIEW & DISPATCH',
          confirmButtonColor: '#2563eb',
          timer: 20000,
          timerProgressBar: true
        }).then((result) => {
          if (result.isConfirmed && data.name) {
            navigate(`/interbranchrequest/${data.name}`);
          }
        });
      }
    };

    const handleDecision = (data) => {
      console.log("[Socket] Inter-Branch Decision Received:", data);
      fetchNotifications();
      playNotificationChime();
      // Show notification for decision (Accepted/Rejected)
      Swal.fire({
        title: `TRANSFER ${data.decision?.toUpperCase() || 'UPDATE'}`,
        text: `Request ${data.name} has been ${data.decision}. ${data.message || ''}`,
        icon: data.decision === 'accepted' ? 'success' : 'error',
        toast: true,
        position: 'top',
        showConfirmButton: true,
        confirmButtonText: 'VIEW DETAILS',
        timer: 15000
      }).then((result) => {
        if (result.isConfirmed && data.name) {
          navigate(`/interbranchrequest/${data.name}`);
        }
      });
    };

    const handleDispatched = (data) => {
      console.log("[Socket] Inter-Branch Dispatch Received:", data);
      // Notify if we are the DESTINATION warehouse (Case-insensitive check)
      if (!data.to_warehouse || data.to_warehouse?.toLowerCase() === warehouse?.toLowerCase()) {
        fetchNotifications();
        playNotificationChime();
        Swal.fire({
          title: '📦 STOCK DISPATCHED',
          html: `<div style="font-size:13px; text-align:left;">Branch <b>${data.from_warehouse || 'Source Branch'}</b> has dispatched stock. Please accept and verify items!</div>`,
          icon: 'success',
          toast: true,
          position: 'top',
          showConfirmButton: true,
          confirmButtonText: '✅ ACCEPT STOCK',
          confirmButtonColor: '#059669',
          timer: 20000,
          timerProgressBar: true
        }).then((result) => {
          if (result.isConfirmed && data.name) {
            navigate(`/interbranchrequest/${data.name}`);
          }
        });
      }
    };

    const handleReceived = (data) => {
      console.log("[Socket] Inter-Branch Received Event:", data);
      if (!data.from_warehouse || data.from_warehouse?.toLowerCase() === warehouse?.toLowerCase()) {
        fetchNotifications();
        playNotificationChime();
        Swal.fire({
          title: '🎉 TRANSFER COMPLETED',
          html: `<div style="font-size:13px; text-align:left;">Branch <b>${data.to_warehouse || 'Destination Branch'}</b> (${data.receiver_name || 'Staff'}) has received and accepted stock for request <b>${data.name}</b>.</div>`,
          icon: 'success',
          toast: true,
          position: 'top',
          showConfirmButton: true,
          confirmButtonText: 'VIEW SUMMARY',
          confirmButtonColor: '#059669',
          timer: 15000,
          timerProgressBar: true
        }).then((result) => {
          if (result.isConfirmed && data.name) {
            navigate(`/interbranchrequest/${data.name}`);
          }
        });
      }
    };

    socket.on('inter_branch_request_created', handleNewRequest);
    socket.on('inter_branch_decision', handleDecision);
    socket.on('inter_branch_dispatched', handleDispatched);
    socket.on('inter_branch_received', handleReceived);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('inter_branch_request_created', handleNewRequest);
      socket.off('inter_branch_decision', handleDecision);
      socket.off('inter_branch_dispatched', handleDispatched);
      socket.off('inter_branch_received', handleReceived);
    };
  }, [warehouse, navigate, fetchNotifications]);

  // Don't apply padding if the NavBar is hidden
  const applyPadding = showNavBar;

  return (
    <>
      <ScrollToTop />
      {showNavBar && <NavBar />}
      <div style={{ paddingTop: applyPadding ? '48px' : '0' }}>
        <Routes>
          <Route path='/' element={<LoginPage />} />
          <Route path='homepage' element={<HomePage />} />
          <Route path='dashboard' element={<DashboardPage />} />
          <Route path='driver-dashboard' element={<DriverDashboardPage />} />

            <Route element={<SidebarLayout />}>
            <Route path='closingentry' element={<ClosingEntryPage />} />
            <Route path='closingcollection' element={<ClosingCollectionPage />} />
            <Route path='closing-collection' element={<ClosingCollectionPage />} />
            <Route path='cashcollection' element={<ClosingCollectionPage />} />
            <Route path='cash-collection' element={<ClosingCollectionPage />} />
            <Route path='invoicelist' element={<InvoiceListPage />} />
            <Route path='purchaseorder' element={<PurchaseOrderPage />} />
            <Route path='purchaseorderlist' element={<PurchaseOrderListPage />} />
            <Route path='salesreport' element={<SalesReportPage />} />
            <Route path='dailysalesreport' element={<DailySalesReportPage />} />
            <Route path='purchasereport' element={<PurchaseReportPage />} />
            <Route path='itemwisereport' element={<ItemWiseSalesReportPage />} />
            <Route path='stockbalancereport' element={<StockBalanceReportPage />} />
            <Route path='stockledgerreport' element={<StockLedgerReportPage />} />
            <Route path='generalledgerreport' element={<GeneralLedgerReportPage />} />
            <Route path='poshealth' element={<POSHealthPage />} />
            <Route path='customerlist' element={<CustomerList />} />
            <Route path='customer-edit/:id' element={<CustomerEditPage />} />
            <Route path='customer-details/:id' element={<CustomerDetails />} />
            <Route path='customer-details/new' element={<CustomerEditPage />} />
            <Route path='itemgrouplist' element={<ItemGroupList />} />
            <Route path='itemlist' element={<ItemList />} />
            <Route path='items' element={<ItemList />} />
            <Route path='item-details/:id' element={<ItemDetails />} />
            <Route path='item/:id' element={<ItemDetails />} />
            <Route path='itempricelist' element={<ItemPriceList />} />
            <Route path='posclosingentrylist' element={<PosClosingEntryList />} />
            <Route path='pos-closing/:id' element={<ClosingEntryPage />} />
            <Route path='camera-settings' element={<CameraSettings />} />
            <Route path='cash-drawer-audit' element={<CashDrawerAuditList />} />
            <Route path='posopeningentrylist' element={<PosOpeningentryList />} />
            <Route path='pos-opening/:id' element={<OpeningEntryPage />} />
            <Route path='posprofilelist' element={<PosProfileList />} />
            <Route path='pos-profile/new' element={<PosProfileEditPage />} />
            <Route path='pos-profile/:id' element={<PosProfileEditPage />} />
            <Route path='purchaseinvoicelist' element={<PurchaseInvoiceList />} />
            <Route path='purchasereceiptlist' element={<PurchaseReceiptList />} />
            <Route path='supplierlist' element={<SupplierList />} />
            <Route path='quotationlist' element={<QuotationList />} />
            <Route path='quotation-details/:name' element={<QuotationDetailsPage />} />
            <Route path='quotation/create' element={<QuotationDetailsPage />} />
            <Route path='salesorderlist' element={<SalesOrderList />} />
            <Route path='salesorder-details/:name' element={<SalesOrderDetailsPage />} />
            <Route path='salesorder/create' element={<SalesOrderDetailsPage />} />
            <Route path='salesinvoice' element={<SalesInvoiceList />} />
            <Route path='deliverynote' element={<DeliveryNoteList />} />
            <Route path='deliverynote-details/:name' element={<DeliveryNoteDetailsPage />} />
            <Route path='deliverynote/create' element={<DeliveryNoteDetailsPage />} />
            <Route path='syncmanager' element={<SyncManagerPage />} />
            <Route path='settings' element={<SettingsPage />} />
            <Route path='purchasetools' element={<PurchaseToolsPage />} />
            <Route path='quickstockin' element={<QuickStockInPage />} />
            <Route path='salesreturn' element={<SalesReturnPage />} />
            <Route path='purchasereturn' element={<PurchaseReturnList />} />
            <Route path='supplier-details/new' element={<SupplierDetailsPage />} />
            <Route path='supplier-details/:name' element={<SupplierDetailsPage />} />
            <Route path='supplier-edit/:name' element={<SupplierEditPage />} />
            <Route path='addresslist' element={<AddressList />} />
            <Route path='contactlist' element={<ContactList />} />
            <Route path='interbranchrequests' element={<InterBranchTransferList />} />
            <Route path='newinterbranchrequest' element={<InterBranchTransferDetails />} />
            <Route path='interbranchrequest/:name' element={<InterBranchTransferDetails />} />
            <Route path='stock-entry/:id' element={<StockEntryDetails />} />
            <Route path='stock-entries' element={<StockEntryList />} />
            <Route path='product-bundles' element={<ProductBundleList />} />
            <Route path='documentation' element={<DocumentationPage />} />
          </Route>
        </Routes>
      </div>
    </>
  );
}

export default UserRouter