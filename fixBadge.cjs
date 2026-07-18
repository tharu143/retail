const fs = require('fs');
['src/Components/Admin/PurchaseReceiptList.jsx', 'src/Components/Admin/PurchaseInvoiceList.jsx'].forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  txt = txt.replace(/'BOXES'\s*:\s*'NOS'/g, "'BOX' : 'NOS'");
  // Also fix just 'BOXES'
  txt = txt.replace(/>BOXES</g, ">BOX<");
  fs.writeFileSync(f, txt, 'utf8');
});
console.log('Fixed badges!');
