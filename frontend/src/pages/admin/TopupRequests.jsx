import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Eye, Image as ImageIcon } from 'lucide-react';
import Header from '../../components/layout/Header';
import SearchInput from '../../components/ui/SearchInput';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { get, put, formatCurrency, formatDate, getErrorMessage, getMediaUrl } from '../../utils/request';
import { API_ENDPOINTS } from '../../utils/endpoints';

const statusLabels = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const TopupRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [modal, setModal] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState(null);

  const debouncedSearch = useDebounce(search);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.TOPUP_REQUESTS.LIST, {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status,
      });
      setRequests(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debouncedSearch, status, pagination.page, pagination.limit]);

  const handleAction = async () => {
    if (!modal) return;
    setProcessing(true);
    try {
      const endpoint = modal.action === 'approve'
        ? API_ENDPOINTS.TOPUP_REQUESTS.APPROVE(modal.request.id)
        : API_ENDPOINTS.TOPUP_REQUESTS.REJECT(modal.request.id);
      const res = await put(endpoint, { admin_note: adminNote });
      toast.success(res.message);
      setModal(null);
      setAdminNote('');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <Header title="Request Topup" subtitle="Kelola permintaan topup saldo user" />

      <div className="px-4 -mt-4 space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari user..." />

        <div className="flex gap-2 overflow-x-auto">
          {['pending', 'approved', 'rejected', ''].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setStatus(s); setPagination((p) => ({ ...p, page: 1 })); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                status === s ? 'bg-teal-600 text-white font-bold shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? statusLabels[s] : 'Semua'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState title="Tidak ada request" />
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{req.user_name}</p>
                    <p className="text-xs text-gray-500">{req.user_email} • {req.user_phone}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                    {statusLabels[req.status]}
                  </span>
                </div>
                <p className="text-lg font-bold text-teal-600">{formatCurrency(req.amount)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(req.created_at)}</p>
                {req.note && <p className="text-xs text-gray-500 mt-1">Catatan: {req.note}</p>}
                {req.admin_note && <p className="text-xs text-gray-500 mt-1">Respon: {req.admin_note}</p>}

                {req.proof_image && (
                  <div className="mt-2.5 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> Ada Bukti Transfer
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewProofUrl(getMediaUrl(req.proof_image))}
                      className="inline-flex items-center gap-1 text-xs text-teal-700 font-bold hover:underline bg-teal-50 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Bukti
                    </button>
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setModal({ action: 'approve', request: req })}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium"
                    >
                      <Check className="w-4 h-4" /> Setujui
                    </button>
                    <button
                      onClick={() => setModal({ action: 'reject', request: req })}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium"
                    >
                      <X className="w-4 h-4" /> Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Pagination
          pagination={pagination}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          onLimitChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
        />
      </div>

      <Modal
        isOpen={!!modal}
        onClose={() => { setModal(null); setAdminNote(''); }}
        title={modal?.action === 'approve' ? 'Setujui Request' : 'Tolak Request'}
      >
        {modal && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {modal.request.user_name} — <strong>{formatCurrency(modal.request.amount)}</strong>
            </p>

            {modal.request.proof_image && (
              <div className="border rounded-xl p-2.5 bg-gray-50 flex items-center gap-3">
                <img
                  src={getMediaUrl(modal.request.proof_image)}
                  alt="Bukti Transfer"
                  onClick={() => setPreviewProofUrl(getMediaUrl(modal.request.proof_image))}
                  className="w-14 h-14 object-cover rounded-lg border bg-white cursor-pointer hover:opacity-90"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">Bukti Transfer Pengirim</p>
                  <button
                    type="button"
                    onClick={() => setPreviewProofUrl(getMediaUrl(modal.request.proof_image))}
                    className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Lihat Ukuran Penuh
                  </button>
                </div>
              </div>
            )}

            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Catatan admin (opsional)"
              rows={3}
              className="w-full px-4 py-2.5 border rounded-xl resize-none bg-white text-gray-900"
            />
            <button
              onClick={handleAction}
              disabled={processing}
              className={`w-full py-3 rounded-xl font-medium text-white disabled:opacity-60 ${
                modal.action === 'approve' ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              {processing ? 'Memproses...' : modal.action === 'approve' ? 'Setujui & Tambah Saldo' : 'Tolak Request'}
            </button>
          </div>
        )}
      </Modal>

      {/* Modal Preview Bukti Transfer Admin */}
      <Modal
        isOpen={Boolean(previewProofUrl)}
        onClose={() => setPreviewProofUrl(null)}
        title="Bukti Transfer User"
      >
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center max-h-[65vh] border">
            {previewProofUrl && (
              <img
                src={previewProofUrl}
                alt="Bukti Transfer"
                className="w-full h-auto max-h-[65vh] object-contain"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <a
              href={previewProofUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              Buka Tab Baru
            </a>
            <button
              type="button"
              onClick={() => setPreviewProofUrl(null)}
              className="px-4 py-2 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TopupRequests;
