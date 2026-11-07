# Pulse visual system

Purpose: a desktop-first stock research and paper-trading terminal. Prioritise the selected stock, chart, watchlist and trade ticket over decorative statistics.

- Background #0c0f14; surfaces #11151c; borders #222832. Restrained elevation, no glass surfaces.
- Primary text #dce1e9; muted text #7b8595. Inter for controls and tabular financial data; DM Sans for the product name and page heading. System font fallback when offline.
- Positive #4fcea3; negative #ed777c; primary action #b9e3a2; amber denotes simulation and waiting states. Values retain signed percentages so direction does not rely solely on colour.
- Spacing: 4, 8, 12, 16, 20, 24, 32 px. Controls 28–43 px, panel radii 7 px, inputs 5 px.
- Panels have compact headings, subtle row dividers, low-contrast metadata and numeric columns aligned right.
- Buttons have hover, keyboard focus, pressed, and disabled states. Inputs have persistent labels. Search is a keyboard-trapped dialog; Escape closes overlays; Cmd/Ctrl+K opens search.
- Candles use green/red bodies and wicks; volume uses muted versions of the same colours. Thin grid lines, a crosshair with OHLC legend and visible price labels preserve chart readability.
- Layout: fixed sidebar, top command bar, market strip, chart/portfolio column, watchlist/movers column, order/account column. Collapse to two columns on smaller desktops and a vertical flow with a navigation drawer on mobile.
- Price flashes and skeletons respect reduced-motion preferences. Simulated data remains explicitly labelled across the page and chart.
