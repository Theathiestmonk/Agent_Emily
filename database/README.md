# Database Schema

This folder contains the database schema and related files for Emily.

## Files

- `schema.sql` - Main database schema with user table and security policies

## Setup

1. Create a new Supabase project
2. Run the SQL commands from `schema.sql` in your Supabase SQL editor
3. Update your backend environment variables with Supabase credentials

## Schema Overview

### Users Table
- `id` - UUID primary key
- `email` - Unique email address
- `name` - User's full name
- `password_hash` - Bcrypt hashed password
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

### Security
- Row Level Security (RLS) enabled
- Users can only access their own data
- Automatic timestamp updates via triggers

