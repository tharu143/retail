// src/Components/Admin/AttachmentSection.jsx
import React, { useState, useEffect } from 'react';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Paperclip, Trash2, Download, Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function AttachmentSection({ doctype, docname, compact = false, themeColor: customThemeColor, themeLight: customThemeLight, isDarkRedTheme = false }) {
  const { themeColor: defaultThemeColor, themeLight: defaultThemeLight } = useLegacyTheme();
  const themeColor = customThemeColor || defaultThemeColor;
  const themeLight = customThemeLight || defaultThemeLight;
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

  const bgContainer = isDarkRedTheme ? '#751010' : '#ffffff';
  const borderColor = isDarkRedTheme ? 'rgba(255, 255, 255, 0.3)' : '#e2e8f0';
  const textColor = isDarkRedTheme ? '#ffffff' : '#334155';
  const subTextColor = isDarkRedTheme ? 'rgba(255, 255, 255, 0.8)' : '#94a3b8';
  const dashedBg = isDarkRedTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(248, 250, 252, 0.4)';
  const itemBg = isDarkRedTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(248, 250, 252, 0.5)';
  const headerBg = isDarkRedTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(248, 250, 252, 0.5)';

  if (!docname) {
    if (compact) {
      return (
        <div 
          className="rounded-lg flex items-center justify-between px-3 opacity-60"
          style={{
            height: '42px',
            width: '100%',
            background: bgContainer,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Paperclip size={12} style={{ color: isDarkRedTheme ? '#ffffff' : themeColor }} />
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attachments (0)
            </span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Unsaved Document
          </span>
        </div>
      );
    }

    return (
      <div 
        className="rounded-xl overflow-hidden mt-2 shadow-sm opacity-70"
        style={{
          display: 'block',
          width: '100%',
          background: bgContainer,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
          opacity: 0.7,
          flexShrink: 0
        }}
      >
        <div 
          className={`px-3 py-2 flex ${compact ? 'flex-col gap-2 items-stretch' : 'items-center justify-between'}`}
          style={{
            display: 'flex',
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'stretch' : 'center',
            justifyContent: compact ? 'stretch' : 'space-between',
            padding: '0.5rem 0.75rem',
            borderBottom: `1px solid ${borderColor}`,
            background: headerBg
          }}
        >
          <div className="flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div className="w-1 h-1 rounded-full" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isDarkRedTheme ? '#ffffff' : themeColor }} />
            <div 
              className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              style={{ fontSize: '10px', fontWeight: 'bold', color: textColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Paperclip size={11} style={{ color: isDarkRedTheme ? '#ffffff' : themeColor }} />
              Attachments (0)
            </div>
          </div>
        </div>
        <div className="p-3 text-center py-4" style={{ padding: '1rem', textAlign: 'center' }}>
          <Paperclip size={18} className="mx-auto mb-1" style={{ margin: '0 auto 0.25rem', color: subTextColor }} />
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ fontSize: '9px', fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Unsaved Document</p>
          <p className="text-[8px] mt-0.5 font-semibold" style={{ fontSize: '8px', color: subTextColor, marginTop: '0.125rem', fontWeight: '600', margin: '0.125rem 0 0' }}>Please save as draft to upload attachments.</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div 
          className="rounded-lg flex items-center justify-between px-3"
          style={{
            height: '42px',
            width: '100%',
            background: bgContainer,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Paperclip size={12} style={{ color: isDarkRedTheme ? '#ffffff' : themeColor }} />
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attachments ({attachments.length})
            </span>
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
              className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all duration-200 text-white hover:opacity-95"
              style={{ 
                backgroundColor: isDarkRedTheme ? '#ffffff' : themeColor, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '9px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: isDarkRedTheme ? '#751010' : '#ffffff',
                cursor: 'pointer'
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={10} />
                  Attach
                </>
              )}
            </span>
          </label>
        </div>

        {/* Attachments List below header */}
        {attachments.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '8rem', overflowY: 'auto', paddingRight: '0.125rem' }}>
            {attachments.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-2 rounded-lg transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.375rem 0.5rem',
                  background: itemBg,
                  borderRadius: '0.5rem',
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <div className="p-1 rounded shrink-0" style={{ padding: '0.25rem', borderRadius: '0.25rem', background: isDarkRedTheme ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={12} />
                  </div>
                  <div className="min-w-0 flex-1" style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <p className="text-[10px] font-bold truncate" title={file.file_name} style={{ fontSize: '0.7rem', fontWeight: 'bold', color: textColor, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </p>
                    <p className="text-[8px] font-semibold uppercase tracking-wider mt-0.5" style={{ fontSize: '8px', color: subTextColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.0625rem 0 0' }}>
                       {formatBytes(file.file_size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem' }}>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-1 rounded transition-colors"
                    style={{ padding: '0.25rem', color: textColor, borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Download Attachment"
                  >
                    <Download size={12} />
                  </a>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className="p-1 rounded transition-colors"
                    style={{ padding: '0.25rem', color: textColor, borderRadius: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Attachment"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden mt-2 shadow-sm"
      style={{
        display: 'block',
        width: '100%',
        background: bgContainer,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div 
        className={`px-3 py-2 flex ${compact ? 'flex-col gap-2 items-stretch' : 'items-center justify-between'}`}
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          justifyContent: compact ? 'stretch' : 'space-between',
          padding: '0.5rem 0.75rem',
          borderBottom: `1px solid ${borderColor}`,
          background: headerBg
        }}
      >
        <div className="flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div className="w-1 h-1 rounded-full" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isDarkRedTheme ? '#ffffff' : themeColor }} />
          <div 
            className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
            style={{ fontSize: '10px', fontWeight: 'bold', color: textColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Paperclip size={11} style={{ color: isDarkRedTheme ? '#ffffff' : themeColor }} />
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
            className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all duration-200 border text-white hover:opacity-95 ${compact ? 'w-full text-center' : ''}`}
            style={{ 
              backgroundColor: isDarkRedTheme ? '#ffffff' : themeColor, 
              borderColor: isDarkRedTheme ? '#ffffff' : themeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '9px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDarkRedTheme ? '#751010' : '#ffffff',
              border: '1px solid transparent',
              cursor: 'pointer',
              width: compact ? '100%' : 'auto'
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={10} />
                Attach Files
              </>
            )}
          </span>
        </label>
      </div>

      {/* Content */}
      <div className="p-3" style={{ padding: '0.75rem' }}>
        {loading && attachments.length === 0 ? (
          <div className="py-4 text-center flex flex-col items-center justify-center gap-1.5" style={{ padding: '1rem 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifycontent: 'center', gap: '0.375rem' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: isDarkRedTheme ? '#ffffff' : themeColor }} />
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ fontSize: '9px', fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Syncing...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div 
            className="text-center py-4 rounded-lg"
            style={{
              textAlign: 'center',
              padding: '1rem 0.5rem',
              background: dashedBg,
              borderRadius: '0.5rem',
              border: `1px dashed ${borderColor}`
            }}
          >
            <Paperclip size={18} className="mx-auto mb-1" style={{ margin: '0 auto 0.25rem', color: subTextColor }} />
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ fontSize: '9px', fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>No attachments yet</p>
            <p className="text-[8px] mt-0.5" style={{ fontSize: '8px', color: subTextColor, marginTop: '0.125rem', margin: '0.125rem 0 0' }}>Upload receipts or documentation.</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '8rem', overflowY: 'auto', paddingRight: '0.125rem' }}>
            {attachments.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-2 rounded-lg transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.375rem 0.5rem',
                  background: itemBg,
                  borderRadius: '0.5rem',
                  border: `1px solid ${borderColor}`
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <div className="p-1 rounded shrink-0" style={{ padding: '0.25rem', borderRadius: '0.25rem', background: isDarkRedTheme ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: textColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={12} />
                  </div>
                  <div className="min-w-0 flex-1" style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <p className="text-[10px] font-bold truncate" title={file.file_name} style={{ fontSize: '0.7rem', fontWeight: 'bold', color: textColor, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </p>
                    <p className="text-[8px] font-semibold uppercase tracking-wider mt-0.5" style={{ fontSize: '8px', color: subTextColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.0625rem 0 0' }}>
                      {formatBytes(file.file_size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem' }}>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-1 rounded transition-colors"
                    style={{ padding: '0.25rem', color: textColor, borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Download Attachment"
                  >
                    <Download size={12} />
                  </a>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className="p-1 rounded transition-colors"
                    style={{ padding: '0.25rem', color: textColor, borderRadius: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Attachment"
                  >
                    <Trash2 size={12} />
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
