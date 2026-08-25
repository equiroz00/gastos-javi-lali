# Material de diseño

`Rediseno.dc.html` es el documento de Claude Design con las **tres direcciones**
exploradas para la app. Se guarda acá porque la herramienta de lectura remota
corta los archivos en 256 KiB y este pesa ~800 KB: leído por la API llegaba
truncado y faltaban pantallas enteras.

## Cómo está organizado

| Sección | Contenido |
|---|---|
| **1** | Inicio, tres direcciones: `1a` Orden (descartada), `1b` Estado de cuenta, `1c` Panel de trabajo |
| **2** | Resto de pantallas: `2a` sigue a 1b, `2b` sigue a 1c |
| **3** | Agregar gasto: `3a` / `3b` |
| **4** | Estadísticas completa: `4a` / `4b` — **reemplaza** al Stats de la sección 2 |

## Mapeo a las variantes del código

`UI_VARIANTS` en `src/constants.ts`:

- `cuenta` = **Estado de cuenta** → mockups `1b`, `2a`, `3a`, `4a`
- `panel`  = **Panel de trabajo** → mockups `1c`, `2b`, `3b`, `4b`

La dirección `1a` no se implementa.

## Ojo al leerlo

Los mockups traen los colores **hardcodeados en la paleta de Budget Flow**
(`#3D2F73` es el `navy` de ese tema). No copiar los hex: el color sale de `C`,
que depende del tema elegido por cada usuario. De los mockups se toma la
**estructura** — medidas, jerarquía, disposición — no la paleta.
