# Prime Line — Home Redesign

Sitio estatico (HTML/CSS/JS, sin build) para el nuevo home de Prime Line.

## Como verlo

Abre `index.html` en el navegador (o sirvelo con Live Server / GitHub Pages). `index.html` redirige directamente a `home.html`, el modelo definitivo.

## Filosofia de diseno

La direccion pidio **no mostrar productos especificos** (packaging, SKUs, precios) en el sitio publico. En su lugar, cada categoria se representa con una imagen atmosferica/organica (aceite sirviendose, mozzarella recien estirada, tomates en la mata, etc.) que comunica calidad y origen sin ensenar el catalogo real.

Paleta y tipografia tomadas del logo actual (azul marino + dorado), con serif editorial (Cormorant Garamond) para titulares y sans (Inter) para texto de soporte.

## Estructura

```
index.html                    -> entrada del sitio; redirige a home.html
home.html                     -> modelo de home definitivo
category-vegetables.html      -> landing de categoria (Preserved Vegetables & Antipasti)
assets/
  css/base.css                 -> variables, tipografia, utilidades compartidas
  css/home.css                 -> estilos del home
  css/category-vegetables.css   -> estilos de la landing de categoria
  js/main.js                    -> header solido on-scroll, reveal on-scroll, nav movil, slider
```

