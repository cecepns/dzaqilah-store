export const buildWhatsAppUrl = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('0')) normalized = `62${normalized.slice(1)}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
};

export const buildWhatsAppShareUrl = (message) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

export const buildTopupWhatsAppMessage = (user, amount, paymentAccount = null) => {
  let msg = `Halo Admin Dzaqilah Store,\n\nSaya ingin request topup saldo:\n` +
    `Nama: ${user?.name || '-'}\n` +
    `Email: ${user?.email || '-'}\n` +
    `Nominal: Rp ${Number(amount || 0).toLocaleString('id-ID')}\n`;

  if (paymentAccount?.bank_name) {
    msg += `Tujuan Transfer: ${paymentAccount.bank_name} - ${paymentAccount.account_number || ''} (a.n ${paymentAccount.account_name || ''})\n`;
  }

  msg += `\nMohon konfirmasi. Terima kasih.`;
  return msg;
};

