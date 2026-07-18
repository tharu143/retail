const fs = require('fs');
['src/Components/Admin/PurchaseReceiptList.jsx', 'src/Components/Admin/PurchaseInvoiceList.jsx'].forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  txt = txt.replace(/className="so-input text-center font-bold"/g, 'className="so-input text-left pl-2 font-bold"');
  fs.writeFileSync(f, txt, 'utf8');
});
console.log('Fixed alignments!');
