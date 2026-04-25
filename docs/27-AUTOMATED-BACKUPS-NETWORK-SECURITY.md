# 🔐 27 — Automated Backups + Network Security Guidelines

**Purpose:** Implement weekly automated Hetzner VPS snapshots, automated MongoDB backup every 15 days to Cloudflare R2, and comprehensive network security hardening for the entire CIP-2026 stack.

**When to implement:** Day 0 setup + Sprint 1 Week 1.
**Last reviewed:** April 23, 2026

---

## Part A — Automated Weekly Hetzner VPS Snapshots

### A.1 How Hetzner Snapshots Work

- A snapshot is a complete disk image of your VPS at that point in time
- From a snapshot you can spin up a brand new identical server in ~5 minutes
- Hetzner charges **€0.0119/GB/month** for snapshot storage
- CX22 server has a 40GB disk → full snapshot costs approximately **~$0.50/month** per snapshot
- **Weekly schedule (4 snapshots kept) = ~$2/month total** — much cheaper than daily
- Hetzner keeps snapshots until you delete them — no automatic expiry unless you set it

### A.2 Hetzner API Token Setup

First, create an API token for automation:

```bash
# 1. Log in to Hetzner Cloud Console: console.hetzner.cloud
# 2. Select your project → Security → API Tokens → Generate API Token
# 3. Name: cip-snapshot-automation
# 4. Permissions: Read & Write
# 5. Copy the token — you only see it once
```

Save the token in your password manager. You will also add it to Hetzner server as an env var.

### A.3 Install the Snapshot Script on Hetzner

SSH into your Hetzner server and run all of the following:

```bash
ssh deploy@YOUR_SERVER_IP

# Create the scripts directory
mkdir -p /home/deploy/scripts
cd /home/deploy/scripts
```

Create the snapshot script:

```bash
cat > /home/deploy/scripts/snapshot.sh << 'SCRIPT'
#!/bin/bash
# ─────────────────────────────────────────────────────────────
# CIP-2026 Weekly Hetzner Snapshot Script
# Runs via cron every Sunday at 2:00 AM UTC
# Keeps last 4 weekly snapshots, deletes older ones
# Cost: ~$2/month total (4 snapshots × $0.50)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

HCLOUD_TOKEN="${HCLOUD_TOKEN}"
SERVER_NAME="cip-worker-01"                    # Your Hetzner server name
KEEP_SNAPSHOTS=4                               # Keep 4 weekly snapshots (~28 days)
LOG_FILE="/home/deploy/logs/snapshot.log"
ALERT_URL="${ALERT_WEBHOOK_URL:-}"             # Optional: webhook alert URL

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
  local status="$1"
  local message="$2"
  if [ -n "$ALERT_URL" ]; then
    curl -s -X POST "$ALERT_URL" \
      -H "Content-Type: application/json" \
      -d "{\"status\": \"$status\", \"message\": \"$message\", \"server\": \"$SERVER_NAME\"}" \
      > /dev/null 2>&1 || true
  fi
}

log "=== Starting daily snapshot ==="

# ── 1. Get server ID ──────────────────────────────────────
SERVER_ID=$(curl -s \
  -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?name=$SERVER_NAME" \
  | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$SERVER_ID" ]; then
  log "ERROR: Could not find server '$SERVER_NAME'"
  send_alert "error" "Snapshot failed: server $SERVER_NAME not found"
  exit 1
fi

log "Server ID: $SERVER_ID"

# ── 2. Create snapshot ────────────────────────────────────
SNAPSHOT_LABEL="weekly-$(date -u '+%Y%m%d-%H%M')"
log "Creating snapshot: $SNAPSHOT_LABEL"

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $HCLOUD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"description\": \"$SNAPSHOT_LABEL\", \"type\": \"snapshot\", \"labels\": {\"type\": \"weekly\", \"server\": \"$SERVER_NAME\", \"date\": \"$(date -u '+%Y-%m-%d')\"}}" \
  "https://api.hetzner.cloud/v1/servers/$SERVER_ID/actions/create_image")

SNAPSHOT_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
ACTION_ID=$(echo "$RESPONSE" | grep -o '"action":{[^}]*"id":[0-9]*' | grep -o '[0-9]*$')

if [ -z "$SNAPSHOT_ID" ]; then
  log "ERROR: Failed to create snapshot. Response: $RESPONSE"
  send_alert "error" "Snapshot creation failed for $SERVER_NAME"
  exit 1
fi

log "Snapshot created. ID: $SNAPSHOT_ID"

# ── 3. Wait for snapshot to complete (poll up to 10 min) ──
log "Waiting for snapshot to complete..."
MAX_WAIT=600
WAITED=0
SLEEP_INTERVAL=15

while [ $WAITED -lt $MAX_WAIT ]; do
  STATUS=$(curl -s \
    -H "Authorization: Bearer $HCLOUD_TOKEN" \
    "https://api.hetzner.cloud/v1/images/$SNAPSHOT_ID" \
    | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$STATUS" = "available" ]; then
    log "Snapshot complete. Status: $STATUS"
    break
  fi

  log "Snapshot status: $STATUS (waited ${WAITED}s)"
  sleep $SLEEP_INTERVAL
  WAITED=$((WAITED + SLEEP_INTERVAL))
done

if [ "$STATUS" != "available" ]; then
  log "ERROR: Snapshot did not complete within ${MAX_WAIT}s. Last status: $STATUS"
  send_alert "error" "Snapshot timed out for $SERVER_NAME"
  exit 1
fi

# ── 4. Get all daily snapshots, sorted by creation time ───
log "Fetching all daily snapshots for cleanup..."

ALL_SNAPSHOTS=$(curl -s \
  -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/images?type=snapshot&label_selector=type%3Dweekly,server%3D$SERVER_NAME" \
  | grep -o '"id":[0-9]*' | cut -d: -f2 | sort -n)

SNAPSHOT_COUNT=$(echo "$ALL_SNAPSHOTS" | wc -l | tr -d ' ')
log "Total weekly snapshots found: $SNAPSHOT_COUNT (keeping $KEEP_SNAPSHOTS)"

# ── 5. Delete oldest snapshots if over limit ──────────────
if [ "$SNAPSHOT_COUNT" -gt "$KEEP_SNAPSHOTS" ]; then
  DELETE_COUNT=$((SNAPSHOT_COUNT - KEEP_SNAPSHOTS))
  TO_DELETE=$(echo "$ALL_SNAPSHOTS" | head -n "$DELETE_COUNT")

  for OLD_ID in $TO_DELETE; do
    log "Deleting old snapshot ID: $OLD_ID"
    DELETE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
      -H "Authorization: Bearer $HCLOUD_TOKEN" \
      "https://api.hetzner.cloud/v1/images/$OLD_ID")

    if [ "$DELETE_RESPONSE" = "204" ]; then
      log "Deleted snapshot $OLD_ID"
    else
      log "Warning: Could not delete snapshot $OLD_ID (HTTP $DELETE_RESPONSE)"
    fi
  done
fi

# ── 6. Log success ────────────────────────────────────────
log "=== Snapshot complete: ID=$SNAPSHOT_ID label=$SNAPSHOT_LABEL ==="
send_alert "success" "Weekly snapshot $SNAPSHOT_LABEL created successfully (ID: $SNAPSHOT_ID)"
SCRIPT

# Make executable
chmod +x /home/deploy/scripts/snapshot.sh
```

