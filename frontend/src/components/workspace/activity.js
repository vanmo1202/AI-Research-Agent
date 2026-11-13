export function accountActivity({ researches = [], documents = [], chats = [], memories = [] }) {
  const entries = [
    ...researches.map((r) => ({
      id: `r-${r.id}`,
      title: 'Đã tạo nghiên cứu',
      detail: r.topic,
      date: r.created_at,
      kind: 'research',
      url: `/research/${encodeURIComponent(r.id)}`,
    })),
    ...documents.map((d) => ({
      id: `d-${d.id}`,
      title: 'Đã tải lên tài liệu',
      detail: d.filename,
      date: d.created_at,
      kind: 'document',
      url: `/documents/${encodeURIComponent(d.id)}`,
    })),
    ...chats.map((c) => ({
      id: `c-${c.id}`,
      title: 'Đã tạo hội thoại',
      detail: c.title || 'Hội thoại tài liệu',
      date: c.created_at,
      kind: 'chat',
      url: c.request_id
        ? `/research/${encodeURIComponent(c.request_id)}/chat/${encodeURIComponent(c.id)}`
        : `/chat/${encodeURIComponent(c.id)}`,
    })),
    ...memories.map((m) => ({
      id: `m-${m.id}`,
      title: m.status === 'verified' ? 'Bộ nhớ đã xác minh' : 'Cập nhật bộ nhớ',
      detail: m.content,
      date: m.updated_at || m.created_at,
      kind: 'memory',
      url: '/memories',
    })),
  ];
  return entries
    .filter((e) => e.date && Number.isFinite(Date.parse(e.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 20);
}
