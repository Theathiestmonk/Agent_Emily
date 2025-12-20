# Embedding Worker Cron Job Setup

This guide explains how to set up a cron job to automatically process profile embeddings when profiles are created or updated.

## How It Works

1. **Database Trigger**: When a profile is inserted or updated, the trigger automatically sets `embedding_needs_update = true`
   - `faq_responses` now mirrors the profile table: [`database/add_faq_embedding.sql`](database/add_faq_embedding.sql) adds flag/timestamp columns and [`database/create_faq_embedding_trigger.sql`](database/create_faq_embedding_trigger.sql) marks every FAQ row as needing an embedding.
2. **Cron Job**: Runs periodically to find and process rows with `embedding_needs_update = true`
3. **Worker**: Generates embeddings and updates the database (`profile_embedding` or `embedding_faq`)

## Setup Options

### Option 1: Python Script (Recommended)

Use the Python script that handles logging and error handling; it accepts `--target profiles` (default) or `--target faqs`:

```bash
# Make the script executable
chmod +x backend/scripts/run_embedding_worker.py
```

**Cron Configuration** (profiles, every 5 minutes):

```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your project)
*/5 * * * * cd /path/to/Agent_Emily/backend && /path/to/venv/bin/python scripts/run_embedding_worker.py --target profiles >> logs/embedding_worker_cron.log 2>&1
```

**Cron Configuration** (faqs, every 15 minutes):

```bash
# Add this line for FAQs
*/15 * * * * cd /path/to/Agent_Emily/backend && /path/to/venv/bin/python scripts/run_embedding_worker.py --target faqs >> logs/faq_embedding_worker_cron.log 2>&1
```

### Option 2: Bash Script

Use the bash script if you prefer shell-based execution:

```bash
# Make the script executable
chmod +x backend/scripts/run_embedding_worker.sh
```

**Cron Configuration**:
```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your project)
*/5 * * * * /path/to/Agent_Emily/backend/scripts/run_embedding_worker.sh >> /path/to/Agent_Emily/backend/logs/embedding_worker_cron.log 2>&1
```

### Option 3: Continuous Background Process

Instead of cron, run the worker as a continuous background process:

```bash
# Run in background
nohup python backend/services/embedding_worker.py > logs/embedding_worker.log 2>&1 &

# Or use screen/tmux
screen -S embedding_worker
python backend/services/embedding_worker.py
# Press Ctrl+A then D to detach
```

## Cron Schedule Examples

- **Every minute**: `* * * * *`
- **Every 5 minutes**: `*/5 * * * *`
- **Every 10 minutes**: `*/10 * * * *`
- **Every hour**: `0 * * * *`
- **Every 30 minutes**: `*/30 * * * *`

## Verify Cron Job

1. **Check if cron is running**:
   ```bash
   sudo systemctl status cron  # Linux
   # or
   sudo service cron status
   ```

2. **View cron logs**:
   ```bash
   tail -f logs/embedding_worker_cron.log
   ```

3. **Test manually**:
   ```bash
   python backend/scripts/run_embedding_worker.py
   ```

## FAQ Embedding verification

1. **Trigger health**: Run a quick SQL query in Supabase to ensure the trigger is setting `embedding_needs_update = true` on new or updated rows.

   ```sql
   SELECT id, faq_key, embedding_needs_update
   FROM public.faq_responses
   ORDER BY updated_at DESC
   LIMIT 5;
   ```

2. **Worker logs**: Tail `logs/faq_embedding_worker_cron.log` or `logs/embedding_worker_cron.log` (depending on which target you run) to confirm the script processed FAQ rows and set `embedding_faq`.

3. **Embeddings exist**: After the worker runs, verify `embedding_faq` and `embedding_updated_at` are no longer null for the processed FAQ row:

   ```sql
   SELECT faq_key, embedding_faq IS NOT NULL AS has_vector, embedding_updated_at
   FROM public.faq_responses
   WHERE faq_key = '<your key>';
   ```

## FAQ Embedding Automation

1. Apply [`database/add_faq_embedding.sql`](database/add_faq_embedding.sql) and [`database/create_faq_embedding_trigger.sql`](database/create_faq_embedding_trigger.sql) so the `faq_responses` table stores `embedding_needs_update`/`embedding_updated_at` and a trigger marks the flag on INSERT/UPDATE.
2. Run `python backend/services/embedding_worker.py --target faqs --once` or `TARGET=faqs python backend/scripts/run_embedding_worker.py` to manually generate FAQ embeddings from the queue.
3. The scheduler at [`backend/scheduler/embedding_worker_scheduler.py`](backend/scheduler/embedding_worker_scheduler.py) now runs `process_faq_embeddings` every 5 minutes while continuing to process profile embeddings every 3 hours.
4. Look for log entries like `Processed X faqs rows this run` in `logs/embedding_worker.log` or your cron log to confirm the flow is working.
5. To test the trigger: insert or update a FAQ row, verify `embedding_needs_update` becomes `true`, then wait <5 minutes (or run the worker manually) and confirm `embedding_faq`/`embedding_updated_at` are set.

## Production Deployment

### For Render.com / Cloud Platforms

Add to your `Procfile`:
```
embedding_worker: python backend/services/embedding_worker.py
```

Or use a scheduled job in your platform's scheduler.

### For Systemd (Linux)

Create `/etc/systemd/system/embedding-worker.service`:
```ini
[Unit]
Description=Profile Embedding Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/Agent_Emily/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python services/embedding_worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable embedding-worker
sudo systemctl start embedding-worker
sudo systemctl status embedding-worker
```

## Monitoring

The worker logs to:
- Console output (if run directly)
- `embedding_worker.log` (if using Python script)
- Cron log file (if configured in crontab)

Check logs regularly to ensure embeddings are being processed.

## Troubleshooting

1. **Worker not processing profiles**:
   - Check if profiles have `embedding_needs_update = true`
   - Verify database trigger is active
   - Check worker logs for errors

2. **Cron not running**:
   - Verify cron service is running
   - Check cron logs: `grep CRON /var/log/syslog`
   - Ensure script paths are absolute
   - Check file permissions

3. **Import errors**:
   - Ensure virtual environment is activated
   - Verify all dependencies are installed
   - Check Python path in script












