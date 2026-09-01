# Prime Line — Home Redesign (Concept Gallery)

Sitio estatico (HTML/CSS/JS, sin build) para revisar direcciones esteticas del nuevo home de Prime Line antes de implementarlo en produccion.

## Como verlo

Abre `index.html` en el navegador (o sirvelo con Live Server / GitHub Pages). Desde ahi el menu de conceptos lleva a cada propuesta de home.

- `index.html` — galeria interna de conceptos.
- `home-v1.html` — **Concepto 01 "Editorial / Mozzarella"**: hero a pantalla completa, mosaico de categorias con fotografia de "beauty shot" organica (no producto), seccion de procedencia, historia de productor, CTA mayorista y footer corporativo.

## Filosofia de diseno

La direccion pidio **no mostrar productos especificos** (packaging, SKUs, precios) en el sitio publico. En su lugar, cada categoria se representa con una imagen atmosferica/organica (aceite sirviendose, mozzarella recien estirada, tomates en la mata, etc.) que comunica calidad y origen sin ensenar el catalogo real.

Paleta y tipografia tomadas del logo actual (azul marino + dorado), con serif editorial (Cormorant Garamond) para titulares y sans (Inter) para texto de soporte.

## Imagenes

Todas las imagenes en `assets/img/*.svg` son **placeholders generados** (gradientes/texturas) que solo comunican la paleta y composicion de cada "beauty shot". Deben reemplazarse por fotografia profesional real antes de pasar a produccion.

## Estructura

```
index.html
home-v1.html
assets/
  css/base.css       -> variables, tipografia, utilidades compartidas
  css/home-v1.css     -> estilos del concepto 01
  css/index.css       -> estilos de la galeria
  js/main.js          -> header solido on-scroll, reveal on-scroll, nav movil
  img/*.svg           -> placeholders de fotografia
```

## Proximos conceptos

`home-v2.html` (Provenance Map) y `home-v3.html` (Atelier) se agregaran como nuevas propuestas dentro de la misma galeria en `index.html`.
