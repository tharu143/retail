import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../hooks/useLegacyTheme';
import CustomerFormModal from '../Components/Admin/CustomerFormModal';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

export default function CustomerEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new' || !id || window.location.pathname.endsWith('/new');
  const { themeColor } = useLegacyTheme();
  const { warehouse } = useSelector(state => state.user || {});

  const [loading, setLoading] = useState(!isNew);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (!isNew) {
      fetchCustomerData();
    }
  }, [id, isNew]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_customer_details_retail`, { params: { customer_id: id } });
      const data = res.data.message?.data;
      if (data) {
        const fullCustomer = {
          ...data.customer,
          addresses: data.addresses || [],
          contacts: data.contacts || []
        };
        setSelectedCustomer(fullCustomer);
      }
    } catch (err) {
      console.error('Failed to fetch customer details for edit', err);
      Swal.fire('Error', 'Failed to retrieve full customer details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <Loader2 size={36} className="animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <CustomerFormModal
      inline={true}
      isOpen={true}
      editingCustomer={selectedCustomer}
      userWarehouse={warehouse}
      onClose={() => navigate('/customerlist')}
      onSave={() => navigate('/customerlist')}
      themeColor={themeColor || '#0082f6'}
    />
  );
}
