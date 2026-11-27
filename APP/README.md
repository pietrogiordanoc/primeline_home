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

Solo el Super Admin puede eliminar registros caducados o revocados no permanentes.
La limpieza masiva incluye únicamente accesos caducados, también los revocados cuya
fecha de vencimiento ya pasó; no incluye invitaciones permanentes. Abarca todos los
registros elegibles, independientemente de los filtros de la tabla. El servidor
vuelve a comprobar cada registro y muestra el número realmente eliminado.

La eliminación reemplaza la invitación y el permiso por marcas mínimas de auditoría
sin correo ni datos del cliente. Estas marcas invalidan enlaces y sesiones asociados
y evitan que una activación concurrente recree el permiso; conservan los eventos de
revocación y reinicio de dispositivos. No se modifican cuentas del catálogo web.
