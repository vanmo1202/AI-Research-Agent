export default function ResearchOrbit() {
  return (
    <svg className="studio-orbit" viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <circle cx="200" cy="200" r="185" stroke="currentColor" strokeOpacity=".17" />
      <circle
        cx="200"
        cy="200"
        r="165"
        stroke="currentColor"
        strokeOpacity=".15"
        strokeDasharray="3 4"
      />
      <circle cx="200" cy="200" r="143" stroke="currentColor" strokeOpacity=".2" />
      <circle cx="200" cy="200" r="101" stroke="currentColor" strokeOpacity=".2" />
      <circle cx="200" cy="200" r="68" fill="#265245" />
      <text
        x="200"
        y="245"
        textAnchor="middle"
        fill="#ebd6bb"
        fontFamily="Georgia,serif"
        fontSize="132"
      >
        R
      </text>
      <path d="m92 84 8 8-8 8-8-8Z" fill="var(--terracotta)" />
      <circle cx="322" cy="280" r="5" fill="var(--sage)" />
    </svg>
  );
}
