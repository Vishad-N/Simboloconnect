# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0-white-label] - 2026-06-09

### Added
- Complete environment separation configuration templates (`env/`).
- Automated package building tool (`scripts/build-distribution.sh`).
- Operations lifecycle scripts (`install.sh`, `update.sh`, `backup.sh`, `restore.sh`, `healthcheck.sh`, `migration.sh`).
- Domain-locking licensing framework documentation (`docs/LICENSE_SYSTEM.md`).
- Multi-step customer update guidelines (`docs/UPDATE_GUIDE.md`) and rollback procedures.
- SaaS reseller readiness report cards (`SAAS_READINESS_REPORT.md`) and white-label scans.
- Detailed step-by-step branding customizer manual (`docs/BRANDING_GUIDE.md`).

### Fixed
- Hardcoded brand-names, referrers, and emails parameterized to load cleanly from environment variables.
- Dynamic URL endpoints and Meta js-sdk versions converted to config variables.

### Database Changes
- No schema migrations. SQLite dev database files removed.

### Breaking Changes
- Support emails and backend domains now require environment variables definition; default fallbacks are disabled.

---

## [1.0.0] - 2026-06-05

### Added
- Initial stable release of the WhatsApp Automation Panel.
- Multi-channel support (Shopify, WooCommerce, Webhook).
- AI agent brain and calling campaign engines.
