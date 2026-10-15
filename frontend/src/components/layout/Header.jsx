import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Header = ({ title, subtitle, right, backTo, showBack }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 text-white px-4 pt-5 pb-7 rounded-b-2xl shadow-md sticky top-0 z-20">
      <div className="max-w-mobile mx-auto flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {(showBack || backTo) && (
            <button
              type="button"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all flex-shrink-0"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <h1 className="text-lg font-extrabold tracking-tight truncate leading-tight">{title}</h1>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-teal-100/90 text-xs mt-0.5 min-w-0 font-medium">{subtitle}</div>
            )}
          </div>
        </div>
        {right && <div className="flex-shrink-0 flex items-center">{right}</div>}
      </div>
    </div>
  );
};

export default Header;
