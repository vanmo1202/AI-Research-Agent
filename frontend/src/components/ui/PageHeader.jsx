export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="studio-page-header">
      <div>
        {eyebrow && <p className="studio-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="studio-page-description">{description}</p>}
      </div>
      {children && <div className="studio-page-actions">{children}</div>}
    </div>
  );
}