### A.4 Configure Environment Variables for the Script

```bash
# Add to deploy user's environment
cat >> /home/deploy/.bashrc << 'ENV'

# Hetzner snapshot automation
export HCLOUD_TOKEN="your_hetzner_api_token_here"
export ALERT_WEBHOOK_URL="https://yoursite.com/api/admin/alert"
ENV

source /home/deploy/.bashrc
```

Or better, use a dedicated environment file:

```bash
cat > /home/deploy/scripts/.env << 'ENV'
HCLOUD_TOKEN=your_hetzner_api_token_here
ALERT_WEBHOOK_URL=https://yoursite.com/api/admin/alert
ENV
chmod 600 /home/deploy/scripts/.env

# Update script to load it:
sed -i '4a source /home/deploy/scripts/.env' /home/deploy/scripts/snapshot.sh
```

### A.5 Schedule with Cron (Daily at 2 AM UTC)

```bash
# Create log directory
mkdir -p /home/deploy/logs

# Add cron job for deploy user
crontab -e
```

Add this line:

```cron
# Weekly Hetzner snapshot every Sunday at 2:00 AM UTC
0 2 * * 0 /home/deploy/scripts/snapshot.sh >> /home/deploy/logs/snapshot.log 2>&1
```

### A.6 Test the Script Manually

```bash
# Run once to verify everything works
/home/deploy/scripts/snapshot.sh

# Check the log
tail -50 /home/deploy/logs/snapshot.log

# Expected output:
# [2026-04-23 02:00:01 UTC] === Starting daily snapshot ===
# [2026-04-23 02:00:02 UTC] Server ID: 12345678
# [2026-04-23 02:00:03 UTC] Creating snapshot: daily-20260423-0200
# [2026-04-23 02:00:04 UTC] Snapshot created. ID: 98765432
# [2026-04-23 02:00:04 UTC] Waiting for snapshot to complete...
# [2026-04-23 02:02:30 UTC] Snapshot complete. Status: available
# [2026-04-23 02:02:31 UTC] Total daily snapshots found: 3 (keeping 7)
# [2026-04-23 02:02:31 UTC] === Snapshot complete: ID=98765432 label=daily-20260423-0200 ===
```

### A.7 Verify Snapshot in Hetzner Console

1. Go to console.hetzner.cloud → Your Project
2. Click **Snapshots** in the left sidebar
3. You should see the new snapshot with label `daily-YYYYMMDD-HHMM`
4. It will have the label `type: daily`

### A.8 Restore from Snapshot (Emergency Procedure)

```bash
# If your server is gone or corrupted:
# 1. Go to Hetzner Console → Servers → + Add Server
# 2. In "Image" section, click "Snapshots" tab
# 3. Select the most recent daily snapshot
# 4. Choose same specs (CX22, Singapore)
# 5. Add your SSH key
# 6. Click "Create & Buy Now"

# New server will be identical to the snapshot state
# Takes approximately 5 minutes

# After restore, update BULLMQ_REDIS_* env if IP changed
# Update MongoDB Atlas IP whitelist with new server IP
# Atlas: Network Access → Add IP Address → new IP
```

