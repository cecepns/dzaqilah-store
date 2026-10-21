require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'raca_cell_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Folder uploads sesuai AGENTS.md (uploads-[nama-project])
const uploadsRootDir = path.join(__dirname, 'uploads-raca-cell');
const topupUploadDir = path.join(uploadsRootDir, 'topup');
const bannersUploadDir = path.join(uploadsRootDir, 'banners');
const paymentAccountsUploadDir = path.join(uploadsRootDir, 'payment-accounts');

if (!fs.existsSync(topupUploadDir)) {
  fs.mkdirSync(topupUploadDir, { recursive: true });
}
if (!fs.existsSync(bannersUploadDir)) {
  fs.mkdirSync(bannersUploadDir, { recursive: true });
}
if (!fs.existsSync(paymentAccountsUploadDir)) {
  fs.mkdirSync(paymentAccountsUploadDir, { recursive: true });
}

// Margin default hanya dipakai saat pertama kali seed database.
// Nilai aktif selalu diambil dari tabel settings (diatur via Admin > Pengaturan Margin).
const DEFAULT_MARGIN_PERCENT = parseFloat(process.env.MARKUP_PERCENT || '5');
const DEFAULT_RESELLER_MARGIN_PERCENT = parseFloat(process.env.RESELLER_MARKUP_PERCENT || '2');
let marginPercent = DEFAULT_MARGIN_PERCENT;
let resellerMarginPercent = DEFAULT_RESELLER_MARGIN_PERCENT;
let productMargins = new Map();
let DIGIFLAZZ_USERNAME = process.env.DIGIFLAZZ_USERNAME || 'tovowaWjYdvD';
let DIGIFLAZZ_API_KEY = process.env.DIGIFLAZZ_API_KEY || '86a9458b-3f32-58f1-85e5-eaf901bfb7ed';
let DIGIFLAZZ_TESTING = process.env.DIGIFLAZZ_TESTING === 'true';
let DIGIFLAZZ_WEBHOOK_SECRET = process.env.DIGIFLAZZ_WEBHOOK_SECRET || 'dzaqilahstore2026';
const DIGIFLAZZ_BASE_URL = 'https://api.digiflazz.com/v1';
const PRICE_LIST_CACHE_TTL = (parseInt(process.env.PRICE_LIST_CACHE_TTL, 10) || 600) * 1000;

let pool = mysql.createPool({
  host: "localhost",
  user: "dzaqila1_cell",
  password: "dzaqila1_cell",
  database: "dzaqila1_cell",
  waitForConnections: true,
  connectionLimit: 10,
});;

let priceListCache = { data: null, fetchedAt: 0 };
let pascaPriceListCache = { data: null, fetchedAt: 0 };

const EWALLET_KEYWORDS = ['dana', 'ovo', 'gopay', 'go pay', 'shopeepay', 'shopee pay', 'linkaja', 'grabpay', 'grab pay', 'maxim'];

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsRootDir));
app.use('/api/uploads', express.static(uploadsRootDir));

// Konfigurasi Multer untuk Bukti Transfer
const topupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, topupUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `proof-${uniqueSuffix}${ext}`);
  },
});

const topupUploadFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung! Hanya JPG, PNG, dan WEBP yang diperbolehkan.'), false);
  }
};

const uploadTopupProof = multer({
  storage: topupStorage,
  fileFilter: topupUploadFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB backend safety limit
});

// Konfigurasi Multer untuk Banner Promo
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bannersUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

const uploadBannerImage = multer({
  storage: bannerStorage,
  fileFilter: topupUploadFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB safety limit
});

// Konfigurasi Multer untuk Gambar / QRIS Rekening Pembayaran
const paymentAccountStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentAccountsUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `bank-${uniqueSuffix}${ext}`);
  },
});

const uploadPaymentAccountImage = multer({
  storage: paymentAccountStorage,
  fileFilter: topupUploadFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB safety limit
});

// ─── Helpers ───────────────────────────────────────────────────────────────

const digiflazzSign = (ref) =>
  crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref).digest('hex');

const normalizeSkuCode = (sku) => String(sku || '').trim().toLowerCase();

const buildProductMarginsMap = (rows) =>
  new Map(
    rows.map((row) => [
      normalizeSkuCode(row.buyer_sku_code),
      {
        margin_percent: parseFloat(row.margin_percent),
        reseller_margin_percent:
          row.reseller_margin_percent != null && row.reseller_margin_percent !== ''
            ? parseFloat(row.reseller_margin_percent)
            : null,
      },
    ])
  );

const getEffectiveMargin = (buyerSkuCode, role = 'user', marginsMap = productMargins) => {
  const key = normalizeSkuCode(buyerSkuCode);
  const isReseller = role === 'reseller';

  if (key && marginsMap.has(key)) {
    const custom = marginsMap.get(key);
    if (isReseller) {
      if (custom && custom.reseller_margin_percent != null) {
        return custom.reseller_margin_percent;
      }
      return resellerMarginPercent;
    }
    return custom ? custom.margin_percent : marginPercent;
  }

  return isReseller ? resellerMarginPercent : marginPercent;
};

const calcSellingPrice = (price, buyerSkuCode, role = 'user', marginsMap = productMargins) => {
  const base = parseFloat(price) || 0;
  const margin = getEffectiveMargin(buyerSkuCode, role, marginsMap);
  return Math.ceil(base + (base * margin) / 100);
};

