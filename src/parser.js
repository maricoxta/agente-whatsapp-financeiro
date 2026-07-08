const PAYMENT_KEYWORDS = new Set([
  'credito', 'crédito', 'debito', 'débito', 'pix', 'dinheiro', 'boleto',
  'transferencia', 'transferência',
]);

const VALUE_REGEX = /(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)\s*$/;

function toNumber(valueStr) {
  const normalized = valueStr.includes(',')
    ? valueStr.replace(/\./g, '').replace(',', '.')
    : valueStr;
  return parseFloat(normalized);
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// Parses messages like "mercado - crédito - R$48,03", "mercado crédito 48,03 reais"
// or "mercado crédito 48,03" into { descricao, valorPrevisto }. Returns null if no
// description or value can be extracted.
function parseExpenseMessage(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  text = text.replace(/R\$\s*/gi, '');
  text = text.replace(/\breais?\b/gi, '');
  text = text.trim();

  const valueMatch = text.match(VALUE_REGEX);
  if (!valueMatch) return null;

  const valorPrevisto = toNumber(valueMatch[1]);
  if (Number.isNaN(valorPrevisto)) return null;

  const rest = text.slice(0, valueMatch.index);
  const tokens = rest
    .split(/[-\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !PAYMENT_KEYWORDS.has(t.toLowerCase()));

  if (tokens.length === 0) return null;

  const descricao = capitalize(tokens.join(' '));
  return { descricao, valorPrevisto };
}

module.exports = { parseExpenseMessage, PAYMENT_KEYWORDS };
