#!/bin/bash
# Cron job script to run embedding worker
# This script processes profiles that need embeddings generated or updated

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to backend directory
cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Run the embedding worker once
python services/embedding_worker.py --once

# Deactivate virtual environment if it was activated
if [ -n "$VIRTUAL_ENV" ]; then
    deactivate
fi










