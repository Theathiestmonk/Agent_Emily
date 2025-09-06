# Emily - Digital Marketing Agent

Emily is an AI-powered digital marketing agent built with modern web technologies.

## Tech Stack

- **Frontend**: React + Vite (deployed on Vercel)
- **Backend**: Python + FastAPI (deployed on Render)
- **Database**: Supabase
- **AI Framework**: LangGraph (latest version)
- **LLM**: OpenAI for content generation

## Project Structure

```
Emily1.0/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts (Auth)
│   │   └── services/      # API services
│   ├── package.json
│   └── vite.config.js
├── backend/               # FastAPI backend
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── database/             # Database schema and files
│   ├── schema.sql        # Supabase schema
│   └── README.md         # Database documentation
└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Supabase account

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp ../env.example .env
```

4. Update `.env` with your API URL:
```
VITE_API_URL=http://localhost:8000
```

5. Start development server:
```bash
npm run dev
```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp env.example .env
```

5. Update `.env` with your Supabase credentials:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SECRET_KEY=your_jwt_secret_key
```

6. Start development server:
```bash
python main.py
```

### Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `database/schema.sql`
3. Update your backend `.env` with Supabase credentials

## Features

- ✅ User authentication (login/register)
- ✅ Modern, responsive UI
- ✅ JWT-based authentication
- ✅ Protected routes
- ✅ Supabase integration

## Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variable `VITE_API_URL` to your backend URL
3. Deploy

### Backend (Render)
1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy

## Next Steps

This is Step 1 of the Emily project. Future steps will include:
- LangGraph integration
- OpenAI API integration
- Digital marketing features
- Content generation capabilities

## License

MIT License
