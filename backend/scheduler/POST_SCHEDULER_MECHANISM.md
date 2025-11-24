    # Post Scheduler Publishing Mechanism - How It Works

    ## Overview
    The post scheduler uses an **exact-time scheduling** mechanism that eliminates continuous polling. Posts are published at their exact scheduled time using asyncio tasks.

    ## Data Flow: Where Information Comes From

    ### 1. **Source of Truth: Supabase Database**
    - All scheduled posts are stored in the `content_posts` table in Supabase
    - Posts have `status = "scheduled"` with `scheduled_date` and `scheduled_time` fields
    - This is the **primary source** - the database is always the authority

    ### 2. **Backend In-Memory Cache** (Temporary Storage)
    - `post_data_cache`: Stores post data temporarily to avoid repeated database queries
    - `scheduled_tasks`: Stores asyncio tasks for each scheduled post
    - **Purpose**: Performance optimization, not source of truth
    - **Lifecycle**: Cleared when post is published or cancelled

    ### 3. **Frontend Registration** (Trigger Mechanism)
    - When a post is scheduled in the frontend, it calls `/content/register-scheduled` API
    - This **notifies** the backend about the new scheduled post
    - Frontend does NOT determine what gets published - it just registers

    ## How It Determines Which Posts to Publish

    ### On Server Startup:
    1. **One-time Supabase Query**: 
    ```python
    # Loads ALL scheduled posts from database
    response = supabase.table("content_posts").select(
        "*, content_campaigns(user_id)"
    ).eq("status", "scheduled").execute()
    ```

    2. **Filters Future Posts**:
    - Combines `scheduled_date` + `scheduled_time` into datetime
    - Only schedules posts where `scheduled_datetime > now`
    - Creates asyncio tasks for each future post

    ### When Frontend Registers a Post:
    1. **Frontend calls**: `POST /content/register-scheduled`
    - Sends: `post_id`, `scheduled_at`, `platform`
    
    2. **Backend verifies**:
    - Queries Supabase to verify post exists and belongs to user
    - Gets full post data from Supabase
    
    3. **Backend schedules**:
    - Creates asyncio task for exact publish time
    - Stores post data in cache
    - No continuous checking needed!

    ### At Publish Time:
    1. **Asyncio task triggers** at exact scheduled time
    2. **Gets post data** from cache (or Supabase if cache missing)
    3. **Queries Supabase** for platform connection (user's access token)
    4. **Publishes** to platform (Facebook, Instagram, LinkedIn, etc.)
    5. **Updates Supabase** with new status (`published` or `draft` on error)

    ## Complete Flow Diagram

    ```
    ┌─────────────┐
    │  Frontend   │
    │  Schedules  │
    │    Post     │
    └──────┬──────┘
        │
        │ POST /content/register-scheduled
        │ {post_id, scheduled_at, platform}
        ▼
    ┌─────────────────────────────────────┐
    │  Backend Router                     │
    │  /content/register-scheduled        │
    │  1. Verify post in Supabase         │
    │  2. Check user ownership            │
    └──────┬──────────────────────────────┘
        │
        │ register_scheduled_post()
        ▼
    ┌─────────────────────────────────────┐
    │  PostPublisher                      │
    │  1. Parse scheduled_datetime        │
    │  2. Create asyncio task             │
    │  3. Store in post_data_cache        │
    │  4. Store in scheduled_tasks       │
    └──────┬──────────────────────────────┘
        │
        │ (waits until scheduled time)
        ▼
    ┌─────────────────────────────────────┐
    │  Asyncio Task Triggers              │
    │  (at exact scheduled time)          │
    └──────┬──────────────────────────────┘
        │
        │ _publish_post_by_id()
        ▼
    ┌─────────────────────────────────────┐
    │  Publishing Process                 │
    │  1. Get post from cache/Supabase    │
    │  2. Query Supabase for connection   │
    │  3. Publish to platform API         │
    │  4. Update Supabase status          │
    └─────────────────────────────────────┘
    ```

    ## Key Points

    ### ✅ What Determines Which Posts to Publish?
    - **Supabase Database** - The `content_posts` table with `status="scheduled"`
    - **Scheduled Time** - Posts where `scheduled_date + scheduled_time <= now`
    - **NOT from frontend** - Frontend only registers, doesn't control publishing
    - **NOT from cache** - Cache is temporary, Supabase is source of truth

    ### ✅ When Does It Check?
    - **On startup**: Loads all scheduled posts (1 query)
    - **When registered**: Frontend sends post info (1-2 queries)
    - **At publish time**: Asyncio task triggers automatically (2 queries: connection + update)
    - **NO continuous polling**: No repeated checking every minute/hour

    ### ✅ Data Sources Priority:
    1. **Supabase** (Primary) - Always queried for:
    - Initial load of scheduled posts
    - Verifying post ownership
    - Getting platform connections
    - Updating post status

    2. **Cache** (Secondary) - Used for:
    - Storing post data temporarily
    - Avoiding repeated queries during publishing
    - Falls back to Supabase if cache missing

    3. **Frontend** (Trigger Only) - Provides:
    - Notification when post is scheduled
    - Post ID and scheduled time
    - Does NOT determine what gets published

    ## API Calls Breakdown

    ### On Server Startup:
    - **1 query**: Load all scheduled posts from Supabase

    ### When Post is Scheduled (Frontend → Backend):
    - **1 query**: Verify post exists and belongs to user
    - **1 query**: Get full post data (if not already loaded)

    ### When Post is Published:
    - **1 query**: Get platform connection (access token)
    - **1 query**: Update post status to "published"

    ### Total per Post:
    - **Registration**: 1-2 queries
    - **Publishing**: 2 queries
    - **Total**: 3-4 queries per scheduled post

    ## Benefits of This Approach

    1. **Efficient**: No continuous polling - only queries when needed
    2. **Accurate**: Exact-time publishing using asyncio tasks
    3. **Scalable**: Works with hundreds of scheduled posts
    4. **Reliable**: Supabase is source of truth, cache is just optimization
    5. **Low API Usage**: ~1-200 queries/day vs 288+ with polling

    ## Error Handling

    - If post not found in cache → Queries Supabase
    - If connection missing → Updates status to "draft" with error
    - If publish fails → Updates status to "draft" with error message
    - If server restarts → Reloads all scheduled posts from Supabase on startup

    ## Summary

    **The scheduler gets acknowledgment for which posts to publish from:**
    1. ✅ **Supabase Database** (primary source) - Queried on startup and when needed
    2. ✅ **Frontend Registration** (trigger) - Notifies backend when post is scheduled
    3. ✅ **In-Memory Cache** (optimization) - Temporary storage, not source of truth

    **The system does NOT rely on:**
    - ❌ Continuous polling of database
    - ❌ Frontend to determine what gets published
    - ❌ Cache as source of truth

    The database (Supabase) is always the authority, and the scheduler uses exact-time asyncio tasks to publish posts efficiently.





