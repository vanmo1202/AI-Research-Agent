export default function SectionHeading({ id, eyebrow, title, description, children }) {
  return (
    <div className="studio-section-heading">
      <div>
        {eyebrow && <p className="studio-eyebrow">{eyebrow}</p>}
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
