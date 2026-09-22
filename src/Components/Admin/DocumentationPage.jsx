import PageHeader from '../UI/PageHeader';
import React, { useState } from 'react';
import { 
  Terminal, Keyboard, Clock, ShieldCheck, ShoppingCart, 
  CreditCard, FileText, ChevronRight, Search, Barcode, Layout, Info
} from 'lucide-react';

const DetailTable = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.7rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <thead>
        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {headers.map((h, i) => (
            <th key={i} style={{ padding: '0.4rem 0.6rem', fontWeight: 800, color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
            {row.map((val, j) => (
              <td key={j} style={{ padding: '0.4rem 0.6rem', color: '#64748b', lineHeight: '1.4' }}>{val}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DetailCollapse = ({ title, children }) => (
  <details style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
    <summary style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', outline: 'none' }}>
      <span>{title}</span>
    </summary>
    <div style={{ marginTop: '0.75rem', cursor: 'default' }}>
      {children}
    </div>
  </details>
);

export default function DocumentationPage() {
  const [selectedSection, setSelectedSection] = useState('pos_home');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShortcutTab, setActiveShortcutTab] = useState('all');

  const pages = [
    { id: 'pos_home', title: 'POS Cashier Terminal (Home)', icon: Keyboard, status: 'Active' },
    { id: 'procurement', title: 'Procurement & Purchases', icon: ShoppingCart, status: 'Active' },
    { id: 'sales', title: 'Sales & Returns', icon: CreditCard, status: 'Active' },
    { id: 'stock', title: 'Stock & Inventory', icon: FileText, status: 'Active' },
  ];

  const shortcuts = [
    { key: 'F1', action: 'Add / Edit Cart Discount', category: 'pricing' },
    { key: 'F2', action: 'Search / Select Customer', category: 'customer' },
    { key: 'F3', action: 'Focus Search Bar / Input', category: 'navigation' },
    { key: 'F4', action: 'Toggle Mobile Prefix Country Code (+971 / +91)', category: 'customer' },
    { key: 'F5', action: 'Open Item Detail View', category: 'item' },
    { key: 'F6', action: 'Set Bulk Quantity for selected item', category: 'cart' },
    { key: 'F7', action: 'Show Local Stock Count', category: 'item' },
    { key: 'F8', action: 'Toggle selected item UOM (Piece vs Box)', category: 'cart' },
    { key: 'F9', action: 'Open Recent Orders & Saved Drafts', category: 'navigation' },
    { key: 'F10', action: 'Reprint Last Completed Receipt', category: 'cart' },
    { key: 'F11', action: 'Trigger Cart Item Price Update', category: 'pricing' },
    { key: 'Alt+L', action: 'Open Loyalty Points Redemption panel', category: 'pricing' },
    { key: 'Space', action: 'Checkout with Pay & Thermal Print', category: 'checkout' },
    { key: 'Alt+N', action: 'Checkout with Pay & No Print', category: 'checkout' },
    { key: 'Alt+A', action: 'Checkout with Pay & A4 Invoice Print', category: 'checkout' },
    { key: 'Alt+1', action: 'Process Cash payment directly', category: 'checkout' },
    { key: 'Alt+2', action: 'Process Card payment directly', category: 'checkout' },
    { key: 'Ctrl+V', action: 'Process Bank Transfer payment directly', category: 'checkout' },
    { key: 'Alt+C', action: 'Clear active cart completely', category: 'cart' },
    { key: 'Alt+S', action: 'Save current active cart as Draft', category: 'cart' },
    { key: 'Alt+I', action: 'Select / Swap active Item', category: 'cart' },
    { key: '↑/↓', action: 'Navigate dropdowns or cart list', category: 'navigation' },
    { key: '+/-', action: 'Increase or decrease active item quantity', category: 'cart' },
    { key: '←/→', action: 'Toggle Tax Inclusive / Exclusive status', category: 'pricing' },
    { key: 'Esc', action: 'Close active modal or reset selection', category: 'navigation' },
  ];

  const filteredShortcuts = shortcuts.filter(s => {
    const matchesSearch = s.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeShortcutTab === 'all' || s.category === activeShortcutTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="erp-page so-page" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible' }}>
      
      {/* Page Header aligned natively with ERPNext/Kyle dashboard headers */}
      <div className="so-page-header-container">
        <div className="so-page-tabs">
          <span className="so-page-tab active">Documentation</span>
          <span className="so-page-tab" style={{ cursor: 'pointer' }} onClick={() => setSelectedSection('pos_home')}>POS Guide</span>
        </div>
        <PageHeader className="so-page-header">
          <div>
            <h1 className="so-page-title">System Knowledge Base</h1>
            <p className="so-page-subtitle">User Manuals, Keyboard Shortcuts & Operational Guides</p>
          </div>
        </PageHeader>
      </div>

      {/* Main content body in standard so-content width */}
      <div className="so-content" style={{ padding: '1.25rem 1.5rem' }}>
        
        {/* Unified Card layout containing both sidebar navigation and reader panel */}
        <div className="erp-table-card so-table-card" style={{ display: 'flex', minHeight: '680px', background: '#ffffff' }}>
          
          {/* Left navigation sidebar */}
          <div style={{ width: '280px', borderRight: '1px solid #f1f5f9', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0, background: '#fafbfc' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.5rem' }}>Modules Map</span>
            {pages.map((p) => {
              const Icon = p.icon;
              const isActive = selectedSection === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => p.status === 'Active' && setSelectedSection(p.id)}
                  disabled={p.status !== 'Active'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? '#6366f1' : 'transparent',
                    color: isActive ? '#ffffff' : (p.status === 'Active' ? '#475569' : '#cbd5e1'),
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    cursor: p.status === 'Active' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive && p.status === 'Active') {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#1e293b';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive && p.status === 'Active') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <Icon size={16} />
                    <span>{p.title}</span>
                  </div>
                  {p.status !== 'Active' ? (
                    <span style={{ fontSize: '7px', fontWeight: 800, padding: '2px 4px', background: '#e2e8f0', color: '#64748b', borderRadius: '4px', textTransform: 'uppercase' }}>Locked</span>
                  ) : (
                    <ChevronRight size={12} style={{ opacity: 0.6 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right reader panel */}
          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            {selectedSection === 'pos_home' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Header overview */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                    <Terminal size={20} style={{ color: '#6366f1' }} />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>POS Cashier Terminal (Home Page)</h2>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.5', fontWeight: 500 }}>
                    The terminal screen is designed as an <strong>offline-first</strong> checkout hub. Cashiers can search catalog items, register new customers, apply checkout discounts, and count cash registers completely offline.
                  </p>
                </div>

                {/* Core sections with fields dictionaries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <DetailCollapse title="1. Shift Opening Balance Controls">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Locks the local cash drawer register session to the active counter. The cashier must declare starting float amounts.
                    </p>
                    <DetailTable 
                      headers={["Field Name", "Datatype", "Description", "Validation Rule"]}
                      rows={[
                        ["Opening Cash Balance", "Currency (AED)", "The starting float currency in the cash drawer register.", "Required. Minimum value: 0."],
                        ["Register Number / Counter", "Text Select", "The physical cashier counter station ID.", "Auto-assigned by local system cache."],
                        ["Branch Location", "Text Link", "The store branch location context.", "Auto-locked to Cashier's assigned store branch."]
                      ]}
                    />
                  </DetailCollapse>

                  <DetailCollapse title="2. Barcode Scan & Cart Item Selector">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Handles quick shelf additions. Reads input keys or camera laser feeds to append active rows to the cart.
                    </p>
                    <DetailTable 
                      headers={["Field Name / Control", "Type", "Description", "Operational Rule"]}
                      rows={[
                        ["Speed Search Scan Box", "Input Text", "Scans alphanumeric UPC barcodes, SKU codes, or matches partial item descriptions.", "Focus using F3 key. Adds row on Enter key match."],
                        ["Category Carousel", "Tab Selector", "Filters catalog items display by category group (All, Bakery, Grocery, Beverages).", "Clicking loads matched items into the layout catalog matrix."],
                        ["UOM Selector", "Select Dropdown", "Unit of Measure selector inside the cart row (Nos, Box, Kg).", "Toggling UOM automatically recalculates line rate based on pricing tiers."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Cart Items Table Columns</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose", "Interactions"]}
                      rows={[
                        ["Item Description", "Text", "Displays target item name and stock SKU code.", "Clicking opens the branch stock locator dialog (F5)."],
                        ["Qty Multiplier", "Integer / Float", "The volume count of items sold.", "Increase with (+), decrease with (-), or input bulk quantity (F6)."],
                        ["Rate / Unit Price", "Currency", "Unit price mapping from Standard Selling.", "Locked. Requires manager credentials override to modify custom line rates."],
                        ["Line Discount", "Percentage (%)", "Line-level deduction.", "Editable if cart item discount parameter is allowed in permissions."],
                        ["Line Total", "Currency", "Calculated item total (`Qty * Rate * (1 - Discount)`).", "Automatically updates on any quantity adjustment."]
                      ]}
                    />
                  </DetailCollapse>

                  <DetailCollapse title="3. Checkout Split Payments & Loyalty Redemption">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Handles multi-mode checkouts. Multi-payment splits allocate amounts until the entire invoice total balance reaches zero.
                    </p>
                    <DetailTable 
                      headers={["Field Name", "Datatype", "Description", "Rules & Calculations"]}
                      rows={[
                        ["Loyalty Points Redeem", "Integer", "Redeems points from shopper's balance. Points are converted to currency credit.", "Allowed points &lt;= Customer balance. Opens redeem panel (Alt + L)."],
                        ["Cash Payment Amount", "Currency", "Cash amount received from customer.", "Calculates exact 'Change Due' output if cash exceeds total bill."],
                        ["Card Swipe Amount", "Currency", "Card payment transaction amount.", "Requires terminal slip reference log input."],
                        ["Bank / UPI Transfer", "Currency", "Direct digital transfer (InstaPay, bank link).", "Requires validation transaction hash code entry."],
                        ["Customer Store Credit", "Currency", "Charges outstanding invoice totals to customer accounts receivable credit ledger.", "Only allowed if credit &lt;= Customer Credit Limit limit balance."]
                      ]}
                    />
                  </DetailCollapse>

                  <DetailCollapse title="4. Daily Shift Closing & Reconciliation">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Shift closure logs register reconciliation, calculating variance differences between logged cash transactions and drawer cash counts.
                    </p>
                    <DetailTable 
                      headers={["Report Section", "Datatype", "Description", "Calculation Matrix"]}
                      rows={[
                        ["Declared Cash Count", "Currency", "Actual physical cash counted in register drawer.", "Manual input by cashier at end of shift."],
                        ["System Cash Total", "Currency", "Sum of shift opening cash float plus all cash payment invoice logs.", "Calculated automatically by POS database cache."],
                        ["Cash Variance Check", "Currency", "Difference between declared cash and system cash totals.", "Variance = `Declared Cash - System Cash`. Highlights Red if negative (Loss)."],
                        ["Card Slips Total", "Currency", "Sum of card payment transactions.", "Verified against external bank card settlement reports."]
                      ]}
                    />
                  </DetailCollapse>

                </div>

                {/* Daily operations sequence */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} />
                    Daily Operations Sequence
                  </h3>
                  <div style={{ position: 'relative', borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem', marginLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-29px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', border: '3px solid #ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}></div>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', margin: 0 }}>1. Shift Opening Entry</h5>
                      <p style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                        Cashiers record starting cash balances in the terminal. The session counter register is locked to this operator profile.
                      </p>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-29px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '3px solid #ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}></div>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', margin: 0 }}>2. Transaction Sales & Offline Queue</h5>
                      <p style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                        Cashiers scan items, change quantities, apply split checkouts, and print receipts. Sales are cached locally when offline.
                      </p>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-29px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6', border: '3px solid #ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}></div>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', margin: 0 }}>3. Shift Closing Entry</h5>
                      <p style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                        Logs cash drawer cash, card slips, and digital payment totals. The system flags discrepancies and closes the cashier drawer session.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Keyboard Shortcuts Console */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                      <Keyboard size={18} style={{ color: '#6366f1' }} />
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Keyboard Shortcuts Console</h3>
                    </div>
                    
                    {/* Search box */}
                    <div style={{ position: 'relative', width: '260px' }}>
                      <Search size={12} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search shortcut keys..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.75rem 0.45rem 2rem',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#334155',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                      />
                    </div>
                  </div>

                  {/* Category Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    {['all', 'checkout', 'cart', 'pricing', 'customer', 'item', 'navigation'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveShortcutTab(cat)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '9px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          border: 'none',
                          cursor: 'pointer',
                          background: activeShortcutTab === cat ? '#1e293b' : '#f1f5f9',
                          color: activeShortcutTab === cat ? '#ffffff' : '#64748b',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Shortcuts List */}
                  {filteredShortcuts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '12px', background: '#fafbfc' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>No matching shortcuts</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                      {filteredShortcuts.map((s, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1rem',
                            borderRadius: '10px',
                            border: '1px solid #f1f5f9',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 750, color: '#334155', truncate: 'true', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.action}</span>
                            <span style={{ fontSize: '7.5px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.category}</span>
                          </div>
                          <kbd style={{
                            padding: '0.35rem 0.7rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderBottom: '3.5px solid #94a3b8',
                            borderRadius: '8px',
                            fontSize: '0.725rem',
                            fontWeight: 900,
                            color: '#475569',
                            fontFamily: 'monospace',
                            boxShadow: '0 1.5px 2px rgba(0,0,0,0.04)',
                            flexShrink: 0
                          }}>
                            {s.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {selectedSection === 'procurement' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Header overview */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                    <ShoppingCart size={20} style={{ color: '#10b981' }} />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Procurement & Purchases</h2>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.5', fontWeight: 500 }}>
                    Configure supplier accounts and manage the entire restocking lifecycle, including Purchase Orders, Purchase Receipts, and Purchase Invoices.
                  </p>
                </div>

                {/* Sub-Header: Supplier Registry */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', margin: 0 }}>I. Supplier Management</h3>
                </div>

                {/* Supplier details panels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <DetailCollapse title="1. Supplier Profile Fields">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Defines credentials and settings for registered business vendors.
                    </p>
                    <DetailTable 
                      headers={["Field Name", "Datatype", "Description", "Required / Rule"]}
                      rows={[
                        ["Supplier Name", "Text", "Unique business name identifier of the vendor.", "Required."],
                        ["Supplier Group", "Select Dropdown", "Categorization (Distributor, Local, Raw Materials).", "Required."],
                        ["Tax ID / TRN", "Alphanumeric", "15-digit local Tax Registration Number.", "Optional. Must be format-validated."],
                        ["Default Currency", "Select Dropdown", "Default purchase settlement currency.", "Default: AED."],
                        ["Operational Toggle", "Status Switch", "Enables or blocks transactions with this vendor.", "Restricted suppliers are hidden in purchase forms."]
                      ]}
                    />
                  </DetailCollapse>

                  <DetailCollapse title="2. Global Sync Wizard">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Discovers and pulls vendor profiles from other branch databases to the local registry.
                    </p>
                    <DetailTable 
                      headers={["Action Button", "Trigger", "Description", "Outcome"]}
                      rows={[
                        ["Fetch Global Suppliers", "Click", "Queries remote cluster registries.", "Loads grid of non-synced corporate suppliers."],
                        ["Bulk Sync Selected", "Click Multi", "Selects checkboxes to import suppliers.", "Creates corresponding local partner records instantly."]
                      ]}
                    />
                  </DetailCollapse>
                </div>

                {/* Sub-Header: Purchase Documents */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', margin: 0 }}>II. Purchase Documents & Transitions</h3>
                </div>

                {/* Purchase Document details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Purchase Order Details */}
                  <DetailCollapse title="1. Purchase Order (PO)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Declares purchase intents with agreed item rates.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Supplier Link", "Link Select", "Vendor target profile ID.", "Required. Active check validation."],
                        ["Posting Date", "Date Picker", "Date of order confirmation.", "Defaults to current local date."],
                        ["Target Warehouse", "Link Select", "Target receiving location.", "Required."],
                        ["Total Quantity", "Read-Only Number", "Sum of all item quantities.", "Calculated from items child lines table."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>PO Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Target SKU code barcode key.", "Required. Checks item master registry."],
                        ["Quantity Ordered", "Number", "Volume units to purchase.", "Required. Must be greater than 0."],
                        ["Buying Rate", "Currency", "Declared cost per unit in selected currency.", "Required."],
                        ["Tax Template", "Link Select", "Applies tax percentages to row.", "Calculated dynamically based on tax templates."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Button Actions</h5>
                    <DetailTable 
                      headers={["Button Name", "Action Flow & API Mappings", "Redirections"]}
                      rows={[
                        ["Save Draft", "Saves local edit draft logs.", "None (Stays on page)."],
                        ["Submit", "Finalizes order. Submits document to database.", "Enables document conversion triggers."],
                        ["Create Receipt", "Calls API `create_purchase_receipt_from_po`.", "Redirects to `/purchasereceiptlist?name=PR-XXXX` with pre-filled parameters."],
                        ["Create Invoice", "Calls API `create_purchase_invoice_from_po`.", "Redirects to `/purchaseinvoicelist?name=PI-XXXX` with pre-filled parameters."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Purchase Receipt Details */}
                  <DetailCollapse title="2. Purchase Receipt (PR)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Declares physical inbound inventory arrivals. Updates warehouse stock counts directly.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Supplier Link", "Link Select", "Vendor target profile.", "Required."],
                        ["PO Reference ID", "Link Select", "Source Purchase Order reference code.", "Optional. Autofills header and item child table."],
                        ["Target Warehouse", "Link Select", "Target physical shelf warehouse.", "Required. Defaults to PO warehouse."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>PR Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Received product barcode SKU.", "Mapped from referenced PO row or selected manually."],
                        ["Accepted Quantity", "Number", "Goods passed inspection. Enters local stock shelves.", "Required. Must be >= 0."],
                        ["Rejected Quantity", "Number", "Damaged goods. Housed in rejected buffer bins.", "Defaults to 0. Does not add to branch inventory shelves."],
                        ["Cost Rate", "Currency", "Item unit price value.", "Read-only if mapped from PO reference."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Button Actions</h5>
                    <DetailTable 
                      headers={["Button Name", "Action Flow & API Mappings", "Redirections"]}
                      rows={[
                        ["Get Items from PO", "Queries database for selected PO code items.", "Pulls lines directly to item child table."],
                        ["CREATE INVOICE", "Generates draft Purchase Invoice from Receipt lines.", "Redirects user to `/purchaseinvoicelist?pr=PR-XXXX`."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Purchase Invoice Details */}
                  <DetailCollapse title="3. Purchase Invoice (PI)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Declares the accounting bill for vendor transactions. Updates accounts payable balances.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Supplier Link", "Link Select", "Vendor target profile.", "Required."],
                        ["Posting Date", "Date Picker", "Date for accounting ledger logs.", "Required. Default is current date."],
                        ["Due Date", "Date Picker", "Payment term credit due deadline.", "Calculated based on selected Payment Terms template."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>PI Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Invoiced product barcode SKU.", "Mapped from referenced PR/PO row or selected manually."],
                        ["Invoiced Qty", "Number", "Billed quantities.", "Validated against parent PO total quantities."],
                        ["Invoiced Cost", "Currency", "Net cost unit rate.", "Calculated from mapped purchase document lines."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Double Billing Protection Guards</h5>
                    <DetailTable 
                      headers={["Validation Condition", "Target Field", "Error Result", "Resolution"]}
                      rows={[
                        ["Parent PO billed percentage &gt;= 100", "per_billed", "Invoice blocks submission. Throws 'Already Billed' validation alert.", "Verify prior invoices for the parent Purchase Order."]
                      ]}
                    />
                  </DetailCollapse>

                </div>

                {/* Purchase Flow Diagram */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Info size={14} style={{ color: '#6366f1' }} />
                    Procurement Lifecycle Flow Diagram
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#fafbfc', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '12px', fontSize: '9px', fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', color: '#64748b', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '8px', textAlign: 'center' }}>
                        1. Create Purchase Order (PO)
                        <div style={{ fontSize: '7px', color: '#0284c7', marginTop: '2px' }}>[Standalone / Draft]</div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>➔</div>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', textAlign: 'center' }}>
                        2. Log Purchase Receipt (PR)
                        <div style={{ fontSize: '7px', color: '#047857', marginTop: '2px' }}>[Linked to PO / Stock In]</div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>➔</div>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', textAlign: 'center' }}>
                        3. Bill Purchase Invoice (PI)
                        <div style={{ fontSize: '7px', color: '#b45309', marginTop: '2px' }}>[Linked to PR / Ledger Posting]</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {selectedSection === 'sales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Header Overview */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                    <CreditCard size={20} style={{ color: '#ec4899' }} />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Sales & Returns Lifecycle</h2>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.5', fontWeight: 500 }}>
                    Manage customer accounts, sales orders, product dispatches, invoices, and return workflows. Documents can be created stand-alone or converted dynamically through pre-defined routes.
                  </p>
                            {/* Section Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Customer Database */}
                  <DetailCollapse title="1. Customer & Credit Management">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Register and track details for shopper profiles. Handles retail pricing and credit terms.
                    </p>
                    <DetailTable 
                      headers={["Profile Field", "Datatype", "Description", "Validations & Actions"]}
                      rows={[
                        ["Customer Name", "Text", "Shopper's primary name label.", "Required."],
                        ["Customer Group", "Select Dropdown", "Classification (Individual, Corporate, Retail).", "Required."],
                        ["Price List Group", "Select Link", "Sets customer pricing scheme (Standard Selling).", "Default: Standard Selling."],
                        ["Loyalty Program Link", "Select Link", "Attaches a loyalty scheme ruleset.", "Allows cashiers to print loyalty barcodes."],
                        ["Credit Limit Balance", "Currency", "Maximum store credit debt allowance.", "Enforced strictly at POS payments checkout."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Sales Order */}
                  <DetailCollapse title="2. Sales Order (SO)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Formal commitment specifying items and pricing agreed with the customer.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Customer Link", "Link Select", "Customer target profile.", "Required."],
                        ["Posting Date", "Date Picker", "Date of order confirmation.", "Defaults to current local date."],
                        ["Source Warehouse", "Link Select", "Inventory branch warehouse to fulfill order.", "Required."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>SO Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Product code barcode key.", "Required."],
                        ["Ordered Qty", "Number", "Volume of units requested by customer.", "Must be greater than 0."],
                        ["Selling Price", "Currency", "Price per unit.", "Loads default customer price list rate."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Button Actions</h5>
                    <DetailTable 
                      headers={["Button Name", "Action Flow & Conversions", "Redirections"]}
                      rows={[
                        ["Submit", "Finalizes order. Submits document to database.", "Enables transition conversions."],
                        ["Create Delivery Note", "Compiles draft Delivery Note in backend.", "Redirects to `/deliverynote-details/SO-XXXX` to schedule shipping."],
                        ["Create Sales Invoice", "Compiles draft Sales Invoice in backend.", "Redirects to `/salesinvoice?invoice=SO-XXXX`."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Delivery Note */}
                  <DetailCollapse title="3. Delivery Note (DN)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Confirms physical goods packaging and shipping. Reduces physical shelf stock count.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Customer Link", "Link Select", "Target recipient customer.", "Required."],
                        ["SO Reference ID", "Link Select", "Source Sales Order ID reference.", "Autofills details from parent SO."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>DN Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Dispatched product barcode SKU.", "Mapped from referenced SO row."],
                        ["Dispatched Quantity", "Number", "Quantity physically shipped.", "Required. Verified against remaining SO quantities."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Button Actions</h5>
                    <DetailTable 
                      headers={["Button Name", "Action Flow & Conversions", "Redirections"]}
                      rows={[
                        ["Create Invoice", "Generates draft Sales Invoice from dispatched lines.", "Redirects user to `/salesinvoice?dn=DN-XXXX`."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Sales Invoice */}
                  <DetailCollapse title="4. Sales Invoice (SI)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Declares the accounting bill for customer transactions. Logs receivable balances.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Customer Link", "Link Select", "Customer target profile.", "Required."],
                        ["Posting Date", "Date Picker", "Date for accounting ledger logs.", "Required. Default is current date."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>SI Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Invoiced product barcode SKU.", "Mapped from referenced SO/DN row."],
                        ["Billed Qty", "Number", "Billed quantities.", "Required."],
                        ["Selling Price", "Currency", "Item unit price value.", "Read-only if mapped from order documents."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Sales Return */}
                  <DetailCollapse title="5. Sales Return / Credit Note">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Handles customer product returns. Restores items to physical warehouses and issues refund credits.
                    </p>
                    <DetailTable 
                      headers={["Step ID", "Interactive Wizard Controls", "Description", "Rules & API Mappings"]}
                      rows={[
                        ["Step 1", "Create Return Panel", "Cashier enters the return layout.", "Clears current queue buffers."],
                        ["Step 2", "Select Customer (Party)", "Filters customer search terms.", "Required."],
                        ["Step 3", "Original Invoice Lookup", "Queries database for matching invoices.", "Calls API `get_invoices_for_return`."],
                        ["Step 4", "Choose Return Lines", "Selects items to send to the Return Queue.", "Calls API `get_invoice_items_for_return`."],
                        ["Step 5", "Verify Return Quantity", "Enforce return quantity constraints.", "System validates `Return Qty <= Unreturned Qty`."],
                        ["Step 6", "Submit Credit Note", "Submits and posts the Return.", "Increases stock levels on local shelves and reduces debt balance."]
                      ]}
                    />
                  </DetailCollapse>
                </div>

                {/* Sales Flow Diagram */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Info size={14} style={{ color: '#ec4899' }} />
                    Sales Order to Invoice & Return Lifecycle Flow Diagram
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#fafbfc', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '12px', fontSize: '9px', fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', color: '#64748b', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#fce7f3', color: '#be185d', border: '1px solid #fbcfe8', borderRadius: '8px', textAlign: 'center' }}>
                        1. Sales Order (SO)
                        <div style={{ fontSize: '7px', color: '#9d174d', marginTop: '2px' }}>[Standalone Draft]</div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>➔</div>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '8px', textAlign: 'center' }}>
                        2. Delivery Note (DN)
                        <div style={{ fontSize: '7px', color: '#0284c7', marginTop: '2px' }}>[Inventory Out]</div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>➔</div>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', textAlign: 'center' }}>
                        3. Sales Invoice (SI)
                        <div style={{ fontSize: '7px', color: '#047857', marginTop: '2px' }}>[Customer Billed]</div>
                      </div>
                      <div style={{ color: '#94a3b8' }}>➔</div>
                      <div style={{ flex: 1, padding: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', textAlign: 'center' }}>
                        4. Sales Return / CN
                        <div style={{ fontSize: '7px', color: '#b45309', marginTop: '2px' }}>[Inventory Back / Refund]</div>
                      </div>
                    </div>
                  </div>
                </div>            </div>

              </div>
            )}

            {selectedSection === 'stock' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Header Overview */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                    <FileText size={20} style={{ color: '#10b981' }} />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Stock & Inventory Management</h2>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.5', fontWeight: 500 }}>
                    Configure product items, price lists, category groups, packaging bundles, and log warehouse inventory movements.
                  </p>
                </div>

                {/* Section Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Item List & Quick Stock In */}
                  <DetailCollapse title="1. Item Registry & Quick Stock In">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Register product items, default configurations, and execute immediate stock adjustment overrides.
                    </p>
                    <DetailTable 
                      headers={["Product Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Item Code", "Text", "Unique alphanumeric SKU identifier or manufacturer barcode.", "Required. Unique key constraint."],
                        ["Item Name", "Text", "Shelf description displayed on checkout labels.", "Required."],
                        ["Item Group", "Link Select", "Connects product to category slider node.", "Required."],
                        ["Default Unit of Measure (UOM)", "Select Dropdown", "Base counting unit (Nos, Box, Kg, Crate, Pcs).", "Required."],
                        ["Default Valuation Rate", "Currency", "Declared default buying unit cost.", "Required."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Quick Stock In Controls</h5>
                    <DetailTable 
                      headers={["Quick Field / Button", "Datatype", "Purpose", "System Effect"]}
                      rows={[
                        ["Select Target Warehouse", "Link Select", "Destination warehouse branch shelf.", "Required."],
                        ["Declared Quantity", "Number", "Stock count units to add directly.", "Must be greater than 0."],
                        ["Override Stocks Now", "Button Click", "Applies immediate override log to target item warehouse.", "Directly increases shelf balance, bypassing standard PO/PR workflow."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Price List */}
                  <DetailCollapse title="2. Price List Management">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Define buy and sell rate mappings.
                    </p>
                    <DetailTable 
                      headers={["Price Sheet Field", "Datatype", "Description", "Rules & Validations"]}
                      rows={[
                        ["Item Code Link", "Link Select", "Product code target.", "Required."],
                        ["Price List Name", "Select Dropdown", "Target tier grouping (Standard Selling, Standard Buying).", "Required."],
                        ["Currency Unit", "Select Dropdown", "Settlement currency mapping.", "Default: AED."],
                        ["Price Rate Amount", "Currency", "Base price cost or selling value.", "Must be greater than 0."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Item Group */}
                  <DetailCollapse title="3. Item Group (Categories)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Organizational category structures that populate POS cashier terminal slides.
                    </p>
                    <DetailTable 
                      headers={["Grouping Field", "Datatype", "Description", "POS Impact"]}
                      rows={[
                        ["Group Name", "Text", "Category title name (Groceries, Dairy, Beverages).", "Displays as tab text on POS carousel slider."],
                        ["Parent Item Group", "Link Select", "Self-referencing hierarchical parent grouping link.", "Organizes multi-level menus."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Product Bundles */}
                  <DetailCollapse title="4. Product Bundles (Combo Packs)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Declares item combos. Tying a single combo parent barcode to separate component items.
                    </p>
                    <DetailTable 
                      headers={["Bundle Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Parent Item Link", "Link Select", "Target bundle parent item SKU.", "Required. Must be registered in Item Master list."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Bundle Components Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Component Item Code", "Link Select", "Child item SKU included in package combo.", "Required."],
                        ["Quantity per Bundle", "Number", "Volume of units included in one parent bundle unit.", "Must be greater than 0."]
                      ]}
                    />
                  </DetailCollapse>

                  {/* Stock Entry */}
                  <DetailCollapse title="5. Stock Entry (Manual Adjustments)">
                    <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', margin: '0 0 0.5rem 0' }}>
                      Logs manual inventory dispatches, write-offs, or internal transfers between branch shelves.
                    </p>
                    <DetailTable 
                      headers={["Document Header Field", "Datatype", "Description", "Validations"]}
                      rows={[
                        ["Stock Entry Purpose", "Select Dropdown", "Adjustment class: Material Receipt, Material Issue, Material Transfer.", "Required. Determines default warehouses."],
                        ["Source Warehouse", "Link Select", "Dispatching warehouse.", "Required for Material Transfer and Material Issue."],
                        ["Target Warehouse", "Link Select", "Receiving warehouse.", "Required for Material Receipt and Material Transfer."]
                      ]}
                    />
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0.75rem 0 0.25rem 0' }}>Stock Entry Item Lines Child Table Schema</h5>
                    <DetailTable 
                      headers={["Column Header", "Datatype", "Purpose / Role", "Rules"]}
                      rows={[
                        ["Item Code", "Link Select", "Adjusted barcode SKU.", "Required."],
                        ["Quantity", "Number", "Volume of units to adjust.", "Must be greater than 0."],
                        ["Valuation Rate", "Currency", "Unit cost valuation mapping.", "Defaults to default Item Valuation rate."]
                      ]}
                    />
                  </DetailCollapse>

                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
