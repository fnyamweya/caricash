# ADR-001: No ORM - Direct SQL with node-postgres

## Status
Accepted

## Context
Financial systems require precise control over database transactions, isolation levels, and query execution. ORMs abstract away these details, which can lead to:
- Unexpected query patterns (N+1, lazy loading)
- Loss of control over transaction boundaries
- Difficulty implementing advisory locks
- Hidden mutations that violate immutability requirements

## Decision
Use node-postgres (pg) directly with:
- Parameterized queries (prepared statements)
- Explicit transaction management with configurable isolation levels
- Repository pattern for all database access
- No query builders or ORMs

## Consequences
- More verbose code for basic CRUD
- Full control over every SQL statement
- Easier to audit for security (SQL injection prevention)
- Explicit transaction boundaries for financial operations
- Team must be proficient in SQL
