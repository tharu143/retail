import InvoiceList from '../Components/Headers/InvoiceList'

function InvoiceListPage() {
  return (
   <div className="flex flex-col h-screen overflow-hidden">
    <div className="flex-1 overflow-hidden relative">
      <InvoiceList/>
    </div>
   </div>
  )
}

export default InvoiceListPage