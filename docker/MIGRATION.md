# One-Time MongoDB Migration Guide

Since I Had To Copy Over Data From Existing MongDB Continer To This New One

## Current Situation
You have an existing MongoDB Docker container running on port 27017 with production data.

## Migration Steps

### Step 1: Backup Your Current MongoDB Data

**PowerShell (Windows):**
```powershell
# Find your existing MongoDB container name
docker ps | findstr mongo

# Create a backup directory
mkdir mongodb_backup
cd mongodb_backup

# Backup all databases (replace 'mongodb' with your actual container name if different)
docker exec mongodb mongodump --out=/dump

# Copy the backup from container to your local machine
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mongodb:/dump "./mongodb_backup_$timestamp"

# Verify backup was created
dir mongodb_backup_*
```

**Alternative - Export to archive (RECOMMENDED):**
```powershell
# Single archive file (easier to manage)
docker exec mongodb mongodump --archive=/dump/churchlink_backup.archive --gzip

# Copy to local machine with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mongodb:/dump/churchlink_backup.archive "./churchlink_backup_$timestamp.archive.gz"
```

**Bash (Linux/Mac):**
```bash
# Archive method
docker exec mongodb mongodump --archive=/dump/churchlink_backup.archive --gzip
docker cp mongodb:/dump/churchlink_backup.archive ./churchlink_backup_$(date +%Y%m%d_%H%M%S).archive.gz
```

---

### Step 2: Stop and Remove Old MongoDB Container

```bash
# Stop the existing container
docker stop mongodb

# Remove the container (data is backed up!)
docker rm mongodb

# Optional: Remove the old volume if you want to start fresh
docker volume ls
docker volume rm <old_volume_name>  # Only if you're sure backup is good!
```

---

### Step 3: Start New Docker Setup

```bash
# Go to docker directory
cd docker

# Start new MongoDB with docker-compose
docker-compose -f docker-compose.dev.yml up -d

# Verify it's running
docker-compose -f docker-compose.dev.yml ps
```

---

### Step 4: Restore Your Data to New Container

```bash
# Copy backup into new container
docker cp ./mongodb_backup_XXXXXX/dump churchlink-mongodb-dev:/dump

# Restore the data
docker exec churchlink-mongodb-dev mongorestore /dump

# Clean up backup inside container
docker exec churchlink-mongodb-dev rm -rf /dump
```

**If you used archive format:**
```bash
# Copy archive to container
docker cp ./churchlink_backup_XXXXXX.archive.gz churchlink-mongodb-dev:/backup.archive.gz

# Restore from archive
docker exec churchlink-mongodb-dev mongorestore --archive=/backup.archive.gz --gzip

# Clean up
docker exec churchlink-mongodb-dev rm /backup.archive.gz
```

---

### Step 5: Verify Everything Works

```bash
# Connect to MongoDB and check databases
docker exec -it churchlink-mongodb-dev mongosh

# Inside mongosh:
show dbs
use your_database_name
show collections
db.your_collection.countDocuments()  # Verify data exists
exit
```

---

## Quick Commands Reference

**PowerShell (Windows):**
```powershell
# 1. Backup existing data
docker exec mongodb mongodump --archive=/dump/backup.archive --gzip
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mongodb:/dump/backup.archive "./churchlink_backup_$timestamp.archive.gz"

# 2. Stop old container
docker stop mongodb
docker rm mongodb

# 3. Start new setup
cd docker
docker-compose -f docker-compose.dev.yml up -d

# 4. Restore data (replace XXXXXX with your timestamp)
docker cp ./churchlink_backup_XXXXXX.archive.gz churchlink-mongodb-dev:/backup.archive.gz
docker exec churchlink-mongodb-dev mongorestore --archive=/backup.archive.gz --gzip

# 5. Test your app
cd ..
run_all_dev.bat
```

**Bash (Linux/Mac):**
```bash
# 1. Backup existing data
docker exec mongodb mongodump --archive=/dump/backup.archive --gzip
docker cp mongodb:/dump/backup.archive ./churchlink_backup.archive.gz

# 2. Stop old container
docker stop mongodb && docker rm mongodb

# 3. Start new setup
cd docker && docker-compose -f docker-compose.dev.yml up -d

# 4. Restore data
docker cp ./churchlink_backup.archive.gz churchlink-mongodb-dev:/backup.archive.gz
docker exec churchlink-mongodb-dev mongorestore --archive=/backup.archive.gz --gzip

# 5. Test your app
cd .. && run_all_dev.bat
```

---

## Rollback (If Something Goes Wrong)

```bash
# Stop new setup
cd docker
docker-compose -f docker-compose.dev.yml down

# Restart your old container
docker start mongodb

# Your data is safe!
```

---

## Notes

- **Keep your backup!** Don't delete it until you're 100% sure the new setup works
- The new container name is `churchlink-mongodb-dev` (for development)
- For production deployment, the container will be `churchlink-mongodb`
- Your backup is a full copy - you can restore it anytime
