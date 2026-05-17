# SKALD — Brief de render 3D para Blender

Renders necesarios para la landing one-page tipo Oryzo. El protagonista visual es el wordmark **SKALD** en vidrio translúcido negro, en una secuencia turntable scrubeada por scroll.

---

## 1. Subject

- Texto: **"SKALD"** en mayúsculas
- Tipografía: **Space Grotesk Bold** (geometric grotesque). Alternativas válidas: GT America Mono Bold, Inter Display Bold, PP Neue Montreal Bold.
- Extrusión: profundidad ≈ 30–35% del alto del carácter
- Bevel: 2–3% del alto, 4–6 segmentos
- Topología limpia, sin n-gons en las curvas

## 2. Material — vidrio translúcido negro

Blender 4.x + Cycles GPU. **Eevee no vale** para vidrio negro — queda plano.

### Estructura: superficie + volumen

Un solo material con **dos shaders** conectados al Material Output:

- **Principled BSDF → Surface**
- **Volume Absorption → Volume**

El "vidrio negro" auténtico viene del volumen interior, no del color de la superficie. Sin volumen, sale cristal transparente claro.

### Principled BSDF (Blender 4.x naming)

| Parámetro | Valor | Por qué |
|---|---|---|
| Base Color | `#05050A` | Casi negro con tinte azul muy sutil. **No uses `#000000`** — queda muerto. |
| Metallic | 0.0 | No es metal |
| Roughness | 0.05 | Pulido. Sube a 0.15 para frosted. |
| IOR | 1.52 | Vidrio óptico estándar |
| Alpha | 1.0 | La transparencia la da Transmission |
| Transmission Weight | **1.0** | Convierte el material en vidrio |
| Coat Weight | 1.0 | Capa extra de barniz → highlight secundario nítido |
| Coat Roughness | 0.02 | |
| Coat IOR | 1.5 | |
| Sheen / Emission | 0.0 | No |
| Subsurface | 0.0 | No |

### Volume Absorption

| Parámetro | Valor |
|---|---|
| Color | `#000000` (negro absoluto) |
| Density | **10.0** (ajustar — ver nota abajo) |

> ⚠️ **Density depende de la escala del objeto.** Es densidad por unidad de distancia. Si el SKALD mide 1m de ancho, density 10 funciona. Si mide 10m, density 1. Si mide 10cm, density 100.
>
> **Cómo calibrar:** renderiza 1 frame de prueba. Las caras planas frontales deben verse casi negras; los bordes y bevel deben mostrar transición a translúcido (gris carbón) donde el rayo atraviesa menos vidrio. Si todo está negro plano → density demasiado alta. Si todo se ve gris translúcido → density demasiado baja.

### Light paths (Render Properties → Light Paths)

Esto es **crítico** para vidrio:

- Total bounces: 12 (default)
- **Transmission bounces: 16** (subir desde el default 12, si no el interior queda negro plano)
- Transparent bounces: 12
- Volume bounces: 4

### Film y output

- Film → **Transparent: ON** (para alpha)
- Output → **PNG, RGBA, 16-bit** (8-bit produce banding en gradientes del vidrio)
- Alternativa: OpenEXR Multilayer si te da igual el peso

### Cómo verificar el material antes de tirar la animación entera

Render de **1 frame** a 256 samples. Tres cosas que deben verse:

1. **Highlight especular nítido** del key light en la cara frontal
2. **Bevel con gradiente** oscuro → translúcido → oscuro (si está plano, calibra density)
3. **Rim cálido** envolviendo el borde trasero (si no se ve, sube intensidad del rim o pónlo más oblicuo)

Si las tres están, ya puedes tirar las 180 frames.

### Variantes opcionales (si quieres opciones para elegir look)

Renderiza UN frame de cada con la misma cámara y luces:

| Variante | Roughness | Volume Density | IOR |
|---|---|---|---|
| A — Cristal limpio (default) | 0.05 | 10 | 1.52 |
| B — Frosted / esmerilado | 0.15 | 8 | 1.52 |
| C — Obsidiana | 0.02 | 18 | 1.70 |
| D — Resina / "Apple plastic" | 0.08 | 6 | 1.45 |

Pasámelos y elegimos la variante final juntos.

## 3. Iluminación

HDRI base: estudio neutro (`studio_small_09` o similar de PolyHaven), intensidad 0.3.

Lights principales:
- **Key:** area light rectangular, arriba-derecha, 5500K, ~200W equivalente
- **Rim cálido:** area light detrás-izquierda, ámbar `#D9A373` (~2900K), intensidad alta — este define el "borde caliente"
- **Fill:** subtle, opcional, frontal-inferior

Suelo: discreto. Plano oscuro con contact shadow, sin reflejo dominante.

## 4. Cámara

- Focal: **35mm**, f/2.8–4 (DoF ligera)
- El wordmark ocupa ~60% del ancho de frame
- Altura: 2–3° debajo del eje horizontal del texto, mirando arriba

## 5. Render output

- **Resolución:** 1920×1080
- **Color space:** sRGB output (Filmic en view transform OK, pero export sRGB)
- **Samples:** 512–1024, con denoising (Optix/OpenImageDenoise)
- **Background:** **transparente** (alpha)
- **Formato:** PNG-16 con alpha, o WebP lossless con alpha
- **Naming:** `skald_turntable_001.png` ... `skald_turntable_180.png` (zero-padded)

## 6. Animación — turntable

180 frames a 30fps = 6 segundos de loop.

- Rotación Y: 0° → 360° lineal a lo largo de los 180 frames
- Rotación X: oscila ±3° (sin/cos, 1 ciclo completo en los 180 frames)
- Posición fija
- Luces fijas (la rotación es del objeto, no de las luces — así el rim viaja por las caras)

## 7. Auxiliares (opcional, alto impacto)

### 7a. Hero beauty still
- Un único frame, 2560×1440, calidad máxima (2048+ samples)
- El "money shot" para el bloque hero

### 7b. Blueprint pass
- Mismo modelo, **Freestyle** activado
- Líneas finas (peso 0.6), color `#D9A373`
- Fondo negro liso `#08080A`
- Sin material vidrio — solo aristas + curvas de construcción + grid
- Un único frame en vista 3/4 ligeramente isométrica, 1920×1080

### 7c. Detail close-up
- Frame con la cámara muy cerca de la "S" o de la "K", mostrando el grosor del vidrio y la refracción interna
- Para usarlo en transiciones o sección Features

---

## Entrega

Carpeta zip al chat, o link de WeTransfer/Drive si supera 500MB.

PNG con alpha **idealmente**. Si tiene que ser JPG por peso, usar fondo bakeado `#08080A` (negro cálido), pero perdemos flexibilidad para variar el bg por capítulo.
