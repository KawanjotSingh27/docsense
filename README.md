# docsense

A multi-tenant RAG platform where users can upload documents and query them in natural language. Each tenant's data is fully isolated — a user can only search their own documents.

## What it does

- Upload PDFs and have them processed in the background
- Ask questions in plain English and get answers from your documents
- Select which documents to query — default is all, or pick a subset
- Hybrid search combining semantic vector search with keyword search for better retrieval
- Streaming responses — answers appear token by token
- Multi-tenant — each organisation's data is completely isolated from others

## Stack

- **Backend** — Node.js, Express, TypeScript
- **Database** — PostgreSQL with pgvector for vector search and full-text search
- **Queue** — Redis + BullMQ for async document ingestion
- **Storage** — MinIO (S3-compatible) for raw file storage
- **Embeddings** — Ollama (nomic-embed-text)
- **LLM** — Ollama (llama3.2:3b)
- **Frontend** — React + Vite

## How it works

When a document is uploaded, it gets stored in MinIO and a job is pushed to a BullMQ queue. A worker picks it up, extracts the text, splits it into overlapping chunks with overlap to preserve context at boundaries, embeds each chunk using nomic-embed-text, and stores the vectors in pgvector tagged with the tenant ID.

When a user asks a question, the system runs two searches in parallel — a vector search for semantic similarity and a full-text keyword search for exact term matching. Results are merged using Reciprocal Rank Fusion (RRF), which scores chunks by their rank in each list and surfaces chunks that appear in both. The top chunks are passed as context to llama3.2:3b, which streams the answer back via SSE.

Tenant isolation is enforced at the query level — both searches filter by tenant ID, so a user can never retrieve another tenant's chunks regardless of what they ask.

## Running locally

**Prerequisites:** Docker, Node.js, Ollama

```bash
# Pull models
ollama pull nomic-embed-text
ollama pull llama3.2:3b

# Start services
docker compose up -d

# Install dependencies
npm install
cd client && npm install && cd ..

# Start everything (three terminals)
ollama serve
npm run dev
npm run worker

# Frontend
cd client && npm run dev
```

## API

```
POST /auth/register        — create account and organisation
POST /auth/login           — login
POST /documents/upload     — upload a PDF (multipart/form-data)
GET  /documents            — list your documents
GET  /documents/:id/status — check processing status
POST /query                — ask a question, streams back via SSE
optional: { documentIds: string[] } to scope to specific documents
```

## Tests

```bash
npm test
```

Integration tests covering auth flows, document upload, and tenant isolation — verifying that a user cannot access another tenant's documents even with a valid token.