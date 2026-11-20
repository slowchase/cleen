# Cleen v6 — Admin and Daily Website

This is an update to v5. No database migration is included or required **if your existing v3 migration was applied**.

## Admin changes
- Small × beside every item in **Task / Quality / To Buy Quick Preview** (Draft and Published). A confirmation dialog precedes permanent deletion. Task-completion records cascade through the existing database foreign key. Uploaded photos deliberately remain in the private Storage bucket for manual photo-backup management; use the existing photo tools to manage those files.
- **Preview Entire To-Do List** is renamed **Preview**. The full white-screen preview is unchanged.
- The editor's **Post** button is removed. **Add** saves a draft. In Quick Preview, each draft still has a **Post** action so publication remains possible.
- New **Clear Published Tasks** button directly below **Add from Routine**. It asks for confirmation and moves all published Tasks, Quality, and To Buy items back to **Draft**, without deleting any tasks or photos. You can re-post them individually.

## Cleen Daily changes
- Checkboxes now have a stronger glowing mint green on completion and a sharp-cornered straight-line check mark.
- Rainbow-gradient confetti radiates outward in straight trajectories, with no rotating particles. Respects reduced-motion settings.
- Published tasks with YouTube instruction URLs (set directly on the task or through the linked Instruction record) show an embedded, privacy-enhanced YouTube player **after the task is expanded**. YouTube may restrict embedding on certain videos, so a Watch on YouTube link is included. Non-YouTube video URLs remain ordinary links. Supports watch, short, live, youtu.be, and embed URLs.
- Centered gray instruction **Select a task to reveal more info** under Tasks / Quality / To Buy tabs.

## Installation
1. Unzip and replace existing admin files with contents of `admin/` and existing GitHub Pages files with contents of `docs/` (including all HTML pages).
2. **Preserve your actual Supabase URL and publishable keys** in `admin/config.js` and `docs/config.js` before replacing them, or copy your current config.js files over these defaults.
3. No new SQL is necessary if your existing v3 migration is installed. An admin must have the original `tasks` DELETE and UPDATE privileges and RLS policies.
4. Try deleting a test draft, posting a draft, and clearing published test items. To test YouTube, save a video link in task Advanced fields or choose an Instruction containing a video link, publish that draft, then expand it in Cleen Daily.

## Notes
The app uses Supabase and CDN scripts and needs internet access. Changes were syntax checked; **live Supabase behavior and YouTube player playback have not been verified** against your specific project and video.