### A.9 Snapshot Cost Estimate

| Retention | Snapshots Kept | Cost/month |
|---|---|---|
| Daily (7 kept) | 7 × 40GB | ~$3.33/mo (rejected — too expensive) |
| **Weekly (4 kept)** | **4 × 40GB** | **~$2/month (recommended)** |
| Monthly (3 kept) | 3 × 40GB | ~$1.50/mo (too sparse) |

> **Note:** 40GB is the CX22 disk size. Actual snapshot size is compressed — typically 10-15GB used, so real cost can be 30-50% lower (~$0.60-1.20/mo).
> **Why weekly:** Daily was costing too much for a stack at this scale. Weekly snapshots + 15-day MongoDB backups give you a 4-week recovery window for the VPS, with continuous Atlas backups protecting database content separately.

---

## Part B — Automated MongoDB Backup Every 15 Days to Cloudflare R2

### B.1 Why Every 15 Days (Not Daily)?

- **MongoDB Atlas M0 already runs continuous backups** — automatic, real-time, no action needed
- **Atlas M0 retains backups for 7 days** — covers normal operational incidents
- **The 15-day export to R2** covers scenarios Atlas cannot: accidental data deletion discovered after Atlas's 7-day window, compliance, or account-level issues
- **R2 has zero egress fees** — reading backups back costs nothing (unlike S3)

### B.2 Set Up Cloudflare R2 Bucket

```bash
# 1. Log into Cloudflare Dashboard → R2 Object Storage
# 2. Create Bucket → Name: cip-mongodb-backups
# 3. Settings → Enable "Versioning" for extra safety
# 4. Create API Token:
#    - Cloudflare Dashboard → R2 → Manage R2 API Tokens
#    - Token name: cip-backup-token
#    - Permissions: Object Read & Write
#    - Specific bucket: cip-mongodb-backups
#    - Copy: Access Key ID and Secret Access Key
```

### B.3 Install Dependencies on Hetzner

```bash
# SSH into Hetzner server
ssh deploy@YOUR_SERVER_IP

# Install AWS CLI (compatible with Cloudflare R2's S3-compatible API)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version   # Should show aws-cli/2.x.x

# Configure AWS CLI for Cloudflare R2
aws configure --profile r2
# AWS Access Key ID: your_r2_access_key_id
# AWS Secret Access Key: your_r2_secret_access_key
# Default region name: auto
# Default output format: json

# Install mongodump
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-database-tools

mongodump --version  # Verify
```

### B.4 Create the Backup Script

