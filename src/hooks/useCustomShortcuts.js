import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pos_custom_shortcut_keys';
const EVENT_NAME = 'pos_shortcuts_updated';

export const DEFAULT_SHORTCUTS = {
    pos_home: {
        discount: 'F1',
        customer: 'F2',
        search: 'F3',
        countryCode: 'F4',
        stock: 'F5',
        bulkQty: 'F6',
        pay: 'F7',
        uom: 'F8',
        orders: 'F9',
        saveDraft: 'F10',
        priceUpdate: 'F11',
        loyalty: 'F12',
        clearBill: 'Alt+C',
        directCash: 'Alt+1',
        directCard: 'Alt+2',
        selectItem: 'Alt+I'
    },
    doc_editor: {
        customerSupplier: 'F2',
        itemSearch: 'F3',
        barcode: 'F4',
        bulkQty: 'F6',
        saveDraft: 'F7',
        uom: 'F8',
        warehouseBranch: 'F9',
        addRow: 'F10',
        submit: 'F12'
    }
};

export const ACTION_LABELS = {
    pos_home: {
        discount: 'Discount Modal',
        customer: 'Focus Customer Mobile',
        search: 'Focus Barcode/Search',
        countryCode: 'Toggle Country Code Prefix',
        stock: 'Stock Breakdown Lookup',
        bulkQty: 'Bulk Qty Update',
        pay: 'Checkout / Pay (Classic)',
        uom: 'UOM Toggle in Cart',
        orders: 'Active Orders (Drafts) Modal',
        saveDraft: 'Save Current Draft',
        priceUpdate: 'Quick Price Update',
        loyalty: 'Loyalty Modal Toggle',
        clearBill: 'Clear Cart / Bill',
        directCash: 'Direct Cash Complete',
        directCard: 'Direct Card Complete',
        selectItem: 'Grid Item Selection'
    },
    doc_editor: {
        customerSupplier: 'Focus Customer/Supplier Search',
        itemSearch: 'Focus Item Search',
        barcode: 'Focus Barcode Scanner Input',
        bulkQty: 'Bulk Qty Update Popup',
        saveDraft: 'Save Draft Document',
        uom: 'Toggle UOM of Row',
        warehouseBranch: 'Focus Warehouse/Branch',
        addRow: 'Add Item Row',
        submit: 'Submit Document'
    }
};

// Normalized helper to compare shortcut strings.
export const matchShortcutEvent = (e, shortcutString) => {
    if (!shortcutString) return false;
    
    // Normalize shortcut string: split by + and trim
    const parts = shortcutString.toUpperCase().split('+').map(p => p.trim());
    
    // Extract modifiers
    const needsCtrl = parts.includes('CTRL') || parts.includes('CONTROL');
    const needsAlt = parts.includes('ALT');
    const needsShift = parts.includes('SHIFT');
    
    // Find the main key (which is the part that is not CTRL, ALT, or SHIFT)
    const mainKeyPart = parts.find(p => p !== 'CTRL' && p !== 'CONTROL' && p !== 'ALT' && p !== 'SHIFT');
    if (!mainKeyPart) return false;
    
    // Check modifiers match
    if (e.ctrlKey !== needsCtrl) return false;
    if (e.altKey !== needsAlt) return false;
    if (e.shiftKey !== needsShift) return false;
    
    // Check key
    let eventKey = e.key.toUpperCase();
    let targetKey = mainKeyPart;
    
    // Translate special terms
    if (targetKey === 'SPACE') targetKey = ' ';
    if (eventKey === ' ') eventKey = 'SPACE'; // standardise space key comparison
    
    return eventKey === targetKey;
};

export const getShortcutStringFromEvent = (e) => {
    // Exclude modifier keys themselves as main keys
    const modifiers = ['Control', 'Alt', 'Shift', 'Meta'];
    if (modifiers.includes(e.key)) return '';
    
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    
    let mainKey = e.key;
    if (mainKey === ' ') mainKey = 'Space';
    
    // Format main key
    if (mainKey.length === 1) {
        mainKey = mainKey.toUpperCase();
    } else {
        // e.g. "Escape", "ArrowUp", "Enter", "F1", etc.
        mainKey = mainKey.charAt(0).toUpperCase() + mainKey.slice(1);
    }
    
    parts.push(mainKey);
    return parts.join('+');
};

export const useCustomShortcuts = () => {
    const [shortcuts, setShortcuts] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all keys exist
                return {
                    pos_home: { ...DEFAULT_SHORTCUTS.pos_home, ...parsed.pos_home },
                    doc_editor: { ...DEFAULT_SHORTCUTS.doc_editor, ...parsed.doc_editor }
                };
            }
        } catch (e) {
            console.error("Failed to parse saved shortcut keys:", e);
        }
        return DEFAULT_SHORTCUTS;
    });

    useEffect(() => {
        const handleUpdate = () => {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    setShortcuts(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to reload shortcut keys:", e);
            }
        };

        window.addEventListener(EVENT_NAME, handleUpdate);
        return () => window.removeEventListener(EVENT_NAME, handleUpdate);
    }, []);

    const getShortcut = useCallback((page, actionId, defaultVal) => {
        return shortcuts[page]?.[actionId] || defaultVal || DEFAULT_SHORTCUTS[page]?.[actionId] || '';
    }, [shortcuts]);

    const isShortcutPressed = useCallback((e, page, actionId, defaultVal) => {
        const keyString = getShortcut(page, actionId, defaultVal);
        return matchShortcutEvent(e, keyString);
    }, [getShortcut]);

    const updateShortcut = useCallback((page, actionId, newKey) => {
        setShortcuts(prev => {
            const updated = {
                ...prev,
                [page]: {
                    ...prev[page],
                    [actionId]: newKey
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new Event(EVENT_NAME));
            return updated;
        });
    }, []);

    const resetAllShortcuts = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setShortcuts(DEFAULT_SHORTCUTS);
        window.dispatchEvent(new Event(EVENT_NAME));
    }, []);

    return {
        shortcuts,
        getShortcut,
        isShortcutPressed,
        updateShortcut,
        resetAllShortcuts
    };
};
