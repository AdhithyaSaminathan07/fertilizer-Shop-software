# KASI Agri Agencies Management System

Enterprise Agri-business Management Platform built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB, Mongoose, and Zod.

## Phase 1 Architecture Overview

This project implements clean separation of concerns:
- **Presentation Layer (`src/app/`)**: Next.js App Router for server and client components, layouts, and API endpoints.
- **Data Access Layer (`src/lib/db/`, `src/models/`)**: Cached Mongoose connection singleton with connection pool management and lifecycle hooks.
- **Validation Layer (`src/validations/`, `src/lib/env.ts`)**: Type-safe runtime schemas with Zod.
- **Service Layer (`src/services/`)**: Isolated business domain services (Phase 2+).
- **Design System (`src/components/ui/`, `src/lib/utils.ts`)**: Tailwind CSS v4 design tokens and utility primitives.

## Scripts

- `npm run dev`: Start local Next.js development server
- `npm run build`: Production build with static optimization
- `npm run start`: Start production server
- `npm run lint`: Run ESLint static analysis
- `npm run typecheck`: Run TypeScript compiler typecheck (`tsc --noEmit`)

## Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure `MONGODB_URI` with your connection string. Runtime database connections will fail gracefully if unreachable without exposing credentials.