```bash
cat > /home/deploy/scripts/mongodb-backup.sh << 'SCRIPT'
#!/bin/bash
# ─────────────────────────────────────────────────────────────
# CIP-2026 MongoDB Backup Script
# Runs via cron every 15 days at 3:00 AM UTC
# Exports full database → compresses → uploads to Cloudflare R2
# Retains last 6 backups (90 days total)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

source /home/deploy/scripts/.env

MONGODB_URI="${MONGODB_URI}"
DB_NAME="${MONGODB_DB_NAME:-cip_production}"
R2_BUCKET="cip-mongodb-backups"
R2_ENDPOINT="https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com"
BACKUP_DIR="/home/deploy/backups/mongodb"
KEEP_BACKUPS=6   # 6 × 15 days = 90 days retention
LOG_FILE="/home/deploy/logs/mongodb-backup.log"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
  local status="$1"
  local message="$2"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -s -X POST "$ALERT_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\": \"mongodb_backup\", \"status\": \"$status\", \"message\": \"$message\"}" \
      > /dev/null 2>&1 || true
  fi
}

log "=== Starting MongoDB backup ==="

# ── 1. Create backup directory ────────────────────────────
mkdir -p "$BACKUP_DIR"
DATE_TAG=$(date -u '+%Y%m%d-%H%M%S')
ARCHIVE_NAME="cip-mongodb-${DB_NAME}-${DATE_TAG}.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

# ── 2. Run mongodump ──────────────────────────────────────
log "Running mongodump for database: $DB_NAME"
START_TIME=$(date +%s)

mongodump \
  --uri="$MONGODB_URI" \
  --db="$DB_NAME" \
  --archive="$ARCHIVE_PATH" \
  --gzip \
  --quiet

if [ ! -f "$ARCHIVE_PATH" ]; then
  log "ERROR: Backup file not created"
  send_alert "error" "MongoDB backup failed — archive not created"
  exit 1
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
FILE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
log "mongodump complete. Size: $FILE_SIZE. Duration: ${DURATION}s"

# ── 3. Verify archive integrity ───────────────────────────
log "Verifying archive integrity..."
if ! gunzip -t "$ARCHIVE_PATH" 2>/dev/null; then
  log "ERROR: Archive is corrupted"
  send_alert "error" "MongoDB backup corrupted — $ARCHIVE_NAME"
  rm -f "$ARCHIVE_PATH"
  exit 1
fi
log "Archive integrity verified"

# ── 4. Upload to Cloudflare R2 ────────────────────────────
log "Uploading to Cloudflare R2: $R2_BUCKET/$ARCHIVE_NAME"

aws s3 cp "$ARCHIVE_PATH" \
  "s3://${R2_BUCKET}/${ARCHIVE_NAME}" \
  --endpoint-url "$R2_ENDPOINT" \
  --profile r2 \
  --metadata "db=${DB_NAME},date=${DATE_TAG},server=cip-worker-01"

log "Upload complete"

# ── 5. Verify upload ──────────────────────────────────────
REMOTE_SIZE=$(aws s3 ls \
  "s3://${R2_BUCKET}/${ARCHIVE_NAME}" \
  --endpoint-url "$R2_ENDPOINT" \
  --profile r2 \
  | awk '{print $3}')

LOCAL_SIZE=$(stat -c%s "$ARCHIVE_PATH")

if [ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]; then
  log "ERROR: Upload size mismatch. Local: $LOCAL_SIZE, Remote: $REMOTE_SIZE"
  send_alert "error" "MongoDB backup upload size mismatch for $ARCHIVE_NAME"
  rm -f "$ARCHIVE_PATH"
  exit 1
fi

log "Upload verified. Remote size: $REMOTE_SIZE bytes"

# ── 6. Clean up local file ────────────────────────────────
rm -f "$ARCHIVE_PATH"
log "Local backup file removed"

# ── 7. List all backups and delete oldest ─────────────────
log "Checking backup retention (keep: $KEEP_BACKUPS)..."

ALL_BACKUPS=$(aws s3 ls \
  "s3://${R2_BUCKET}/" \
  --endpoint-url "$R2_ENDPOINT" \
  --profile r2 \
  | grep "cip-mongodb-${DB_NAME}-" \
  | sort \
  | awk '{print $4}')

BACKUP_COUNT=$(echo "$ALL_BACKUPS" | grep -c "." || true)
log "Total backups in R2: $BACKUP_COUNT"

if [ "$BACKUP_COUNT" -gt "$KEEP_BACKUPS" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - KEEP_BACKUPS))
  TO_DELETE=$(echo "$ALL_BACKUPS" | head -n "$DELETE_COUNT")

  for OLD_BACKUP in $TO_DELETE; do
    log "Deleting old backup: $OLD_BACKUP"
    aws s3 rm \
      "s3://${R2_BUCKET}/${OLD_BACKUP}" \
      --endpoint-url "$R2_ENDPOINT" \
      --profile r2
  done
  log "Deleted $DELETE_COUNT old backups"
fi

# ── 8. Success ────────────────────────────────────────────
log "=== MongoDB backup complete: $ARCHIVE_NAME ($FILE_SIZE) ==="
send_alert "success" "MongoDB backup complete: $ARCHIVE_NAME ($FILE_SIZE) uploaded to R2"
SCRIPT

chmod +x /home/deploy/scripts/mongodb-backup.sh
```

### B.5 Add Required Environment Variables

Add these to `/home/deploy/scripts/.env`:

```bash
cat >> /home/deploy/scripts/.env << 'ENV'

# MongoDB backup
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=cip_production

# Cloudflare R2
CF_ACCOUNT_ID=your_cloudflare_account_id
ENV

chmod 600 /home/deploy/scripts/.env
```

### B.6 Schedule Every 15 Days

```bash
crontab -e
```

Add:

```cron
# Daily Hetzner snapshot at 2:00 AM UTC
0 2 * * * /home/deploy/scripts/snapshot.sh >> /home/deploy/logs/snapshot.log 2>&1

# MongoDB backup every 15 days at 3:00 AM UTC
# (runs on 1st and 16th of each month)
0 3 1,16 * * /home/deploy/scripts/mongodb-backup.sh >> /home/deploy/logs/mongodb-backup.log 2>&1
```

### B.7 Test Backup Manually

```bash
# Test run
/home/deploy/scripts/mongodb-backup.sh

# Check log
tail -50 /home/deploy/logs/mongodb-backup.log

# Verify file exists in R2
aws s3 ls s3://cip-mongodb-backups/ \
  --endpoint-url "https://YOUR_CF_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --profile r2
```

### B.8 Restore from R2 Backup (Emergency Procedure)

```bash
# Step 1: Download backup from R2
aws s3 cp \
  "s3://cip-mongodb-backups/cip-mongodb-cip_production-20260423-030000.gz" \
  ./restore.gz \
  --endpoint-url "https://YOUR_CF_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --profile r2

# Step 2: Restore to MongoDB
# WARNING: --drop removes existing data before restoring
mongorestore \
  --uri="$MONGODB_URI" \
  --db="cip_production" \
  --archive=restore.gz \
  --gzip \
  --drop \
  --quiet

# Step 3: Clean up
rm restore.gz

echo "Restore complete"
```

### B.9 Backup Retention Summary

| Layer | Frequency | Retention | Cost |
|---|---|---|---|
| Atlas continuous backup | Real-time | 7 days | Free |
| MongoDB export to R2 | Every 15 days | 90 days (6 backups) | ~$0.10/mo |
| Hetzner VPS snapshot | Daily | 7 days | ~$1.50/mo |

