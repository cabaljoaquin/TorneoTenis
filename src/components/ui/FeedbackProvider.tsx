'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'

type ToastType = 'success' | 'error'

interface ToastItem {
  id: number
  msg: string
  type: ToastType
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface FeedbackContextValue {
  toast: (msg: string, type?: ToastType) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>')
  return ctx
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export default function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const idRef = useRef(0)

  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setConfirmState({ ...opts, resolve })
    })
  }, [])

  const closeConfirm = (ok: boolean) => {
    if (!confirmState) return
    confirmState.resolve(ok)
    setConfirmState(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toasts ── */}
      <div className="fixed bottom-6 right-6 z-[110] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium bg-surface ${
                t.type === 'success'
                  ? 'border-green-500/30 text-green-300'
                  : 'border-red-500/30 text-red-300'
              }`}
            >
              {t.type === 'success'
                ? <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                : <AlertCircle size={18} className="text-red-400 shrink-0" />
              }
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Diálogo de confirmación ── */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => closeConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="relative z-10 w-full max-w-sm bg-surface border border-surface-border rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmState.danger
                    ? 'bg-red-500/10 border-red-500/25 text-red-400'
                    : 'bg-brand-500/10 border-brand-500/25 text-brand-400'
                }`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 id="confirm-title" className="text-base font-bold text-slate-100 leading-tight">
                    {confirmState.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">
                    {confirmState.message}
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                <button
                  onClick={() => closeConfirm(false)}
                  autoFocus
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 bg-surface-card hover:bg-surface-border rounded-lg transition-colors"
                >
                  {confirmState.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  onClick={() => closeConfirm(true)}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${
                    confirmState.danger
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-brand-600 hover:bg-brand-500'
                  }`}
                >
                  {confirmState.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  )
}
