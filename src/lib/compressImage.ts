const MAX_PX = 1200
const QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_PX)
          width = MAX_PX
        } else {
          width = Math.round((width / height) * MAX_PX)
          height = MAX_PX
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('compressImage: toBlob falló'))
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        QUALITY,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('compressImage: no se pudo cargar la imagen')) }
    img.src = url
  })
}
