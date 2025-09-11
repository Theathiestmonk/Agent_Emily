# Google Workspace Integration Guide

This guide explains how to integrate Google Workspace services (Gmail, Drive, Sheets, Docs) into your Emily Marketing Agent.

## 🚀 Quick Start

### 1. Google Cloud Console Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project: "Emily Marketing Agent"

2. **Enable Required APIs**
   - Navigate to "APIs & Services" > "Library"
   - Enable these APIs:
     - Gmail API
     - Google Drive API
     - Google Sheets API
     - Google Docs API
     - Google Calendar API (optional)

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Add authorized redirect URIs:
     - `https://agent-emily.onrender.com/connections/auth/google/callback`
     - `http://localhost:8000/connections/auth/google/callback` (for development)

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Google Services Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Database Migration

Run the database migration to add Google connection fields:

```sql
-- Run this in your Supabase SQL editor
-- See: backend/database/add_google_connection_fields.sql
```

### 5. Test the Integration

```bash
cd backend
python test_google_integration.py
```

## 📋 API Endpoints

### Authentication
- `GET /connections/google/auth` - Initiate Google OAuth flow
- `GET /connections/google/callback` - Handle OAuth callback
- `GET /connections/google/disconnect` - Disconnect Google account

### Gmail
- `GET /connections/google/gmail/messages?limit=10` - Get Gmail messages
- `POST /connections/google/gmail/send` - Send email

### Google Drive
- `GET /connections/google/drive/files?limit=10` - Get Drive files

### Google Sheets
- `GET /connections/google/sheets/spreadsheets?limit=10` - Get spreadsheets

### Google Docs
- `GET /connections/google/docs/documents?limit=10` - Get documents

## 🔧 Frontend Integration

### 1. Connection Cards
The Google connection card is automatically added to the ConnectionCards component with:
- Gmail, Drive, Sheets, Docs integration
- OAuth flow initiation
- Connection status display
- Dashboard access button

### 2. Google Dashboard
Access the Google Dashboard at `/google-dashboard` to:
- View recent Gmail messages
- Browse Google Drive files
- Access Google Sheets
- View Google Docs
- Send emails

### 3. Navigation
The Google Dashboard is accessible through:
- Connection cards (when connected)
- Direct URL: `/google-dashboard`

## 🔒 Security Features

### Token Encryption
- All Google tokens are encrypted before storage
- Uses Fernet encryption with your `ENCRYPTION_KEY`
- Tokens are decrypted only when needed

### OAuth Scopes
The integration requests these scopes:
- `gmail.readonly` - Read Gmail messages
- `gmail.send` - Send emails
- `drive.readonly` - Read Drive files
- `drive.file` - Create/modify Drive files
- `spreadsheets` - Access Google Sheets
- `documents` - Access Google Docs
- `calendar.readonly` - Read calendar events

### Token Refresh
- Automatic token refresh when expired
- Long-lived tokens for better user experience
- Graceful handling of expired tokens

## 🚨 Troubleshooting

### Common Issues

1. **"Google OAuth not configured"**
   - Check that all environment variables are set
   - Verify Google Cloud Console setup

2. **"No active Google connection found"**
   - User needs to complete OAuth flow
   - Check database for connection record

3. **"Failed to fetch Gmail messages"**
   - Token may be expired
   - Check OAuth scopes
   - Verify Gmail API is enabled

4. **Redirect URI mismatch**
   - Ensure redirect URI matches exactly in Google Cloud Console
   - Check for trailing slashes

### Debug Steps

1. **Check Environment Variables**
   ```bash
   python -c "import os; print('GOOGLE_CLIENT_ID:', bool(os.getenv('GOOGLE_CLIENT_ID')))"
   ```

2. **Test OAuth Flow**
   ```bash
   curl https://agent-emily.onrender.com/connections/google/auth
   ```

3. **Check Database**
   ```sql
   SELECT * FROM platform_connections WHERE platform = 'google';
   ```

4. **View Logs**
   ```bash
   # Check your deployment logs for errors
   ```

## 📊 Usage Examples

### Send Email
```javascript
const response = await fetch('/api/connections/google/gmail/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: 'Hello from Emily',
    body: 'This is a test email from Emily Marketing Agent!'
  })
});
```

### Get Drive Files
```javascript
const response = await fetch('/api/connections/google/drive/files?limit=5');
const data = await response.json();
console.log(data.files);
```

### Get Gmail Messages
```javascript
const response = await fetch('/api/connections/google/gmail/messages?limit=10');
const data = await response.json();
console.log(data.messages);
```

## 🔄 OAuth Flow

1. **User clicks "Connect Google"**
2. **Redirected to Google OAuth consent screen**
3. **User grants permissions**
4. **Google redirects back to callback URL**
5. **Backend exchanges code for tokens**
6. **Tokens stored encrypted in database**
7. **User can now use Google services**

## 📈 Monitoring

### Key Metrics to Monitor
- OAuth success rate
- API call success rate
- Token refresh frequency
- User engagement with Google features

### Logging
- All OAuth flows are logged
- API errors are logged with details
- Token refresh attempts are logged

## 🚀 Deployment

### Production Checklist
- [ ] Google Cloud Console configured
- [ ] Environment variables set
- [ ] Database migration run
- [ ] OAuth redirect URIs configured
- [ ] SSL certificate valid
- [ ] Error monitoring enabled

### Environment Variables for Production
```bash
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://agent-emily.onrender.com/connections/auth/google/callback
ENCRYPTION_KEY=your_encryption_key
```

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Docs API Documentation](https://developers.google.com/docs/api)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review the logs
3. Test with the provided test script
4. Verify Google Cloud Console configuration

---

**Happy integrating! 🎉**
