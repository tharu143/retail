import React, { useState, useEffect } from 'react';
import { Camera, Shield, Save, CheckCircle2, Loader2, Wifi, Key, Server, AlertCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Swal from 'sweetalert2';

const CameraSettings = () => {
  const loggedWarehouse = useSelector(state => state.user?.warehouse || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    camera_name: 'EZVIZ TY1 (BG1064879)',
    camera_type: 'EZVIZ Cloud API',
    device_serial: 'BG1064879',
    verification_code: '',
    ip_address: '192.168.1.105',
    rtsp_port: '554',
    branch: loggedWarehouse || ''
  });

  useEffect(() => {
    fetchSettings();
  }, [loggedWarehouse]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_camera_setting', {
        params: { warehouse: loggedWarehouse }
      });
      if (res.data?.message?.data) {
        const d = res.data.message.data;
        setForm(prev => ({
          ...prev,
          camera_name: d.camera_name || 'EZVIZ TY1 (BG1064879)',
          camera_type: d.camera_type || 'EZVIZ Cloud API',
          device_serial: d.device_serial || 'BG1064879',
          verification_code: d.verification_code || '',
          ip_address: d.ip_address || '192.168.1.105',
          rtsp_port: String(d.rtsp_port || 554),
          branch: d.branch || loggedWarehouse || ''
        }));
      }
    } catch (err) {
      console.error("Fetch camera setting error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.save_pos_camera_setting', {
        params: {
          camera_name: form.camera_name,
          device_serial: form.device_serial,
          camera_type: form.camera_type,
          verification_code: form.verification_code,
          ip_address: form.ip_address,
          branch: form.branch
        }
      });
      if (res.data?.message?.status === 'success') {
        Swal.fire({
          icon: 'success',
          title: 'Camera Setting Saved',
          text: `EZVIZ TY1 (${form.device_serial}) configured successfully.`,
          confirmButtonColor: '#10b981'
        });
      } else {
        throw new Error(res.data?.message?.message || 'Failed to save settings');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans antialiased text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
            <Camera size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">POS Camera Configuration</h1>
            <p className="text-xs font-semibold text-slate-500">Connect EZVIZ TY1 / RTSP Security Camera to Cash Drawer Events</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Active Branch: {loggedWarehouse || 'Default'}
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Camera Configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Camera Identification */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Shield className="text-emerald-600" size={18} />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Camera Identification</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Camera Display Name</label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all"
                  value={form.camera_name}
                  onChange={e => setForm({ ...form, camera_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Device Serial Number (S/N)</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all uppercase"
                    value={form.device_serial}
                    onChange={e => setForm({ ...form, device_serial: e.target.value.toUpperCase() })}
                    placeholder="e.g. BG1064879"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-extrabold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    TY1
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: EZVIZ Verification & Connection */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Key className="text-emerald-600" size={18} />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">EZVIZ Verification & IP Details</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Camera Verification Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all uppercase"
                  placeholder="Verification Code on camera sticker"
                  value={form.verification_code}
                  onChange={e => setForm({ ...form, verification_code: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Printed under camera QR sticker (6 uppercase letters/numbers)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Local IP Address</label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none focus:border-emerald-500 transition-all"
                  value={form.ip_address}
                  onChange={e => setForm({ ...form, ip_address: e.target.value })}
                  placeholder="192.168.1.105"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-800">
                When cash drawer opens during payment or manual key trigger, snapshots (`drawer_open.jpg` & `drawer_close.jpg`) and a 10-second MP4 video clip will automatically attach to the <strong>Sales Invoice</strong> and <strong>Cash Drawer Audit Log</strong>.
              </p>
            </div>
          </div>

          {/* Card 3: Local Shop PC Camera Agent Guide */}
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
              <Server className="text-emerald-400" size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Shop Local PC Agent Setup (Wi-Fi IP: 192.168.29.1)</h2>
            </div>
            <p className="text-xs text-slate-300 mb-3 font-medium">
              Run this 1-line Python command on your Shop POS Computer connected to the <strong>192.168.29.1</strong> Wi-Fi network to stream live camera photos directly to ERPNext:
            </p>
            <div className="erp-scroll-region bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto select-all">
              curl -s http://75.119.130.59:8089/files/pos_local_camera_agent.py | python3
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Camera Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CameraSettings;
