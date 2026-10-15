import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { get, formatCurrency } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';
import { SERVICES } from '../constants/services';

const Services = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get(API_ENDPOINTS.PRODUCTS.SERVICES)
      .then((res) => {
        const map = {};
        res.data.forEach((item) => { map[item.id] = item.total; });
        setCounts(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Header
        title="Katalog Layanan"
        subtitle={`Dzaqilah Cell • Saldo: ${formatCurrency(user?.balance)}`}
      />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICES.map(({ id, label, description, icon: Icon, color }) => (
              <Link
                key={id}
                to={`/layanan/${id}`}
                className="bg-white border border-gray-200/80 rounded-2xl p-3.5 hover:border-teal-300 hover:shadow-md transition-all active:scale-[0.98] group flex flex-col justify-between relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center mb-2.5 shadow-xs group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5 text-white stroke-[2.2]" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-xs tracking-tight group-hover:text-teal-700 transition-colors">
                    {label}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  {counts[id] !== undefined ? (
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                      {counts[id]} produk
                    </span>
                  ) : (
                    <span />
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;