const getSetting = async (key, defaultValue = '') => {
  const [rows] = await pool.execute('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [key]);
  return rows.length ? rows[0].setting_value : defaultValue;
};

const setSetting = async (key, value, updatedBy = null) => {
  await pool.execute(
    `INSERT INTO settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [key, String(value), updatedBy]
  );
};

const normalizeWhatsApp = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
};

const loadMarginPercent = async () => {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('margin_percent', 'margin_reseller_percent')"
    );
    rows.forEach((row) => {
      if (row.setting_key === 'margin_percent') {
        marginPercent = parseFloat(row.setting_value) || DEFAULT_MARGIN_PERCENT;
      } else if (row.setting_key === 'margin_reseller_percent') {
        resellerMarginPercent = parseFloat(row.setting_value) || DEFAULT_RESELLER_MARGIN_PERCENT;
      }
    });
  } catch (err) {
    console.error('Failed to load margin settings:', err.message);
    marginPercent = DEFAULT_MARGIN_PERCENT;
    resellerMarginPercent = DEFAULT_RESELLER_MARGIN_PERCENT;
  }
  return { marginPercent, resellerMarginPercent };
};

const loadProductMargins = async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT buyer_sku_code, margin_percent, reseller_margin_percent FROM product_margins'
    );
    productMargins = buildProductMarginsMap(rows);
  } catch (err) {
    console.error('Failed to load product margins:', err.message);
    productMargins = new Map();
  }
  return productMargins;
};

const loadDigiflazzConfig = async () => {
  try {
    const u = await getSetting('digiflazz_username', process.env.DIGIFLAZZ_USERNAME || 'tovowaWjYdvD');
    const k = await getSetting('digiflazz_api_key', process.env.DIGIFLAZZ_API_KEY || '86a9458b-3f32-58f1-85e5-eaf901bfb7ed');
    const t = await getSetting('digiflazz_testing', process.env.DIGIFLAZZ_TESTING || 'true');
    const w = await getSetting('digiflazz_webhook_secret', process.env.DIGIFLAZZ_WEBHOOK_SECRET || 'dzaqilahstore2026');
    DIGIFLAZZ_USERNAME = u;
    DIGIFLAZZ_API_KEY = k;
    DIGIFLAZZ_TESTING = t === 'true';
    DIGIFLAZZ_WEBHOOK_SECRET = w;
  } catch (err) {
    console.error('Failed to load Digiflazz config from settings:', err.message);
  }
};

const maskSecretKey = (secret) => {
  if (!secret || typeof secret !== 'string') return null;
  const str = secret.trim();
  if (!str) return null;
  if (str.length <= 8) return '••••••••';
  return `${str.slice(0, 4)}••••••••${str.slice(-4)}`;
};

const isMaskedOrEmpty = (val) => {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  return str === '' || str.includes('••••') || str.includes('****');
};

const sanitizeSensitiveObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSensitiveObject);
  const copy = { ...obj };
  const sensitiveKeys = ['api_key', 'apikey', 'secret', 'sign', 'password', 'token', 'authorization'];
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      delete copy[key];
    } else if (typeof copy[key] === 'object') {
      copy[key] = sanitizeSensitiveObject(copy[key]);
    }
  }
  return copy;
};

const fetchProductMarginsMap = () => loadProductMargins();

const generateRefId = () => `RC${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});

const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const logActivity = async (userId, action, description, metadata = null, ip = null) => {
  try {
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action, description, metadata, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, action, description, metadata ? JSON.stringify(metadata) : null, ip]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

const callDigiflazz = async (endpoint, body) => {
  const response = await fetch(`${DIGIFLAZZ_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error(`Digiflazz non-JSON response from ${endpoint} (status ${response.status}):`, text.slice(0, 300));
    return {
      data: {
        message: `Digiflazz HTTP ${response.status}: ${text.slice(0, 150)}`,
        rc: String(response.status),
      },
    };
  }
};


const fetchDigiflazzPriceListFromApi = async () => {
  const result = await callDigiflazz('/price-list', {
    cmd: 'prepaid',
    username: DIGIFLAZZ_USERNAME,
    sign: digiflazzSign('pricelist'),
  });

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  const errorMessage =
    result?.data?.message ||
    result?.message ||
    (typeof result?.data === 'string' ? result.data : null) ||
    'Gagal mengambil daftar harga dari Digiflazz. Periksa username dan API key.';

  const error = new Error(errorMessage);
  error.digiflazzResponse = result;
  error.rc = result?.data?.rc;
  throw error;
};

const getDigiflazzPriceList = async (forceRefresh = false) => {
  const now = Date.now();
  const cacheValid =
    priceListCache.data && now - priceListCache.fetchedAt < PRICE_LIST_CACHE_TTL;

  if (cacheValid && !forceRefresh) {
    return priceListCache.data;
  }

  try {
    const data = await fetchDigiflazzPriceListFromApi();
    priceListCache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    if (priceListCache.data) {
      console.warn(`Menggunakan cache pricelist lama: ${err.message}`);
      return priceListCache.data;
    }
    throw err;
  }
};

const fetchDigiflazzPascaPriceListFromApi = async () => {
  const result = await callDigiflazz('/price-list', {
    cmd: 'pasca',
    username: DIGIFLAZZ_USERNAME,
    sign: digiflazzSign('pricelist'),
  });

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  const errorMessage =
    result?.data?.message ||
    result?.message ||
    (typeof result?.data === 'string' ? result.data : null) ||
    'Gagal mengambil daftar harga pascabayar dari Digiflazz.';

  const error = new Error(errorMessage);
  error.digiflazzResponse = result;
  error.rc = result?.data?.rc;
  throw error;
};

const getDigiflazzPascaPriceList = async (forceRefresh = false) => {
  const now = Date.now();
  const cacheValid =
    pascaPriceListCache.data && now - pascaPriceListCache.fetchedAt < PRICE_LIST_CACHE_TTL;

  if (cacheValid && !forceRefresh) {
    return pascaPriceListCache.data;
  }

  try {
    const data = await fetchDigiflazzPascaPriceListFromApi();
    pascaPriceListCache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    if (pascaPriceListCache.data) {
      console.warn(`Menggunakan cache pricelist pasca lama: ${err.message}`);
      return pascaPriceListCache.data;
    }
    throw err;
  }
};

const PREPAID_SERVICE_IDS = ['pulsa', 'data', 'voucher', 'game', 'pln', 'ewallet'];
const PASCA_SERVICE_IDS = ['pln-pasca', 'pdam-pasca', 'bpjs-kesehatan-pasca', 'bpjs-tk-pasca'];
const SERVICE_IDS = [...PREPAID_SERVICE_IDS, ...PASCA_SERVICE_IDS];

const getPascaHaystack = (product) =>
  [product.product_name, product.brand, product.buyer_sku_code, product.desc, product.category, product.seller_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const classifyPascaService = (product) => {
  const haystack = getPascaHaystack(product);
  const brand = (product.brand || '').toLowerCase().trim();
  const sku = (product.buyer_sku_code || '').toLowerCase().trim();
  const name = (product.product_name || '').toLowerCase().trim();

  const isBpjsTk =
    /ketenagakerjaan|ketenaga kerjaan|bpjstk|bpjs tk|tenaga kerja|\bjht\b|\bjkk\b|\bjkm\b/.test(haystack) ||
    /^bpjstk/.test(sku) ||
    (brand.includes('bpjs') && /tk|tenaga kerja|ketenaga/.test(haystack));

  const isBpjsKesehatan =
    /bpjs|kesehatan|bpjskes|bpjskesehatan/.test(haystack) ||
    /^bpjs$|^bpjskes/.test(sku);

  const isPdam =
    brand === 'pdam' ||
    brand.includes('pdam') ||
    brand === 'pam' ||
    /pdam|pam jaya|aetra|tagihan air|rekening air|air minum/.test(haystack);

  const isPln =
    brand === 'pln' ||
    brand.includes('pln') ||
    /pln|listrik|postpaid/.test(haystack) ||
    sku === 'pln';

  if (isBpjsTk) return 'bpjs-tk-pasca';
  if (isBpjsKesehatan && !isBpjsTk) return 'bpjs-kesehatan-pasca';
  if (isPdam && !isPln && !isBpjsKesehatan && !isBpjsTk) return 'pdam-pasca';
  if (isPln && !isPdam && !isBpjsKesehatan && !isBpjsTk) return 'pln-pasca';

  // Fallback: brand PDAM/PLN dari struktur Digiflazz (product_name bisa regional, mis. "aetra")
  if (brand === 'pdam') return 'pdam-pasca';
  if (brand === 'pln' || name.includes('pln')) return 'pln-pasca';

  return null;
};

const isPascaListed = (product) => Boolean(product.seller_product_status);
const isPascaBuyable = (product) => Boolean(product.buyer_product_status && product.seller_product_status);

const isEwalletProduct = (product) => {
  const category = (product.category || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  const name = (product.product_name || '').toLowerCase();

  if (
    category.includes('e-money') ||
    category.includes('emoney') ||
    category.includes('e-wallet') ||
    category.includes('ewallet')
  ) {
    return true;
  }

  return EWALLET_KEYWORDS.some((keyword) => brand.includes(keyword) || name.includes(keyword));
};

const isPlnPrepaidProduct = (product) => {
  const category = (product.category || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  const name = (product.product_name || '').toLowerCase();

  if (
    category.includes('pasca') ||
    name.includes('pascabayar') ||
    name.includes('tagihan') ||
    isEwalletProduct(product)
  ) {
    return false;
  }

  return (
    category.includes('pln') ||
    brand.includes('pln') ||
    category.includes('listrik') ||
    name.includes('pln') ||
    name.includes('token listrik') ||
    name.includes('token pln') ||
    (name.includes('token') && (name.includes('listrik') || brand.includes('pln')))
  );
};

const matchPrepaidService = (product, service) => {
  if (!service || !PREPAID_SERVICE_IDS.includes(service)) return true;

  const category = (product.category || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  const name = (product.product_name || '').toLowerCase();
  const type = (product.type || '').toLowerCase();

  switch (service) {
    case 'pulsa':
      return category === 'pulsa' || (category.includes('pulsa') && !category.includes('data'));
    case 'data':
      return category.includes('data') || type.includes('data') || name.includes('kuota') || name.includes('paket');
    case 'voucher':
      return category.includes('voucher') || name.includes('voucher');
    case 'game':
      return category.includes('game') || brand.includes('game') || name.includes('diamond') || name.includes('uc ');
    case 'pln':
      return isPlnPrepaidProduct(product);
    case 'ewallet':
    case 'emoney':
    case 'e-money':
      return isEwalletProduct(product);
    default:
      return true;
  }
};

const matchPascaService = (product, service) => {
  if (!service || !PASCA_SERVICE_IDS.includes(service)) return true;
  return classifyPascaService(product) === service;
};

const mapPrepaidProducts = (products, marginsMap = productMargins, role = 'user') =>
  products
    .filter((p) => p.buyer_product_status && p.seller_product_status)
    .map((p) => {
      const skuKey = normalizeSkuCode(p.buyer_sku_code);
      const custom = marginsMap.get(skuKey);
      const hasCustomMargin = marginsMap.has(skuKey);
      const effectiveMargin = getEffectiveMargin(p.buyer_sku_code, role, marginsMap);
      return {
        buyer_sku_code: p.buyer_sku_code,
        product_name: p.product_name,
        category: p.category,
        brand: p.brand,
        type: p.type,
        price: parseFloat(p.price),
        selling_price: calcSellingPrice(p.price, p.buyer_sku_code, role, marginsMap),
        member_price: calcSellingPrice(p.price, p.buyer_sku_code, 'user', marginsMap),
        reseller_price: calcSellingPrice(p.price, p.buyer_sku_code, 'reseller', marginsMap),
        margin_percent: effectiveMargin,
        custom_margin_percent: custom ? custom.margin_percent : null,
        custom_reseller_margin_percent: custom ? custom.reseller_margin_percent : null,
        has_custom_margin: hasCustomMargin,
        desc: p.desc,
        is_pasca: false,
      };
    });

const mapPascaProducts = (products, marginsMap = productMargins, role = 'user') =>
  products
    .filter((p) => isPascaListed(p))
    .map((p) => {
      const skuKey = normalizeSkuCode(p.buyer_sku_code);
      const custom = marginsMap.get(skuKey);
      const hasCustomMargin = marginsMap.has(skuKey);
      const effectiveMargin = getEffectiveMargin(p.buyer_sku_code, role, marginsMap);
      return {
        buyer_sku_code: p.buyer_sku_code,
        product_name: p.product_name,
        category: p.category,
        brand: p.brand,
        admin: parseFloat(p.admin) || 0,
        commission: parseFloat(p.commission) || 0,
        margin_percent: effectiveMargin,
        custom_margin_percent: custom ? custom.margin_percent : null,
        custom_reseller_margin_percent: custom ? custom.reseller_margin_percent : null,
        has_custom_margin: hasCustomMargin,
        desc: p.desc,
        is_pasca: true,
        is_buyable: isPascaBuyable(p),
      };
    });

const mapKmspPackage = (p, marginsMap = productMargins, role = 'user') => {
  const code = p.package_code || p.buyer_sku_code || '';
  const skuKey = normalizeSkuCode(code);
  const custom = marginsMap.get(skuKey);
  const hasCustomMargin = marginsMap.has(skuKey);
  const effectiveMargin = getEffectiveMargin(code, role, marginsMap);
  const originalPrice = parseFloat(p.package_harga_int ?? p.package_price ?? p.price ?? 0);
  const sellingPrice = calcSellingPrice(originalPrice, code, role, marginsMap);
  const memberPrice = calcSellingPrice(originalPrice, code, 'user', marginsMap);
  const resellerPrice = calcSellingPrice(originalPrice, code, 'reseller', marginsMap);

  return {
    ...p,
    buyer_sku_code: code,
    product_name: p.package_name || p.product_name || code,
    brand: p.brand || (code.toLowerCase().includes('axis') ? 'AXIS' : 'XL'),
    original_price: originalPrice,
    price: sellingPrice,
    selling_price: sellingPrice,
    member_price: memberPrice,
    reseller_price: resellerPrice,
    margin_percent: effectiveMargin,
    custom_margin_percent: custom ? custom.margin_percent : null,
    custom_reseller_margin_percent: custom ? custom.reseller_margin_percent : null,
    has_custom_margin: hasCustomMargin,
    transaction_type: 'kmsp',
    stock: p.stock !== undefined ? p.stock : null,
    is_out_of_stock: Boolean(p.is_out_of_stock),
    sedang_gangguan: Boolean(p.sedang_gangguan),
  };
};

const processDigiflazzTopup = async (refId, buyerSkuCode, customerNo) => {
  const body = {
    username: DIGIFLAZZ_USERNAME,
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    sign: digiflazzSign(refId),
  };
  if (DIGIFLAZZ_TESTING) body.testing = true;
  return callDigiflazz('/transaction', body);
};

const processDigiflazzPasca = async (command, refId, buyerSkuCode, customerNo) => {
  const body = {
    commands: command,
    username: DIGIFLAZZ_USERNAME,
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    sign: digiflazzSign(refId),
  };
  if (DIGIFLAZZ_TESTING) body.testing = true;
  return callDigiflazz('/transaction', body);
};

const calcPascaSellingPrice = (digiflazzSellingPrice, buyerSkuCode, role = 'user', marginsMap = productMargins) =>
  calcSellingPrice(digiflazzSellingPrice, buyerSkuCode, role, marginsMap);

const mapDigiflazzStatus = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'sukses' || s === 'success') return 'success';
  if (s === 'pending' || s === 'processing') return 'pending';
  return 'failed';
};

const parseDigiflazzPayload = (body) => {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object') return body.data;
  if (body.ref_id) return body;
  return null;
};

const hasRefundForTransaction = async (connection, transaction) => {
  const [rows] = await connection.execute(
    `SELECT id FROM balance_transactions WHERE user_id = ? AND type = 'refund' AND note LIKE ? LIMIT 1`,
    [transaction.user_id, `%${transaction.ref_id}%`]
  );
  return rows.length > 0;
};

const applyTransactionStatusUpdate = async (connection, transaction, digiflazzData, fullResponse = null) => {
  const newStatus = mapDigiflazzStatus(digiflazzData.status);
  const oldStatus = transaction.status;
  const sn = digiflazzData.sn || transaction.sn || null;
  const message = digiflazzData.message || transaction.message || null;
  const responseJson = JSON.stringify(fullResponse || digiflazzData);

  await connection.execute(
    `UPDATE transactions SET status = ?, sn = ?, message = ?, digiflazz_response = ?, updated_at = NOW() WHERE id = ?`,
    [newStatus, sn, message, responseJson, transaction.id]
  );

  let refunded = false;
  let balanceAfter = null;

  if (oldStatus === 'pending' && newStatus === 'failed') {
    const alreadyRefunded = await hasRefundForTransaction(connection, transaction);
    if (!alreadyRefunded) {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [transaction.user_id]);
      if (users.length) {
        const balanceBefore = parseFloat(users[0].balance);
        const refundAmount = parseFloat(transaction.selling_price);
        balanceAfter = balanceBefore + refundAmount;

        await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, transaction.user_id]);
        await connection.execute(
          'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            transaction.user_id,
            'refund',
            refundAmount,
            balanceBefore,
            balanceAfter,
            `Refund transaksi gagal ${transaction.ref_id}`,
            null,
          ]
        );
        refunded = true;
      }
    }
  }

  return { oldStatus, newStatus, sn, message, refunded, balanceAfter };
};

const mapKmspStatus = (kmspStatus) => {
  const s = Number(kmspStatus);
  if (s === 1) return 'success';
  if (s === 2) return 'pending';
  if (s === 0) return 'failed';
  return 'pending';
};

const applyKmspTransactionStatusUpdate = async (connection, transaction, kmspData, fullResponse = null) => {
  const newStatus = mapKmspStatus(kmspData.status);
  const oldStatus = transaction.status;
  const sn = kmspData.sn_only || kmspData.sn_and_info || transaction.sn || kmspData.trx_id || null;
  const message = kmspData.rc_message || kmspData.message || transaction.message || null;
  const responseJson = JSON.stringify(fullResponse || kmspData);

  await connection.execute(
    `UPDATE transactions SET status = ?, sn = ?, message = ?, digiflazz_response = ?, updated_at = NOW() WHERE id = ?`,
    [newStatus, sn, message, responseJson, transaction.id]
  );

  let refunded = false;
  let balanceAfter = null;

  if (oldStatus === 'pending' && newStatus === 'failed') {
    const alreadyRefunded = await hasRefundForTransaction(connection, transaction);
    if (!alreadyRefunded) {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [transaction.user_id]);
      if (users.length) {
        const balanceBefore = parseFloat(users[0].balance);
        const refundAmount = parseFloat(transaction.selling_price);
        balanceAfter = balanceBefore + refundAmount;

        await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, transaction.user_id]);
        await connection.execute(
          'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            transaction.user_id,
            'refund',
            refundAmount,
            balanceBefore,
            balanceAfter,
            `Refund transaksi gagal KMSP ${transaction.ref_id}`,
            null,
          ]
        );
        refunded = true;
      }
    }
  }

  return { oldStatus, newStatus, sn, message, refunded, balanceAfter };
};

// ─── Auth Middleware ───────────────────────────────────────────────────────

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, partner_name, role, balance, status FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ success: false, message: 'User tidak aktif atau tidak ditemukan' });
    }
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  next();
};


// ─── Database Init ─────────────────────────────────────────────────────────

const initDatabase = async () => {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'raca_cell',
    waitForConnections: true,
    connectionLimit: 10,
  });

  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('owner', 'admin', 'reseller', 'user') NOT NULL DEFAULT 'user',
        balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS balance_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('topup', 'add', 'reduce', 'purchase', 'refund') NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance_before DECIMAL(15, 2) NOT NULL,
        balance_after DECIMAL(15, 2) NOT NULL,
        note TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ref_id VARCHAR(100) NOT NULL UNIQUE,
        customer_no VARCHAR(30) NOT NULL,
        buyer_sku_code VARCHAR(50) NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        brand VARCHAR(100),
        transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid',
        price DECIMAL(15, 2) NOT NULL,
        selling_price DECIMAL(15, 2) NOT NULL,
        status ENUM('success', 'pending', 'failed') NOT NULL DEFAULT 'pending',
        sn VARCHAR(255),
        message TEXT,
        digiflazz_response JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        metadata JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    try {
      await connection.query('ALTER TABLE settings MODIFY COLUMN setting_value TEXT NOT NULL');
    } catch (_) { }

    const [marginSetting] = await connection.query(
      "SELECT id FROM settings WHERE setting_key = 'margin_percent' LIMIT 1"
    );
    if (!marginSetting.length) {
      await connection.query(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('margin_percent', ?)",
        [String(DEFAULT_MARGIN_PERCENT)]
      );
    }

    const [resellerMarginSetting] = await connection.query(
      "SELECT id FROM settings WHERE setting_key = 'margin_reseller_percent' LIMIT 1"
    );
    if (!resellerMarginSetting.length) {
      await connection.query(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('margin_reseller_percent', ?)",
        [String(DEFAULT_RESELLER_MARGIN_PERCENT)]
      );
    }

    const [waSetting] = await connection.query(
      "SELECT id FROM settings WHERE setting_key = 'admin_whatsapp' LIMIT 1"
    );
    if (!waSetting.length) {
      await connection.query(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('admin_whatsapp', '')"
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS topup_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        note TEXT,
        proof_image VARCHAR(255) NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        processed_by INT,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_topup_user (user_id),
        INDEX idx_topup_status (status)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS pasca_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ref_id VARCHAR(100) NOT NULL UNIQUE,
        buyer_sku_code VARCHAR(50) NOT NULL,
        customer_no VARCHAR(30) NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        brand VARCHAR(100),
        base_price DECIMAL(15, 2) NOT NULL,
        selling_price DECIMAL(15, 2) NOT NULL,
        customer_name VARCHAR(200),
        inquiry_response JSON,
        paid_at TIMESTAMP NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_pasca_inquiry_user (user_id),
        INDEX idx_pasca_inquiry_expires (expires_at)
      )
    `);

    try {
      await connection.query(
        `ALTER TABLE transactions ADD COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid' AFTER brand`
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    try {
      await connection.query(
        `ALTER TABLE transactions MODIFY COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid'`
      );
    } catch (err) {
      console.error('Failed to modify transactions transaction_type column:', err.message);
    }

    try {
      await connection.query(
        'ALTER TABLE users ADD COLUMN partner_name VARCHAR(100) NULL DEFAULT NULL AFTER phone'
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    try {
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('owner', 'admin', 'reseller', 'user') NOT NULL DEFAULT 'user'"
      );
    } catch (err) {
      console.error('Failed to update users role enum:', err.message);
    }

    try {
      await connection.query(
        'ALTER TABLE topup_requests ADD COLUMN proof_image VARCHAR(255) NULL AFTER note'
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_margins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        buyer_sku_code VARCHAR(100) NOT NULL UNIQUE,
        product_name VARCHAR(200) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid',
        margin_percent DECIMAL(5, 2) NOT NULL,
        reseller_margin_percent DECIMAL(5, 2) NULL DEFAULT NULL,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_product_margins_sku (buyer_sku_code),
        INDEX idx_product_margins_type (transaction_type)
      )
    `);

    try {
      await connection.query(
        'ALTER TABLE product_margins ADD COLUMN reseller_margin_percent DECIMAL(5, 2) NULL DEFAULT NULL AFTER margin_percent'
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') console.error('Failed to add reseller_margin_percent to product_margins:', err.message);
    }

    try {
      await connection.query(
        'ALTER TABLE product_margins MODIFY COLUMN buyer_sku_code VARCHAR(100) NOT NULL'
      );
      await connection.query(
        "ALTER TABLE product_margins MODIFY COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid'"
      );
    } catch (err) {
      // ignore
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        badge VARCHAR(100) NULL,
        image_url VARCHAR(500) NOT NULL,
        action_url VARCHAR(500) NULL,
        show_text BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_banners_active (is_active, sort_order)
      )
    `);

    const [existingBanners] = await connection.query('SELECT id FROM banners LIMIT 1');
    if (!existingBanners.length) {
      await connection.query(`
        INSERT INTO banners (title, description, badge, image_url, action_url, show_text, is_active, sort_order) VALUES
        ('QRIS Static Untuk Usahamu', 'MDR 0% & Pencairan Realtime', 'Fitur Unggulan', '/banners/promo_qris.jpg', '/request-topup', 1, 1, 1),
        ('Pulsa & Paket Data Termurah', 'Semua Operator Kilat 24 Jam', 'Diskon Spesial', '/banners/promo_pulsa.jpg', '/layanan/pulsa', 1, 1, 2)
      `);
    }

    // ─── Payment Accounts Table & Topup Requests Alterations ───
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bank_name VARCHAR(50) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        type ENUM('bank', 'ewallet', 'qris') NOT NULL DEFAULT 'bank',
        qr_image VARCHAR(500) NULL,
        instructions VARCHAR(255) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INT NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_payment_accounts_active (is_active, display_order)
      )
    `);

    try {
      await connection.query('ALTER TABLE topup_requests ADD COLUMN bank_name VARCHAR(50) NULL');
    } catch (_) { }
    try {
      await connection.query('ALTER TABLE topup_requests ADD COLUMN account_number VARCHAR(100) NULL');
    } catch (_) { }
    try {
      await connection.query('ALTER TABLE topup_requests ADD COLUMN account_name VARCHAR(100) NULL');
    } catch (_) { }

    const [existingAccounts] = await connection.query('SELECT id FROM payment_accounts LIMIT 1');
    if (!existingAccounts.length) {
      await connection.query(`
        INSERT INTO payment_accounts (bank_name, account_number, account_name, type, display_order, is_active) VALUES
        ('BRI', '022501013585534', 'ABDUL RAHMAN', 'bank', 1, 1),
        ('BSI', '7349271995', 'ABDUL RAHMAN', 'bank', 2, 1),
        ('DANA', '085299636873', 'ABDUL RAHMAN', 'ewallet', 3, 1),
        ('GOPAY', '085299636873', 'ABDUL RAHMAN', 'ewallet', 4, 1),
        ('OVO', '085299636873', 'ABDUL RAHMAN', 'ewallet', 5, 1)
      `);
    }

    try {
      await connection.query('ALTER TABLE settings MODIFY COLUMN setting_value TEXT NOT NULL');
    } catch (_) { }

    const [announcementSetting] = await connection.query(
      "SELECT id FROM settings WHERE setting_key = 'announcement_text' LIMIT 1"
    );
    if (!announcementSetting.length) {
      await connection.query(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('announcement_text', ?)",
        ['Selamat datang di Dzaqilah Cell! Layanan pulsa, paket data, & PPOB beroperasi 24 jam nonstop. Deposit instan otomatis via QRIS. Hubungi CS jika ada kendala.']
      );
    }
    const [announcementActiveSetting] = await connection.query(
      "SELECT id FROM settings WHERE setting_key = 'announcement_active' LIMIT 1"
    );
    if (!announcementActiveSetting.length) {
      await connection.query(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('announcement_active', 'true')"
      );
    }

    const kmspDefaults = [
      { key: 'kmsp_api_key', val: process.env.KMSP_API_KEY || 'fe5df3e7-e7a8-4e63-8006-374b530024cb' },
      { key: 'kmsp_base_url', val: process.env.KMSP_BASE_URL || 'https://my.kmsp-store.com' },
      { key: 'kmsp_enable_member', val: 'false' },
      { key: 'kmsp_enable_reseller', val: 'false' },
    ];
    for (const item of kmspDefaults) {
      const [existing] = await connection.query(
        'SELECT id FROM settings WHERE setting_key = ? LIMIT 1',
        [item.key]
      );
      if (!existing.length) {
        await connection.query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)',
          [item.key, item.val]
        );
      }
    }

    const digiflazzDefaults = [
      { key: 'digiflazz_username', val: process.env.DIGIFLAZZ_USERNAME || 'tovowaWjYdvD' },
      { key: 'digiflazz_api_key', val: process.env.DIGIFLAZZ_API_KEY || '86a9458b-3f32-58f1-85e5-eaf901bfb7ed' },
      { key: 'digiflazz_testing', val: process.env.DIGIFLAZZ_TESTING || 'true' },
      { key: 'digiflazz_webhook_secret', val: process.env.DIGIFLAZZ_WEBHOOK_SECRET || 'dzaqilahstore2026' },
    ];
    for (const item of digiflazzDefaults) {
      const [existing] = await connection.query(
        'SELECT id FROM settings WHERE setting_key = ? LIMIT 1',
        [item.key]
      );
      if (!existing.length) {
        await connection.query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)',
          [item.key, item.val]
        );
      }
    }

    const [owners] = await connection.query("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
    if (!owners.length) {
      const hashed = await bcrypt.hash('password123', 10);
      await connection.query(
        "INSERT INTO users (name, email, phone, password, role, balance, status) VALUES (?, ?, ?, ?, 'owner', 0, 'active')",
        ['Owner Dzaqilah Store', 'owner@racacell.com', '081234567890', hashed]
      );
      console.log('Default owner created: owner@racacell.com / password123');
    }
  } finally {
    connection.release();
  }

  await loadMarginPercent();
  await loadProductMargins();
  await loadDigiflazzConfig();
};

// ─── Auth Routes ───────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), phone.trim(), hashed, 'user']
    );

    await logActivity(result.insertId, 'register', `User ${name} mendaftar`, { email }, req.ip);

    const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: { id: result.insertId, name, email, phone, role: 'user', balance: 0 },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    await logActivity(user.id, 'login', `User ${user.name} login`, null, req.ip);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password: _, ...userData } = user;
    res.json({ success: true, message: 'Login berhasil', data: userData, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.get('/api/auth/profile', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user });
});

app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, partner_name } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      const trimmedName = String(name || '').trim();
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ success: false, message: 'Nama lengkap minimal 2 karakter' });
      }
      if (trimmedName.length > 100) {
        return res.status(400).json({ success: false, message: 'Nama lengkap maksimal 100 karakter' });
      }
      updates.push('name = ?');
      params.push(trimmedName);
    }

    if (phone !== undefined) {
      const trimmedPhone = String(phone || '').trim();
      if (trimmedPhone) {
        if (trimmedPhone.length < 9 || trimmedPhone.length > 20) {
          return res.status(400).json({ success: false, message: 'Nomor HP tidak valid (9-20 karakter)' });
        }
        const [existingPhone] = await pool.execute(
          'SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1',
          [trimmedPhone, req.user.id]
        );
        if (existingPhone.length) {
          return res.status(400).json({ success: false, message: 'Nomor HP sudah digunakan akun lain' });
        }
      }
      updates.push('phone = ?');
      params.push(trimmedPhone || null);
    }

    if (partner_name !== undefined) {
      const trimmedPartner = String(partner_name || '').trim();
      if (trimmedPartner.length > 100) {
        return res.status(400).json({ success: false, message: 'Nama mitra maksimal 100 karakter' });
      }
      updates.push('partner_name = ?');
      params.push(trimmedPartner || null);
    }

    if (updates.length > 0) {
      params.push(req.user.id);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, partner_name, role, balance, status FROM users WHERE id = ?',
      [req.user.id]
    );

    await logActivity(
      req.user.id,
      'update_profile',
      `Pengguna memperbarui profil akun (${rows[0].name})`,
      { name: rows[0].name, phone: rows[0].phone, partner_name: rows[0].partner_name },
      req.ip
    );

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: rows[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memperbarui profil' });
  }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi' });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
    }

    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Password saat ini tidak sesuai' });
    }

    const hashedPassword = await bcrypt.hash(String(new_password), 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    await logActivity(
      req.user.id,
      'change_password',
      'Pengguna berhasil mengganti password akun',
      null,
      req.ip
    );

    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mengganti password' });
  }
});

// ─── Users Routes ────────────────────────────────────────────────────────────

app.get('/api/users', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const role = req.query.role?.trim() || '';
    const sort = ['name', 'email', 'balance', 'created_at'].includes(req.query.sort) ? req.query.sort : 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }

    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM users ${where}`, params);
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, role, balance, status, created_at FROM users ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/users', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { name, email, phone, password, role = 'user' } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }
    if (!['user', 'reseller', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid' });
    }
    if (role === 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Hanya owner yang bisa membuat admin' });
    }
    if (role === 'owner') {
      return res.status(400).json({ success: false, message: 'Tidak bisa membuat user owner' });
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), phone.trim(), hashed, role]
    );

    await logActivity(req.user.id, 'create_user', `Membuat user ${name} (${role})`, { userId: result.insertId }, req.ip);

    res.status(201).json({
      success: true,
      message: 'User berhasil dibuat',
      data: { id: result.insertId, name, email, phone, role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/users/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, status } = req.body;

    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    if (existing[0].role === 'owner' && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Tidak bisa mengubah owner' });
    }

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (phone) { updates.push('phone = ?'); params.push(phone.trim()); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (role) {
      if (role === 'owner' && existing[0].role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Tidak bisa mengubah menjadi role owner' });
      }
      if (role === 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Hanya owner yang bisa mengubah user menjadi admin' });
      }
      if (!['user', 'reseller', 'admin', 'owner'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Role tidak valid' });
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });
    }

    params.push(id);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logActivity(req.user.id, 'update_user', `Mengubah user ID ${id}`, req.body, req.ip);

    res.json({ success: true, message: 'User berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/users/:id', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    if (existing[0].role === 'owner') {
      return res.status(400).json({ success: false, message: 'Tidak bisa menghapus owner' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    await logActivity(req.user.id, 'delete_user', `Menghapus user ${existing[0].name}`, { userId: id }, req.ip);

    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/users/:id/reset-password', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password baru wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
    }

    const [existing] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const targetUser = existing[0];
    if (targetUser.role === 'owner' && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Tidak bisa reset password owner' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);

    await logActivity(
      req.user.id,
      'reset_user_password',
      `Reset password user ${targetUser.name} (ID ${id})`,
      { userId: id, target_email: targetUser.email },
      req.ip
    );

    res.json({ success: true, message: 'Password user berhasil direset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Balance Routes ────────────────────────────────────────────────────────

app.post('/api/users/:id/balance', authenticate, authorize('owner', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { type, amount, note } = req.body;

    if (!['topup', 'add', 'reduce'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipe tidak valid' });
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus lebih dari 0' });
    }

    await connection.beginTransaction();

    const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!users.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = users[0];
    const balanceBefore = parseFloat(user.balance);
    let balanceAfter;

    if (type === 'reduce') {
      if (balanceBefore < amt) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
      }
      balanceAfter = balanceBefore - amt;
    } else {
      balanceAfter = balanceBefore + amt;
    }

    await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, id]);
    await connection.execute(
      'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, type, amt, balanceBefore, balanceAfter, note || null, req.user.id]
    );

    await connection.commit();

    const actionLabel = { topup: 'Topup saldo', add: 'Tambah saldo', reduce: 'Kurangi saldo' };
    await logActivity(
      req.user.id,
      `balance_${type}`,
      `${actionLabel[type]} Rp ${amt.toLocaleString('id-ID')} untuk ${user.name}`,
      { userId: id, amount: amt, type },
      req.ip
    );

    res.json({
      success: true,
      message: 'Saldo berhasil diperbarui',
      data: { balance_before: balanceBefore, balance_after: balanceAfter },
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
});

app.get('/api/balance/history', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const type = req.query.type?.trim() || '';
    const userId = !['owner', 'admin'].includes(req.user.role) ? req.user.id : req.query.user_id || null;

    let where = 'WHERE 1=1';
    const params = [];

    if (userId) {
      where += ' AND bt.user_id = ?';
      params.push(userId);
    }
    if (type) {
      where += ' AND bt.type = ?';
      params.push(type);
    }
    if (search) {
      where += ' AND (u.name LIKE ? OR bt.note LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM balance_transactions bt JOIN users u ON bt.user_id = u.id ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT bt.*, u.name as user_name, u.email as user_email,
              cb.name as created_by_name
       FROM balance_transactions bt
       JOIN users u ON bt.user_id = u.id
       LEFT JOIN users cb ON bt.created_by = cb.id
       ${where}
       ORDER BY bt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Products Routes ───────────────────────────────────────────────────────

app.get('/api/products/prepaid', authenticate, async (req, res) => {
  try {
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Digiflazz API belum dikonfigurasi. Atur DIGIFLAZZ_USERNAME dan DIGIFLAZZ_API_KEY di .env',
      });
    }

    const products = await getDigiflazzPriceList();
    const search = req.query.search?.trim().toLowerCase() || '';
    const brand = req.query.brand?.trim() || '';
    const category = req.query.category?.trim() || '';
    const type = req.query.type?.trim() || '';
    const service = req.query.service?.trim().toLowerCase() || '';

    if (service && !PREPAID_SERVICE_IDS.includes(service)) {
      return res.status(400).json({ success: false, message: 'Jenis layanan tidak valid' });
    }

    let raw = products;
    if (service) raw = raw.filter((p) => matchPrepaidService(p, service));
    if (brand) raw = raw.filter((p) => (p.brand || '').toLowerCase() === brand.toLowerCase());
    if (category) raw = raw.filter((p) => (p.category || '').toLowerCase() === category.toLowerCase());
    if (type) raw = raw.filter((p) => (p.type || '').toLowerCase() === type.toLowerCase());

    const marginsMap = await fetchProductMarginsMap();
    let data = mapPrepaidProducts(raw, marginsMap, req.user.role);

    if (search) {
      data = data.filter(
        (p) =>
          p.product_name.toLowerCase().includes(search) ||
          p.brand.toLowerCase().includes(search) ||
          p.buyer_sku_code.toLowerCase().includes(search)
      );
    }

    // Sort by selling price ascending (cheapest to most expensive) by default
    const sortOrder = req.query.sort?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    data.sort((a, b) => {
      const priceA = parseFloat(a.selling_price ?? a.price ?? 0);
      const priceB = parseFloat(b.selling_price ?? b.price ?? 0);
      return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
    });

    const { page, limit, offset } = getPagination(req.query);
    const total = data.length;
    const paginated = data.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: paginationMeta(page, limit, total),
      margin_percent: req.user.role === 'reseller' ? resellerMarginPercent : marginPercent,
      member_margin_percent: marginPercent,
      reseller_margin_percent: resellerMarginPercent,
      user_role: req.user.role,
    });
  } catch (err) {
    console.error('Digiflazz price-list error:', err.message, err.digiflazzResponse || '');
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar produk' });
  }
});

app.get('/api/products/pasca', authenticate, async (req, res) => {
  try {
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Digiflazz API belum dikonfigurasi. Atur DIGIFLAZZ_USERNAME dan DIGIFLAZZ_API_KEY di .env',
      });
    }

    const products = await getDigiflazzPascaPriceList();
    const search = req.query.search?.trim().toLowerCase() || '';
    const brand = req.query.brand?.trim() || '';
    const service = req.query.service?.trim().toLowerCase() || '';

    if (service && !PASCA_SERVICE_IDS.includes(service)) {
      return res.status(400).json({ success: false, message: 'Jenis layanan pascabayar tidak valid' });
    }

    let raw = products;
    if (service) raw = raw.filter((p) => matchPascaService(p, service));
    if (brand) raw = raw.filter((p) => p.brand === brand);

    const marginsMap = await fetchProductMarginsMap();
    let data = mapPascaProducts(raw, marginsMap, req.user.role);

    if (search) {
      data = data.filter(
        (p) =>
          p.product_name.toLowerCase().includes(search) ||
          p.brand.toLowerCase().includes(search) ||
          p.buyer_sku_code.toLowerCase().includes(search)
      );
    }

    // Sort by admin fee ascending by default
    const sortOrder = req.query.sort?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    data.sort((a, b) => {
      const adminA = parseFloat(a.admin ?? 0);
      const adminB = parseFloat(b.admin ?? 0);
      return sortOrder === 'desc' ? adminB - adminA : adminA - adminB;
    });

    const { page, limit, offset } = getPagination(req.query);
    const total = data.length;
    const paginated = data.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: paginationMeta(page, limit, total),
      margin_percent: req.user.role === 'reseller' ? resellerMarginPercent : marginPercent,
      member_margin_percent: marginPercent,
      reseller_margin_percent: resellerMarginPercent,
      user_role: req.user.role,
    });
  } catch (err) {
    console.error('Digiflazz pasca price-list error:', err.message, err.digiflazzResponse || '');
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar produk pascabayar' });
  }
});

app.get('/api/products/services', authenticate, async (req, res) => {
  try {
    const [allPrepaidRaw, allPascaRaw, marginsMap] = await Promise.all([
      getDigiflazzPriceList(),
      getDigiflazzPascaPriceList().catch(() => []),
      fetchProductMarginsMap(),
    ]);

    const data = SERVICE_IDS.map((id) => {
      const isPasca = PASCA_SERVICE_IDS.includes(id);
      const source = isPasca ? allPascaRaw : allPrepaidRaw;
      const matcher = isPasca ? matchPascaService : matchPrepaidService;
      const isListed = (p) => (isPasca ? isPascaListed(p) : Boolean(p.buyer_product_status && p.seller_product_status));
      return {
        id,
        total: source.filter((p) => isListed(p) && matcher(p, id)).length,
      };
    });

    res.json({
      success: true,
      data,
      total_products: mapPrepaidProducts(allPrepaidRaw, marginsMap).length + mapPascaProducts(allPascaRaw, marginsMap).length,
    });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar layanan' });
  }
});

app.get('/api/products/brands', authenticate, async (req, res) => {
  try {
    const service = req.query.service?.trim().toLowerCase() || '';
    const isPasca = PASCA_SERVICE_IDS.includes(service);

    let products = isPasca ? await getDigiflazzPascaPriceList() : await getDigiflazzPriceList();
    if (service) {
      products = products.filter((p) =>
        isPasca ? matchPascaService(p, service) : matchPrepaidService(p, service)
      );
    }

    const marginsMap = await fetchProductMarginsMap();
    const mapper = isPasca ? mapPascaProducts : mapPrepaidProducts;
    const brands = [...new Set(mapper(products, marginsMap).map((p) => p.brand).filter(Boolean))].sort();
    res.json({ success: true, data: brands });
  } catch (err) {
    console.error('Digiflazz brands error:', err.message);
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar brand' });
  }
});

app.get('/api/products/types', authenticate, async (req, res) => {
  try {
    const service = req.query.service?.trim().toLowerCase() || '';
    const brand = req.query.brand?.trim() || '';
    const isPasca = PASCA_SERVICE_IDS.includes(service);

    let products = isPasca ? await getDigiflazzPascaPriceList() : await getDigiflazzPriceList();
    if (service) {
      products = products.filter((p) =>
        isPasca ? matchPascaService(p, service) : matchPrepaidService(p, service)
      );
    }
    if (brand) {
      products = products.filter((p) => (p.brand || '').toLowerCase() === brand.toLowerCase());
    }

    const marginsMap = await fetchProductMarginsMap();
    const mapper = isPasca ? mapPascaProducts : mapPrepaidProducts;
    const types = [...new Set(mapper(products, marginsMap).map((p) => p.type).filter(Boolean))].sort();
    res.json({ success: true, data: types });
  } catch (err) {
    console.error('Digiflazz types error:', err.message);
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar kategori/tipe paket' });
  }
});

const OPERATOR_PREFIX_MAP = [
  { brand: 'TELKOMSEL', name: 'Telkomsel', prefixes: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'] },
  { brand: 'INDOSAT', name: 'Indosat Ooredoo', prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'] },
  { brand: 'XL', name: 'XL Axiata', prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'] },
  { brand: 'AXIS', name: 'AXIS', prefixes: ['0831', '0832', '0833', '0838'] },
  { brand: 'TRI', name: 'Tri', prefixes: ['0895', '0896', '0897', '0898', '0899'] },
  { brand: 'SMARTFREN', name: 'Smartfren', prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'] },
];

app.get('/api/products/detect-operator', authenticate, (req, res) => {
  let phone = String(req.query.phone || '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('+62')) phone = '0' + phone.slice(3);
  else if (phone.startsWith('62')) phone = '0' + phone.slice(2);
  phone = phone.replace(/[^0-9]/g, '');

  if (phone.length < 4) {
    return res.json({ success: true, data: null, message: 'Nomor telepon minimal 4 digit' });
  }

  const prefix4 = phone.slice(0, 4);
  const match = OPERATOR_PREFIX_MAP.find((op) => op.prefixes.includes(prefix4));

  res.json({
    success: true,
    data: match
      ? {
        brand: match.brand,
        name: match.name,
        prefix: prefix4,
        phone,
      }
      : null,
  });
});


app.get('/api/products/categories', authenticate, async (req, res) => {
  try {
    const products = await getDigiflazzPriceList();
    const marginsMap = await fetchProductMarginsMap();
    const categories = [...new Set(mapPrepaidProducts(products, marginsMap).map((p) => p.category).filter(Boolean))].sort();
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('Digiflazz categories error:', err.message);
    res.status(502).json({ success: false, message: err.message || 'Gagal mengambil daftar kategori' });
  }
});

app.post('/api/products/refresh-cache', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({ success: false, message: 'Digiflazz API belum dikonfigurasi' });
    }
    const [prepaidData, pascaData] = await Promise.all([
      getDigiflazzPriceList(true),
      getDigiflazzPascaPriceList(true).catch(() => []),
    ]);
    await logActivity(
      req.user.id,
      'refresh_pricelist',
      `Refresh cache pricelist (prepaid: ${prepaidData.length}, pasca: ${pascaData.length})`,
      null,
      req.ip
    );
    res.json({
      success: true,
      message: 'Cache pricelist berhasil diperbarui',
      data: { prepaid: prepaidData.length, pasca: pascaData.length },
    });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message || 'Gagal refresh cache' });
  }
});

app.get('/api/products/margins', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const search = req.query.search?.trim().toLowerCase() || '';
    const transactionType = req.query.transaction_type?.trim() || '';
    const { page, limit, offset } = getPagination(req.query);

    let query = 'SELECT * FROM product_margins WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (product_name LIKE ? OR buyer_sku_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (transactionType && ['prepaid', 'pasca', 'kmsp'].includes(transactionType)) {
      query += ' AND transaction_type = ?';
      params.push(transactionType);
    }

    const [countRows] = await pool.execute(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const total = countRows[0].total;

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        margin_percent: parseFloat(row.margin_percent),
        reseller_margin_percent:
          row.reseller_margin_percent != null && row.reseller_margin_percent !== ''
            ? parseFloat(row.reseller_margin_percent)
            : null,
      })),
      pagination: paginationMeta(page, limit, total),
      global_margin_percent: marginPercent,
      global_reseller_margin_percent: resellerMarginPercent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/products/margins/:buyer_sku_code', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const buyerSkuCode = normalizeSkuCode(decodeURIComponent(req.params.buyer_sku_code || ''));
    const { margin_percent, reseller_margin_percent, product_name, transaction_type } = req.body;
    const value = parseFloat(margin_percent);
    const resellerValue =
      reseller_margin_percent !== undefined && reseller_margin_percent !== null && reseller_margin_percent !== ''
        ? parseFloat(reseller_margin_percent)
        : null;

    if (!buyerSkuCode) {
      return res.status(400).json({ success: false, message: 'SKU produk wajib diisi' });
    }
    if (Number.isNaN(value) || value < 0 || value > 100) {
      return res.status(400).json({ success: false, message: 'Margin member harus antara 0% - 100%' });
    }
    if (resellerValue !== null && (Number.isNaN(resellerValue) || resellerValue < 0 || resellerValue > 100)) {
      return res.status(400).json({ success: false, message: 'Margin reseller harus antara 0% - 100%' });
    }

    const type = transaction_type === 'pasca' ? 'pasca' : transaction_type === 'kmsp' ? 'kmsp' : 'prepaid';
    const name = (product_name || buyerSkuCode).trim().slice(0, 200);

    await pool.execute(
      `INSERT INTO product_margins (buyer_sku_code, product_name, transaction_type, margin_percent, reseller_margin_percent, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         product_name = VALUES(product_name),
         transaction_type = VALUES(transaction_type),
         margin_percent = VALUES(margin_percent),
         reseller_margin_percent = VALUES(reseller_margin_percent),
         updated_by = VALUES(updated_by)`,
      [buyerSkuCode, name, type, value, resellerValue, req.user.id]
    );

    productMargins.set(buyerSkuCode, {
      margin_percent: value,
      reseller_margin_percent: resellerValue,
    });

    await logActivity(
      req.user.id,
      'update_product_margin',
      `Mengatur margin produk ${name} (${buyerSkuCode}): Member ${value}%, Reseller ${resellerValue ?? resellerMarginPercent}%`,
      { buyer_sku_code: buyerSkuCode, margin_percent: value, reseller_margin_percent: resellerValue, transaction_type: type },
      req.ip
    );

    res.json({
      success: true,
      message: 'Margin produk berhasil disimpan',
      data: {
        buyer_sku_code: buyerSkuCode,
        product_name: name,
        transaction_type: type,
        margin_percent: value,
        reseller_margin_percent: resellerValue,
        has_custom_margin: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/products/margins/:buyer_sku_code', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const buyerSkuCode = normalizeSkuCode(decodeURIComponent(req.params.buyer_sku_code || ''));

    if (!buyerSkuCode) {
      return res.status(400).json({ success: false, message: 'SKU produk wajib diisi' });
    }

    const [existing] = await pool.execute(
      'SELECT product_name FROM product_margins WHERE LOWER(TRIM(buyer_sku_code)) = ? LIMIT 1',
      [buyerSkuCode]
    );

    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Margin khusus produk tidak ditemukan' });
    }

    await pool.execute('DELETE FROM product_margins WHERE LOWER(TRIM(buyer_sku_code)) = ?', [buyerSkuCode]);
    productMargins.delete(buyerSkuCode);

    await logActivity(
      req.user.id,
      'reset_product_margin',
      `Menghapus margin khusus produk ${existing[0].product_name} (${buyerSkuCode}), kembali ke margin global ${marginPercent}%`,
      { buyer_sku_code: buyerSkuCode },
      req.ip
    );

    res.json({
      success: true,
      message: 'Margin produk dikembalikan ke pengaturan global',
      data: {
        buyer_sku_code: buyerSkuCode,
        margin_percent: marginPercent,
        has_custom_margin: false,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Transaction Routes ────────────────────────────────────────────────────

app.post('/api/transactions/topup', authenticate, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { buyer_sku_code, customer_no, product_name, category, brand, price } = req.body;

    if (!buyer_sku_code || !customer_no || !price) {
      return res.status(400).json({ success: false, message: 'Data transaksi tidak lengkap' });
    }

    const basePrice = parseFloat(price);
    const marginsMap = await fetchProductMarginsMap();
    const sellPrice = calcSellingPrice(basePrice, buyer_sku_code, req.user.role, marginsMap);

    await connection.beginTransaction();

    const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
    const user = users[0];
    const balanceBefore = parseFloat(user.balance);

    if (balanceBefore < sellPrice) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
    }

    const refId = generateRefId();
    let digiflazzResult;
    let status = 'failed';
    let sn = null;
    let message = 'Transaksi gagal';

    if (DIGIFLAZZ_USERNAME && DIGIFLAZZ_API_KEY) {
      digiflazzResult = await processDigiflazzTopup(refId, buyer_sku_code, customer_no);
      const data = digiflazzResult?.data;
      if (data) {
        status = mapDigiflazzStatus(data.status);
        sn = data.sn || null;
        message = data.message || message;
      }
    } else {
      status = 'success';
      message = 'Transaksi simulasi (Digiflazz belum dikonfigurasi)';
      sn = `SIM${Date.now()}`;
      digiflazzResult = { simulated: true };
    }

    if (status === 'failed') {
      await connection.execute(
        `INSERT INTO transactions (user_id, ref_id, customer_no, buyer_sku_code, product_name, category, brand, transaction_type, price, selling_price, status, sn, message, digiflazz_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'prepaid', ?, ?, ?, ?, ?, ?)`,
        [req.user.id, refId, customer_no, buyer_sku_code, product_name || buyer_sku_code, category, brand, basePrice, sellPrice, status, sn, message, JSON.stringify(digiflazzResult)]
      );
      await connection.commit();

      await logActivity(req.user.id, 'transaction_failed', `Transaksi gagal ke ${customer_no}`, { refId }, req.ip);

      return res.status(400).json({ success: false, message, data: { ref_id: refId, status } });
    }

    const balanceAfter = balanceBefore - sellPrice;
    await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, req.user.id]);
    await connection.execute(
      'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, 'purchase', sellPrice, balanceBefore, balanceAfter, `Pembelian ${product_name} - ${customer_no}`, req.user.id]
    );
    await connection.execute(
      `INSERT INTO transactions (user_id, ref_id, customer_no, buyer_sku_code, product_name, category, brand, transaction_type, price, selling_price, status, sn, message, digiflazz_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'prepaid', ?, ?, ?, ?, ?, ?)`,
      [req.user.id, refId, customer_no, buyer_sku_code, product_name || buyer_sku_code, category, brand, basePrice, sellPrice, status, sn, message, JSON.stringify(digiflazzResult)]
    );

    await connection.commit();

    await logActivity(
      req.user.id,
      'transaction',
      `Transaksi ${product_name} ke ${customer_no} - Rp ${sellPrice.toLocaleString('id-ID')}`,
      { refId, status },
      req.ip
    );

    res.json({
      success: true,
      message: status === 'pending' ? 'Transaksi pending, mohon tunggu' : 'Transaksi berhasil',
      data: {
        ref_id: refId,
        status,
        sn,
        message,
        balance_after: balanceAfter,
        selling_price: sellPrice,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat transaksi' });
  } finally {
    connection.release();
  }
});

app.post('/api/transactions/pasca/inquiry', authenticate, async (req, res) => {
  try {
    const { buyer_sku_code, customer_no, product_name, category, brand } = req.body;

    if (!buyer_sku_code || !customer_no) {
      return res.status(400).json({ success: false, message: 'Data inquiry tidak lengkap' });
    }
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({ success: false, message: 'Digiflazz API belum dikonfigurasi' });
    }

    const refId = generateRefId();
    const digiflazzResult = await processDigiflazzPasca('inq-pasca', refId, buyer_sku_code, customer_no);
    const data = digiflazzResult?.data;

    if (!data || mapDigiflazzStatus(data.status) === 'failed') {
      return res.status(400).json({
        success: false,
        message: data?.message || 'Gagal cek tagihan',
      });
    }

    const basePrice = parseFloat(data.price) || parseFloat(data.selling_price) || 0;
    const marginsMap = await fetchProductMarginsMap();
    const sellingPrice = calcPascaSellingPrice(data.selling_price || data.price, buyer_sku_code, req.user.role, marginsMap);

    await pool.execute(
      `INSERT INTO pasca_inquiries
        (user_id, ref_id, buyer_sku_code, customer_no, product_name, category, brand, base_price, selling_price, customer_name, inquiry_response, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [
        req.user.id,
        refId,
        buyer_sku_code,
        customer_no,
        product_name || data.product_name || buyer_sku_code,
        category || data.category || null,
        brand || data.brand || null,
        basePrice,
        sellingPrice,
        data.customer_name || null,
        JSON.stringify(digiflazzResult),
      ]
    );

    res.json({
      success: true,
      message: 'Tagihan ditemukan',
      data: {
        ref_id: refId,
        customer_no: data.customer_no,
        customer_name: data.customer_name,
        buyer_sku_code,
        product_name: product_name || data.product_name || buyer_sku_code,
        base_price: basePrice,
        selling_price: sellingPrice,
        admin: data.admin,
        periode: data.periode,
        desc: data.desc,
        message: data.message,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat cek tagihan' });
  }
});

app.post('/api/transactions/pasca/pay', authenticate, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { ref_id } = req.body;

    if (!ref_id) {
      return res.status(400).json({ success: false, message: 'Ref ID inquiry wajib diisi' });
    }
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({ success: false, message: 'Digiflazz API belum dikonfigurasi' });
    }

    await connection.beginTransaction();

    const [inquiries] = await connection.execute(
      `SELECT * FROM pasca_inquiries WHERE ref_id = ? AND user_id = ? FOR UPDATE`,
      [ref_id, req.user.id]
    );

    if (!inquiries.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Data inquiry tidak ditemukan' });
    }

    const inquiry = inquiries[0];
    if (inquiry.paid_at) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Tagihan ini sudah dibayar' });
    }
    if (new Date(inquiry.expires_at) < new Date()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Inquiry kedaluwarsa, silakan cek tagihan ulang' });
    }

    const sellPrice = parseFloat(inquiry.selling_price);
    const basePrice = parseFloat(inquiry.base_price);

    const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
    const balanceBefore = parseFloat(users[0].balance);

    if (balanceBefore < sellPrice) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
    }

    const digiflazzResult = await processDigiflazzPasca(
      'pay-pasca',
      inquiry.ref_id,
      inquiry.buyer_sku_code,
      inquiry.customer_no
    );
    const data = digiflazzResult?.data;
    let status = 'failed';
    let sn = null;
    let message = 'Pembayaran gagal';

    if (data) {
      status = mapDigiflazzStatus(data.status);
      sn = data.sn || null;
      message = data.message || message;
    }

    if (status === 'failed') {
      await connection.execute(
        `INSERT INTO transactions (user_id, ref_id, customer_no, buyer_sku_code, product_name, category, brand, transaction_type, price, selling_price, status, sn, message, digiflazz_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pasca', ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          inquiry.ref_id,
          inquiry.customer_no,
          inquiry.buyer_sku_code,
          inquiry.product_name,
          inquiry.category,
          inquiry.brand,
          basePrice,
          sellPrice,
          status,
          sn,
          message,
          JSON.stringify(digiflazzResult),
        ]
      );
      await connection.commit();
      await logActivity(req.user.id, 'transaction_failed', `Bayar tagihan gagal ${inquiry.customer_no}`, { refId: ref_id }, req.ip);
      return res.status(400).json({ success: false, message, data: { ref_id, status } });
    }

    const balanceAfter = balanceBefore - sellPrice;
    await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, req.user.id]);
    await connection.execute(
      'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        'purchase',
        sellPrice,
        balanceBefore,
        balanceAfter,
        `Bayar tagihan ${inquiry.product_name} - ${inquiry.customer_no}`,
        req.user.id,
      ]
    );
    await connection.execute(
      `INSERT INTO transactions (user_id, ref_id, customer_no, buyer_sku_code, product_name, category, brand, transaction_type, price, selling_price, status, sn, message, digiflazz_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pasca', ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        inquiry.ref_id,
        inquiry.customer_no,
        inquiry.buyer_sku_code,
        inquiry.product_name,
        inquiry.category,
        inquiry.brand,
        basePrice,
        sellPrice,
        status,
        sn,
        message,
        JSON.stringify(digiflazzResult),
      ]
    );
    await connection.execute('UPDATE pasca_inquiries SET paid_at = NOW() WHERE id = ?', [inquiry.id]);
    await connection.commit();

    await logActivity(
      req.user.id,
      'transaction',
      `Bayar tagihan ${inquiry.product_name} - ${inquiry.customer_no} - Rp ${sellPrice.toLocaleString('id-ID')}`,
      { refId: ref_id, status, type: 'pasca' },
      req.ip
    );

    res.json({
      success: true,
      message: status === 'pending' ? 'Pembayaran pending, mohon tunggu' : 'Pembayaran berhasil',
      data: {
        ref_id,
        status,
        sn,
        message,
        balance_after: balanceAfter,
        selling_price: sellPrice,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat pembayaran' });
  } finally {
    connection.release();
  }
});

app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const status = req.query.status?.trim() || '';
    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    const userId = isAdmin ? req.query.user_id || null : req.user.id;

    let where = 'WHERE 1=1';
    const params = [];

    if (userId) {
      where += ' AND t.user_id = ?';
      params.push(userId);
    }
    if (status) {
      where += ' AND t.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (t.customer_no LIKE ? OR t.product_name LIKE ? OR t.ref_id LIKE ? OR u.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM transactions t JOIN users u ON t.user_id = u.id ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT t.*, u.name as user_name FROM transactions t JOIN users u ON t.user_id = u.id ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.get('/api/transactions/:id', authenticate, async (req, res) => {
  try {
    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    const [rows] = await pool.execute(
      `SELECT t.*, u.name as user_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    if (!isAdmin && rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/transactions/:id/check-status', authenticate, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    const [rows] = await connection.execute('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const transaction = rows[0];
    if (!isAdmin && transaction.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    if (transaction.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Hanya transaksi pending yang bisa dicek ulang' });
    }

    const isKmsp = transaction.transaction_type === 'kmsp';
    if (isKmsp) {
      const kmspResult = await callKmspEndpoint('check_transaction', { trx_id: transaction.ref_id });
      const kmspData = kmspResult?.data;
      if (!kmspData || (Array.isArray(kmspData) && kmspData.length === 0)) {
        return res.status(502).json({
          success: false,
          message: kmspResult?.message || 'Gagal memeriksa status ke KMSP',
        });
      }

      await connection.beginTransaction();
      const [locked] = await connection.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transaction.id]);
      const current = locked[0];

      if (current.status !== 'pending') {
        await connection.commit();
        return res.json({
          success: true,
          message: 'Status transaksi sudah selesai',
          data: { status: current.status, sn: current.sn, message: current.message },
        });
      }

      const result = await applyKmspTransactionStatusUpdate(connection, current, kmspData, kmspResult.raw || kmspResult);
      await connection.commit();

      if (result.refunded) {
        await logActivity(
          current.user_id,
          'transaction_refund',
          `Refund otomatis transaksi gagal KMSP ${current.ref_id}`,
          { refId: current.ref_id, amount: current.selling_price },
          req.ip
        );
      }
      if (result.oldStatus !== result.newStatus) {
        await logActivity(
          current.user_id,
          'transaction_status_update',
          `Status transaksi KMSP ${current.ref_id}: ${result.oldStatus} → ${result.newStatus}`,
          { refId: current.ref_id, source: 'check_status' },
          req.ip
        );
      }

      const statusMessages = {
        success: 'Transaksi berhasil',
        pending: 'Transaksi masih diproses di KMSP',
        failed: result.refunded ? 'Transaksi gagal, saldo telah dikembalikan' : 'Transaksi gagal',
      };

      return res.json({
        success: true,
        message: statusMessages[result.newStatus] || 'Status diperbarui',
        data: {
          status: result.newStatus,
          sn: result.sn,
          message: result.message,
          refunded: result.refunded,
          balance_after: result.balanceAfter,
        },
      });
    }

    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      return res.status(503).json({ success: false, message: 'Digiflazz API belum dikonfigurasi' });
    }

    const isPasca = transaction.transaction_type === 'pasca';
    const digiflazzResult = isPasca
      ? await processDigiflazzPasca(
        'pay-pasca',
        transaction.ref_id,
        transaction.buyer_sku_code,
        transaction.customer_no
      )
      : await processDigiflazzTopup(
        transaction.ref_id,
        transaction.buyer_sku_code,
        transaction.customer_no
      );
    const data = digiflazzResult?.data;
    if (!data) {
      return res.status(502).json({
        success: false,
        message: digiflazzResult?.message || 'Gagal memeriksa status ke Digiflazz',
      });
    }

    await connection.beginTransaction();
    const [locked] = await connection.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transaction.id]);
    const current = locked[0];

    if (current.status !== 'pending') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Status transaksi sudah diperbarui',
        data: { status: current.status, sn: current.sn, message: current.message },
      });
    }

    const result = await applyTransactionStatusUpdate(connection, current, data, digiflazzResult);
    await connection.commit();

    if (result.refunded) {
      await logActivity(
        current.user_id,
        'transaction_refund',
        `Refund otomatis transaksi gagal ${current.ref_id}`,
        { refId: current.ref_id, amount: current.selling_price },
        req.ip
      );
    }
    if (result.oldStatus !== result.newStatus) {
      await logActivity(
        current.user_id,
        'transaction_status_update',
        `Status transaksi ${current.ref_id}: ${result.oldStatus} → ${result.newStatus}`,
        { refId: current.ref_id, source: 'check_status' },
        req.ip
      );
    }

    const statusMessages = {
      success: 'Transaksi berhasil',
      pending: 'Transaksi masih diproses',
      failed: result.refunded ? 'Transaksi gagal, saldo telah dikembalikan' : 'Transaksi gagal',
    };

    res.json({
      success: true,
      message: statusMessages[result.newStatus] || 'Status diperbarui',
      data: {
        status: result.newStatus,
        sn: result.sn,
        message: result.message,
        refunded: result.refunded,
        balance_after: result.balanceAfter,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat cek status' });
  } finally {
    connection.release();
  }
});

