import QrScanner from 'qr-scanner'
import qrWorkerSource from 'qr-scanner/qr-scanner-worker.min.js?raw'

/**
 * El escáner de QR, con su worker ya resuelto.
 *
 * El worker va como blob para que funcione en producción (Vercel) sin depender
 * de rutas relativas ni de un CDN. Vive acá y no en cada pantalla que escanea
 * porque `WORKER_PATH` es global de la librería: setearlo en dos lugares es
 * pedir que algún día queden distintos.
 */
const workerBlob = new Blob([qrWorkerSource], { type: 'application/javascript' })
QrScanner.WORKER_PATH = URL.createObjectURL(workerBlob)

/** Las mismas opciones en toda la app: cámara trasera y el recuadro que le
 *  muestra a quien escanea dónde está mirando. */
export const OPCIONES_ESCANER = {
  returnDetailedScanResult: true as const,
  highlightScanRegion: true,
  highlightCodeOutline: true,
  preferredCamera: 'environment',
}

export default QrScanner
