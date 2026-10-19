import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Wallet,
  Send,
  Upload,
  Trash2,
  Eye,
  Image as ImageIcon,
  Copy,
  CheckCircle2,
  CreditCard,
  Building2,
  Smartphone,
  QrCode,
} from 'lucide-react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import { useAuth } from '../context/AuthContext';
import { get, postForm, formatCurrency, formatDate, getErrorMessage, getMediaUrl } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';
import { buildWhatsAppUrl, buildTopupWhatsAppMessage } from '../utils/whatsapp';
import { compressImage, formatBytes, MAX_TOPUP_PROOF_SIZE } from '../utils/compressor';

const statusLabels = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const TOPUP_PRESETS = [
  { value: 50000, label: '50rb' },
  { value: 100000, label: '100rb' },
  { value: 250000, label: '250rb' },
  { value: 500000, label: '500rb' },
];

const TopupRequest = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Payment accounts state (BRI, BSI, DANA, GOPAY, OVO, etc.)
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // State Bukti Transfer (Opsional) & Compressor.js
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [proofMeta, setProofMeta] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);

  // State Modal Preview Gambar
  const [previewModalUrl, setPreviewModalUrl] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.TOPUP_REQUESTS.LIST, {
        page: pagination.page,
        limit: pagination.limit,
      });
      setRequests(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await get(API_ENDPOINTS.PAYMENT_ACCOUNTS.LIST);
      const list = res.data || [];
      setPaymentAccounts(list);
      if (list.length > 0) {
        setSelectedAccount((prev) => prev || list[0]);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar rekening pembayaran:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    get(API_ENDPOINTS.SETTINGS.CONTACT).then((res) => setContact(res.data)).catch(() => { });
    fetchPaymentAccounts();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, pagination.limit]);

  const copyToClipboard = (text, label = 'Nomor rekening') => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} berhasil disalin!`);
    }
  };

  // Handle pilih & kompres gambar bukti transfer
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Mohon pilih file gambar (JPG, PNG, atau WEBP)');
      e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar, maksimal 20MB');
      e.target.value = '';
      return;
    }

    setCompressing(true);
    try {
      const result = await compressImage(file, { maxSizeBytes: MAX_TOPUP_PROOF_SIZE });
      setProofFile(result.file);
      setProofPreview(result.previewUrl);
      setProofMeta({
        name: file.name,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        savedPercent: result.savedPercent,
      });
      toast.success(`Gambar berhasil dikompres ke ${formatBytes(result.compressedSize)}`);
    } catch (err) {
      console.error('Kompres gambar gagal:', err);
      toast.error(err?.message || 'Gagal mengompres gambar');
      e.target.value = '';
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveProof = () => {
    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
    }
    setProofFile(null);
    setProofPreview(null);
    setProofMeta(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 10000) {
      toast.error('Minimum request topup Rp 10.000');
      return;
    }

    if (compressing) {
      toast.error('Mohon tunggu proses kompresi gambar selesai');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', amt);
      if (note?.trim()) {
        formData.append('note', note.trim());
      }
      if (selectedAccount) {
        formData.append('bank_name', selectedAccount.bank_name);
        formData.append('account_number', selectedAccount.account_number);
        formData.append('account_name', selectedAccount.account_name);
      }
      if (proofFile) {
        formData.append('proof', proofFile);
      }

      await postForm(API_ENDPOINTS.TOPUP_REQUESTS.LIST, formData);
      toast.success('Request topup berhasil dikirim');
      setAmount('');
      setNote('');
      handleRemoveProof();
      fetchRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = (requestAmount, targetAccount = selectedAccount) => {
    if (!contact?.admin_whatsapp) {
      toast.error('Nomor WhatsApp admin belum diatur');
      return;
    }
    const url = buildWhatsAppUrl(
      contact.admin_whatsapp,
      buildTopupWhatsAppMessage(user, requestAmount || amount, targetAccount)
    );
    if (url) window.open(url, '_blank');
  };


  const hasPending = requests.some((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="Request Topup Saldo" subtitle={`Dzaqilah Cell • Saldo: ${formatCurrency(user?.balance)}`} />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-4">
        <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Ajukan Topup</h3>
              <p className="text-xs text-gray-500">Pilih rekening tujuan & admin akan memproses topup Anda</p>
            </div>
          </div>

          {/* Opsi Rekening Tujuan Transfer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-teal-600" />
                Pilih Rekening Tujuan Transfer <span className="text-rose-500">*</span>
              </label>
              {paymentAccounts.length > 0 && (
                <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {paymentAccounts.length} Rekening Aktif
                </span>
              )}
            </div>

            {loadingAccounts ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <LoadingSpinner size="sm" />
                <span>Memuat rekening pembayaran...</span>
              </div>
            ) : paymentAccounts.length === 0 ? (
              <div className="p-3.5 bg-gray-50 border rounded-xl text-center text-xs text-gray-500">
                Belum ada rekening pembayaran aktif dari admin.
              </div>
            ) : (
              <div className="space-y-2">
                {paymentAccounts.map((acc) => {
                  const isSelected = selectedAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => !hasPending && setSelectedAccount(acc)}
                      className={`relative p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/60 shadow-xs ring-2 ring-teal-500/20'
                          : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50/50'
                      } ${hasPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSelected
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {acc.type === 'qris' ? (
                              <QrCode className="w-4 h-4" />
                            ) : acc.type === 'ewallet' ? (
                              <Smartphone className="w-4 h-4" />
                            ) : (
                              <Building2 className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-gray-900">
                                {acc.bank_name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-gray-100 text-gray-600 uppercase">
                                {acc.type === 'bank' ? 'Bank' : acc.type === 'ewallet' ? 'E-Wallet' : 'QRIS'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              a.n <strong className="text-gray-800">{acc.account_name}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                        </div>
                      </div>

                      {/* Nomor Rekening & Tombol Salin */}
                      <div className="mt-2 pt-2 border-t border-gray-100/90 flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-150">
                        <span className="font-mono font-bold text-sm text-gray-900 tracking-wider">
                          {acc.account_number}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(acc.account_number, `Nomor ${acc.bank_name}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold active:scale-95 transition border border-teal-200"
                        >
                          <Copy className="w-3 h-3" />
                          Salin
                        </button>
                      </div>

                      {/* Instructions / Image preview */}
                      {(acc.instructions || acc.image_url) && (
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                          {acc.instructions ? (
                            <span className="italic truncate pr-2 text-gray-600">"{acc.instructions}"</span>
                          ) : <span />}
                          {acc.image_url && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewModalUrl(getMediaUrl(acc.image_url));
                              }}
                              className="text-teal-700 font-semibold hover:underline flex items-center gap-1 flex-shrink-0"
                            >
                              <QrCode className="w-3 h-3" />
                              Lihat QRIS / Gambar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              min="10000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min. 10000"
              disabled={hasPending}
              className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
            />

            <div className="flex gap-2 mt-2 flex-wrap">
              {TOPUP_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={hasPending}
                  onClick={() => setAmount(String(value))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50 ${parseFloat(amount) === value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Metode transfer, nama bank pengirim, dll."
              disabled={hasPending}
              className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
            />
          </div>

          {/* Upload Bukti Transfer (Opsional) dengan Kompresor JS Max 400KB */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Bukti Transfer <span className="text-xs font-normal text-gray-500">(opsional)</span>
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              disabled={hasPending || compressing}
              onChange={handleFileChange}
              className="hidden"
              id="topup-proof-input"
            />

            {compressing ? (
              <div className="border border-dashed border-primary-300 bg-primary-50/60 rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-primary-700">
                <LoadingSpinner size="sm" />
                <span className="text-xs font-medium">Mengompres gambar dengan Compressor.js...</span>
              </div>
            ) : proofPreview ? (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/80">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setPreviewModalUrl(proofPreview)}
                    className="relative group cursor-pointer w-14 h-14 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-white"
                  >
                    <img
                      src={proofPreview}
                      alt="Preview bukti transfer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {proofMeta?.name || 'bukti-transfer.jpg'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700 rounded-md font-semibold">
                        {formatBytes(proofMeta?.compressedSize)}
                      </span>
                      {proofMeta?.savedPercent > 0 && (
                        <span className="text-[11px] text-gray-500">
                          Hemat {proofMeta.savedPercent}% (dari {formatBytes(proofMeta?.originalSize)})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewModalUrl(proofPreview)}
                      className="text-[11px] text-primary-600 hover:underline mt-1 font-medium inline-block"
                    >
                      Lihat Foto Penuh
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveProof}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors flex-shrink-0"
                    title="Hapus bukti"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="topup-proof-input"
                className={`border-2 border-dashed border-gray-200 hover:border-primary-400 bg-gray-50 hover:bg-primary-50/20 rounded-xl p-3.5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${hasPending ? 'opacity-50 pointer-events-none' : ''
                  }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-gray-700">Unggah foto bukti transfer</p>
                <p className="text-xs text-gray-400">JPG, PNG, atau WEBP</p>
              </label>
            )}
          </div>

          {hasPending && (
            <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
              Anda masih punya request yang menunggu persetujuan admin.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || hasPending || compressing}
            className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
          >
            {submitting ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Kirim Request
              </>
            )}
          </button>

          {contact?.admin_whatsapp && (
            <button
              type="button"
              onClick={() => openWhatsApp()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Chat Admin via WhatsApp
            </button>
          )}
        </form>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Riwayat Request</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState title="Belum ada request topup" />
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="bg-white border rounded-xl p-4 shadow-xs">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-primary-600">{formatCurrency(req.amount)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                      {statusLabels[req.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>

                  {req.bank_name && (
                    <div className="mt-2 p-2 bg-blue-50/70 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Tujuan:</span>
                      <span className="font-bold text-blue-900">
                        {req.bank_name} • {req.account_number} ({req.account_name})
                      </span>
                    </div>
                  )}

                  {req.note && <p className="text-xs text-gray-500 mt-1">Catatan: {req.note}</p>}
                  {req.admin_note && <p className="text-xs text-gray-500 mt-1">Admin: {req.admin_note}</p>}

                  {/* Bukti Transfer thumbnail / link */}
                  {req.proof_image && (
                    <div className="mt-2.5 pt-2 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> Bukti Terlampir
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewModalUrl(getMediaUrl(req.proof_image))}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline bg-primary-50 px-2 py-1 rounded-lg"
                      >
                        <Eye className="w-3 h-3" /> Lihat Bukti
                      </button>
                    </div>
                  )}

                  {req.status === 'pending' && contact?.admin_whatsapp && (
                    <button
                      onClick={() =>
                        openWhatsApp(req.amount, {
                          bank_name: req.bank_name,
                          account_number: req.account_number,
                          account_name: req.account_name,
                        })
                      }
                      className="mt-2.5 text-xs text-green-600 font-medium flex items-center gap-1.5 hover:text-green-700"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" /> Hubungi Admin
                    </button>
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
      </div>

      {/* Modal Preview Gambar Bukti Transfer */}
      <Modal
        isOpen={Boolean(previewModalUrl)}
        onClose={() => setPreviewModalUrl(null)}
        title="Bukti Transfer"
      >
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center max-h-[65vh] border">
            {previewModalUrl && (
              <img
                src={previewModalUrl}
                alt="Bukti Transfer"
                className="w-full h-auto max-h-[65vh] object-contain"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <a
              href={previewModalUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              Buka Tab Baru
            </a>
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
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

export default TopupRequest;
