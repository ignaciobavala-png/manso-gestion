/**
 * Import dinámico que sobrevive a un deploy.
 *
 * Los chunks de Vite llevan hash en el nombre. Si alguien tiene el panel
 * abierto y en el medio se publica una versión nueva, el chunk que su
 * pestaña pide ya no existe (y el rewrite de vercel.json le devuelve el
 * index.html en su lugar). La salida es recargar para tomar la versión
 * nueva — una sola vez, con una marca en sessionStorage, para que un
 * error que no sea de deploy no deje la página en loop.
 */
const MARCA = 'manso_recarga_por_chunk'

export async function importarConRecarga<T>(importar: () => Promise<T>): Promise<T> {
  try {
    const modulo = await importar()
    sessionStorage.removeItem(MARCA)
    return modulo
  } catch (error) {
    if (!sessionStorage.getItem(MARCA)) {
      sessionStorage.setItem(MARCA, '1')
      window.location.reload()
      // La recarga ya está en camino: no resolver evita que la pantalla
      // muestre un error en el medio.
      return new Promise<T>(() => {})
    }
    throw error
  }
}
