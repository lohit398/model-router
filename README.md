# AI Task Routing System POC

An intelligent file processing and AI task routing system that automatically selects the optimal AI model based on cost, latency, and quality requirements.

## Overview

This POC demonstrates smart AI model selection for various tasks (summarization, classification, extraction) by routing requests to different AI models based on SLA requirements and budget constraints.

### Key Features

- **File Upload & Processing**: Accept and store files, extract/transcribe content
- **Intelligent Routing**: Automatically select optimal AI model based on constraints
- **Decision Tracking**: Audit trail of all routing decisions with reasoning
- **Real-time Metrics**: Track cost, latency, and performance for each execution
- **Workflow Automation**: N8n integration for background processing

## Architecture

```
┌─────────────────────────┐
│   React Frontend        │  Port 3000 (Vite Dev)
│   - File Upload UI      │
│   - Routing Decision    │
│     Dashboard           │
└───────────┬─────────────┘
            │
            │ /api proxy
            ▼
┌─────────────────────────┐
│   Express Backend       │  Port 4000
│   - File Upload API     │
│   - Task Routing Logic  │
│   - Model Selection     │
└───────────┬─────────────┘
            │
    ┌───────┴──────┬──────────────┐
    ▼              ▼              ▼
┌─────────┐   ┌────────┐    ┌──────────┐
│Supabase │   │  N8n   │    │  File    │
│Database │   │Workflow│    │ Storage  │
│& Storage│   │ (5678) │    │          │
└─────────┘   └────────┘    └──────────┘
```

## Technology Stack

### Frontend
- React 19.2 with TypeScript
- Vite 7.2 (build tool)
- Modern ES modules

### Backend
- Node.js with Express 5.2
- TypeScript 5.9
- Supabase JS Client
- Multer (file uploads)

### Infrastructure
- Supabase (PostgreSQL + Cloud Storage)
- N8n (Workflow automation via Docker)
- Docker Compose

## Project Structure

```
POC-files/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main application component
│   │   ├── FileUpload.tsx          # File upload interface
│   │   ├── RoutingTable.tsx        # Routing decisions display
│   │   └── main.tsx                # React entry point
│   ├── vite.config.ts              # Vite config with API proxy
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts               # Express app & API endpoints
│   │   ├── router.ts               # Intelligent routing logic
│   │   └── upload.ts               # File upload handler
│   ├── .env                        # Environment variables
│   └── package.json
│
└── infra/
    ├── docker-compose.yml          # N8n service definition
    └── n8n_data/                   # N8n persistent data
```

## Getting Started

### Prerequisites

- Node.js v22+ (for native fetch support)
- Docker & Docker Compose
- Supabase account

### Environment Setup

1. **Backend Configuration**

Create `/backend/.env`:

```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
N8N_FILE_WEBHOOK_URL=http://localhost:5678/webhook/your-webhook-id
```

2. **Supabase Database Setup**

Create the following tables:

```sql
-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type TEXT NOT NULL,
  sla TEXT NOT NULL,
  input_text TEXT,
  max_cost_cents INTEGER,
  transcript_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Routing decisions table
CREATE TABLE routing_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id),
  chosen_model TEXT NOT NULL,
  reason TEXT,
  estimated_cost_cents INTEGER,
  estimated_latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Model runs table
CREATE TABLE model_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id),
  model TEXT NOT NULL,
  token_input INTEGER,
  token_output INTEGER,
  latency_ms INTEGER,
  cost_cents INTEGER,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Uploaded files table
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES uploaded_files(id),
  status TEXT DEFAULT 'processing',
  text_content TEXT,
  language TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

3. **Supabase Storage Setup**

Create a storage bucket named `airr-raw-files` in your Supabase project.

### Installation

1. **Install Backend Dependencies**

```bash
cd backend
npm install
```

2. **Install Frontend Dependencies**

```bash
cd frontend
npm install
```

3. **Start N8n (Infrastructure)**

```bash
cd infra
docker-compose up -d
```

Access N8n at http://localhost:5678

### Running the Application

1. **Start Backend** (in `/backend` directory):

```bash
npm run dev
```

Backend runs on http://localhost:4000

2. **Start Frontend** (in `/frontend` directory):

```bash
npm run dev
```

Frontend runs on http://localhost:3000 (or configured Vite port)

## How It Works

### Intelligent Routing Logic

The system routes tasks to three different AI models based on requirements:

#### Available Models

| Model | Cost per Task | Latency | Best For |
|-------|--------------|---------|----------|
| GPT-4.1 | $0.40 | 1800ms | High quality results |
| GPT-4.1 Mini | $0.10 | 600ms | Fast responses |
| Rules Engine | $0.01 | 100ms | Cost-sensitive tasks |

#### Routing Rules

**SLA-Based Selection:**
- `high_quality` → Prefers GPT-4.1
- `low_latency` → Prefers GPT-4.1 Mini
- `low_cost` → Prefers Rules Engine

**Budget Constraints:**
- If selected model exceeds `maxCostCents`, falls back to cheaper alternative
- Fallback chain: GPT-4 → GPT-4 Mini → Rules Engine

### Data Flow

#### 1. File Upload Flow

```
User uploads file
    ↓
