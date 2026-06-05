import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ScrollToTop from '../Components/ScrollToTop'
import { useSelector } from 'react-redux';
import NavBar from '../Components/Nav/NavBar'
import Swal from 'sweetalert2';
import socket from '../utils/socket';
import HomePage from '../Pages/HomePage'
import LoginPage from '../Pages/LoginPage'
import ClosingEntryPage from '../Pages/ClosingEntryPage'
import InvoiceListPage from '../Pages/InvoiceListPage'
import PurchaseOrderPage from '../Pages/PurchaseOrderPage'
import PurchaseOrderListPage from '../Pages/PurchaseOrderListPage'
import SalesReportPage from '../Pages/SalesReportPage'
import PurchaseReportPage from '../Pages/PurchaseReportPage'
import ItemWiseSalesReportPage from '../Pages/ItemWiseSalesReportPage'
import StockBalanceReportPage from '../Pages/StockBalanceReportPage'
import StockLedgerReportPage from '../Pages/StockLedgerReportPage'
import DashboardPage from '../Pages/DashboardPage'
import POSHealthPage from '../Pages/POSHealthPage'
import CustomerList from '../Components/Admin/CustomerList'
import CustomerDetails from '../Components/Admin/CustomerDetails';
import ItemGroupList from '../Components/Admin/ItemGroupList'
import ItemList from '../Components/Admin/ItemList'
import ItemPriceList from '../Components/Admin/ItemPriceList'
import PosClosingEntryList from '../Components/Admin/PosClosingEntryList'
import PosOpeningentryList from '../Components/Admin/PosOpeningentryList'
import PosProfileList from '../Components/Admin/PosProfileList'
import PurchaseInvoiceList from '../Components/Admin/PurchaseInvoiceList'
import PurchaseReceiptList from '../Components/Admin/PurchaseReceiptList'
import SupplierList from '../Components/Admin/SupplierList'
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
import AddressList from '../Components/Admin/AddressList'
import ContactList from '../Components/Admin/ContactList'
import SalesReturnPage from '../Pages/SalesReturnPage'
import PurchaseReturnList from '../Components/Admin/PurchaseReturnList'
import InterBranchTransferList from '../Components/Admin/InterBranchTransferList'
import InterBranchTransferDetails from '../Components/Admin/InterBranchTransferDetails'




function UserRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useSelector((state) => state.user.theme);
  const warehouse = useSelector((state) => state.user.warehouse);
  const showNavBar = location.pathname !== '/' && location.pathname !== '/homepage';

  // Global socket listener for real-time stock notifications
  useEffect(() => {
    if (!socket || !warehouse) return;

    // Force connection if disconnected (handles case where socket failed to connect initially before login)
    if (!socket.connected) {
      console.log("[Socket] Socket is not connected on UserRouter mount. Attempting connection...");
      socket.connect();
    }

    const onConnect = () => {
      console.log("[Socket] Connected successfully to server. Socket ID:", socket.id);
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
      // Only notify if we are the SOURCE warehouse (Case-insensitive check)
      if (data.from_warehouse?.toLowerCase() === warehouse?.toLowerCase()) {
        const description = data.item_code
          ? `is requesting <b>${data.qty}</b> of <b>${data.item_code}</b>.`
          : `is requesting <b>${data.item_count} items</b> (Total Qty: ${data.qty}).`;

        Swal.fire({
          title: 'NEW STOCK REQUEST',
          html: `Branch <b>${data.to_warehouse}</b> ${description}`,
          icon: 'info',
          toast: true,
          position: 'top-end',
          showConfirmButton: true,
          confirmButtonText: 'VIEW REQUEST',
          confirmButtonColor: '#3b82f6',
          timer: 15000,
          timerProgressBar: true
        }).then((result) => {
          if (result.isConfirmed) {
            navigate(`/interbranchrequest/${data.name}`);
          }
        });
      }
    };

    const handleDecision = (data) => {
      console.log("[Socket] Inter-Branch Decision Received:", data);
      // Show notification for decision (Accepted/Rejected)
      Swal.fire({
        title: `TRANSFER ${data.decision.toUpperCase()}`,
        text: `Request ${data.name} has been ${data.decision}. ${data.message || ''}`,
        icon: data.decision === 'accepted' ? 'success' : 'error',
        toast: true,
        position: 'top-end',
        showConfirmButton: true,
        confirmButtonText: 'OPEN',
        timer: 8000
      }).then((result) => {
        if (result.isConfirmed) {
          navigate(`/interbranchrequest/${data.name}`);
        }
      });
    };

    const handleDispatched = (data) => {
      console.log("[Socket] Inter-Branch Dispatch Received:", data);
      // Only notify if we are the DESTINATION warehouse (Case-insensitive check)
      if (data.to_warehouse?.toLowerCase() === warehouse?.toLowerCase()) {
        Swal.fire({
          title: 'MATERIAL DISPATCHED',
          html: `Branch <b>${data.from_warehouse}</b> has dispatched stock. Please accept the items!`,
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: true,
          confirmButtonText: 'ACCEPT STOCK',
          confirmButtonColor: '#10b981',
          timer: 15000,
          timerProgressBar: true
        }).then((result) => {
          if (result.isConfirmed) {
            navigate(`/interbranchrequest/${data.name}`);
          }
        });
      }
    };

    socket.on('inter_branch_request_created', handleNewRequest);
    socket.on('inter_branch_decision', handleDecision);
    socket.on('inter_branch_dispatched', handleDispatched);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('inter_branch_request_created', handleNewRequest);
      socket.off('inter_branch_decision', handleDecision);
      socket.off('inter_branch_dispatched', handleDispatched);
    };
  }, [warehouse, navigate]);

  // Don't apply padding if the NavBar is hidden
  const applyPadding = showNavBar;

  return (
    <>
      <ScrollToTop />
      {showNavBar && <NavBar />}
      <div style={{ paddingTop: applyPadding ? '56px' : '0' }}>
        <Routes>
          <Route path='/' element={<LoginPage />} />
          <Route path='homepage' element={<HomePage />} />
          <Route path='closingentry' element={<ClosingEntryPage />} />
          <Route path='invoicelist' element={<InvoiceListPage />} />
          <Route path='purchaseorder' element={<PurchaseOrderPage />} />
          <Route path='purchaseorderlist' element={<PurchaseOrderListPage />} />
          <Route path='salesreport' element={<SalesReportPage />} />
          <Route path='purchasereport' element={<PurchaseReportPage />} />
          <Route path='itemwisereport' element={<ItemWiseSalesReportPage />} />
          <Route path='stockbalancereport' element={<StockBalanceReportPage />} />
          <Route path='stockledgerreport' element={<StockLedgerReportPage />} />
          <Route path='dashboard' element={<DashboardPage />} />
          <Route path='poshealth' element={<POSHealthPage />} />
          <Route path='customerlist' element={<CustomerList />} />
          <Route path='customer-details/:id' element={<CustomerDetails />} />
          <Route path='customer-details/new' element={<CustomerDetails />} />
          <Route path='itemgrouplist' element={<ItemGroupList />} />
          <Route path='itemlist' element={<ItemList />} />
          <Route path='itempricelist' element={<ItemPriceList />} />
          <Route path='posclosingentrylist' element={<PosClosingEntryList />} />
          <Route path='posopeningentrylist' element={<PosOpeningentryList />} />
          <Route path='posprofilelist' element={<PosProfileList />} />
          <Route path='purchaseinvoicelist' element={<PurchaseInvoiceList />} />
          <Route path='purchasereceiptlist' element={<PurchaseReceiptList />} />
          <Route path='supplierlist' element={<SupplierList />} />
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
          <Route path='supplier-details/:name' element={<SupplierDetailsPage />} />
          <Route path='addresslist' element={<AddressList />} />
          <Route path='contactlist' element={<ContactList />} />
          <Route path='interbranchrequests' element={<InterBranchTransferList />} />
          <Route path='newinterbranchrequest' element={<InterBranchTransferDetails />} />
          <Route path='interbranchrequest/:name' element={<InterBranchTransferDetails />} />
        </Routes>
      </div>
    </>
  );
}


export default UserRouter

