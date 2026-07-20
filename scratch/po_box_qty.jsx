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
