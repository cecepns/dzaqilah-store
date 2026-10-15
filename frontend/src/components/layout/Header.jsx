import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Header = ({ title, subtitle, right, backTo, showBack }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-mobile mx-auto px-4 py-3 flex items-center justify-between gap-3">
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
              <h1 className="text-base font-extrabold tracking-tight truncate leading-tight">{title}</h1>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-teal-100/90 text-xs mt-0.5 min-w-0 font-medium truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {right && <div className="flex-shrink-0 flex items-center">{right}</div>}
      </div>
    </header>
  );
};

export default Header;
