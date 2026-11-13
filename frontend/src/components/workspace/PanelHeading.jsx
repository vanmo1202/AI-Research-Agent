export default function PanelHeading({ title, icon: Icon, action, description }) {
  return (
    <>
      <div className="ref-card-header">
        {Icon && <Icon size={19} className="ref-card-icon" />}
        <h2>{title}</h2>
        {action && <div className="ref-push">{action}</div>}
      </div>
      {description && <p className="ref-card-subtitle">{description}</p>}
    </>
  );
}
