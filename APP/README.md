| Nombre | Significado |
|---|---|
| Home | Página principal completa |
| Slider | Componente que cambia imágenes |
| Slide | Una imagen/categoría dentro del slider |
| Categoría | Identificador de contenido, como `baking_and_pastry` |
| Template | Estructura editorial de una categoría |
| Category detail | Zona dinámica debajo del slider |
| Banner | Imagen visual del slide |
| Caption | Texto corto asociado al banner |
| Sección | Bloque dentro de un template |
| Asset | Imagen, icono, fuente u otro recurso |
| CSS de categoría | Estilos específicos de un template |

### Limpieza de acceso al catálogo PDF

Solo el Super Admin puede eliminar individualmente cualquier invitación, incluso
activa, pendiente o permanente. La eliminación invalida inmediatamente las sesiones
y enlaces de Prime Line Home e impide emitir nuevas transferencias para esa invitación.
La limpieza masiva incluye únicamente accesos caducados, también los revocados cuya
fecha de vencimiento ya pasó; no incluye invitaciones permanentes. Abarca todos los
registros elegibles, independientemente de los filtros de la tabla. El servidor
vuelve a comprobar cada registro y muestra el número realmente eliminado.

La eliminación reemplaza la invitación y el permiso por marcas mínimas de auditoría
sin correo ni datos del cliente. Estas marcas invalidan enlaces y sesiones asociados
y evitan que una activación concurrente recree el permiso; conservan los eventos de
revocación y reinicio de dispositivos. No se modifican cuentas del catálogo web.
Los PDF descargados y las URL públicas de Issuu no pueden retirarse; los tokens
de transferencia ya emitidos pueden seguir siendo válidos hasta su vencimiento.

Las acciones de acceso al catálogo usan un diálogo de confirmación de Admin.
El administrador puede cancelar o pulsar Escape antes de confirmar; el diálogo
muestra el cliente y la acción, o el número de registros para la limpieza masiva.

### Recuperación de acceso al catálogo PDF

La cookie del dispositivo no identifica por sí sola una invitación. Si una sesión
falta o caduca, el cliente debe abrir su enlace original o solicitar una verificación
por correo. Cuando hay varios permisos activos, el correo ofrece un enlace separado
para cada invitación, con su referencia, vendedor y vencimiento, para que el cliente elija.
El regreso desde Web Catalog también requiere una sesión PDF válida; de lo contrario,
el cliente debe abrir su invitación o verificar su correo primero.
