import React, { useState, useEffect } from 'react';
import { ShieldAlert, Video, Calendar, Clock, User, Warehouse, AlertCircle, FileText, CheckCircle2, RefreshCw, Eye, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';

const CashDrawerAuditList = () => {
  const loggedWarehouse = useSelector(state => state.user?.warehouse || '');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [loggedWarehouse]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_cash_drawer_audit_logs', {
        params: { warehouse: loggedWarehouse, limit: 30 }
      });
      setLogs(res.data?.message?.data || []);
    } catch (err) {
      console.error("Fetch audit logs error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans antialiased text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Cash Drawer Audit Logs</h1>
            <p className="text-xs font-semibold text-slate-500">Security & Video Audit for Cash Drawer Opens (Authorized & Unauthorized)</p>
          </div>
        </div>
        <button
          onClick={fetchAuditLogs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95"
        >
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Event Type / Invoice</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Video & Evidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                    No cash drawer audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((row, idx) => {
                  const isUnauthorized = row.event_type?.includes('Manual') || row.status?.includes('Warning');
                  const attachments = row.attachments || [];
                  const mp4File = attachments.find(f => f.file_url?.endsWith('.mp4'));
                  const openImg = attachments.find(f => f.file_name?.includes('open'));
                  const closeImg = attachments.find(f => f.file_name?.includes('close'));

                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors font-semibold">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 w-fit ${isUnauthorized ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                            {isUnauthorized ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
                            {row.event_type || 'Sales Invoice Bill'}
                          </span>
                          {row.sales_invoice && (
                            <span className="text-[10px] font-mono text-slate-500 font-bold">{row.sales_invoice}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {row.creation ? new Date(row.creation).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{row.cashier || 'Cashier'}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{row.duration_seconds ? `${row.duration_seconds}s` : '12.5s'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {mp4File ? (
                            <button
                              onClick={() => setActiveMedia({ type: 'video', url: mp4File.file_url, title: row.name })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                            >
                              <Video size={12} /> Play Video
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-mono flex items-center gap-1">
                              <Video size={12} className="text-slate-400" /> Pending Stream Clip
                            </span>
                          )}

                          {openImg && (
                            <button
                              onClick={() => setActiveMedia({ type: 'image', url: openImg.file_url, title: `${row.name} - Open` })}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all"
                              title="View Open Snapshot"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Media Modal */}
      {activeMedia && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Video size={16} className="text-emerald-600" /> Security Evidence: {activeMedia.title}
              </h3>
              <button
                onClick={() => setActiveMedia(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {activeMedia.type === 'video' ? (
                <video src={activeMedia.url} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <img src={activeMedia.url} alt="Evidence snapshot" className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashDrawerAuditList;
