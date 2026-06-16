// src/Components/Admin/AttachmentSection.jsx
import React, { useState, useEffect } from 'react';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Paperclip, Trash2, Download, Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function AttachmentSection({ doctype, docname }) {
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

  if (!docname) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mt-4 shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip size={14} style={{ color: themeColor }} />
            Attachments ({attachments.length})
          </h3>
        </div>

        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <span
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border text-white hover:opacity-95"
            style={{ backgroundColor: themeColor, borderColor: themeColor }}
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
      <div className="p-4">
        {loading && attachments.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin" style={{ color: themeColor }} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Syncing Attachments...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
            <Paperclip size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No attachments uploaded yet</p>
            <p className="text-[9px] text-slate-400 mt-1">Upload receipts, delivery logs, or documentation.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {attachments.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      {formatBytes(file.file_size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Download Attachment"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
