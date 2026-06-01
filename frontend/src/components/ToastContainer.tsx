import type { ToastMessage } from "../appTypes";

export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          <span className="toast-type">{toast.type}</span>
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
