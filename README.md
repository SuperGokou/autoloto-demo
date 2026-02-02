<p align="center">
  <img src="img/logo.png" alt="AutoLOTO" height="64" />
</p>

<h1 align="center">AutoLOTO</h1>

<p align="center">
  <strong>Automatic Lockout/Tagout Circuit Diagram Analyzer</strong><br/>
  Analyze electrical schematics with Vision Language Models and generate interactive LOTO safety procedures.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-5-green" alt="Express" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-cyan" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Ollama-VLM-purple" alt="Ollama" />
</p>

<p align="center">
  <a href="https:
//autoloto-demo.onrender.com"><strong>Live Demo</strong></a>
</p>

---

## Screenshots

### Full Application View
![Full View](img/screenshots/full-view.png)

| Interactive Canvas | LOTO Procedure Panel | Sidebar Upload |
|---|---|---|
| ![Canvas](img/screenshots/canvas.png) | ![LOTO Panel](img/screenshots/loto-panel.png) | ![Upload](img/screenshots/upload.png) |

---

## Features

- **Drag-and-Drop Upload** - Drop circuit schematics (PDF, PNG, JPG) directly into the sidebar
- **VLM Analysis** - Ollama vision models extract components and connections from diagrams
- **Interactive Canvas** - Pan, zoom, animated power flow visualization with node selection
- **LOTO Procedures** - Auto-generated lockout/tagout safety steps per ISO 14118
- **Simulation Modes** - Toggle between Energized (live) and Isolating views
- **Demo Mode** - Built-in demo topology for testing without Ollama
- **Topology Export** - Download extracted circuit data as JSON

## Quick Start

```bash
# Install all dependencies (single command, npm workspaces)
npm install

# Start both frontend and backend
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Live Demo | https://autoloto-demo.onrender.com |

## Prerequisites

- **Node.js** 18+
- **Ollama** running locally with a vision model:
  ```bash
  ollama serve
  ollama pull llava:13b
  ```
- **Poppler** (optional, for PDF upload support)
- **OpenAI API Key** (optional, for cloud deployment without Ollama)

## Deploy to Render

1. Push your repo to GitHub
2. On [Render](https://render.com), create a **New Web Service** and connect your repo
3. Render will auto-detect `render.yaml`. Or configure manually:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start -w backend`
4. Add environment variable `OPENAI_API_KEY` with your OpenAI key
5. Select the **GPT-4o Vision (Cloud)** model in the UI since Render has no GPU for Ollama

The backend serves the frontend static build automatically in production.

## Architecture

```
autoloto-demo/
├── frontend/                # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/      # Sidebar, Canvas, RightPanel + 47 shadcn/ui components
│   │   ├── lib/             # mockData, axios API client
│   │   ├── styles/          # Tailwind v4 globals with CSS variables
│   │   ├── assets/          # Logo and static assets
│   │   └── App.tsx          # Main three-panel layout with API integration
│   ├── public/              # Favicon
│   └── vite.config.ts       # Vite + Tailwind plugin + API proxy
│
├── backend/                 # Express + TypeScript
│   ├── src/
│   │   ├── services/
│   │   │   ├── inference.ts # Ollama VLM communication (chat + generate APIs)
│   │   │   ├── preprocess.ts# Image resizing via sharp
│   │   │   └── loto.ts      # LOTO safety logic (upstream/downstream tracing)
│   │   ├── utils/
│   │   │   └── layout.ts    # BFS topological layering for auto-layout
│   │   ├── types.ts         # Shared TypeScript interfaces
│   │   └── server.ts        # Express routes
│   ├── uploads/             # Temporary file storage
│   └── .env                 # Port and Ollama URL config
│
├── img/                     # Logo and screenshots
├── diagram/                 # Example circuit schematics
├── json/                    # Extracted topology data
└── package.json             # Root: concurrently runs both services
```

## System Design

### High-Level Architecture

