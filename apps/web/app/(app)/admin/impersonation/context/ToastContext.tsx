import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'success' | 'error';

interface ToastState {
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const SUCCESS_MS = 2500;
const ERROR_MS = 4000;

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12l4 4L19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

interface ToastViewportProps {
  toast: ToastState | null;
  visible: boolean;
  onDismiss: () => void;
}

function ToastViewport({ toast, visible, onDismiss }: ToastViewportProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className="toast-layer" aria-live="polite">
      <button
        type="button"
        className={`toast toast-${toast.kind}${visible ? ' toast-visible' : ''}`}
        role={toast.kind === 'error' ? 'alert' : 'status'}
        onClick={onDismiss}
      >
        <span className="toast-icon">
          {toast.kind === 'success' ? <CheckIcon /> : <AlertCircleIcon />}
        </span>
        <span className="toast-message">{toast.message}</span>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setVisible(false);
    hideTimerRef.current = window.setTimeout(() => {
      setToast(null);
      hideTimerRef.current = null;
    }, 200);
  }, [clearTimers]);

  const showToast = useCallback(
    (message: string, kind: ToastKind) => {
      clearTimers();
      setVisible(false);
      setToast({ message, kind });

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });

      timerRef.current = window.setTimeout(
        dismiss,
        kind === 'success' ? SUCCESS_MS : ERROR_MS,
      );
    },
    [clearTimers, dismiss],
  );

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toast={toast} visible={visible} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
