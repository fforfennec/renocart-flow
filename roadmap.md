# Commander purchase list
- [x] Show RenoCart's same-day value promise and the 200-entrepreneurs line at the top of the mobile welcome screen, with the heading and arrow centred below it.
- [x] Redesign mobile welcome around the microphone, switch to the shopping list after submission, and open conversation history and delivery from bottom controls; verified with a real catalog request, editable delivery, no overflow, unchanged desktop and 18 passing tests.
- [x] Replace blank checkout with same-tab payment on standalone pages and allow missing details; sandboxed preview uses a clicked link to ready checkout in a new tab; verified real catalog payment and native address/contact fields.
- [ ] Add missing date/time/truck fields on Shopify payment — needs Shopify checkout customization and compatible plan/app, unavailable through the current store connection.
- [x] Keep preselected delivery day, time and truck editable; remove repeated desktop titles and Restart; verified real catalog order on desktop/mobile, persisted selections and tests.
- [x] Remove the “Compléter la commande” screen; validate delivery info from the cart and check out directly; move the project scrolling band into the Livraison card under the shopping list.
- [x] Show missing delivery details under the shopping list as light scrolling chip bands (day, moment, truck, address); verify desktop/mobile, project-address shortcut and checkout prefill.
- [x] Restyle order completion with an Amazon-inspired layout and verify delivery validation and product review.
- [x] Show complete product names with an adaptive layout; move price notice below “Ta liste d'achat”.
- [x] Add “Compléter la commande” and a delivery-details screen before Shopify checkout; verify the flow.

# Admin navigation and client profiles
- [x] Add persistent unread supplier/client message counts and Overview conversation windows; verify authenticated flows.
- [x] Group and rename the admin menu links; keep FAQ separate.
- [x] Add admin-only client profiles with projects, invoices, totals and project management.
- [x] Verify authenticated navigation, client detail, project editing and PDF/ZIP downloads.

# Commander suggestions
- [x] Add authenticated suggestion rules, Shopify validation and proposal/acceptance statistics.
- [x] Show one buttons-only suggestion card after list completion, plus declined cart reminders.
- [x] Adjust accepted quantities with undo after materials change; persist conversation choices.
- [x] Verify desktop/mobile with fixtures, screw-word unit tests, live empty evaluation and unchanged voice pipeline.
- [ ] Configure real suggestion products and ratios — waiting for the user's rules; no ratios invented.
- [ ] Verify live rule save, Shopify screw rejection and real offer statistics — requesting user's account has supplier role, not admin.
# Gestion de projet
- [x] Client accounts, projects, invoices (single + ZIP), totals and materials at /projets.
- [x] Project choice in /commander (strip at start / question at end), address prefill, project sent to Shopify.
- [ ] Shopify-store login reuse — needs Shopify customer accounts setup.
