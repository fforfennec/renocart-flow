# Agent rules
- Public voice ordering lives at /commander and calls the voice-order edge function (transcribe + map to Shopify catalog); checkout passes delivery details as Shopify cart attributes that shopify-order-webhook maps to order fields — keeps Shopify the single source of orders.
- Commander mobile scrolling uses a native scroll container with a separate overlay indicator, enabled only on mobile, to avoid changing desktop layout or reserving scrollbar space.
- Commander carts share a compact product row with an inline variant selector using the existing Storefront API independently of voice processing, so desktop and mobile controls stay consistent without altering listening or comprehension.
- Commander suggestions use an independent authenticated rules service with server-side Shopify validation, public evaluation and idempotent offer tracking; this keeps recommendations separate from the locked voice pipeline.
