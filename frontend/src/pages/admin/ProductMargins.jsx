import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Percent, Edit2, RotateCcw, ArrowLeft, Sparkles, TrendingUp } from 'lucide-react';
import Header from '../../components/layout/Header';
import SearchInput from '../../components/ui/SearchInput';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { get, put, del, formatCurrency, getErrorMessage } from '../../utils/request';
import { API_ENDPOINTS } from '../../utils/endpoints';
import { SERVICES } from '../../constants/services';

const TYPE_TABS = [
  { id: 'prepaid', label: 'Prabayar' },
  { id: 'pasca', label: 'Pascabayar' },
];

const ProductMargins = () => {
  const [products, setProducts] = useState([]);
  const [customMargins, setCustomMargins] = useState([]);
  const [globalMargin, setGlobalMargin] = useState(0);
  const [globalResellerMargin, setGlobalResellerMargin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('pulsa');
  const [productType, setProductType] = useState('prepaid');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [customPagination, setCustomPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [editProduct, setEditProduct] = useState(null);
  const [marginInput, setMarginInput] = useState('');
  const [resellerMarginInput, setResellerMarginInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');

  const debouncedSearch = useDebounce(search);
  const isPasca = productType === 'pasca';
  const productsEndpoint = isPasca ? API_ENDPOINTS.PRODUCTS.PASCA : API_ENDPOINTS.PRODUCTS.PREPAID;

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await get(productsEndpoint, {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        service: selectedService,
      });
      setProducts(res.data);
      setPagination(res.pagination);
      setGlobalMargin(res.member_margin_percent ?? res.margin_percent ?? globalMargin);
      setGlobalResellerMargin(res.reseller_margin_percent ?? globalResellerMargin);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomMargins = async () => {
    setLoadingCustom(true);
    try {
      const res = await get(API_ENDPOINTS.PRODUCTS.MARGINS.LIST, {
        page: customPagination.page,
        limit: customPagination.limit,
        search: debouncedSearch,
        transaction_type: productType,
      });
      setCustomMargins(res.data);
      setCustomPagination(res.pagination);
      setGlobalMargin(res.global_margin_percent ?? globalMargin);
      setGlobalResellerMargin(res.global_reseller_margin_percent ?? globalResellerMargin);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingCustom(false);
    }
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
    setCustomPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedSearch, selectedService, productType, activeTab]);

  useEffect(() => {
    if (activeTab === 'browse') fetchProducts();
  }, [debouncedSearch, selectedService, productType, pagination.page, pagination.limit, activeTab]);

  useEffect(() => {
    if (activeTab === 'custom') fetchCustomMargins();
  }, [debouncedSearch, productType, customPagination.page, customPagination.limit, activeTab]);

  const openEdit = (product) => {
    setEditProduct(product);
    const currentMember = product.custom_margin_percent ?? product.margin_percent ?? globalMargin;
    const currentReseller = product.custom_reseller_margin_percent ?? product.reseller_margin_percent ?? globalResellerMargin;
    setMarginInput(String(currentMember));
    setResellerMarginInput(String(currentReseller));
  };

  const handleSave = async () => {
    const memVal = parseFloat(marginInput);
    const resVal = resellerMarginInput !== '' ? parseFloat(resellerMarginInput) : null;

    if (Number.isNaN(memVal) || memVal < 0 || memVal > 100) {
      toast.error('Margin member harus antara 0% - 100%');
      return;
    }
    if (resVal !== null && (Number.isNaN(resVal) || resVal < 0 || resVal > 100)) {
      toast.error('Margin reseller harus antara 0% - 100%');
      return;
    }

    setSaving(true);
    try {
      const res = await put(API_ENDPOINTS.PRODUCTS.MARGINS.SET(editProduct.buyer_sku_code), {
        margin_percent: memVal,
        reseller_margin_percent: resVal,
        product_name: editProduct.product_name,
        transaction_type: isPasca ? 'pasca' : 'prepaid',
      });
      toast.success(res.message);
      setEditProduct(null);
      if (activeTab === 'browse') fetchProducts();
      else fetchCustomMargins();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (product) => {
    if (!product.has_custom_margin && !product.custom_margin_percent) {
      toast.error('Produk ini menggunakan margin global');
      return;
    }

    setSaving(true);
    try {
      const res = await del(API_ENDPOINTS.PRODUCTS.MARGINS.SET(product.buyer_sku_code));
      toast.success(res.message);
      setEditProduct(null);
      if (activeTab === 'browse') fetchProducts();
      else fetchCustomMargins();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const previewSelling = (product, marginValue) => {
    const base = parseFloat(product.price) || 0;
    const margin = parseFloat(marginValue) || 0;
    return Math.ceil(base + (base * margin) / 100);
  };

  return (
    <div>
      <Header
        title="Margin Produk"
        subtitle="Atur margin Member & Reseller per item"
        right={
          <Link to="/admin/margin" className="p-2 bg-white/20 rounded-xl" title="Pengaturan Global">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
        }
      />

      <div className="px-4 -mt-4 space-y-3">
        {/* Info Global Margins */}
        <div className="bg-white border rounded-2xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Percent className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Global Member</p>
              <p className="text-sm font-bold text-blue-600">{globalMargin}%</p>
            </div>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Global Reseller</p>
              <p className="text-sm font-bold text-emerald-600">{globalResellerMargin}%</p>
            </div>
          </div>
          <Link to="/admin/margin" className="text-xs text-primary-600 font-medium hover:underline">
            Ubah
          </Link>
        </div>

        {/* Type Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setProductType(tab.id);
                if (tab.id === 'pasca') setSelectedService('pln-pasca');
                else setSelectedService('pulsa');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                productType === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Browse vs Custom */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'browse'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Katalog Produk
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'custom'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Khusus Diatur ({customPagination.total || 0})
          </button>
        </div>

        {/* Filter Services if browse */}
        {activeTab === 'browse' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {SERVICES.filter((s) => s.type === productType).map((svc) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedService === svc.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {svc.label}
              </button>
            ))}
          </div>
        )}

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari SKU atau nama produk..."
        />

        {activeTab === 'browse' ? (
          loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : products.length === 0 ? (
            <EmptyState title="Produk tidak ditemukan" />
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div
                  key={product.buyer_sku_code}
                  className="bg-white border rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{product.product_name}</p>
                    <p className="text-xs text-gray-500">{product.buyer_sku_code} • {product.brand}</p>
                    {!isPasca && (
                      <p className="text-xs text-gray-600 mt-1">
                        Modal: <span className="font-medium">{formatCurrency(product.price)}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        product.has_custom_margin
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        Member: {product.custom_margin_percent ?? globalMargin}%
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        product.custom_reseller_margin_percent != null
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        💎 Reseller: {product.custom_reseller_margin_percent ?? globalResellerMargin}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {product.has_custom_margin && (
                      <button
                        type="button"
                        onClick={() => handleReset(product)}
                        disabled={saving}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Kembali ke margin global"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      title="Atur margin"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loadingCustom ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : customMargins.length === 0 ? (
          <EmptyState
            title="Belum ada margin khusus"
            description={`Semua produk ${productType} saat ini memakai margin global (Member: ${globalMargin}%, Reseller: ${globalResellerMargin}%)`}
          />
        ) : (
          <div className="space-y-2">
            {customMargins.map((item) => (
              <div
                key={item.buyer_sku_code}
                className="bg-white border rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{item.buyer_sku_code} • {item.transaction_type}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                      Member: {item.margin_percent}%
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                      💎 Reseller: {item.reseller_margin_percent ?? globalResellerMargin}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReset({ ...item, has_custom_margin: true })}
                    disabled={saving}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Kembali ke margin global"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit({
                      buyer_sku_code: item.buyer_sku_code,
                      product_name: item.product_name,
                      custom_margin_percent: item.margin_percent,
                      custom_reseller_margin_percent: item.reseller_margin_percent,
                      margin_percent: item.margin_percent,
                      reseller_margin_percent: item.reseller_margin_percent,
                      has_custom_margin: true,
                      price: 0,
                    })}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'browse' ? (
          <Pagination
            pagination={pagination}
            onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
            onLimitChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
          />
        ) : (
          <Pagination
            pagination={customPagination}
            onPageChange={(page) => setCustomPagination((p) => ({ ...p, page }))}
            onLimitChange={(limit) => setCustomPagination((p) => ({ ...p, limit, page: 1 }))}
          />
        )}
      </div>

      <Modal
        isOpen={!!editProduct}
        onClose={() => setEditProduct(null)}
        title="Atur Margin Khusus Produk"
      >
        {editProduct && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-semibold text-gray-900 text-sm">{editProduct.product_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{editProduct.buyer_sku_code}</p>
              {!isPasca && editProduct.price > 0 && (
                <p className="text-xs text-gray-600 mt-1.5 font-medium">
                  Harga modal: {formatCurrency(editProduct.price)}
                </p>
              )}
            </div>

            {/* Member Margin Input */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-blue-900">Margin Member (%)</label>
                <span className="text-[10px] text-blue-600">Global: {globalMargin}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-blue-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[3, 5, 7, 10, 15].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMarginInput(String(preset))}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      parseFloat(marginInput) === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Reseller Margin Input */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-emerald-900">💎 Margin Reseller (%)</label>
                <span className="text-[10px] text-emerald-600">Global: {globalResellerMargin}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={resellerMarginInput}
                onChange={(e) => setResellerMarginInput(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-emerald-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[0, 1, 1.5, 2, 2.5, 3, 5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setResellerMarginInput(String(preset))}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      parseFloat(resellerMarginInput) === preset
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Price Preview */}
            {!isPasca && editProduct.price > 0 && (
              <div className="bg-slate-50 border rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Harga Jual Member:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(previewSelling(editProduct, marginInput))}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Harga Jual Reseller:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(previewSelling(editProduct, resellerMarginInput))}</span>
                </div>
                <div className="border-t pt-1 flex justify-between text-emerald-700 font-medium">
                  <span>Selisih Hemat Reseller:</span>
                  <span>{formatCurrency(Math.max(0, previewSelling(editProduct, marginInput) - previewSelling(editProduct, resellerMarginInput)))}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {editProduct.has_custom_margin && (
                <button
                  type="button"
                  onClick={() => handleReset(editProduct)}
                  disabled={saving}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  Pakai Global
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center"
              >
                {saving ? <LoadingSpinner size="sm" className="text-white" /> : 'Simpan Margin'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductMargins;
