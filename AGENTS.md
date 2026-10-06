# Agent rules
- Public voice ordering lives at /commander and calls the voice-order edge function (transcribe + map to Shopify catalog); checkout passes delivery details as Shopify cart attributes that shopify-order-webhook maps to order fields — keeps Shopify the single source of orders.
- Commander mobile scrolling uses a native scroll container with a separate overlay indicator, enabled only on mobile, to avoid changing desktop layout or reserving scrollbar space.
- Commander cart variant selection uses a shared inline selector and the existing Storefront API to resolve variants by ID, independently of voice processing, so catalog choices never alter listening or comprehension.
