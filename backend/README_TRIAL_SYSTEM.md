# Trial System Documentation

## Overview

The Trial System provides a 3-day free trial for new users who haven't subscribed yet. It automatically activates trials when users log in and manages trial expiration.

## Features

- **Automatic Trial Activation**: New users automatically get a 3-day free trial
- **Trial Status Management**: Tracks trial start, end, and remaining days
- **Expiration Handling**: Automatically deactivates expired trials
- **Database Integration**: Stores trial information in Supabase profiles table
- **API Endpoints**: RESTful endpoints for trial management
- **Scheduled Jobs**: Background jobs for trial expiration cleanup

## Architecture

### Components

1. **Trial Service** (`services/trial_service.py`)
   - Core business logic for trial management
   - Handles trial activation, status checking, and expiration

2. **Trial Router** (`routers/trial.py`)
   - API endpoints for trial operations
   - RESTful interface for frontend integration

3. **Trial Middleware** (`middleware/trial_middleware.py`)
   - Automatic trial handling on user login
   - Trial status validation for authenticated requests

4. **Trial Expiration Job** (`jobs/trial_expiration_job.py`)
   - Scheduled job for expired trial cleanup
   - Statistics and notification management

5. **Enhanced Authentication** (`auth_with_trial.py`)
   - Authentication with automatic trial activation
   - Trial status integration

## Database Schema

### Profiles Table Additions

```sql
-- New columns added to profiles table
ALTER TABLE profiles 
ADD COLUMN trial_activated_at TIMESTAMP,
ADD COLUMN trial_expires_at TIMESTAMP;
```

### Subscription Status Values

- `inactive`: User has no subscription or trial
- `trial`: User has an active trial
- `active`: User has a paid subscription
- `expired`: Trial or subscription has expired
- `cancelled`: Subscription was cancelled

### Database Functions

- `check_trial_expiration()`: Get active trials with days remaining
- `get_expired_trials()`: Get expired trials
- `deactivate_expired_trials()`: Deactivate expired trials
- `get_trial_statistics()`: Get trial statistics

## API Endpoints

### Trial Management

- `POST /trial/activate` - Activate trial for user
- `GET /trial/status` - Get current trial status
- `GET /trial/info` - Get comprehensive trial information
- `POST /trial/extend` - Extend trial (admin function)
- `GET /trial/health` - Health check endpoint

### Request/Response Examples

#### Activate Trial
```json
POST /trial/activate
{
  "user_email": "user@example.com",
  "user_name": "John Doe"
}

Response:
{
  "success": true,
  "message": "Trial activated successfully",
  "trial_info": {
    "trial_start": "2024-01-01T00:00:00Z",
    "trial_end": "2024-01-04T00:00:00Z",
    "days_remaining": 3,
    "trial_active": true
  }
}
```

#### Get Trial Status
```json
GET /trial/status

Response:
{
  "success": true,
  "trial_status": {
    "trial_active": true,
    "subscription_status": "trial",
    "days_remaining": 2,
    "trial_expires_at": "2024-01-04T00:00:00Z",
    "message": "Trial active, 2 days remaining"
  }
}
```

## Usage

### 1. Database Setup

Run the migration script to set up the database:

```bash
cd backend
python run_trial_migration.py
```

### 2. Test the System

Run the test suite to verify everything works:

```bash
python test_trial_system.py
```

### 3. Integration

#### Frontend Integration

Use the trial API endpoints in your frontend:

```javascript
// Check trial status
const response = await fetch('/trial/status', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const trialStatus = await response.json();

if (trialStatus.success && trialStatus.trial_status.trial_active) {
  // User has active trial
  console.log(`Trial expires in ${trialStatus.trial_status.days_remaining} days`);
} else {
  // User needs to subscribe
  console.log('Trial expired or no trial available');
}
```

#### Backend Integration

Use the enhanced authentication for automatic trial handling:

```python
from auth_with_trial import get_current_user_with_trial

@app.get("/protected-endpoint")
async def protected_endpoint(user: User = Depends(get_current_user_with_trial)):
    if user.trial_active:
        return {"message": f"Trial active, {user.days_remaining} days remaining"}
    else:
        return {"message": "Trial expired, subscription required"}
```

### 4. Scheduled Jobs

Set up a cron job to run the trial expiration job:

```bash
# Run every hour
0 * * * * cd /path/to/backend && python -c "from jobs.trial_expiration_job import main; import asyncio; asyncio.run(main())"
```

## Configuration

### Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `TRIAL_DURATION_DAYS`: Trial duration (default: 3)

### Trial Settings

Modify trial duration in `services/trial_service.py`:

```python
class TrialService:
    def __init__(self):
        # ...
        self.TRIAL_DURATION_DAYS = 3  # Change this value
```

## Monitoring

### Trial Statistics

Get trial statistics via API:

```bash
curl -X GET "http://localhost:8000/trial/health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Queries

Check trial status directly in database:

```sql
-- Get all active trials
SELECT * FROM profiles WHERE subscription_status = 'trial';

-- Get expired trials
SELECT * FROM profiles 
WHERE subscription_status = 'trial' 
AND trial_expires_at <= NOW();

-- Get trial statistics
SELECT * FROM get_trial_statistics();
```

## Error Handling

### Common Issues

1. **Trial not activating**: Check if user already has a profile
2. **Trial not expiring**: Verify cron job is running
3. **Database errors**: Check Supabase connection and permissions

### Debugging

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Considerations

- Use service role key for admin operations
- Validate user permissions before trial operations
- Implement rate limiting for trial activation
- Monitor for trial abuse patterns

## Future Enhancements

- Email notifications for trial expiration
- Trial extension requests
- Usage tracking during trial
- A/B testing for trial duration
- Trial conversion analytics

## Support

For issues or questions about the trial system:

1. Check the logs for error messages
2. Verify database schema is correct
3. Test API endpoints individually
4. Check Supabase permissions and configuration


