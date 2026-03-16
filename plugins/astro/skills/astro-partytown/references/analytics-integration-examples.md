# Analytics Integration Examples

## Table of Contents
- [Google Analytics 4 Setup](#google-analytics-4-setup)
- [Google Tag Manager](#google-tag-manager)
- [Facebook Pixel](#facebook-pixel)
- [Custom Events](#custom-events)
- [Conditional Loading](#conditional-loading)
- [Cookie Consent Integration](#cookie-consent-integration)
- [Troubleshooting](#troubleshooting)

## Google Analytics 4 Setup

### Basic Setup

```astro
---
// src/layouts/Layout.astro
const googleAnalyticsId = import.meta.env.GOOGLE_ANALYTICS_ID;
---

<head>
  <!-- Load gtag.js in Partytown worker -->
  <script
    is:inline
    type="text/partytown"
    src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
  />

  <!-- Configure GA4 -->
  <script is:inline type="text/partytown" define:vars={{ googleAnalyticsId }}>
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', googleAnalyticsId);
  </script>
</head>
```

### With Page View Tracking

```astro
<script is:inline type="text/partytown" define:vars={{ googleAnalyticsId }}>
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', googleAnalyticsId, {
    page_path: window.location.pathname,
    page_title: document.title,
  });
</script>
```

## Google Tag Manager

```javascript
// astro.config.mjs
partytown({
  config: {
    forward: ['dataLayer.push'],
  },
}),
```

```astro
---
const gtmId = import.meta.env.GTM_ID;
---

<head>
  <script is:inline type="text/partytown" define:vars={{ gtmId }}>
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer', gtmId);
  </script>
</head>

<body>
  <!-- GTM noscript fallback (not in worker) -->
  <noscript>
    <iframe
      src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
      height="0"
      width="0"
      style="display:none;visibility:hidden"
    />
  </noscript>
</body>
```

## Facebook Pixel

```javascript
// astro.config.mjs
partytown({
  config: {
    forward: ['fbq'],
  },
}),
```

```astro
---
const fbPixelId = import.meta.env.FB_PIXEL_ID;
---

<script is:inline type="text/partytown" define:vars={{ fbPixelId }}>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', fbPixelId);
  fbq('track', 'PageView');
</script>
```

## Custom Events

### Tracking from Main Thread

```astro
<script>
  // This runs on main thread but calls are forwarded to worker
  document.querySelector('#cta-button').addEventListener('click', () => {
    // GA4 event
    window.dataLayer.push({
      event: 'cta_click',
      button_text: 'Sign Up',
    });

    // Or using gtag
    window.gtag('event', 'cta_click', {
      button_text: 'Sign Up',
    });
  });
</script>
```

### React Component Events

```tsx
// src/components/SignupButton.tsx
export default function SignupButton() {
  const handleClick = () => {
    // Forward to Partytown worker
    window.dataLayer?.push({
      event: 'signup_started',
      source: 'hero_section',
    });
  };

  return (
    <button onClick={handleClick} className="btn-primary">
      Sign Up Free
    </button>
  );
}
```

## Conditional Loading

### Production Only

```astro
---
const isProd = import.meta.env.PROD;
const gaId = import.meta.env.GOOGLE_ANALYTICS_ID;
---

{isProd && gaId && (
  <>
    <script
      is:inline
      type="text/partytown"
      src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
    />
    <script is:inline type="text/partytown" define:vars={{ gaId }}>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', gaId);
    </script>
  </>
)}
```

## Cookie Consent Integration

```astro
<script>
  // Only init analytics after consent
  window.addEventListener('consent-granted', () => {
    window.dataLayer.push({
      event: 'consent_update',
      analytics_storage: 'granted',
    });
  });
</script>
```

## Troubleshooting

### Script Not Running

1. Check `type="text/partytown"` is set
2. Verify `forward` config includes the function
3. Use `debug: true` to see worker logs

### Debug Mode

```javascript
// astro.config.mjs
partytown({
  config: {
    forward: ['dataLayer.push'],
    debug: import.meta.env.DEV, // Enable in dev only
  },
}),
```

### CORS Errors

Some scripts may not work in web workers. Fallback:

```astro
<!-- Use regular script if Partytown fails -->
<script
  is:inline
  src="https://problematic-script.js"
  async
/>
```
