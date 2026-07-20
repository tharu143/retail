                      {formData.taxes && formData.taxes.length > 0 && (
                        <div className="so-items-table-wrap mt-4">
                          <table className="so-taxes-table">
                            <thead>
                              <tr>
                                <th style={{ width: '25%' }}>Type</th>
                                <th style={{ width: '30%' }}>Account</th>
                                <th style={{ width: '15%' }}>Rate %</th>
                                <th style={{ width: '15%' }}>Amount</th>
                                <th style={{ width: '15%' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formData.taxes.map((tax, i) => (
                                <tr key={i}>
                                  <td>
                                    <div className="so-view-field">{tax.charge_type || 'On Net Total'}</div>
                                  </td>
                                  <td>
                                    <div className="so-view-field">{tax.account_head}</div>
                                  </td>
                                  <td>
                                    <div className="so-view-field">{parseFloat(tax.rate || 0).toFixed(2)}%</div>
                                  </td>
                                  <td>
                                    <div className="so-view-field">{parseFloat(tax.tax_amount || 0).toFixed(2)}</div>
                                  </td>
                                  <td>
                                    <div className="so-view-field font-semibold text-gray-800">
                                      {parseFloat(formData.total + (tax.tax_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
