// src/Components/Admin/AttachmentSection.jsx
import React, { useState, useEffect } from 'react';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Paperclip, Trash2, Download, UploadCloud, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function AttachmentSection({ doctype, docname, compact = false, themeColor: customThemeColor, themeLight: customThemeLight, isDarkRedTheme = false }) {
  const { themeColor: defaultThemeColor } = useLegacyTheme();
  const themeColor = customThemeColor || defaultThemeColor;
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const fetchAttachments = async () => {
    if (!docname) return;
    try {
      setLoading(true);
      let res;
      try {
        res = await axios.get(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_attachments`, {
          params: { doctype, name: docname }
        });
      } catch (err1) {
        res = await axios.get(`/api/method/frappe.desk.form.load.get_attachments`, {
          params: { doctype, name: docname }
        });
      }

      const raw = res.data.message?.data || res.data.message || res.data.data || [];
      const list = Array.isArray(raw) ? raw : (raw.success && Array.isArray(raw.data) ? raw.data : []);
      setAttachments(list);
    } catch (err) {
      console.error("Failed to load attachments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [doctype, docname]);

  const processUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    if (!docname) {
      Swal.fire('Unsaved Document', 'Please save document first before attaching files.', 'warning');
      return;
    }

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
    }
  };

  const handleUpload = (e) => {
    const files = Array.from(e.target.files);
    processUploadFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      processUploadFiles(files);
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

  return (
    <div 
      style={{
        backgroundColor: isDarkRedTheme ? '#751010' : '#ffffff',
        border: `1px solid ${isDarkRedTheme ? 'rgba(255, 255, 255, 0.3)' : '#e2e8f0'}`,
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        width: '100%',
        marginBottom: '16px'
      }}
    >
      {/* Sleek Top Bar (Matching reference image) */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* Left: Paperclip + Title + Count Pill Badge + Collapse Arrow */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Paperclip size={18} style={{ color: isDarkRedTheme ? '#ffffff' : '#64748b' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: isDarkRedTheme ? '#ffffff' : '#0f172a' }}>
            Attachments
          </span>
          <span 
            style={{
              backgroundColor: isDarkRedTheme ? 'rgba(255, 255, 255, 0.2)' : '#e8f2ff',
              color: isDarkRedTheme ? '#ffffff' : '#0082f6',
              fontSize: '12px',
              fontWeight: 800,
              padding: '2px 9px',
              borderRadius: '9999px',
              minWidth: '20px',
              textAlign: 'center'
            }}
          >
            {attachments.length}
          </span>
          {isExpanded ? (
            <ChevronUp size={16} style={{ color: isDarkRedTheme ? '#ffffff' : '#94a3b8' }} />
          ) : (
            <ChevronDown size={16} style={{ color: isDarkRedTheme ? '#ffffff' : '#94a3b8' }} />
          )}
        </div>

        {/* Right: Dashed Drop Zone */}
        <label
          onClick={(e) => {
            if (!docname) {
              e.preventDefault();
              Swal.fire({
                icon: 'warning',
                title: 'Unsaved Document',
                text: 'Please save the record first before uploading attachments.',
                confirmButtonColor: '#0082f6'
              });
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: '1 1 300px',
            maxWidth: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 20px',
            border: `1.5px dashed ${isDragging ? themeColor : '#cbd5e1'}`,
            borderRadius: '12px',
            backgroundColor: isDragging ? '#eff6ff' : isDarkRedTheme ? 'rgba(255,255,255,0.08)' : '#f8fafc',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <input
            type="file"
            multiple
            className="hidden"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading || !docname}
          />
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ color: themeColor }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Uploading file(s)...</span>
            </>
          ) : (
            <>
              <UploadCloud size={18} style={{ color: themeColor }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkRedTheme ? '#ffffff' : '#64748b' }}>
                Drop zone
              </span>
            </>
          )}
        </label>
      </div>

      {/* Expanded Attachments List Body */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${isDarkRedTheme ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}`, padding: '16px 20px' }}>
          {loading && attachments.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: themeColor }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Syncing attachments...</span>
            </div>
          ) : attachments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
              No attachments uploaded yet. Drag files into the drop zone above to attach.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {attachments.map((file) => (
                <div
                  key={file.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: isDarkRedTheme ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                    borderRadius: '12px',
                    border: `1px solid ${isDarkRedTheme ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center' }}>
                      <FileText size={14} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: isDarkRedTheme ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.file_name}>
                        {file.file_name}
                      </p>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>
                        {formatBytes(file.file_size)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={{ padding: '6px', color: '#64748b', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => handleDelete(file.name)}
                      style={{ padding: '6px', color: '#ef4444', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
