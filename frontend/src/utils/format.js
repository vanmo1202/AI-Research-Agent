export const outputLengths = { short: 'Ngắn', medium: 'Trung bình', long: 'Dài' };
export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
}
export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function providerLabel(provider) {
  return { mock: 'Mock', tavily: 'Tavily' }[provider] || provider || 'Không xác định';
}
