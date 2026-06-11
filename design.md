# Arctic AI Design Guide

## Purpose

This guide translates the styling in `styles.css` into practical design instructions for the Arctic AI Starter Kit.

Use it when creating new prototype screens, extending the starter components, or checking whether a new idea still feels aligned with the existing visual direction.

The goal is not to create a production design system. The goal is to keep prototype work visually cohesive, lightweight, and easy to adapt.

---

## Visual Direction

Arctic AI should feel calm, spacious, and softly technical.

The interface uses a pale atmospheric background, translucent glass surfaces, muted blue-gray text, and restrained accents. 

Design qualities to preserve:

- Soft glass panels over a subtle gradient background
- Compact but breathable spacing
- Rounded surfaces with light borders
- Muted blue-gray typography
- Small, functional controls
- Minimal shadows and low visual noise
- Clear hierarchy without heavy decoration

Avoid:

- Dark or saturated page backgrounds
- Heavy card shadows
- Thick borders
- Large decorative UI treatments

---

## Typography

Use Inter for all interface text.

```css
--font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

Use the existing compact type scale:

- Extra small: `12px`
- Small/body: `14px`
- Medium UI text: `16px`
- Large section title: `21px`
- Page heading: `28px`

### Hierarchy

Page headings use `28px`, medium weight, and tight line height. 

Section headings use `21px`, regular weight, and a softer tone. They introduce major groups such as Tasks or panel sections.

Panel headings and item titles use `14px` with semibold weight. Use these for cards, task titles, response headings, and compact labels.

Body copy uses `14px`, regular weight, relaxed line height, and subtle letter spacing. 

Metadata labels may use `10px` to `12px`, uppercase only when grouping chat history or similar utility content.

### Text Color

Use primary text for active controls and important compact UI:

```css
--text-primary: #334E5C;
```

Use secondary text for headings, body copy, descriptions, and most content:

```css
--text-secondary: #3A4C5F;
```

Use link blue sparingly for inline actions:

```css
a {
  color: #1d6de2;
}
```

---

## Color

The palette is built around cool blue-gray neutrals, soft white glass, and a bright blue action accent.

### Core Colors

- Background base: `#FBFCFD`
- Background wash: `#CCD6E0`
- Primary text: `#334E5C`
- Secondary text: `#3A4C5F`
- Divider: `rgba(51, 78, 92, 0.2)`
- Subtle heading label: `#99a6ad`
- Primary accent blue: `#2ABAF8`
- Link blue: `#1d6de2`

### Glass Surfaces

```css
--bg-glass: rgba(251, 252, 253, 0.6);
--glass-border: rgba(255, 255, 255, 0.65);
--glass-shadow: 0 1px 2px rgba(51, 78, 92, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.55);
--glass-panel-blur: blur(12px);
```

### Accent Usage

Use `#2ABAF8` for high-emphasis elements such as user message bubbles and primary status labels.

Use pale blue-gray fills like `#E6EBF0` and `#C7D2DC` for secondary labels, tags, and neutral badges.

Use stronger blues such as `#1932D5` only for small branded thumbnail treatments or isolated visual emphasis.

---

## Spacing

Use the existing size and spacing tokens instead of arbitrary values.

### Core Rhythm

- `4px`: tiny offsets, compact padding, icon adjustments
- `6px`: label padding and fine spacing
- `8px`: compact gaps and horizontal label padding
- `12px`: standard small gaps, button padding, inner control spacing
- `16px`: default component gap
- `18px`: slightly expanded stacked spacing
- `20px`: larger grouped spacing
- `24px`: panel padding, major gaps, page margins

Use `24px` as the main page margin and panel padding. Use `12px` to `16px` for most internal component spacing.


---

## Radius, Borders, and Effects

Use small rounded corners throughout:

- `4px` for labels, small buttons, and tiny UI elements
- `8px` for glass controls, cards, menus, and most surfaces
- `12px` for larger input containers
- `9999px` for avatars and fully round elements

Borders should be light and usually white or blue-gray with low opacity. Avoid dark outlines.

