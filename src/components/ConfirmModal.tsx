import { useEffect } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  type = 'danger'
}: ConfirmModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeStyles = {
    danger: 'bg-red-900/20 border-red-700',
    warning: 'bg-amber-900/20 border-amber-700',
    info: 'bg-blue-900/20 border-blue-700'
  }

  const confirmButtonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl border ${typeStyles[type]} p-6 shadow-2xl`}>
        <div className="flex items-start gap-4">
          <div className="mt-1 text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.768 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-white mb-2">
                {title}
              </h3>
            )}
            <p className="text-gray-200">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${confirmButtonStyles[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}