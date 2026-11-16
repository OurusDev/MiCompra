# Mi Compra Web (PWA)

## Publicarla desde Windows

No hace falta Xcode ni compilar una app. Safari necesita que la página tenga una dirección HTTPS para que la cámara y el modo sin conexión funcionen.

Una forma sencilla es GitHub Pages:

1. Creá un repositorio vacío en GitHub.
2. Subí **el contenido de esta carpeta `web/`** a la raíz del repositorio (no la carpeta `web` como subcarpeta).
3. En el repositorio, abrí **Settings → Pages** y elegí desplegar desde la rama `main`, carpeta `/ (root)`.
4. Cuando GitHub Pages muestre la dirección HTTPS, abrila en Safari en el iPhone.
5. Tocá **Compartir → Añadir a pantalla de inicio** y abrí Mi Compra desde el nuevo ícono.
6. La primera vez que escanees, mantené conexión a Internet mientras se descarga el OCR y el modelo de español. Cuando termine, probá abrir la app en modo avión.

También sirve cualquier alojamiento de archivos estáticos con HTTPS. Si el repositorio es público, el código será visible, pero las compras y fotos permanecen en el almacenamiento local del iPhone.

## Qué funciona

- Cámara y galería del iPhone mediante el selector de fotos del navegador.
- OCR de español que corre localmente en el dispositivo con WebAssembly.
- Compra activa, historial, edición, cantidades decimales, precios candidatos y entrada manual.
- Persistencia local en Safari y caché de la aplicación para abrirla sin conexión.

No incluye respaldo en la nube. Si Safari borra los datos del sitio, se pueden perder las compras. El modelo OCR se descarga desde un CDN la primera vez; el contenido de las imágenes no se envía allí.
