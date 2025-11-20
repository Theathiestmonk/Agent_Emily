# Backend Scheduler - Supabase API Calls Calculation (NEW IMPLEMENTATION)

## New Mechanism: Exact Time Scheduling (No Polling!)

### How It Works:
1. **Frontend sends scheduled post info once** when post is scheduled
2. **Backend schedules exact publish time** using asyncio tasks
3. **No continuous polling** - posts publish at exact scheduled time
4. **Backend loads existing scheduled posts on startup** (one-time query)

## API Calls Breakdown

### On Server Startup:
- **1 query**: Load all existing scheduled posts from database
- **Frequency**: Once per server restart

### When Frontend Registers Scheduled Post:
- **1 query**: Verify post exists and belongs to user
- **1 query**: Get full post data (if not cached)
- **Total per registration**: **1-2 queries**

### Per Post That Gets Published:

#### 1. Platform Connection Query
- **Query**: `platform_connections.select("*").eq("user_id", user_id).eq("platform", platform).execute()`
- **Calls per post**: **1 query**

#### 2. Post Status Update Query
- **Query**: `content_posts.update({...}).eq("id", post_id).execute()`
- **Calls per post**: **1 query**

## Total API Calls Per Day

### Minimum Scenario (No New Scheduled Posts):
- Startup load: **1 query** (once per day if server stays up)
- **Total: ~1 query/day** ✅

### Typical Scenario (10 Posts Scheduled, 10 Published):
- Startup load: **1 query**
- Registration queries: **10-20 queries** (1-2 per post)
- Publishing queries: **20 queries** (2 per post: connection + update)
- **Total: ~31-41 queries/day** ✅

### Maximum Scenario (50 Posts Scheduled, 50 Published):
- Startup load: **1 query**
- Registration queries: **50-100 queries**
- Publishing queries: **100 queries**
- **Total: ~151-201 queries/day** ✅

## Comparison: Old vs New

| Scenario | Old (Polling) | New (Exact Time) | Improvement |
|----------|---------------|-------------------|-------------|
| **No posts** | 288 queries/day | 1 query/day | **99.7% reduction** |
| **10 posts** | 308 queries/day | 31-41 queries/day | **87-90% reduction** |
| **50 posts** | 388 queries/day | 151-201 queries/day | **48-61% reduction** |

## Benefits

1. **Massive reduction in API calls** - No continuous polling
2. **Exact time publishing** - Posts publish at exact scheduled time
3. **Frontend-driven** - Frontend sends post info once, backend handles the rest
4. **Efficient** - Only queries when needed (registration, publishing)
5. **Scalable** - Works efficiently even with hundreds of scheduled posts

## Supabase Limits

- **Free Tier**: 500,000 API requests/month = ~16,666 requests/day
- **Pro Tier**: 5,000,000 API requests/month = ~166,666 requests/day

**Our usage**: ~1-200 queries/day = **0.006% - 1.2% of free tier limit** ✅✅✅

## Recommendation

The new implementation is **extremely efficient** - up to **99.7% reduction** in API calls compared to polling method!

