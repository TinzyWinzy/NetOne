# NetOne palette and responsive layout

Reference: https://www.netone.co.zw/ inspected 2026-10-05. Its homepage markup uses #F87315 and #f97315, plus #000000, #18181a and #ffffff. These are observed interface colours, not a published corporate brand specification.

The app uses #f97315 orange, #18181a black and white panels. Orange controls use black text for contrast; text links use darker #a84300. Neutral greys support secondary evidence. The existing prototype N mark remains a prototype mark rather than an official logo.

Phone navigation uses two columns; forms use responsive grids, 16px inputs and at least 44px main controls. Tables preserve their readable columns within labelled, keyboard-focusable scroll containers. Grid children cannot expand the page. Login, site cases, comparisons and saved scenario actions adapt to narrow screens. Map marker colours and their legend use orange/black.

Verified all six main views at 320, 375, 390, 768 and 1440px without page-level horizontal overflow. Verified a mobile scenario run/save, site case, and absence of browser page errors. Mobile/desktop screenshots inspected. TypeScript and production build passed. QA screenshots are local ignored artifacts.
