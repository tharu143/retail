                  <div className="purchase-table-container">
                    <table className="purchase-table">
                      <thead>
                        <tr>
                          {(() => {
                            const hasAnyBox = formData.items.some(i => i.use_box_entry);
                            const activeCols = poColumns.filter(c => {
                              if (!c.visible) return false;
                              if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                              return true;
                            });

                            return activeCols.map(col => {
                              let finalLabel = col.label;

                              if (!hasAnyBox) {
                                if (col.id === 'custom_box_qty') finalLabel = 'Qty';
                                if (col.id === 'custom_box_price') finalLabel = 'Price';
                                if (col.id === 'custom_pieces_per_box') finalLabel = '';
                              }

                              let alignClass = "text-center";
                              if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
                                alignClass = "text-left pl-3";
                              } else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) {
                                alignClass = "text-right pr-3";
                              }

                              return (
                                <th
                                  key={col.id}
                                  className={`purchase-th ${alignClass}`}
                                  style={{ width: col.width, minWidth: col.id === 'item_code' ? 120 : undefined }}
                                >
                                  {finalLabel.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                      {line}
                                      {i < finalLabel.split('\n').length - 1 && <br />}
                                    </React.Fragment>
                                  ))}
                                </th>
                              );
                            });
                          })()}
                          <th className="purchase-th w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx} tabIndex={-1} data-row-index={idx} className="group hover:bg-slate-50 transition-colors">
                            {(() => {
                              const hasAnyBox = formData.items.some(i => i.use_box_entry);
                              const activeCols = poColumns.filter(c => {
                                if (!c.visible) return false;
                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                return true;
                              });

                              return activeCols.map(col => {
                                switch (col.id) {
                                  case 'scanner':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <input
                                              type="text"
                                              value={item.temp_barcode ?? ''}
                                              placeholder={isViewOnly ? '' : 'Barcode'}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleBarcodeScan(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.target.value) handleBarcodeEnter(e, idx);
                                                else handleNextFocus(e);
                                              }}
                                              className="text-center font-bold"
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'item_code':
                                    return (
                                      <td key={col.id} className="purchase-td" style={{ verticalAlign: 'middle' }}>
                                        <div className="premium-cell-container" style={{ minHeight: '36px', justifyContent: 'center' }}>
                                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                            {!(isViewOnly || formData.docstatus !== 0) ? (
                                              <CustomSearchDropdown
                                                value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                placeholder="Search item..."
                                                onSelect={(val) => handleItemSelect(val, idx)}
                                                themeColor="var(--po-primary)"
                                                optionsLabel="name"
                                                fetchData={fetchItems}
                                                globalSearch={true}
                                                onGlobalSearch={handleGlobalItemSearch}
                                                onActivate={handleActivateItem}
                                              />
                                            ) : (
                                              item.item_code && (
                                                <div style={{
                                                  padding: '4px 10px',
                                                  background: 'white',
                                                  border: '1px solid #e2e8f0',
                                                  borderLeft: '4px solid var(--po-primary)',
                                                  borderRadius: '0.375rem',
                                                  boxSizing: 'border-box',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  height: '36px'
                                                }}>
                                                  <div style={{ color: '#1e293b', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'center' }}>
                                                    {item.item_name || 'Unnamed Item'}
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_box_qty':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box" style={{ position: 'relative' }}>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                              value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleInputChange(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={handleNextFocus}
                                              className={`text-left pl-3 font-bold outline-none ${item.use_box_entry ? 'text-sky-600' : 'text-slate-800'}`}
                                              style={{ paddingRight: item.item_code ? '48px' : '0.5rem' }}
                                              title={item.use_box_entry ? "Number of Boxes" : "Quantity"}
                                            />
                                            {item.item_code && (
                                              <span
                                                className="absolute right-2 text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
                                                style={{
                                                  color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                  backgroundColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                  borderColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0',
                                                  lineHeight: 1
                                                }}
                                              >
                                                {item.use_box_entry ? 'BOXES' : 'NOS'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_pieces_per_box':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {item.use_box_entry ? (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_pieces_per_box"
                                                value={item.custom_pieces_per_box || ''}
                                                readOnly={isViewOnly || formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className="text-left pl-3"
                                                title="Pieces per Box"
                                              />
                                            ) : (
                                              <div className="premium-cell-readonly premium-cell-readonly-left pl-3"></div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_box_price':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {item.use_box_entry ? (
                                              isViewOnly ? (
                                                <div className="premium-cell-readonly premium-cell-readonly-right">{formatPrice(item.custom_box_price)}</div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  inputMode="decimal"
                                                  name="custom_box_price"
                                                  value={item.custom_box_price || ''}
                                                  readOnly={formData.docstatus !== 0}
                                                  onChange={(e) => handleInputChange(e, idx)}
                                                  onFocus={(e) => e.target.select()}
                                                  onClick={(e) => e.target.select()}
                                                  onKeyDown={handleNextFocus}
                                                  className="text-right pr-3 font-bold"
                                                />
                                              )
                                            ) : (
                                              <div className="premium-cell-readonly premium-cell-readonly-center"></div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_selling_price':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewOnly ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right !text-[var(--po-primary)]">{formatPrice(item.custom_selling_price)}</div>
                                            ) : (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_selling_price"
                                                value={item.custom_selling_price || ''}
                                                readOnly={formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className="text-right pr-3 font-bold !text-[var(--po-primary)]"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_ref_sl_no':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <input
                                              type="text"
                                              name="custom_ref_sl_no"
                                              value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleInputChange(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={handleNextFocus}
                                              placeholder={isViewOnly ? '' : 'Serial...'}
                                              className="text-center text-[10px] font-bold"
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'qty':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box" style={{ position: 'relative' }}>
                                            <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold" style={{ paddingRight: item.use_box_entry ? '42px' : '0.5rem' }}>{item.qty || 0}</div>
                                            {item.use_box_entry && (
                                              <span
                                                className="absolute right-2 text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
                                                style={{
                                                  color: '#64748b',
                                                  backgroundColor: '#f8fafc',
                                                  borderColor: '#e2e8f0',
                                                  lineHeight: 1
                                                }}
                                              >
                                                NOS
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'uom':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {!item.item_code || isViewOnly || formData.docstatus !== 0 ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center text-[10px] font-bold uppercase text-slate-700">
                                                {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
                                              </div>
                                            ) : (
                                              <select
                                                value={item.uom || item.stock_uom || ''}
                                                onChange={(e) => handleUOMChange(e.target.value, idx)}
                                                className="text-center text-[10px] font-bold text-slate-600 bg-white"
                                                title="Select Unit of Measure"
                                              >
                                                {(() => {
                                                  const uniqueUoms = [];
                                                  const seen = new Set();
                                                  const candidates = [];

                                                  if (item.uom_list && Array.isArray(item.uom_list)) {
                                                    item.uom_list.forEach(u => {
                                                      if (u && u.uom) candidates.push(u.uom);
                                                    });
                                                  }

                                                  candidates.push(item.stock_uom || 'Nos');
                                                  candidates.push(item.uom || 'Nos');
                                                  candidates.push('Nos');
                                                  candidates.push('Box');

                                                  candidates.forEach(u => {
                                                    const norm = u.trim().toLowerCase();
                                                    let display = u.trim();
                                                    if (norm === 'box') display = 'Box';
                                                    else if (norm === 'nos') display = 'Nos';

                                                    if (!seen.has(norm)) {
                                                      seen.add(norm);
                                                      uniqueUoms.push(display);
                                                    }
                                                  });

                                                  return uniqueUoms.map(uomVal => (
                                                    <option key={uomVal} value={uomVal}>{uomVal}</option>
                                                  ));
                                                })()}
                                              </select>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'rate':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewOnly && !isUpdateMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold">{formatPrice(item.rate)}</div>
                                            ) : (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="rate"
                                                value={item.rate || ''}
                                                readOnly={!isUpdateMode && formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className={`text-right pr-3 font-bold outline-none ${isUpdateMode ? 'bg-amber-50 ring-1 ring-amber-200 rounded px-1' : ''}`}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'amount':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-900 tabular-nums">{formatPrice(item.amount)}</div>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                }
                              });
                            })()}
                            <td className="purchase-td text-center">
                              {!isViewOnly && formData.docstatus === 0 && (
                                <button type="button" onClick={() => removeItemRow(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
