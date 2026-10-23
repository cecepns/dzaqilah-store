import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  WalletCards,
  RotateCw,
  Menu,
  Bell,
  Coins,
  Award,
  PlusCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Sparkles,
  Smartphone,
  Wifi,
  PhoneCall,
  Zap,
  Globe,
  Ticket,
  Gamepad2,
  Receipt,
  Droplets,
  HeartPulse,
  Users,
  Percent,
  History,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Megaphone,
  HelpCircle,
  ShieldCheck,
  BellOff,
  X,
  ExternalLink,
  Radio,
  KeyRound,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { get, formatCurrency, getErrorMessage } from '../utils/request';
import { API_ENDPOINTS, API_BASE_URL } from '../utils/endpoints';
import { SERVICES } from '../constants/services';
import OperatorPhoneInput from '../components/ui/OperatorPhoneInput';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import WhatsAppIcon from '../components/ui/WhatsAppIcon';

const DEFAULT_BANNERS = [
  {
    id: 'banner-qris',
    title: 'QRIS Static Untuk Usahamu',
    subtitle: 'MDR 0% & Pencairan Realtime',
    image_url: '/banners/promo_qris.jpg',
    action_url: '/request-topup',
    badge: 'Fitur Unggulan',
    show_text: 1,
  },
  {
    id: 'banner-pulsa',
    title: 'Pulsa & Paket Data Termurah',
    subtitle: 'Semua Operator Kilat 24 Jam',
    image_url: '/banners/promo_pulsa.jpg',
    action_url: '/layanan/pulsa',
    badge: 'Diskon Spesial',
    show_text: 1,
  },
];

const parseAnnouncement = (data) => {
  if (!data) return { text: '', isActive: false };
  const text = (data.text ?? data.announcement_text ?? '').toString();
  const rawActive = data.is_active ?? data.announcement_active;
  const isActive =
    rawActive === true ||
    rawActive === 1 ||
    rawActive === '1' ||
    rawActive === 'true' ||
    (rawActive === undefined && Boolean(text.trim()));
  return { text, isActive };
};

const resolveImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads')) {
    const origin = (API_BASE_URL || '').replace(/\/api\/?$/, '') || 'http://localhost:5000';
    return `${origin}${path}`;
  }
  return path;
};

