import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, History, Users, TrendingUp, Clock, CheckCircle, Percent, PlusCircle, Plus } from 'lucide-react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { get, formatCurrency } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';
import { SERVICES } from '../constants/services';

const Home = () => {
  const { user, isAdmin, isReseller } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceCounts, setServiceCounts] = useState({});

  useEffect(() => {
    get(API_ENDPOINTS.DASHBOARD.STATS)
      .then((res) => setStats(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));

    get(API_ENDPOINTS.PRODUCTS.SERVICES)
      .then((res) => {
        const map = {};
        res.data.forEach((item) => { map[item.id] = item.total; });
        setServiceCounts(map);
      })
      .catch(() => { });
  }, []);

  const adminActions = [
    { to: '/admin/users', icon: Users, label: 'Kelola Users', color: 'bg-purple-500' },
    { to: '/admin/topup-requests', icon: PlusCircle, label: 'Request Topup', color: 'bg-emerald-500' },
    { to: '/admin/saldo', icon: Wallet, label: 'Topup Saldo', color: 'bg-green-500' },
    { to: '/admin/logs', icon: History, label: 'Log Aktivitas', color: 'bg-orange-500' },
    { to: '/admin/margin', icon: Percent, label: 'Pengaturan', color: 'bg-indigo-500' },
    { to: '/admin/product-margins', icon: Percent, label: 'Margin Produk', color: 'bg-violet-500' },
  ];

  const roleLabel = {
    owner: 'Owner',
    admin: 'Admin',
    reseller: '💎 Reseller',
    user: 'Member',
  }[user?.role] || 'Member';

  return (
    <div>
      <Header
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold truncate">Halo, {user?.name?.split(' ')[0] || 'User'}!</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white whitespace-nowrap">
              {roleLabel}
            </span>
          </div>
        }
        subtitle={
          <p className="text-white/80 text-xs mt-0.5 truncate">
            Selamat datang di Dzaqilah Store
          </p>
        }
        right={
          <div className="text-right bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 shadow-xs">
            <p className="text-primary-100 text-[10px] uppercase font-semibold tracking-wider">Saldo</p>
            <p className="font-bold text-base whitespace-nowrap text-white">{formatCurrency(user?.balance)}</p>
          </div>
        }
      />

      <div className="px-4 -mt-4 space-y-4">
        {isReseller && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💎</span>
              <div>
                <p className="text-xs font-semibold text-emerald-950">Harga Khusus Reseller Aktif</p>
                <p className="text-[11px] text-emerald-700">Nikmati potongan harga langsung di setiap pembelian produk.</p>
              </div>
            </div>
            <Link to="/layanan" className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl hover:bg-emerald-200">
              Belanja
            </Link>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          {loading ? (
            <div className="flex justify-center py-4"><LoadingSpinner /></div>
          ) : isAdmin ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Users}
                label="Total Users"
                value={stats?.total_users || 0}
                action={{
                  to: '/admin/users',
                  label: `${stats?.total_resellers || 0} Reseller • ${stats?.total_members || 0} Member`,
                }}
              />
              <StatCard icon={TrendingUp} label="Transaksi Hari Ini" value={stats?.transactions_today || 0} />
              <StatCard icon={CheckCircle} label="Sukses" value={stats?.transactions_success || 0} />
              <StatCard icon={Clock} label="Pending" value={stats?.transactions_pending || 0} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Wallet}
                label="Saldo"
                value={formatCurrency(stats?.balance)}
                action={{ to: '/request-topup', label: 'Topup saldo' }}
              />
              <StatCard icon={History} label="Total Transaksi" value={stats?.total_transactions || 0} />
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Layanan</h2>
          <div className="grid grid-cols-3 gap-2">
            {SERVICES.map(({ id, label, icon: Icon, color }) => (
              <Link
                key={id}
                to={`/layanan/${id}`}
                className="bg-white border rounded-xl p-3 flex flex-col items-center text-center hover:shadow-md transition-shadow"
              >
                <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center mb-2`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-800 leading-tight">{label}</span>
                {serviceCounts[id] !== undefined && (
                  <span className="text-[10px] text-gray-400 mt-1">{serviceCounts[id]} produk</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Panel Admin</h2>
            <div className="grid grid-cols-2 gap-3">
              {adminActions.map(({ to, icon: Icon, label, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, action }) => (
  <div className="bg-gray-50 rounded-xl p-3 relative">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-primary-600" />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
    <p className="font-bold text-gray-900 pr-8">{value}</p>
    {action && (
      <Link
        to={action.to}
        title={action.label}
        className="absolute top-3 right-3 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4 text-white" />
      </Link>
    )}
  </div>
);

export default Home;
