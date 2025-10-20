# AIxCards

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

AIxCards is a web application designed to streamline the creation and management of educational flashcards. It leverages Large Language Models (LLMs) via an API to automatically generate flashcard suggestions from user-provided text, significantly reducing the time and effort required for manual creation. The core goal is to make the effective learning method of spaced repetition more accessible by simplifying the process of creating high-quality study materials.

## Tech Stack

The project is built with a modern, scalable, and efficient technology stack:

| Category            | Technology                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Frontend**        | **Astro 5** (with **React 19** for interactive components), **TypeScript 5**, **Tailwind 4**, **Shadcn/ui** |
| **Backend**         | **Supabase** (PostgreSQL, Authentication, BaaS)                                                             |
| **AI**              | **OpenRouter.ai** (for access to a wide range of LLM models)                                                |
| **CI/CD & Hosting** | **GitHub Actions** (CI/CD), **DigitalOcean** (Docker-based hosting)                                         |

## Getting Started Locally

To set up and run the project on your local machine, follow these steps.

### Prerequisites

- **Node.js**: **v22.14.0** (as specified in the `.nvmrc` file). We recommend using a version manager like `nvm`.
- **npm**: Comes bundled with Node.js.

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd AIxCards
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Copy the `.env.example` file to `.env` and fill in the required values:

    ```bash
    cp .env.example .env
    ```

    Then edit the `.env` file and add your actual API keys and URLs:

    ```env
    # Supabase Configuration
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
    
    # OpenRouter Configuration
    OPENROUTER_API_KEY=your_openrouter_api_key
    OPENROUTER_MODEL=openai/gpt-4o-mini  # Optional, recommended for Structured Outputs support
    
    # Site Configuration
    SITE_URL=http://localhost:3000  # For password reset redirects and OpenRouter referer tracking
    ```
    
    **How to get Supabase credentials:**
    - Go to your [Supabase Dashboard](https://app.supabase.com/)
    - Select your project
    - Go to Project Settings → API
    - Copy the `Project URL` to `SUPABASE_URL`
    - Copy the `anon public` key to `SUPABASE_KEY`
    - Copy the `service_role` key to `SUPABASE_SERVICE_ROLE_KEY` (used in dev mode)
    
    **OpenRouter Setup:**
    - Get an API key from [OpenRouter](https://openrouter.ai/)
    - Recommended models (with Structured Outputs support):
      - `openai/gpt-4o-mini` (recommended - fast and cost-effective)
      - `openai/gpt-4o` (more capable, higher quality)
      - `anthropic/claude-3-5-sonnet` (alternative option)
      - See [OpenRouter Models](https://openrouter.ai/models) for full list
    
    **Supabase Email Configuration (for Password Reset):**
    - Go to Authentication → Email Templates in Supabase Dashboard
    - Configure the "Reset Password" email template
    - Set redirect URL to: `http://localhost:3000/update-password` (dev) or `https://your-domain.com/update-password` (prod)
    - Set token expiry to 900 seconds (15 minutes)
    - **Note:** Email sending requires production Supabase configuration and won't work in local development without additional SMTP setup

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## Available Scripts

The `package.json` file includes the following scripts for managing the application:

| Script             | Description                                       |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Starts the development server with hot-reloading. |
| `npm run build`    | Builds the application for production.            |
| `npm run preview`  | Previews the production build locally.            |
| `npm run lint`     | Lints the codebase using ESLint.                  |
| `npm run lint:fix` | Automatically fixes linting issues.               |
| `npm run format`   | Formats the code using Prettier.                  |
| `npm run test`     | Runs unit and integration tests.                  |
| `npm run test:ui`  | Runs tests with Vitest UI interface.              |
| `npm run test:e2e` | Runs end-to-end tests with Playwright.            |
| `npm run test:coverage` | Generates test coverage report.              |

## Testing Password Reset Flow (Development Mode)

Since email sending requires production SMTP configuration, use the mock reset endpoint for development testing:

### Step 1: Generate Reset Link

```bash
curl -X POST http://localhost:3000/api/auth/password/mock-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Mock reset link generated (development only)",
  "resetLink": "http://localhost:3000/update-password#access_token=...",
  "instructions": "Copy the link and paste it in your browser address bar"
}
```

### Step 2: Use the Reset Link

1. Copy the `resetLink` value
2. Paste it into your browser address bar
3. You'll be redirected to `/update-password`
4. The token from URL is automatically processed by Supabase

### Step 3: Set New Password

1. Enter your new password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
2. Confirm password
3. Click "Ustaw nowe hasło"
4. You'll be logged out and redirected to `/login`

### Step 4: Login with New Password

Use your email and new password to login - it should work!

**Note:** This mock endpoint is **only available in development mode**. In production, users will receive actual password reset emails.

## Testing

The application includes comprehensive test coverage with multiple testing strategies:

### Test Types

#### Unit Tests
- **Framework:** Vitest with Testing Library
- **Coverage:** Services, validators, utilities, and algorithms
- **Target:** Minimum 80% code coverage for business logic
- **Focus Areas:**
  - Authentication service (`AuthService`)
  - Flashcard management (`FlashcardService`) 
  - Study session logic (`StudySessionService`)
  - SM-2 spaced repetition algorithm
  - Rate limiting logic
  - Zod validation schemas
  - Error handlers and utilities

#### Integration Tests
- **Framework:** Vitest with Supabase Test Client
- **Scope:** API endpoints with real database interactions
- **Mocking:** OpenRouter API calls using MSW (Mock Service Worker)
- **Coverage:**
  - Authentication flow (login, register, password reset)
  - Flashcard CRUD operations
  - AI generation requests
  - Study session management
  - Statistics aggregation
  - Middleware functionality

#### End-to-End Tests
- **Framework:** Playwright
- **Scope:** Complete user journeys and workflows
- **Key Scenarios:**
  - User registration → flashcard generation → study session
  - Password reset flow (both DEV and PROD modes)
  - Flashcard approval/rejection workflow
  - Manual flashcard creation and management
  - Study session with SM-2 algorithm
  - Statistics dashboard functionality

### Running Tests

```bash
# Run all unit and integration tests
npm run test

# Run tests with UI interface
npm run test:ui

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode (with browser UI)
npm run test:e2e:headed

# Run specific test file
npm run test -- auth.service.test.ts
```

### Test Environment Setup

#### Development Testing
- **Database:** Supabase Local (Docker)
- **AI Service:** Mocked OpenRouter responses
- **Email:** Mock reset endpoint (`/api/auth/password/mock-reset`)
- **Rate Limiting:** In-memory storage

#### CI/CD Testing
- **Database:** Supabase test instance
- **AI Service:** Test API key with limited budget
- **Email:** Disabled or test SMTP
- **Rate Limiting:** Redis test instance

### Test Coverage Goals

- **Unit Tests:** 80% code coverage for services and business logic
- **Integration Tests:** 70% coverage for API endpoints
- **E2E Tests:** 100% coverage for critical user flows
- **Performance:** API responses < 500ms (p95), AI generation < 5s (p95)
- **Security:** Zero critical vulnerabilities, all endpoints protected

### Test Data Management

The test suite uses:
- **Fixtures:** Predefined test data for consistent testing
- **Factories:** Dynamic test data generation
- **Cleanup:** Automatic test data cleanup after each test
- **Isolation:** Each test runs with isolated data to prevent interference

### Testing Strategy

#### Critical Test Scenarios

**Authentication & Security:**
- User registration and login flows
- Password reset (both DEV mock and PROD email flows)
- JWT token validation and expiration
- Rate limiting protection (login attempts, AI generation)
- Row Level Security (RLS) policies enforcement
- Input validation and sanitization

**AI-Powered Features:**
- Flashcard generation from text input (1,000-10,000 characters)
- OpenRouter API integration and error handling
- Generation request tracking and status management
- Batch approval/rejection of AI-generated flashcards

**Study System:**
- SM-2 spaced repetition algorithm implementation
- Study session management and progress tracking
- Flashcard review and quality rating (0-5 scale)
- Interval calculation and next review scheduling
- Session summary and statistics

**Data Management:**
- CRUD operations for flashcards
- User data isolation and privacy
- Database migrations and schema validation
- Backup and recovery procedures

#### Test Automation Pipeline

The CI/CD pipeline automatically runs:
1. **Linting and formatting** checks
2. **Unit tests** with coverage reporting
3. **Integration tests** with test database
4. **E2E tests** across multiple browsers
5. **Security scans** for vulnerabilities
6. **Performance tests** for critical endpoints
7. **Accessibility audits** for WCAG compliance

#### Quality Gates

Before deployment, the following criteria must be met:
- ✅ All critical and high-priority tests pass (100%)
- ✅ Unit test coverage ≥ 80% for business logic
- ✅ Integration test coverage ≥ 70% for API endpoints
- ✅ Zero critical security vulnerabilities
- ✅ Performance benchmarks met (API < 500ms, Page load < 3s)
- ✅ Accessibility score ≥ 90/100

## Project Scope

### Key Features

- **AI-Powered Flashcard Generation**: Users can paste text (1,000-10,000 characters) to automatically generate flashcard suggestions.
- **Manual Flashcard Management**: Full CRUD (Create, Read, Update, Delete) functionality for flashcards.
- **User Authentication**: Secure user registration and login system to manage personal flashcard decks.
- **Spaced Repetition Learning**: An integrated learning session view powered by a spaced repetition algorithm to help users study effectively.
- **Data Privacy**: User data and flashcards are kept private and secure, accessible only to the owner.

### Out of Scope (MVP)

The following features are not planned for the initial release:

- Advanced or custom-built spaced repetition algorithms.
- Gamification elements.
- Native mobile applications.
- Importing from various document formats (e.g., PDF, DOCX).
- A public API for third-party integrations.
- Sharing flashcard decks between users.
- Advanced notification systems or keyword search.

## Project Status

**In Development**

The project is currently under active development. The core features outlined in the project scope are being implemented based on the user stories defined in the Product Requirements Document (PRD).

## License

This project is licensed under the **MIT License**.
