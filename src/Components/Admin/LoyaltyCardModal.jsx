import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

export default function LoyaltyCardModal({ customer, onClose, themeColor = '#0284c7' }) {
  const cardRef = useRef(null);

  if (!customer) return null;

  const handlePrint = () => {
    if (!cardRef.current) return;
    
    // Create an invisible iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const printWindow = iframe.contentWindow;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Loyalty Card</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            .loyalty-card {
              width: 85.6mm;
              height: 53.98mm;
              background: linear-gradient(135deg, ${themeColor}, #0f172a);
              border-radius: 12px;
              color: white;
              padding: 20px;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 25px;
            }
            .card-title {
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin: 0;
            }
            .card-subtitle {
              font-size: 8px;
              opacity: 0.7;
              letter-spacing: 1px;
            }
            .customer-name {
              font-size: 18px;
              font-weight: 900;
              margin: 0 0 5px 0;
              letter-spacing: 0.5px;
            }
            .customer-id {
              font-size: 10px;
              opacity: 0.8;
              font-family: monospace;
              margin: 0;
            }
            .barcode-container {
              position: absolute;
              bottom: 20px;
              left: 20px;
              right: 20px;
              height: 50px;
              background: white;
              border-radius: 6px;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 5px;
            }
            .barcode-img {
              height: 100%;
              max-width: 100%;
              object-fit: contain;
            }
            .expiry-info {
              position: absolute;
              bottom: 85px;
              right: 20px;
              text-align: right;
            }
            .expiry-label {
              font-size: 8px;
              opacity: 0.7;
              text-transform: uppercase;
              margin: 0;
            }
            .expiry-date {
              font-size: 12px;
              font-weight: 800;
              margin: 0;
            }
            @media print {
              body { background: white; }
              @page { size: auto; margin: 0mm; }
            }
          </style>
        </head>
        <body>
          ${cardRef.current.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }, 500);
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  };

  const cardNumber = customer.custom_loyalty_card_number || customer.name.replace(/\s+/g, '');
  const expiryDate = customer.custom_loyalty_expiry_date || "N/A";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-800">Loyalty Card</h2>
          <p className="text-slate-500 font-medium">Preview and print customer's physical loyalty card</p>
        </div>

        {/* Card Preview Container */}
        <div className="flex justify-center mb-8">
          <div 
            ref={cardRef}
            className="loyalty-card" 
            style={{
              width: '85.6mm',
              height: '53.98mm',
              background: `linear-gradient(135deg, ${themeColor}, #0f172a)`,
              borderRadius: '12px',
              color: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              transform: 'scale(1.2)',
              transformOrigin: 'top center',
              marginBottom: '20px'
            }}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '14px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>RETAIL VIP</h3>
                <span className="card-subtitle" style={{ fontSize: '8px', opacity: 0.7, letterSpacing: '1px' }}>LOYALTY PROGRAM</span>
              </div>
            </div>

            <div className="customer-info" style={{ marginTop: '10px' }}>
              <h2 className="customer-name" style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>{customer.customer_name}</h2>
              <p className="customer-id" style={{ margin: 0, fontSize: '9px', opacity: 0.8, fontFamily: 'monospace' }}>ID: {customer.name}</p>
            </div>

            <div className="expiry-info" style={{ position: 'absolute', bottom: '70px', right: '20px', textAlign: 'right' }}>
              <p className="expiry-label" style={{ margin: 0, fontSize: '8px', opacity: 0.7, textTransform: 'uppercase' }}>Valid Thru</p>
              <p className="expiry-date" style={{ margin: 0, fontSize: '12px', fontWeight: 800 }}>{expiryDate}</p>
            </div>

            <div className="barcode-container" style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', height: '45px', background: 'white', borderRadius: '6px', padding: '4px', display: 'flex', justifyItems: 'center', alignItems: 'center' }}>
              <img 
                className="barcode-img" 
                src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${cardNumber}&scaleX=2&scaleY=1&height=8&includetext=true`} 
                alt="Barcode" 
                style={{ height: '100%', width: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-16">
          <button 
            onClick={onClose}
            className="flex-1 py-4 font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handlePrint}
            className="flex-1 py-4 font-bold rounded-xl text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0"
            style={{ background: themeColor }}
          >
            <Printer size={20} /> Print Card
          </button>
        </div>
      </div>
    </div>
  );
}
