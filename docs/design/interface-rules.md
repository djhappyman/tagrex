# Interface rules

Current direction agreed during the Settings restyle. Apply these rules when
iterating on this interface; older design briefs are historical context.

- Keep the existing theme colours, typography and familiar control shapes.
- Use spacing, tone and rounded surfaces to group content. Avoid outlining every
  field, row or section. Add a divider only when it marks a useful boundary.
- Use the shared `--input-radius` for standard inputs, selects and compound
  fields. It is currently 10px. Keep action buttons' established pill shapes.
- Give a focused field one clean accent outline. Compound fields own that
  outline around the whole group; avoid a second frame on the inner input.
  Use the error colour for invalid fields.
- Prefer a quiet filled input over a strong resting border when its surrounding
  surface gives enough contrast. Retain clear hover, focus and error states.
- Shadows represent depth and use dark translucent colours in both themes.
  Never derive a shadow from the text colour, which creates a pale dark-mode glow.
- Keep a quiet border around the outer dialog to separate it from the app.
  Inset a recessed content area from the outer edge and round its corners. Avoid
  combining that surface change with a redundant separator line.
- Build hierarchy with page headings, section headings, labels and concise help.
  Keep related help close to its setting. Avoid adding a card around every group.
- Preserve visible labels, keyboard access, selection and validation feedback.
  Check both themes and narrow windows. Quiet styling must stay discoverable.

These are shared visual defaults, not a reason to remove meaningful table,
selection, drag-position or error boundaries. Apply changes in reviewable steps.
