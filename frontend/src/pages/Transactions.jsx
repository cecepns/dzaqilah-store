import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Receipt, Copy } from 'lucide-react';
import Header from '../components/layout/Header';
import SearchInput from '../components/ui/SearchInput';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import ReceiptModal from '../components/receipt/ReceiptModal';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { get, post, formatCurrency, formatDate, getErrorMessage } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';
import { getReceiptStoreName } from '../utils/receipt';

const statusColors = {
  success: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

const statusLabels = { success: 'Sukses', pending: 'Pending', failed: 'Gagal' };

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [checkingId, setCheckingId] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);

  const debouncedSearch = useDebounce(search);
  const partnerName = getReceiptStoreName(user?.partner_name);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.TRANSACTIONS.LIST, {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status,
      });
      setTransactions(res.data);
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

  const handleCheckStatus = async (tx) => {
    setCheckingId(tx.id);
    try {
      const res = await post(API_ENDPOINTS.TRANSACTIONS.CHECK_STATUS(tx.id));
      toast.success(res.message || 'Status diperbarui');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCheckingId(null);
    }
  };

  const handleCopySn = (sn) => {
    if (!sn) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sn);
      toast.success('SN berhasil disalin ke clipboard');
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = sn;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('SN berhasil disalin ke clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="Riwayat Transaksi" subtitle={partnerName} />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nomor/ref..." />

        <div className="flex gap-2">
          {['', 'success', 'pending', 'failed'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setStatus(s); setPagination((p) => ({ ...p, page: 1 })); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                status === s ? 'bg-teal-600 text-white shadow-xs font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? statusLabels[s] : 'Semua'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : transactions.length === 0 ? (
          <EmptyState title="Belum ada transaksi" />
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white border rounded-xl p-4 overflow-hidden shadow-xs hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm break-words">{tx.product_name}</p>
                      {tx.transaction_type === 'kmsp' && (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded-md">
                          DZ STORE
                        </span>
                      )}
                      {tx.transaction_type === 'pasca' && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                          Pascabayar
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{tx.customer_no}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 whitespace-nowrap ${statusColors[tx.status]}`}>
                    {statusLabels[tx.status]}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-teal-600 whitespace-nowrap">{formatCurrency(tx.selling_price)}</span>
                  <span className="text-gray-400 text-xs shrink-0 whitespace-nowrap">{formatDate(tx.created_at)}</span>
                </div>

                {tx.sn && (
                  <div className="mt-2.5 p-2.5 bg-gray-50/90 border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        SN / Token
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySn(tx.sn)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors shadow-2xs shrink-0 active:scale-95"
                        title="Salin SN / Token"
                      >
                        <Copy className="w-3 h-3" />
                        Salin
                      </button>
                    </div>
                    <p className="font-mono text-xs text-gray-800 break-all select-all leading-relaxed bg-white/90 p-2 rounded-lg border border-gray-200/60">
                      {tx.sn}
                    </p>
                  </div>
                )}

                {tx.message && tx.status !== 'success' && (
                  <p className="text-xs text-amber-700 bg-amber-50/90 border border-amber-200 rounded-lg p-2 mt-2 break-words break-all">
                    {tx.message}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-400 font-mono truncate" title={tx.ref_id}>
                      Ref: {tx.ref_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {tx.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCheckStatus(tx)}
                        disabled={checkingId === tx.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${checkingId === tx.id ? 'animate-spin' : ''}`} />
                        {checkingId === tx.id ? 'Mengecek...' : 'Cek Status'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedTx(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
                    >
                      <Receipt className="w-3 h-3" />
                      Struk
                    </button>
                  </div>
                </div>
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

      <ReceiptModal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
        partnerName={user?.partner_name}
      />
    </div>
  );
};

export default Transactions;
