# PlateTrack

PlateTrack is a static HTML, CSS, and JavaScript prototype for a traffic enforcer license plate recognition workflow.

## Open The App

Open `index.html` directly in the browser.

On Crostini/Chromebook, the path may look like:

```text
file:///media/fuse/crostini_.../PlateTrack/index.html
```

## Main Screens

- `index.html` - access portal selection
- `enforcer-login.html` - traffic enforcer login
- `enforcer-register.html` - account registration
- `enforcer-dashboard.html` - dashboard and navigation hub
- `camera.html` - simulated plate detection flow
- `detection-result.html` - review detected vehicle and save a violation
- `violation-form.html` - manual or camera-assisted violation form
- `history.html` - saved violation records
- `profile.html` - officer profile and account actions
- `settings.html` - app preferences

## File Pattern

Each screen usually has:

- one HTML file in the project root
- one matching CSS file in `css/`
- one matching JS file in `js/`

Shared files:

- `css/modal.css` and `js/modal.js` - reusable app modal
- `css/theme.css` and `js/theme.js` - light/dark theme support

## Coding Notes

- Keep page-specific behavior in the matching `js/` file.
- Use `showSuccess`, `showError`, `showWarning`, and `showInfo` from `js/modal.js` for user messages.
- Store prototype data under `plateTrack...` keys in `localStorage`.
- Run a quick syntax check after JavaScript edits:

```bash
for f in js/*.js; do node --check "$f" || exit 1; done
```
