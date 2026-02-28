import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');
db.version(1).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date'
});