```mermaid
graph TB
    subgraph Client["Frontend (React + Vite)"]
        UI[Three-Panel UI]
        SB[Sidebar<br/>File Upload + Model Select]
        CV[Canvas<br/>Interactive SVG Graph]
        RP[Right Panel<br/>LOTO Procedures]
        API_CLIENT[Axios API Client]
    end

    subgraph Server["Backend (Express + TypeScript)"]
        ROUTER[Express Router]
        UPLOAD[Multer<br/>File Upload]
        PREPROCESS[Sharp<br/>Image Resize]
        INFERENCE[Inference Service<br/>Prompt Engineering]
        LOTO[LOTO Service<br/>Safety Logic]
        LAYOUT[Layout Engine<br/>BFS Topological Sort]
    end

    subgraph External["External Services"]
        OLLAMA[Ollama<br/>Vision Language Model]
    end

    subgraph Storage["Storage"]
        UPLOADS_DIR[uploads/]
        JSON_DIR[json/topology.json]
    end

    SB --> API_CLIENT
    CV --> RP
    API_CLIENT -->|HTTP /api/*| ROUTER
    ROUTER --> UPLOAD --> PREPROCESS --> UPLOADS_DIR
    ROUTER --> INFERENCE -->|REST API| OLLAMA
    ROUTER --> LOTO
    ROUTER --> LAYOUT
    INFERENCE --> JSON_DIR
    OLLAMA -->|JSON Topology| INFERENCE
    API_CLIENT -->|Topology Data| CV
    API_CLIENT -->|LOTO Steps| RP

    style Client fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style Server fill:#F0FDF4,stroke:#10B981,stroke-width:2px
    style External fill:#F5F3FF,stroke:#8B5CF6,stroke-width:2px
    style Storage fill:#FFF7ED,stroke:#F59E0B,stroke-width:2px
```

### Data Flow Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant OL as Ollama VLM

    U->>FE: Drop schematic (PDF/PNG)
    FE->>BE: POST /api/upload (multipart)
    BE->>BE: Sharp resize (max 3000px)
    BE-->>FE: { imagePath }

    U->>FE: Click ANALYZE CIRCUIT
    FE->>BE: POST /api/analyze { imagePath, model }
    BE->>BE: Encode image to base64
    BE->>BE: Select model-specific prompt
    BE->>OL: POST /api/chat { model, images, prompt }
    OL-->>BE: Raw VLM response
    BE->>BE: Extract JSON (3 fallback parsers)
    BE-->>FE: { components[], connections[] }

    FE->>FE: Auto-layout (BFS topological sort)
    FE->>FE: Render interactive canvas

    U->>FE: Click circuit node
    FE->>FE: Show component details
    FE->>FE: Trace upstream/downstream
    FE->>FE: Generate LOTO safety steps
```

### Component Architecture

```mermaid
graph LR
    subgraph App["App.tsx (State Management)"]
        direction TB
        CS[CircuitState]
        SN[selectedNode]
        SM[simulationMode]
    end

    subgraph Components
        direction TB
        SIDEBAR["Sidebar.tsx<br/>- File drag & drop<br/>- Model selector<br/>- Demo toggle<br/>- Analyze button"]
        CANVAS["Canvas.tsx<br/>- SVG edge rendering<br/>- Animated power flow<br/>- Pan / Zoom controls<br/>- Node selection"]
        PANEL["RightPanel.tsx<br/>- Component card<br/>- Energized/Isolating toggle<br/>- LOTO step checklist<br/>- JSON/PDF export"]
    end

    subgraph Services["Backend Services"]
        direction TB
        INF["inference.ts<br/>- Model-specific prompts<br/>- Chat + Generate APIs<br/>- JSON extraction<br/>- DeepSeek OCR parser"]
        PRE["preprocess.ts<br/>- Sharp image resize<br/>- PDF detection"]
        LOT["loto.ts<br/>- getConnected()<br/>- getLockoutRequirements()<br/>- Upstream/downstream trace"]
        LAY["layout.ts<br/>- BFS layering<br/>- Root detection<br/>- Position assignment"]
    end

    App --> SIDEBAR
    App --> CANVAS
    App --> PANEL
    SIDEBAR -->|onFileSelect| App
    CANVAS -->|onNodeSelect| App
    PANEL -->|setSimulationMode| App

    style App fill:#FEF3C7,stroke:#D97706,stroke-width:2px
    style Components fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style Services fill:#F0FDF4,stroke:#10B981,stroke-width:2px
