# AI Interview Assistant Backend

A backend system for an AI-powered interview assistant that conducts timed technical interviews and provides an interviewer dashboard.

## Features

- Candidate management with resume parsing
- AI-powered interview question generation and scoring
- Timed interview sessions with pause/resume functionality
- Comprehensive dashboard for interviewers
- Mock and real LLM integration options

## Tech Stack

- **Node.js & Express.js**: Backend framework
- **MongoDB & Mongoose**: Database
- **Multer**: File upload handling
- **pdf-parse & mammoth**: Resume parsing
- **Jest**: Testing framework

## Setup & Installation

### Prerequisites

- Node.js (v14+ recommended)
- MongoDB (running locally or accessible instance)
- (Optional) OpenAI API key for real LLM mode

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file using the `.env.example` template:
   ```
   cp .env.example .env
   ```
4. Edit `.env` to configure your environment

### Running the Application

Development mode:
```
npm run dev
```

Production mode:
```
npm start
```

### Running Tests

```
npm test
```

## LLM Modes

### Mock Mode

The application supports a "mock" mode for the LLM functionality, which doesn't require an external API key. This is useful for:

- Development and testing
- Environments without internet access
- Avoiding API costs

To enable mock mode:
```
LLM_MODE=mock
```

### Real LLM Mode

For production or when you want actual AI-generated questions and evaluations:

1. Get an API key from OpenAI or compatible provider
2. Configure the `.env` file:
   ```
   LLM_MODE=real
   LLM_API_KEY=your_api_key_here
   LLM_API_URL=https://api.openai.com/v1/chat/completions
   LLM_MODEL=gpt-4
   ```

## API Documentation

### Candidates

#### Create new candidate
- **URL:** `POST /api/candidates`
- **Content-Type:** `multipart/form-data`
- **Body:** `resume` (file: PDF or DOCX)
- **Response:** Candidate object with extracted fields and missing fields list
- **Example:**
  ```bash
  curl -X POST http://localhost:8000/api/candidates \
    -H "Content-Type: multipart/form-data" \
    -F "resume=@/path/to/resume.pdf"
  ```

#### Update candidate fields
- **URL:** `PATCH /api/candidates/:id/fields`
- **Content-Type:** `application/json`
- **Body:** `{ name?, email?, phone? }`
- **Response:** Updated candidate object
- **Example:**
  ```bash
  curl -X PATCH http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85/fields \
    -H "Content-Type: application/json" \
    -d '{"name":"John Smith","email":"john@example.com"}'
  ```

#### Start interview
- **URL:** `POST /api/candidates/:id/start`
- **Response:** First question and interview status
- **Example:**
  ```bash
  curl -X POST http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85/start
  ```

#### Submit answer
- **URL:** `POST /api/candidates/:id/answer`
- **Content-Type:** `application/json`
- **Body:** `{ answer: string, timeTakenSec: number, autoSubmitted: boolean }`
- **Response:** Feedback on current answer and next question (if not the last)
- **Example:**
  ```bash
  curl -X POST http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85/answer \
    -H "Content-Type: application/json" \
    -d '{"answer":"My answer to the question","timeTakenSec":45,"autoSubmitted":false}'
  ```

#### Pause interview
- **URL:** `POST /api/candidates/:id/pause`
- **Content-Type:** `application/json`
- **Body:** `{ remainingTimeSec: number }`
- **Response:** Status confirmation
- **Example:**
  ```bash
  curl -X POST http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85/pause \
    -H "Content-Type: application/json" \
    -d '{"remainingTimeSec":30}'
  ```

#### Resume interview
- **URL:** `POST /api/candidates/:id/resume`
- **Response:** Current question and remaining time
- **Example:**
  ```bash
  curl -X POST http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85/resume
  ```

#### List candidates
- **URL:** `GET /api/candidates`
- **Query Parameters:** `page, limit, sort, order, search`
- **Response:** List of candidates with pagination
- **Example:**
  ```bash
  curl "http://localhost:8000/api/candidates?page=1&limit=10&sort=createdAt&order=desc&search=John"
  ```

#### Get candidate details
- **URL:** `GET /api/candidates/:id`
- **Response:** Complete candidate data
- **Example:**
  ```bash
  curl http://localhost:8000/api/candidates/60d21b4667d0d8992e610c85
  ```

#### Health check
- **URL:** `GET /api/health`
- **Response:** Service status
- **Example:**
  ```bash
  curl http://localhost:8000/api/health
  ```

## Data Models

### Candidate Schema

- `name`: Candidate's full name
- `email`: Contact email
- `phone`: Phone number
- `resumeFile`: Object containing resume metadata
  - `path`: File system path
  - `originalName`: Original filename
  - `mimeType`: File MIME type
  - `size`: File size in bytes
  - `extractedText`: Text extracted from resume
- `status`: Interview status ('not_started', 'in_progress', 'paused', 'completed')
- `currentQuestionIndex`: Index of current question (0-5)
- `remainingTimeSec`: Time remaining on current question
- `pausedAt`: Timestamp when interview was paused
- `questions`: Array of question objects
  - `qText`: Question text
  - `difficulty`: 'easy', 'medium', or 'hard'
  - `timeAllowedSec`: Time allowed for this question
  - `answer`: Candidate's answer
  - `answeredAt`: Timestamp when answered
  - `timeTakenSec`: Actual time taken to answer
  - `autoSubmitted`: Whether answer was auto-submitted due to time expiration
  - `score`: Score (0-100)
  - `breakdown`: Object with clarity, correctness, and depth scores
  - `feedback`: Feedback text
- `finalScore`: Average of question scores
- `summary`: Final interview summary
- `missingFields`: Array of fields that couldn't be extracted from resume

## Project Structure

```
/backend
├── /src
│   ├── /config
│   │   └── db.js               # Database configuration
│   ├── /models
│   │   └── Candidate.js        # Mongoose schema definition
│   ├── /routes
│   │   └── candidateRoutes.js  # API route handlers
│   ├── /utils
│   │   ├── resumeParser.js     # Resume parsing utilities
│   │   └── llmWrapper.js       # LLM integration
│   ├── /tests
│   │   ├── /fixtures           # Test files
│   │   ├── resumeParser.test.js
│   │   └── candidateRoutes.test.js
│   ├── app.js                  # Express application
│   └── server.js               # Entry point
├── .env.example                # Environment variables template
├── package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run tests: `npm test`
6. Submit a pull request

## License

[MIT](LICENSE)
