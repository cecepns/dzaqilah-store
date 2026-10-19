import { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  KeyRound,
  Users,
  Send,
  RefreshCw,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Trash2,
  UserPlus,
  PackageCheck,
  MapPin,
  Lock,
  Unlock,
  Radio,
  FileText,
  Sliders,
  ChevronRight,
  ExternalLink,
  Search,
  ShoppingCart,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { get, post, put, getErrorMessage } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';

const KmspTools = () => {
  const { user, isAdmin, isOwner, isReseller } = useAuth();
  const [activeTab, setActiveTab] = useState('public');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [settings, setSettings] = useState({
    can_access_admin_tools: false,
    enable_member: false,
    enable_reseller: false,
    api_key: '',
    base_url: '',
  });

  // Package catalog state
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedPackage, setExpandedPackage] = useState(null);

  // Auto-saved credentials from OTP flows
  const [savedAuthId, setSavedAuthId] = useState(() => localStorage.getItem('kmsp_auth_id') || '');
  const [savedAccessToken, setSavedAccessToken] = useState(() => localStorage.getItem('kmsp_access_token') || '');
  const [savedPhone, setSavedPhone] = useState(() => localStorage.getItem('kmsp_phone') || '');

  // Action result modal
  const [resultModal, setResultModal] = useState({
    isOpen: false,
    title: '',
    data: null,
    isSuccess: true,
    action: '',
  });

  // Dynamic form state
  const [activeActionModal, setActiveActionModal] = useState(null);
  const [formData, setFormData] = useState({});

  const isPrivileged = isAdmin || isOwner;

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await get(API_ENDPOINTS.KMSP.SETTINGS);
      if (res?.data) {
        setSettings(res.data);
      }
    } catch (err) {
      // fallback
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchPackages = async (force = false) => {
    try {
      setLoadingPackages(true);
      const res = await get(API_ENDPOINTS.KMSP.PACKAGES, {
        brand: brandFilter !== 'all' ? brandFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchQuery || undefined,
        force_refresh: force ? 'true' : undefined,
      });
      if (res?.data) {
        setPackages(res.data);
      }
    } catch (err) {
      toast.error('Gagal memuat katalog produk DZ STORE');
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'packages') {
      fetchPackages();
    }
  }, [activeTab, brandFilter, typeFilter]);

  const handleUpdateSettings = async (updates) => {
    try {
      const res = await put(API_ENDPOINTS.KMSP.SETTINGS, updates);
      toast.success(res.message || 'Pengaturan berhasil diperbarui');
      setSettings((prev) => ({ ...prev, ...(res.data || updates) }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openActionModal = (modalConfig) => {
    const initial = {};
    (modalConfig.fields || []).forEach((f) => {
      initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
    });
    setFormData(initial);
    setActiveActionModal(modalConfig);
  };

  const handleExecute = async (category, action, params = {}, payload = null) => {
    setExecuting(true);
    try {
      const res = await post(API_ENDPOINTS.KMSP.EXECUTE, {
        category,
        action,
        params,
        payload,
      });

      // Cache auth_id or access_token if returned
      if (action === 'request_otp' && res.data?.auth_id) {
        localStorage.setItem('kmsp_auth_id', res.data.auth_id);
        setSavedAuthId(res.data.auth_id);
        if (params.phone) {
          localStorage.setItem('kmsp_phone', params.phone);
          setSavedPhone(params.phone);
        }
      } else if (action === 'login_otp' && (res.data?.access_token || res.data?.token)) {
        const tokenVal = res.data.access_token || res.data.token;
        localStorage.setItem('kmsp_access_token', tokenVal);
        setSavedAccessToken(tokenVal);
      }

      setResultModal({
        isOpen: true,
        title: `Hasil: ${action.replace(/_/g, ' ').toUpperCase()}`,
        data: res.data,
        message: res.message,
        isSuccess: res.success !== false,
        action,
      });

      if (res.success !== false) {
        toast.success(res.message || 'Aksi berhasil dieksekusi');
      } else {
        toast.error(res.message || 'Gagal memproses aksi');
      }
      setActiveActionModal(null);
      setFormData({});
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(msg);
      setResultModal({
        isOpen: true,
        title: 'Gagal Eksekusi',
        data: null,
        message: msg,
        isSuccess: false,
        action,
      });
    } finally {
      setExecuting(false);
    }
  };

  const canAccessAdminTools = isPrivileged || settings.can_access_admin_tools;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header
        title="Paket Akrab & XL/Axis"
        subtitle="Alat Injeksi & Manajemen Akrab (DZ Store)"
        backTo="/layanan"
      />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-3.5">
        {/* Navigation Tabs */}
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200/80 shadow-xs gap-1 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveTab('public')}
            className={`flex-1 min-w-[95px] py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${activeTab === 'public'
                ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Layanan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className={`flex-1 min-w-[105px] py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${activeTab === 'packages'
                ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Katalog Paket
          </button>

          {canAccessAdminTools && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('akmt')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${activeTab === 'akmt'
                    ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                AKMT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tembak')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${activeTab === 'tembak'
                    ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Tembak Paket
              </button>
            </>
          )}

          {isPrivileged && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 min-w-[90px] py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${activeTab === 'settings'
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Pengaturan
            </button>
          )}
        </div>

        {/* ─── TAB 1: LAYANAN SEMUA ROLE ───────────────────────────────── */}
        {activeTab === 'public' && (
          <div className="space-y-2.5">
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-teal-900">Fitur Pelanggan & Agen</p>
                <p className="text-[11px] text-teal-700">Tersedia untuk semua akun terdaftar</p>
              </div>
              <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full font-bold">
                Semua Role
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* ─── PEMBELIAN PAKET (PALING ATAS) ─── */}
              {/* Pembelian Paket NO OTP */}
              <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 p-3.5 rounded-2xl border-2 border-emerald-300 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-gray-900">Pembelian Paket NO OTP</h4>
                      <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">Instan</span>
                    </div>
                    <p className="text-[11px] text-gray-600">Tembak langsung tanpa kode verifikasi OTP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openActionModal({
                    title: 'Pembelian Paket NO OTP',
                    action: 'beli_paket_no_otp',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP Tujuan (XL/AXIS)', placeholder: '08xxxx', defaultValue: savedPhone },
                      { name: 'package_id', label: 'Kode Paket (Contoh: SXLEDU15GB7D_PREV)', placeholder: 'Masukkan kode paket' },
                    ]
                  })}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Beli
                </button>
              </div>

              {/* Pembelian Paket DENGAN OTP */}
              <div className="bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-3.5 rounded-2xl border-2 border-amber-300 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-gray-900">Pembelian Paket dengan OTP</h4>
                      <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-bold">Verifikasi</span>
                    </div>
                    <p className="text-[11px] text-gray-600">Beli paket membutuhkan kode OTP via SMS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openActionModal({
                    title: 'Pembelian Paket dengan OTP',
                    action: 'beli_paket_otp',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP Tujuan', placeholder: '08xxxx', defaultValue: savedPhone },
                      { name: 'package_id', label: 'ID Paket / Service Code', placeholder: 'Masukkan ID paket' },
                      { name: 'otp', label: 'Kode OTP (SMS)', placeholder: 'Kode verifikasi SMS' },
                      { name: 'access_token', label: 'Access Token (Opsional jika sudah login)', placeholder: 'Session Token', defaultValue: savedAccessToken },
                    ]
                  })}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Proses
                </button>
              </div>

              {/* Banner Katalog */}
              <div className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white p-3.5 rounded-2xl shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs">Katalog 180+ Paket XL & AXIS (DZ STORE)</h4>
                  <p className="text-[11px] text-teal-100">Daftar harga, kuota live & pembelian langsung</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('packages')}
                  className="px-3 py-1.5 bg-white text-teal-800 text-xs font-bold rounded-xl shadow-xs hover:bg-teal-50 active:scale-95 transition-all flex items-center gap-1"
                >
                  Buka <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Detail Kuota Anggota Paket Akrab */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Detail Kuota Anggota Akrab</h4>
                    <p className="text-[11px] text-gray-500">Cek rincian kuota anggota paket bersama</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openActionModal({
                    title: 'Detail Kuota Anggota Paket Akrab',
                    action: 'detail_kuota_akrab',
                    category: 'public',
                    fields: [
                      { name: 'member_id', label: 'Nomor HP Anggota / Family Member ID', placeholder: '08xxxx', defaultValue: savedPhone },
                    ]
                  })}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cek
                </button>
              </div>

              {/* Cek Pulsa & Masa Aktif */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Cek Pulsa & Masa Aktif</h4>
                    <p className="text-[11px] text-gray-500">Cek saldo pulsa via session token</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openActionModal({
                    title: 'Cek Pulsa & Masa Aktif',
                    action: 'cek_pulsa',
                    category: 'public',
                    fields: [
                      { name: 'access_token', label: 'Access Token XL/AXIS (dari Login OTP)', placeholder: 'Session Token', defaultValue: savedAccessToken },
                    ]
                  })}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cek
                </button>
              </div>

              {/* Cek Paket Aktif */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Cek Paket Aktif</h4>
                    <p className="text-[11px] text-gray-500">Lihat paket yang sedang berjalan di nomor</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openActionModal({
                    title: 'Cek Paket Aktif',
                    action: 'cek_paket_aktif',
                    category: 'public',
                    fields: [
                      { name: 'access_token', label: 'Access Token XL/AXIS (dari Login OTP)', placeholder: 'Session Token', defaultValue: savedAccessToken },
                    ]
                  })}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cek
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: KATALOG PAKET XL & AXIS (LIVE DZ STORE) ──────────────── */}
        {activeTab === 'packages' && (
          <div className="space-y-3">
            {/* Filter & Search Header */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari paket XL / AXIS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchPackages(); }}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchPackages(true)}
                  disabled={loadingPackages}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition-all flex items-center justify-center flex-shrink-0"
                  title="Segarkan Katalog"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPackages ? 'animate-spin text-teal-600' : ''}`} />
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[11px]">
                {['all', 'XL', 'AXIS'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandFilter(b)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      brandFilter === b
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {b === 'all' ? 'Semua Brand' : b}
                  </button>
                ))}
                <div className="h-4 w-px bg-gray-200 mx-1 flex-shrink-0" />
                {[
                  { id: 'all', label: 'Semua Tipe' },
                  { id: 'no_otp', label: 'NO OTP' },
                  { id: 'otp', label: 'Butuh OTP' },
                  { id: 'akrab', label: 'Akrab / Circle' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeFilter(t.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                      typeFilter === t.id
                        ? 'bg-indigo-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Paket */}
            {loadingPackages ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-xs text-gray-500 font-semibold">Memuat paket dari DZ STORE...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center">
                <PackageCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-700">Tidak ada paket ditemukan</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Coba ubah kata kunci atau filter pencarian</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-500 px-1">
                  Menampilkan {packages.length} paket
                </p>

                {packages.map((pkg) => (
                  <div
                    key={pkg.package_code}
                    className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs hover:border-teal-200 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {pkg.no_need_login ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                              <Unlock className="w-3 h-3" /> NO OTP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              <Lock className="w-3 h-3" /> Butuh OTP
                            </span>
                          )}

                          {pkg.sedang_gangguan && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-md">
                              <AlertCircle className="w-3 h-3" /> Gangguan
                            </span>
                          )}

                          {(pkg.is_akrab || pkg.is_circle) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md">
                              <Users className="w-3 h-3" /> Akrab
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs text-gray-900 leading-snug break-words">
                          {pkg.package_name}
                        </h4>

                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                          <span>{pkg.package_code}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(pkg.package_code);
                              toast.success('Kode paket disalin!');
                            }}
                            className="hover:text-gray-900"
                            title="Salin kode"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 block">
                          Rp {Number(pkg.price || pkg.selling_price || pkg.package_harga_int || 0).toLocaleString('id-ID')}
                        </span>
                        {isPrivileged && pkg.original_price > 0 && (
                          <div className="text-[10px] text-gray-500 mt-1 flex flex-col items-end">
                            <span>Modal: Rp {Number(pkg.original_price).toLocaleString('id-ID')}</span>
                            <span className="text-purple-700 font-semibold">Margin {pkg.margin_percent}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Expander */}
                    {pkg.package_description && (
                      <div className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        {expandedPackage === pkg.package_code ? (
                          <div className="space-y-1">
                            <pre className="font-sans whitespace-pre-wrap leading-relaxed text-gray-700">{pkg.package_description}</pre>
                            <button
                              type="button"
                              onClick={() => setExpandedPackage(null)}
                              className="text-teal-700 text-[10px] font-bold hover:underline"
                            >
                              Tutup detail
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="line-clamp-1 flex-1 text-gray-500 mr-2">{pkg.package_description.replace(/\r?\n/g, ' ')}</p>
                            <button
                              type="button"
                              onClick={() => setExpandedPackage(pkg.package_code)}
                              className="text-teal-700 text-[10px] font-bold hover:underline flex-shrink-0"
                            >
                              Lihat detail
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buy Button */}
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={pkg.sedang_gangguan}
                        onClick={() => {
                          const modalData = {
                            packageName: pkg.package_name,
                            price: pkg.price || pkg.selling_price,
                          };
                          if (pkg.no_need_login) {
                            openActionModal({
                              ...modalData,
                              title: `Beli Paket NO OTP`,
                              action: 'beli_paket_no_otp',
                              category: 'public',
                              fields: [
                                { name: 'phone', label: 'Nomor HP Tujuan (XL/AXIS)', placeholder: '08xxxx', defaultValue: savedPhone },
                                { name: 'package_id', label: 'Kode Paket Terpilih', defaultValue: pkg.package_code, readOnly: true },
                              ],
                            });
                          } else {
                            openActionModal({
                              ...modalData,
                              title: `Beli Paket dengan OTP`,
                              action: 'beli_paket_otp',
                              category: 'public',
                              fields: [
                                { name: 'phone', label: 'Nomor HP Tujuan (XL/AXIS)', placeholder: '08xxxx', defaultValue: savedPhone },
                                { name: 'package_id', label: 'Kode Paket Terpilih', defaultValue: pkg.package_code, readOnly: true },
                                { name: 'otp', label: 'Kode OTP (SMS)', placeholder: 'Kode verifikasi' },
                                { name: 'access_token', label: 'Access Token (Opsional jika sudah Login OTP)', defaultValue: savedAccessToken },
                              ],
                            });
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                          pkg.sedang_gangguan
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-teal-700 hover:bg-teal-800 text-white active:scale-95'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Beli Sekarang
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: AKMT (PENGELOLA MANAGEMENT) ─────────────────────────── */}
        {activeTab === 'akmt' && canAccessAdminTools && (
          <div className="space-y-2.5">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-950">Akrab Pengelola Management Tools</p>
                <p className="text-[11px] text-indigo-700">Manajemen pengelola, slot, dan kuota bersama</p>
              </div>
              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                AKMT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleExecute('akmt', 'cek_saldo_panel')}
                disabled={executing}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <Wallet className="w-5 h-5 text-teal-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Cek Saldo Panel</h4>
                  <p className="text-[10px] text-gray-500">Saldo akun DZ STORE</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Cek Status Transaksi',
                  action: 'cek_status_transaksi',
                  category: 'akmt',
                  fields: [{ name: 'trx_id', label: 'ID Transaksi / Ref ID', placeholder: 'Contoh: TRX12345' }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <RefreshCw className="w-5 h-5 text-blue-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Status Transaksi</h4>
                  <p className="text-[10px] text-gray-500">Cek status ref_id</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Tambah Pengelola Paket Akrab',
                  action: 'tambah_pengelola',
                  category: 'akmt',
                  fields: [
                    { name: 'phone', label: 'Nomor HP Pengelola (Induk)', placeholder: '0817xxx', defaultValue: savedPhone },
                    { name: 'name', label: 'Nama Pengelola / Label', placeholder: 'Akrab Family 1' },
                  ]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <UserPlus className="w-5 h-5 text-purple-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Tambah Pengelola</h4>
                  <p className="text-[10px] text-gray-500">Daftarkan nomor induk</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecute('akmt', 'daftar_pengelola')}
                disabled={executing}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <Users className="w-5 h-5 text-emerald-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Daftar Pengelola</h4>
                  <p className="text-[10px] text-gray-500">List pengelola aktif</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Slot Anggota Pengelola Akrab',
                  action: 'slot_anggota',
                  category: 'akmt',
                  fields: [{ name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx', defaultValue: savedPhone }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <PackageCheck className="w-5 h-5 text-amber-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Slot Anggota</h4>
                  <p className="text-[10px] text-gray-500">Cek ketersediaan slot</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Invite / Ganti Anggota Akrab',
                  action: 'invite_anggota',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx', defaultValue: savedPhone },
                    { name: 'member_phone', label: 'Nomor Anggota Baru', placeholder: '08xxxx' },
                    { name: 'slot_no', label: 'Nomor Slot (1-4)', placeholder: '1' },
                  ]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <Send className="w-5 h-5 text-cyan-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Invite Anggota</h4>
                  <p className="text-[10px] text-gray-500">Kirim undangan slot</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Set Kuota Bersama (Kuber)',
                  action: 'set_kuber',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx', defaultValue: savedPhone },
                    { name: 'member_phone', label: 'Nomor Anggota', placeholder: '08xxxx' },
                    { name: 'quota_gb', label: 'Batas Kuota (GB)', placeholder: 'Contoh: 10' },
                  ]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between"
              >
                <Sliders className="w-5 h-5 text-rose-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Set Kuota Kuber</h4>
                  <p className="text-[10px] text-gray-500">Atur batas kuota anggota</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Tendang / Kick Anggota Akrab',
                  action: 'kick_anggota',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx', defaultValue: savedPhone },
                    { name: 'member_phone', label: 'Nomor Anggota yang Dikeluarkan', placeholder: '08xxxx' },
                  ]
                })}
                className="p-3 bg-white border border-red-200 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all flex flex-col justify-between bg-red-50/20"
              >
                <Trash2 className="w-5 h-5 text-red-600 mb-2" />
                <div>
                  <h4 className="font-bold text-xs text-red-900">Tendang Anggota</h4>
                  <p className="text-[10px] text-red-600">Hapus dari slot</p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => openActionModal({
                title: 'Beli Slot Tambahan Paket Akrab',
                action: 'beli_slot_tambahan',
                category: 'akmt',
                fields: [
                  { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx', defaultValue: savedPhone },
                  { name: 'slots_count', label: 'Jumlah Slot (1-2)', placeholder: '1' },
                ]
              })}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-teal-700 to-cyan-700 text-white rounded-2xl font-bold text-xs shadow-xs active:scale-98 transition-all"
            >
              + Beli Slot Tambahan Paket Akrab
            </button>
          </div>
        )}

        {/* ─── TAB 3: TEMBAK PAKET DATA XL & AXIS ───────────────────────── */}
        {activeTab === 'tembak' && canAccessAdminTools && (
          <div className="space-y-2.5">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-950">Tembak Paket Data XL & AXIS</p>
                <p className="text-[11px] text-orange-700">Otentikasi OTP, Session Token, & Injeksi Paket</p>
              </div>
              <span className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-full font-bold">
                API v1
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Request OTP',
                  action: 'request_otp',
                  category: 'tembak_paket',
                  fields: [{ name: 'phone', label: 'Nomor HP XL/AXIS', placeholder: '08xxxx', defaultValue: savedPhone }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <Send className="w-5 h-5 text-indigo-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Request OTP</h4>
                <p className="text-[10px] text-gray-500">Kirim kode OTP ke nomor</p>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Login OTP (Dapatkan Token)',
                  action: 'login_otp',
                  category: 'tembak_paket',
                  fields: [
                    { name: 'phone', label: 'Nomor HP XL/AXIS', placeholder: '08xxxx', defaultValue: savedPhone },
                    { name: 'auth_id', label: 'Auth ID (otomatis dari Request OTP)', placeholder: 'Auth ID verifikasi', defaultValue: savedAuthId },
                    { name: 'otp', label: 'Kode OTP (SMS)', placeholder: 'Kode verifikasi' }
                  ]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <KeyRound className="w-5 h-5 text-emerald-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Login OTP</h4>
                <p className="text-[10px] text-gray-500">Verifikasi & simpan token</p>
              </button>

              <button
                type="button"
                onClick={() => handleExecute('tembak_paket', 'access_token_list')}
                disabled={executing}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <FileText className="w-5 h-5 text-blue-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Access Token List</h4>
                <p className="text-[10px] text-gray-500">Daftar token sesi aktif</p>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Extend Session Login',
                  action: 'extend_session',
                  category: 'tembak_paket',
                  fields: [{ name: 'phone', label: 'Nomor HP atau Token', placeholder: '08xxxx', defaultValue: savedPhone }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <RefreshCw className="w-5 h-5 text-amber-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Extend Session</h4>
                <p className="text-[10px] text-gray-500">Perpanjang sesi login</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('packages')}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <PackageCheck className="w-5 h-5 text-teal-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Daftar Produk</h4>
                <p className="text-[10px] text-gray-500">Katalog paket XL/AXIS live</p>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Cek Stok Paket',
                  action: 'cek_stok_paket',
                  category: 'tembak_paket',
                  fields: [{ name: 'package_id', label: 'ID Paket (Contoh: AXIS_XCONF_5GB_7D)', placeholder: 'ID paket tembak' }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <Radio className="w-5 h-5 text-cyan-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Cek Stok Paket</h4>
                <p className="text-[10px] text-gray-500">Ketersediaan kuota paket</p>
              </button>

              <button
                type="button"
                onClick={() => openActionModal({
                  title: 'Cek Lokasi / Area Nomor',
                  action: 'cek_lokasi',
                  category: 'tembak_paket',
                  fields: [{ name: 'access_token', label: 'Access Token XL/AXIS (dari Login OTP)', placeholder: 'Session Token', defaultValue: savedAccessToken }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <MapPin className="w-5 h-5 text-rose-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Cek Lokasi / Area</h4>
                <p className="text-[10px] text-gray-500">Wilayah coverage nomor</p>
              </button>

              <button
                type="button"
                onClick={() => handleExecute('tembak_paket', 'cek_stok_akrab_circle')}
                disabled={executing}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <Users className="w-5 h-5 text-purple-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Stok Akrab & Circle</h4>
                <p className="text-[10px] text-gray-500">Stok global paket akrab</p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => openActionModal({
                title: 'Unreg / Stop Paket Aktif',
                action: 'unreg_paket',
                category: 'tembak_paket',
                fields: [
                  { name: 'access_token', label: 'Access Token XL/AXIS (dari Login OTP)', placeholder: 'Session Token', defaultValue: savedAccessToken },
                  { name: 'encrypted_package_code', label: 'Kode Paket Terenkripsi / ID Paket', placeholder: 'ID / kode paket yang distop' }
                ]
              })}
              className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs shadow-xs active:scale-98 transition-all"
            >
              ⛔ Unreg / Stop Paket Aktif
            </button>
          </div>
        )}

        {/* ─── TAB 4: PENGATURAN AKSES ROLE (ADMIN & OWNER) ─────────────── */}
        {activeTab === 'settings' && isPrivileged && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Settings2 className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-xs text-gray-900">Hak Akses & Pengaturan DZ STORE</h3>
                <p className="text-[11px] text-gray-500">
                  Atur perizinan menu AKMT dan Tembak Paket untuk role pengguna
                </p>
              </div>
            </div>

            {loadingSettings ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : (
              <div className="space-y-3.5">
                {/* Toggle Member */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div>
                    <p className="font-bold text-xs text-gray-900">Akses untuk Member Biasa</p>
                    <p className="text-[11px] text-gray-500">Izinkan member mengakses menu AKMT & Tembak Paket</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_member}
                      onChange={(e) => handleUpdateSettings({ enable_member: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Toggle Reseller */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div>
                    <p className="font-bold text-xs text-gray-900">Akses untuk Reseller</p>
                    <p className="text-[11px] text-gray-500">Izinkan reseller mengakses menu AKMT & Tembak Paket</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_reseller}
                      onChange={(e) => handleUpdateSettings({ enable_reseller: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* API Key */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-xs font-bold text-gray-700">DZ STORE API Key</label>
                  <input
                    type="text"
                    value={settings.api_key || ''}
                    onChange={(e) => setSettings((p) => ({ ...p, api_key: e.target.value }))}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-gray-300 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ api_key: settings.api_key })}
                    className="mt-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700"
                  >
                    Simpan API Key
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal Form Action ────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(activeActionModal)}
        onClose={() => { setActiveActionModal(null); setFormData({}); }}
        title={activeActionModal?.title || 'Form Aksi'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (activeActionModal) {
              handleExecute(activeActionModal.category, activeActionModal.action, formData);
            }
          }}
          className="space-y-3"
        >
          {activeActionModal?.price && (
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 p-3 rounded-xl flex items-center justify-between text-xs shadow-xs">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider">Paket Dipilih</p>
                <p className="font-bold text-teal-950 truncate">{activeActionModal.packageName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider">Harga Jual</p>
                <p className="font-black text-teal-900 text-sm">
                  Rp {Number(activeActionModal.price).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          )}

          {activeActionModal?.fields?.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-xs font-bold text-gray-700">{field.label}</label>
              <input
                type="text"
                required={field.required !== false}
                readOnly={Boolean(field.readOnly)}
                value={formData[field.name] !== undefined ? formData[field.name] : ''}
                onChange={(e) => setFormData((p) => ({ ...p, [field.name]: e.target.value }))}
                placeholder={field.placeholder}
                className={`w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                  field.readOnly ? 'bg-gray-100 text-gray-600 cursor-not-allowed font-mono' : ''
                }`}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setActiveActionModal(null); setFormData({}); }}
              className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={executing}
              className="flex-1 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center justify-center gap-1.5"
            >
              {executing ? <LoadingSpinner size="sm" /> : 'Kirim / Proses'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Modal Hasil Eksekusi ─────────────────────────────────────── */}
      <Modal
        isOpen={resultModal.isOpen}
        onClose={() => setResultModal((p) => ({ ...p, isOpen: false }))}
        title={resultModal.title}
      >
        <div className="space-y-3">
          <div className={`p-3 rounded-xl flex items-center gap-2 ${resultModal.isSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {resultModal.isSuccess ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <p className="text-xs font-semibold leading-relaxed">{resultModal.message}</p>
          </div>

          {/* Quick Helper: Auth ID from Request OTP */}
          {resultModal.action === 'request_otp' && resultModal.data?.auth_id && (
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Auth ID Tersimpan</span>
                <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono">Tersimpan</span>
              </div>
              <p className="text-xs font-mono font-bold text-indigo-950 break-all">{resultModal.data.auth_id}</p>
              <button
                type="button"
                onClick={() => {
                  setResultModal((p) => ({ ...p, isOpen: false }));
                  openActionModal({
                    title: 'Login OTP (Dapatkan Token)',
                    action: 'login_otp',
                    category: 'tembak_paket',
                    fields: [
                      { name: 'phone', label: 'Nomor HP XL/AXIS', placeholder: '08xxxx', defaultValue: savedPhone },
                      { name: 'auth_id', label: 'Auth ID (otomatis terisi)', placeholder: 'Auth ID verifikasi', defaultValue: resultModal.data.auth_id },
                      { name: 'otp', label: 'Kode OTP (SMS)', placeholder: '6 digit kode' },
                    ],
                  });
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              >
                Lanjut ke Form Login OTP →
              </button>
            </div>
          )}

          {/* Quick Helper: Saldo Panel DZ STORE */}
          {resultModal.data?.balance !== undefined && (
            <div className="bg-teal-50 border border-teal-200 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-teal-700 font-bold">Saldo Akun Panel DZ STORE</p>
              <p className="text-xl font-black text-teal-900 mt-1">
                Rp {Number(resultModal.data.balance).toLocaleString('id-ID')}
              </p>
            </div>
          )}

          {/* Quick Helper: Access Token */}
          {resultModal.data?.access_token && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Access Token Diterima</span>
              <p className="text-xs font-mono text-emerald-950 break-all">{resultModal.data.access_token}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resultModal.data.access_token);
                  toast.success('Access Token disalin ke clipboard!');
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" /> Salin Access Token
              </button>
            </div>
          )}

          {/* Technical JSON details */}
          {resultModal.data && (
            <div className="bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 scrollbar-thin">
              <pre>{JSON.stringify(resultModal.data, null, 2)}</pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => setResultModal((p) => ({ ...p, isOpen: false }))}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 font-bold text-xs text-gray-700 rounded-xl"
          >
            Tutup
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default KmspTools;
