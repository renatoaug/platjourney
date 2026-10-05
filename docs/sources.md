# Sources

- PSN has no public API; `psn-api` is a reverse-engineered client. Keep polling modest (the default is one summary call per user every 15 minutes, users swept one at a time) and never use your main account's NPSSO.
- The deep guide only reads pages that are served to a plain client and allowed by the site's `robots.txt`; sites that answer 403 are left alone. Passages are used as retrieval context, never shown as-is, and every answer names its source.
- Guides and recommendations are researched from public sites and cite them by name. They can be wrong; the game's own trophy list from PSN is the source of truth for progress.
