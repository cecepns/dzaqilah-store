import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  KeyRound,
  Server,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Info,
  Lock,
  Webhook,
  Copy,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { get, put, post, getErrorMessage } from '../../utils/request';
import { API_BASE_URL, API_ENDPOINTS } from '../../utils/endpoints';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const ApiSettings = () => {
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingDigiflazz, setSavingDigiflazz] = useState(false);
  const [savingKmsp, setSavingKmsp] = useState(false);
  const [testingDigiflazz, setTestingDigiflazz] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Visibility toggles for keys during typing
  const [showDigiflazzKey, setShowDigiflazzKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showKmspKey, setShowKmspKey] = useState(false);
  const [showKmspWebhookSecret, setShowKmspWebhookSecret] = useState(false);

  // Stored status from server (masked for security)
  const [serverStatus, setServerStatus] = useState({
    digiflazz: {
      has_api_key: false,
      api_key_masked: '',
      has_webhook_secret: false,
      webhook_secret_masked: '',
    },
    kmsp: {
      has_api_key: false,
      api_key_masked: '',
      has_webhook_secret: false,
      webhook_secret_masked: '',
    },
  });

  // Digiflazz Form State (inputs start empty to prevent leaking or overwriting)
  const [digiflazzForm, setDigiflazzForm] = useState({
    username: '',
    api_key: '',
    testing: true,
    webhook_secret: '',
  });

  // KMSP Form State
  const [kmspForm, setKmspForm] = useState({
    api_key: '',
    base_url: 'https://my.kmsp-store.com',
    enable_member: false,
    enable_reseller: false,
    webhook_secret: '',
  });

  // Computed KMSP Callback URL
  const kmspCallbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = (API_BASE_URL && API_BASE_URL.startsWith('http'))
      ? API_BASE_URL
      : `${window.location.origin}${API_BASE_URL?.startsWith('/') ? '' : '/'}${API_BASE_URL || 'api'}`;
    return `${base.replace(/\/+$/, '')}${API_ENDPOINTS.KMSP.WEBHOOK}`;
  }, []);

  const handleCopyKmspCallbackUrl = () => {
    if (!kmspCallbackUrl) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(kmspCallbackUrl);
      toast.success('URL Callback KMSP berhasil disalin!');
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = kmspCallbackUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('URL Callback KMSP berhasil disalin!');
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.SETTINGS.PROVIDERS);
      if (res?.data) {
        const { digiflazz, kmsp } = res.data;
        if (digiflazz) {
          setServerStatus((prev) => ({
            ...prev,
            digiflazz: {
              has_api_key: Boolean(digiflazz.has_api_key),
              api_key_masked: digiflazz.api_key_masked || '',
              has_webhook_secret: Boolean(digiflazz.has_webhook_secret),
              webhook_secret_masked: digiflazz.webhook_secret_masked || '',
            },
          }));
          setDigiflazzForm({
            username: digiflazz.username || '',
            api_key: '', // Tetap kosong demi keamanan, diisi hanya jika ingin ganti
            testing: Boolean(digiflazz.testing),
            webhook_secret: '', // Tetap kosong demi keamanan
          });
        }
        if (kmsp) {
          setServerStatus((prev) => ({
            ...prev,
            kmsp: {
              has_api_key: Boolean(kmsp.has_api_key),
              api_key_masked: kmsp.api_key_masked || '',
              has_webhook_secret: Boolean(kmsp.has_webhook_secret),
              webhook_secret_masked: kmsp.webhook_secret_masked || '',
            },
          }));
          setKmspForm({
            api_key: '', // Tetap kosong demi keamanan
            base_url: kmsp.base_url || 'https://my.kmsp-store.com',
            enable_member: Boolean(kmsp.enable_member),
            enable_reseller: Boolean(kmsp.enable_reseller),
            webhook_secret: '',
          });
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveDigiflazz = async (e) => {
    e?.preventDefault();
    if (!digiflazzForm.username.trim()) {
      toast.error('Username Digiflazz wajib diisi');
      return;
    }

    if (!serverStatus.digiflazz.has_api_key && !digiflazzForm.api_key.trim()) {
      toast.error('API Key Digiflazz wajib diisi');
      return;
    }

    setSavingDigiflazz(true);
    try {
      const payload = {
        digiflazz_username: digiflazzForm.username.trim(),
        digiflazz_testing: digiflazzForm.testing,
      };

      if (digiflazzForm.api_key.trim()) {
        payload.digiflazz_api_key = digiflazzForm.api_key.trim();
      }
      if (digiflazzForm.webhook_secret.trim()) {
        payload.digiflazz_webhook_secret = digiflazzForm.webhook_secret.trim();
      }

      const res = await put(API_ENDPOINTS.SETTINGS.PROVIDERS, payload);
      if (res?.data?.digiflazz) {
        setServerStatus((prev) => ({
          ...prev,
          digiflazz: {
            has_api_key: Boolean(res.data.digiflazz.has_api_key),
            api_key_masked: res.data.digiflazz.api_key_masked || '',
            has_webhook_secret: Boolean(res.data.digiflazz.has_webhook_secret),
            webhook_secret_masked: res.data.digiflazz.webhook_secret_masked || '',
          },
        }));
        // Reset input field after save
        setDigiflazzForm((prev) => ({
          ...prev,
          api_key: '',
          webhook_secret: '',
        }));
      }

      toast.success('Pengaturan Digiflazz berhasil disimpan & cache diperbarui');
      setTestResult(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingDigiflazz(false);
    }
  };

  const handleSaveKmsp = async (e) => {
    e?.preventDefault();
    if (!serverStatus.kmsp.has_api_key && !kmspForm.api_key.trim()) {
      toast.error('API Key DZ STORE wajib diisi');
      return;
    }

    setSavingKmsp(true);
    try {
      const payload = {
        kmsp_base_url: kmspForm.base_url.trim() || 'https://my.kmsp-store.com',
        kmsp_enable_member: kmspForm.enable_member,
        kmsp_enable_reseller: kmspForm.enable_reseller,
      };

      if (kmspForm.api_key.trim()) {
        payload.kmsp_api_key = kmspForm.api_key.trim();
      }
      if (kmspForm.webhook_secret.trim()) {
        payload.kmsp_webhook_secret = kmspForm.webhook_secret.trim();
      }

      const res = await put(API_ENDPOINTS.SETTINGS.PROVIDERS, payload);
      if (res?.data?.kmsp) {
        setServerStatus((prev) => ({
          ...prev,
          kmsp: {
            has_api_key: Boolean(res.data.kmsp.has_api_key),
            api_key_masked: res.data.kmsp.api_key_masked || '',
            has_webhook_secret: Boolean(res.data.kmsp.has_webhook_secret),
            webhook_secret_masked: res.data.kmsp.webhook_secret_masked || '',
          },
        }));
        setKmspForm((prev) => ({
          ...prev,
          api_key: '',
          webhook_secret: '',
        }));
      }

      toast.success('Pengaturan DZ STORE berhasil disimpan');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingKmsp(false);
    }
  };

  const handleTestDigiflazz = async () => {
    setTestingDigiflazz(true);
    setTestResult(null);
    try {
      const payload = {};
      if (digiflazzForm.username && digiflazzForm.username.trim()) {
        payload.username = digiflazzForm.username.trim();
      }
      if (digiflazzForm.api_key && digiflazzForm.api_key.trim()) {
        payload.api_key = digiflazzForm.api_key.trim();
      }

      const res = await post(API_ENDPOINTS.SETTINGS.TEST_DIGIFLAZZ, payload);
      setTestResult({
        success: true,
        message: res.message || 'Koneksi ke Digiflazz berhasil!',
        data: res.data,
      });
      toast.success(res.message || 'Koneksi Digiflazz Berhasil!');
    } catch (err) {
      const msg = getErrorMessage(err);
      setTestResult({
        success: false,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setTestingDigiflazz(false);
    }
  };


  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-sm border border-red-100">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-gray-900">Akses Ditolak</h2>
          <p className="text-xs text-gray-500 mt-1">Hanya Owner utama yang memiliki hak akses untuk mengelola kunci API provider.</p>
          <Link
            to="/profil"
            className="mt-4 inline-block px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200"
          >
            Kembali ke Profil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header
        title="Kelola API & Provider"
        subtitle="Manajemen API Key Digiflazz & DZ STORE (Owner Only)"
      />

      <div className="max-w-mobile mx-auto px-4 pt-4 space-y-5">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Top Security Banner Notice */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950 leading-relaxed">
                <p className="font-bold text-emerald-950">Proteksi Kunci API Maksimal (End-to-End Secure)</p>
                <p className="text-[11px] text-emerald-800/90 mt-0.5">
                  Demi keamanan dari risiko pencurian/inspeksi, response API backend <strong>tidak pernah menampilkan kunci API dalam bentuk teks asli</strong>. Kunci tersimpan diamankan dengan masking dan hanya diperbarui jika Anda memasukkan kunci baru.
                </p>
              </div>
            </div>

            {/* ─── Digiflazz Section ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Server className="w-5 h-5 text-white" />
                  <div>
                    <h2 className="text-sm font-bold leading-tight">Digiflazz PPOB & Pulsa</h2>
                    <p className="text-[11px] text-teal-100">Provider utama pulsa, paket data, PLN, & e-money</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    digiflazzForm.testing
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-emerald-400 text-emerald-950'
                  }`}
                >
                  {digiflazzForm.testing ? 'DEV / TESTING' : 'PRODUCTION'}
                </span>
              </div>

              <form onSubmit={handleSaveDigiflazz} className="p-4 space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Username Digiflazz <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={digiflazzForm.username}
                    onChange={(e) => setDigiflazzForm({ ...digiflazzForm, username: e.target.value })}
                    placeholder="Contoh: tovowaWjYdvD"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Sesuai username akun di dashboard Digiflazz</p>
                </div>

                {/* API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      API Key / Secret Key <span className="text-red-500">*</span>
                    </label>
                    {serverStatus.digiflazz.has_api_key ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Tersimpan: {serverStatus.digiflazz.api_key_masked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Belum Diatur
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showDigiflazzKey ? 'text' : 'password'}
                      value={digiflazzForm.api_key}
                      onChange={(e) => setDigiflazzForm({ ...digiflazzForm, api_key: e.target.value })}
                      placeholder={
                        serverStatus.digiflazz.has_api_key
                          ? 'Kosongkan jika tidak ingin mengubah kunci tersimpan'
                          : 'Masukkan API Key Digiflazz baru'
                      }
                      className="w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono placeholder:text-gray-400 placeholder:text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDigiflazzKey(!showDigiflazzKey)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showDigiflazzKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {serverStatus.digiflazz.has_api_key
                      ? 'Kunci API aman tersimpan di server. Ketik kunci baru di atas hanya jika Anda ingin menggantinya.'
                      : 'Gunakan Development Key saat mode sandbox aktif, atau Production Key untuk transaksi riil.'}
                  </p>
                </div>

                {/* Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Webhook Secret Key
                    </label>
                    {serverStatus.digiflazz.has_webhook_secret ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Tersimpan: {serverStatus.digiflazz.webhook_secret_masked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        Belum diatur
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={digiflazzForm.webhook_secret}
                      onChange={(e) => setDigiflazzForm({ ...digiflazzForm, webhook_secret: e.target.value })}
                      placeholder={
                        serverStatus.digiflazz.has_webhook_secret
                          ? 'Kosongkan jika tidak ingin mengubah webhook secret'
                          : 'Masukkan Webhook Secret Key'
                      }
                      className="w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono placeholder:text-gray-400 placeholder:text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Dipakai untuk validasi signature webhook Digiflazz di <code>/api/webhooks/digiflazz</code>.
                  </p>
                </div>

                {/* Testing Mode Toggle */}
                <div className="pt-1">
                  <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={digiflazzForm.testing}
                      onChange={(e) => setDigiflazzForm({ ...digiflazzForm, testing: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-gray-800 block">Aktifkan Mode Testing / Sandbox</span>
                      <span className="text-[11px] text-gray-500 block mt-0.5">
                        Saat aktif, transaksi menggunakan API key sandbox/development dan tidak memotong saldo riil Digiflazz.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Test Connection Result Box */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{testResult.message}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestDigiflazz}
                    disabled={testingDigiflazz || savingDigiflazz}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingDigiflazz ? 'animate-spin' : ''}`} />
                    {testingDigiflazz ? 'Mengecek...' : 'Tes Saldo Digiflazz'}
                  </button>

                  <button
                    type="submit"
                    disabled={savingDigiflazz}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl text-xs font-bold hover:from-teal-700 hover:to-cyan-700 transition-all disabled:opacity-50 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingDigiflazz ? 'Menyimpan...' : 'Simpan Digiflazz'}
                  </button>
                </div>
              </form>
            </div>

            {/* ─── DZ STORE Section ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-5 h-5 text-white" />
                  <div>
                    <h2 className="text-sm font-bold leading-tight">DZ STORE API</h2>
                    <p className="text-[11px] text-blue-100">AKMT & Tembak Paket Data XL / Axis</p>
                  </div>
                </div>
                <Link
                  to="/dz-tools"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] font-semibold transition-colors"
                >
                  Buka Layanan DZ STORE
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <form onSubmit={handleSaveKmsp} className="p-4 space-y-4">
                {/* Base URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Base URL API DZ STORE
                  </label>
                  <input
                    type="text"
                    value={kmspForm.base_url}
                    onChange={(e) => setKmspForm({ ...kmspForm, base_url: e.target.value })}
                    placeholder="https://my.kmsp-store.com"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-700"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Default resmi: <code>https://my.kmsp-store.com</code></p>
                </div>

                {/* API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      API Key DZ STORE <span className="text-red-500">*</span>
                    </label>
                    {serverStatus.kmsp.has_api_key ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Tersimpan: {serverStatus.kmsp.api_key_masked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Belum Diatur
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showKmspKey ? 'text' : 'password'}
                      value={kmspForm.api_key}
                      onChange={(e) => setKmspForm({ ...kmspForm, api_key: e.target.value })}
                      placeholder={
                        serverStatus.kmsp.has_api_key
                          ? 'Kosongkan jika tidak ingin mengubah API key DZ STORE tersimpan'
                          : 'Masukkan API Key DZ STORE baru'
                      }
                      className="w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400 placeholder:text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKmspKey(!showKmspKey)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showKmspKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {serverStatus.kmsp.has_api_key
                      ? 'Kunci API DZ STORE tersimpan aman di server database. Ketik kunci baru hanya jika Anda ingin memperbarui.'
                      : 'Kunci rahasia API provider untuk transaksi dan cek kuota/saldo.'}
                  </p>
                </div>

                {/* Webhook / Callback URL KMSP */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border border-blue-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-blue-700" />
                      <span className="text-xs font-bold text-blue-950">URL Callback / Webhook KMSP</span>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      Otomatis
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Daftarkan URL callback ini di panel KMSP / CS KMSP agar status order paket otomatis terupdate secara realtime (termasuk auto refund saldo jika transaksi gagal).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={kmspCallbackUrl}
                      className="flex-1 text-xs font-mono p-2.5 rounded-xl border border-blue-300 bg-white text-gray-800 select-all font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleCopyKmspCallbackUrl}
                      className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Salin URL
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 font-mono">
                    Menerima respon detail transaksi KMSP: Status 1 (Sukses), Status 2 (Pending), Status 0 (Gagal & Auto Refund).
                  </p>
                </div>

                {/* Optional Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Webhook Secret Key KMSP (Opsional)
                    </label>
                    {serverStatus.kmsp.has_webhook_secret ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Tersimpan: {serverStatus.kmsp.webhook_secret_masked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        Belum diatur (opsional)
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showKmspWebhookSecret ? 'text' : 'password'}
                      value={kmspForm.webhook_secret}
                      onChange={(e) => setKmspForm({ ...kmspForm, webhook_secret: e.target.value })}
                      placeholder={
                        serverStatus.kmsp.has_webhook_secret
                          ? 'Kosongkan jika tidak ingin mengubah webhook secret tersimpan'
                          : 'Kunci secret verifikasi webhook KMSP (jika ada)'
                      }
                      className="w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:text-gray-400 placeholder:text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKmspWebhookSecret(!showKmspWebhookSecret)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showKmspWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Digunakan jika KMSP mengirimkan secret token pengaman pada request callback webhook.
                  </p>
                </div>

                {/* Permission Toggles */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-gray-800">Izin Akses Fitur AKMT & Tembak Paket:</p>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={kmspForm.enable_member}
                      onChange={(e) => setKmspForm({ ...kmspForm, enable_member: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-gray-800 block">Izinkan Role Member (Pengguna Biasa)</span>
                      <span className="text-[11px] text-gray-500 block">
                        Jika dicentang, Member dapat melihat tab AKMT & Tembak Paket DZ STORE.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={kmspForm.enable_reseller}
                      onChange={(e) => setKmspForm({ ...kmspForm, enable_reseller: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-gray-800 block">Izinkan Role Reseller Prioritas</span>
                      <span className="text-[11px] text-gray-500 block">
                        Jika dicentang, Reseller dapat menggunakan AKMT & Tembak Paket secara mandiri.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingKmsp}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingKmsp ? 'Menyimpan...' : 'Simpan Kredensial DZ STORE'}
                  </button>
                </div>
              </form>
            </div>

            {/* Security Architecture Info Box */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2 font-bold text-gray-800">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Arsitektur Keamanan API Provider</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-600">
                <li>
                  <strong>Tersimpan di Server (Server-Side Secret):</strong> Kunci API hanya diproses di backend dan dienkripsi saat berkomunikasi dengan server Digiflazz dan DZ STORE.
                </li>
                <li>
                  <strong>Masking Otomatis:</strong> Di sisi browser, kredensial disamarkan (contoh: <code>86a9••••••••b7ed</code>) sehingga tidak dapat dibaca dari inspect element atau console log.
                </li>
                <li>
                  <strong>Proteksi Role Owner:</strong> Endpoint konfigurasi dilindungi dengan middleware otorisasi <code>authorize('owner')</code>, menolak akses user biasa, reseller, maupun admin.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApiSettings;
