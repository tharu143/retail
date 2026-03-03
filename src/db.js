import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

// Version 1: Original schema
db.version(1).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date'
});

// Version 3: Enterprise Sync Schema
db.version(3).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date, synced_at, server_name, retry_count, conflicts',
    tax_templates: 'name',
    payment_modes: 'name',
    sync_log: '++id, offline_id, action, timestamp, status, server_name'
}).upgrade(tx => {
    return tx.table('invoices').toCollection().modify(inv => {
        if (inv.retry_count === undefined) inv.retry_count = 0;
        if (!inv.conflicts) inv.conflicts = [];
    });
});
