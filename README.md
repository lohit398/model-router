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

### Deploying to NAS through coolify

# 📘 Airr File Intelligence POC
A full-stack Proof-of-Concept demonstrating automated file ingestion → transcription → task routing using Supabase, Node.js backend, n8n orchestration, and React frontend. Designed for deployment on a NAS using Coolify.

---

# 🚀 Overview

This project processes uploaded files end-to-end:

1. **Frontend** uploads a file → `/api/upload`
2. **Backend** stores file in **Supabase Storage**
3. Backend creates:
   - `uploaded_files` row  
   - `transcripts` row
4. Backend notifies **n8n** using a Webhook
5. **n8n** triggers `/api/transcribe-and-route`
6. Backend:
   - Downloads file from Supabase Storage
   - Extracts or mocks transcript text
   - Updates `transcripts`
   - Creates:
     - `tasks`
     - `routing_decisions`
     - `model_runs`
7. Frontend shows routing intelligence results

This POC mirrors Airr 3.0 ingestion → intelligence → routing flows.

---

# 📂 Project Structure

```
/
├── backend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
└── n8n/ (optional)
```

---

# ⚙️ 1. Backend Setup

### Install

```bash
cd backend
npm install
npm run dev
```

### Environment Variables (`.env`)

```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

N8N_FILE_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/airr/file-uploaded

PORT=4000
```

### API Endpoints

#### `POST /api/upload`
- Stores file in Supabase Storage
- Inserts into `uploaded_files` + `transcripts`
- Calls n8n webhook:
  ```json
  { "fileId": "...", "transcriptId": "..." }
  ```

#### `POST /api/transcribe-and-route`
- Input:
  ```json
  {
    "fileId": "uuid",
    "transcriptId": "uuid"
  }
  ```
- Downloads file from Supabase Storage  
- Converts content → transcript
- Updates `transcripts`
- Creates:
  - `tasks`
  - `routing_decisions`
  - `model_runs`

---

# 🌐 2. Frontend Setup

### Install

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (`.env`)

```
VITE_API_BASE=https://backend.your-domain.com
```

---

# 🔧 3. Supabase Schema

### Uploaded Files

```sql
create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  file_name text,
  file_type text,
  storage_path text,
  status text default 'processing'
);
```

### Transcripts

```sql
create table transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  file_id uuid references uploaded_files(id) on delete cascade,
  text text,
  language text,
  duration_seconds int,
  status text default 'processing'
);
```

### Tasks

```sql
create type task_type as enum ('summary', 'classification', 'extraction');
create type sla_tier as enum ('low_latency', 'low_cost', 'high_quality');
create type task_status as enum ('pending', 'completed', 'failed');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  task_type task_type not null,
  sla sla_tier not null,
  input_text text not null,
  max_cost_cents int not null,
  transcript_id uuid references transcripts(id),
  status task_status default 'pending'
);
```

### Routing Decisions

```sql
create table routing_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  chosen_model text,
  reason text,
  estimated_cost_cents int,
  estimated_latency_ms int
);
```

### Model Runs

```sql
create type model_name as enum ('gpt_4_1', 'gpt_4_1_mini', 'rules_engine');

create table model_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id),
  model model_name,
  token_input int,
  token_output int,
  latency_ms int,
  cost_cents int,
  success boolean
);
```

---

# 🧩 4. n8n Workflow (Minimal: Orchestration Only)

Final workflow:

```
Webhook → HTTP POST /api/transcribe-and-route
```

### Node 1: Webhook

- Path: `airr/file-uploaded`
- Method: POST

### Node 2: HTTP POST (Trigger backend)

URL:

```
{{ $env["BACKEND_API_BASE"] }}/api/transcribe-and-route
```

Body:

| Key          | Value                                      |
|--------------|--------------------------------------------|
| `fileId`      | `{{$json["fileId"]}}`                      |
| `transcriptId`| `{{$json["transcriptId"]}}`                |

---

# 🚢 5. Deployment with Coolify on NAS

You will deploy:

- **Backend** → `backend.yourdomain.com`
- **Frontend** → `airr.yourdomain.com`
- **n8n** → `n8n.yourdomain.com`

---

## Backend Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### Coolify Steps

1. Create → Standalone App → Git
2. Select backend repo
3. Build using Dockerfile
4. Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `N8N_FILE_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/airr/file-uploaded`
5. Internal port: **4000**
6. Domain: `https://backend.yourdomain.com`
7. Deploy

---

## Frontend Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Coolify Steps

1. New App → Git
2. Use frontend repo
3. Build using Dockerfile
4. Env var:

```
VITE_API_BASE=https://backend.yourdomain.com
```

5. Internal port: **80**
6. Domain: `https://airr.yourdomain.com`
7. Deploy

---

## n8n Deployment (Optional)

Use Coolify Marketplace → n8n template

Env vars:

```
N8N_HOST=n8n.yourdomain.com
WEBHOOK_URL=https://n8n.yourdomain.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BACKEND_API_BASE=https://backend.yourdomain.com
```

Domain:

```
https://n8n.yourdomain.com
```

---

# 🧪 6. Testing E2E

1. Open frontend → upload file  
2. Backend stores it in Supabase  
3. n8n webhook fires  
4. Backend runs `/api/transcribe-and-route`  
5. Verify tables:
   - `uploaded_files`
   - `transcripts` (status = ready)
   - `tasks`
   - `routing_decisions`
   - `model_runs`
6. Frontend shows routing insights

---

# 📦 7. Deployment Notes

```
To deploy on NAS via Coolify:
1. Use Dockerfile deployments for backend & frontend
2. Configure Supabase environment variables
3. Deploy n8n (optional)
4. Point N8N_FILE_WEBHOOK_URL to production webhook
5. Ensure backend/frontend/n8n all communicate securely via HTTPS
```

---

# 🎉 Done!

## License

ISC