Frontend POST /api/upload
    ↓
Backend receives file via Multer
    ↓
Store in Supabase Storage (bucket: airr-raw-files)
    ↓
Create records in uploaded_files & transcripts tables
    ↓
Trigger N8n webhook notification
    ↓
Return fileId & transcriptId to frontend
```

#### 2. Task Processing Flow

```
Client sends task request
    ↓
Create task record in database
    ↓
Routing logic evaluates:
  - Task type (summary/classification/extraction)
  - SLA requirement (quality/latency/cost)
  - Budget constraint (maxCostCents)
    ↓
Select optimal model
    ↓
Log routing decision with reasoning
    ↓
Simulate model execution
    ↓
Log actual metrics (tokens, latency, cost)
    ↓
Update task status to 'completed'
    ↓
Return decision details to client
```

## API Endpoints

### File Upload
```
POST /api/upload
Content-Type: multipart/form-data

Body: { file: <file> }

Response: {
  file: { id, file_name, storage_path, ... },
  transcript: { id, file_id, status, ... }
}
```

### Create Task
```
POST /api/tasks
Content-Type: application/json

Body: {
  taskType: 'summary' | 'classification' | 'extraction',
  sla: 'low_latency' | 'low_cost' | 'high_quality',
  inputText: string,
  maxCostCents: number,
  transcriptId?: uuid
}

Response: {
  task: { id, task_type, status, ... },
  decision: { chosen_model, reason, estimated_cost_cents, ... },
  routing: { model, reason, estimatedCostCents, estimatedLatencyMs }
}
```

### Get Routing Decisions
```
GET /api/routing-decisions

Response: [
  {
    id: uuid,
    chosen_model: string,
    reason: string,
    estimated_cost_cents: number,
    estimated_latency_ms: number,
    created_at: timestamp,
    tasks: { task_type, sla, ... }
  },
  ...
]
```

### Transcribe and Route
```
POST /api/transcribe-and-route
Content-Type: application/json

Body: {
  fileId: uuid,
  transcriptId: uuid
}

Response: {
  task: { ... },
  decision: { ... }
}
```

## N8n Integration

N8n workflows can be triggered via webhooks when files are uploaded. To set up:

1. Open N8n at http://localhost:5678
2. Create a new workflow
3. Add a "Webhook" trigger node
4. Configure the webhook URL
5. Activate the workflow
6. Copy the production webhook URL (format: `http://localhost:5678/webhook/<webhook-id>`)
7. Update `N8N_FILE_WEBHOOK_URL` in backend `.env`

**Note:** Test webhooks (`/webhook-test/...`) only work when the workflow editor is open with "Listen for Test Event" active.

## Development

### Frontend Development

The frontend uses Vite with HMR (Hot Module Replacement). Changes are reflected instantly.

Proxy configuration in `vite.config.ts` forwards `/api` requests to backend:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:4000'
  }
}
```

### Backend Development

Uses `tsx watch` for auto-reload on file changes. The backend is configured as an ES module (`"type": "module"` in package.json).

TypeScript configuration uses:
- `module: "nodenext"`
- `verbatimModuleSyntax: true`
- Strict type checking enabled

## Troubleshooting

### "Cannot find module 'node-fetch'"
The project uses Node.js v22+ native fetch. Ensure `node-fetch` is NOT in dependencies.

### "require() of ES Module not supported"
Ensure `package.json` has `"type": "module"` and you're using `tsx` (not `ts-node-dev`).

### N8n webhook connection refused
- Verify N8n is running: `docker-compose ps`
- Check webhook URL is production URL (`/webhook/...` not `/webhook-test/...`)
- Ensure workflow is activated in N8n

### Supabase connection errors
- Verify `.env` credentials are correct
- Check Supabase project is not paused
- Ensure tables and storage bucket exist

## License

ISC
