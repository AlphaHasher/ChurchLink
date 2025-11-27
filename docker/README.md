# ChurchLink Docker Guide

## Quick Start

### Development (Local Code + MongoDB in Docker)

1. **Start MongoDB:**
   ```bash
   cd docker
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Run your existing dev scripts:**
   ```bash
   # From project root
   # Windows
   run_all_dev.bat

   # Linux/Mac
   ./run_all_dev.sh
   ```

3. **Access:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

4. **Stop MongoDB:**
   ```bash
   cd docker
   docker-compose -f docker-compose.dev.yml down
   ```

---

### Production (Everything in Docker)

1. **Setup environment:**
   ```bash
   # Make sure backend/.env exists with your settings
   # Note: MONGODB_URL is automatically overridden to "mongodb:27017" by docker-compose
   cd backend
   cp .env.example .env
   # Edit .env with your values (Firebase, PayPal, etc.)
   cd ../docker
   ```

2. **Build and start:**
   ```bash
   docker-compose up -d --build
   ```

3. **Access:**
   - Application: http://localhost:8000

4. **View logs:**
   ```bash
   docker-compose logs -f backend
   ```

5. **Stop:**
   ```bash
   docker-compose down
   ```

---

## Commands Reference

All commands should be run from the `docker/` directory:

```bash
cd docker

# Development
docker-compose -f docker-compose.dev.yml up -d     # Start MongoDB
docker-compose -f docker-compose.dev.yml down      # Stop MongoDB

# Production
docker-compose up -d --build                       # Build and start
docker-compose down                                # Stop
docker-compose logs -f backend                     # View logs
docker-compose restart backend                     # Restart backend
docker-compose ps                                  # Check status

# Cleanup
docker-compose down -v                             # Stop and remove volumes
docker system prune -a                             # Clean all Docker cache
```

---

## Troubleshooting

**Build fails:**
- Check Node.js version (requires Node 20+)
- Ensure frontend dependencies are correct: `cd frontend/web/churchlink && pnpm install`

**Backend won't start:**
- Verify MongoDB is running: `docker-compose ps`
- Check environment variables in `backend/.env`
- View logs: `docker-compose logs backend`

**Port conflicts:**
- MongoDB (27017) or Backend (8000) already in use
- Stop other services or change ports in docker-compose.yml

**Firebase/PayPal errors:**
- Ensure `backend/firebase/firebase_credentials.json` exists
- Fill in all required keys in `backend/.env` (FIREBASE_WEB_API_KEY, PAYPAL credentials)
