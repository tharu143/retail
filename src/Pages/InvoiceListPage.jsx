import InvoiceList from '../Components/Headers/InvoiceList'
import NavBar from '../Components/Nav/NavBar'

function InvoiceListPage() {
  return (
   <div className="flex flex-col h-screen overflow-hidden">
    <NavBar/>
    <div className="flex-1 overflow-hidden relative">
      <InvoiceList/>
    </div>
   </div>
  )
}

export default InvoiceListPage