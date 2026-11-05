export default function MemoryReviewPanel({ memories, selected, onChange }) {
  return (
    <fieldset className="memory-review">
      <legend>Bộ nhớ liên quan đã xác minh</legend>
      <p>Chỉ dùng bộ nhớ bạn chủ động chọn cho hội thoại này.</p>
      {!memories.length && <p>Chưa có gợi ý phù hợp.</p>}
      {memories.map((m) => (
        <label className="knowledge-checkbox" key={m.id}>
          <input
            type="checkbox"
            checked={selected.includes(m.id)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...selected, m.id] : selected.filter((id) => id !== m.id),
              )
            }
          />
          {m.content}
        </label>
      ))}
    </fieldset>
  );
}
