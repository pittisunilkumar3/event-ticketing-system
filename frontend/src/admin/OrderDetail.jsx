import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Spinner, Alert } from '../components/ui';
import OrderBookingDetails from './OrderBookingDetails';

export default function OrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');
  const [actionLoading, setActionLoading] = useState('');

  const load = () =>
    api
      .get(`/admin/orders/${id}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load order'));

  useEffect(() => {
    load();
  }, [id]);

  async function handleAction(action) {
    const labels = { cancel: 'Cancel this order', refund: 'Mark as refunded' };
    if (!confirm(data?.payment?'Request a full refund through Razorpay? Tickets and wallet credit change after the refund is confirmed.':`${labels[action]}? Tickets will be invalidated and inventory released.`)) return;
    setActionLoading(action);
    try {
      const response=await api.patch(`/admin/orders/${id}/${action}`);
      setNotice(response.data.message);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  }

  async function downloadAnswer(answer,attendeeId){try{const r=await api.get(`/admin/orders/${id}/`+(attendeeId?`attendees/${attendeeId}/files/${answer.id}`:`registration-files/${answer.id}`),{responseType:'blob'});const url=URL.createObjectURL(r.data);const link=document.createElement('a');link.href=url;link.download=answer.value.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{alert('Unable to download this attachment.');}}
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  return <OrderBookingDetails data={data} notice={notice} actionLoading={actionLoading} onAction={handleAction} onDownload={downloadAnswer}/>;
}
