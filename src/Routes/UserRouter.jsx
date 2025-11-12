import React from 'react'
import { Route, Routes } from 'react-router-dom'
import HomePage from '../Pages/HomePage'
import LoginPage from '../Pages/LoginPage'
import OpeningEntryPage from '../Pages/OpeningEntryPage'
import ClosingEntryPage from '../Pages/ClosingEntryPage'
import InvoiceListPage from '../Pages/InvoiceListPage'
import PurchaseOrderPage from '../Pages/PurchaseOrderPage'
import PurchaseOrderListPage from '../Pages/PurchaseOrderListPage'
import SalesReportPage from '../Pages/SalesReportPage'
import PurchaseReportPage from '../Pages/PurchaseReportPage'
import ItemWiseSalesReportPage from '../Pages/ItemWiseSalesReportPage'

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
    </Routes>
    </>
  )
}

export default UserRouter