Use `blur(12px)` for glass panels and controls. Shadows should stay subtle. The default shadow is a light 1px elevation with an inner highlight; reserve larger shadows for hover lift or popovers.

---

## Layout

The prototype uses three primary layout layers:

1. Full-screen atmospheric background
2. Fixed left panel
3. Fixed content workspace

### Left Panel

The left panel is persistent application chrome. It starts at `22%` width, with `24px` page margin and a maximum width of `50%`. On very wide screens, it narrows to `15%`.

Keep the left panel flexible and scroll-safe:

- Use vertical flex layout
- Keep the top controls fixed within the panel structure
- Let home, chat, and chat-list content scroll internally
- Hide scrollbars where the existing CSS does
- Preserve the resize handle behavior

### Content Workspace

The main content area is a fixed glass panel that fills the remaining viewport. It uses `24px` inset from the window and `24px` padding inside the panel.

Use this area for primary prototype work. It should support single-column content, split panels, list-detail layouts, workspace-plus-chat layouts, and other product explorations.

Keep content panes modular. 

---

## Components

### Glass Panels and Cards

Use the shared glass style for:

- Menu groups
- Icon button backgrounds
- Chat title and search displays
- Home insight cards
- Query inputs
- Agent selectors

Glass components should use a light translucent fill, white border, `8px` radius, `12px` blur, and subtle inner highlight.

### Icon Buttons

Icon buttons are compact `40px` square controls with centered `16px` icons.

Keep icon buttons visually quiet:

- Transparent button element
- Glass background span when visible surface is needed
- No text labels unless the component pattern calls for it
- Pointer cursor for interactive elements

### Insight Cards

Insight cards use glass surfaces, `24px` padding, stacked spacing, and a subtle hover lift.

When stacking cards, use small vertical offsets and z-index layering. Hover may scale to `1.01` and receive a slightly stronger shadow, but avoid dramatic motion.

### Labels and Tags

Labels are compact, rounded, and functional.

Use primary blue labels for important metrics or health indicators. Use pale blue-gray labels for supporting metadata.

Keep label text at `14px` or smaller, with medium weight. Use bold only for the variable value or key number.

### Task Actions

Task action buttons are small outlined buttons with `4px` radius, compact padding, and secondary text color.

Use these for inline actions that should feel available but not dominant.

### Chat

Chat UI should remain lightweight and integrated with the panel.

User message bubbles use the accent blue fill, white text, `8px` radius, and a maximum width of `70%`.

AI responses use secondary text, regular `14px` copy, relaxed line height, and simple dividers between sections.

Demo AI messages may include compact action links (`home-task-action`) that open related prototype flows, such as the Events workspace for template-first event creation.

The query submission area is a glass container with `12px` radius and `140px` height. Keep the input minimal and avoid adding heavy form chrome.

### Page Switcher

The page switcher is the highest-elevation surface in the UI. It uses the base background, `8px` radius, `24px` padding, and a larger soft shadow.

Navigation items should remain compact and use a pale hover or selected background. Content rows should rely on spacing, thumbnail blocks, and small text rather than heavy separators.

---

## Motion and Interaction

Motion should be quick and subtle.

Existing patterns use:

- `0.1s ease-out` for panel resizing
- `0.2s ease` for hover color changes
- `220ms cubic-bezier(0.22, 1, 0.36, 1)` for card hover lift

Use motion to clarify interaction state, not to create decoration. Avoid long transitions, bouncy animations, and large movement.

---

## Implementation Rules

When adding new styles:

- Start with the existing CSS custom properties in `:root`
- Reuse the established spacing, color, radius, and type tokens
- Group related component styles under clear section comments
- Prefer simple class names that describe the UI role
- Keep prototype CSS readable and direct
- Add new tokens only when a value repeats or represents a real design decision

When designing new UI:

- Match the glass, blue-gray, and compact-control language
- Keep surfaces light and softly separated
- Favor layout clarity over decoration
- Use accent blue only for important action or status moments

