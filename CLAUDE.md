# Claude Configuration for Magic English Web App

## Project Overview

Magic English is an AI-powered vocabulary learning web application built with:

- **Backend**: Node.js + Express.js with Supabase integration
- **Frontend**: React + Vite with Tailwind CSS
- **Database**: PostgreSQL via Supabase
- **AI Integration**: Multiple providers (Ollama Cloud, OpenAI, Local Ollama)

## Architecture Summary

### Backend Structure

- [backend/src/server.js](backend/src/server.js) - Main Express server with middleware setup
- [backend/src/routes/](backend/src/routes/) - API routes (words, users, ai, profile)
- [backend/src/services/](backend/src/services/) - Business logic (AI service)
- [backend/src/middleware/](backend/src/middleware/) - Auth and error handling
- [backend/src/config/](backend/src/config/) - Supabase configuration

### Frontend Structure

- [frontend/src/App.jsx](frontend/src/App.jsx) - Main React app with routing
- [frontend/src/pages/](frontend/src/pages/) - Page components
- [frontend/src/components/](frontend/src/components/) - Reusable UI components
- [frontend/src/contexts/](frontend/src/contexts/) - React contexts (Auth, Theme)
- [frontend/src/lib/](frontend/src/lib/) - Utilities and API client

## Security Considerations

- Rate limiting configured (1000 requests per 15 minutes)
- Helmet.js for security headers
- CORS properly configured
- Supabase handles authentication and authorization
- No API keys or secrets stored in frontend code

## Development Guidelines

- Use context7 mcp as much as possible for enhanced functionality and capabilities
- Ask clarifying questions before implementing features to ensure requirements are fully understood
