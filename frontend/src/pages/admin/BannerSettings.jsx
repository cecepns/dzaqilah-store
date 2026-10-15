import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { get, post, put, del, getErrorMessage } from '../../utils/request';
import { API_ENDPOINTS, API_BASE_URL } from '../../utils/endpoints';
import { compressBannerImage } from '../../utils/imageCompressor';

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    // If backend base URL ends in /api, base is without /api
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return url;
};

const BannerSettings = () => {
  const [activeTab, setActiveTab] = useState('banners'); // 'banners' | 'announcement'

  // Banners state
  const [banners, setBanners] = useState([]);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deleteModalBanner, setDeleteModalBanner] = useState(null);

  // Form state for Banner
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    badge: '',
    action_url: '',
    show_text: true,
    is_active: true,
    sort_order: 0,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [compressedFile, setCompressedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const fetchBanners = async () => {
    setLoadingBanners(true);
    try {
      const res = await get(`${API_ENDPOINTS.BANNERS.LIST}?all=true`);
      setBanners(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingBanners(false);
    }
  };

  const fetchAnnouncement = async () => {
    setLoadingAnnouncement(true);
    try {
      const res = await get(API_ENDPOINTS.SETTINGS.ANNOUNCEMENT);
      if (res?.data) {
        setAnnouncementText(res.data.text || '');
        setAnnouncementActive(Boolean(res.data.is_active));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingAnnouncement(false);
    }
  };

  useEffect(() => {
    fetchBanners();
    fetchAnnouncement();
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      title: '',
      description: '',
      badge: '',
      action_url: '',
      show_text: true,
      is_active: true,
      sort_order: banners.length + 1,
    });
    setSelectedFile(null);
    setCompressedFile(null);
    setPreviewUrl('');
    setBannerModalOpen(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      badge: banner.badge || '',
      action_url: banner.action_url || '',
      show_text: Boolean(banner.show_text),
      is_active: Boolean(banner.is_active),
      sort_order: banner.sort_order ?? 0,
    });
    setSelectedFile(null);
    setCompressedFile(null);
    setPreviewUrl(resolveImageUrl(banner.image_url));
    setBannerModalOpen(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setCompressing(true);

    try {
      // Compress with compressorjs to max 800KB
      const compressed = await compressBannerImage(file, 800);
      setCompressedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      toast.success(
        `Gambar terkompres: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)} (max 800KB)`
      );
    } catch (err) {
      toast.error('Gagal mengompres gambar: ' + (err.message || 'Error'));
      setCompressedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();

    if (!editingBanner && !compressedFile && !previewUrl) {
      toast.error('Silakan pilih file gambar banner');
      return;
    }

    setSavingBanner(true);
    try {
      const data = new FormData();
      if (formData.show_text) {
        if (formData.title) data.append('title', formData.title.trim());
        if (formData.description) data.append('description', formData.description.trim());
        if (formData.badge) data.append('badge', formData.badge.trim());
      } else {
        data.append('title', '');
        data.append('description', '');
        data.append('badge', '');
      }

      data.append('action_url', formData.action_url?.trim() || '');
      data.append('show_text', String(formData.show_text));
      data.append('is_active', String(formData.is_active));
      data.append('sort_order', String(formData.sort_order || 0));

      if (compressedFile) {
        data.append('image', compressedFile);
      } else if (editingBanner?.image_url) {
        data.append('image_url', editingBanner.image_url);
      }

      if (editingBanner) {
        const res = await put(API_ENDPOINTS.BANNERS.UPDATE(editingBanner.id), data);
        toast.success(res.message || 'Banner berhasil diperbarui');
      } else {
        const res = await post(API_ENDPOINTS.BANNERS.CREATE, data);
        toast.success(res.message || 'Banner berhasil ditambahkan');
      }

      setBannerModalOpen(false);
      fetchBanners();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingBanner(false);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      const res = await put(API_ENDPOINTS.BANNERS.TOGGLE(banner.id));
      toast.success(res.message);
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: res.is_active } : b))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteBanner = async () => {
    if (!deleteModalBanner) return;
    try {
      const res = await del(API_ENDPOINTS.BANNERS.DELETE(deleteModalBanner.id));
      toast.success(res.message);
      setDeleteModalBanner(null);
      fetchBanners();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    setSavingAnnouncement(true);
    try {
      const res = await put(API_ENDPOINTS.SETTINGS.ANNOUNCEMENT, {
        text: announcementText,
        is_active: announcementActive,
      });
      toast.success(res.message || 'Papan pengumuman berhasil disimpan');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingAnnouncement(false);
    }
  };

  return (
    <div>
      <Header
        title="Banner & Pengumuman"
        subtitle="Kelola banner promo beranda & teks berjalan"
        right={
          <Link to="/" className="p-2 bg-white/20 rounded-xl inline-block" title="Kembali ke Beranda">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
        }
      />

      <div className="px-4 -mt-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex bg-gray-200/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('banners')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'banners' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Manajemen Banner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('announcement')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'announcement' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Papan Pengumuman</span>
          </button>
        </div>

        {/* ─── TAB 1: BANNER MANAGEMENT ─── */}
        {activeTab === 'banners' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Daftar Banner Promo</h2>
                <p className="text-[11px] text-gray-500">Banner aktif akan bergeser otomatis di beranda</p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Banner</span>
              </button>
            </div>

            {loadingBanners ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : banners.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="Belum ada banner"
                description="Klik tombol 'Tambah Banner' untuk mengunggah banner promo pertama Anda."
              />
            ) : (
              <div className="space-y-3">
                {banners.map((banner) => {
                  const resolvedImg = resolveImageUrl(banner.image_url);
                  return (
                    <div
                      key={banner.id}
                      className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                    >
                      {/* Banner Image Preview */}
                      <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                        <img
                          src={resolvedImg}
                          alt={banner.title || 'Banner'}
                          className="w-full h-full object-cover"
                        />
                        {banner.show_text ? (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3 text-white">
                            {banner.badge && (
                              <span className="inline-block self-start text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white mb-1 shadow-xs">
                                {banner.badge}
                              </span>
                            )}
                            {banner.title && (
                              <p className="font-extrabold text-sm drop-shadow leading-tight line-clamp-1">
                                {banner.title}
                              </p>
                            )}
                            {banner.description && (
                              <p className="text-white/80 text-[10px] drop-shadow-xs line-clamp-1 mt-0.5">
                                {banner.description}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Murni Gambar
                          </div>
                        )}
                      </div>

                      {/* Card Content & Action Bar */}
                      <div className="p-3 bg-white flex items-center justify-between gap-2 border-t border-gray-100">
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 truncate">
                              {banner.title || 'Banner Tanpa Judul'}
                            </span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                              Urutan: #{banner.sort_order}
                            </span>
                          </div>
                          {banner.action_url && (
                            <p className="text-[10px] text-teal-600 truncate mt-0.5 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span>{banner.action_url}</span>
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(banner)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              banner.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}
                            title={banner.is_active ? 'Nonaktifkan banner' : 'Aktifkan banner'}
                          >
                            {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(banner)}
                            className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                            title="Edit banner"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteModalBanner(banner)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                            title="Hapus banner"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: ANNOUNCEMENT TICKER MANAGEMENT ─── */}
        {activeTab === 'announcement' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-teal-600" />
                Papan Pengumuman Berjalan (Running Text)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Teks ini akan muncul sebagai ticker berjalan tepat di bawah tab bar beranda aplikasi.
              </p>
            </div>

            {loadingAnnouncement ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : (
              <form onSubmit={handleSaveAnnouncement} className="space-y-3.5">
                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-xs font-bold text-gray-800">Status Papan Pengumuman</p>
                    <p className="text-[11px] text-gray-500">Tampilkan atau sembunyikan running text di beranda</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={announcementActive}
                      onChange={(e) => setAnnouncementActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {/* Text Area */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Isi Pesan Pengumuman
                  </label>
                  <textarea
                    rows={4}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Tulis pesan pengumuman untuk seluruh agen di sini..."
                    className="w-full px-3 py-2.5 text-xs text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Gunakan kalimat yang informatif dan padat agar mudah dibaca saat teks berjalan.
                  </p>
                </div>

                {/* Live Preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Live Preview di Beranda:</p>
                  <div className="bg-teal-900 py-1.5 px-3 rounded-xl border border-teal-800 flex items-center gap-2 overflow-hidden text-[11px] text-teal-100 font-medium">
                    <div className="flex-shrink-0 flex items-center gap-1 text-orange-300 font-bold bg-teal-800 px-1.5 py-0.5 rounded text-[10px]">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span>INFO</span>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <span className="animate-marquee inline-block">
                        {announcementText || '(Teks pengumuman kosong)'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {savingAnnouncement ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    <span>Simpan Pengumuman</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL CREATE / EDIT BANNER ─── */}
      <Modal
        isOpen={bannerModalOpen}
        onClose={() => setBannerModalOpen(false)}
        title={editingBanner ? 'Edit Banner Promo' : 'Tambah Banner Promo'}
      >
        <form onSubmit={handleSaveBanner} className="space-y-3.5">
          {/* File Upload with CompressorJS */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              File Gambar Banner <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-gray-50/50">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-teal-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-gray-700">
                Pilih atau seret gambar ke sini
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Rasio ideal 16:9 • Otomatis terkompresi max 800 KB via CompressorJS
              </p>
            </div>

            {compressing && (
              <div className="flex items-center gap-1.5 text-xs text-teal-600 mt-1.5">
                <LoadingSpinner size="sm" />
                <span>Mengompresi gambar (target &le; 800 KB)...</span>
              </div>
            )}

            {compressedFile && (
              <div className="flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 p-2 rounded-xl mt-1.5 border border-emerald-200">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Ukuran terkompresi: <strong>{formatFileSize(compressedFile.size)}</strong>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                  &le; 800 KB OK
                </span>
              </div>
            )}

            {previewUrl && (
              <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 relative aspect-[16/9] bg-slate-900">
                <img
                  src={previewUrl}
                  alt="Preview Banner"
                  className="w-full h-full object-cover"
                />
                {formData.show_text && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5 text-white">
                    {formData.badge && (
                      <span className="inline-block self-start text-[8px] font-bold px-1.5 py-0.2 rounded bg-orange-500 mb-0.5">
                        {formData.badge}
                      </span>
                    )}
                    <p className="font-bold text-xs line-clamp-1">{formData.title || 'Judul Banner'}</p>
                    <p className="text-[10px] text-white/80 line-clamp-1">{formData.description || 'Deskripsi banner...'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Option: Pakai Judul + Deskripsi ATAU Cuma Upload Banner Saja */}
          <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_text}
                onChange={(e) => setFormData((prev) => ({ ...prev, show_text: e.target.checked }))}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
              />
              <div>
                <span className="text-xs font-bold text-teal-950">
                  Tampilkan Judul & Deskripsi Teks
                </span>
                <p className="text-[10px] text-teal-700">
                  {formData.show_text
                    ? 'Judul, deskripsi, dan badge akan tampil di atas banner.'
                    : 'Banner murni sebagai gambar grafis tanpa teks overlay (hanya upload banner saja).'}
                </p>
              </div>
            </label>
          </div>

          {/* Conditional Fields if show_text is TRUE */}
          {formData.show_text && (
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Judul Banner</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: QRIS Static Untuk Usahamu"
                  className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required={formData.show_text}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Contoh: MDR 0% & Pencairan Realtime"
                  className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Badge Tag (Opsional)</label>
                <input
                  type="text"
                  value={formData.badge}
                  onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                  placeholder="Contoh: Promo, Diskon Spesial, Fitur Baru"
                  className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Link Aksi / URL Tujuan */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Link Tujuan Saat Banner Diklik (Opsional)
            </label>
            <input
              type="text"
              value={formData.action_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, action_url: e.target.value }))}
              placeholder="Contoh: /layanan/pulsa atau /request-topup"
              className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Sort Order & Status */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Urutan Tampil</label>
              <input
                type="number"
                min="0"
                value={formData.sort_order}
                onChange={(e) => setFormData((prev) => ({ ...prev, sort_order: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                />
                <span className="text-xs font-semibold text-gray-800">Banner Aktif</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBannerModalOpen(false)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-xs hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingBanner || compressing}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {savingBanner ? <LoadingSpinner size="sm" className="text-white" /> : 'Simpan Banner'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL CONFIRM DELETE BANNER ─── */}
      <Modal
        isOpen={!!deleteModalBanner}
        onClose={() => setDeleteModalBanner(null)}
        title="Hapus Banner"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            Apakah Anda yakin ingin menghapus banner ini? Banner yang dihapus tidak dapat dipulihkan kembali.
          </p>
          {deleteModalBanner?.title && (
            <div className="p-3 bg-gray-50 rounded-xl text-xs font-semibold text-gray-800">
              {deleteModalBanner.title}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModalBanner(null)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-xs hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteBanner}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BannerSettings;
