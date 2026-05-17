# PROMPT — "AI launch parody landing" (estilo Oryzo)

## ROL
Eres un **director de arte + diseñador de motion web senior** trabajando en un estudio tipo Lusion / Active Theory / Resn. Especialidad: landings cinemagraphic con scroll-pinning, 3D fotoreal embebido y storytelling vertical.

## OBJETIVO
Diseñar una **landing one-page satírica** que presente `[PRODUCTO_MUNDANO]` como si fuera un **modelo de IA de frontera**. Tono: deadpan, técnico, ligeramente pretencioso, con guiños constantes a la cultura AI (asteriscos legales, fórmulas, versionado de modelo, "powered by AI").

Variables a rellenar:
- `[PRODUCTO_MUNDANO]` — ej. "una libreta de papel", "un imán de nevera"
- `[MODELO_ID]` — ej. "NOTA-1", "MAGNET-XL"
- `[STUDIO]` — autoría declarada en hero
- `[CLAIM_HERO]` — pareado corto, p.ej. "Made for mugs. Built for tables."

## DIRECCIÓN DE ARTE

### Paleta (oklch, chroma baja salvo acentos)
- Fondo base: `#0F0B07` (casi negro cálido)
- Fondo escena 1: `#2A1F12` (madera/sepia)
- Tinta principal: `#F0E6D2` (cream / bone)
- Acento cork: `#D77A2E` (naranja tostado, CTAs y handles)
- Acento drama: `#E8438C` magenta + `#5B1FE0` púrpura (sólo "powered by AI")
- Acento thermal: gradiente `#0E0033 → #D02060 → #FFB300` (sólo sección thermal)
- **Regla**: un acento dominante por sección. Nunca dos glows competing.

### Tipografía
- Display: grotesca neutra (GT America / Söhne / Inter Tight), 700, tracking -0.02em, `text-wrap: balance`. Hasta 18vw en hero.
- Body: misma familia 400, 16–18px, lh 1.45
- Etiquetas: ALL CAPS 12px, tracking +0.08em
- "Fórmulas" en serif KaTeX abajo-derecha (parody de papers)

### Anotación técnica (sello visual)
- Bounding boxes punteados con vértices naranjas (Illustrator/Figma handles)
- Reglas con numeración (1, 2, 3… 280) en los bordes de la escena
- Líneas guía dashed cruzando viewport, opacidad 30%
- Punto orbitando el sujeto en idle
- Footnote `* ADOBE ILLUSTRATOR` en esquina inferior derecha — running gag

## ESTRUCTURA (scroll-driven, una escena por capítulo)

Cada capítulo es un **section pinned** con `scrub: true`. La escena central (canvas 3D o video) persiste y se transforma; el texto en márgenes cambia.

```
┌─────────────────────────────────────────────────┐
│  ORYZO          INTRO  FEATURES  PRODUCT  ...   │ nav fija
├──────┬──────────────────────────┬───────┬───────┤
│      │                          │       │       │
│ left │    centro: escena 3D     │ right │ ribbon│
│ meta │    (persistente,         │ desc  │ vert  │
│ /etiq│     se transforma)       │       │       │
│      │                          │       │       │
└──────┴──────────────────────────┴───────┴───────┘
                  ↓ SCROLL TO CONTINUE
```

### Capítulos

1. **HERO** — `MADE FOR [X]. BUILT FOR [Y].` + logotipo display gigante (18vw). Escena: producto sobre cutting mat con útiles. Tarjeta glassmorph izq: "DESIGNED BY [STUDIO]". Vertical ribbon der: "[MODELO_ID] MODEL". Floating circular video bottom-right "PLAY".

2. **"ISN'T JUST A [X]"** — fondo negro cálido. Producto vuela al centro y rota 3D con rim-light. "It's the result of unprecedented AI* breakthroughs." Footnote: `* ADOBE ILLUSTRATOR`.

