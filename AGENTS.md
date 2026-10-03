# Agent rules
- Public voice ordering lives at /commander and calls the voice-order edge function (transcribe + map to Shopify catalog); checkout passes delivery details as Shopify cart attributes that shopify-order-webhook maps to order fields — keeps Shopify the single source of orders.
