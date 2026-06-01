# Trend Product Tool - Development Plan

## 1. Development Strategy

最初から完成形を作らない。

MVPでは、以下の順番で小さく作る。

1. Backend CRUD
2. Frontend list/form
3. Source and keyword management
4. Manual scoring
5. Notification preparation
6. Later automation

## 2. Milestone 0 - Project Setup

Goal:

- Create repository structure
- Add backend and frontend folders
- Add basic README

Tasks:

- Create `backend/`
- Create `frontend/`
- Create `.gitignore`
- Create `README.md`
- Confirm Python and Node versions

Expected structure:

```text
trend-product-tool/
├── AGENTS.md
├── README.md
├── docs/
├── backend/
└── frontend/
```

## 3. Milestone 1 - Backend Product API

Goal:

Create FastAPI backend with SQLite.

Tasks:

- Create FastAPI app
- Create SQLite database
- Create Product model
- Create Product schema
- Create Product CRUD
- Create API routes
- Add simple health check
- Add README run command

API examples:

- `GET /health`
- `GET /products`
- `POST /products`
- `GET /products/{product_id}`
- `PUT /products/{product_id}`
- `DELETE /products/{product_id}`

Done criteria:

- Backend starts with Uvicorn
- SQLite file is created
- Product can be created using curl
- Product list can be retrieved using curl

## 4. Milestone 2 - Keyword and Source API

Goal:

Add management APIs for keywords and information sources.

Tasks:

- Create Keyword model
- Create Source model
- Create CRUD routes
- Add initial seed data for user-provided keywords
- Add source priority field
- Add active/inactive flag

API examples:

- `GET /keywords`
- `POST /keywords`
- `PUT /keywords/{keyword_id}`
- `DELETE /keywords/{keyword_id}`
- `GET /sources`
- `POST /sources`
- `PUT /sources/{source_id}`
- `DELETE /sources/{source_id}`

Done criteria:

- All initial keywords are inserted
- Sources can be manually registered
- Inactive sources can be filtered out later

## 5. Milestone 3 - Frontend Product Dashboard

Goal:

Create React dashboard.

Tasks:

- Create Vite React TypeScript app
- Create product list screen
- Create product registration form
- Connect to FastAPI
- Add basic filter by category and keyword
- Add edit/delete buttons

Screens:

- Product List
- Product Create/Edit
- Keyword List
- Source List

Done criteria:

- User can add product from browser
- User can see product list
- User can edit/delete product

## 6. Milestone 4 - Manual Trend Score

Goal:

Allow user to manually score products.

Tasks:

- Add `trend_score` field
- Add score display
- Add score filter
- Add simple label by score

Score labels:

- 80-100: High priority
- 60-79: Watch
- 40-59: Low
- 0-39: Ignore

Done criteria:

- Products can be sorted by score
- High-priority products are visually easy to identify

## 7. Milestone 5 - Notification Design

Goal:

Prepare notification structure but do not implement external API yet.

Tasks:

- Create notification log model
- Create notification log API
- Add manual notification preview

Later targets:

- Discord Webhook
- LINE Messaging API
- Email

Done criteria:

- New product can be recorded as notification log
- Notification message template exists

## 8. Milestone 6 - Allowed Collection Prototype

Goal:

Implement one allowed and simple collector.

Recommended first collector:

- RSS feed if available
- Static news page
- Manual URL parser

Tasks:

- Create `collectors/`
- Create one collector interface
- Store collected result as source log
- Avoid high-frequency crawling

Done criteria:

- One source can be fetched manually
- Result can be stored
- Duplicates are avoided

## 9. Development Rule

After every milestone:

- Run backend
- Run frontend if available
- Test API
- Update README
- Commit changes

## 10. Codex CLI Rule

When using Codex CLI:

- Ask for plan first
- Implement one milestone at a time
- Avoid large changes
- Ask Codex to show test commands
- Review diff before accepting
