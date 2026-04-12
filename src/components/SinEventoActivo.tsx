export default function SinEventoActivo() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-montserrat flex items-center justify-center">
      <div className="text-center px-8 max-w-sm">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Sin evento activo</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Para operar la barra o registrar entradas primero tenés que iniciar un evento desde <span className="text-emerald-400 font-medium">Control</span>.
        </p>
      </div>
    </div>
  )
}
