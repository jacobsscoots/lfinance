# Landing Page for LifeHub

## What We're Building

A public-facing landing page that unauthenticated visitors see at `/`. Authenticated users bypass it and go straight to the dashboard. The page will have a hero section, feature highlights, and a top navigation bar with a "Coming Soon" button and an "Admin" login link.

## Routing Changes

- Create a new `/landing` route (or render inline at `/`)
- Update the `ProtectedRoute` wrapper on `/` so that instead of showing the `AuthForm` when not logged in, it redirects to the landing page
- Add a new `/login` route that shows the existing `AuthForm` (so the "Admin" link has somewhere to go)
- Authenticated users hitting `/` still see the Dashboard as before

## New Files

### `src/pages/Landing.tsx`

The full landing page with these sections:

**Top Nav Bar**

- Left: Life Tracker logo + name (matching sidebar branding)
- Right: "Coming Soon" button (disabled, with a subtle badge) + "Admin" text link to `/login`

**Hero Section**

- Headline: something like "Hit Your Macros, Every Single Day"
- Subtext explaining AI-powered portion optimisation for meal planning
- Gradient or illustration background using the purple palette
- A mock dashboard/phone visual or abstract graphic

**Feature Grid (4-5 cards)**

- AI-Powered Portion Optimisation
- Weekly Meal Planning with Calorie Cycling
- Auto-Generated Grocery Lists
- Daily Nutrition Target Tracking
- Budget-Friendly Meal Planning

**Footer**

- Minimal, matching the purple theme

### `src/pages/Login.tsx`

A thin wrapper that renders the existing `AuthForm` component at the `/login` route.

## Modified Files

### `src/App.tsx`

- Add `/login` route rendering `AuthForm` (no `ProtectedRoute` wrapper)
- Keep `/` route with `ProtectedRoute` wrapping `Dashboard`

### `src/components/auth/ProtectedRoute.tsx`

- Change the `if (!user)` branch: instead of returning `<AuthForm />`, redirect to the landing page
- Use `Navigate` from react-router-dom to send unauthenticated users to `/landing`

### `src/pages/Landing.tsx` (design details)

- Fully responsive (stacked on mobile, grid on desktop)
- Uses existing design tokens (purple primary, white cards, rounded corners)
- No sidebar or app shell -- standalone page with its own nav bar

## Technical Details

- The landing page is purely static with no database calls
- The "Coming Soon" button will be a `Button` with `disabled` and a `Badge` overlay
- The "Admin" link uses `react-router-dom`'s `Link` component pointing to `/login`
- The `/login` page re-uses the existing `AuthForm` unchanged
- After successful login on `/login`, the auth state change will redirect the user to `/` which now resolves to Dashboard (since they're authenticated)
- Mobile responsive using Tailwind's responsive breakpoints
- Consistent with the existing purple/white design system  
  
The website is now known as Lifehub 