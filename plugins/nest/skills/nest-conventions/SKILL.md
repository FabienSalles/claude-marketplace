---
name: nest-conventions
description: This skill should be used when creating NestJS modules, controllers, services, guards, pipes, or configuring dependency injection. Provides NestJS architectural conventions.
version: "1.0"
---

# NestJS Conventions

## Module Structure

**1 module = 1 bounded context.** Each module encapsulates its own controllers, services, and providers.

```typescript
// ✅ CORRECT - Self-contained module
@Module({
  imports: [SharedModule],
  controllers: [ReceiptController],
  providers: [
    ReceiptService,
    { provide: RECEIPT_REPOSITORY, useClass: DrizzleReceiptRepository },
  ],
  exports: [ReceiptService], // Only export what other modules need
})
export class ReceiptModule {}
```

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Module | `*.module.ts` | `receipt.module.ts` |
| Controller | `*.controller.ts` | `receipt.controller.ts` |
| Service | `*.service.ts` | `receipt.service.ts` |
| Guard | `*.guard.ts` | `auth.guard.ts` |
| Pipe | `*.pipe.ts` | `zod-validation.pipe.ts` |
| Filter | `*.filter.ts` | `http-exception.filter.ts` |
| Interceptor | `*.interceptor.ts` | `logging.interceptor.ts` |
| Test | `*.spec.ts` | `receipt.service.spec.ts` |

## Thin Controllers

Controllers handle HTTP concerns only. **Delegate all business logic to services.**

```typescript
// ❌ AVOID - Business logic in controller
@Controller('receipts')
export class ReceiptController {
  @Post()
  async create(@Body() dto: CreateReceiptDto) {
    const lease = await this.leaseRepo.findById(dto.leaseId);

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const amount = lease.monthlyRent;
    const receipt = { leaseId: dto.leaseId, amount, period: dto.period };
    return this.receiptRepo.save(receipt);
  }
}

// ✅ CORRECT - Controller delegates to service
@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post()
  async create(@Body(ZodValidationPipe) dto: CreateReceiptDto) {
    return this.receiptService.generate(dto);
  }
}
```

## Guards (Authentication / Authorization)

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException();
    }

    // Validate token...
    return true;
  }
}

// Usage: at controller or route level
@UseGuards(AuthGuard)
@Controller('receipts')
export class ReceiptController { ... }
```

## Pipes (Validation)

**Use a ZodValidationPipe** for DTO validation with Zod schemas:

```typescript
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return result.data;
  }
}

// Usage
@Post()
async create(
  @Body(new ZodValidationPipe(CreateReceiptSchema)) dto: CreateReceiptDto,
) {
  return this.receiptService.generate(dto);
}
```

> **See also**: `zod-conventions` for Zod schema patterns.

## Exception Filters

Centralized error handling:

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Register globally in main.ts
app.useGlobalFilters(new HttpExceptionFilter());
```

## Dependency Injection

### Token-based injection for interfaces

```typescript
// Define token
export const RECEIPT_REPOSITORY = Symbol('ReceiptRepository');

// Register in module
@Module({
  providers: [
    { provide: RECEIPT_REPOSITORY, useClass: DrizzleReceiptRepository },
  ],
})

// Inject in service
@Injectable()
export class ReceiptService {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly repo: ReceiptRepository,
  ) {}
}
```

### Prefer constructor injection

```typescript
// ✅ CORRECT - Constructor injection
@Injectable()
export class ReceiptService {
  constructor(private readonly repo: ReceiptRepository) {}
}

// ❌ AVOID - Property injection
@Injectable()
export class ReceiptService {
  @Inject() repo: ReceiptRepository;
}
```

## Quick Reference

| Rule | Convention |
|------|-----------|
| Module scope | 1 module = 1 bounded context |
| Controllers | Thin — delegate to services |
| Validation | ZodValidationPipe in @Body() |
| Auth | Guards at controller/route level |
| Error handling | Global exception filters |
| DI for interfaces | Symbol tokens + @Inject() |
| DI style | Constructor injection only |
| File naming | `feature.type.ts` pattern |
