# ResearchOS — Editorial Research Studio

Design source: `design/researchos_editorial_prototype.html`, the accompanying brief and desktop/mobile previews. The prototype supplies visual direction only; no prototype fixture data, demo event handlers, iframe, activity chart or fabricated confidence value was added to the application.

## Completed groups

- Design system/shell/dashboard: centralized warm ivory, forest, terracotta and sage tokens; Georgia editorial headings with existing Inter body font; paper surfaces; metric, heading and skeleton components; real dashboard summary and research links; four-step progress derived from stored research status; CSS/SVG orbital illustration. Sidebar active accent, named breadcrumb, keyboard search, real account menu, responsive drawer with focus containment, Escape, focus restoration and inert background.
- Workflow/auth: readable research forms and paper/sage planning panels; responsive vertical mobile stepper; matching login/register pages; retained validation, cookies, redirects and six-character password policy. No changes to AuthProvider or session/API code as part of this redesign.
- PDF library/reading room/chat: card/list view with filename, ingestion status, page count, size and upload date; search/filter/upload controls; real PDF blob viewer and page selection; reading-focused chat bubbles, source cards and composer. Errors do not simultaneously masquerade as empty data.
- Evidence/reports/memory/settings: serif evidence quotations with existing real relevance scores; academic report typography and a collapsible TOC generated from actual rendered headings; existing PDF/DOCX export preserved; explicit memory review actions; real account information and connection checks.

## Structure

Shared tokens and layers are in `src/styles/{tokens,editorial,workflow-editorial,knowledge-editorial,review-editorial}.css`. Existing page styles consume the same tokens; old violet/blue aliases remain compatible with existing component APIs but render in the editorial palette. No gradients or glow effects remain. Evidence/report baseline styles are imported before the shared theme to prevent lazy-navigation CSS order from reverting it.

Reusable components: `PageHeader`, `SectionHeading`, `MetricCard`, `Skeleton`, `ResearchOrbit`. Existing Card/Button/Badge behavior and routing contracts remain available. Interface labels are Vietnamese; user-supplied research, filenames and backend report content remain unchanged. No external font requests or new heavy dependencies were added.

## Verification

Builds were run after the shell/dashboard, workflow/auth, library/chat, and evidence/report/memory/settings groups. Browser tests include existing real HTTP/SQLite workflows plus `tests/editorial.spec.js`: dashboard at 375/390/768/1024/1440px, eight route families at 375/768/1440px, no horizontal page overflow, drawer focus/keyboard behavior, Ctrl+K, account Escape and real-data metrics. The workflow test creates and saves research/search/evidence/reports through the isolated test backend; production pages never import test fixtures. PDF ingestion, citation navigation, chat/memory approval and PDF/DOCX exports remain covered by existing E2E tests.

Screenshots are saved under `/tmp/researchos-editorial-{dashboard,workflow,research,library,chat,memory,evidence,report,settings}-WIDTH.png`; auth screenshots remain under `/tmp/researchos-register-WIDTH.png`.

Key normal-size text contrasts were checked against their backgrounds: muted ink/paper 5.90:1; terracotta text/paper 6.13:1; teal/paper 4.53:1; CTA ink/terracotta 4.81:1. Reduced motion disables transitions/animations. This is not a claim of a complete independent WCAG audit.

## Boundaries

Backend, database, Docker, n8n, API clients, AuthProvider and data-processing logic were not modified during this frontend redesign. Pre-existing uncommitted changes were retained. No commit, push, merge or deployment was performed. Live VPS/browser PDF behavior and production provider responses still require the usual deployment smoke test. The prototype's illustrative activity chart was omitted because the current backend does not provide that time series.
