# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Learning Management System (LMS)** with a Django REST API backend and Next.js frontend.

- **Backend**: Django 6.0 + Django REST Framework + PostgreSQL
- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4

## Before Starting Any Task

1. Read specs/\_overview.md
2. Read specs/\_conventions.md
3. Read specs/features/[relevant-feature]/spec.md
4. Read specs/features/[relevant-feature]/tasks.md
5. Read specs/features/[relevant-feature]/plan.md
6. Read specs/features/[relevant-feature]/data-model.md
7. If spec doesn't exist, stop and ask me to create it first

## Hard Rules

- Never modify existing migrations, create new ones only
- Never implement a feature without a spec in specs/features/
- Never assume — if something is unclear, ask before writing code
- One feature at a time, wait for my approval before moving to the next

## API & Response Standards

- All responses must follow this structure:
  { "data": {}, "status": 200 }
- All errors must return a meaningful message in "error"
- Never return raw exceptions or stack traces to the client
