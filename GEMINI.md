# GEMINI Project Context

This file provides foundational mandates and context for Gemini CLI when working on this project.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Shadcn UI, TypeScript.
- **Backend**: Python 3.x, FastAPI, Pydantic, Uvicorn.

## Core Mandates

### Architecture & Design
- **Separation of Concerns**: Keep frontend (`web-interface/`) and backend (`backend/`) logic strictly separated.
- **Type Safety**: Use TypeScript for all frontend code. Use Pydantic models for all backend request/response validation.
- **Component Strategy**: Prefer Shadcn UI components located in `src/components/ui`. Customize them via Tailwind classes rather than modifying the base component unless necessary.

### Frontend (Next.js 16 & React 19)
- Use **Server Components** by default. Use `"use client"` only when interactive state or browser APIs are required.
- Follow the App Router structure in `src/app`.
- Use Tailwind CSS 4 for all styling. Avoid global CSS unless it's for base variables.

### Backend (FastAPI)
- Organize code in `backend/src`.
- Use Pydantic schemas for data validation and serialization.
- Follow RESTful API conventions.

### Quality & Standards
- **Testing**: Every new feature or bug fix must include appropriate tests (e.g., Pytest for backend, Vitest/Playwright for frontend).
- **Documentation**: Update `README.md` files in respective directories if architectural changes occur.
- **Security**: Never commit secrets. Use environment variables (`.env`) for configuration.

## Workflow
- Always verify dependencies in `package.json` or `requirements.txt` before suggesting new libraries.
- Run `npm run build` or similar validation steps before considering a frontend task complete.
- Ensure FastAPI server starts without errors after backend changes.
