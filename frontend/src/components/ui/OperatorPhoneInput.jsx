import { useEffect } from 'react';
import { Smartphone, X, CheckCircle2 } from 'lucide-react';
import { detectOperator, normalizePhoneNumber } from '../../utils/operatorDetector';

const OperatorPhoneInput = ({
  value,
  onChange,
  onOperatorChange,
  placeholder = 'Contoh: 081234567890',
  autoFocus = false,
  className = '',
}) => {
  const detected = detectOperator(value);

  useEffect(() => {
    if (onOperatorChange) {
      onOperatorChange(detected);
    }
  }, [detected?.id, onOperatorChange]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const cleaned = normalizePhoneNumber(raw);
    onChange(cleaned);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="relative flex items-center bg-white border border-gray-200 rounded-2xl shadow-xs transition-all focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-gray-400">
          <Smartphone className="w-5 h-5 text-gray-500" />
        </div>

        <input
          type="tel"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={14}
          className="w-full py-3.5 pr-10 text-sm font-semibold tracking-wide text-gray-900 placeholder:text-gray-400 placeholder:font-normal bg-transparent outline-none"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {detected && (
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center gap-2">
            {detected.logo ? (
              <img
                src={detected.logo}
                alt={detected.name}
                className="w-5 h-5 object-contain rounded bg-white flex-shrink-0"
              />
            ) : (
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: detected.accentColor }}
              />
            )}
            <span className="font-semibold text-gray-800">{detected.name}</span>
            <span className="text-[10px] text-gray-400">({detected.brand})</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${detected.badgeClass} flex items-center gap-1 shadow-xs`}>
            <CheckCircle2 className="w-3 h-3" />
            Terdeteksi
          </span>
        </div>
      )}
    </div>
  );
};

export default OperatorPhoneInput;
