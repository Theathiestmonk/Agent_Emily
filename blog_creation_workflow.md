# Blog Creation Workflow with Context

## Overview
This document outlines the complete blog creation workflow in the Emily Agent system, showing how user profile data is used to generate personalized WordPress blog content.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BLOG CREATION WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────────┘

1. USER INITIATES BLOG GENERATION
   ┌─────────────────┐
   │ Frontend: User  │
   │ clicks "Generate│
   │ Blog" button    │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Frontend:       │
   │ BlogDashboard   │
   │ calls API       │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Backend:        │
   │ /api/blogs/     │
   │ generate        │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ BlogWritingAgent│
   │ .generate_blogs │
   │ _for_user()     │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ LangGraph       │
   │ Workflow        │
   │ Execution       │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ STEP 1:         │
   │ Fetch Profile   │
   │ Data            │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ STEP 2:         │
   │ Fetch WordPress │
   │ Sites           │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ STEP 3:         │
   │ Generate Blog   │
   │ Content         │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ STEP 4:         │
   │ Save Blog       │
   │ to Database     │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ STEP 5:         │
   │ Update Progress │
   │ & Return        │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Frontend:       │
   │ Display Results │
   │ or Error        │
   └─────────────────┘
```

## Detailed Context Flow

### 1. Profile Data Loading
```
┌─────────────────────────────────────────────────────────────────┐
│                    PROFILE DATA EXTRACTION                     │
└─────────────────────────────────────────────────────────────────┘

Database Query: profiles table WHERE id = user_id
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACTED PROFILE DATA                      │
├─────────────────────────────────────────────────────────────────┤
│ • User ID: [Authenticated User ID]                             │
│ • Name: [Authenticated User Name]                              │
│ • Business Name: [Demo Business Name]                         │
│ • Industry: ['Demo Industry 1', 'Demo Industry 2']           │
│ • Target Audience: ['Demo Audience 1', 'Demo Audience 2']    │
│ • Content Themes: ['Demo Theme 1', 'Demo Theme 2']           │
│ • Business Description: Demo business description...          │
│ • Unique Value Proposition: Demo unique value proposition...  │
│ • Products/Services: Demo products and services...            │
│ • Brand Voice: Professional                                   │
│ • Brand Tone: Formal                                          │
│ • Website URL, Phone, Address, etc.                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. WordPress Sites Loading
```
┌─────────────────────────────────────────────────────────────────┐
│                   WORDPRESS SITES EXTRACTION                   │
└─────────────────────────────────────────────────────────────────┘

Database Query: platform_connections table 
                WHERE user_id = user_id AND platform = 'wordpress' AND is_active = true
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACTED SITE DATA                         │
├─────────────────────────────────────────────────────────────────┤
│ • Site ID: [Demo Site ID]                                      │
│ • Site Name: [Demo Site Name]                                  │
│ • WordPress URL: https://demo-site.com                         │
│ • Active: True                                                 │
│ • Connection Details: API keys, credentials, etc.              │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Blog Content Generation Context
```
┌─────────────────────────────────────────────────────────────────┐
│                BLOG GENERATION CONTEXT BUILDING                │
└─────────────────────────────────────────────────────────────────┘

Profile Data + Site Data → Context Building
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FINAL GENERATION CONTEXT                    │
├─────────────────────────────────────────────────────────────────┤
│ BUSINESS CONTEXT:                                              │
│ • Author: [Authenticated User Name]                           │
│ • Business Name: [Demo Business Name]                         │
│ • Site: [Demo Site Name]                                      │
│ • Industry: [Demo Industry 1], [Demo Industry 2]              │
│ • Business Description: Demo business description...          │
│ • Target Audience: [Demo Audience 1], [Demo Audience 2]       │
│ • Content Themes: [Demo Theme 1], [Demo Theme 2]              │
│ • Unique Value Proposition: Demo unique value proposition...  │
│ • Brand Voice: Professional                                   │
│ • Brand Tone: Formal                                          │
│ • Products/Services: Demo products and services...            │
└─────────────────────────────────────────────────────────────────┘
```

### 4. OpenAI API Call with Context
```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENAI API CALL                             │
└─────────────────────────────────────────────────────────────────┘

Context + Prompt → OpenAI GPT-4 API
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATED BLOG CONTENT                      │
├─────────────────────────────────────────────────────────────────┤
│ • Title: "Demo Blog Title: Industry Insights and Opportunities" │
│ • Content: 1000-2000 words about demo industry                 │
│ • Excerpt: Brief description highlighting demo business value  │
│ • Slug: demo-blog-title-industry-insights-opportunities        │
│ • Categories: ['Demo Category 1', 'Demo Category 2', 'News']   │
│ • Tags: ['demo tag 1', 'demo tag 2', 'industry insights']      │
│ • Meta Description: SEO-optimized demo description             │
│ • Meta Keywords: Demo-specific keywords                        │
│ • Reading Time: 8 minutes                                     │
│ • Word Count: 1200 words                                      │
│ • SEO Score: 85/100                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Database Storage
```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STORAGE                            │
└─────────────────────────────────────────────────────────────────┘

Generated Content → blog_posts table
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STORED BLOG POST                            │
├─────────────────────────────────────────────────────────────────┤
│ • ID: UUID generated                                           │
│ • Author ID: [Authenticated User ID]                           │
│ • Title: Generated title                                       │
│ • Content: Generated HTML content                              │
│ • Excerpt: Generated excerpt                                   │
│ • Slug: Generated slug                                         │
│ • Status: 'draft' (default)                                   │
│ • Categories: JSON array                                       │
│ • Tags: JSON array                                             │
│ • Meta Description: Generated meta description                 │
│ • Meta Keywords: JSON array                                    │
│ • Reading Time: Generated reading time                         │
│ • Word Count: Generated word count                             │
│ • SEO Score: Generated SEO score                               │
│ • Site ID: [Demo Site ID]                                      │
│ • Created At: Current timestamp                                │
│ • Updated At: Current timestamp                                │
│ • Metadata: Additional context data                            │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

### API Quota Exceeded
```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                         │
└─────────────────────────────────────────────────────────────────┘