// ─── Digiflazz Webhook ─────────────────────────────────────────────────────
// Daftarkan URL di panel Digiflazz: Pengaturan Koneksi API → Webhook
// URL: https://api.kingcreativestudio.my.id/dzaqilah-store/api/webhooks/digiflazz
// Content-Type: application/json
// Secret: (opsional / boleh dikosongkan atau disamakan dengan DIGIFLAZZ_WEBHOOK_SECRET)

app.post(['/api/webhooks/digiflazz', '/webhooks/digiflazz'], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const event = req.headers['x-digiflazz-event'] || 'unknown';
    const signature = req.headers['x-hub-signature'];
    const webhookSecret = process.env.DIGIFLAZZ_WEBHOOK_SECRET;

    // Verifikasi HMAC-SHA1 signature jika Secret dikonfigurasi
    if (webhookSecret && signature) {
      const rawPayload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      const expectedSig = 'sha1=' + crypto.createHmac('sha1', webhookSecret).update(rawPayload).digest('hex');
      if (signature !== expectedSig) {
        console.warn(`[webhook] Signature mismatch: diterima=${signature}, dihitung=${expectedSig}`);
      }
    }

    const payload = parseDigiflazzPayload(req.body);
    const refId = payload?.ref_id;

    if (!refId) {
      return res.status(400).json({ ok: false, message: 'ref_id tidak ditemukan' });
    }

    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM transactions WHERE ref_id = ? FOR UPDATE', [refId]);

    if (!rows.length) {
      await connection.commit();
      console.log(`[webhook] ${event} ref_id=${refId} — transaksi tidak ditemukan`);
      return res.status(200).json({ ok: true, message: 'Transaksi tidak ditemukan' });
    }

    const transaction = rows[0];
    const result = await applyTransactionStatusUpdate(connection, transaction, payload, req.body);
    await connection.commit();

    if (result.refunded) {
      await logActivity(
        transaction.user_id,
        'transaction_refund',
        `Refund otomatis transaksi gagal ${refId} (webhook)`,
        { refId, amount: transaction.selling_price, event },
        req.ip
      );
    }
    if (result.oldStatus !== result.newStatus) {
      await logActivity(
        transaction.user_id,
        'transaction_status_update',
        `Status transaksi ${refId}: ${result.oldStatus} → ${result.newStatus} (webhook)`,
        { refId, event, source: 'webhook' },
        req.ip
      );
    }

    console.log(`[webhook] ${event} ref_id=${refId} ${result.oldStatus} → ${result.newStatus}`);
    res.status(200).json({ ok: true, ref_id: refId, status: result.newStatus, refunded: result.refunded });
  } catch (err) {
    await connection.rollback();
    console.error('[webhook] error:', err);
    res.status(500).json({ ok: false, message: 'Internal error' });
  } finally {
    connection.release();
  }
});