```

### LOTO Safety Decision Tree

```mermaid
flowchart TD
    START([Select Component]) --> CHECK_TYPE{Component Type?}

    CHECK_TYPE -->|Capacitor| CAP[DISCHARGE BEFORE CONTACT<br/>Lethal stored charge hazard]
    CHECK_TYPE -->|Transformer| TRANS[ISOLATE BOTH WINDINGS<br/>Can energize from either side]
    CHECK_TYPE -->|Other| TRACE[Trace Connections]

    TRACE --> UP{Upstream Components}
    TRACE --> DOWN{Downstream Components}

    UP -->|Breaker/Switch/Fuse| LOCK[OPEN and LOCK OUT<br/>Primary isolation point]
    UP -->|Capacitor| DISCHARGE_UP[DISCHARGE and VERIFY<br/>Stored energy hazard]
    UP -->|Other| DISCONNECT[DISCONNECT + VERIFY ZERO<br/>Isolate power source]

    DOWN -->|Capacitor| DISCHARGE_DN[DISCHARGE and VERIFY<br/>Downstream stored energy]
    DOWN -->|Motor/Load| VERIFY[VERIFY DE-ENERGIZED<br/>Check alternate sources]

    CAP --> DONE([Generate Step List])
    TRANS --> DONE
    LOCK --> DONE
    DISCHARGE_UP --> DONE
    DISCONNECT --> DONE
    DISCHARGE_DN --> DONE
    VERIFY --> DONE

    style START fill:#3B82F6,color:#fff
    style DONE fill:#10B981,color:#fff
    style CAP fill:#EF4444,color:#fff
    style TRANS fill:#A855F7,color:#fff
    style LOCK fill:#EF4444,color:#fff
```

### How It Works

1. **Upload** a circuit schematic via drag-and-drop or file picker
2. **Analyze** sends the image to Ollama with a model-specific prompt
3. **Parse** extracts structured JSON (components + connections) with 3 fallback parsers
4. **Layout** positions nodes using BFS topological layering
5. **Render** displays the interactive canvas with animated power flow
6. **Select** a node to see component details and auto-generated LOTO steps

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Upload schematic file (multipart/form-data) |
| `POST` | `/api/analyze` | Analyze diagram via Ollama VLM |
| `POST` | `/api/loto` | Generate LOTO steps for a component |
| `POST` | `/api/layout` | Auto-layout topology nodes |

## Supported Models

| Model | Strengths |
|-------|-----------|
| `llava:13b` | Best accuracy for complex schematics |
| `llava:7b` | Good balance of speed and accuracy |
| `llava:latest` | Latest LLaVA release |
| `qwen3-vl:latest` | Optimized for circuit analysis |
| `deepseek-ocr:latest` | Strong text and label extraction |
| `gpt-4o` | Cloud-based, no GPU required (needs API key) |

## LOTO Safety Logic

The system traces upstream and downstream connections to generate safety procedures:

| Component Type | Generated Action |
|----------------|-----------------|
| Breaker / Switch / Disconnect | OPEN and LOCK OUT |
| Capacitor | DISCHARGE BEFORE CONTACT |
| Transformer | ISOLATE BOTH PRIMARY AND SECONDARY |
| Motor / Load | VERIFY DE-ENERGIZED |
| Power Source | DISCONNECT and VERIFY ZERO ENERGY |

## Configuration

Backend settings via `backend/.env`:

```env
PORT=3001
OLLAMA_BASE_URL=http://localhost:11434
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| Backend | Express 5 + TypeScript |
| Image Processing | Sharp |
| VLM Communication | Axios to Ollama REST API |
| Dev Runner | Concurrently |

## Limitations

