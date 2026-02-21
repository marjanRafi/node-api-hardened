# node-api-hardened

> A production-grade, multi-stage Docker build for a Node.js HTTP API  
> with strict security hardening, Cgroup resource enforcement,  
> and zero-downtime signal handling.

---

## Who This Is For

| Level | What You Will Learn |
|-------|-------------------|
| 🟢 Beginner | How Docker works, what a container is, how to run an app |
| 🟡 Intermediate | Multi-stage builds, image optimization, docker-compose |
| 🔴 Advanced | Security hardening, Cgroup limits, signal handling, CVE scanning |

---

## What Problem This Solves

Most Docker tutorials ship a ~1GB image running as root with no 
signal handling. In production this means:
- Slow scaling across availability zones (large image pulls)
- Full host access if the container is breached
- 10-second kill delays on every deployment (SIGTERM ignored)
- No resource boundaries (one container can starve the host)

This project fixes all four.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Docker Host                 │
│  ┌───────────────────────────────────────┐  │
│  │     Container: node-api-hardened      │  │
│  │                                       │  │
│  │  PID 1:  tini  ← signal forwarding   │  │
│  │  App:    node server.js               │  │
│  │  User:   appuser (non-root)           │  │
│  │  FS:     read-only + tmpfs on /tmp    │  │
│  │  Caps:   ALL dropped                  │  │
│  │  CPU:    max 0.50 cores (Cgroup)      │  │
│  │  Memory: max 256MB (Cgroup)           │  │
│  └──────────────────┬────────────────────┘  │
│                     │ :8080                  │
└─────────────────────┼──────────────────────┘
                      ▼
                   Client
```

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Docker | 24.x | `docker --version` |
| Docker Compose | 2.x | `docker compose version` |
| Git | Any | `git --version` |

---

## Quick Start (Beginner)

```bash
# 1. Clone the repo
git clone https://github.com/marjanRafi/node-api-hardened.git
cd node-api-hardened

# 2. Build and run
docker compose --compatibility up -d

# 3. Test it
curl http://localhost:8080/health
```

Expected response:
```json
{ "status": "ok", "pid": 1 }
```

---

## How It Works (Intermediate)

### Multi-Stage Build
The Dockerfile uses two stages:
- **Stage 1 (builder):** Full node:20-alpine image installs 
  dependencies and compiles the app
- **Stage 2 (runtime):** Fresh minimal image copies ONLY the 
  built artifacts — no compilers, no npm cache, no dev tools

Result: image drops from ~1GB to under 100MB.

### Layer Caching
```dockerfile
COPY package*.json ./      # ← cached unless deps change
RUN npm ci --only=production
COPY . .                   # ← only invalidates if source changes
```

This means rebuilds after code changes take seconds, not minutes.

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '0.50'    # hard CPU cap via Linux Cgroups
      memory: 256M    # hard memory cap via Linux Cgroups
```
Run with: `docker compose --compatibility up -d`
The `--compatibility` flag is required to enforce these limits 
locally outside of Docker Swarm.

---

## Security Hardening (Advanced)

| Control | Implementation | Why It Matters |
|---------|---------------|----------------|
| Non-root user | `adduser -S appuser` | Attacker escapes to unprivileged user |
| PID 1 handling | `tini` as ENTRYPOINT | SIGTERM forwarded correctly, no zombies |
| Privilege escalation | `no-new-privileges:true` | Blocks setuid binary exploits |
| Linux capabilities | `cap_drop: ALL` | Removes all kernel-level privileges |
| Filesystem | `read_only: true` | Malware cannot write payloads to disk |
| Writable tmp | `tmpfs: /tmp` | Node runtime gets ephemeral scratch space |
| Secrets | Runtime injection only | Nothing sensitive baked into image layers |
| CVE scanning | Ephemeral Trivy container | No host install required |

### Run CVE Scan
```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image node-api-hardened:v1.0.0
```

### Verify Security Controls
```bash
# Confirm non-root
docker exec $(docker compose ps -q api) whoami
# Expected: appuser

# Confirm tini is PID 1
docker exec $(docker compose ps -q api) ps aux
# Expected: tini at PID 1, node as child
```

---

## Image Size Comparison

| Build Strategy | Size |
|----------------|------|
| node:20 single-stage | ~1 GB |
| node:20-alpine multi-stage | < 100 MB |
| Reduction | ~90% |

---

## API Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/` | GET | `{ "message": "node-api-hardened" }` |
| `/health` | GET | `{ "status": "ok", "pid": 1 }` |

---

## Trade-offs & Known Limitations

**Alpine vs glibc:**  
Alpine uses musl libc instead of glibc. Pure Node.js apps are 
unaffected. Native addons (bcrypt, sharp, canvas) may fail to 
compile — audit your dependency tree before adopting Alpine.

**read_only filesystem:**  
Any package that writes to the app directory at runtime will 
cause Exit Code 1. All write paths must redirect to /tmp.

**deploy.resources locally:**  
Cgroup limits via deploy.resources require the --compatibility 
flag with docker compose locally. Without it, limits are silently 
ignored and containers run unconstrained.

---

## Project Structure

```
node-api-hardened/
├── server.js            # Node.js HTTP server with SIGTERM handler
├── package.json         # Minimal manifest, no external dependencies  
├── Dockerfile           # Multi-stage build: builder + runtime
├── docker-compose.yml   # Stack definition with Cgroup limits
├── .dockerignore        # Prevents credentials/git leaking into image
└── .gitignore           # Keeps node_modules out of version control
```


---

## License
MIT