import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

// Version 1: Original schema
db.version(1).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date'
});

// Version 5: Offline Opening/Closing Entries support
db.version(5).stores({
    items: 'id, name, group, price, actual_qty, local_qty',
    customers: 'name, customer_name, mobile_no, is_synced',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date, synced_at, server_name, retry_count, conflicts',
    tax_templates: 'name',
    payment_modes: 'name',
    sync_log: '++id, offline_id, action, timestamp, status, server_name',
    opening_entries: '++id, offline_id, is_synced, timestamp',
    closing_entries: '++id, offline_id, is_synced, timestamp'
});
