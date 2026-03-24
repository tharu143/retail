import React from 'react'
import NavBar from '../Components/Nav/NavBar'
import SalesOrderDetails from '../Components/Admin/SalesOrderDetails'

function SalesOrderDetailsPage() {
  return (
    <div className="salesorder-details-page min-h-screen bg-[#f8fafc]">
      <NavBar />
      <SalesOrderDetails />
    </div>
  )
}

export default SalesOrderDetailsPage
