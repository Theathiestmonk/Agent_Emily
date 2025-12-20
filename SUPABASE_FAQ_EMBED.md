## Automating FAQ Embeddings

This document captures how to keep `faq_responses` embeddings up to date via Supabase triggers + Edge Functions, mirroring the existing profile embedding flow.

### 1. Schema + trigger

- Ensure `faq_responses` has:
  - `embedding_faq vector(384)` (pgvector)  
  - `embedding_updated_at timestamptz NULL`  
  - `embedding_needs_update boolean NOT NULL DEFAULT false`
- Apply the migration in `database/add_faq_embedding.sql`.
- Apply the trigger in `database/create_faq_embedding_trigger.sql`: it sets `embedding_needs_update = true` before every insert/update so rows are flagged whenever anything changes.

### 2. Manual Admin Run

- Use the admin-only endpoint `POST /admin/faq-embeddings/run` to rebuild FAQ embeddings on demand. This endpoint calls the same `EmbeddingWorker` logic that the profile worker uses, so it:
  - Queries `faq_responses` for rows where `embedding_needs_update = true`.
  - Generates embeddings via `EmbeddingService.generate_embedding_from_text(response)`.
  - Updates `embedding_faq`, clears `embedding_needs_update`, and sets `embedding_updated_at`.
- Hook this endpoint to an admin button (or run it from your backend CLI) so you can refresh every FAQ embedding without needing realtime triggers.
- If you prefer automation, you can still run `backend/scripts/run_embedding_worker.py --target faqs` from cron or a scheduler; this script is identical to the admin endpoint under the hood.

### 3. Backend endpoint

- The FastAPI router (`backend/routers/faq_embeddings.py`) exposes `POST /faq-embeddings/update` and the admin endpoint above. Both:
  - Validate `Authorization: Bearer <FAQ_EMBED_KEY>`
  - Generate the embedding using `EmbeddingService.generate_embedding_from_text(response)`
  - Update `faq_responses.embedding_faq`, clear `embedding_needs_update`, and set `embedding_updated_at`

- Make sure the backend process is running and has `FAQ_EMBED_KEY=faq-embed-5f72a1d9` set (e.g., on Render).

### 4. Testing and verification

1. Insert or update a FAQ row. Verify:
   - The trigger sets `embedding_needs_update = true`.
2. Call `POST /admin/faq-embeddings/run` (via the new dashboard button or HTTP client) to process rows that need embeddings.
3. Tail the backend log to see `Updated embedding for FAQ …` and confirm the temporary debug line prints the Authorization header you sent.
4. Confirm `faq_responses.embedding_faq` is populated and `embedding_needs_update = FALSE`.

By following this manual or scheduled admin command, you can refresh FAQ embeddings without any complex edge-function wiring. If you still want automation later, this same endpoint can run from cron or your scheduler job.

