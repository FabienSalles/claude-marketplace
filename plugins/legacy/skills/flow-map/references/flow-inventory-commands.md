# Flow inventory commands

BSD/macOS-safe sweeps for Phase 1. Run them from the repository root; they answer
"which channels exist", never "what they mean". Adapt the file globs to the
stack — the questions are the same in every language.

Nothing here needs a running environment except the last section, which is the
only one that can raise a record's status from `declared` to `live`.

## 1. Outbound HTTP

```bash
# Clients, by the names frameworks give them
grep -rnE "HttpClientInterface|GuzzleHttp|RestTemplate|WebClient|axios|node-fetch|got\(|requests\.(get|post)|http\.Client" src/ app/ lib/ 2>/dev/null | grep -viE "test|spec|fixture"

# Raw transports that bypass every client abstraction
grep -rnE "curl_init|file_get_contents\(['\"]https?://|fsockopen|urllib|net/http" src/ app/ lib/ 2>/dev/null

# Base URLs and endpoints declared in configuration
grep -rnE "base_uri|base_url|baseURL|endpoint|_API_URL|_URL=" config/ .env* 2>/dev/null | grep -vE "^\s*#"
```

Endpoint constants usually sit in the client class, not in configuration: open
every client the first grep returns and list its paths. A client with three
constants is three flows, not one.

## 2. Messaging

```bash
# Broker topology as the application declares it
find config -name "messenger*" -o -name "kafka*" -o -name "rabbit*" -o -name "*queue*" 2>/dev/null

# Message classes and their routing — publishers and consumers in one pass
grep -rnE "MessageHandler|@RabbitListener|@KafkaListener|#\[AsMessageHandler\]|consume|subscribe\(" src/ app/ 2>/dev/null | grep -viE "test|spec"

# Which transports actually have a worker: a queue nobody consumes is a finding
cat config/supervisor/*.conf docker-compose*.yml 2>/dev/null | grep -nE "consume|worker|listener"
```

The routing map (message class → transport) is the inventory. Cross it with the
worker list: a transport declared with no consumer process is either `dead` or an
outage nobody has noticed.

## 3. Databases, and the second connection

```bash
# Every configured connection, not just the default one
grep -rnE "DATABASE_URL|_DSN|connections:|datasource" config/ .env* 2>/dev/null

# Writes that leave the application's own schema
grep -rnE "getConnection\(['\"]|@Entity\(.*schema|search_path|USE [a-z_]+;" src/ app/ config/ 2>/dev/null
```

A second connection is the highest-value finding of the entire sweep. It is
almost always another service's database, it is almost never covered by a
contract, and it is the one integration no consumer-driven test can catch.

## 4. Storage, mail, files

```bash
grep -rnE "S3Client|Storage::|Flysystem|GCS|BlobClient|minio" src/ config/ 2>/dev/null
grep -rnE "MAILER_DSN|Swift_|Mailer|SendGrid|SES|smtp" src/ config/ .env* 2>/dev/null
grep -rnE "sftp|ftp://|import.*storage|export.*storage|file_path" config/ src/ 2>/dev/null
```

## 5. Inbound entry points

```bash
# HTTP routes — annotations and configuration both
grep -rnE "#\[Route|@Route|@(Get|Post|Put|Patch|Delete)Mapping|@app\.route|router\.(get|post)" src/ app/ 2>/dev/null
find config -name "routes*" 2>/dev/null

# The framework's own routes, which the project never declares
# (Symfony) bin/console debug:router --format=json
# (Rails)   rails routes
# (Spring)  actuator/mappings

# Anonymous or unauthenticated surface — the flows with no caller identity at all
grep -rnE "PUBLIC_ACCESS|permitAll|anonymous|IS_AUTHENTICATED_ANONYMOUSLY|\.public\(\)" config/ src/ 2>/dev/null

# Scheduled entry points: a cron is an actor
find . -name "*cron*" -o -name "*schedule*" -not -path "./vendor/*" -not -path "./node_modules/*" 2>/dev/null
```

## 6. The framework-configuration sweep

**The step that catches what every integration inventory misses.** The
application's own files describe the channels the team wrote. The framework ships
channels of its own, wired from environment variables the project never mentions:
a mailer, an outbound webhook dispatcher, a callback to the vendor's SaaS, a
file-import job with remote storage. Real flows, real credentials, invisible to a
sweep scoped at `src/` and `config/`.

```bash
# Every variable the environment defines
grep -ohE '^[A-Z_0-9]+=' .env .env.* 2>/dev/null | tr -d '=' | sort -u > /tmp/env-declared.txt

# Every variable the project's own code and config resolve
grep -rhoE '%env\(([a-zA-Z:]+:)?[A-Z_0-9]+\)%|process\.env\.[A-Z_0-9]+|getenv\(['"'"'"][A-Z_0-9]+' src/ config/ 2>/dev/null \
  | grep -oE '[A-Z_0-9]{3,}' | sort -u > /tmp/env-used-by-project.txt

# The leftovers: declared for someone, and that someone is the framework
comm -23 /tmp/env-declared.txt /tmp/env-used-by-project.txt
```

Read every leftover, and sort it into one of three:

- **A vendor-owned channel** — grep the vendored framework for the variable and
  record the flow it configures. This is the yield of the whole sweep.
- **Dead configuration** — a variable for a feature whose library is not
  installed and whose flag is off. Record it as a `dead` flow with that proof,
  rather than deleting it silently: a phantom integration removed without a
  record comes back in the next environment file.
- **Infrastructure, not a flow** — log levels, debug switches, secrets for
  channels already recorded.

Then the flags, because a flag that enables a feature enables that feature's
calls out:

```bash
grep -rhE '^(FLAG_|FEATURE_|ENABLE_)[A-Z_0-9]+=' .env* 2>/dev/null | sort -u
```

## 7. Runtime evidence (the only thing that proves `live`)

Needs access to a running environment. Everything above proves intent; only this
proves traffic — and it is what closes most unknowns in minutes.

```bash
# Who actually publishes and consumes on the broker
rabbitmqctl list_bindings | grep <exchange-or-queue>
rabbitmqctl list_queues name messages consumers

# Who calls an inbound HTTP route, and how often
grep -h '<path>' /var/log/nginx/access.log* | awk '{print $1}' | sort | uniq -c | sort -rn | head

# Which credentials exist against this application's API
# (the client/connection table of whatever issues them)

# Where outbound calls actually go, live
# tcpdump / the service mesh's own traffic view / the egress firewall's log
```

The egress log deserves the last word: it is the only source that answers "what
does this application talk to" without presupposing the answer, and it routinely
returns a host nobody in the sweep predicted.
