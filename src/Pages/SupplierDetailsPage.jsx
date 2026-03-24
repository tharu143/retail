import React from 'react'
import NavBar from '../Components/Nav/NavBar'
import SupplierDetails from '../Components/Admin/SupplierDetails'

function SupplierDetailsPage() {
  return (
    <div className="supplier-details-page min-h-screen bg-[#f8fafc]">
      <NavBar />
      <SupplierDetails />
    </div>
  )
}

export default SupplierDetailsPage
