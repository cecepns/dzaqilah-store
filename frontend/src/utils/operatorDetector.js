/**
 * Operator detection utility based on Indonesian HLR / mobile operator prefixes.
 * Client-side detection provides instant 0ms feedback without third-party API dependencies.
 */

import logoTelkomsel from '../assets/operator/telkomsel.png';
import logoIndosat from '../assets/operator/indosat.png';
import logoXl from '../assets/operator/xl.png';
import logoAxis from '../assets/operator/axis.png';
import logoTri from '../assets/operator/3.png';
import logoSmartfren from '../assets/operator/smartfren.png';
import logoByu from '../assets/operator/byu.png';

export const OPERATOR_LOGOS = {
  telkomsel: logoTelkomsel,
  indosat: logoIndosat,
  xl: logoXl,
  axis: logoAxis,
  tri: logoTri,
  smartfren: logoSmartfren,
  byu: logoByu,
};

export const OPERATOR_LIST = [
  {
    id: 'telkomsel',
    name: 'Telkomsel',
    brand: 'TELKOMSEL',
    logo: logoTelkomsel,
    prefixes: [
      '0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'
    ],
    bgClass: 'bg-red-50 text-red-600 border-red-200',
    badgeClass: 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
    accentColor: '#dc2626',
    aliases: ['TELKOMSEL', 'SIMPATI', 'AS', 'LOOP', 'T-SEL'],
  },
  {
    id: 'byu',
    name: 'by.U',
    brand: 'BY.U',
    logo: logoByu,
    prefixes: [
      '085154', '085155', '085156', '085157', '085158'
    ],
    bgClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    badgeClass: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold',
    accentColor: '#06b6d4',
    aliases: ['BY.U', 'BYU'],
  },
  {
    id: 'indosat',
    name: 'Indosat Ooredoo',
    brand: 'INDOSAT',
    logo: logoIndosat,
    prefixes: [
      '0814', '0815', '0816', '0855', '0856', '0857', '0858'
    ],
    bgClass: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold',
    accentColor: '#f59e0b',
    aliases: ['INDOSAT', 'IM3', 'MENTARI', 'OOREDOO'],
  },
  {
    id: 'xl',
    name: 'XL Axiata',
    brand: 'XL',
    logo: logoXl,
    prefixes: [
      '0817', '0818', '0819', '0859', '0877', '0878'
    ],
    bgClass: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeClass: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white',
    accentColor: '#2563eb',
    aliases: ['XL', 'XL AXIATA'],
  },
  {
    id: 'axis',
    name: 'AXIS',
    brand: 'AXIS',
    logo: logoAxis,
    prefixes: [
      '0831', '0832', '0833', '0838'
    ],
    bgClass: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeClass: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white',
    accentColor: '#9333ea',
    aliases: ['AXIS'],
  },
  {
    id: 'tri',
    name: 'Tri (3)',
    brand: 'TRI',
    logo: logoTri,
    prefixes: [
      '0895', '0896', '0897', '0898', '0899'
    ],
    bgClass: 'bg-orange-50 text-orange-700 border-orange-200',
    badgeClass: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white',
    accentColor: '#ea580c',
    aliases: ['TRI', 'THREE', '3'],
  },
  {
    id: 'smartfren',
    name: 'Smartfren',
    brand: 'SMARTFREN',
    logo: logoSmartfren,
    prefixes: [
      '0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'
    ],
    bgClass: 'bg-pink-50 text-pink-700 border-pink-200',
    badgeClass: 'bg-gradient-to-r from-pink-600 to-rose-600 text-white',
    accentColor: '#e11d48',
    aliases: ['SMARTFREN', 'SMART'],
  },
];

/**
 * Clean & normalize phone number into standard 08xxx Indonesian format
 */
export const normalizePhoneNumber = (raw) => {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+62')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned.replace(/[^0-9]/g, '');
};

/**
 * Detect operator by phone number
 * @param {string} phone
 * @returns {object|null}
 */
export const detectOperator = (phone) => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length < 4) {
    return null;
  }

  // Check 6-digit prefix first (e.g. By.U)
  if (normalized.length >= 6) {
    const prefix6 = normalized.slice(0, 6);
    const found6 = OPERATOR_LIST.find((op) => op.prefixes.includes(prefix6));
    if (found6) return found6;
  }

  // Check 4-digit standard prefix
  const prefix4 = normalized.slice(0, 4);
  const found = OPERATOR_LIST.find((op) => op.prefixes.includes(prefix4));
  return found || null;
};

/**
 * Get operator logo asset by brand name or product name
 * @param {string} brandOrName
 * @returns {string|null}
 */
export const getOperatorLogo = (brandOrName) => {
  if (!brandOrName) return null;
  const str = String(brandOrName).toLowerCase().trim();

  if (str.includes('byu') || str.includes('by.u')) return logoByu;
  if (str.includes('telkomsel') || str.includes('simpati') || str.includes('kartu as') || str.includes('loop')) return logoTelkomsel;
  if (str.includes('indosat') || str.includes('im3') || str.includes('mentari') || str.includes('ooredoo')) return logoIndosat;
  if (str.includes('axis')) return logoAxis;
  if (str.includes('smartfren') || str.includes('smart')) return logoSmartfren;
  if (str === '3' || str.startsWith('3 ') || str.includes('tri') || str.includes('three')) return logoTri;
  if (str === 'xl' || str.startsWith('xl ') || str.startsWith('xl-') || str.includes('xl axiata')) return logoXl;

  return null;
};

/**
 * Find matching brand in list of API brands based on detected operator
 * @param {object|null} operator
 * @param {string[]} availableBrands
 * @returns {string|null}
 */
export const matchBrandFromOperator = (operator, availableBrands = []) => {
  if (!operator || !availableBrands.length) return null;
  const brandLowerList = availableBrands.map((b) => ({ original: b, lower: b.toLowerCase() }));

  for (const alias of operator.aliases) {
    const aliasLower = alias.toLowerCase();
    const match = brandLowerList.find(
      (b) => b.lower === aliasLower || b.lower.includes(aliasLower) || aliasLower.includes(b.lower)
    );
    if (match) return match.original;
  }

  return null;
};
