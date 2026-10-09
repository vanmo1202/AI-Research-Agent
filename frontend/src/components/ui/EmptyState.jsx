import { FolderSearch } from 'lucide-react';
export default function EmptyState({ title, description, children }) {
  return (
    <div className="empty-state">
      <div className="icon-tile">
        <FolderSearch size={28} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
