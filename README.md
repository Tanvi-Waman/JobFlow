# JobFlow

JobFlow is a distributed job processing platform built to demonstrate
asynchronous processing, job queues, worker coordination, reliability,
monitoring, and scalable backend architecture.

## Tech Stack

- React
- Node.js
- Express
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Socket.IO
- Docker

## Architecture

Client
→ API
→ Redis Queue
→ Workers
→ PostgreSQL

## Features

- Job creation
- Background processing
- Multiple workers
- Priority queues
- Retry mechanism
- Exponential backoff
- Dead-letter queue
- Scheduled jobs
- Worker monitoring
- Rate limiting
- Distributed locking
- Real-time monitoring
