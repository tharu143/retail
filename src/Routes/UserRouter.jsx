import React from 'react'
import { Route, Routes } from 'react-router-dom'
import HomePage from '../Pages/HomePage'
import LoginPage from '../Pages/LoginPage'
import OpeningEntryPage from '../Pages/OpeningEntryPage'
import ClosingEntryPage from '../Pages/ClosingEntryPage'
import InvoiceListPage from '../Pages/InvoiceListPage'

function UserRouter() {
  return (
    <>
    <Routes>
      <Route path='/' element={<LoginPage/>}/>
      <Route path='homepage' element={<HomePage/>}/>
      <Route path='closingentry' element={<ClosingEntryPage/>}/>
      <Route path='invoicelist' element={<InvoiceListPage/>}/>
    </Routes>
    </>
  )
}

export default UserRouter