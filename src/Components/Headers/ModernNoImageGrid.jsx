import React from 'react';
import { Barcode, Info, SearchSlash } from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const ModernNoImageGrid = ({
    filteredItems,
    setLastInteractedItem,
    handleAddToBill,
    handleOutOfStockAlert,
    showStockBreakdown,
    handleFindNearestStock
}) => {
    return (
        <div className="so-grid-area">
            {filteredItems.length === 0 ? (
                <div className="col-span-full h-96 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-70">
                    <SearchSlash size={64} strokeWidth={1} />
                    <span className="font-black text-sm uppercase tracking-[0.2em]">No products found</span>
                </div>
            ) : (
                filteredItems.map(item => (
                    <div
                        key={item.id}
                        className="so-item-card no-image"
                        onClick={() => {
                            setLastInteractedItem(item);
                            if (item.local_qty > 0) {
                                handleAddToBill(item);
                            } else {
                                handleOutOfStockAlert(item);
                            }
                        }}
                        style={{ opacity: item.local_qty > 0 ? 1 : 0.6 }}
                    >
                        {/* Top Row: Barcode */}
                        <div className="flex items-center justify-between w-full" style={{ height: '16px' }}>
                            {((item.barcodes && item.barcodes.length > 0) || item.barcode || item.id) ? (
                                <span className="text-slate-400 font-bold flex items-center gap-1 text-[9px]" style={{ letterSpacing: '0.02em' }}>
                                    <Barcode size={10} className="opacity-60" /> {item.barcodes?.[0]?.barcode || item.barcode || item.id}
                                </span>
                            ) : (
                                <span className="text-slate-300 font-bold flex items-center gap-1 text-[9px]">
                                    <Barcode size={10} className="opacity-20" /> -
                                </span>
                            )}
                        </div>

                        {/* Item Name */}
                        <h4 className="so-item-name flex-1 mt-1 text-[11px] font-black uppercase text-slate-800" style={{ minHeight: 'auto', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.name}
                        </h4>

                        {/* Bottom Row: Price & Info Button */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-0.5">Price</span>
                                <span className="font-black text-slate-900 text-[12px] flex items-center gap-0.5">
                                    <DirhamIcon size={10} className="text-slate-400" /> {parseFloat(item.price).toFixed(2)}
                                </span>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    showStockBreakdown(item);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all border border-slate-100"
                            >
                                <Info size={12} />
                            </button>
                        </div>

                        <div style={{ height: '24px', display: 'flex', alignItems: 'center', marginTop: '4px', flexShrink: 0 }}>
                            {item.local_qty <= 0 ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFindNearestStock(item);
                                    }}
                                    className="w-full py-1 bg-slate-50 text-slate-400 rounded-lg border border-slate-200 text-[8px] font-bold uppercase tracking-tight hover:bg-slate-200 hover:text-slate-600 transition-all"
                                >
                                    Request More Stock
                                </button>
                            ) : (
                                <div className={`so-item-instock-placeholder ${item.local_qty <= 10 ? 'low-stock' : ''}`} style={{ padding: '0.15rem 0' }}>
                                    {item.local_qty} UNITS
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ModernNoImageGrid;