const Home = () => {
  const { user, isAdmin, isOwner, isReseller, roleLabel, roleTitle, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceCounts, setServiceCounts] = useState({});
  const [showBalance, setShowBalance] = useState(true);

  // Quick pulsa / data phone input
  const [quickPhone, setQuickPhone] = useState('');
  const [detectedOperator, setDetectedOperator] = useState(null);

  // Banner & announcement dynamic states
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [announcement, setAnnouncement] = useState({
    text: '',
    isActive: false,
  });

  // Banner carousel state
  const [currentBanner, setCurrentBanner] = useState(0);

  // Header tab navigation & modals
  const [activeTab, setActiveTab] = useState('transaksi');
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [contactData, setContactData] = useState(null);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, servicesRes, announcementRes, bannersRes] = await Promise.all([
        get(API_ENDPOINTS.DASHBOARD.STATS).catch(() => ({ data: null })),
        get(API_ENDPOINTS.PRODUCTS.SERVICES).catch(() => ({ data: [] })),
        get(API_ENDPOINTS.SETTINGS.ANNOUNCEMENT).catch(() => null),
        get(API_ENDPOINTS.BANNERS.LIST).catch(() => null),
        refreshProfile().catch(() => null),
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (servicesRes?.data) {
        const map = {};
        servicesRes.data.forEach((item) => {
          map[item.id] = item.total;
        });
        setServiceCounts(map);
      }
      if (announcementRes?.data) {
        setAnnouncement(parseAnnouncement(announcementRes.data));
      }
      if (Array.isArray(bannersRes?.data) && bannersRes.data.length > 0) {
        setBanners(bannersRes.data);
      }

      if (isManual) {
        await refreshProfile();
        toast.success('Data saldo & layanan berhasil diperbarui');
      }
    } catch (err) {
      if (isManual) toast.error('Gagal memperbarui data');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Fetch contact info
    get(API_ENDPOINTS.SETTINGS.CONTACT)
      .then((res) => setContactData(res.data))
      .catch(() => { });
  }, []);

  // Auto slide banners every 4.5 seconds
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'menu-agen') setIsAgentMenuOpen(true);
    if (tab === 'hubungi-kami') setIsContactOpen(true);
    if (tab === 'panduan') setIsGuideOpen(true);
  };

  const handleProceedWithPhone = (serviceType) => {
    const targetService = serviceType === 'data' ? 'data' : 'pulsa';
    if (quickPhone) {
      navigate(`/layanan/${targetService}?phone=${encodeURIComponent(quickPhone)}`);
    } else {
      navigate(`/layanan/${targetService}`);
    }
  };

  const adminActions = [
    { to: '/admin/users', icon: Users, label: 'Kelola Users', color: 'from-purple-500 to-indigo-600' },
    { to: '/admin/topup-requests', icon: PlusCircle, label: 'Request Topup', color: 'from-emerald-500 to-teal-600' },
    { to: '/admin/rekening', icon: CreditCard, label: 'Rekening Topup', color: 'from-blue-600 to-indigo-700' },
    { to: '/admin/saldo', icon: WalletCards, label: 'Topup Saldo', color: 'from-green-500 to-emerald-600' },
    { to: '/admin/banners', icon: Megaphone, label: 'Banner & Pengumuman', color: 'from-pink-500 to-rose-600' },
    { to: '/admin/logs', icon: History, label: 'Log Aktivitas', color: 'from-amber-500 to-orange-600' },
    { to: '/admin/margin', icon: Percent, label: 'Pengaturan', color: 'from-blue-500 to-cyan-600' },
    { to: '/admin/product-margins', icon: Percent, label: 'Margin Produk', color: 'from-rose-500 to-pink-600' },
    { to: '/dz-tools', icon: Radio, label: 'DZ Store Paket Akrab', color: 'from-cyan-600 to-blue-700' },
    ...(isOwner ? [{ to: '/admin/api-settings', icon: KeyRound, label: 'Kelola API Provider', color: 'from-violet-600 to-purple-800' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* ─── Top Header (Teal / Deep Cyan Branding) ─── */}
      <header className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-mobile mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
                title="Menu"
              >
                <Menu className="w-5 h-5 stroke-[2.2]" />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-base tracking-wide uppercase drop-shadow-xs">
                    DZAQILAH CELL
                  </h1>
                </div>
                <p className="text-[10px] text-teal-200">
                  {user?.name || 'Agen Resmi'} • {roleTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white disabled:opacity-50"
                title="Refresh Saldo & Produk"
              >
                <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationOpen(true)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white relative inline-flex items-center justify-center"
                title="Papan Pengumuman & Notifikasi"
              >
                <Bell className="w-4 h-4" />
                {announcement?.isActive && Boolean(announcement?.text?.trim()) && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 ring-2 ring-teal-800" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Orange / Coral Sub-tabs Bar (Matching PROPANA Image) ─── */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 border-t border-orange-400/40 shadow-inner">
          <div className="max-w-mobile mx-auto flex items-center justify-between px-2 text-xs font-bold text-white tracking-wide overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveTab('transaksi')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 whitespace-nowrap transition-all ${activeTab === 'transaksi'
                ? 'border-white bg-white/15 text-white'
                : 'border-transparent text-white/85 hover:text-white'
                }`}
            >
              TRANSAKSI
            </button>
            <div className="w-[1px] h-4 bg-white/30" />
            <button
              type="button"
              onClick={() => handleTabClick('hubungi-kami')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 whitespace-nowrap transition-all ${activeTab === 'hubungi-kami'
                ? 'border-white bg-white/15 text-white'
                : 'border-transparent text-white/85 hover:text-white'
                }`}
            >
              HUBUNGI KAMI
            </button>
            <div className="w-[1px] h-4 bg-white/30" />
            <button
              type="button"
              onClick={() => handleTabClick('panduan')}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 whitespace-nowrap transition-all ${activeTab === 'panduan'
                ? 'border-white bg-white/15 text-white'
                : 'border-transparent text-white/85 hover:text-white'
                }`}
            >
              PANDUAN
            </button>
          </div>
        </div>

        {/* ─── Running Announcement Ticker (Marquee Strip) ─── */}
        {announcement?.isActive && Boolean(announcement?.text?.trim()) && (
          <div
            onClick={() => setIsNotificationOpen(true)}
            className="bg-teal-900/90 py-1.5 px-3 border-t border-teal-800/80 flex items-center gap-2 overflow-hidden text-[11px] text-teal-100 font-medium cursor-pointer hover:bg-teal-950 transition-colors select-none"
            title="Klik untuk baca papan pengumuman lengkap"
          >
            <div className="flex-shrink-0 flex items-center gap-1 text-orange-300 font-bold bg-teal-800/80 px-1.5 py-0.5 rounded text-[10px]">
              <Megaphone className="w-3 h-3 text-orange-400" />
              <span>INFO</span>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <span className="animate-marquee inline-block">
                {announcement.text}
              </span>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-mobile mx-auto px-3.5 pt-3 space-y-3.5">
        {/* ─── Card Kredit Anda (Saldo Card matching PROPANA layout) ─── */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
          {/* Card Top Row: Kredit Anda & Saldo */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50/60 to-cyan-50/40 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-2 text-teal-900">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <WalletCards className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-700 tracking-wide uppercase">
                Kredit Anda
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 text-gray-400 hover:text-teal-700 transition-colors"
                title={showBalance ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
              >
                {showBalance ? <Eye className="w-4 h-4 text-teal-600" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <span className="text-lg font-extrabold text-teal-700 tracking-tight">
                {showBalance ? formatCurrency(user?.balance) : 'Rp ••••••'}
              </span>
            </div>
          </div>

          {/* Card Bottom 3 Columns: Komisi, Poin/Level, + Kredit */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 text-center py-2.5 bg-white">
            <div className="px-2 py-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-teal-600 mb-0.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold text-xs text-gray-900">0</span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">Komisi</span>
            </div>

            <div className="px-2 py-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-teal-600 mb-0.5">
                <Award className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-bold text-xs text-gray-900">
                  {roleLabel}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">Level Agen</span>
            </div>

            <Link
              to="/request-topup"
              className="px-2 py-1 flex flex-col items-center justify-center hover:bg-teal-50 active:scale-95 transition-all group"
            >
              <div className="flex items-center gap-1 text-teal-600 mb-0.5">
                <PlusCircle className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-teal-700">+ Kredit</span>
              </div>
              <span className="text-[10px] text-teal-600 font-medium">Topup Saldo</span>
            </Link>
          </div>
        </div>

        {/* ─── Banner Carousel (Promo Slider) ─── */}
        {banners.length > 0 && (
          <div className="relative isolate rounded-2xl overflow-hidden shadow-sm border border-gray-200/80 bg-slate-900 aspect-[16/9] group">
            {banners.map((banner, index) => {
              const hasText = banner.show_text !== false && banner.show_text !== 0 && (banner.title || banner.subtitle || banner.description || banner.badge);
              const title = banner.title;
              const subtitle = banner.subtitle || banner.description;
              const badge = banner.badge;
              const imageUrl = resolveImageUrl(banner.image_url || banner.image);
              const actionTo = banner.action_url || banner.actionTo;

              return (
                <div
                  key={banner.id || index}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
                    }`}
                >
                  <img
                    src={imageUrl}
                    alt={title || 'Promo Banner'}
                    className="w-full h-full object-cover"
                  />
                  {hasText && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3.5">
                      {badge && (
                        <span className="inline-block self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-xs mb-1">
                          {badge}
                        </span>
                      )}
                      {title && (
                        <p className="text-white font-extrabold text-sm drop-shadow-md leading-tight">
                          {title}
                        </p>
                      )}
                      {subtitle && (
                        <p className="text-white/80 text-[11px] drop-shadow-sm mt-0.5 line-clamp-1">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  )}
                  {actionTo && (
                    actionTo.startsWith('http') ? (
                      <a
                        href={actionTo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-20"
                        aria-label={title || 'Promo Banner'}
                      />
                    ) : (
                      <Link
                        to={actionTo}
                        className="absolute inset-0 z-20"
                        aria-label={title || 'Promo Banner'}
                      />
                    )
                  )}
                </div>
              );
            })}

            {/* Carousel Dot Indicators */}
            {banners.length > 1 && (
              <div className="absolute bottom-2 right-3 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-full">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentBanner(i)}
                    className={`h-1.5 rounded-full transition-all ${i === currentBanner ? 'w-4 bg-orange-400' : 'w-1.5 bg-white/60'
                      }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Auto-Detect Operator Quick Widget (Client Feature #1) ─── */}
        <div className="bg-white rounded-2xl border border-teal-100 p-3.5 shadow-xs relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-teal-50 rounded-full pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                Isi Pulsa & Paket Data Cepat
              </h2>
            </div>
          </div>

          <OperatorPhoneInput
            value={quickPhone}
            onChange={setQuickPhone}
            onOperatorChange={setDetectedOperator}
            placeholder="Ketik nomor HP (contoh: 08123456...)"
          />

          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => handleProceedWithPhone('pulsa')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-bold shadow-xs active:scale-98 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Beli Pulsa</span>
            </button>
            <button
              type="button"
              onClick={() => handleProceedWithPhone('data')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold shadow-xs active:scale-98 transition-all"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Beli Paket Data</span>
            </button>
          </div>
        </div>

        {/* ─── Menu Utama Ribbon (Matching Image Badge) ─── */}
        <div className="bg-gradient-to-r from-teal-700 via-cyan-700 to-teal-800 rounded-xl p-2.5 px-3.5 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-orange-300" />
            </div>
            <div>
              <p className="text-xs font-extrabold tracking-wide uppercase">Menu Utama</p>
              <p className="text-[10px] text-teal-100">Pilih layanan PPOB & isi ulang</p>
            </div>
          </div>
          <Link
            to="/layanan"
            className="flex items-center gap-1 text-[11px] font-bold text-orange-200 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span>Semua</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ─── Main Services Grid (Squircle Vibrant Icons, ZERO EMOJIS) ─── */}
        <div className="grid grid-cols-4 gap-2.5">
          {SERVICES.map(({ id, label, icon: Icon, color, badge, lightBg }) => {
            const isPhoneFlow = id === 'pulsa' || id === 'data';
            const targetUrl = isPhoneFlow && quickPhone
              ? `/layanan/${id}?phone=${encodeURIComponent(quickPhone)}`
              : `/layanan/${id}`;

            return (
              <Link
                key={id}
                to={targetUrl}
                className="bg-white border border-gray-100 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-xs hover:shadow-md hover:border-teal-200 active:scale-95 transition-all group"
              >
                {/* Squircle Icon Container with Badge */}
                <div className="relative mb-1.5">
                  <div
                    className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-white shadow-md shadow-gray-200 group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-6 h-6 stroke-[2]" />
                  </div>
                  {badge && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-black tracking-tight px-1 py-0.2 rounded bg-gray-900 text-white shadow-xs">
                      {badge}
                    </span>
                  )}
                </div>

                <span className="text-[11px] font-semibold text-gray-800 leading-tight group-hover:text-teal-700 transition-colors line-clamp-1">
                  {label}
                </span>

                {serviceCounts[id] !== undefined && (
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    {serviceCounts[id]} item
                  </span>
                )}
              </Link>
            );
          })}

          {/* Menu Cek XL & Axis in Grid (Semua Role User) */}
          <a
            href="https://xl-ku.my.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-blue-100 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-xs hover:shadow-md hover:border-blue-300 active:scale-95 transition-all group"
          >
            <div className="relative mb-1.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-100 group-hover:scale-105 transition-transform">
                <Globe className="w-6 h-6 stroke-[2]" />
              </div>
              <span className="absolute -top-1 -right-1 text-[8px] font-black tracking-tight px-1 py-0.2 rounded bg-amber-400 text-gray-900 shadow-xs">
                CEK
              </span>
            </div>
            <span className="text-[11px] font-semibold text-gray-800 leading-tight group-hover:text-blue-700 transition-colors line-clamp-1">
              Cek XL/Axis
            </span>
            <span className="text-[9px] text-blue-600 font-medium mt-0.5">
              Cek Area
            </span>
          </a>

          {/* Menu Paket Akrab & Injeksi (DZ Tools) */}
          <Link
            to="/dz-tools"
            className="bg-white border border-teal-100 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-xs hover:shadow-md hover:border-teal-300 active:scale-95 transition-all group"
          >
            <div className="relative mb-1.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-700 to-cyan-800 flex items-center justify-center text-white shadow-md shadow-teal-100 group-hover:scale-105 transition-transform">
                <Radio className="w-6 h-6 stroke-[2]" />
              </div>
              <span className="absolute -top-1 -right-1 text-[8px] font-black tracking-tight px-1 py-0.2 rounded bg-teal-500 text-white shadow-xs">
                AKRAB
              </span>
            </div>
            <span className="text-[11px] font-semibold text-gray-800 leading-tight group-hover:text-teal-700 transition-colors line-clamp-1">
              Paket Akrab
            </span>
            <span className="text-[9px] text-teal-600 font-medium mt-0.5">
              Injeksi & AKMT
            </span>
          </Link>
        </div>

        {/* ─── Banner Tool Cek Paket & Area XL / Axis (Semua Role User) ─── */}
        <a
          href="https://xl-ku.my.id/"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm hover:shadow-md border border-blue-500/30 active:scale-[0.99] transition-all group relative overflow-hidden"
        >
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-12 top-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            {/* Icon */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform border border-white/10">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">
                  Cek Paket & Area XL / Axis
                </h3>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black tracking-wider uppercase whitespace-nowrap shadow-xs">
                  Alat Cek
                </span>
              </div>
              <p className="text-[11px] text-blue-200/90 mt-1 leading-snug line-clamp-2">
                Cek sisa kuota, paket aktif, masa aktif & cek area nomor XL & Axis tanpa login.
              </p>
            </div>

            {/* Action button */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 group-hover:bg-white/20 text-white text-xs font-bold flex-shrink-0 transition-colors border border-white/10 shadow-xs">
              <span>Buka</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
            </div>
          </div>
        </a>

        {/* ─── Admin Management Panel (If User is Admin/Owner) ─── */}
        {isAdmin && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <h2 className="font-bold text-xs text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Panel Admin
              </h2>
              <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">
                Khusus Admin
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {adminActions.map(({ to, icon: Icon, label, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2.5 bg-white border border-gray-200/90 rounded-2xl p-3 hover:shadow-md hover:border-purple-200 active:scale-98 transition-all shadow-xs"
                >
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${color} flex items-center justify-center text-white flex-shrink-0 shadow-xs`}
                  >
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 leading-tight">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal Menu Agen ─── */}
      <Modal
        isOpen={isAgentMenuOpen}
        onClose={() => setIsAgentMenuOpen(false)}
        title="Menu & Keuntungan Agen"
      >
        <div className="space-y-3.5">
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="w-5 h-5 text-teal-700" />
              <h3 className="font-bold text-teal-950 text-sm">Status: {roleTitle}</h3>
            </div>
            <p className="text-xs text-teal-800 leading-relaxed">
              {isReseller
                ? 'Akun Anda mendapatkan potongan harga khusus reseller secara otomatis untuk setiap transaksi pulsa, paket data, dan tagihan bulanan.'
                : 'Tingkatkan status akun Anda menjadi Reseller untuk mendapatkan margin keuntungan lebih besar dan harga modal paling kompetitif.'}
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-gray-600 font-medium">Komisi Transaksi</span>
              <span className="font-bold text-gray-900">Rp 0 (Otomatis masuk)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-gray-600 font-medium">Kecepatan Transaksi</span>
              <span className="font-bold text-teal-600">Realtime 1 - 5 Detik</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <WhatsAppIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-gray-600 font-medium">Bantuan CS WhatsApp</span>
              </div>
              <span className="font-bold text-emerald-600">24 Jam Standby</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAgentMenuOpen(false);
              setIsContactOpen(true);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <WhatsAppIcon className="w-5 h-5 flex-shrink-0" />
            <span>Hubungi Admin untuk Upgrade Reseller</span>
          </button>
        </div>
      </Modal>

      {/* ─── Modal Pengumuman (Notifikasi) ─── */}
      <Modal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title="Pengumuman & Informasi"
      >
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs border border-teal-100">
              <Megaphone className="w-7 h-7 text-teal-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Papan Pengumuman Agen</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Informasi penting, jadwal pemeliharaan server, dan update promo dari Dzaqilah Cell.
            </p>
          </div>

          {announcement?.isActive && announcement?.text?.trim() ? (
            <div className="bg-gradient-to-br from-teal-50/90 to-cyan-50/70 border border-teal-200/90 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-teal-100">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-700 text-white shadow-2xs">
                  <Megaphone className="w-3 h-3 text-orange-300" />
                  PENGUMUMAN RESMI
                </span>
                <span className="text-[10px] text-teal-700 font-semibold bg-teal-100/80 px-2 py-0.5 rounded-md">
                  Aktif
                </span>
              </div>
              <p className="text-xs text-gray-800 leading-relaxed font-medium whitespace-pre-line">
                {announcement.text}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center bg-gray-50/80 rounded-2xl border border-gray-100 p-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 text-gray-400">
                <BellOff className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-700">Belum ada pengumuman</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Saat ini belum ada pengumuman terbaru dari admin. Semua sistem dan transaksi beroperasi normal.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsNotificationOpen(false)}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 font-bold rounded-xl text-xs transition-all"
          >
            Tutup
          </button>
        </div>
      </Modal>

      {/* ─── Modal Hubungi Kami ─── */}
      <Modal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        title="Hubungi Customer Service"
      >
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs border border-emerald-100">
              <WhatsAppIcon className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Butuh Bantuan Transaksi?</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Tim support kami siap membantu kendala deposit, transaksi tertunda, atau pendaftaran reseller.
            </p>
          </div>

          {contactData?.whatsapp_url ? (
            <a
              href={contactData.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2.5"
            >
              <WhatsAppIcon className="w-5 h-5 flex-shrink-0" />
              <span>Chat WhatsApp Customer Service</span>
            </a>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-center">
              Nomor WhatsApp admin belum dikonfigurasi. Silakan hubungi admin aplikasi.
            </div>
          )}

          <div className="text-center text-[11px] text-gray-400">
            Jam Layanan CS: Setiap Hari (07.00 - 23.00 WIB)
          </div>
        </div>
      </Modal>

      {/* ─── Modal Panduan ─── */}
      <Modal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title="Panduan Transaksi Agen"
      >
        <div className="space-y-3 text-xs text-gray-700">
          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-teal-800 text-xs">1. Cara Isi Pulsa / Paket Data:</p>
            <p className="text-[11px] text-gray-600">
              Ketik nomor HP pada kolom "Isi Pulsa Cepat". Sistem akan otomatis mendeteksi operator Anda (Telkomsel, Indosat, XL, dll). Pilih nominal pulsa atau paket data, lalu konfirmasi pembayaran.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-teal-800 text-xs">2. Cara Topup / Tambah Saldo:</p>
            <p className="text-[11px] text-gray-600">
              Klik menu "+ Kredit" atau tombol QRIS di tengah navigasi bawah. Masukkan nominal topup, pilih metode bayar QRIS atau Transfer Bank, lalu lakukan pembayaran.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-teal-800 text-xs">3. Cek Riwayat & SN Transaksi:</p>
            <p className="text-[11px] text-gray-600">
              Buka menu "Riwayat" di navigasi bawah untuk mencetak struk transaksi atau melihat Serial Number (SN) pulsa dan token PLN.
            </p>
          </div>
        </div>
      </Modal>

      {/* ─── Side Drawer Menu (Hamburger Menu) ─── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative bg-white w-64 max-w-[80vw] h-full shadow-2xl p-4 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black">
                    D
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Dzaqilah Cell</h3>
                    <p className="text-[10px] text-gray-400">PPOB & Pulsa Online</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-800 truncate max-w-[130px]">{user?.name || 'Agen'}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                    {roleLabel}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">Saldo Akun:</p>
                <p className="text-base font-bold text-teal-700">{formatCurrency(user?.balance)}</p>
              </div>

              <nav className="py-3 space-y-1">
                <Link
                  to="/"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-teal-700 bg-teal-50"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Beranda</span>
                </Link>
                <Link
                  to="/layanan"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Daftar Layanan</span>
                </Link>
                <Link
                  to="/request-topup"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Deposit / Topup</span>
                </Link>
                <Link
                  to="/riwayat"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <History className="w-4 h-4" />
                  <span>Riwayat Transaksi</span>
                </Link>
                <Link
                  to="/profil"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Users className="w-4 h-4" />
                  <span>Profil Akun</span>
                </Link>

                {isAdmin && (
                  <div className="pt-2 border-t border-gray-100 space-y-1">
                    <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Panel Admin
                    </p>
                    <Link
                      to="/admin/banners"
                      onClick={() => setIsSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-pink-700 bg-pink-50 hover:bg-pink-100"
                    >
                      <Megaphone className="w-4 h-4 text-pink-600" />
                      <span>Banner & Pengumuman</span>
                    </Link>
                    <Link
                      to="/admin/users"
                      onClick={() => setIsSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Kelola Users & Saldo</span>
                    </Link>
                  </div>
                )}
              </nav>
            </div>

            <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
              Dzaqilah Cell v1.2.0 • 2026
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
