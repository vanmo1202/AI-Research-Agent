const placeholders = {
  title: 'Nguồn đang chờ bản tiếng Việt',
  snippet: 'Tóm tắt tiếng Việt chưa sẵn sàng.',
  content: 'Nội dung tiếng Việt chưa sẵn sàng. Vui lòng thử lại sau.',
};
export function sourceDisplay(source = {}) {
  const trusted = ['complete', 'partial', 'not_required'].includes(source.translationStatus);
  const read = (field) => {
    if (source.sourceLanguage === 'vi')
      return source[field + 'Vi'] || source[field] || placeholders[field];
    return (
      (trusted &&
        (source['display' + field[0].toUpperCase() + field.slice(1)] || source[field + 'Vi'])) ||
      placeholders[field]
    );
  };
  return {
    title: read('title'),
    snippet: read('snippet'),
    content: read('content'),
    notice:
      source.translationStatus === 'partial'
        ? 'Một phần nội dung chưa thể dịch.'
        : source.translationStatus === 'pending'
          ? 'Đang xử lý bản dịch tiếng Việt...'
          : source.translationStatus === 'failed'
            ? 'Bản dịch tiếng Việt chưa sẵn sàng. Vui lòng thử lại sau.'
            : '',
    ready: source.sourceLanguage === 'vi' || (trusted && Boolean(source.contentVi)),
  };
}
