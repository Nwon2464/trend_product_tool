# AGENTS.md

## Project Overview

This repository is for developing a local MVP of a trend product information collection tool.

The service collects and manages information about trending, limited-edition, restocked, collaboration, and discontinued products in Japan.

The first goal is not automatic purchasing.
The first goal is an information research dashboard that helps users discover product opportunities quickly.

## Important Documents

Before writing or modifying code, always read these documents:

- `docs/requirements.md`
- `docs/data_sources.md`
- `docs/development_plan.md`
- `docs/database_design.md`
- `docs/api_design.md`
- `docs/ui_design.md`

## Target Product Keywords

The MVP must include the following keywords and categories:

- 話題の商品
- ポケモンカード
- ワンピースカード
- アニメ系ガチャ
- ボンボンドロップシール
- ちいかわ系グッズ
- サンリオ系グッズ
- ポケモン系グッズ
- スタバ コラボ商品
- スタバ 季節限定商品
- アパレルコラボ商品
- 有名メーカーのお菓子の廃盤商品

## Development Policy

Start small and build the MVP step by step.

Do not implement the following features:

- Automatic purchasing
- Checkout bot
- CAPTCHA bypass
- Login bypass
- Bot-like reservation automation
- Excessive scraping
- Any feature that violates website terms of service

The first version should focus on:

- Manual product registration
- Product list API
- Keyword management
- Source URL management
- SQLite database
- Simple React dashboard
- Local development environment

## Tech Stack

Backend:

- Python
- FastAPI
- SQLite
- SQLAlchemy or SQLModel
- Pydantic
- Uvicorn

Frontend:

- React
- TypeScript
- Vite
- CSS or simple component styling

Optional later:

- Playwright
- BeautifulSoup
- APScheduler
- Discord Webhook
- LINE Messaging API

## Coding Rules

- Keep the implementation simple.
- Prefer small, readable files.
- Do not over-engineer the MVP.
- Add README instructions.
- Add basic validation and error handling.
- Use clear naming.
- Do not add scraping until CRUD is working.
- Do not add SNS integration until the basic dashboard is working.
- Use local SQLite first.

## First Milestone

Build a local MVP with:

1. FastAPI backend
2. SQLite database
3. Product CRUD API
4. Keyword CRUD API
5. Source management
6. React product list screen
7. React product registration form
8. README with setup and run instructions

## Recommended First Prompt for Codex CLI

Read all project documents first.
Do not implement anything until you summarize the MVP scope and propose a small development plan.
