#!/bin/bash

echo "🔧 Configurando cronjob para mantener activa la base de datos Supabase"
echo "================================================================"

# Obtener ruta absoluta del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$PROJECT_DIR/scripts/keep-alive-cron.js"
NODE_PATH="$(which node)"

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "❌ Error: No se encontró el script en $SCRIPT_PATH"
  exit 1
fi

if [ -z "$NODE_PATH" ]; then
  echo "❌ Error: Node.js no está instalado o no está en el PATH"
  exit 1
fi

echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo "📜 Script: $SCRIPT_PATH"
echo "⚙️  Node.js: $NODE_PATH"

# Crear entrada de cronjob (cada 10 minutos)
CRON_JOB="*/10 * * * * cd $PROJECT_DIR && $NODE_PATH $SCRIPT_PATH >> $PROJECT_DIR/keep-alive.log 2>&1"

echo ""
echo "📋 Cronjob propuesto:"
echo "$CRON_JOB"
echo ""
echo "📝 Para agregar manualmente al crontab:"
echo "1. Ejecutar: crontab -e"
echo "2. Agregar la línea:"
echo "   $CRON_JOB"
echo "3. Guardar y salir"
echo ""
echo "🚀 Para probar el script manualmente:"
echo "   cd $PROJECT_DIR && npm run keep-alive"
echo ""
echo "🔄 Para ejecutar en modo continuo (testing):"
echo "   cd $PROJECT_DIR && npm run keep-alive:continuous"
echo ""
echo "📊 Para ver logs:"
echo "   tail -f $PROJECT_DIR/keep-alive.log"