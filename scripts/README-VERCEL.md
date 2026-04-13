# Configuración para Vercel

## 🚨 Importante: Cambios necesarios para Vercel

Vercel maneja los cronjobs de forma diferente a un servidor tradicional. Para que funcione correctamente:

## 📁 Archivos necesarios:

1. **`vercel.json`** - Configuración del proyecto y cronjobs
2. **`src/api/keep-alive.ts`** - Función de Vercel (Edge Function)
3. **Variables de entorno en Vercel Dashboard**

## ⚙️ Configuración paso a paso:

### 1. Configurar variables de entorno en Vercel:
En el dashboard de Vercel (Settings → Environment Variables):
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

### 2. Desplegar el proyecto:
```bash
vercel deploy --prod
```

### 3. Verificar cronjob:
- Ir a Vercel Dashboard → Deployments → Cron Jobs
- Verificar que el cronjob está activo
- Ver logs en Functions → /api/keep-alive

## 🔄 Modos de ejecución:

### Para desarrollo local (scripts originales):
```bash
pnpm run keep-alive
```

### Para Vercel (producción):
- El cronjob se ejecuta automáticamente cada 10 minutos
- Usa la Edge Function en `/api/keep-alive`

## 📊 Monitoreo en Vercel:

1. **Logs de Functions**: Vercel Dashboard → Functions → /api/keep-alive
2. **Cron Jobs**: Vercel Dashboard → Deployments → Cron Jobs
3. **Health checks**: Puedes hacer GET a `https://tu-app.vercel.app/api/keep-alive`

## ⚠️ Consideraciones Vercel:

1. **Cronjobs solo en producción**: No se ejecutan en preview deployments
2. **Timezone UTC**: Los cronjobs usan UTC por defecto
3. **Edge Functions**: Se ejecutan en el edge network de Vercel
4. **Variables de entorno**: Deben configurarse en el dashboard de Vercel

## 🐛 Solución de problemas Vercel:

### Cronjob no se ejecuta:
- Verificar que `vercel.json` tiene la configuración correcta
- Verificar variables de entorno en Vercel Dashboard
- Verificar que el deployment es de producción (no preview)

### Error 500 en función:
- Verificar logs en Vercel Dashboard → Functions
- Verificar que las variables de entorno están configuradas

### Timeout:
- Edge Functions tienen timeout de 30 segundos (suficiente para nuestro ping)

## 🔧 Mantenimiento dual:

El proyecto mantiene ambos sistemas:
- **Local**: Scripts Node.js para desarrollo/testing
- **Vercel**: Edge Function + cronjob para producción

Esto permite desarrollo local sin depender de Vercel, pero usa la infraestructura de Vercel en producción.