import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, History, User, QrCode, Users, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const BottomNav = () => {
  const { isAdmin } = useAuth();

  const navItems = [
    { to: '/', icon: Home, label: 'Beranda' },
    { to: isAdmin ? '/admin/users' : '/layanan', icon: isAdmin ? Users : LayoutGrid, label: isAdmin ? 'Users' : 'Layanan' },
    { to: '/request-topup', icon: QrCode, label: 'QRIS Topup', isCenter: true },
    { to: '/riwayat', icon: History, label: 'Riwayat' },
    { to: '/profil', icon: User, label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 safe-bottom shadow-lg">
      <div className="max-w-mobile mx-auto flex items-center justify-around px-2 py-1.5 relative">
        {navItems.map(({ to, icon: Icon, label, isCenter }) => {
          if (isCenter) {
            return (
              <NavLink
                key={to}
                to={to}
                className="relative -top-5 flex flex-col items-center flex-shrink-0 group"
              >
                <div className="w-[52px] h-[52px] aspect-square flex-shrink-0 rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/30 group-hover:scale-105 group-active:scale-95 transition-all">
                  <div className="w-full h-full aspect-square rounded-[14px] bg-gradient-to-tr from-teal-600 to-emerald-500 flex flex-col items-center justify-center text-white">
                    <Icon className="w-5 h-5 stroke-[2.2] flex-shrink-0" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5 leading-none">QRIS</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-teal-700 mt-1 whitespace-nowrap">Topup</span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl min-w-[56px] flex-shrink-0 transition-all ${
                  isActive ? 'text-teal-600 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon className="w-5 h-5 stroke-[1.8] flex-shrink-0" />
              <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
