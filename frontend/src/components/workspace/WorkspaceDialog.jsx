import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export default function WorkspaceDialog({ title, children, onClose, wide = false }) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`ref-modal ref-native-dialog ${wide ? 'ref-dialog-wide' : ''}`}
      aria-labelledby={id}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="ref-modal-head">
        <h2 id={id}>{title}</h2>
        <button className="ref-icon-btn" aria-label="Đóng hộp thoại" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      <div className="ref-modal-body">{children}</div>
    </dialog>,
    document.body,
  );
}
