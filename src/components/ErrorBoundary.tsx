import { CircleAlert } from 'lucide-react'
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col items-center justify-center px-6 text-center gap-4">
          <CircleAlert className="text-terra-400" size={40} strokeWidth={1.25} aria-hidden />
          <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
          <p className="text-gray-300 text-sm max-w-xs">
            Ocurrió un error inesperado. Recargá la página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-terra-600 hover:bg-terra-500 text-white font-semibold py-3 px-6 rounded-2xl transition-all"
          >
            Recargar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
