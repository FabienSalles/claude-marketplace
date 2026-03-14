---
name: php-prg-pattern
description: This skill should be used when implementing form handling, POST requests, or any action that modifies data. Provides the Post/Redirect/Get pattern to prevent duplicate submissions.
version: "1.0"
---

# Post/Redirect/Get (PRG) Pattern

The PRG pattern prevents duplicate form submissions when users refresh the page after a POST request.

## The Problem

Without PRG, after a successful form submission:
1. User submits form (POST)
2. Server processes and returns HTML response
3. User refreshes page → **Browser re-sends POST** → Duplicate action!

## The Solution

```
┌─────────────────────────────────────────────────────────────┐
│                         PRG FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   GET /form ──────────► Display Form                        │
│        ▲                     │                              │
│        │                     ▼                              │
│        │              User fills & submits                  │
│        │                     │                              │
│        │                     ▼                              │
│   ┌────┴────┐          POST /form                           │
│   │ Refresh │                │                              │
│   │  safe!  │                ▼                              │
│   └────┬────┘     ┌──────────┴──────────┐                   │
│        │          │                     │                   │
│        │     Validation OK?        Validation KO            │
│        │          │                     │                   │
│        │          ▼                     ▼                   │
│        │    302 REDIRECT          Re-render form            │
│        │          │               with errors               │
│        │          ▼                                         │
│        └──── GET /success                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Rules

### 1. POST Success → Always Redirect

```php
if ($request->isMethod('POST')) {
    $selection = $request->request->getString('choice');

    if ($this->isValid($selection)) {
        // ✅ Success: REDIRECT (never return HTML)
        return new RedirectResponse(
            $this->urlGenerator->generate('next_step')
        );
    }

    // ❌ Error: Re-render form (no redirect)
    return $this->render(..., hasError: true);
}
```

### 2. POST Error → Re-render (No Redirect)

When validation fails, **re-render the form** with error messages. This is NOT a violation of PRG because:
- User needs to see their input + errors
- Refreshing will re-submit, but that's intentional (user correcting data)
- Redirecting would lose the submitted data

### 3. Flash Messages for User Feedback

When redirecting after success, use flash messages:

```php
// In controller
$this->session->getFlashBag()->add('success', 'Operation completed');
return new RedirectResponse(...);

// In template
{% for message in app.flashes('success') %}
    <div class="alert alert-success">{{ message }}</div>
{% endfor %}
```

## Complete Example

```php
#[Route(path: '/form', name: 'my_form', methods: ['GET', 'POST'])]
public function __invoke(Request $request): Response
{
    if ($request->isMethod('POST')) {
        $data = $request->request->all();

        if (!$this->validate($data)) {
            // Error: re-render with data
            return $this->render($data, hasError: true);
        }

        // Success: process and redirect
        $this->process($data);

        return new RedirectResponse(
            $this->urlGenerator->generate('success_page')
        );
    }

    // GET: display empty form
    return $this->render();
}
```

## Quick Reference

| Scenario | Response | Why |
|----------|----------|-----|
| GET request | Render form | Display form |
| POST + valid | **RedirectResponse** | PRG: prevent re-submit |
| POST + invalid | Render with errors | Show validation errors |
| POST + exception | Render with error | Show error message |

## Anti-Patterns

```php
// ❌ WRONG: Returning HTML after successful POST
if ($valid) {
    $this->save($data);
    return new Response('Success!');  // Refresh will re-submit!
}

// ❌ WRONG: Redirecting on error (loses user input)
if (!$valid) {
    return new RedirectResponse('/form?error=1');
}

// ✅ CORRECT
if ($valid) {
    $this->save($data);
    return new RedirectResponse('/success');
}

return $this->renderWithErrors($data);
```
