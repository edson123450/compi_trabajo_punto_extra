# Parser Lab — The Ultimate Parser App

> Explorador interactivo de los 6 algoritmos clásicos de análisis sintáctico, con visualizaciones avanzadas, asistente con IA y árboles de derivación / AST en tiempo real.

**Trabajo final del curso CS3402 Compiladores · UTEC · ciclo 2026-1**

---

## Demo en vivo

🌐 **https://compi-trabajo-punto-extra.vercel.app**

> Si la URL específica de tu deployment es diferente, reemplázala en este README.

---

## Motivación

El análisis sintáctico es uno de los conceptos más densos del curso: los estudiantes deben dominar **seis algoritmos** distintos (LL(1), Descenso Recursivo, LR(0), SLR(1), LR(1), LALR(1)), entender cuándo cada uno aplica, construir tablas a mano, simular pilas y autómatas, y reconocer conflictos.

Parser Lab nació para resolver esa fricción pedagógica. La app permite escribir cualquier gramática libre de contexto y ver, en tiempo real:

- Las tablas `FIRST` / `FOLLOW` y la tabla de predicción LL(1)
- Las tablas `ACTION` / `GOTO` de cada parser LR
- El autómata canónico LR como grafo interactivo (con el estado actual resaltado)
- La simulación paso a paso con la pila visual
- El árbol de derivación completo y su AST simplificado
- Por qué una gramática **NO** funciona con un parser dado, y cómo arreglarlo

La idea: que cualquier estudiante pueda construir su intuición a punta de experimentar, no de memorizar.

---

## ✨ Features

### 🔧 Parsers implementados (los 6 del syllabus)

| Familia | Parser | ¿Qué resuelve? |
|---|---|---|
| **Top-Down** | LL(1) | Construcción de tabla de predicción + simulación con pila |
| **Top-Down** | Descenso Recursivo | Implementación dirigida por la tabla LL(1), con traza de llamadas |
| **Bottom-Up** | LR(0) | Autómata canónico de items, ACTION/GOTO básico |
| **Bottom-Up** | SLR(1) | LR(0) + reducciones por FOLLOW |
| **Bottom-Up** | LR(1) | Items con lookahead por contexto, máxima precisión |
| **Bottom-Up** | LALR(1) | Fusión de estados LR(1) por core (el usado por Bison/Yacc) |

Cada parser muestra:
- Construcción de tablas (con detección de conflictos)
- Validación de cadenas de entrada
- Simulación paso a paso con la pila visual

### 🎨 Visualizaciones avanzadas

- **Autómatas LR** renderizados con Graphviz (WASM in-browser, sin servidor), con el estado activo resaltado dinámicamente durante la simulación
- **Árbol de derivación** interactivo (react-d3-tree): zoom, pan, click para colapsar/expandir nodos, modo pantalla completa
- **Árbol de Sintaxis Abstracta (AST)**: el mismo viewer con toggle Parse Tree ⇄ AST. El AST aplica simplificación universal (elimina ε, colapsa unarios, detecta operadores binarios) — para gramáticas aritméticas LR produce exactamente el árbol binario semántico canónico
- **Pila visual animada** con efectos push/pop
- **Tablas ACTION/GOTO** dinámicas con colores por tipo de acción (shift azul, reduce ámbar, accept esmeralda)

### 🤖 IA integrada (uso real, no heurísticas)

La app cumple las dos features de IA que el syllabus pide explícitamente:

1. **Explicación de errores sintácticos en lenguaje natural** — Cuando un parser falla, además del análisis heurístico instantáneo (regex sobre el mensaje técnico), un botón **"Pedir explicación detallada a la IA"** dispara una llamada a **GPT-4o-mini** que recibe la gramática completa, los tokens y el error específico del usuario y devuelve una explicación contextual en español

2. **Recomendaciones para corregir gramáticas ambiguas** — Detecta automáticamente:
   - Recursión izquierda directa
   - Prefijos comunes (que requieren factorización izquierda)
   - Conflictos reportados por la tabla
   - Y un botón **"Pedir transformación a la IA"** que devuelve la **gramática reescrita lista para copiar**, con explicación de la técnica aplicada

Las llamadas a la IA son opt-in (el usuario debe hacer click): el asistente heurístico local funciona offline e instantáneamente como fallback.

### 🛠️ Otras innovaciones

