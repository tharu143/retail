import React from 'react'
import NavBar from '../Components/Nav/NavBar'
import QuickStockInStandalone from '../Components/Admin/QuickStockInStandalone'

function QuickStockInPage() {
  return (
    <div className="min-h-screen bg-[#f1f5f9]">
        <NavBar/>
        <div className="p-4 md:p-8">
            <QuickStockInStandalone />
        </div>
    </div>
  )
}

export default QuickStockInPage
