                                    case 'custom_box_qty':
                                      return (
                                        <td key={col.id}>
                                          <div className="premium-cell-container">
                                            <div className="premium-cell-box" style={{ position: 'relative' }}>
                                              {isViewMode ? (
                                                <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold" style={{ color: item.use_box_entry ? themeColor : undefined, paddingRight: item.item_code ? '48px' : '0.5rem' }}>
                                                  {item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                </div>
                                              ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const fieldName = item.use_box_entry ? "custom_box_qty" : "accepted_qty";
                                                      const currentVal = parseFloat(item.use_box_entry ? item.custom_box_qty : item.accepted_qty) || 0;
                                                      updateItem(i, fieldName, Math.max(0, currentVal - 1));
                                                    }}
                                                    style={{ padding: '0 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px 0 0 4px', height: '36px', fontWeight: 'bold', cursor: 'pointer' }}
                                                  >
                                                    -
                                                  </button>
                                                  <input
                                                    type="number"
                                                    value={item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                    onFocus={e => e.target.select()}
                                                    onClick={e => e.target.select()}
                                                    onChange={e => updateItem(i, item.use_box_entry ? "custom_box_qty" : "accepted_qty", e.target.value)}
                                                    className="so-input text-center font-bold"
                                                    style={{ borderTop: item.use_box_entry ? `1px solid ${themeColor}40` : undefined, borderBottom: item.use_box_entry ? `1px solid ${themeColor}40` : undefined, borderRadius: 0, height: '36px', paddingRight: item.item_code ? '48px' : '0.5rem', width: '40px', flex: 1, minWidth: '40px' }}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const fieldName = item.use_box_entry ? "custom_box_qty" : "accepted_qty";
                                                      const currentVal = parseFloat(item.use_box_entry ? item.custom_box_qty : item.accepted_qty) || 0;
                                                      updateItem(i, fieldName, currentVal + 1);
                                                    }}
                                                    style={{ padding: '0 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0 4px 4px 0', height: '36px', fontWeight: 'bold', cursor: 'pointer' }}
                                                  >
                                                    +
                                                  </button>
                                                </div>
                                              )}
                                              {item.item_code && (
                                                <span
                                                  className="absolute text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
                                                  style={{
                                                    position: 'absolute',
                                                    right: '34px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: item.use_box_entry ? themeColor : '#64748b',
                                                    backgroundColor: item.use_box_entry ? `${themeColor}12` : '#f8fafc',
                                                    borderColor: item.use_box_entry ? `${themeColor}25` : '#e2e8f0',
                                                    lineHeight: 1,
                                                    zIndex: 5
                                                  }}
                                                >
                                                  {item.use_box_entry ? 'BOXES' : 'NOS'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      );
