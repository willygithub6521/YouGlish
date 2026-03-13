# YouTube Pronunciation Search Platform

A YouTube pronunciation search platform similar to YouGlish for English language learning. Users can search for English words or phrases and find pronunciation examples from real YouTube videos with accent filtering and continuous playback features.

## Features

- 🔍 **Smart Search**: Search for English words and phrases with fuzzy matching
- 🎯 **Accent Filtering**: Filter by US, UK, Australian, Canadian, and other English accents
- 🎥 **Video Integration**: Embedded YouTube player with automatic timestamp jumping
- 📝 **Subtitle Display**: Highlighted search terms with context sentences
- ⏭️ **Continuous Playback**: Auto-play next pronunciation example
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- YouTube IFrame Player API
- Vite for build tooling

### Backend
- Node.js 18+ with Express
- TypeScript
- RESTful API design
- Winston for logging

### Database & Search
- PostgreSQL for structured data
- Elasticsearch for full-text search
- Redis for caching

### External APIs
- YouTube Data API v3
- YouTube Transcript API

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- YouTube Data API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd youtube-pronunciation-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```
   
   Edit the `.env` files and add your YouTube API key and other configuration.

4. **Start the database services**
   ```bash
   npm run docker:up
   ```

5. **Run database migrations** (when implemented)
   ```bash
   npm run db:migrate --workspace=backend
   ```

6. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

### Available Scripts

#### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run tests for both frontend and backend
- `npm run lint` - Lint both frontend and backend code
- `npm run docker:up` - Start database services with Docker Compose
- `npm run docker:down` - Stop database services

#### Frontend
- `npm run dev --workspace=frontend` - Start frontend development server
- `npm run build --workspace=frontend` - Build frontend for production
- `npm run test --workspace=frontend` - Run frontend tests
- `npm run lint --workspace=frontend` - Lint frontend code

#### Backend
- `npm run dev --workspace=backend` - Start backend development server
- `npm run build --workspace=backend` - Build backend for production
- `npm run test --workspace=backend` - Run backend tests
- `npm run lint --workspace=backend` - Lint backend code

## Project Structure

```
youtube-pronunciation-search/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── test/           # Test setup and utilities
│   ├── public/             # Static assets
│   └── package.json
├── backend/                  # Node.js backend application
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── services/       # Business logic services
│   │   ├── models/         # Data models
│   │   ├── middleware/     # Express middleware
│   │   ├── config/         # Configuration files
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── test/           # Test setup and utilities
│   └── package.json
├── docker-compose.yml        # Database services configuration
├── .env.example             # Environment variables template
└── package.json             # Root package.json for workspace management
```

## API Documentation

### Search Endpoint
```
GET /api/search?q={query}&accent={accent}&fuzzy={boolean}&limit={number}&offset={number}
```

### Video Metadata Endpoint
```
GET /api/videos/{videoId}
```

### Health Check
```
GET /health
```

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features

### Testing
- Write unit tests for components and services
- Use React Testing Library for frontend tests
- Use Jest for both frontend and backend testing
- Maintain test coverage above 70%

### Performance
- Search response time < 2 seconds
- Video loading time < 3 seconds
- Support for 1000+ concurrent users

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by YouGlish for the concept
- YouTube for providing the video content and APIs
- The open-source community for the amazing tools and libraries