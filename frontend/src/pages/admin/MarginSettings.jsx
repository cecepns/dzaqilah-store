import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Percent, TrendingUp, Package, ShieldCheck, Sparkles } from 'lucide-react';
import Header from '../../components/layout/Header';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import WhatsAppIcon from '../../components/ui/WhatsAppIcon';
import { get, put, formatCurrency, getErrorMessage } from '../../utils/request';
import { API_ENDPOINTS } from '../../utils/endpoints';

const MarginSettings = () => {
  const [margin, setMargin] = useState('');
  const [currentMargin, setCurrentMargin] = useState(0);
  const [resellerMargin, setResellerMargin] = useState('');
  const [currentResellerMargin, setCurrentResellerMargin] = useState(0);
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWa, setSavingWa] = useState(false);

  const exampleModal = 10000;
  const previewMemberMargin = parseFloat(margin) || 0;
  const previewMemberSelling = Math.ceil(exampleModal + (exampleModal * previewMemberMargin) / 100);
  const previewMemberProfit = previewMemberSelling - exampleModal;

  const previewResellerMargin = parseFloat(resellerMargin) || 0;
  const previewResellerSelling = Math.ceil(exampleModal + (exampleModal * previewResellerMargin) / 100);
  const previewResellerProfit = previewResellerSelling - exampleModal;
  const previewResellerSavings = Math.max(0, previewMemberSelling - previewResellerSelling);

  useEffect(() => {
    Promise.all([
      get(API_ENDPOINTS.SETTINGS.MARGIN),
      get(API_ENDPOINTS.SETTINGS.WHATSAPP),
    ])
      .then(([marginRes, waRes]) => {
        const memMargin = marginRes.data.margin_percent ?? 5;
        const resMargin = marginRes.data.margin_reseller_percent ?? 2;
        setCurrentMargin(memMargin);
        setMargin(String(memMargin));
        setCurrentResellerMargin(resMargin);
        setResellerMargin(String(resMargin));
        setWhatsapp(waRes.data.admin_whatsapp || '');
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const memVal = parseFloat(margin);
    const resVal = parseFloat(resellerMargin);

    if (Number.isNaN(memVal) || memVal < 0 || memVal > 100) {
      toast.error('Margin member harus antara 0% - 100%');
      return;
    }
    if (Number.isNaN(resVal) || resVal < 0 || resVal > 100) {
      toast.error('Margin reseller harus antara 0% - 100%');
      return;
    }

    setSaving(true);
    try {
      const res = await put(API_ENDPOINTS.SETTINGS.MARGIN, {
        margin_percent: memVal,
        margin_reseller_percent: resVal,
      });
      setCurrentMargin(res.data.margin_percent);
      setCurrentResellerMargin(res.data.margin_reseller_percent);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    setSavingWa(true);
    try {
      const res = await put(API_ENDPOINTS.SETTINGS.WHATSAPP, { admin_whatsapp: whatsapp });
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingWa(false);
    }
  };

  return (
    <div>
      <Header title="Pengaturan Margin & Kontak" subtitle="Harga Member & Reseller" />

      <div className="px-4 -mt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <>
            {/* Quick Link to Product Margins */}
            <Link
              to="/admin/product-margins"
              className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">Margin Khusus Per Produk</p>
                <p className="text-xs text-indigo-700">Atur harga per SKU produk prabayar & pascabayar</p>
              </div>
            </Link>

            {/* Margin Member Card */}
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Percent className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Margin Member (Konsumen)</p>
                    <p className="text-2xl font-bold text-teal-600">{currentMargin}%</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  User Biasa
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Diterapkan otomatis untuk pengguna dengan role Member / Pengguna Biasa.
              </p>

              <label className="block text-xs font-medium text-gray-700 mb-1.5">Atur Margin Member (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={margin || 0}
                  onChange={(e) => setMargin(e.target.value)}
                  className="flex-1 accent-teal-600"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="w-20 px-3 py-2 border rounded-xl text-center text-sm font-bold text-teal-700"
                />
              </div>

              <div className="flex gap-1.5 mt-3 flex-wrap">
                {[3, 4, 5, 7, 10, 15].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMargin(String(preset))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      parseFloat(margin) === preset
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Margin Reseller Card */}
            <div className="bg-white border rounded-2xl p-4 shadow-sm border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Margin Reseller (Harga Khusus)</p>
                    <p className="text-2xl font-bold text-emerald-600">{currentResellerMargin}%</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Akun Reseller
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Diterapkan otomatis untuk pengguna dengan role Reseller. Lebih murah dibanding Member.
              </p>

              <label className="block text-xs font-medium text-gray-700 mb-1.5">Atur Margin Reseller (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={resellerMargin || 0}
                  onChange={(e) => setResellerMargin(e.target.value)}
                  className="flex-1 accent-emerald-600"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={resellerMargin}
                  onChange={(e) => setResellerMargin(e.target.value)}
                  className="w-20 px-3 py-2 border rounded-xl text-center text-sm font-bold text-emerald-700"
                />
              </div>

              <div className="flex gap-1.5 mt-3 flex-wrap">
                {[0, 1, 1.5, 2, 2.5, 3, 5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setResellerMargin(String(preset))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      parseFloat(resellerMargin) === preset
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison Simulation Card */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Simulasi Perbandingan Harga</h3>
              </div>

              <div className="bg-white rounded-xl p-3 border space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Contoh Modal Produk:</span>
                  <span className="font-semibold">{formatCurrency(exampleModal)}</span>
                </div>
                <div className="border-t pt-2 grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-100">
                    <p className="text-[11px] font-semibold text-teal-900 mb-1">Harga Member ({previewMemberMargin}%)</p>
                    <p className="text-base font-bold text-teal-700">{formatCurrency(previewMemberSelling)}</p>
                    <p className="text-[10px] text-teal-600 mt-0.5">Profit: +{formatCurrency(previewMemberProfit)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <p className="text-[11px] font-semibold text-emerald-900 mb-1">Harga Reseller ({previewResellerMargin}%)</p>
                    <p className="text-base font-bold text-emerald-700">{formatCurrency(previewResellerSelling)}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">Hemat: {formatCurrency(previewResellerSavings)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Margin Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center transition-colors shadow-sm"
            >
              {saving ? <LoadingSpinner size="sm" className="text-white" /> : 'Simpan Semua Margin'}
            </button>

            {/* WhatsApp Contact Section */}
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">WhatsApp Admin</p>
                  <p className="text-xs text-gray-500">Kontak chat bantuan & request topup saldo</p>
                </div>
              </div>

              <label className="block text-xs font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3 text-sm"
              />
              <p className="text-[11px] text-gray-500 mb-3">Format: 08xx atau 628xx. Tombol WhatsApp akan otomatis tampil di menu bantuan user.</p>

              <button
                onClick={handleSaveWhatsapp}
                disabled={savingWa}
                className="w-full bg-green-500 text-white py-2.5 rounded-xl font-medium hover:bg-green-600 disabled:opacity-60 flex items-center justify-center transition-colors"
              >
                {savingWa ? <LoadingSpinner size="sm" className="text-white" /> : 'Simpan WhatsApp'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarginSettings;
