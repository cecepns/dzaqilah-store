import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight, ArrowLeft, Percent, Edit2, Sparkles, Smartphone, ArrowDownWideNarrow, ArrowUpNarrowWide, Layers } from 'lucide-react';
import Header from '../components/layout/Header';
import SearchInput from '../components/ui/SearchInput';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import OperatorPhoneInput from '../components/ui/OperatorPhoneInput';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { get, post, put, del, formatCurrency, getErrorMessage } from '../utils/request';
import { API_ENDPOINTS } from '../utils/endpoints';
import { getServiceById, SERVICES } from '../constants/services';
import { detectOperator, matchBrandFromOperator, getOperatorLogo } from '../utils/operatorDetector';

const ServiceProducts = () => {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const initialPhone = searchParams.get('phone') || '';

  const service = getServiceById(serviceId);
  const isPasca = service.type === 'pasca';
  const isPhoneService = service.customerLabel === 'Nomor HP';

  const { user, updateBalance, refreshProfile, isAdmin, isReseller } = useAuth();
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [globalMargin, setGlobalMargin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = termurah ke termahal
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [marginEditProduct, setMarginEditProduct] = useState(null);
  const [marginInput, setMarginInput] = useState('');
  const [savingMargin, setSavingMargin] = useState(false);
  const [customerNo, setCustomerNo] = useState(initialPhone);
  const [detectedOperator, setDetectedOperator] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [inquiryData, setInquiryData] = useState(null);
  const [inquiring, setInquiring] = useState(false);

  const debouncedSearch = useDebounce(search);
  const Icon = service.icon;
  const productsEndpoint = isPasca ? API_ENDPOINTS.PRODUCTS.PASCA : API_ENDPOINTS.PRODUCTS.PREPAID;

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await get(productsEndpoint, {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        brand: selectedBrand,
        type: selectedType,
        service: service.id,
        sort: sortOrder,
      });

      // Ensure client-side sorting guarantee (cheapest to most expensive by default)
      const list = [...(res.data || [])];
      list.sort((a, b) => {
        const valA = parseFloat(isPasca ? (a.admin ?? 0) : (a.selling_price ?? a.price ?? 0));
        const valB = parseFloat(isPasca ? (b.admin ?? 0) : (b.selling_price ?? b.price ?? 0));
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });

      setProducts(list);
      setPagination(res.pagination);
      setGlobalMargin(res.margin_percent ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedBrand('');
    setSelectedType('');
    setSearch('');
    setPagination((p) => ({ ...p, page: 1 }));
  }, [serviceId]);

  useEffect(() => {
    setSelectedType('');
    if (!service.id) {
      setTypes([]);
      return;
    }
    get(API_ENDPOINTS.PRODUCTS.TYPES, { service: service.id, brand: selectedBrand })
      .then((res) => {
        setTypes(res.data || []);
      })
      .catch(() => setTypes([]));
  }, [service.id, selectedBrand]);

  useEffect(() => {
    get(API_ENDPOINTS.PRODUCTS.BRANDS, { service: service.id })
      .then((res) => {
        const fetchedBrands = res.data || [];
        setBrands(fetchedBrands);

        // If phone already entered, auto-match brand
        if (customerNo && fetchedBrands.length) {
          const op = detectOperator(customerNo);
          if (op) {
            setDetectedOperator(op);
            const matched = matchBrandFromOperator(op, fetchedBrands);
            if (matched) {
              setSelectedBrand(matched);
            }
          }
        }
      })
      .catch(() => setBrands([]));
  }, [service.id]);

  const handleOperatorChange = (op) => {
    setDetectedOperator(op);
    if (op && brands.length) {
      const matched = matchBrandFromOperator(op, brands);
      if (matched && matched !== selectedBrand) {
        setSelectedBrand(matched);
        setSelectedType('');
        setPagination((p) => ({ ...p, page: 1 }));
      }
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, selectedBrand, selectedType, pagination.page, pagination.limit, service.id, isPasca, sortOrder]);

  const resetModal = () => {
    setSelectedProduct(null);
    if (!isPhoneService) {
      setCustomerNo('');
    }
    setInquiryData(null);
  };

  const openMarginEdit = (e, product) => {
    e.stopPropagation();
    setMarginEditProduct(product);
    setMarginInput(String(product.custom_margin_percent ?? product.margin_percent ?? globalMargin));
  };

  const handleSaveMargin = async () => {
    const value = parseFloat(marginInput);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Margin harus antara 0% - 100%');
      return;
    }

    setSavingMargin(true);
    try {
      const res = await put(API_ENDPOINTS.PRODUCTS.MARGINS.SET(marginEditProduct.buyer_sku_code), {
        margin_percent: value,
        product_name: marginEditProduct.product_name,
        transaction_type: isPasca ? 'pasca' : 'prepaid',
      });
      toast.success(res.message);
      setMarginEditProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingMargin(false);
    }
  };

  const handleResetMargin = async () => {
    setSavingMargin(true);
    try {
      const res = await del(API_ENDPOINTS.PRODUCTS.MARGINS.SET(marginEditProduct.buyer_sku_code));
      toast.success(res.message);
      setMarginEditProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingMargin(false);
    }
  };

  const previewSellingPrice = (product, marginValue) => {
    const base = parseFloat(product.price) || 0;
    const margin = parseFloat(marginValue) || 0;
    return Math.ceil(base + (base * margin) / 100);
  };

  const handleBuy = async () => {
    if (!customerNo || customerNo.length < service.minLength) {
      toast.error(`${service.customerLabel} tidak valid`);
      return;
    }
    if (parseFloat(user.balance) < selectedProduct.selling_price) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    setProcessing(true);
    try {
      const res = await post(API_ENDPOINTS.TRANSACTIONS.TOPUP, {
        buyer_sku_code: selectedProduct.buyer_sku_code,
        customer_no: customerNo,
        product_name: selectedProduct.product_name,
        category: selectedProduct.category,
        brand: selectedProduct.brand,
        price: selectedProduct.price,
      });
      toast.success(res.message);
      updateBalance(res.data.balance_after);
      await refreshProfile();
      resetModal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleInquiry = async () => {
    if (!customerNo || customerNo.length < service.minLength) {
      toast.error(`${service.customerLabel} tidak valid`);
      return;
    }

    setInquiring(true);
    try {
      const res = await post(API_ENDPOINTS.TRANSACTIONS.PASCA_INQUIRY, {
        buyer_sku_code: selectedProduct.buyer_sku_code,
        customer_no: customerNo,
        product_name: selectedProduct.product_name,
        category: selectedProduct.category,
        brand: selectedProduct.brand,
      });
      setInquiryData(res.data);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setInquiring(false);
    }
  };

  const handlePayPasca = async () => {
    if (!inquiryData?.ref_id) return;
    if (parseFloat(user.balance) < inquiryData.selling_price) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    setProcessing(true);
    try {
      const res = await post(API_ENDPOINTS.TRANSACTIONS.PASCA_PAY, { ref_id: inquiryData.ref_id });
      toast.success(res.message);
      updateBalance(res.data.balance_after);
      await refreshProfile();
      resetModal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  if (!SERVICES.find((s) => s.id === serviceId)) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Layanan tidak ditemukan</p>
        <Link to="/layanan" className="text-primary-600 text-sm mt-2 inline-block">Kembali</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header
        title={service.label}
        subtitle={`Dzaqilah Cell • Saldo: ${formatCurrency(user?.balance)}`}
        backTo="/layanan"
      />

      <div className="max-w-mobile mx-auto px-3.5 pt-3.5 space-y-3">
        {isReseller && (
          <div className="flex items-center gap-2.5 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-xs text-emerald-800 text-xs">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Akun Reseller Aktif
              </p>
              <p className="text-[11px] text-emerald-700">Harga khusus reseller diterapkan otomatis di seluruh produk.</p>
            </div>
          </div>
        )}

        {isPhoneService && (
          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-primary-600" />
                Nomor Tujuan
              </label>
            </div>
            <OperatorPhoneInput
              value={customerNo}
              onChange={setCustomerNo}
              onOperatorChange={handleOperatorChange}
              placeholder="Masukkan nomor HP tujuan (contoh: 0812xxxx)"
            />
          </div>
        )}

        <SearchInput value={search} onChange={setSearch} placeholder={`Cari ${service.label.toLowerCase()}...`} />

        {brands.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => { setSelectedBrand(''); setPagination((p) => ({ ...p, page: 1 })); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${!selectedBrand ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
            >
              Semua
            </button>
            {brands.map((brand) => {
              const brandLogo = getOperatorLogo(brand);
              return (
                <button
                  key={brand}
                  onClick={() => { setSelectedBrand(brand); setPagination((p) => ({ ...p, page: 1 })); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedBrand === brand ? 'bg-primary-600 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {brandLogo && (
                    <img src={brandLogo} alt={brand} className="w-4 h-4 object-contain rounded bg-white p-0.5 flex-shrink-0" />
                  )}
                  <span>{brand}</span>
                </button>
              );
            })}
          </div>
        )}

        {types.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary-600" />
                <span>Kategori Paket {selectedBrand ? `(${selectedBrand})` : ''}</span>
              </span>
              {selectedType && (
                <button
                  type="button"
                  onClick={() => { setSelectedType(''); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="text-[11px] font-bold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Reset Kategori
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => { setSelectedType(''); setPagination((p) => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  !selectedType
                    ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Semua Kategori
              </button>
              {types.map((typeItem) => (
                <button
                  key={typeItem}
                  type="button"
                  onClick={() => { setSelectedType(typeItem); setPagination((p) => ({ ...p, page: 1 })); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedType === typeItem
                      ? 'bg-gradient-to-r from-teal-700 to-cyan-700 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {typeItem}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1 pt-1 text-xs">
          <span className="text-gray-500 font-medium">
            {pagination.total > 0 ? `${pagination.total} produk ditemukan` : 'Daftar Produk'}
          </span>
          <button
            type="button"
            onClick={() => {
              setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold border border-teal-200/70 shadow-xs transition-colors text-[11px]"
            title="Klik untuk mengubah urutan harga"
          >
            {sortOrder === 'asc' ? (
              <>
                <ArrowDownWideNarrow className="w-3.5 h-3.5 text-teal-600 stroke-[2.2]" />
                <span>Harga Termurah</span>
              </>
            ) : (
              <>
                <ArrowUpNarrowWide className="w-3.5 h-3.5 text-teal-600 stroke-[2.2]" />
                <span>Harga Termahal</span>
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : products.length === 0 ? (
          <EmptyState title="Produk tidak ditemukan" description="Coba ubah filter atau hubungi admin" />
        ) : (
          <div className="space-y-2.5">
            {products.map((product) => (
              <button
                key={product.buyer_sku_code}
                onClick={() => {
                  if (product.is_buyable === false) {
                    toast.error('Produk belum diaktifkan di Digiflazz. Hubungi admin.');
                    return;
                  }
                  setSelectedProduct(product);
                }}
                className={`w-full bg-white border border-gray-200/90 rounded-2xl p-3.5 hover:shadow-md hover:border-primary-200 active:scale-[0.99] transition-all text-left flex flex-col justify-between group ${
                  product.is_buyable === false ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3 w-full">
                  {(() => {
                    const opLogo = getOperatorLogo(product.brand) || getOperatorLogo(product.product_name);
                    if (opLogo) {
                      return (
                        <div className="w-11 h-11 bg-white border border-gray-100 rounded-xl p-1.5 flex items-center justify-center flex-shrink-0 shadow-xs">
                          <img
                            src={opLogo}
                            alt={product.brand || product.product_name}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      );
                    }
                    return (
                      <div className={`w-11 h-11 ${service.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    );
                  })()}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug break-words">
                      {product.product_name}
                    </h3>

                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      <span className="text-[11px] font-medium text-gray-500">
                        {product.brand} • {product.category}
                      </span>
                      {product.type && (
                        <span className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/60 text-[10px] font-semibold">
                          {product.type}
                        </span>
                      )}
                      {isAdmin && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          product.has_custom_margin
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Percent className="w-2.5 h-2.5" />
                          {product.has_custom_margin
                            ? `${product.custom_margin_percent}% khusus`
                            : `${globalMargin}% global`}
                        </span>
                      )}
                    </div>

                    {product.desc && product.desc !== '-' && product.desc.toLowerCase() !== product.product_name.toLowerCase() && (
                      <p className="text-[11px] text-gray-600 mt-2 bg-gray-50/90 rounded-lg p-2 border border-gray-100/90 leading-relaxed whitespace-pre-line break-words">
                        {product.desc}
                      </p>
                    )}

                    {isPasca && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Biaya admin: <span className="font-semibold text-gray-700">{formatCurrency(product.admin)}</span>
                      </p>
                    )}

                    {product.is_buyable === false && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">
                        Belum aktif di akun Digiflazz
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-gray-100 w-full">
                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => openMarginEdit(e, product)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg text-[11px] font-semibold transition-colors"
                        title="Atur margin produk"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Atur Margin</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <div className="text-right">
                      {isPasca ? (
                        <span className="text-xs font-bold text-primary-600">Cek Tagihan</span>
                      ) : (
                        <>
                          <span className={`font-extrabold text-base ${isReseller ? 'text-emerald-600' : 'text-primary-600'}`}>
                            {formatCurrency(product.selling_price)}
                          </span>
                          {isReseller && product.member_price > product.selling_price && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] line-through text-gray-400">
                                {formatCurrency(product.member_price)}
                              </span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 font-semibold px-1 rounded">
                                Hemat
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                      <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <Pagination
          pagination={pagination}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          onLimitChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
        />
      </div>

      <Modal
        isOpen={!!selectedProduct}
        onClose={resetModal}
        title={isPasca ? `Bayar ${service.label}` : `Beli ${service.label}`}
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
              {(() => {
                const modalLogo = getOperatorLogo(selectedProduct.brand) || getOperatorLogo(selectedProduct.product_name);
                if (modalLogo) {
                  return (
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl p-1.5 flex items-center justify-center flex-shrink-0 shadow-xs">
                      <img src={modalLogo} alt={selectedProduct.brand} className="w-full h-full object-contain" />
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{selectedProduct.product_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{selectedProduct.brand}</p>
              </div>
            </div>
            {!isPasca && (
              <div className="px-1 -mt-2">
                <p className={`text-xl font-bold ${isReseller ? 'text-emerald-600' : 'text-primary-600'}`}>
                  {formatCurrency(selectedProduct.selling_price)}
                </p>
                {isReseller && selectedProduct.member_price > selectedProduct.selling_price && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 line-through">
                      Harga Member: {formatCurrency(selectedProduct.member_price)}
                    </span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                      Hemat {formatCurrency(selectedProduct.member_price - selectedProduct.selling_price)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!inquiryData ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{service.customerLabel}</label>
                  {isPhoneService ? (
                    <OperatorPhoneInput
                      value={customerNo}
                      onChange={setCustomerNo}
                      onOperatorChange={handleOperatorChange}
                      placeholder={service.customerPlaceholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={customerNo}
                      onChange={(e) => setCustomerNo(e.target.value)}
                      placeholder={service.customerPlaceholder}
                      className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>

                {isPasca ? (
                  <button
                    onClick={handleInquiry}
                    disabled={inquiring}
                    className="w-full bg-amber-500 text-white py-3 rounded-xl font-medium hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center"
                  >
                    {inquiring ? <LoadingSpinner size="sm" className="text-white" /> : 'Cek Tagihan'}
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Saldo Anda</span>
                      <span className="font-medium">{formatCurrency(user?.balance)}</span>
                    </div>
                    <button
                      onClick={handleBuy}
                      disabled={processing}
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-60 flex items-center justify-center transition-all"
                    >
                      {processing ? <LoadingSpinner size="sm" className="text-white" /> : 'Beli Sekarang'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nama</span>
                    <span className="font-medium text-gray-900">{inquiryData.customer_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{service.customerLabel}</span>
                    <span className="font-medium text-gray-900">{inquiryData.customer_no}</span>
                  </div>
                  {inquiryData.periode && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Periode</span>
                      <span className="font-medium text-gray-900">{inquiryData.periode}</span>
                    </div>
                  )}
                  {inquiryData.desc?.tarif && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tarif/Daya</span>
                      <span className="font-medium text-gray-900">
                        {inquiryData.desc.tarif} / {inquiryData.desc.daya} VA
                      </span>
                    </div>
                  )}
                  {Array.isArray(inquiryData.desc?.detail) && inquiryData.desc.detail.length > 0 && (
                    <div className="pt-2 border-t border-amber-100 space-y-1">
                      {inquiryData.desc.detail.map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-600">
                          Periode {item.periode}: Tagihan {formatCurrency(item.nilai_tagihan)}
                          {item.denda ? ` + Denda ${formatCurrency(item.denda)}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-amber-100">
                    <span className="text-gray-700 font-medium">Total Bayar</span>
                    <span className="font-bold text-teal-600 text-lg">
                      {formatCurrency(inquiryData.selling_price)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Saldo Anda</span>
                  <span className="font-medium">{formatCurrency(user?.balance)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInquiryData(null)}
                    className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50"
                  >
                    Ubah ID
                  </button>
                  <button
                    onClick={handlePayPasca}
                    disabled={processing}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-60 flex items-center justify-center transition-all"
                  >
                    {processing ? <LoadingSpinner size="sm" className="text-white" /> : 'Bayar Sekarang'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!marginEditProduct}
        onClose={() => setMarginEditProduct(null)}
        title="Atur Margin Produk"
      >
        {marginEditProduct && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-medium text-gray-900">{marginEditProduct.product_name}</p>
              <p className="text-xs text-gray-500 mt-1">{marginEditProduct.buyer_sku_code}</p>
              {!isPasca && (
                <p className="text-sm text-gray-500 mt-2">
                  Harga modal: {formatCurrency(marginEditProduct.price)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Margin (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {!isPasca && (
              <div className="bg-primary-50 rounded-xl p-3 text-sm flex justify-between">
                <span className="text-gray-600">Preview harga jual</span>
                <span className="font-bold text-primary-600">
                  {formatCurrency(previewSellingPrice(marginEditProduct, marginInput))}
                </span>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Margin global: {globalMargin}%. Kosongkan khusus dengan tombol &quot;Pakai Global&quot;.
            </p>

            <div className="flex gap-2">
              {marginEditProduct.has_custom_margin && (
                <button
                  type="button"
                  onClick={handleResetMargin}
                  disabled={savingMargin}
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  Pakai Global
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveMargin}
                disabled={savingMargin}
                className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-60 flex items-center justify-center transition-all"
              >
                {savingMargin ? <LoadingSpinner size="sm" className="text-white" /> : 'Simpan Margin'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ServiceProducts;
