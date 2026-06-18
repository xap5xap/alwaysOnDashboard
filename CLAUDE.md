# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**alwaysOnDashboard** is a mobile app for Xavier to monitor two things at a glance:

1. **Linear todos** — tasks and issues from his Linear workspace
2. **Claude usage** — Anthropic API usage metrics and spend

## Key Integrations

- **Linear API** — fetch issues/todos via the Linear GraphQL API (MCP server also available in this environment via `mcp__linear__*` tools)
- **Anthropic API** — fetch usage data (tokens, cost) via the Anthropic usage endpoints

## Stack (to be decided)

This project has not been scaffolded yet. Likely candidates: React Native (Expo), or a lightweight web app treated as a mobile PWA.

Once the stack is chosen, add build/run/test commands here.
