# Profile Update Debug Guide

## Your Database Structure ✅
Your database now has all the required columns! The structure looks perfect.

## Debugging Steps

### Step 1: Test Database Connection
1. Go to your Profile page
2. Click the **"Test DB"** button (blue button next to Edit Profile)
3. Open browser Developer Tools (F12) → Console tab
4. Look for these logs:
   - `Testing database connection...`
   - `Read test:` - Should show your profile data
   - `Update test:` - Should show success

### Step 2: Test Profile Update
1. Click **"Edit Profile"**
2. Make a simple change (like updating business name)
3. Click **"Save Changes"**
4. Check console logs for:
   - `Saving profile data:` - Shows what's being sent
   - `Existing profile check:` - Shows if profile exists
   - `Profile updated successfully:` - Confirms success

### Step 3: Check for Common Issues

#### Issue 1: RLS (Row Level Security) Policies
If you see permission errors, check your Supabase RLS policies:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- If RLS is enabled, you need policies like:
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);
```

#### Issue 2: Missing Profile Record
If the profile doesn't exist, the update will fail. Check:

```sql
-- Check if your profile exists
SELECT id, business_name, created_at 
FROM profiles 
WHERE id = 'your-user-id-here';
```

#### Issue 3: Data Type Mismatch
Make sure the data types match. Your structure looks correct, but check for:
- Array fields should be arrays: `['item1', 'item2']`
- Text fields should be strings: `'text value'`
- JSON fields should be objects: `{"key": "value"}`

### Step 4: Manual Database Test
Try updating directly in Supabase SQL Editor:

```sql
-- Test update (replace with your actual user ID)
UPDATE profiles 
SET business_name = 'Test Update', updated_at = now()
WHERE id = 'your-user-id-here';

-- Check if it worked
SELECT business_name, updated_at 
FROM profiles 
WHERE id = 'your-user-id-here';
```

## Expected Console Output

### Successful Update:
```
Saving profile data: {business_name: "New Name", ...}
User ID: 12345-67890-abcdef
Existing profile check: {existingProfile: {id: "12345-67890-abcdef"}, fetchError: null}
Profile updated successfully: [{id: "12345-67890-abcdef", business_name: "New Name", ...}]
```

### Failed Update:
```
Update error: {message: "permission denied for table profiles", ...}
Update failed, trying upsert...
Upsert error: {message: "permission denied for table profiles", ...}
```

## Quick Fixes

### If RLS is blocking updates:
1. Go to Supabase Dashboard → Authentication → Policies
2. Create policy: "Users can update own profile"
3. Policy: `auth.uid() = id`
4. Operation: UPDATE

### If profile doesn't exist:
1. Complete onboarding first
2. Or manually insert: `INSERT INTO profiles (id) VALUES (auth.uid());`

### If still not working:
1. Check Supabase logs in Dashboard → Logs
2. Look for any error messages
3. Verify your Supabase project settings
