# Outreach workspace quick start

Code: /home/atif/outreach. AI workspace: /home/atif/uk_leadgen_saas.
Read both roots' AGENTS.md and the central QUICKSTART.md at startup and after compaction.
Project manifest: /home/atif/uk_leadgen_saas/projects/outreach/project.yaml.
Context and recovery: that project's context/CONTEXT_INDEX.md and memory/HANDOFF.md.
Keep project decisions in the central workspace rather than maintaining duplicate copies.

Example prompt: “Active project: outreach. Read its workspace rules, project manifest,
sources and handoff, inspect the repository, then work on [requested task].”

Run application commands from /home/atif/outreach. Existing package scripts: npm test,
npm run lint, npm run build, npm run dev. These were not run during context onboarding.
Before runtime/build verification inspect the current startup and database behavior, and
use isolated settings/data. Starting the server initializes workers that can process saved
jobs and email accounts. README.md describes legacy outreach; central PROJECT.md records
the lead-focused working-tree baseline. See the central handoff for actual checks.
