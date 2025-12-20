## Automating FAQ Embeddings

This document captures how to keep `faq_responses` embeddings up to date via Supabase triggers + Edge Functions, mirroring the existing profile embedding flow.

### 1. Schema + trigger

- Ensure `faq_responses` has:
  - `embedding_faq vector(384)` (pgvector)  
  - `embedding_updated_at timestamptz NULL`  
  - `embedding_needs_update boolean NOT NULL DEFAULT false`
- Apply the migration in `database/add_faq_embedding.sql`.
- Apply the trigger in `database/create_faq_embedding_trigger.sql`: it sets `embedding_needs_update = true` before every insert/update so rows are flagged whenever anything changes.

### 2. Queue + Edge Function

- Optional queue table (if you prefer batching):
  ```sql
  CREATE TABLE faq_embedding_queue (
    faq_id uuid PRIMARY KEY,
    response text NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );
  ```
- The trigger can insert into this queue (or directly POST) whenever a FAQ row changes.
- Deploy an Edge Function (TypeScript/JS) that listens for Supabase queue events (or `http_post` from the trigger) and immediately forwards them to your backend.

  Example handler:
  ```ts
  import fetch from "node-fetch";

  export default async function handler(req) {
    const { id, response } = await req.json();
    await fetch(`${process.env.BACKEND_URL}/faq-embeddings/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({ id, response }),
    });
    return new Response("ok");
  }
  ```
- Set `EMBEDDING_API_KEY` in the Edge Function environment to the same value as your backend's `FAQ_EMBED_KEY` (e.g., `faq-embed-5f72a1d9`).

### 3. Backend endpoint

- The new FastAPI router (`backend/routers/faq_embeddings.py`) exposes `POST /faq-embeddings/update`. It:
  - Validates `Authorization: Bearer <FAQ_EMBED_KEY>`
  - Generates the embedding using `EmbeddingService.generate_embedding_from_text(response)`
  - Updates `faq_responses.embedding_faq`, clears `embedding_needs_update`, and writes `embedding_updated_at = now()`

- Ensure the backend process is running and has `FAQ_EMBED_KEY` set before testing.

### 4. Testing and verification

1. Insert/update a row in Supabase. Verify:
   - Trigger set `embedding_needs_update = true` (run `SELECT embedding_needs_update FROM faq_responses WHERE id = '...'`).
   - Queue record exists (if using `faq_embedding_queue`).
2. Check the Edge Function logs to confirm it received the payload and POSTed to your backend successfully.
3. Watch the backend log for `Updated embedding for FAQ ...`.
4. Confirm Supabase row now has:
   - `embedding_faq` populated (vector)
   - `embedding_needs_update = FALSE`
   - `embedding_updated_at` updated

### 5. Optional fallback

- Keep the script `backend/scripts/run_embedding_worker.py --target faqs` or the scheduler as a fallback to catch missed events. Use cron (every few minutes) only if you prefer redundancy, but the Edge Function path ensures embeddings update immediately upon changes.

By following this flow, `faq_responses` embeddings remain synchronized as soon as Supabase receives new or updated rows—just like the profile embedding automation. Let me know if you want the trigger to call the queue or an HTTP webhook directly and I can help tailor the SQL/Edge Function script further.