// ─── Activity Logs ─────────────────────────────────────────────────────────

app.get('/api/activity-logs', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const action = req.query.action?.trim() || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (al.description LIKE ? OR u.name LIKE ? OR al.action LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (action) {
      where += ' AND al.action = ?';
      params.push(action);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Dashboard Stats ───────────────────────────────────────────────────────

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const isAdmin = ['owner', 'admin'].includes(req.user.role);

    if (isAdmin) {
      const [userCount] = await pool.execute("SELECT COUNT(*) as total FROM users WHERE role IN ('user', 'reseller')");
      const [resellerCount] = await pool.execute("SELECT COUNT(*) as total FROM users WHERE role = 'reseller'");
      const [memberCount] = await pool.execute("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
      const [txToday] = await pool.execute(
        "SELECT COUNT(*) as total, COALESCE(SUM(selling_price), 0) as revenue FROM transactions WHERE DATE(created_at) = CURDATE() AND status != 'failed'"
      );
      const [txSuccess] = await pool.execute("SELECT COUNT(*) as total FROM transactions WHERE status = 'success'");
      const [txPending] = await pool.execute("SELECT COUNT(*) as total FROM transactions WHERE status = 'pending'");
      const [topupPending] = await pool.execute(
        "SELECT COUNT(*) as total FROM topup_requests WHERE status = 'pending'"
      );

      return res.json({
        success: true,
        data: {
          total_users: userCount[0].total,
          total_resellers: resellerCount[0].total,
          total_members: memberCount[0].total,
          transactions_today: txToday[0].total,
          revenue_today: parseFloat(txToday[0].revenue),
          transactions_success: txSuccess[0].total,
          transactions_pending: txPending[0].total,
          topup_requests_pending: topupPending[0].total,
        },
      });
    }

    const [txCount] = await pool.execute('SELECT COUNT(*) as total FROM transactions WHERE user_id = ?', [req.user.id]);
    const [txSuccess] = await pool.execute(
      "SELECT COUNT(*) as total FROM transactions WHERE user_id = ? AND status = 'success'",
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        balance: parseFloat(req.user.balance),
        total_transactions: txCount[0].total,
        success_transactions: txSuccess[0].total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Topup Request Routes ──────────────────────────────────────────────────

app.post('/api/topup-requests', authenticate, (req, res, next) => {
  uploadTopupProof.single('proof')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ukuran bukti transfer maksimal 2MB' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Gagal memproses file bukti transfer' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { amount, note, bank_name, account_number, account_name } = req.body;
    const amt = parseFloat(amount);
    const proofImage = req.file ? `/uploads/topup/${req.file.filename}` : null;

    if (!amt || amt <= 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Jumlah topup harus lebih dari 0' });
    }
    if (amt < 10000) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Minimum request topup Rp 10.000' });
    }

    const [pending] = await pool.execute(
      "SELECT id FROM topup_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
      [req.user.id]
    );
    if (pending.length) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Anda masih memiliki request topup yang menunggu persetujuan admin',
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO topup_requests (user_id, amount, note, proof_image, bank_name, account_number, account_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        amt,
        note?.trim() || null,
        proofImage,
        bank_name?.trim() || null,
        account_number?.trim() || null,
        account_name?.trim() || null,
      ]
    );

    await logActivity(
      req.user.id,
      'topup_request',
      `Request topup saldo Rp ${amt.toLocaleString('id-ID')}${bank_name ? ` (Tujuan: ${bank_name})` : ''}${proofImage ? ' (dengan bukti transfer)' : ''}`,
      { requestId: result.insertId, amount: amt, bank: bank_name, hasProof: Boolean(proofImage) },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Request topup berhasil dikirim. Tunggu konfirmasi admin.',
      data: { id: result.insertId, amount: amt, status: 'pending', proof_image: proofImage },
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.get('/api/topup-requests', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const status = req.query.status?.trim() || '';
    const isAdmin = ['owner', 'admin'].includes(req.user.role);

    let where = 'WHERE 1=1';
    const params = [];

    if (!isAdmin) {
      where += ' AND tr.user_id = ?';
      params.push(req.user.id);
    }
    if (status) {
      where += ' AND tr.status = ?';
      params.push(status);
    }
    if (search && isAdmin) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM topup_requests tr JOIN users u ON tr.user_id = u.id ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT tr.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
              pb.name as processed_by_name
       FROM topup_requests tr
       JOIN users u ON tr.user_id = u.id
       LEFT JOIN users pb ON tr.processed_by = pb.id
       ${where}
       ORDER BY tr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/topup-requests/:id/approve', authenticate, authorize('owner', 'admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    await connection.beginTransaction();

    const [requests] = await connection.execute(
      "SELECT * FROM topup_requests WHERE id = ? AND status = 'pending' FOR UPDATE",
      [id]
    );
    if (!requests.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan atau sudah diproses' });
    }

    const request = requests[0];
    const amt = parseFloat(request.amount);

    const [users] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [request.user_id]);
    const user = users[0];
    const balanceBefore = parseFloat(user.balance);
    const balanceAfter = balanceBefore + amt;

    await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, request.user_id]);
    await connection.execute(
      'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        request.user_id,
        'topup',
        amt,
        balanceBefore,
        balanceAfter,
        `Topup dari request #${id}${admin_note ? ` - ${admin_note}` : ''}`,
        req.user.id,
      ]
    );
    await connection.execute(
      `UPDATE topup_requests SET status = 'approved', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [admin_note?.trim() || null, req.user.id, id]
    );

    await connection.commit();

    await logActivity(
      req.user.id,
      'topup_request_approve',
      `Menyetujui request topup Rp ${amt.toLocaleString('id-ID')} untuk ${user.name}`,
      { requestId: id, userId: request.user_id, amount: amt },
      req.ip
    );

    res.json({
      success: true,
      message: 'Request topup disetujui dan saldo ditambahkan',
      data: { balance_after: balanceAfter },
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    connection.release();
  }
});

app.put('/api/topup-requests/:id/reject', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const [requests] = await pool.execute(
      "SELECT tr.*, u.name as user_name FROM topup_requests tr JOIN users u ON tr.user_id = u.id WHERE tr.id = ? AND tr.status = 'pending'",
      [id]
    );
    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan atau sudah diproses' });
    }

    await pool.execute(
      `UPDATE topup_requests SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [admin_note?.trim() || 'Ditolak oleh admin', req.user.id, id]
    );

    await logActivity(
      req.user.id,
      'topup_request_reject',
      `Menolak request topup #${id} dari ${requests[0].user_name}`,
      { requestId: id },
      req.ip
    );

    res.json({ success: true, message: 'Request topup ditolak' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Settings Routes ───────────────────────────────────────────────────────

app.get('/api/settings/contact', authenticate, async (req, res) => {
  try {
    const adminWhatsapp = await getSetting('admin_whatsapp', '');
    const normalized = normalizeWhatsApp(adminWhatsapp);
    res.json({
      success: true,
      data: {
        admin_whatsapp: adminWhatsapp,
        whatsapp_url: normalized
          ? `https://wa.me/${normalized}?text=${encodeURIComponent('Halo Admin Dzaqilah Store, saya butuh bantuan.')}`
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.get('/api/settings/whatsapp', authenticate, authorize('owner', 'admin'), async (req, res) => {
  const adminWhatsapp = await getSetting('admin_whatsapp', '');
  res.json({ success: true, data: { admin_whatsapp: adminWhatsapp } });
});

app.put('/api/settings/whatsapp', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { admin_whatsapp } = req.body;
    const phone = String(admin_whatsapp || '').trim();

    if (phone && normalizeWhatsApp(phone).length < 10) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid' });
    }

    await setSetting('admin_whatsapp', phone, req.user.id);

    await logActivity(
      req.user.id,
      'update_whatsapp',
      `Mengubah nomor WhatsApp admin menjadi ${phone || '(kosong)'}`,
      { admin_whatsapp: phone },
      req.ip
    );

    res.json({ success: true, message: 'Nomor WhatsApp admin berhasil disimpan', data: { admin_whatsapp: phone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.get('/api/settings/margin', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      margin_percent: marginPercent,
      margin_reseller_percent: resellerMarginPercent,
    },
  });
});

app.put('/api/settings/margin', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const value = parseFloat(req.body.margin_percent);
    const resellerValue =
      req.body.margin_reseller_percent !== undefined && req.body.margin_reseller_percent !== null && req.body.margin_reseller_percent !== ''
        ? parseFloat(req.body.margin_reseller_percent)
        : null;

    if (Number.isNaN(value) || value < 0 || value > 100) {
      return res.status(400).json({ success: false, message: 'Margin member harus antara 0% - 100%' });
    }
    if (resellerValue !== null && (Number.isNaN(resellerValue) || resellerValue < 0 || resellerValue > 100)) {
      return res.status(400).json({ success: false, message: 'Margin reseller harus antara 0% - 100%' });
    }

    await pool.execute(
      `INSERT INTO settings (setting_key, setting_value, updated_by)
       VALUES ('margin_percent', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [String(value), req.user.id]
    );
    marginPercent = value;

    if (resellerValue !== null) {
      await pool.execute(
        `INSERT INTO settings (setting_key, setting_value, updated_by)
         VALUES ('margin_reseller_percent', ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [String(resellerValue), req.user.id]
      );
      resellerMarginPercent = resellerValue;
    }

    await logActivity(
      req.user.id,
      'update_margin',
      `Mengubah margin: Member ${marginPercent}%, Reseller ${resellerMarginPercent}%`,
      { margin_percent: marginPercent, margin_reseller_percent: resellerMarginPercent },
      req.ip
    );

    res.json({
      success: true,
      message: 'Margin berhasil diperbarui',
      data: {
        margin_percent: marginPercent,
        margin_reseller_percent: resellerMarginPercent,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── Banners Routes ────────────────────────────────────────────────────────

app.get('/api/banners', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const isAll = req.query.all === 'true';
    const sql = isAll
      ? 'SELECT * FROM banners ORDER BY sort_order ASC, id DESC'
      : 'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id DESC';
    const [rows] = await connection.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get banners error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data banner' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/banners', authenticate, authorize('owner', 'admin'), uploadBannerImage.single('image'), async (req, res) => {
  let connection;
  try {
    const { title, description, badge, action_url, sort_order } = req.body;
    const show_text = req.body.show_text === 'true' || req.body.show_text === '1' || req.body.show_text === true;
    const is_active = req.body.is_active === undefined ? true : (req.body.is_active === 'true' || req.body.is_active === '1' || req.body.is_active === true);

    let image_url = '';
    if (req.file) {
      image_url = `/uploads/banners/${req.file.filename}`;
    } else if (req.body.image_url) {
      image_url = req.body.image_url.trim();
    }

    if (!image_url) {
      return res.status(400).json({ success: false, message: 'File gambar banner wajib diunggah' });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO banners (title, description, badge, image_url, action_url, show_text, is_active, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title?.trim() || null,
        description?.trim() || null,
        badge?.trim() || null,
        image_url,
        action_url?.trim() || null,
        show_text ? 1 : 0,
        is_active ? 1 : 0,
        parseInt(sort_order, 10) || 0,
        req.user.id,
      ]
    );

    const newBannerId = result.insertId;
    const [newBanner] = await connection.query('SELECT * FROM banners WHERE id = ?', [newBannerId]);

    await logActivity(
      req.user.id,
      'create_banner',
      `Menambahkan banner baru: "${title || 'Banner tanpa teks'}"`,
      { bannerId: newBannerId, title, image_url },
      req.ip
    );

    res.status(201).json({ success: true, message: 'Banner berhasil ditambahkan', data: newBanner[0] });
  } catch (err) {
    console.error('Create banner error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal menambahkan banner' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/banners/:id', authenticate, authorize('owner', 'admin'), uploadBannerImage.single('image'), async (req, res) => {
  let connection;
  try {
    const id = parseInt(req.params.id, 10);
    connection = await pool.getConnection();

    const [existing] = await connection.query('SELECT * FROM banners WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Banner tidak ditemukan' });
    }

    const current = existing[0];
    const title = req.body.title !== undefined ? (req.body.title?.trim() || null) : current.title;
    const description = req.body.description !== undefined ? (req.body.description?.trim() || null) : current.description;
    const badge = req.body.badge !== undefined ? (req.body.badge?.trim() || null) : current.badge;
    const action_url = req.body.action_url !== undefined ? (req.body.action_url?.trim() || null) : current.action_url;
    const show_text = req.body.show_text !== undefined
      ? (req.body.show_text === 'true' || req.body.show_text === '1' || req.body.show_text === true ? 1 : 0)
      : current.show_text;
    const is_active = req.body.is_active !== undefined
      ? (req.body.is_active === 'true' || req.body.is_active === '1' || req.body.is_active === true ? 1 : 0)
      : current.is_active;
    const sort_order = req.body.sort_order !== undefined
      ? parseInt(req.body.sort_order, 10) || 0
      : current.sort_order;

    let image_url = current.image_url;
    if (req.file) {
      image_url = `/uploads/banners/${req.file.filename}`;
      if (current.image_url && current.image_url.startsWith('/uploads/banners/')) {
        const oldPath = path.join(uploadsRootDir, current.image_url.replace('/uploads/', ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) { }
        }
      }
    } else if (req.body.image_url) {
      image_url = req.body.image_url.trim();
    }

    await connection.query(
      `UPDATE banners
       SET title = ?, description = ?, badge = ?, image_url = ?, action_url = ?, show_text = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [title, description, badge, image_url, action_url, show_text, is_active, sort_order, id]
    );

    const [updated] = await connection.query('SELECT * FROM banners WHERE id = ?', [id]);

    await logActivity(
      req.user.id,
      'update_banner',
      `Memperbarui banner #${id}: "${title || 'Banner'}"`,
      { bannerId: id, title, image_url },
      req.ip
    );

    res.json({ success: true, message: 'Banner berhasil diperbarui', data: updated[0] });
  } catch (err) {
    console.error('Update banner error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui banner' });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/banners/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  let connection;
  try {
    const id = parseInt(req.params.id, 10);
    connection = await pool.getConnection();

    const [existing] = await connection.query('SELECT * FROM banners WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Banner tidak ditemukan' });
    }

    const current = existing[0];
    await connection.query('DELETE FROM banners WHERE id = ?', [id]);

    if (current.image_url && current.image_url.startsWith('/uploads/banners/')) {
      const oldPath = path.join(uploadsRootDir, current.image_url.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) { }
      }
    }

    await logActivity(
      req.user.id,
      'delete_banner',
      `Menghapus banner #${id} (${current.title || current.image_url})`,
      { bannerId: id },
      req.ip
    );

    res.json({ success: true, message: 'Banner berhasil dihapus' });
  } catch (err) {
    console.error('Delete banner error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal menghapus banner' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/banners/:id/toggle', authenticate, authorize('owner', 'admin'), async (req, res) => {
  let connection;
  try {
    const id = parseInt(req.params.id, 10);
    connection = await pool.getConnection();

    const [existing] = await connection.query('SELECT * FROM banners WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Banner tidak ditemukan' });
    }

    const newStatus = existing[0].is_active ? 0 : 1;
    await connection.query('UPDATE banners SET is_active = ? WHERE id = ?', [newStatus, id]);

    res.json({
      success: true,
      message: `Banner berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      is_active: Boolean(newStatus),
    });
  } catch (err) {
    console.error('Toggle banner error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengubah status banner' });
  } finally {
    if (connection) connection.release();
  }
});

// ─── Payment Accounts / Rekening Pembayaran Routes ─────────────────────────

app.get('/api/payment-accounts', authenticate, async (req, res) => {
  try {
    const isOwnerOrAdmin = ['owner', 'admin'].includes(req.user.role);
    const showAll = req.query.all === 'true' && isOwnerOrAdmin;
    const condition = showAll ? '' : 'WHERE is_active = 1';

    const [rows] = await pool.query(
      `SELECT * FROM payment_accounts ${condition} ORDER BY display_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get payment accounts error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar rekening' });
  }
});

app.get('/api/admin/payment-accounts', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const search = req.query.search?.trim() || '';
    const type = req.query.type?.trim() || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (type && type !== 'all') {
      where += ' AND type = ?';
      params.push(type);
    }
    if (search) {
      where += ' AND (bank_name LIKE ? OR account_number LIKE ? OR account_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM payment_accounts ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT pa.*, u.name as created_by_name
       FROM payment_accounts pa
       LEFT JOIN users u ON pa.created_by = u.id
       ${where}
       ORDER BY pa.display_order ASC, pa.id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    console.error('Admin get payment accounts error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data rekening' });
  }
});

app.post('/api/admin/payment-accounts', authenticate, authorize('owner', 'admin'), (req, res, next) => {
  uploadPaymentAccountImage.single('qr_image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Gagal memproses file gambar QRIS' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { bank_name, account_number, account_name, type, instructions, display_order, is_active } = req.body;

    if (!bank_name?.trim() || !account_number?.trim() || !account_name?.trim()) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Nama bank, nomor rekening, dan atas nama wajib diisi' });
    }

    const qrImage = req.file ? `/uploads/payment-accounts/${req.file.filename}` : null;
    const order = parseInt(display_order, 10) || 0;
    const active = is_active === 'false' || is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;
    const accType = ['bank', 'ewallet', 'qris'].includes(type) ? type : 'bank';

    const [result] = await pool.execute(
      `INSERT INTO payment_accounts (bank_name, account_number, account_name, type, qr_image, instructions, display_order, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bank_name.trim().toUpperCase(),
        account_number.trim(),
        account_name.trim(),
        accType,
        qrImage,
        instructions?.trim() || null,
        order,
        active,
        req.user.id,
      ]
    );

    await logActivity(
      req.user.id,
      'create_payment_account',
      `Menambahkan rekening ${bank_name.toUpperCase()} - ${account_number} a.n ${account_name}`,
      { id: result.insertId, bank_name, account_number },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Rekening pembayaran berhasil ditambahkan',
      data: { id: result.insertId },
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Create payment account error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan rekening' });
  }
});

app.put('/api/admin/payment-accounts/:id', authenticate, authorize('owner', 'admin'), (req, res, next) => {
  uploadPaymentAccountImage.single('qr_image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Gagal memproses file gambar QRIS' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    const [currentRows] = await pool.execute('SELECT * FROM payment_accounts WHERE id = ?', [accountId]);
    if (!currentRows.length) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan' });
    }
    const current = currentRows[0];

    const { bank_name, account_number, account_name, type, instructions, display_order, is_active } = req.body;

    let qrImage = current.qr_image;
    if (req.file) {
      qrImage = `/uploads/payment-accounts/${req.file.filename}`;
      if (current.qr_image && current.qr_image.startsWith('/uploads/payment-accounts/')) {
        const oldPath = path.join(uploadsRootDir, current.qr_image.replace('/uploads/', ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const order = display_order !== undefined ? parseInt(display_order, 10) || 0 : current.display_order;
    const active = is_active !== undefined ? (is_active === 'false' || is_active === false || is_active === 0 || is_active === '0' ? 0 : 1) : current.is_active;
    const accType = type && ['bank', 'ewallet', 'qris'].includes(type) ? type : current.type;

    await pool.execute(
      `UPDATE payment_accounts SET
         bank_name = ?,
         account_number = ?,
         account_name = ?,
         type = ?,
         qr_image = ?,
         instructions = ?,
         display_order = ?,
         is_active = ?
       WHERE id = ?`,
      [
        (bank_name || current.bank_name).trim().toUpperCase(),
        (account_number || current.account_number).trim(),
        (account_name || current.account_name).trim(),
        accType,
        qrImage,
        instructions !== undefined ? (instructions?.trim() || null) : current.instructions,
        order,
        active,
        accountId,
      ]
    );

    await logActivity(
      req.user.id,
      'update_payment_account',
      `Mengubah rekening ID ${accountId} (${bank_name || current.bank_name})`,
      { id: accountId },
      req.ip
    );

    res.json({ success: true, message: 'Data rekening berhasil diperbarui' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Update payment account error:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui rekening' });
  }
});

app.put('/api/admin/payment-accounts/:id/toggle', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    const [currentRows] = await pool.execute('SELECT id, is_active, bank_name FROM payment_accounts WHERE id = ?', [accountId]);
    if (!currentRows.length) {
      return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan' });
    }
    const newStatus = currentRows[0].is_active ? 0 : 1;
    await pool.execute('UPDATE payment_accounts SET is_active = ? WHERE id = ?', [newStatus, accountId]);

    await logActivity(
      req.user.id,
      'toggle_payment_account',
      `Mengubah status rekening ${currentRows[0].bank_name} menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
      { id: accountId, is_active: newStatus },
      req.ip
    );

    res.json({
      success: true,
      message: `Rekening berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: { is_active: Boolean(newStatus) },
    });
  } catch (err) {
    console.error('Toggle payment account error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengubah status rekening' });
  }
});

app.delete('/api/admin/payment-accounts/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    const [currentRows] = await pool.execute('SELECT * FROM payment_accounts WHERE id = ?', [accountId]);
    if (!currentRows.length) {
      return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan' });
    }
    const current = currentRows[0];
    if (current.qr_image && current.qr_image.startsWith('/uploads/payment-accounts/')) {
      const oldPath = path.join(uploadsRootDir, current.qr_image.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await pool.execute('DELETE FROM payment_accounts WHERE id = ?', [accountId]);

    await logActivity(
      req.user.id,
      'delete_payment_account',
      `Menghapus rekening ${current.bank_name} - ${current.account_number}`,
      { id: accountId },
      req.ip
    );

    res.json({ success: true, message: 'Rekening berhasil dihapus' });
  } catch (err) {
    console.error('Delete payment account error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus rekening' });
  }
});

// ─── Announcement / Papan Pengumuman Routes ─────────────────────────────────

app.get('/api/settings/announcement', async (req, res) => {
  try {
    const text = await getSetting(
      'announcement_text',
      'Selamat datang di Dzaqilah Cell! Layanan pulsa, paket data, & PPOB beroperasi 24 jam nonstop. Deposit instan otomatis via QRIS. Hubungi CS jika ada kendala.'
    );
    const activeStr = await getSetting('announcement_active', 'true');
    res.json({
      success: true,
      data: {
        text,
        is_active: activeStr === 'true',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/settings/announcement', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { text, is_active } = req.body;
    const cleanText = String(text ?? '').trim();
    const activeVal =
      is_active === true || is_active === 'true' || is_active === 1 || is_active === '1'
        ? 'true'
        : 'false';

    await setSetting('announcement_text', cleanText, req.user.id);
    await setSetting('announcement_active', activeVal, req.user.id);

    await logActivity(
      req.user.id,
      'update_announcement',
      `Mengubah papan pengumuman (status aktif: ${activeVal})`,
      { text: cleanText, is_active: activeVal === 'true' },
      req.ip
    );

    res.json({
      success: true,
      message: 'Papan pengumuman berhasil disimpan',
      data: {
        text: cleanText,
        is_active: activeVal === 'true',
      },
    });
  } catch (err) {
    console.error('Update announcement error:', err.message);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ─── KMSP Store Integration & Management (AKMT & Tembak Paket) ──────────────

const KMSP_DEFAULT_API_KEY = process.env.KMSP_API_KEY || 'fe5df3e7-e7a8-4e63-8006-374b530024cb';
const KMSP_DEFAULT_BASE_URL = process.env.KMSP_BASE_URL || 'https://my.kmsp-store.com';

const getKmspConfig = async () => {
  const apiKey = await getSetting('kmsp_api_key', KMSP_DEFAULT_API_KEY);
  const baseUrl = await getSetting('kmsp_base_url', KMSP_DEFAULT_BASE_URL);
  const enableMemberStr = await getSetting('kmsp_enable_member', 'false');
  const enableResellerStr = await getSetting('kmsp_enable_reseller', 'false');

  return {
    apiKey: apiKey || KMSP_DEFAULT_API_KEY,
    baseUrl: baseUrl || KMSP_DEFAULT_BASE_URL,
    enableMember: enableMemberStr === 'true',
    enableReseller: enableResellerStr === 'true',
  };
};

const canUserAccessKmspAdmin = (role, config) => {
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'reseller') return config.enableReseller;
  if (role === 'user') return config.enableMember;
  return false;
};

const KMSP_MICROSERVICES = {
  // Public & Package catalog
  packagelist: 'https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1',
  daftar_paket: 'https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1',
  daftar_produk: 'https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1',

  // Balance & Check Transaction
  panel_balance: 'https://golang-openapi-panelaccountbalance-xltembakservice.kmsp-store.com/v1',
  cek_saldo_panel: 'https://golang-openapi-panelaccountbalance-xltembakservice.kmsp-store.com/v1',
  balance: 'https://golang-openapi-panelaccountbalance-xltembakservice.kmsp-store.com/v1',
  check_transaction: 'https://golang-openapi-checktransaction-xltembakservice.kmsp-store.com/v1',
  cek_status_transaksi: 'https://golang-openapi-checktransaction-xltembakservice.kmsp-store.com/v1',

  // Authentication & Sessions
  req_otp: 'https://golang-openapi-reqotp-xltembakservice.kmsp-store.com/v1',
  request_otp: 'https://golang-openapi-reqotp-xltembakservice.kmsp-store.com/v1',
  login: 'https://golang-openapi-login-xltembakservice.kmsp-store.com/v1',
  login_otp: 'https://golang-openapi-login-xltembakservice.kmsp-store.com/v1',
  access_tokens: 'https://golang-openapi-accesstokenlist-xltembakservice.kmsp-store.com/v1',
  access_token_list: 'https://golang-openapi-accesstokenlist-xltembakservice.kmsp-store.com/v1',

  // Package Stock & Area
  package_stock: 'https://golang-openapi-checkpackagestock-xltembakservice.kmsp-store.com/v1',
  cek_stok_paket: 'https://golang-openapi-checkpackagestock-xltembakservice.kmsp-store.com/v1',
  stock_akrab_circle: 'https://golang-openapi-checkpackagestockakrabglobal-xltembakservice.kmsp-store.com/v1',
  cek_stok_akrab_circle: 'https://golang-openapi-checkpackagestockakrabglobal-xltembakservice.kmsp-store.com/v1',
  subscriber_location: 'https://golang-openapi-subscriberlocation-xltembakservice.kmsp-store.com/v1',
  cek_lokasi: 'https://golang-openapi-subscriberlocation-xltembakservice.kmsp-store.com/v1',

  // Subscriber info & packages
  subscriber_info: 'https://golang-openapi-subscriberinfo-xltembakservice.kmsp-store.com/v1',
  cek_pulsa: 'https://golang-openapi-subscriberinfo-xltembakservice.kmsp-store.com/v1',
  quota_details: 'https://golang-openapi-quotadetails-xltembakservice.kmsp-store.com/v1',
  cek_paket_aktif: 'https://golang-openapi-quotadetails-xltembakservice.kmsp-store.com/v1',
  unreg_package: 'https://golang-openapi-unregpackage-xltembakservice.kmsp-store.com/v1',
  unreg_paket: 'https://golang-openapi-unregpackage-xltembakservice.kmsp-store.com/v1',

  // Purchase
  package_purchase: 'https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1',
  beli_paket: 'https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1',
  beli_paket_no_otp: 'https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1',
  beli_paket_otp: 'https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1',

  // AKMT (Akrab Pengelola Management Tools)
  akmt_pengelola: 'https://golang-openapi-akmtgetpengelolalist-xltembakservice.kmsp-store.com/v1',
  akmt_daftar_pengelola: 'https://golang-openapi-akmtgetpengelolalist-xltembakservice.kmsp-store.com/v1',
  daftar_pengelola: 'https://golang-openapi-akmtgetpengelolalist-xltembakservice.kmsp-store.com/v1',

  akmt_slot: 'https://golang-openapi-akmtgetpengelolaslotlist-xltembakservice.kmsp-store.com/v1',
  akmt_slot_anggota: 'https://golang-openapi-akmtgetpengelolaslotlist-xltembakservice.kmsp-store.com/v1',
  slot_anggota: 'https://golang-openapi-akmtgetpengelolaslotlist-xltembakservice.kmsp-store.com/v1',

  akmt_add_pengelola: 'https://golang-openapi-akmtaddpengelola-xltembakservice.kmsp-store.com/v1',
  akmt_tambah_pengelola: 'https://golang-openapi-akmtaddpengelola-xltembakservice.kmsp-store.com/v1',
  tambah_pengelola: 'https://golang-openapi-akmtaddpengelola-xltembakservice.kmsp-store.com/v1',

  akmt_invite: 'https://golang-openapi-akmtinviteanggota-xltembakservice.kmsp-store.com/v1',
  akmt_invite_anggota: 'https://golang-openapi-akmtinviteanggota-xltembakservice.kmsp-store.com/v1',
  invite_anggota: 'https://golang-openapi-akmtinviteanggota-xltembakservice.kmsp-store.com/v1',

  akmt_member_quota: 'https://golang-openapi-akmtmemberquotadetails-xltembakservice.kmsp-store.com/v1',
  akmt_detail_kuota: 'https://golang-openapi-akmtmemberquotadetails-xltembakservice.kmsp-store.com/v1',
  detail_kuota_akrab: 'https://golang-openapi-akmtmemberquotadetails-xltembakservice.kmsp-store.com/v1',

  akmt_set_kuber: 'https://golang-openapi-akmtsetkuber-xltembakservice.kmsp-store.com/v1',
  set_kuber: 'https://golang-openapi-akmtsetkuber-xltembakservice.kmsp-store.com/v1',

  akmt_kick: 'https://golang-openapi-akmtmemberkick-xltembakservice.kmsp-store.com/v1',
  akmt_kick_anggota: 'https://golang-openapi-akmtmemberkick-xltembakservice.kmsp-store.com/v1',
  kick_anggota: 'https://golang-openapi-akmtmemberkick-xltembakservice.kmsp-store.com/v1',

  akmt_buy_slot: 'https://golang-openapi-akmtbuyextraslot-xltembakservice.kmsp-store.com/v1',
  akmt_beli_slot: 'https://golang-openapi-akmtbuyextraslot-xltembakservice.kmsp-store.com/v1',
  beli_slot_tambahan: 'https://golang-openapi-akmtbuyextraslot-xltembakservice.kmsp-store.com/v1',

  akmt_delete_slot: 'https://golang-openapi-akmtdeleteextraslot-xltembakservice.kmsp-store.com/v1',
  hapus_slot_tambahan: 'https://golang-openapi-akmtdeleteextraslot-xltembakservice.kmsp-store.com/v1',

  // CIMT (Circle Management)
  cimt_pengelola: 'https://golang-openapi-cimtgetpengelolalist-xltembakservice.kmsp-store.com/v1',
  cimt_add_pengelola: 'https://golang-openapi-cimtaddpengelola-xltembakservice.kmsp-store.com/v1',
  cimt_family_list: 'https://golang-openapi-cimtfamilymemberlist-xltembakservice.kmsp-store.com/v1',
  cimt_group_create: 'https://golang-openapi-cimtgroupcreate-xltembakservice.kmsp-store.com/v1',
  cimt_group_status: 'https://golang-openapi-cimtgroupstatus-xltembakservice.kmsp-store.com/v1',
  cimt_group_disband: 'https://golang-openapi-cimtgroupdisband-xltembakservice.kmsp-store.com/v1',
  cimt_invite_member: 'https://golang-openapi-cimtinvitemember-xltembakservice.kmsp-store.com/v1',
  cimt_kick_member: 'https://golang-openapi-cimtkickmember-xltembakservice.kmsp-store.com/v1',
  cimt_msisdn_checker: 'https://golang-openapi-cimtmsisdnchecker-xltembakservice.kmsp-store.com/v1',
  cimt_redeemable_bonus: 'https://golang-openapi-cimtredeemablebonuslist-xltembakservice.kmsp-store.com/v1',
  cimt_redeem_bonus: 'https://golang-openapi-cimtredeembonus-xltembakservice.kmsp-store.com/v1',
  cimt_gift_bonus: 'https://golang-openapi-cimtgiftbonus-xltembakservice.kmsp-store.com/v1',
  cimt_invitation_accept: 'https://golang-openapi-cimtinvitationaccept-xltembakservice.kmsp-store.com/v1',
};

const normalizeKmspParams = (action, rawParams = {}) => {
  const norm = { ...rawParams };

  // normalize phone / msisdn
  const phoneVal = norm.phone || norm.msisdn || norm.no_hp || norm.nomor;
  if (phoneVal) {
    norm.phone = String(phoneVal).trim();
    norm.msisdn = String(phoneVal).trim();
  }

  // parent phone / pengelola
  const parentVal = norm.parent_phone || norm.parent_msisdn || norm.pengelola;
  if (parentVal) {
    norm.parent_phone = String(parentVal).trim();
    norm.parent_msisdn = String(parentVal).trim();
    if (!norm.phone) norm.phone = String(parentVal).trim();
    if (!norm.msisdn) norm.msisdn = String(parentVal).trim();
  }

  // member phone / anggota
  const memberVal = norm.member_phone || norm.member_msisdn || norm.anggota;
  if (memberVal) {
    norm.member_phone = String(memberVal).trim();
    norm.member_msisdn = String(memberVal).trim();
  }

  // package_id / package_code
  const packageVal = norm.package_code || norm.package_id || norm.service_code || norm.kode_paket;
  if (packageVal) {
    norm.package_code = String(packageVal).trim();
    norm.package_id = String(packageVal).trim();
  }

  // encrypted_package_code for unreg
  if (action === 'unreg_paket' || action === 'unreg_package') {
    const encVal = norm.encrypted_package_code || norm.package_code || norm.package_id;
    if (encVal) {
      norm.encrypted_package_code = String(encVal).trim();
    }
  }

  // slot / slots_count
  const slotVal = norm.slot_no || norm.slot || norm.slots_count;
  if (slotVal) {
    norm.slot = String(slotVal).trim();
    norm.slot_no = String(slotVal).trim();
    norm.slots_count = String(slotVal).trim();
  }

  // quota / kuber
  const quotaVal = norm.quota_gb || norm.kuber || norm.quota;
  if (quotaVal) {
    norm.quota_gb = String(quotaVal).trim();
    norm.kuber = String(quotaVal).trim();
    norm.quota = String(quotaVal).trim();
  }

  // payment method default for purchases
  if (action.includes('purchase') || action.includes('beli_paket')) {
    if (!norm.payment_method) {
      norm.payment_method = 'BALANCE';
    }
  }

  // family member id
  const memberIdVal = norm.member_id || norm.family_member_id;
  if (memberIdVal) {
    norm.member_id = String(memberIdVal).trim();
    norm.family_member_id = String(memberIdVal).trim();
  }

  // transaction id / trx_id
  const trxVal = norm.trx_id || norm.transaction_id || norm.ref_id;
  if (trxVal) {
    norm.trx_id = String(trxVal).trim();
    norm.transaction_id = String(trxVal).trim();
  }

  return norm;
};

const callKmspEndpoint = async (action, rawParams = {}, payload = null) => {
  const config = await getKmspConfig();
  const normalizedAction = String(action || '').toLowerCase().trim();
  const normalizedParams = normalizeKmspParams(normalizedAction, rawParams);

  // Determine target microservice URL
  let targetUrl = KMSP_MICROSERVICES[normalizedAction];
  if (!targetUrl) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    targetUrl = `${baseUrl}/v1`;
  }

  const urlObj = new URL(targetUrl);
  urlObj.searchParams.set('api_key', config.apiKey);

  // Set all query params
  for (const [k, v] of Object.entries(normalizedParams)) {
    if (v !== undefined && v !== null && v !== '') {
      urlObj.searchParams.set(k, String(v));
    }
  }

  const isPost = payload && typeof payload === 'object' && Object.keys(payload).length > 0;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DzaqilahCell/1.0',
  };

  const opts = {
    method: isPost ? 'POST' : 'GET',
    headers,
  };

  if (isPost) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(payload);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    opts.signal = controller.signal;

    const resp = await fetch(urlObj.toString(), opts);
    clearTimeout(timeoutId);

    const ct = resp.headers.get('content-type') || '';
    let resultJson = null;

    if (ct.includes('application/json')) {
      resultJson = await resp.json();
    } else {
      const text = await resp.text();
      try {
        resultJson = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: resp.status,
          message: text.substring(0, 300) || 'Respon bukan format JSON yang valid',
          data: null,
        };
      }
    }

    const isKmspSuccess = resultJson.status === true || (resultJson.statusCode === 200 && resultJson.status !== false);
    return {
      ok: resp.ok && isKmspSuccess,
      status: resultJson.statusCode || resp.status,
      message: resultJson.message || (isKmspSuccess ? 'Sukses' : 'Gagal memproses aksi KMSP'),
      data: resultJson.data ?? resultJson,
      raw: resultJson,
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      message: isTimeout ? 'KMSP API timeout setelah 20 detik' : `Gagal menghubungi server KMSP: ${err.message}`,
      data: null,
    };
  }
};

let kmspPackagesCache = {
  timestamp: 0,
  data: [],
  stockMap: new Map(),
  announcements: [],
  data_updated_at: '',
};

const fetchAndCacheKmspPackages = async (force = false) => {
  const now = Date.now();
  const isExpired = now - kmspPackagesCache.timestamp > 3 * 60 * 1000; // 3 menit cache

  if (force || isExpired || kmspPackagesCache.data.length === 0) {
    const [kmspResult, stockResult] = await Promise.all([
      callKmspEndpoint('packagelist'),
      callKmspEndpoint('stock_akrab_circle'),
    ]);

    if (kmspResult.ok && Array.isArray(kmspResult.data)) {
      const stockMap = new Map();
      if (stockResult.ok && Array.isArray(stockResult.data)) {
        for (const item of stockResult.data) {
          if (item.code) {
            stockMap.set(String(item.code).toUpperCase().trim(), Number(item.stok ?? 0));
          }
        }
      }

      const enriched = kmspResult.data.map((p) => {
        const codeUpper = String(p.package_code || '').toUpperCase().trim();
        let stock = null;
        let isOutOfStock = false;

        if (stockMap.has(codeUpper)) {
          stock = stockMap.get(codeUpper);
          if (stock <= 0) {
            isOutOfStock = true;
          }
        }

        if (p.sedang_gangguan) {
          isOutOfStock = true;
        }

        if (p.have_daily_limit && p.daily_limit_details) {
          const maxLim = Number(p.daily_limit_details.max_daily_transaction_limit || 0);
          const curCount = Number(p.daily_limit_details.current_daily_transaction_count || 0);
          if (maxLim > 0 && curCount >= maxLim) {
            isOutOfStock = true;
          }
        }

        return {
          ...p,
          stock,
          is_out_of_stock: isOutOfStock,
        };
      });

      kmspPackagesCache = {
        timestamp: now,
        data: enriched,
        stockMap,
        announcements: kmspResult.raw?.announcements || [],
        data_updated_at: kmspResult.raw?.data_updated_at || '',
      };
    } else if (kmspPackagesCache.data.length === 0) {
      throw new Error(kmspResult.message || 'Gagal memuat katalog produk KMSP');
    }
  }

  return kmspPackagesCache;
};

app.get('/api/kmsp/packages', authenticate, async (req, res) => {
  try {
    const { search, brand, type, force_refresh } = req.query;
    await fetchAndCacheKmspPackages(force_refresh === 'true');

    let filtered = [...kmspPackagesCache.data];

    // Filter brand: XL or AXIS
    if (brand && brand !== 'all') {
      const bUpper = brand.toUpperCase();
      filtered = filtered.filter((p) => {
        const name = (p.package_name || '').toUpperCase();
        const code = (p.package_code || '').toUpperCase();
        return name.includes(bUpper) || code.includes(bUpper);
      });
    }

    // Filter type: no_otp, otp, akrab
    if (type === 'no_otp') {
      filtered = filtered.filter((p) => p.no_need_login);
    } else if (type === 'otp') {
      filtered = filtered.filter((p) => !p.no_need_login);
    } else if (type === 'akrab') {
      filtered = filtered.filter((p) => {
        const name = (p.package_name || '').toLowerCase();
        const code = (p.package_code || '').toLowerCase();
        return p.is_akrab || p.is_circle || name.includes('akrab') || code.includes('akrab');
      });
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        (p.package_name && p.package_name.toLowerCase().includes(q)) ||
        (p.package_code && p.package_code.toLowerCase().includes(q)) ||
        (p.package_description && p.package_description.toLowerCase().includes(q))
      );
    }

    const marginsMap = await fetchProductMarginsMap();
    const mapped = filtered.map((p) => mapKmspPackage(p, marginsMap, req.user.role));

    // Sort ready packages at the top
    mapped.sort((a, b) => {
      const aUnavailable = Boolean(a.sedang_gangguan || a.is_out_of_stock || (a.stock !== null && a.stock !== undefined && a.stock <= 0));
      const bUnavailable = Boolean(b.sedang_gangguan || b.is_out_of_stock || (b.stock !== null && b.stock !== undefined && b.stock <= 0));
      if (aUnavailable !== bUnavailable) {
        return aUnavailable ? 1 : -1;
      }
      return 0;
    });

    res.json({
      success: true,
      data: mapped,
      meta: {
        total: mapped.length,
        total_all: kmspPackagesCache.data.length,
        cached_at: new Date(kmspPackagesCache.timestamp).toISOString(),
        announcements: kmspPackagesCache.announcements,
        data_updated_at: kmspPackagesCache.data_updated_at,
        member_margin_percent: marginPercent,
        reseller_margin_percent: resellerMarginPercent,
        user_role: req.user.role,
      },
    });
  } catch (err) {
    console.error('Get KMSP packages error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar produk Paket Akrab DZ Store' });
  }
});

app.get('/api/products/kmsp', authenticate, async (req, res) => {
  try {
    const { search, brand, type, force_refresh } = req.query;
    await fetchAndCacheKmspPackages(force_refresh === 'true');

    const marginsMap = await fetchProductMarginsMap();
    let data = kmspPackagesCache.data.map((p) => mapKmspPackage(p, marginsMap, req.user.role));

    if (brand && brand !== 'all') {
      const bUpper = brand.toUpperCase();
      data = data.filter((p) => (p.brand && p.brand.toUpperCase() === bUpper) || (p.product_name && p.product_name.toUpperCase().includes(bUpper)));
    }

    if (type === 'no_otp') {
      data = data.filter((p) => p.no_need_login);
    } else if (type === 'otp') {
      data = data.filter((p) => !p.no_need_login);
    } else if (type === 'akrab') {
      data = data.filter((p) => {
        const name = (p.product_name || p.package_name || '').toLowerCase();
        const code = (p.buyer_sku_code || p.package_code || '').toLowerCase();
        return p.is_akrab || p.is_circle || name.includes('akrab') || code.includes('akrab');
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (p) =>
          (p.product_name && p.product_name.toLowerCase().includes(q)) ||
          (p.buyer_sku_code && p.buyer_sku_code.toLowerCase().includes(q)) ||
          (p.package_description && p.package_description.toLowerCase().includes(q))
      );
    }

    // Sort ready packages at the top
    data.sort((a, b) => {
      const aUnavailable = Boolean(a.sedang_gangguan || a.is_out_of_stock || (a.stock !== null && a.stock !== undefined && a.stock <= 0));
      const bUnavailable = Boolean(b.sedang_gangguan || b.is_out_of_stock || (b.stock !== null && b.stock !== undefined && b.stock <= 0));
      if (aUnavailable !== bUnavailable) {
        return aUnavailable ? 1 : -1;
      }
      return 0;
    });

    const { page, limit, offset } = getPagination(req.query);
    const total = data.length;
    const paginated = data.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: paginationMeta(page, limit, total),
      margin_percent: req.user.role === 'reseller' ? resellerMarginPercent : marginPercent,
      member_margin_percent: marginPercent,
      reseller_margin_percent: resellerMarginPercent,
      user_role: req.user.role,
    });
  } catch (err) {
    console.error('Get KMSP products error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar produk Paket Akrab DZ Store' });
  }
});

app.get('/api/kmsp/settings', authenticate, async (req, res) => {
  try {
    const config = await getKmspConfig();
    const isOwnerOrAdmin = req.user.role === 'owner' || req.user.role === 'admin';
    const canAccessAdmin = canUserAccessKmspAdmin(req.user.role, config);

    res.json({
      success: true,
      data: {
        can_access_admin_tools: canAccessAdmin,
        enable_member: config.enableMember,
        enable_reseller: config.enableReseller,
        ...(isOwnerOrAdmin
          ? {
            has_api_key: Boolean(config.apiKey),
            api_key_masked: maskSecretKey(config.apiKey),
            base_url: config.baseUrl,
          }
          : {}),
      },
    });
  } catch (err) {
    console.error('Get KMSP settings error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan KMSP' });
  }
});

app.put('/api/kmsp/settings', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { api_key, enable_member, enable_reseller, base_url } = req.body;

    if (api_key !== undefined && !isMaskedOrEmpty(api_key)) {
      await setSetting('kmsp_api_key', String(api_key).trim(), req.user.id);
    }
    if (base_url !== undefined) {
      await setSetting('kmsp_base_url', String(base_url).trim(), req.user.id);
    }
    if (enable_member !== undefined) {
      const val = enable_member === true || enable_member === 'true' || enable_member === 1 ? 'true' : 'false';
      await setSetting('kmsp_enable_member', val, req.user.id);
    }
    if (enable_reseller !== undefined) {
      const val = enable_reseller === true || enable_reseller === 'true' || enable_reseller === 1 ? 'true' : 'false';
      await setSetting('kmsp_enable_reseller', val, req.user.id);
    }

    const updated = await getKmspConfig();

    await logActivity(
      req.user.id,
      'update_kmsp_settings',
      `Mengubah pengaturan KMSP (Member: ${updated.enableMember}, Reseller: ${updated.enableReseller})`,
      { enable_member: updated.enableMember, enable_reseller: updated.enableReseller },
      req.ip
    );

    res.json({
      success: true,
      message: 'Pengaturan KMSP berhasil diperbarui',
      data: {
        has_api_key: Boolean(updated.apiKey),
        api_key_masked: maskSecretKey(updated.apiKey),
        base_url: updated.baseUrl,
        enable_member: updated.enableMember,
        enable_reseller: updated.enableReseller,
        can_access_admin_tools: true,
      },
    });
  } catch (err) {
    console.error('Update KMSP settings error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan KMSP' });
  }
});

app.post('/api/kmsp/execute', authenticate, async (req, res) => {
  try {
    const { category, action, params = {}, payload = null } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Aksi KMSP tidak valid' });
    }

    const config = await getKmspConfig();
    const isRestrictedCategory = category === 'akmt' || category === 'tembak_paket';

    if (isRestrictedCategory && !canUserAccessKmspAdmin(req.user.role, config)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Menu ini hanya dapat diakses oleh Admin & Owner, atau belum diaktifkan untuk role Anda.',
      });
    }

    const isPurchaseAction =
      action === 'beli_paket' ||
      action === 'beli_paket_no_otp' ||
      action === 'beli_paket_otp' ||
      action === 'package_purchase';

    // ─── SPECIAL HANDLING: Pembelian Paket KMSP ───
    if (isPurchaseAction) {
      const phone = String(params.phone || params.msisdn || params.customer_no || '').trim();
      const packageCode = String(params.package_code || params.package_id || params.code || '').trim();

      if (!phone) {
        return res.status(400).json({ success: false, message: 'Nomor HP tujuan wajib diisi' });
      }
      if (!packageCode) {
        return res.status(400).json({ success: false, message: 'Kode paket wajib dipilih' });
      }

      // Ensure cache is populated
      await fetchAndCacheKmspPackages();
      const pkg = kmspPackagesCache.data.find(
        (p) => String(p.package_code || '').toLowerCase() === packageCode.toLowerCase()
      );

      // Check disturbance or stock empty
      if (pkg) {
        if (pkg.sedang_gangguan) {
          return res.status(400).json({
            success: false,
            message: 'Paket ini sedang mengalami gangguan di provider. Silakan pilih paket lain.',
          });
        }
        if (pkg.is_out_of_stock || (pkg.stock !== null && pkg.stock !== undefined && pkg.stock <= 0)) {
          return res.status(400).json({
            success: false,
            message: 'Stok paket ini sedang kosong/habis di KMSP. Silakan pilih paket lain.',
          });
        }
      }

      // Calculate selling price
      const marginsMap = await fetchProductMarginsMap();
      const originalPrice = pkg
        ? parseFloat(pkg.package_harga_int ?? pkg.package_price ?? 0)
        : parseFloat(params.price) || 0;
      const sellingPrice = pkg
        ? calcSellingPrice(originalPrice, pkg.package_code, req.user.role, marginsMap)
        : parseFloat(params.price) || originalPrice;
      const productName = pkg?.package_name || params.packageName || params.package_name || packageCode;
      const brand = pkg?.brand || (packageCode.toLowerCase().includes('axis') ? 'AXIS' : 'XL');

      // Check balance and begin database transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        const [userRows] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
        if (!userRows.length) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
        }

        const balanceBefore = parseFloat(userRows[0].balance);
        if (balanceBefore < sellingPrice) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `Saldo Anda tidak mencukupi (Saldo: Rp ${balanceBefore.toLocaleString('id-ID')}, Dibutuhkan: Rp ${sellingPrice.toLocaleString('id-ID')})`,
          });
        }

        // Call KMSP endpoint
        const purchaseParams = {
          ...params,
          phone,
          package_code: packageCode,
          payment_method: 'BALANCE',
        };
        delete purchaseParams.package_id; // prevent duplicate/ambiguity

        const kmspResult = await callKmspEndpoint(action, purchaseParams, payload);

        if (!kmspResult.ok) {
          await connection.rollback();
          connection.release();

          await logActivity(
            req.user.id,
            `kmsp_${action}_failed`,
            `Gagal beli paket KMSP ${productName} ke ${phone}: ${kmspResult.message}`,
            { params: purchaseParams, result_status: kmspResult.status },
            req.ip
          );

          return res.status(400).json({
            success: false,
            message: kmspResult.message || 'Gagal memproses pembelian di KMSP',
            data: kmspResult.data,
          });
        }

        // KMSP purchase accepted (pending or success)
        const balanceAfter = balanceBefore - sellingPrice;
        await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, req.user.id]);
        await connection.execute(
          'INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            req.user.id,
            'purchase',
            sellingPrice,
            balanceBefore,
            balanceAfter,
            `Pembelian ${productName} - ${phone}`,
            req.user.id,
          ]
        );

        const trxId = kmspResult.data?.trx_id || generateRefId();
        const initialStatus = kmspResult.data?.status === 1 ? 'success' : 'pending';
        const sn = kmspResult.data?.sn_only || kmspResult.data?.trx_id || null;
        const msg = kmspResult.message || 'Transaksi berhasil diajukan ke KMSP';

        await connection.execute(
          `INSERT INTO transactions (user_id, ref_id, customer_no, buyer_sku_code, product_name, category, brand, transaction_type, price, selling_price, status, sn, message, digiflazz_response)
           VALUES (?, ?, ?, ?, ?, 'Paket Data', ?, 'kmsp', ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            trxId,
            phone,
            packageCode,
            productName,
            brand,
            originalPrice,
            sellingPrice,
            initialStatus,
            sn,
            msg,
            JSON.stringify(kmspResult.raw || kmspResult.data || {}),
          ]
        );

        await connection.commit();
        connection.release();

        await logActivity(
          req.user.id,
          'transaction_kmsp',
          `Beli paket KMSP ${productName} ke ${phone} - Rp ${sellingPrice.toLocaleString('id-ID')}`,
          { refId: trxId, status: initialStatus },
          req.ip
        );

        return res.json({
          success: true,
          message: kmspResult.message || 'Transaksi pembelian paket KMSP berhasil diajukan',
          data: {
            ...sanitizeSensitiveObject(kmspResult.data),
            ref_id: trxId,
            status: initialStatus,
            selling_price: sellingPrice,
            balance_after: balanceAfter,
          },
        });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    }

    // Call standard KMSP endpoint
    const kmspResult = await callKmspEndpoint(action, params, payload);

    // If check_transaction was executed, synchronize with transactions table if ref_id matches
    const isCheckAction = action === 'check_transaction' || action === 'cek_status_transaksi';
    if (isCheckAction && kmspResult.ok && kmspResult.data) {
      const trxId = String(params.trx_id || params.transaction_id || params.ref_id || '').trim();
      if (trxId) {
        try {
          const conn = await pool.getConnection();
          try {
            const [txRows] = await conn.execute('SELECT * FROM transactions WHERE ref_id = ?', [trxId]);
            if (txRows.length) {
              await conn.beginTransaction();
              const [locked] = await conn.execute('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [txRows[0].id]);
              if (locked.length && locked[0].status === 'pending') {
                await applyKmspTransactionStatusUpdate(conn, locked[0], kmspResult.data, kmspResult.raw);
              }
              await conn.commit();
            }
          } finally {
            conn.release();
          }
        } catch (dbErr) {
          console.error('Error syncing KMSP check_transaction to local DB:', dbErr.message);
        }
      }
    }

    // Activity log
    await logActivity(
      req.user.id,
      `kmsp_${action}`,
      `Menjalankan fitur KMSP: ${action} (${category || 'general'})`,
      { params, result_status: kmspResult.status, is_success: kmspResult.ok },
      req.ip
    );

    if (kmspResult.ok) {
      return res.json({
        success: true,
        message: kmspResult.message || 'Permintaan berhasil diproses oleh KMSP',
        data: sanitizeSensitiveObject(kmspResult.data),
      });
    }

    return res.json({
      success: false,
      message: kmspResult.message || `Respon KMSP (status ${kmspResult.status})`,
      data: sanitizeSensitiveObject(kmspResult.data) || null,
    });
  } catch (err) {
    console.error('KMSP execute error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Terjadi kesalahan sistem KMSP' });
  }
});

// ─── Provider Management (Digiflazz & KMSP API Keys) ──────────────────────

app.get('/api/settings/providers', authenticate, authorize('owner'), async (req, res) => {
  try {
    const kmspConfig = await getKmspConfig();

    res.json({
      success: true,
      data: {
        digiflazz: {
          username: DIGIFLAZZ_USERNAME,
          has_api_key: Boolean(DIGIFLAZZ_API_KEY),
          api_key_masked: maskSecretKey(DIGIFLAZZ_API_KEY),
          testing: DIGIFLAZZ_TESTING,
          has_webhook_secret: Boolean(DIGIFLAZZ_WEBHOOK_SECRET),
          webhook_secret_masked: maskSecretKey(DIGIFLAZZ_WEBHOOK_SECRET),
          base_url: DIGIFLAZZ_BASE_URL,
        },
        kmsp: {
          has_api_key: Boolean(kmspConfig.apiKey),
          api_key_masked: maskSecretKey(kmspConfig.apiKey),
          base_url: kmspConfig.baseUrl,
          enable_member: kmspConfig.enableMember,
          enable_reseller: kmspConfig.enableReseller,
        },
      },
    });
  } catch (err) {
    console.error('Get provider settings error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan provider API' });
  }
});

app.put('/api/settings/providers', authenticate, authorize('owner'), async (req, res) => {
  try {
    const {
      digiflazz_username,
      digiflazz_api_key,
      digiflazz_testing,
      digiflazz_webhook_secret,
      kmsp_api_key,
      kmsp_base_url,
      kmsp_enable_member,
      kmsp_enable_reseller,
    } = req.body;

    let digiflazzChanged = false;

    if (digiflazz_username !== undefined) {
      await setSetting('digiflazz_username', String(digiflazz_username).trim(), req.user.id);
      digiflazzChanged = true;
    }
    if (digiflazz_api_key !== undefined && !isMaskedOrEmpty(digiflazz_api_key)) {
      await setSetting('digiflazz_api_key', String(digiflazz_api_key).trim(), req.user.id);
      digiflazzChanged = true;
    }
    if (digiflazz_testing !== undefined) {
      const val = digiflazz_testing === true || digiflazz_testing === 'true' || digiflazz_testing === 1 ? 'true' : 'false';
      await setSetting('digiflazz_testing', val, req.user.id);
      digiflazzChanged = true;
    }
    if (digiflazz_webhook_secret !== undefined && !isMaskedOrEmpty(digiflazz_webhook_secret)) {
      await setSetting('digiflazz_webhook_secret', String(digiflazz_webhook_secret).trim(), req.user.id);
      digiflazzChanged = true;
    }

    if (kmsp_api_key !== undefined && !isMaskedOrEmpty(kmsp_api_key)) {
      await setSetting('kmsp_api_key', String(kmsp_api_key).trim(), req.user.id);
    }
    if (kmsp_base_url !== undefined) {
      await setSetting('kmsp_base_url', String(kmsp_base_url).trim(), req.user.id);
    }
    if (kmsp_enable_member !== undefined) {
      const val = kmsp_enable_member === true || kmsp_enable_member === 'true' || kmsp_enable_member === 1 ? 'true' : 'false';
      await setSetting('kmsp_enable_member', val, req.user.id);
    }
    if (kmsp_enable_reseller !== undefined) {
      const val = kmsp_enable_reseller === true || kmsp_enable_reseller === 'true' || kmsp_enable_reseller === 1 ? 'true' : 'false';
      await setSetting('kmsp_enable_reseller', val, req.user.id);
    }

    if (digiflazzChanged) {
      await loadDigiflazzConfig();
      priceListCache = { data: null, fetchedAt: 0 };
      pascaPriceListCache = { data: null, fetchedAt: 0 };
    }

    const kmspConfig = await getKmspConfig();

    await logActivity(
      req.user.id,
      'update_providers',
      'Owner memperbarui konfigurasi API Provider (Digiflazz / KMSP)',
      {
        digiflazz_username: DIGIFLAZZ_USERNAME,
        digiflazz_testing: DIGIFLAZZ_TESTING,
        kmsp_enable_member: kmspConfig.enableMember,
        kmsp_enable_reseller: kmspConfig.enableReseller,
      },
      req.ip
    );

    res.json({
      success: true,
      message: 'Pengaturan API Provider berhasil disimpan',
      data: {
        digiflazz: {
          username: DIGIFLAZZ_USERNAME,
          has_api_key: Boolean(DIGIFLAZZ_API_KEY),
          api_key_masked: maskSecretKey(DIGIFLAZZ_API_KEY),
          testing: DIGIFLAZZ_TESTING,
          has_webhook_secret: Boolean(DIGIFLAZZ_WEBHOOK_SECRET),
          webhook_secret_masked: maskSecretKey(DIGIFLAZZ_WEBHOOK_SECRET),
          base_url: DIGIFLAZZ_BASE_URL,
        },
        kmsp: {
          has_api_key: Boolean(kmspConfig.apiKey),
          api_key_masked: maskSecretKey(kmspConfig.apiKey),
          base_url: kmspConfig.baseUrl,
          enable_member: kmspConfig.enableMember,
          enable_reseller: kmspConfig.enableReseller,
        },
      },
    });
  } catch (err) {
    console.error('Update provider settings error:', err.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan provider API' });
  }
});

app.post('/api/settings/providers/test-digiflazz', authenticate, authorize('owner'), async (req, res) => {
  try {
    const username = (req.body?.username && !isMaskedOrEmpty(req.body.username))
      ? String(req.body.username).trim()
      : DIGIFLAZZ_USERNAME;

    const apiKey = (req.body?.api_key && !isMaskedOrEmpty(req.body.api_key))
      ? String(req.body.api_key).trim()
      : DIGIFLAZZ_API_KEY;

    if (!username || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Username dan API key Digiflazz belum diatur',
      });
    }

    const sign = crypto.createHash('md5').update(username + apiKey + 'depo').digest('hex');
    const result = await callDigiflazz('/cek-saldo', {
      cmd: 'deposit',
      username,
      sign,
    });

    console.log('Digiflazz /cek-saldo response:', JSON.stringify(result));

    // Dokumentasi Digiflazz: response sukses adalah { "data": { "deposit": 12345 } }
    // Response sukses TIDAK memiliki field "rc", sehingga memeriksa rc === '00' menyebabkan salah deteksi gagal
    const isSuccess =
      result?.data &&
      (typeof result.data.deposit === 'number' ||
        (result.data.deposit !== undefined && result.data.deposit !== null) ||
        result.data.rc === '00');

    if (isSuccess) {
      const depositVal = Number(result.data.deposit || 0);
      return res.json({
        success: true,
        message: `Koneksi Digiflazz Berhasil! Saldo Deposit: Rp ${depositVal.toLocaleString('id-ID')}`,
        data: {
          deposit: depositVal,
          rc: result.data.rc || '00',
        },
      });
    }

    const errorMsg =
      result?.data?.message ||
      result?.message ||
      (typeof result?.data === 'string' ? result.data : null) ||
      'Gagal terhubung ke Digiflazz. Periksa kredensial atau IP Whitelist Anda.';

    return res.status(400).json({
      success: false,
      message: errorMsg,
      data: {
        rc: result?.data?.rc || null,
        raw: result?.data || null,
      },
    });
  } catch (err) {
    console.error('Test Digiflazz connection error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Gagal menghubungi server Digiflazz' });
  }
});


// ─── Health Check ──────────────────────────────────────────────────────────

app.get('/api/health', (_, res) => {
  res.json({ success: true, message: 'Dzaqilah Store API is running' });
});

// ─── Start Server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Dzaqilah Store API running on port ${PORT}`);
});

// initDatabase()
//   .then(() => {
//     app.listen(PORT, () => {
//       console.log(`Dzaqilah Store API running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error('Database initialization failed:', err.message);
//     process.exit(1);
//   });