**Total backup cost: ~$1.60/mo.** Covers you from 2-minute incidents to 3-month-old data corruption.

---

## Part C — Network Security Guidelines

### C.1 Network Security Architecture Overview

```
INTERNET
    │
    ▼
┌────────────────────────────────────────────────┐
│  Cloudflare (Layer 7 Firewall + DDoS)          │
│  • WAF rules                                   │
│  • Bot management                              │
│  • Rate limiting (free tier)                   │
│  • DDoS protection (free tier)                 │
└───────────────────────┬────────────────────────┘
                        │ Only Cloudflare IPs reach Vercel
                        ▼
┌────────────────────────────────────────────────┐
│  Vercel (Application Layer)                    │
│  • Validates Clerk JWT on every request        │
│  • proxy.ts blocks unauthenticated admin routes│
│  • Upstash rate limit per IP                   │
│  • No direct public IPs to worry about         │
└───────────────────────┬────────────────────────┘
                        │ Private (MongoDB SRV + Upstash HTTPS)
                        ▼
┌────────────────────────────────────────────────┐
│  Hetzner VPS (Worker Layer)                    │
│  • UFW firewall: only port 22 inbound          │
│  • Fail2ban: SSH brute-force protection        │
│  • chrony: NTP synced clock                    │
│  • Local Redis: bind 127.0.0.1 only            │
│  • No inbound web traffic (outbound only)      │
└────────────────────────────────────────────────┘
```

### C.2 Hetzner VPS Firewall Hardening (Complete)

SSH into your Hetzner server and run these commands in order:

#### Step 1: Lock Down UFW

```bash
# Reset to defaults
sudo ufw --force reset

# Default: deny all inbound, allow all outbound
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH on port 22 (BEFORE enabling firewall or you'll lock yourself out)
sudo ufw allow 22/tcp comment 'SSH'

# Allow NTP outbound (chrony needs this)
# Already allowed by "default allow outgoing"

# Block common attack ports explicitly
sudo ufw deny 23/tcp comment 'Block Telnet'
sudo ufw deny 25/tcp comment 'Block SMTP (no mail server here)'
sudo ufw deny 3306/tcp comment 'Block MySQL'
sudo ufw deny 5432/tcp comment 'Block PostgreSQL'
sudo ufw deny 27017/tcp comment 'Block MongoDB direct'
sudo ufw deny 6379/tcp comment 'Block Redis direct'

# Enable firewall
sudo ufw --force enable

# Verify
sudo ufw status verbose
```

Expected output:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
23/tcp                     DENY IN     Anywhere
25/tcp                     DENY IN     Anywhere
3306/tcp                   DENY IN     Anywhere
5432/tcp                   DENY IN     Anywhere
27017/tcp                  DENY IN     Anywhere
6379/tcp                   DENY IN     Anywhere
```

#### Step 2: Harden SSH Configuration

```bash
sudo nano /etc/ssh/sshd_config
```

Make sure these values are set (add or update):

```
# Disable password authentication — SSH key only
PasswordAuthentication no
PubkeyAuthentication yes

# Disable root login
PermitRootLogin no

# Disable empty passwords
PermitEmptyPasswords no

# Allow only the deploy user
AllowUsers deploy

# Disconnect idle sessions after 10 minutes
ClientAliveInterval 300
ClientAliveCountMax 2

# Limit authentication attempts
MaxAuthTries 3

# Disable X11 forwarding (not needed)
X11Forwarding no

# Disable TCP forwarding (not needed)
AllowTcpForwarding no

# Use protocol 2 only
Protocol 2

# Limit to IPv4 only (optional, if you don't need IPv6)
AddressFamily inet

# Change SSH banner
Banner /etc/ssh/banner.txt
```

Create the SSH banner:

```bash
cat > /etc/ssh/banner.txt << 'BANNER'
*****************************************************
*                CIP-2026 SERVER                    *
*   Unauthorized access is prohibited and logged    *
*   All connections are monitored                   *
*****************************************************
BANNER

# Restart SSH to apply (DON'T close your current session until you test)
sudo systemctl restart sshd

# Open a NEW terminal window and verify you can still SSH in
# Only close old session after new session works
```

#### Step 3: Configure Fail2ban (Advanced)

```bash
# Fail2ban blocks IPs that fail authentication multiple times

cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[DEFAULT]
bantime  = 3600         ; Ban for 1 hour
findtime = 600          ; Look back 10 minutes
maxretry = 5            ; Ban after 5 failures
backend  = systemd
ignoreip = 127.0.0.1/8  ; Never ban localhost

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = %(sshd_log)s
maxretry = 3            ; Stricter for SSH
bantime  = 86400        ; Ban SSH violators for 24 hours

[sshd-ddos]
enabled  = true
port     = ssh
filter   = sshd-ddos
logpath  = %(sshd_log)s
maxretry = 6
bantime  = 3600
FAIL2BAN

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Verify
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

#### Step 4: Disable Unused Services

