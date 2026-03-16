---
name: docker-integration
description: "ACTIVATE when integrating a new Docker image, writing docker-compose.yml services, or adding external tools to a Docker stack. ACTIVATE for 'docker-compose', 'Docker image', 'container setup', 'service integration'. Covers: mandatory RTFM checklist before writing any docker-compose line (volumes, ports, env vars, healthchecks, internal architecture), image inspection commands, common anti-patterns that cause silent failures. DO NOT use for: Dockerfile writing, CI/CD pipeline configuration, Kubernetes."
version: "1.1"
---

# Docker Integration - RTFM First

When integrating a third-party Docker image (RAGFlow, Traefik, PostgreSQL, Redis, n8n, etc.), **read the official configuration BEFORE writing any docker-compose line**.

## Why

Docker images are rarely self-contained. They often depend on:
- Configuration files mounted as volumes (nginx, traefik, etc.)
- Specific environment variables
- Init or entrypoint scripts
- Internal ports different from what you assume
- Service dependencies (healthchecks, startup order)

**Never assume.** Always verify.

## Mandatory Checklist

Before writing a service in `docker-compose.yml`:

### 1. Read the Official docker-compose

```bash
# Find the project's official docker-compose.yml
# On GitHub: docker/, deploy/, or repo root
```

Identify:
- [ ] **Mounted volumes**: which config files are externalized?
- [ ] **Exposed ports**: what is the main entry port vs internal ports?
- [ ] **Environment variables**: which ones are required?
- [ ] **Healthcheck**: how does the service verify its health?
- [ ] **Dependencies**: `depends_on` with `condition: service_healthy`?
- [ ] **Command/entrypoint**: is the default CMD sufficient?

### 2. Inspect the Image if Needed

```bash
# View EXPOSE ports, CMD, ENTRYPOINT, volumes
docker inspect <image>:<tag>

# View running processes inside the container
docker exec <container> ps aux

# Check actually open ports
docker exec <container> bash -c 'for port in 80 443 8080 3000; do \
  (echo >/dev/tcp/localhost/$port) 2>/dev/null && echo "Port $port OPEN" \
  || echo "Port $port closed"; done'
```

### 3. Understand the Internal Architecture

Some images run multiple internal processes (e.g., RAGFlow = nginx + Python API + workers). Key questions:
- Which process serves the HTTP entry point?
- Is there an internal reverse proxy (nginx, caddy)?
- Is the documented port the proxy port or the application port?

## Anti-Patterns

| Anti-pattern | Consequence |
|---|---|
| Assuming the port without checking | Traefik routes to the wrong service (404) |
| Ignoring config volumes | Service starts with default config ("Welcome to nginx!") |
| Copying an example without reading | Missing files, undefined variables |
| Guessing memory limits | Silent OOM kills |
| Not reading the Dockerfile/entrypoint | Misunderstanding the internal architecture |

## Concrete Example: RAGFlow

The `infiniflow/ragflow` image requires 3 nginx files mounted as volumes:
```yaml
volumes:
  - ./nginx/ragflow.conf:/etc/nginx/conf.d/ragflow.conf
  - ./nginx/proxy.conf:/etc/nginx/proxy.conf
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf
```
Without them, nginx serves its default page instead of the RAGFlow UI.
The entry port is **80** (nginx), not 9380 (internal Python API).
