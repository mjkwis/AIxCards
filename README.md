# 10x-Cards

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

10x-Cards is a web application designed to streamline the creation and management of educational flashcards. It leverages Large Language Models (LLMs) via an API to automatically generate flashcard suggestions from user-provided text, significantly reducing the time and effort required for manual creation. The core goal is to make the effective learning method of spaced repetition more accessible by simplifying the process of creating high-quality study materials.

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
    cd 10xdevs-cards
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the project root and add the necessary API keys and URLs. These are required for connecting to the backend services.

    ```env
    # Supabase Configuration
    PUBLIC_SUPABASE_URL="your_supabase_project_url"
    PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
    
    # OpenRouter Configuration
    OPENROUTER_API_KEY="your_openrouter_api_key"
    OPENROUTER_MODEL="openai/gpt-4-turbo"  # Optional, defaults to gpt-4-turbo
    
    # Site URL for OpenRouter referer tracking
    SITE="http://localhost:4321"  # Optional
    ```
    
    **OpenRouter Setup:**
    - Get an API key from [OpenRouter](https://openrouter.ai/)
    - Supported models:
      - `openai/gpt-4-turbo` (recommended)
      - `anthropic/claude-3-opus`
      - `google/gemini-pro`
      - See [OpenRouter Models](https://openrouter.ai/models) for full list

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
