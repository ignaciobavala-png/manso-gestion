import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'info' | 'success' | 'warning'
  isOpen: boolean
  onClose: () => void
  action?: { label: string; onClick: () => void }
}

export default function Toast({ message, type, isOpen, onClose, action }: ToastProps) {
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const bgColor = type === 'success'
    ? 'bg-emerald-700/90 border-emerald-500'
    : type === 'warning'
      ? 'bg-orange-700/90 border-orange-500'
      : 'bg-zinc-800/90 border-zinc-600'

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-down">
      <div className={`${bgColor} backdrop-blur-sm border rounded-xl px-4 py-3 shadow-2xl max-w-sm flex items-center gap-3`}>
        <span className="text-white text-sm flex-1">{message}</span>
        {action && (
          <button
            onClick={() => { action.onClick(); onClose() }}
            className="text-emerald-300 hover:text-emerald-200 text-sm font-semibold whitespace-nowrap"
          >
            {action.label}
          </button>
        )}
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