3. **"POWERED BY AI"** — headline gigante. Rim-light magenta+púrpura desde bordes. Mano sosteniendo el producto. Microcopy izq: `TRY TO HOVER HAND` (la mano gesticula al hover). Der: "AI fills in the gaps. We said high five. It heard six."

4. **"SO PORTABLE, IT'S WEARABLE"** — display que se ilumina como neón mientras el producto orbita detrás del texto. Galería horizontal lifestyle (en pelo, bolsillo, boca, mejilla, bikini — surrealismo deadpan). Tarjeta UI wearable flotante: `3 cups`, `112 bpm`.

5. **"WE ARE SO COOKED"** — portada de revista falsa estilo TIME/RISE, producto como taza de café. Issue No., barcode, "ORYZO is taking everyone's jobs… and replacing them with AI!".

6. **PRODUCT / FEATURES** — split screen:
   - Izq: texto + icono lineal + título display abajo
   - Der: escena 3D del feature
   - **F1 Rise above mediocrity**: producto eleva la taza. Fórmula: `Δh ≈ t` ("Constant lift via geometry").
   - **F2 Thermodynamic stability**: vista termográfica (violet→orange). Sidebar `CREATIVE T=10 / BALANCED T=1 / DETERMINISTIC T=0.1`. Fórmula: `p_i(T) = e^(z_i/T) / Σ e^(z_j/T)` — "THERMAL DIFFUSION MODEL (TDM) — A visualization, not a warranty".
   - **F3 Perfectly round, seriously**: blueprint. Wireframe + bounding box + handles. Bocetos Da Vinci flotando. Fórmula: `C = 4πA / P²` ("RoPE: Roundness Optimization & Perimeter Engineering"). Headline: "NOW 37.9% MORE CIRCULAR".

7. **CONTACT / FOOTER** — pequeño, izquierda. Mismo tono.

## REGLAS DE COPY

- Cada subtitular incluye una **referencia técnica AI deformada**: RoPE, softmax, thermal diffusion, open-weight, "model card", "we recalibrated".
- Cada sección termina con **una métrica absurda y precisa**: "37.9% more circular", "Δh ≈ t", "112 bpm".
- Asteriscos revelan algo trivial: `AI* — *Adobe Illustrator`.
- Tono: ingeniero serio que no se da cuenta del chiste.
- Voz: 3ª persona, presente, frases cortas.

## INTERACCIÓN Y MOTION

- **Scroll-pinning** con `gsap ScrollTrigger` o `Lenis + IntersectionObserver`. Cada sección pin-fija `1.5x viewport`, texto interpola, escena 3D avanza una timeline.
- **Cursor**: spotlight radial 400px que ilumina la escena. Cursor custom (punto cream 4px).
- **Hand hover**: mano del capítulo 3 se anima al pasar cerca (parallax + finger curl).
- **Text reveal**: blur-in + translate-y, 80ms stagger por palabra. Easing `cubic-bezier(.2,.7,.2,1)`.
- **Galería wearable**: scroll horizontal anidado dentro del pin vertical. `transform: scale()` según distancia al centro.
- **Neon text**: `text-shadow` capas múltiples + `filter: brightness()` en el momento del pin.
- **Thermal flip**: transición con `mix-blend-mode: screen` sobre la misma escena base.

## REGLAS DURAS

- Mínimo 24px en cualquier texto; headlines display ≥ 8vw.
- **Cero gradientes basura** — sólo los 3 acentos enumerados.
- **Cero emojis**, cero íconos genéricos. Si necesitas iconografía, dibújala como **anotación técnica**.
- Imagen no disponible → **placeholder con borde dashed + label monoespaciada** describiendo el shot.
- Sin "card con borde-izquierdo de color".
- Footer mínimo, sin redes sociales gigantes.

## ENTREGABLE

Un único `index.html` autocontenido (Tailwind CDN OK), escena 3D opcional con Three.js o `<video autoplay muted loop>` como sustituto, todas las secciones implementadas como capítulos pinned con scroll. Variables CSS para los 3 modos cromáticos (`--mode-warm`, `--mode-dark`, `--mode-thermal`).