- Single-page PDF analysis only
- Requires local Ollama instance (no cloud API fallback)
- No validation or correction of extracted topology
- PDF upload requires poppler installed on the system

## Future Development

### Roadmap

```mermaid
timeline
    title AutoLOTO Development Roadmap
    section v2.x (Current)
        Single-page analysis : VLM inference via Ollama
        Interactive canvas : Demo mode with mock data
        Basic LOTO generation : JSON topology export
    section v3.0 (Next)
        Multi-page PDF support : Cloud VLM API (OpenAI, Anthropic)
        Topology validation : User-editable graph
        PDF safety report export : Persistent project storage
    section v4.0 (Future)
        Real-time collaboration : Role-based access control
        Compliance audit trail : Integration with CMMS/EAM systems
        Mobile field verification : Offline mode with sync
    section v5.0 (Vision)
        AR overlay for field work : AI-powered anomaly detection
        Digital twin integration : Predictive maintenance
        Multi-facility management : Regulatory auto-compliance
```

### Planned Features

#### Near-term (v3.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-page PDF | Analyze all pages of a schematic PDF, merge topologies | High |
| Cloud VLM support | Add OpenAI GPT-4o Vision and Anthropic Claude as model options | High |
| Topology editor | Drag nodes, add/remove connections directly on the canvas | High |
| Topology validation | Cross-check extracted components against known patterns, flag anomalies | Medium |
| PDF report export | Generate formatted safety report PDF with LOTO checklist | Medium |
| Project persistence | Save/load projects with database backend (SQLite or PostgreSQL) | Medium |
| Undo/redo | History stack for all topology and LOTO step modifications | Low |

#### Mid-term (v4.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Real-time collaboration | Multiple users editing the same topology via WebSocket | High |
| Authentication & RBAC | User accounts, role-based permissions (viewer, editor, admin) | High |
| Audit trail | Log all LOTO procedure changes with timestamps and user attribution | High |
| CMMS integration | Connect with Maximo, SAP PM, or other maintenance management systems | Medium |
| Mobile app | React Native companion app for field verification with camera capture | Medium |
| Offline mode | Service worker caching, sync when reconnected | Medium |
| Batch analysis | Upload multiple schematics and process them in a queue | Low |

#### Long-term (v5.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| AR field overlay | Camera overlay showing LOTO steps on physical equipment | Exploratory |
| Anomaly detection | ML model to detect wiring errors or missing safety components | Exploratory |
| Digital twin | Live connection to SCADA/PLC for real-time energy state monitoring | Exploratory |
| Predictive maintenance | Use historical data to predict component failures | Exploratory |
| Multi-facility | Manage schematics and LOTO procedures across multiple sites | Exploratory |
| Regulatory compliance | Auto-generate OSHA/NFPA 70E/CSA Z460 compliance documentation | Exploratory |

### Architecture Evolution

```mermaid
graph LR
    subgraph Current["v2.x (Current)"]
        A1[React SPA] --> A2[Express API]
        A2 --> A3[Ollama Local]
    end

    subgraph Next["v3.0 (Next)"]
        B1[React SPA] --> B2[Express API]
        B2 --> B3[Ollama Local]
        B2 --> B4[OpenAI API]
        B2 --> B5[PostgreSQL]
    end

    subgraph Future["v4.0+ (Future)"]
        C1[React SPA] --> C2[API Gateway]
        C6[React Native] --> C2
        C2 --> C3[Inference Service]
        C2 --> C4[LOTO Service]
        C2 --> C5[Auth Service]
        C3 --> C7[Ollama / Cloud VLMs]
        C4 --> C8[PostgreSQL]
        C2 --> C9[WebSocket Server]
        C4 --> C10[CMMS Integration]
    end

    Current --> Next --> Future

    style Current fill:#FEF3C7,stroke:#D97706,stroke-width:2px
    style Next fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style Future fill:#F0FDF4,stroke:#10B981,stroke-width:2px
```

### Contributing

Contributions are welcome. To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes and test (`npm run dev`)
4. Submit a pull request