OpenAI API Call → 429 Error (Quota Exceeded)
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR DETECTION                             │
├─────────────────────────────────────────────────────────────────┤
│ • Error caught in _generate_blog_content()                     │
│ • Check for "quota", "429", or "insufficient_quota" in error   │
│ • Return "API_QUOTA_ERROR" indicator                           │
│ • Set state.error = "OpenAI API quota exceeded..."             │
│ • Stop blog generation process                                 │
└─────────────────────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR RESPONSE                              │
├─────────────────────────────────────────────────────────────────┤
│ • success: false                                               │
│ • error: "OpenAI API quota exceeded. Please check your billing details." │
│ • blogs: []                                                    │
│ • total_blogs: 0                                               │
│ • message: "Blog generation failed: [error message]"          │
└─────────────────────────────────────────────────────────────────┘
```

## Console Logging Output

### Successful Generation
```
================================================================================
📊 PROFILE DATA LOADED FROM DATABASE:
================================================================================
👤 User ID: [Authenticated User ID]
📝 Name: [Authenticated User Name]
🏢 Business Name: [Demo Business Name]
🏭 Industry: ['Demo Industry 1', 'Demo Industry 2']
👥 Target Audience: ['Demo Audience 1', 'Demo Audience 2']
🎨 Content Themes: ['Demo Theme 1', 'Demo Theme 2']
📄 Business Description: Demo business description...
💎 Unique Value Proposition: Demo unique value proposition...
🛍️ Products/Services: Demo products and services...
🎤 Brand Voice: Professional
🎭 Brand Tone: Formal
================================================================================

================================================================================
🌐 WORDPRESS SITES LOADED:
================================================================================
Site 1: [Demo Site Name] (ID: [demo-site-id])
  - URL: https://demo-site.com
  - Active: True
Total sites: 1
================================================================================

================================================================================
🎯 BLOG GENERATION CONTEXT - PROFILE DATA BEING USED:
================================================================================
📝 Author: [Authenticated User Name]
🏢 Business Name: [Demo Business Name]
🏭 Industry: [Demo Industry 1], [Demo Industry 2]
👥 Target Audience: [Demo Audience 1], [Demo Audience 2]
🎨 Content Themes: ['Demo Theme 1', 'Demo Theme 2']
📄 Business Description: Demo business description...
🛍️ Products/Services: Demo products and services...
💎 Unique Value Proposition: Demo unique value proposition...
🎤 Brand Voice: Professional
🎭 Brand Tone: Formal
🌐 WordPress Site: [Demo Site Name]
================================================================================

================================================================================
📝 GENERATED BLOG CONTENT:
================================================================================
📰 Title: Demo Blog Title: Industry Insights and Opportunities
📄 Excerpt: Discover the latest trends in demo industry...
🔗 Slug: demo-blog-title-industry-insights-opportunities
📂 Categories: ['Demo Category 1', 'Demo Category 2', 'News']
🏷️ Tags: ['demo tag 1', 'demo tag 2', 'industry insights']
🔍 Meta Description: Learn about demo industry trends and opportunities...
🔑 Meta Keywords: ['demo keyword 1', 'demo industry', 'demo audience']
⏱️ Reading Time: 8 minutes
📊 Word Count: 1200 words
⭐ SEO Score: 85/100
📝 Content Preview: The demo industry is experiencing unprecedented growth...
================================================================================
```

### Error Case
```
================================================================================
📊 PROFILE DATA LOADED FROM DATABASE:
================================================================================
[Profile data shown...]
================================================================================

================================================================================
🌐 WORDPRESS SITES LOADED:
================================================================================
[Site data shown...]
================================================================================

================================================================================
🎯 BLOG GENERATION CONTEXT - PROFILE DATA BEING USED:
================================================================================
[Context data shown...]
================================================================================

❌ ERROR generating blog content: Error code: 429 - {'error': {'message': 'You exceeded your current quota, please check your plan and billing details.'}}
💳 OPENAI API QUOTA EXCEEDED - Please check your billing details
❌ API QUOTA EXCEEDED - Please check your billing details
❌ BLOG GENERATION FAILED: OpenAI API quota exceeded. Please check your billing details.
```

## Key Features

### 1. **Profile-Driven Content**
- Uses actual user business data from database
- No hardcoded or mock data
- Personalized for specific business and industry

### 2. **Comprehensive Context**
- Business name, industry, target audience
- Content themes, brand voice, unique value proposition
- Products/services, business description
- WordPress site information

### 3. **Error Handling**
- Detects API quota exceeded
- Returns proper error messages
- Stops generation process on errors

### 4. **Console Logging**
- Detailed logging at each step
- Shows exactly what data is being used
- Helps debug issues

### 5. **Database Integration**
- Stores generated blogs in database
- Links to user and WordPress site
- Maintains metadata and context

## Current Issues

1. **API Quota Exceeded**: OpenAI API quota needs to be increased
2. **Error Handling**: Some error cases not properly handled
3. **Frontend Display**: Error messages not always shown to user

## Next Steps

1. Fix OpenAI API billing/quota
2. Improve error handling and user feedback
3. Add retry mechanisms for API failures
4. Implement fallback content generation
