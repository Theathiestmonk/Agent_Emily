# Trial System Integration Guide

## 🚀 Quick Start

Your 3-day free trial system is now **ready for production use**! Here's how to integrate it:

### 1. **Automatic Trial Activation**

The trial system automatically activates for new users when they log in. No additional code needed in your frontend.

### 2. **Check Trial Status in Frontend**

Add this to your React components to show trial information:

```javascript
// Check trial status
const checkTrialStatus = async () => {
  try {
    const response = await fetch('/trial/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.trial_status.trial_active) {
      // User has active trial
      console.log(`Trial expires in ${data.trial_status.days_remaining} days`);
      return {
        hasTrial: true,
        daysRemaining: data.trial_status.days_remaining
      };
    } else {
      // User needs subscription
      return {
        hasTrial: false,
        needsSubscription: true
      };
    }
  } catch (error) {
    console.error('Error checking trial status:', error);
    return { hasTrial: false };
  }
};
```

### 3. **Show Trial Banner**

Add a trial banner to your dashboard:

```javascript
const TrialBanner = ({ daysRemaining }) => (
  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-bold">🎉 Free Trial Active!</h3>
        <p className="text-sm">You have {daysRemaining} days remaining</p>
      </div>
      <button className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100">
        Upgrade Now
      </button>
    </div>
  </div>
);
```

### 4. **API Endpoints Available**

- `GET /trial/status` - Check current trial status
- `GET /trial/info` - Get comprehensive trial information
- `POST /trial/activate` - Manually activate trial (if needed)
- `GET /trial/health` - Health check endpoint

### 5. **Backend Integration**

If you need to check trial status in your backend routes:

```python
from auth_with_trial import get_current_user_with_trial

@app.get("/protected-endpoint")
async def protected_endpoint(user: User = Depends(get_current_user_with_trial)):
    if user.trial_active:
        return {"message": f"Trial active, {user.days_remaining} days remaining"}
    elif user.subscription_status == "active":
        return {"message": "Paid subscription active"}
    else:
        return {"message": "Subscription required", "status": 402}
```

### 6. **Scheduled Jobs**

Set up a cron job to clean up expired trials:

```bash
# Run every hour
0 * * * * cd /path/to/backend && python -c "from jobs.trial_expiration_job import main; import asyncio; asyncio.run(main())"
```

## 📊 Monitoring

### Check Trial Statistics

```bash
curl -X GET "http://localhost:8000/trial/health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Queries

```sql
-- Get all active trials
SELECT * FROM profiles WHERE subscription_status = 'trial';

-- Get trial statistics
SELECT * FROM get_trial_statistics();
```

## 🎯 How It Works

1. **New User Signs Up** → Automatically gets 3-day trial
2. **User Logs In** → Trial status checked automatically
3. **Trial Active** → Full access to all features
4. **Trial Expires** → Access restricted, subscription required
5. **Background Job** → Cleans up expired trials automatically

## ✅ System Status

- ✅ **Database Functions**: Working
- ✅ **Trial Service**: Working  
- ✅ **Trial Expiration Job**: Working
- ✅ **API Endpoints**: Ready
- ✅ **Authentication Integration**: Ready

## 🚀 Ready for Production!

Your trial system is now fully functional and ready to convert new users into paying customers!
