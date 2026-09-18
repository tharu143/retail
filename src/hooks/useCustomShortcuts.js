import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pos_custom_shortcut_keys';
const EVENT_NAME = 'pos_shortcuts_updated';

export const DEFAULT_SHORTCUTS = {
    pos_home: {
        discount: 'F1',
        customer: 'F2',
        search: 'F3',
        countryCode: 'F4',
        itemDetail: 'F5',
        bulkQty: 'F6',
        stock: 'F7',
        uom: 'F8',
        boxUom: 'Ctrl+B',
        masterBoxUom: 'Ctrl+M',
        nosUom: 'Ctrl+N',
        orders: 'F9',
        printBill: 'F10',
        priceUpdate: 'F11',
        loyalty: 'Alt+L',
        saveDraft: 'Alt+S',
        clearBill: 'Alt+C',
        printJob: 'Alt+P',
        fastPrint: 'Alt+F',
        itemFilter: 'Alt+S',
        directCash: 'Alt+1',
        directBank: 'Ctrl+V',
        directCard: 'Alt+2',
        selectItem: 'Alt+I',
        pay: 'Space'
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
        itemDetail: 'Selected Item Detail Modal',
        bulkQty: 'Bulk Qty Update',
        stock: 'Stock Breakdown Lookup',
        uom: 'Cycle / Toggle UOM in Cart',
        boxUom: 'Set Box UOM Directly',
        masterBoxUom: 'Set Master Box UOM Directly',
        nosUom: 'Set Nos / Piece UOM Directly',
        orders: 'Active Orders (Drafts) Modal',
        printBill: 'Print Last Invoice / Bill',
        priceUpdate: 'Quick Price Update',
        loyalty: 'Loyalty Modal Toggle',
        saveDraft: 'Save Current Draft',
        clearBill: 'Clear Cart / Bill',
        printJob: 'Print Job Calculator',
        fastPrint: 'Fast Print Modal',
        itemFilter: 'Item Search & Filter Drawer',
        directCash: 'Direct Cash Complete',
        directBank: 'Direct Bank Complete',
        directCard: 'Direct Card Complete',
        selectItem: 'Grid Item Selection / Swap',
        pay: 'Checkout / Pay (Classic)'
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
    const needsCtrl = parts.includes('CTRL') || parts.includes('CONTROL') || parts.includes('CMD') || parts.includes('COMMAND');
    const needsAlt = parts.includes('ALT') || parts.includes('OPTION');
    const needsShift = parts.includes('SHIFT');
    
    // Find the main key (which is the part that is not CTRL, ALT, or SHIFT)
    const mainKeyPart = parts.find(p => !['CTRL', 'CONTROL', 'CMD', 'COMMAND', 'ALT', 'OPTION', 'SHIFT', 'META'].includes(p));
    if (!mainKeyPart) return false;
    
    // Check modifiers match - on Mac, Command key (e.metaKey) or Ctrl key (e.ctrlKey) both satisfy Ctrl/Cmd
    const hasCtrlOrMeta = !!(e.ctrlKey || e.metaKey);
    if (hasCtrlOrMeta !== needsCtrl) return false;
    if (!!e.altKey !== needsAlt) return false;
    if (!!e.shiftKey !== needsShift) return false;
    
    // Check key - use both e.key and e.code for Mac compatibility.
    // On Mac, Option+letter generates special characters in e.key (e.g. Option+S → "ß", Option+N → "˜", Option+K → "˚"),
    // but e.code always reflects the physical key pressed (e.g. "KeyS", "KeyN", "KeyK").
    let eventKey = (e.key || '').toUpperCase();
    let targetKey = mainKeyPart;
    
    // Translate special terms
    if (targetKey === ' ' || targetKey === 'SPACE') targetKey = 'SPACE';
    if (eventKey === ' ' || eventKey === 'SPACE') eventKey = 'SPACE';
    
    // Direct match on e.key
    if (eventKey === targetKey) return true;
    
    // Match common Mac Option dead keys directly
    const macOptionMap = {
        '˜': 'N', '~': 'N', 'ˆ': 'I', 'ˇ': 'C', '´': 'E', '`': '`',
        'Å': 'A', 'Í': 'S', 'Ï': 'F', '∏': 'P', 'π': 'P', 'ß': 'S',
        '©': 'G', '˙': 'H', '∆': 'J', '˚': 'K', '¬': 'L', 'µ': 'M',
        '≈': 'X', 'Ç': 'C', 'ç': 'C', '√': 'V', '∫': 'B', 'Ω': 'Z',
        'œ': 'Q', '∑': 'W', '®': 'R', '†': 'T', '¥': 'Y', 'ø': 'O',
        '¡': '1', '™': '2', '£': '3', '¢': '4', '∞': '5', '§': '6',
        '¶': '7', '•': '8', 'ª': '9', 'º': '0'
    };
    if (macOptionMap[e.key] && macOptionMap[e.key] === targetKey) {
        return true;
    }
    
    // Fallback: check physical key via e.code (e.g. "KeyS" -> "S", "KeyN" -> "N", "Digit1" -> "1", "F10" -> "F10")
    if (e.code) {
        let codeKey = e.code.toUpperCase();
        if (codeKey.startsWith('KEY')) codeKey = codeKey.slice(3);         // "KEYN" -> "N"
        else if (codeKey.startsWith('DIGIT')) codeKey = codeKey.slice(5);  // "DIGIT1" -> "1"
        else if (codeKey.startsWith('NUMPAD')) codeKey = codeKey.slice(6); // "NUMPAD1" -> "1"
        if (codeKey === targetKey) return true;
    }
    
    return false;
};


export const getShortcutStringFromEvent = (e) => {
    // Exclude modifier keys themselves as main keys
    const modifiers = ['Control', 'Alt', 'Shift', 'Meta'];
    if (modifiers.includes(e.key)) return '';
    
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    
    let mainKey = e.key;
    if (mainKey === ' ') mainKey = 'Space';
    
    // If on Mac and pressing Option/Alt, resolve the real key using e.code
    if (e.altKey && e.code && e.code.startsWith('Key')) {
        mainKey = e.code.slice(3);
    } else if (mainKey.length === 1) {
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
                // Auto-migrate old default shortcut keys for stock (F5 -> F7) and pay (F7 -> Space) and saveDraft (F10 -> Alt+S)
                let needsWrite = false;
                if (parsed.pos_home) {
                    if (parsed.pos_home.stock === 'F5') {
                        parsed.pos_home.stock = 'F7';
                        needsWrite = true;
                    }
                    if (parsed.pos_home.pay === 'F7') {
                        parsed.pos_home.pay = 'Space';
                        needsWrite = true;
                    }
                    if (parsed.pos_home.saveDraft === 'F10') {
                        parsed.pos_home.saveDraft = 'Alt+S';
                        needsWrite = true;
                    }
                    if (parsed.pos_home.printBill === undefined) {
                        parsed.pos_home.printBill = 'F10';
                        needsWrite = true;
                    }
                    if (parsed.pos_home.loyalty === 'F12' || !parsed.pos_home.loyalty) {
                        parsed.pos_home.loyalty = 'Alt+L';
                        needsWrite = true;
                    }
                }
                if (needsWrite) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                }
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

    const getRawShortcut = useCallback((page, actionId, defaultVal) => {
        return shortcuts[page]?.[actionId] || defaultVal || DEFAULT_SHORTCUTS[page]?.[actionId] || '';
    }, [shortcuts]);

    const getShortcut = useCallback((page, actionId, defaultVal) => {
        const rawStr = getRawShortcut(page, actionId, defaultVal);
        if (!rawStr) return '';
        
        const isMac = typeof navigator !== 'undefined' && (
            (navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0) ||
            (navigator.userAgent && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)
        );
        
        if (!isMac) {
            return rawStr
                .replace(/^⌥\s*\+?\s*/i, 'Alt+')
                .replace(/^Option\s*\+\s*/i, 'Alt+')
                .replace(/^⌘\s*\+?\s*/i, 'Ctrl+')
                .replace(/^\^\s*\+?\s*/i, 'Ctrl+')
                .replace(/^\^\s*Ctrl\s*\+\s*/i, 'Ctrl+');
        }
        
        const parts = rawStr.split('+').map(p => p.trim());
        const modSymbols = [];
        let mainKey = '';
        
        parts.forEach(part => {
            const p = part.toUpperCase();
            if (p === 'ALT' || p === 'OPTION' || p === '⌥') modSymbols.push('⌥');
            else if (p === 'CTRL' || p === 'CONTROL' || p === '⌃' || p === '^') modSymbols.push('⌃');
            else if (p === 'CMD' || p === 'COMMAND' || p === '⌘') modSymbols.push('⌘');
            else if (p === 'SHIFT' || p === '⇧') modSymbols.push('⇧');
            else mainKey = part;
        });
        
        if (modSymbols.length > 0) {
            return `${modSymbols.join('')}${mainKey.toUpperCase()}`;
        }
        if (/^F\d{1,2}$/i.test(mainKey)) {
            return `fn+${mainKey.toUpperCase()}`;
        }
        return mainKey;
    }, [getRawShortcut]);

    const isShortcutPressed = useCallback((e, page, actionId, defaultVal) => {
        const keyString = getRawShortcut(page, actionId, defaultVal);
        return matchShortcutEvent(e, keyString);
    }, [getRawShortcut]);

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