- **Grammar Zoo** — Selector visual con 8 gramáticas clásicas pre-cargadas (aritmética LL, aritmética LR, paréntesis balanceados, if-else colgante ambigua, prefijos comunes, gramática LR(1) que no es SLR(1), listas con coma, statement-list). Cada una indica con qué parsers es compatible y cuáles fallarán a propósito (didáctico).
- **Teclado virtual** con los símbolos formales (ε, →, |, ', $) — diferente set para gramática y para tokens
- **Análisis comparativo entre parsers** — Muestra fortalezas / debilidades de cada uno y sugiere el "upgrade path" cuando hay conflictos (LL → SLR → LALR → LR(1))
- **Historial** con persistencia en localStorage (8 entradas recientes)
- **Exportación PDF** profesional con jsPDF y autoTable: incluye gramática, tokens, resultado, tablas y traza de simulación
- **Exportación TXT** con el reporte completo
- **PWA instalable** — Manifest + iconos SVG, se instala con un click desde Chrome/Edge en escritorio o "Añadir a pantalla de inicio" en móvil
- **Responsive móvil/tablet/desktop** — Sidebar colapsable con drawer animado, tablas con scroll horizontal, layout adaptativo

---

## 🛠️ Stack técnico

| Capa | Tecnología | Rol |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | SSR, routing, build |
| **UI** | Tailwind CSS + lucide-react | Diseño, iconos |
| **Visualización** | `@hpcc-js/wasm` (Graphviz) | Autómatas LR |
| **Visualización** | `react-d3-tree` | Árboles de derivación / AST |
| **PDF** | `jspdf` + `jspdf-autotable` | Exportación de reportes |
| **Backend** | Flask (Python 3.12) | API REST de los 6 parsers |
| **IA** | OpenAI API (GPT-4o-mini) | Explicación de errores + transformaciones de gramática |
| **Despliegue** | Vercel Serverless Functions | Backend Python + Frontend Next.js en un solo proyecto |

### IA durante el desarrollo

Además de la IA integrada en la app (GPT-4o-mini en runtime), el desarrollo se apoyó en **Claude (Anthropic)** para generación de código, depuración, diseño de interfaz y documentación automática.

---

## 📦 Estructura del repositorio

```
.
├── README.md                     ← este archivo
├── app.py                        ← launcher local del backend Flask
├── main.py                       ← demo CLI (corre los 6 parsers en consola)
├── vercel.json                   ← apunta a frontend/ como Root Directory
└── frontend/                     ← Root Directory de Vercel
    ├── package.json
    ├── next.config.js            ← dev rewrite a localhost:5000
    ├── vercel.json               ← Serverless functions + rewrites
    ├── requirements.txt          ← deps Python para Vercel
    │
    ├── api/                      ← Backend Python (Vercel auto-detecta)
    │   ├── index.py              ← Flask app, todos los endpoints REST
    │   ├── grammar.py            ← Parseo de gramáticas + augmentation
    │   ├── first_follow.py       ← FIRST y FOLLOW
    │   ├── ll1_parser.py         ← Tabla LL(1) + simulación
    │   ├── recursive_descent.py  ← Parser RD driven by LL table
    │   ├── lr_core.py            ← Items LR(0)/LR(1), closure, goto, automaton
    │   ├── lr_simulator.py       ← Motor genérico LR (compartido por los 4)
    │   ├── lr0_parser.py         ← Tablas LR(0)
    │   ├── slr1_parser.py        ← Tablas SLR(1)
    │   ├── lr1_parser.py         ← Tablas LR(1) canónico
    │   ├── lalr1_parser.py       ← LALR(1) por fusión de cores
    │   ├── derivation_trees.py   ← Builders parse tree + simplify_to_ast
    │   ├── ai_assistant.py       ← Cliente OpenAI, prompts en español
    │   └── requirements.txt
    │
    ├── public/
    │   ├── manifest.webmanifest  ← PWA
    │   ├── icon.svg              ← Logo (árbol de derivación)
    │   └── favicon.svg
    │
    └── src/
        ├── app/
        │   ├── layout.tsx        ← Metadata, viewport, manifest
        │   ├── page.tsx          ← Redirect a /ll1
        │   ├── globals.css
        │   └── [parser]/page.tsx ← Routing dinámico por parser
        │
        ├── components/
        │   ├── ParserDashboard.tsx     ← Orquestador principal
        │   ├── Sidebar.tsx             ← Desktop + drawer móvil
        │   ├── GrammarPanel.tsx        ← Editor de gramática + tokens
        │   ├── GrammarZooSelector.tsx  ← Dropdown del Grammar Zoo
        │   ├── VirtualKeyboard.tsx     ← Teclado con ε, →, |, etc.
        │   ├── FirstFollowPanel.tsx
        │   ├── LL1TableView.tsx
        │   ├── ActionGotoTable.tsx
        │   ├── AutomataViewer.tsx      ← Graphviz + modal fullscreen
        │   ├── DerivationTreeViewer.tsx ← react-d3-tree + toggle AST
        │   ├── SimulatorStepper.tsx    ← Paso a paso LL(1)
        │   ├── StackVisualizer.tsx     ← Pila visual animada
        │   ├── DerivationTrace.tsx
        │   ├── RawOutputView.tsx
        │   ├── ErrorAssistant.tsx      ← Heurístico + botón IA
        │   ├── SmartRecommendations.tsx ← Heurístico + botón IA
        │   ├── ComparativePanel.tsx    ← Fortalezas/debilidades/upgrade path
        │   └── HistoryExport.tsx       ← Historial + exportación PDF/TXT
        │
        └── lib/
            ├── api.ts                  ← Cliente HTTP del backend
            ├── types.ts                ← Tipos TypeScript
            ├── parsers.ts              ← Config de los 6 parsers
            ├── grammarZoo.ts           ← 8 gramáticas de ejemplo
            ├── errorAnalysis.ts        ← Heurísticas para clasificar errores
            ├── recommendations.ts      ← Heurísticas para sugerir transformaciones
            ├── history.ts              ← localStorage
            └── lrStepParser.ts         ← Parsing de la traza textual LR
```

---

## 🏃 Cómo correr localmente

### Requisitos
- Python ≥ 3.10
- Node.js ≥ 18
- npm

### Backend (Flask, puerto 5000)

```bash
pip install -r frontend/requirements.txt
python3 app.py
```

### Frontend (Next.js, puerto 3000)

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:3000** — el frontend hace rewrite automático de `/api/*` a `localhost:5000` en modo dev.

### Demo CLI (sin frontend)

Para ejecutar los 6 parsers directamente en consola con las gramáticas de ejemplo:

```bash
python3 main.py
```

### Variables de entorno (para activar la IA)

Crear `.env.local` en el directorio raíz (NO commitear):

```bash
OPENAI_API_KEY=sk-proj-...
```

En producción se configura como Environment Variable en el dashboard de Vercel.

---

## 🚀 Despliegue (Vercel)

El proyecto está configurado para deployar como **un solo proyecto Vercel** que combina:
- **Frontend Next.js** (static + SSR)
- **Backend Python** como Serverless Functions

### Configuración en Vercel

1. Importar el repo en Vercel
2. **Root Directory:** `frontend`
3. **Framework Preset:** Next.js (autodetectado)
4. **Environment Variables:**
   - `OPENAI_API_KEY` = tu key de OpenAI (sin esto, la IA muestra un mensaje claro pero el resto funciona)
5. Deploy

Vercel detecta automáticamente:
- `frontend/api/*.py` como Serverless Functions Python
- `frontend/requirements.txt` para las deps Python
- `frontend/vercel.json` para las rewrites de `/api/*`

---

## 📐 Aspectos pedagógicos destacables

- **Determinismo de la numeración de estados LR**: el código fuerza un orden canónico al construir los autómatas (sorted symbols + FIFO worklist) para que el grafo del autómata sea reproducible entre runs y máquinas
- **Algoritmo LALR(1) correctamente implementado** como fusión de estados LR(1) por core (no la versión "rápida" que confunde a muchos textbooks)
- **Recursive Descent dirigido por tabla**: en vez del approach clásico de una función por no-terminal, usa un interpretador que consulta la tabla LL(1) — esto separa elegantemente la gramática de la lógica del parser
- **AST con simplificación universal**: no requiere acciones semánticas escritas por el usuario; las heurísticas (eliminar ε, colapsar unarios, detectar binario `[A, op, B]`) producen el árbol semántico para cualquier gramática aritmética

---

## 👥 Equipo

| Integrante | Rol |
|---|---|
| **Edson Gustavo Guardamino Felipe** | Desarrollo |
| **Gianpier Segovia André Segovia Ureta** | Desarrollo |

CS3402 Compiladores · Universidad de Ingeniería y Tecnología (UTEC) · 2026-1

---

## 📄 Licencia

Trabajo académico. Código disponible para fines educativos.
