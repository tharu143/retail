import { Route, Routes, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux';
import NavBar from '../Components/Nav/NavBar'
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
  const theme = useSelector((state) => state.user.theme);
  const showNavBar = location.pathname !== '/' && location.pathname !== '/homepage';

  // Don't apply padding if the NavBar is hidden
  const applyPadding = showNavBar;

  return (
    <>
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

