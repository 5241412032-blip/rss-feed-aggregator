import { useEffect, useRef } from 'react';

export default function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setTimeout(onRemove, 3500);
    return () => clearTimeout(timer.current);
  }, [onRemove]);

  return (
    <div className={`toast ${toast.type}`} onClick={onRemove}>
      {toast.message}
    </div>
  );
}

