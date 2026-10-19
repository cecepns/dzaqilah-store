import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  Smartphone,
  Building2,
  Copy,
  Upload,
  X,
  ExternalLink,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import SearchInput from '../../components/ui/SearchInput';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { get, post, put, del, getErrorMessage } from '../../utils/request';
import { API_ENDPOINTS, API_BASE_URL } from '../../utils/endpoints';

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return url;
};

const BANK_PRESETS = [
  { name: 'BRI', type: 'bank' },
  { name: 'BSI', type: 'bank' },
  { name: 'BCA', type: 'bank' },
  { name: 'Mandiri', type: 'bank' },
  { name: 'BNI', type: 'bank' },
  { name: 'DANA', type: 'ewallet' },
  { name: 'GOPAY', type: 'ewallet' },
  { name: 'OVO', type: 'ewallet' },
  { name: 'ShopeePay', type: 'ewallet' },
  { name: 'LinkAja', type: 'ewallet' },
  { name: 'QRIS', type: 'qris' },
];

const PaymentAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_name: 'ABDUL RAHMAN',
    type: 'bank',
    instructions: '',
    sort_order: 0,
    is_active: true,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // Delete modal
  const [deleteModalAccount, setDeleteModalAccount] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounced search
  const debouncedSearch = useDebounce(search, 350);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.PAYMENT_ACCOUNTS.ADMIN_LIST, {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setAccounts(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [debouncedSearch, typeFilter, statusFilter, pagination.page, pagination.limit]);

  const openCreate = () => {
    setEditingAccount(null);
    setFormData({
      bank_name: '',
      account_number: '',
      account_name: 'ABDUL RAHMAN',
      type: 'bank',
      instructions: '',
      sort_order: accounts.length + 1,
      is_active: true,
    });
    setSelectedFile(null);
    setPreviewUrl('');
    setModalOpen(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      account_name: account.account_name || '',
      type: account.type || 'bank',
      instructions: account.instructions || '',
      sort_order: account.sort_order ?? 0,
      is_active: Boolean(account.is_active),
    });
    setSelectedFile(null);
    setPreviewUrl(account.image_url ? resolveImageUrl(account.image_url) : '');
    setModalOpen(true);
  };

  const handlePresetSelect = (preset) => {
    setFormData((prev) => ({
      ...prev,
      bank_name: preset.name,
      type: preset.type,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 2 MB');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.bank_name?.trim()) {
      toast.error('Nama Bank / E-Wallet wajib diisi');
      return;
    }
    if (!formData.account_number?.trim()) {
      toast.error('Nomor Rekening / No. HP wajib diisi');
      return;
    }
    if (!formData.account_name?.trim()) {
      toast.error('Nama Pemilik Rekening wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const data = new FormData();
      data.append('bank_name', formData.bank_name.trim());
      data.append('account_number', formData.account_number.trim());
      data.append('account_name', formData.account_name.trim());
      data.append('type', formData.type);
      data.append('instructions', formData.instructions || '');
      data.append('sort_order', Number(formData.sort_order) || 0);
      data.append('is_active', formData.is_active ? '1' : '0');

      if (selectedFile) {
        data.append('image', selectedFile);
      }

      if (editingAccount) {
        await put(API_ENDPOINTS.PAYMENT_ACCOUNTS.UPDATE(editingAccount.id), data);
        toast.success('Rekening berhasil diperbarui');
      } else {
        await post(API_ENDPOINTS.PAYMENT_ACCOUNTS.CREATE, data);
        toast.success('Rekening baru berhasil ditambahkan');
      }

      setModalOpen(false);
      fetchAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (account) => {
    try {
      const res = await put(API_ENDPOINTS.PAYMENT_ACCOUNTS.TOGGLE(account.id));
      toast.success(res.message || 'Status rekening diperbarui');
      setAccounts((prev) =>
        prev.map((item) =>
          item.id === account.id ? { ...item, is_active: item.is_active ? 0 : 1 } : item
        )
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteModalAccount) return;
    setDeleting(true);
    try {
      await del(API_ENDPOINTS.PAYMENT_ACCOUNTS.DELETE(deleteModalAccount.id));
      toast.success('Rekening berhasil dihapus');
      setDeleteModalAccount(null);
      fetchAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text, label) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} disalin`);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'ewallet':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Smartphone className="w-3 h-3" />
            E-Wallet
          </span>
        );
      case 'qris':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <QrCode className="w-3 h-3" />
            QRIS
          </span>
        );
      case 'bank':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Building2 className="w-3 h-3" />
            Bank Transfer
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16">
      <Header title="Kelola Rekening Topup" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    Rekening Pembayaran Topup
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Atur rekening bank, e-wallet, dan QRIS yang muncul sebagai opsi transfer user saat topup
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/admin/topup-requests"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition"
              >
                Lihat Request Topup
              </Link>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Tambah Rekening
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="sm:col-span-6">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari bank, nomor rekening, nama pemilik..."
              />
            </div>
            <div className="sm:col-span-3">
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Tipe</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="ewallet">E-Wallet</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Status</option>
                <option value="active">Aktif Saja</option>
                <option value="inactive">Nonaktif Saja</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Belum Ada Rekening"
            description="Tambahkan opsi rekening bank atau e-wallet agar user bisa memilih tujuan transfer saat topup saldo."
            action={
              <button
                onClick={openCreate}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                Tambah Rekening Sekarang
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const isActive = Boolean(acc.is_active);
                return (
                  <div
                    key={acc.id}
                    className={`relative bg-white dark:bg-slate-800 rounded-2xl p-4 border transition-all duration-200 shadow-sm flex flex-col justify-between ${
                      isActive
                        ? 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                        : 'border-slate-200/60 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-850'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                            {acc.bank_name ? acc.bank_name.slice(0, 3).toUpperCase() : 'BNK'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                {acc.bank_name}
                              </h3>
                              {getTypeBadge(acc.type)}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Urutan: #{acc.sort_order}
                            </span>
                          </div>
                        </div>

                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggle(acc)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                          title={isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              Nonaktif
                            </>
                          )}
                        </button>
                      </div>

                      {/* Number & Name */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700/60 mb-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Nomor Rekening / HP:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(acc.account_number, 'Nomor rekening')}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                          >
                            <Copy className="w-3 h-3" />
                            Salin
                          </button>
                        </div>
                        <div className="font-mono font-bold text-base text-slate-800 dark:text-slate-100 tracking-wider">
                          {acc.account_number}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                          A.n <span className="font-semibold">{acc.account_name}</span>
                        </div>
                      </div>

                      {/* Instructions / Image if exists */}
                      {acc.instructions && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3 line-clamp-2">
                          "{acc.instructions}"
                        </p>
                      )}

                      {acc.image_url && (
                        <div className="mb-3">
                          <a
                            href={resolveImageUrl(acc.image_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <QrCode className="w-3 h-3" />
                            Lihat QRIS / Gambar Lampiran
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(acc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModalAccount(acc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-6">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                limit={pagination.limit}
                total={pagination.total}
                onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
                onLimitChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal Create / Edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingAccount ? 'Edit Rekening Pembayaran' : 'Tambah Rekening Pembayaran'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick Preset Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pilih Cepat Bank / E-Wallet
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BANK_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    formData.bank_name.toUpperCase() === p.name.toUpperCase()
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Bank / Penyedia <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="Contoh: BRI, BSI, DANA, GOPAY, OVO"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type & Urutan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kategori / Tipe <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bank">Bank Transfer</option>
                <option value="ewallet">E-Wallet</option>
                <option value="qris">QRIS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urutan Tampil
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Nomor Rekening */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor Rekening / Nomor HP <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="Contoh: 022501013585534 atau 085299636873"
              required
              className="w-full font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider"
            />
          </div>

          {/* Nama Pemilik */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Atas Nama (Pemilik Rekening) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.account_name}
              onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              placeholder="Contoh: ABDUL RAHMAN"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>

          {/* Petunjuk / Catatan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Petunjuk Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Contoh: Sertakan berita nomor HP saat transfer"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Upload QRIS / Gambar Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Upload QRIS / Gambar (Opsional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative inline-block border rounded-xl overflow-hidden p-2 bg-slate-50 dark:bg-slate-900">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-36 max-w-full object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow"
                  title="Hapus gambar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer"
              >
                <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Klik untuk upload QRIS atau gambar logo (Maks 2MB)
                </span>
              </button>
            )}
          </div>

          {/* Status Aktif */}
          <div className="pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Aktifkan rekening ini (akan muncul di halaman topup user)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              {saving ? <LoadingSpinner size="sm" /> : null}
              {saving ? 'Menyimpan...' : editingAccount ? 'Simpan Perubahan' : 'Tambah Rekening'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteModalAccount)}
        onClose={() => !deleting && setDeleteModalAccount(null)}
        title="Hapus Rekening Pembayaran"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Apakah Anda yakin ingin menghapus rekening{' '}
            <strong className="text-slate-900 dark:text-white">
              {deleteModalAccount?.bank_name} ({deleteModalAccount?.account_number})
            </strong>{' '}
            a.n <strong className="text-slate-900 dark:text-white">{deleteModalAccount?.account_name}</strong>?
          </p>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            Peringatan: Rekening ini tidak akan muncul lagi di opsi transfer topup user.
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalAccount(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition flex items-center gap-1.5"
            >
              {deleting ? <LoadingSpinner size="sm" /> : null}
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentAccounts;