```bash
# List all running services
systemctl list-units --type=service --state=running

# Disable services you don't need
sudo systemctl disable --now apache2 2>/dev/null || true
sudo systemctl disable --now nginx 2>/dev/null || true
sudo systemctl disable --now postfix 2>/dev/null || true
sudo systemctl disable --now bluetooth 2>/dev/null || true
sudo systemctl disable --now cups 2>/dev/null || true

# Services you WANT running:
# sshd, chrony, redis-server, cron, fail2ban, pm2 (via user service)
```

#### Step 5: System-Level Security Hardening

```bash
# Disable IP forwarding (we don't route packets)
cat >> /etc/sysctl.conf << 'SYSCTL'

# Network security hardening
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Prevent time-wait assassination
net.ipv4.tcp_rfc1337 = 1

# IPv6 hardening
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_source_route = 0
SYSCTL

# Apply immediately
sudo sysctl -p
```

#### Step 6: Automatic Security Updates

```bash
# Enable unattended security patches
sudo apt install -y unattended-upgrades apt-listchanges

sudo dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes" when prompted

# Configure auto-updates
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UPGRADES'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Package-Blacklist {
    "node";
    "nodejs";
    "npm";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "your@email.com";
UPGRADES

# Enable auto-updates timer
sudo systemctl enable --now apt-daily-upgrade.timer
```

**Note:** We blacklist `node` and `nodejs` from auto-updates because worker code compatibility must be tested — Node.js version bumps are handled manually via your deployment process.

#### Step 7: Hetzner Cloud Firewall (Extra Layer)

In addition to UFW (host-based firewall), add a Hetzner Cloud Firewall (network-level):

1. Hetzner Console → **Firewalls** → **Create Firewall**
2. Name: `cip-worker-firewall`
3. Inbound rules:

| Protocol | Port | Source | Description |
|---|---|---|---|
| TCP | 22 | Your home IP + office IP | SSH only from known IPs |

4. Outbound rules: Allow all (worker needs to reach MongoDB, APIs, etc.)
5. Apply to server: `cip-worker-01`

**Restricting SSH to your IP** is the single most effective security measure — eliminates 99% of SSH brute-force attacks even before fail2ban.

### C.3 MongoDB Atlas Network Security

```bash
# MongoDB Atlas → Network Access → IP Access List
# Remove 0.0.0.0/0 (allow all) if you added it during setup
# Add ONLY these specific IPs:

# 1. Hetzner server IP (for worker)
# 65.108.XXX.XXX/32

# 2. Your home/office IP (for local development)
# YOUR.HOME.IP.XXX/32

# 3. Vercel IP ranges (for API route connections)
# Vercel publishes their IP ranges:
# https://vercel.com/docs/concepts/edge-network/regions
# Add each Vercel region IP range you use

# 4. GitHub Actions IP ranges (for deployment CI)
# Download from: https://api.github.com/meta → actions IPs
```

Alternatively, use MongoDB Atlas Private Endpoints (M10+ plan only) for complete isolation.

### C.4 Upstash Redis Security

```bash
# Upstash is HTTP-based and uses Bearer token auth
# The token in UPSTASH_REDIS_REST_TOKEN is your password

# Security rules:
# 1. Never expose UPSTASH_REDIS_REST_TOKEN in client-side code
#    (it's a server-side env var on Vercel — never in NEXT_PUBLIC_*)
# 2. Rotate the token every 90 days
# 3. In Upstash Console → Token → restrict by IP (optional for extra security)
```

### C.5 Local Redis Security (On Hetzner)

```bash
# Verify Redis is NOT exposed to internet
redis-cli -h 0.0.0.0 -p 6379 ping 2>/dev/null
# Should fail with "Connection refused" or timeout
# If it connects — Redis is exposed! Fix immediately:

sudo nano /etc/redis/redis.conf
# Ensure: bind 127.0.0.1
# Ensure: requirepass YourStrongRedisPassword123
# Ensure: protected-mode yes

sudo systemctl restart redis-server
```

### C.6 Vercel Security Configuration

Add to `next.config.ts`:

```typescript
// next.config.ts
const nextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.metalpriceapi.com wss://stream.binance.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // No caching for admin routes
      {
        source: '/admin/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },

  // Allow only Cloudflare IPs to access Vercel
  // (configure in Vercel dashboard → Settings → Security)
};

export default nextConfig;
```

### C.7 Environment Variable Security Rules

| Category | Rule |
|---|---|
| **Exposure** | NEVER prefix secrets with `NEXT_PUBLIC_` |
| **Storage** | Store in Vercel dashboard, not in `.env` committed to Git |
| **Length** | All secrets must be ≥32 random characters |
| **Rotation** | Rotate every 90 days minimum |
| **Sharing** | Use password manager (1Password/Bitwarden), never email/Slack |
| **Auditing** | Keep a rotation log (not the values — just "rotated on X date") |

Secret rotation reminder script (runs monthly):

