// src/Components/Admin/AttachmentSection.jsx
import React, { useState, useEffect } from 'react';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Paperclip, Trash2, Download, Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function AttachmentSection({ doctype, docname, compact = false }) {
  const { themeColor, themeLight } = useLegacyTheme();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async () => {
    if (!docname) return;
    try {
      setLoading(true);
      const res = await axios.get(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_attachments`, {
        params: { doctype, name: docname }
      });
      if (res.data.message?.success) {
        setAttachments(res.data.message.data || []);
      }
    } catch (err) {
      console.error("Failed to load attachments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [doctype, docname]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('doctype', doctype);
        formData.append('docname', docname);
        formData.append('is_private', 0);

        await axios.post('/api/method/upload_file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      Swal.fire({
        icon: 'success',
        title: 'Uploaded!',
        text: 'Attachment(s) uploaded successfully.',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchAttachments();
    } catch (err) {
      console.error(err);
      Swal.fire('Upload Failed', 'Ensure file size is within limits and you are logged in.', 'error');
    } finally {
      setUploading(false);
      // Reset input value
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to permanently delete this attachment?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      const res = await axios.post(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.delete_attachment`, {
        file_id: fileId
      });
      if (res.data.message?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Attachment has been deleted.',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        fetchAttachments();
      } else {
        throw new Error(res.data.message?.message || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Delete Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (!docname) {
    return (
      <div 
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden mt-4 shadow-sm opacity-70"
        style={{
          display: 'block',
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          marginTop: '1rem',
          marginBottom: '1rem',
          opacity: 0.7,
          flexShrink: 0
        }}
      >
        <div 
          className={`px-4 py-3.5 border-b border-slate-50 flex ${compact ? 'flex-col gap-2.5 items-stretch' : 'items-center justify-between'} bg-slate-50/20`}
          style={{
            display: 'flex',
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'stretch' : 'center',
            justifyContent: compact ? 'stretch' : 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            background: 'rgba(248, 250, 252, 0.5)'
          }}
        >
          <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: themeColor }} />
            <div 
              className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
              style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <Paperclip size={14} style={{ color: themeColor }} />
              Attachments (0)
            </div>
          </div>
        </div>
        <div className="p-4 text-center py-6" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <Paperclip size={24} className="mx-auto text-slate-300 mb-2" style={{ margin: '0 auto 0.5rem', color: '#cbd5e1' }} />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Unsaved Document</p>
          <p className="text-[9px] text-slate-400 mt-1 font-semibold" style={{ fontSize: '9px', color: '#94a3b8', marginTop: '0.25rem', fontWeight: '600', margin: '0.25rem 0 0' }}>Please save as draft to upload attachments.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden mt-4 shadow-sm"
      style={{
        display: 'block',
        width: '100%',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        marginTop: '1rem',
        marginBottom: '1rem',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div 
        className={`px-4 py-3.5 border-b border-slate-50 flex ${compact ? 'flex-col gap-2.5 items-stretch' : 'items-center justify-between'} bg-slate-50/20`}
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          justifyContent: compact ? 'stretch' : 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: 'rgba(248, 250, 252, 0.5)'
        }}
      >
        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: themeColor }} />
          <div 
            className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
            style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Paperclip size={14} style={{ color: themeColor }} />
            Attachments ({attachments.length})
          </div>
        </div>

        <label className="cursor-pointer" style={{ cursor: 'pointer', margin: 0 }}>
          <input
            type="file"
            multiple
            className="hidden"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
          <span
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border text-white hover:opacity-95 ${compact ? 'w-full text-center' : ''}`}
            style={{ 
              backgroundColor: themeColor, 
              borderColor: themeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#ffffff',
              border: '1px solid transparent',
              cursor: 'pointer',
              width: compact ? '100%' : 'auto'
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={12} />
                Attach Files
              </>
            )}
          </span>
        </label>
      </div>

      {/* Content */}
      <div className="p-4" style={{ padding: '1rem' }}>
        {loading && attachments.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2" style={{ padding: '2rem 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: themeColor }} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Syncing Attachments...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div 
            className="text-center py-8 bg-slate-50/40 rounded-xl border border-dashed border-slate-200"
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              background: 'rgba(248, 250, 252, 0.4)',
              borderRadius: '0.75rem',
              border: '1px dashed #cbd5e1'
            }}
          >
            <Paperclip size={28} className="mx-auto text-slate-300 mb-2" style={{ margin: '0 auto 0.5rem', color: '#cbd5e1' }} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>No attachments uploaded yet</p>
            <p className="text-[9px] text-slate-400 mt-1" style={{ fontSize: '9px', color: '#94a3b8', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>Upload receipts, delivery logs, or documentation.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '15rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {attachments.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(248, 250, 252, 0.5)',
                  borderRadius: '0.75rem',
                  border: '1px solid #f1f5f9'
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0" style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1" style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <p className="text-xs font-bold text-slate-700 truncate" title={file.file_name} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5" style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.125rem 0 0' }}>
                      {formatBytes(file.file_size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    style={{ padding: '0.375rem', color: '#94a3b8', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Download Attachment"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    style={{ padding: '0.375rem', color: '#94a3b8', borderRadius: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Attachment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
