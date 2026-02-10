
## Plan: Clickable Email with Account Settings Popup

### What Changes

The user's email displayed in the sidebar footer will become clickable. Clicking it opens a dialog/popup where the user can view and edit their account details (email, password) and manage preferences.

### Implementation

**1. New Component: `AccountSettingsDialog.tsx`**

Create `src/components/settings/AccountSettingsDialog.tsx` with:
- A responsive dialog (uses `ResponsiveDialog` for mobile support)
- Sections for:
  - **Email display** (read-only, shows current email)
  - **Change password** form (current not required by the auth system, just new password + confirm)
  - **Sign out** button
- Uses `useAuth()` to get the current user and the Supabase client's `updateUser` method for password changes
- Shows toast on success/error

**2. Sidebar Update: Make Email Clickable**

Modify `src/components/layout/AppSidebar.tsx`:
- Replace the static email `<div>` (line 128-130) with a clickable button that opens the `AccountSettingsDialog`
- Style it with a hover effect and cursor pointer so it's clear it's interactive

**3. Account Tab in Settings Page**

Update `src/pages/Settings.tsx`:
- Replace the placeholder "Account Settings" card content (lines 147-156) with the same account settings form inline (or reuse a shared component), so users can also access it from the Settings tab directly

### Files

| File | Action |
|------|--------|
| `src/components/settings/AccountSettingsDialog.tsx` | Create |
| `src/components/layout/AppSidebar.tsx` | Modify -- make email clickable, open dialog |
| `src/pages/Settings.tsx` | Modify -- replace placeholder Account tab with real content |

### Technical Details

- Password update uses `supabase.auth.updateUser({ password })` 
- Email is displayed read-only (changing email requires verification flow which adds complexity)
- The dialog includes: current email display, password change form with validation (min 6 chars, confirm match), and a sign-out button
- Form validation via simple state checks (no need for react-hook-form for 2 fields)
