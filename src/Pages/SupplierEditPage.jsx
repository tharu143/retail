import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../hooks/useLegacyTheme';
import SupplierFormModal from '../Components/Admin/SupplierFormModal';

export default function SupplierEditPage() {
   const { name } = useParams();
   const navigate = useNavigate();
   const warehouse = useSelector((state) => state.user.warehouse);
   const { themeColor } = useLegacyTheme();
   const isNew = name === 'new';

   const [supplier, setSupplier] = useState(null);
   const [loading, setLoading] = useState(!isNew);

   useEffect(() => {
      if (isNew) {
         setLoading(false);
         return;
      }
      const fetchSupplier = async () => {
         try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_supplier_detail', { 
               params: { supplier_name: name }, 
               withCredentials: true 
            });
            const data = res.data.message?.data || res.data.data;
            setSupplier(data);
         } catch (err) {
            console.error('Failed to load supplier details:', err);
         } finally {
            setLoading(false);
         }
      };
      fetchSupplier();
   }, [name, isNew]);

   if (loading) {
      return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfdfe] gap-6">
            <div className="relative">
               <div className="w-16 h-16 border-4 border-gray-100 rounded-full animate-spin" style={{ borderTopColor: themeColor }} />
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full animate-ping opacity-20" style={{ backgroundColor: themeColor }} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Loading Supplier Registry...</p>
         </div>
      );
   }

   return (
      <SupplierFormModal 
         isOpen={true} 
         inline={true} 
         editingSupplier={supplier}
         onClose={() => navigate('/supplierlist')}
         onSave={(savedSup) => {
            navigate('/supplierlist');
         }}
         userWarehouse={warehouse}
      />
   );
}
