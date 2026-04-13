# Scripts de Keep-Alive para Supabase

Scripts para mantener activa la base de datos Supabase y evitar que entre en modo de suspensión.

## 📋 Archivos

- `keep-alive-cron.js` - Script principal con opciones de ejecución
- `keep-alive.js` - Versión simple (legacy)
- `setup-cron.sh` - Script de ayuda para configurar cronjob

## 🚀 Uso

### Comandos npm

```bash
# Ping único (para testing)
npm run keep-alive

# Ejecución continua (modo testing)
npm run keep-alive:continuous

# Ejecución continua con intervalo personalizado (ej: 5 minutos)
npm run keep-alive:interval
```

### Ejecución directa

```bash
# Ping único
node scripts/keep-alive-cron.js

# Modo continuo cada 10 minutos (default)
node scripts/keep-alive-cron.js --continuous

# Modo continuo con intervalo personalizado
node scripts/keep-alive-cron.js --continuous --interval=5
```

## ⚙️ Configuración de Cronjob

Para configurar un cronjob automático que se ejecute cada 10 minutos:

### Método 1: Usar script de setup
```bash
chmod +x scripts/setup-cron.sh
./scripts/setup-cron.sh
```

### Método 2: Configurar manualmente
1. Abrir el crontab:
   ```bash
   crontab -e
   ```

2. Agregar la línea:
   ```bash
   */10 * * * * cd /ruta/completa/a/manso-gestion && node scripts/keep-alive-cron.js >> /ruta/completa/a/manso-gestion/keep-alive.log 2>&1
   ```

3. Reemplazar `/ruta/completa/a/manso-gestion` con la ruta absoluta de tu proyecto.

## 📊 Monitoreo

### Ver logs
```bash
# Ver últimos logs
tail -f keep-alive.log

# Ver logs con timestamps
grep -E "(🔄|✅|❌)" keep-alive.log
```

### Verificar funcionamiento
```bash
# Verificar que el cronjob está configurado
crontab -l | grep keep-alive

# Verificar última ejecución
tail -n 20 keep-alive.log
```

## 🔧 Variables de entorno

El script requiere las mismas variables de entorno que la aplicación:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

Estas variables deben estar en el archivo `.env` en la raíz del proyecto.

## ⚠️ Consideraciones

1. **Frecuencia recomendada**: Cada 10 minutos es suficiente para mantener activa la base de datos Supabase.

2. **Logs**: Los logs se guardan en `keep-alive.log` en la raíz del proyecto.

3. **Seguridad**: El script usa la clave anónima de Supabase, que es segura para operaciones de solo lectura.

4. **Consumo de recursos**: El script es muy ligero y solo realiza una consulta simple cada vez.

5. **Fallos**: Si el script falla, se registrará en el log con el prefijo `❌`.

## 🐛 Solución de problemas

### Error: "Variables de entorno faltantes"
Verifica que el archivo `.env` existe y contiene las variables correctas.

### Error: "Cannot find module"
Ejecuta `pnpm install` para instalar las dependencias necesarias.

### Cronjob no se ejecuta
- Verifica permisos: `chmod +x scripts/keep-alive-cron.js`
- Verifica ruta absoluta en el crontab
- Revisa logs del sistema: `grep CRON /var/log/syslog`

### Base de datos sigue durmiéndose
- Verifica que el cronjob esté ejecutándose correctamente
- Aumenta la frecuencia a 5 minutos: `--interval=5`
- Verifica conectividad a internet