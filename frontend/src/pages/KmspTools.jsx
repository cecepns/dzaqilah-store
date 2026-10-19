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

  // Action result modal
  const [resultModal, setResultModal] = useState({
    isOpen: false,
    title: '',
    data: null,
    isSuccess: true,
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

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdateSettings = async (updates) => {
    try {
      const res = await put(API_ENDPOINTS.KMSP.SETTINGS, updates);
      toast.success(res.message || 'Pengaturan berhasil diperbarui');
      setSettings((prev) => ({ ...prev, ...(res.data || updates) }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
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

      setResultModal({
        isOpen: true,
        title: `Hasil: ${action.replace(/_/g, ' ').toUpperCase()}`,
        data: res.data,
        message: res.message,
        isSuccess: res.success !== false,
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
        subtitle="Alat Injeksi & Manajemen Akrab (KMSP)"
        backTo="/layanan"
      />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-3.5">
        {/* Navigation Tabs */}
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200/80 shadow-xs gap-1 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveTab('public')}
            className={`flex-1 min-w-[100px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center ${
              activeTab === 'public'
                ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Layanan Umum
          </button>

          {canAccessAdminTools && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('akmt')}
                className={`flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'akmt'
                    ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pengelola (AKMT)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tembak')}
                className={`flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'tembak'
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
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === 'settings'
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

            <div className="grid grid-cols-1 gap-2">
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
                  onClick={() => setActiveActionModal({
                    title: 'Detail Kuota Anggota Paket Akrab',
                    action: 'detail_kuota_akrab',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP Anggota', placeholder: '08xxxx' },
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
                    <p className="text-[11px] text-gray-500">Cek saldo pulsa dan periode masa aktif kartu</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveActionModal({
                    title: 'Cek Pulsa & Masa Aktif',
                    action: 'cek_pulsa',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP XL / Axis', placeholder: '08xxxx' },
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
                  onClick={() => setActiveActionModal({
                    title: 'Cek Paket Aktif',
                    action: 'cek_paket_aktif',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP XL / Axis', placeholder: '08xxxx' },
                    ]
                  })}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cek
                </button>
              </div>

              {/* Pembelian Paket NO OTP */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Pembelian Paket NO OTP</h4>
                    <p className="text-[11px] text-gray-500">Tembak langsung tanpa kode OTP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveActionModal({
                    title: 'Pembelian Paket NO OTP',
                    action: 'beli_paket_no_otp',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP Tujuan', placeholder: '08xxxx' },
                      { name: 'package_id', label: 'ID Paket / Service Code', placeholder: 'Masukkan ID paket' },
                    ]
                  })}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Beli
                </button>
              </div>

              {/* Pembelian Paket DENGAN OTP */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Pembelian Paket dengan OTP</h4>
                    <p className="text-[11px] text-gray-500">Beli paket memerlukan verifikasi kode OTP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveActionModal({
                    title: 'Pembelian Paket dengan OTP',
                    action: 'beli_paket_otp',
                    category: 'public',
                    fields: [
                      { name: 'phone', label: 'Nomor HP Tujuan', placeholder: '08xxxx' },
                      { name: 'package_id', label: 'ID Paket / Service Code', placeholder: 'Masukkan ID paket' },
                      { name: 'otp', label: 'Kode OTP', placeholder: 'Kode verifikasi SMS' },
                    ]
                  })}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  Proses
                </button>
              </div>
            </div>
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
                  <p className="text-[10px] text-gray-500">Saldo akun KMSP</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveActionModal({
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
                onClick={() => setActiveActionModal({
                  title: 'Tambah Pengelola Paket Akrab',
                  action: 'tambah_pengelola',
                  category: 'akmt',
                  fields: [
                    { name: 'phone', label: 'Nomor HP Pengelola (Induk)', placeholder: '0817xxx' },
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
                onClick={() => setActiveActionModal({
                  title: 'Slot Anggota Pengelola Akrab',
                  action: 'slot_anggota',
                  category: 'akmt',
                  fields: [{ name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx' }]
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
                onClick={() => setActiveActionModal({
                  title: 'Invite / Ganti Anggota Akrab',
                  action: 'invite_anggota',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx' },
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
                onClick={() => setActiveActionModal({
                  title: 'Set Kuota Bersama (Kuber)',
                  action: 'set_kuber',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx' },
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
                onClick={() => setActiveActionModal({
                  title: 'Tendang / Kick Anggota Akrab',
                  action: 'kick_anggota',
                  category: 'akmt',
                  fields: [
                    { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx' },
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
              onClick={() => setActiveActionModal({
                title: 'Beli Slot Tambahan Paket Akrab',
                action: 'beli_slot_tambahan',
                category: 'akmt',
                fields: [
                  { name: 'parent_phone', label: 'Nomor Pengelola', placeholder: '08xxxx' },
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
                onClick={() => setActiveActionModal({
                  title: 'Request OTP',
                  action: 'request_otp',
                  category: 'tembak_paket',
                  fields: [{ name: 'phone', label: 'Nomor HP XL/AXIS', placeholder: '08xxxx' }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <Send className="w-5 h-5 text-indigo-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Request OTP</h4>
                <p className="text-[10px] text-gray-500">Kirim kode OTP ke nomor</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveActionModal({
                  title: 'Login OTP (Dapatkan Token)',
                  action: 'login_otp',
                  category: 'tembak_paket',
                  fields: [
                    { name: 'phone', label: 'Nomor HP XL/AXIS', placeholder: '08xxxx' },
                    { name: 'otp', label: 'Kode OTP', placeholder: 'Kode verifikasi' }
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
                onClick={() => setActiveActionModal({
                  title: 'Extend Session Login',
                  action: 'extend_session',
                  category: 'tembak_paket',
                  fields: [{ name: 'phone', label: 'Nomor HP atau Token', placeholder: '08xxxx' }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <RefreshCw className="w-5 h-5 text-amber-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Extend Session</h4>
                <p className="text-[10px] text-gray-500">Perpanjang sesi login</p>
              </button>

              <button
                type="button"
                onClick={() => handleExecute('tembak_paket', 'daftar_produk')}
                disabled={executing}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <PackageCheck className="w-5 h-5 text-teal-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Daftar Produk</h4>
                <p className="text-[10px] text-gray-500">Katalog paket XL/AXIS</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveActionModal({
                  title: 'Cek Stok Paket',
                  action: 'cek_stok_paket',
                  category: 'tembak_paket',
                  fields: [{ name: 'package_id', label: 'ID Paket', placeholder: 'ID paket tembak' }]
                })}
                className="p-3 bg-white border border-gray-200/90 rounded-2xl text-left hover:shadow-xs active:scale-98 transition-all"
              >
                <Radio className="w-5 h-5 text-cyan-600 mb-1.5" />
                <h4 className="font-bold text-xs text-gray-900">Cek Stok Paket</h4>
                <p className="text-[10px] text-gray-500">Ketersediaan kuota paket</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveActionModal({
                  title: 'Cek Lokasi / Area Nomor',
                  action: 'cek_lokasi',
                  category: 'tembak_paket',
                  fields: [{ name: 'phone', label: 'Nomor HP', placeholder: '08xxxx' }]
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
              onClick={() => setActiveActionModal({
                title: 'Unreg / Stop Paket Aktif',
                action: 'unreg_paket',
                category: 'tembak_paket',
                fields: [
                  { name: 'phone', label: 'Nomor HP', placeholder: '08xxxx' },
                  { name: 'package_id', label: 'ID Paket / Nama Paket', placeholder: 'ID paket yang distop' }
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
                <h3 className="font-bold text-xs text-gray-900">Hak Akses & Pengaturan KMSP</h3>
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
                  <label className="text-xs font-bold text-gray-700">KMSP API Key</label>
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
          {activeActionModal?.fields?.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-xs font-bold text-gray-700">{field.label}</label>
              <input
                type="text"
                required
                value={formData[field.name] || ''}
                onChange={(e) => setFormData((p) => ({ ...p, [field.name]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
