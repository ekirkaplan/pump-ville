# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application called "pump-village" built with TypeScript and Tailwind CSS v4. The project appears to be a game-related application that includes tile map data (suggesting a tile-based game or map visualization).

## Development Commands

- `npm run dev --turbopack`: Start development server with Turbopack for faster builds
- `npm run build`: Build the production application
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint to check code quality

## Project Structure

- **Framework**: Next.js 15.4.6 with App Router
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 with PostCSS
- **Fonts**: Geist Sans and Geist Mono fonts from Google Fonts
- **Linting**: ESLint with Next.js configuration

## Key Files and Directories

- `src/app/`: Main application directory using Next.js App Router
  - `layout.tsx`: Root layout component with font configuration
  - `page.tsx`: Home page component (currently shows Next.js default template)
  - `globals.css`: Global styles with Tailwind imports and CSS custom properties
- `public/`: Static assets including images and a tile map JSON file
  - `map.json`: Tile map data (60x34 grid) suggesting game/map functionality
- `next.config.ts`: Next.js configuration (currently minimal)
- `tsconfig.json`: TypeScript configuration with path aliases (`@/*` → `./src/*`)
- `eslint.config.mjs`: ESLint configuration using flat config format

## Architecture Notes

- Uses Next.js App Router architecture with TypeScript
- Implements dark/light mode support via CSS custom properties and `prefers-color-scheme`
- Custom font loading with CSS variables for consistent typography
- Path aliases configured for cleaner imports (`@/` prefix for src directory)
- Tile map data suggests this may be a game or interactive map application

## Development Notes

- The project uses Turbopack in development for faster builds
- Tailwind v4 with inline theme configuration in CSS
- ESLint is configured with Next.js recommended rules
- The presence of `map.json` with tile data indicates game/mapping functionality may be added