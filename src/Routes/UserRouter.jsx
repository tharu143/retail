import { Route, Routes } from 'react-router-dom'
import HomePage from '../Pages/HomePage'
import LoginPage from '../Pages/LoginPage'
import ClosingEntryPage from '../Pages/ClosingEntryPage'
import InvoiceListPage from '../Pages/InvoiceListPage'
import PurchaseOrderPage from '../Pages/PurchaseOrderPage'
import PurchaseOrderListPage from '../Pages/PurchaseOrderListPage'
import SalesReportPage from '../Pages/SalesReportPage'
import PurchaseReportPage from '../Pages/PurchaseReportPage'
import ItemWiseSalesReportPage from '../Pages/ItemWiseSalesReportPage'
import DashboardPage from '../Pages/DashboardPage'
import CustomerList from '../Components/Admin/CustomerList'
import ItemGroupList from '../Components/Admin/ItemGroupList'
import ItemList from '../Components/Admin/ItemList'
import ItemPriceList from '../Components/Admin/ItemPriceList'
import PosClosingEntryList from '../Components/Admin/PosClosingEntryList'
import PosOpeningentryList from '../Components/Admin/PosOpeningentryList'
import PosProfileList from '../Components/Admin/PosProfileList'
import PurchaseInvoiceList from '../Components/Admin/PurchaseInvoiceList'
import PurchaseReceiptList from '../Components/Admin/PurchaseReceiptList'
import SupplierList from '../Components/Admin/SupplierList'


function UserRouter() {
  return (
    <> 
    <Routes>
      <Route path='/' element={<LoginPage/>}/>
      <Route path='homepage' element={<HomePage/>}/>
      <Route path='closingentry' element={<ClosingEntryPage/>}/>
      <Route path='invoicelist' element={<InvoiceListPage/>}/>
      <Route path='purchaseorder' element={<PurchaseOrderPage/>}/>
      <Route path='purchaseorderlist' element={<PurchaseOrderListPage/>}/>
      <Route path='salesreport' element={<SalesReportPage/>}/>
      <Route path='purchasereport' element={<PurchaseReportPage/>}/>
      <Route path='itemwisereport' element={<ItemWiseSalesReportPage/>}/>
      <Route path='dashboard' element={<DashboardPage/>}/>
      <Route path='customerlist' element={<CustomerList/>}/>
      <Route path='itemgrouplist' element={<ItemGroupList/>}/>
      <Route path='itemlist' element={<ItemList/>}/>
      <Route path='itempricelist' element={<ItemPriceList/>}/>
      <Route path='posclosingentrylist' element={<PosClosingEntryList/>}/>
      <Route path='posopeningentrylist' element={<PosOpeningentryList/>}/>
      <Route path='posprofilelist' element={<PosProfileList/>}/>
      <Route path='purchaseinvoicelist' element={<PurchaseInvoiceList/>}/>
      <Route path='purchasereceiptlist'  element={<PurchaseReceiptList/>}/>
      <Route path='supplierlist' element={<SupplierList/>}/>
    </Routes>
    </>
  )
}

export default UserRouter