```bash
cat > /home/deploy/scripts/rotation-reminder.sh << 'SCRIPT'
#!/bin/bash
# Monthly reminder to rotate secrets
LAST_ROTATED_FILE="/home/deploy/.last-rotation"
ROTATION_DAYS=90

if [ -f "$LAST_ROTATED_FILE" ]; then
  LAST_DATE=$(cat "$LAST_ROTATED_FILE")
  DAYS_SINCE=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))

  if [ "$DAYS_SINCE" -gt "$ROTATION_DAYS" ]; then
    echo "⚠️  SECRET ROTATION DUE: $DAYS_SINCE days since last rotation"
    echo "   Rotate: METALPRICEAPI_KEY, UPSTASH_REDIS_REST_TOKEN,"
    echo "           CLERK_SECRET_KEY, RESEND_API_KEY, REVALIDATE_SECRET"
    # Send alert via webhook
    curl -s -X POST "${ALERT_WEBHOOK_URL:-}" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"security\",\"message\":\"Secret rotation due ($DAYS_SINCE days)\"}" \
      > /dev/null 2>&1 || true
  fi
else
  echo "$(date +%Y-%m-%d)" > "$LAST_ROTATED_FILE"
fi
SCRIPT

chmod +x /home/deploy/scripts/rotation-reminder.sh
```

Add to crontab:

```cron
# Monthly secret rotation reminder (1st of each month)
0 9 1 * * /home/deploy/scripts/rotation-reminder.sh >> /home/deploy/logs/security.log 2>&1
```

### C.8 Cloudflare WAF Rules (Free Tier)

In Cloudflare → Security → WAF → Custom Rules, create these rules:

**Rule 1: Block bad bots and crawlers**
```
(cf.client.bot) AND NOT (cf.verified_bot_category in {"search_engine" "monitoring" "ai"})
→ Action: Managed Challenge
```

**Rule 2: Rate limit price API per IP**
```
(http.request.uri.path contains "/api/price/") AND
(ip.src not in {YOUR_SERVER_IP/32})
→ Rate limit: 60 requests per minute per IP
→ Action: Block for 1 minute
```

**Rule 3: Protect admin routes**
```
(http.request.uri.path contains "/admin")
→ Action: Managed Challenge (forces browser verification)
```

**Rule 4: Block known malicious countries (optional — YMYL compliance)**
```
(ip.geoip.country in {"KP" "RU" "IR" "BY"})
→ Action: Block
```
Note: Only add this if required for your compliance obligations. Geoblocking can affect legitimate users.

**Rule 5: Block SQL injection and XSS attempts**
```
(cf.waf.score.sqli < 40) OR (cf.waf.score.xss < 40)
→ Action: Block
```

### C.9 Security Monitoring Dashboard

Add this to your `/admin/security` page (tracked in your `security_scans` MongoDB collection):

```typescript
// Data points to display in /admin/security

interface SecurityStatus {
  hetzner: {
    ufw_active: boolean;
    fail2ban_active: boolean;
    ssh_key_only: boolean;
    last_ssh_failure: Date;
    blocked_ips_count: number;
  };
  mongodb: {
    ip_whitelist_count: number;
    last_backup: Date;
    backups_in_r2: number;
  };
  hetzner_snapshots: {
    latest_snapshot: Date;
    snapshot_count: number;
  };
  secrets: {
    last_rotated: Date;
    rotation_due: boolean;
  };
  dependencies: {
    vulnerabilities_critical: number;
    vulnerabilities_high: number;
    last_scan: Date;
  };
}
```

### C.10 Security Incident Response (5-Step Playbook)

If you detect a breach or suspicious activity:

```
STEP 1 — ISOLATE (within 5 minutes)
  • Hetzner Console → Server → Disable networking
  • Vercel → Pause deployment
  • Clerk → Suspend all sessions
  • Upstash → Rotate token immediately

STEP 2 — ASSESS (within 30 minutes)
  • Download Hetzner server logs: /var/log/auth.log, /var/log/syslog
  • Check MongoDB Atlas Audit Log for unusual queries
  • Check Vercel Function Logs for anomalous requests
  • Identify: what was accessed, when, from where

STEP 3 — CONTAIN (within 1 hour)
  • Rotate ALL API keys and secrets
  • Force-logout all admin sessions via Clerk dashboard
  • Update MongoDB Atlas IP whitelist
  • Add Cloudflare WAF rule to block attacker IP

STEP 4 — RECOVER (within 24 hours)
  • Restore from last known-good Hetzner snapshot if code was tampered
  • Restore MongoDB from R2 backup if data was tampered
  • Redeploy Vercel from clean GitHub commit
  • Update all credentials in password manager

STEP 5 — NOTIFY (within 72 hours — GDPR requirement)
  • If user data was accessed: notify ICO (UK) / supervisory authority per GDPR Article 33
  • If you have Pakistani users: notify PTA if required
  • If you have Indian users: notify CERT-In within 6 hours (Indian law)
  • Prepare incident report with timeline
```

### C.11 Full Security Checklist (Sprint 1)

#### Hetzner Server
- [ ] UFW: default deny incoming, allow outgoing
- [ ] UFW: only port 22/tcp open
- [ ] Hetzner Cloud Firewall: SSH from known IPs only
- [ ] SSH: `PasswordAuthentication no`
- [ ] SSH: `PermitRootLogin no`
- [ ] SSH: `AllowUsers deploy`
- [ ] SSH: `MaxAuthTries 3`
- [ ] Fail2ban: active on SSH with 3-retry, 24h ban
- [ ] Sysctl: SYN flood protection applied
- [ ] Sysctl: IP forwarding disabled
- [ ] Unattended-upgrades: active for security patches
- [ ] Redis: `bind 127.0.0.1` confirmed
- [ ] Redis: `requirepass` set to strong password

