# Test Animation

This repository contains experiments for generating animated character graphics using AI models and MCP (Model Context Protocol) servers.

## Overview

The project consists of two testing approaches for character animation generation:

### 1. `test-claude-mcp/` - Claude MCP SVG Component Generation

A testing server that uses Claude (Anthropic) to generate facial components as SVG elements from a reference image (`mario.jpg`), merge them together, and create animations. The generated SVG is then refined using the Claude Code MCP server.

**Workflow:**
1. Analyze reference image (mario.jpg)
2. Generate individual facial components as SVG
3. Merge SVG components
4. Animate the merged SVG
5. Fix/refine the SVG using Claude Code MCP

**Tech Stack:**
- TypeScript (tsx)
- Anthropic SDK
- TailwindCSS
- Serve (dev server)

**Key Files:**
- `main.ts` - Main execution script
- `assets/mario.jpg` - Reference character image
- `index.html` - Display interface

**Scripts:**
```bash
npm run exec    # Execute main TypeScript file
npm run dev     # Run dev server with style watching
npm run style   # Build Tailwind CSS
```

### 2. `test-gpt-gif/` - GPT Animation Frame Generation

Tests using OpenAI's GPT model to generate animation frames based on a given character. This approach focuses on frame-by-frame generation using GPT's vision and generation capabilities.

**Tech Stack:**
- TypeScript + Vite
- OpenAI SDK
- Anthropic SDK
- Sharp (image processing)
- Zod (validation)

**Scripts:**
```bash
npm run dev         # Start dev server on port 8080
npm run build       # Build for production
npm run test        # Run tests
npm run test:watch  # Run tests in watch mode
```

## Setup

Both projects require environment variables. Create a `.env` file in each directory:

```env
# For test-claude-mcp/
ANTHROPIC_API_KEY=your_api_key_here

# For test-gpt-gif/
OPENAI_API_KEY=your_api_key_here
ANTHROPIC_API_KEY=your_api_key_here
```

### Installation

```bash
# Install dependencies for test-claude-mcp
cd test-claude-mcp
npm install

# Install dependencies for test-gpt-gif
cd ../test-gpt-gif
npm install
```

## Usage

### Running test-claude-mcp
```bash
cd test-claude-mcp
npm run exec  # Generate and process SVG
npm run dev   # View results in browser
```

### Running test-gpt-gif
```bash
cd test-gpt-gif
npm run dev   # Start development server
```

## Purpose

This is an experimental repository for exploring different AI-driven approaches to character animation:
- **Claude MCP approach**: Component-based SVG generation and manipulation
- **GPT approach**: Frame-based animation generation

Both methods are being evaluated for their effectiveness in creating animated character graphics from static reference images.
