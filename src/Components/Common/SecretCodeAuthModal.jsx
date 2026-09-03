import React, { useState, useEffect, useRef } from 'react';
import { Lock, UserCheck, AlertCircle, X, Check, Loader2 } from 'lucide-react';
import axios from 'axios';

/**
 * SecretCodeAuthModal
 * Prompts the user for their employee PIN / Secret Code.
 * Validates the secret code in real-time as they type (showing Employee Name & Branch).
 * Calls onConfirm({ secret_key, employee_name, employee_id, is_manager }) upon confirmation.
 */
const SecretCodeAuthModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Authentication Required",
  subtitle = "Enter Employee Secret Code to authorize this action",
  actionName = "Create / Activate Supplier",
  warehouse
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedEmp, setVerifiedEmp] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setVerifiedEmp(null);
      setError('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Real-time lookup as user types PIN
  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length >= 3) {
      const timer = setTimeout(async () => {
        try {
          const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_cashier_by_secret_key', {
            params: { secret_key: trimmed, warehouse },
            withCredentials: true
          });
          const data = res.data?.message || {};
          if (data.status === 'success' && data.employee_name) {
            setVerifiedEmp(data);
            setError('');
          } else {
            setVerifiedEmp(null);
            setError(data.message || 'Invalid Secret Code');
          }
        } catch (err) {
          setVerifiedEmp(null);
          setError('Authentication verification failed');
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setVerifiedEmp(null);
      setError('');
    }
  }, [pin, warehouse]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!verifiedEmp) {
      setError('Please enter a valid Secret Code first');
      return;
    }
    setLoading(true);
    onConfirm({
      secret_key: pin.trim(),
      employee_name: verifiedEmp.employee_name,
      employee_id: verifiedEmp.employee_id,
      is_manager: verifiedEmp.is_manager
    });
  };

  return (
    <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <Lock size={16} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 font-medium">{actionName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {subtitle}
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">
              Secret Code / PIN <span className="text-rose-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={10}
              className="w-full text-center tracking-[0.3em] font-mono text-xl py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-800"
            />
          </div>

          {/* Real-time Employee Name feedback */}
          {verifiedEmp && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs">
                <UserCheck size={16} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-black text-emerald-900 truncate">
                  {verifiedEmp.employee_name}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold tracking-wide truncate">
                  {verifiedEmp.is_manager ? 'Universal Manager' : (verifiedEmp.branch || 'Authorized Cashier')}
                </span>
              </div>
              <Check size={18} className="text-emerald-600 shrink-0" />
            </div>
          )}

          {/* Error feedback */}
          {error && pin.length >= 3 && !verifiedEmp && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold animate-fadeIn">
              <AlertCircle size={15} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!verifiedEmp || loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SecretCodeAuthModal;