#### Backups
- [ ] Daily snapshot script: deployed, tested, cron scheduled
- [ ] MongoDB backup script: deployed, tested, cron scheduled
- [ ] R2 bucket: created with versioning enabled
- [ ] Test restore: run restore from R2 to verify backup integrity
- [ ] Test snapshot restore: verify Hetzner snapshot creates new server correctly

#### Application
- [ ] Security headers: added to `next.config.ts`
- [ ] CSP policy: configured and tested
- [ ] HSTS: `max-age=63072000` with preload
- [ ] No secrets in `NEXT_PUBLIC_*` vars
- [ ] All secrets ≥32 characters
- [ ] Secret rotation schedule established (90 days)

#### Cloudflare
- [ ] WAF: 5 custom rules created
- [ ] DDoS protection: enabled (free tier — on by default)
- [ ] SSL mode: Full (Strict)
- [ ] DNSSEC: enabled
- [ ] Bot Management: enabled (free managed rules)

#### MongoDB Atlas
- [ ] IP whitelist: specific IPs only (remove 0.0.0.0/0)
- [ ] Atlas backups: verified on
- [ ] Audit logging: enabled (if on M10+)
- [ ] Strong password on Atlas user (≥24 characters)

#### Monitoring
- [ ] UptimeRobot: 3 monitors active
- [ ] Fail2ban logs: reviewed weekly
- [ ] Monthly rotation-reminder cron: active
- [ ] `/admin/security` dashboard: built

---

## Part D — All Cron Jobs Summary

Final complete crontab for the `deploy` user on Hetzner:

```cron
# ─────────────────────────────────────────────────────────────
# CIP-2026 Production Crontab
# All times are UTC
# ─────────────────────────────────────────────────────────────

# Weekly Hetzner VPS snapshot every Sunday at 2:00 AM
0 2 * * 0 /home/deploy/scripts/snapshot.sh >> /home/deploy/logs/snapshot.log 2>&1

# MongoDB full backup to Cloudflare R2 every 15 days (1st and 16th)
0 3 1,16 * * /home/deploy/scripts/mongodb-backup.sh >> /home/deploy/logs/mongodb-backup.log 2>&1

# Monthly secret rotation reminder (1st of month at 9 AM)
0 9 1 * * /home/deploy/scripts/rotation-reminder.sh >> /home/deploy/logs/security.log 2>&1

# Clean old log files (keep last 30 days)
0 4 * * * find /home/deploy/logs -name "*.log" -mtime +30 -delete 2>/dev/null

# NOTE: Metals/crypto ingestion and aggregation are handled by BullMQ workers
# NOT cron — they start automatically with: pm2 start ecosystem.config.js
```

---

## Part E — Cost Summary for This Document

| New Component | Monthly Cost |
|---|---|
| Weekly Hetzner snapshots (4 kept) | ~$2.00 |
| MongoDB R2 exports (6 kept, ~150MB each) | ~$0.01 |
| Cloudflare R2 storage (total ~1GB) | ~$0.02 |
| Cloudflare R2 operations | ~$0.05 |
| **Additional cost per month** | **~$2.08** |
| **New total stack cost** | **~$25.50/mo** |

---

## Part F — Updates Needed in Other Docs

| Doc | Update Needed |
|---|---|
| `00-START-HERE.md` | Add doc 27 to index, add backup items to Day 0 checklist |
| `18-UPDATED-SPRINT-PLAN.md` | Add security hardening to Sprint 1 tasks |
| `21-HETZNER-VPS-IMPLEMENTATION.md` | Add sections: UFW rules, SSH hardening, fail2ban config |
| `26-DISASTER-RECOVERY-PLAN.md` | Reference this doc for backup implementation |
| `17-CLAUDE-AGENT-FILES.md` / CLAUDE.md | Add network security rules |

### CLAUDE.md Additions (Security Rules)

```markdown
### Backup & Security Rules

ALWAYS:
- Run weekly snapshot from /home/deploy/scripts/snapshot.sh (cron Sundays at 2 AM UTC)
- Run MongoDB backup from /home/deploy/scripts/mongodb-backup.sh (1st & 16th at 3 AM UTC)
- Rotate all API keys every 90 days
- Keep Redis bound to 127.0.0.1 only
- Use UFW default deny on Hetzner
- Add X-Content-Type-Options, X-Frame-Options, CSP headers on Vercel

NEVER:
- Expose port 6379 (Redis) to internet
- Use PasswordAuthentication yes in SSH config
- Leave PermitRootLogin yes
- Store secrets in code or .env committed to Git
- Set MongoDB Atlas IP whitelist to 0.0.0.0/0 in production
- Skip fail2ban on any server you administer
```

---

*Document 27 of the CIP-2026 Package — Automated Backups + Network Security Guidelines*
*Cross-references: 17, 18, 21, 26 need updates per Part F above.*
*Last reviewed: April 23, 2026*
