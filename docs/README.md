# LendLoop documentation

The [README](../README.md) is the quick start: local setup, environment variables and a tour. This folder holds the documents a software development lifecycle expects, grouped by phase. Each one links to the code and tests it describes rather than repeating them.

| Phase | Document | Read it when |
|---|---|---|
| Discover | [Product vision](product/vision.md) | You want the problem, the people it's for, and what's out of scope |
| Define | [User stories](product/user-stories.md) | You're building or testing a feature and need its acceptance criteria |
| | [Requirements traceability](REQUIREMENTS.md) | You need to show every brief requirement is implemented and tested |
| | [Non-functional requirements](requirements/non-functional.md) | You're checking security, privacy, accessibility, performance or reliability targets |
| Design | [Architecture overview](architecture/overview.md) | You're new to the codebase, or changing how parts talk to each other |
| | [Data model](architecture/data-model.md) | You're adding a field, index or query |
| | [API reference](architecture/api.md) | You're calling or changing a Convex function or an HTTP endpoint |
| | [Architecture decision records](architecture/adr/) | You want to know *why* something is the way it is before changing it |
| | [Design system](design-systems/design-system.md) | You're building UI: tokens, presets, components |
| Secure | [Threat model](security/threat-model.md) | You're changing a trust boundary (auth, webhooks, uploads) |
| | [Privacy and data handling](security/privacy.md) | You're adding or exposing personal data |
| Build | [Contributing](CONTRIBUTING.md) | You're about to write code or open a PR |
| Test | [Test plan](testing/test-plan.md) | You need to know which suite covers what, and how to run it |
| | [Concurrency tests](testing/concurrency.md) | You need evidence for competing lending and admin actions |
| Release | [Release checklist](operations/release-checklist.md) | You're shipping |
| | [Changelog](CHANGELOG.md) | You want to know what changed |
| Operate | [Deployment](operations/deployment.md) | You're setting up an environment |
| | [Runbook](operations/runbook.md) | Something is broken, or you need to do an operator task |
| | [SES SMTP](operations/ses-smtp.md) | You're configuring notification email, rotating credentials, or switching to Mailpit |
| | [Lighthouse summary](lighthouse/summary.md) | You want the latest performance and accessibility audit |
| Reference | [Glossary](glossary.md) | A term is unfamiliar |
