---
name: Always browser-test frontend changes
description: After any frontend change, open the affected page in the browser before marking done — build checks alone are not enough
type: feedback
originSessionId: ca85bc4b-1ad5-4e9c-8d38-a2565d5356c8
---
After making frontend changes, always verify by opening the actual page in the browser (http://localhost:5173). A successful `npm run build` does NOT catch runtime ReferenceErrors or missing component definitions that only surface when a component renders.

**Why:** Added `ColorPicker` reference to Sites.jsx edit modal without defining it there. Build passed but the page threw `ReferenceError: ColorPicker is not defined` at runtime. Only caught when user visited the page.

**How to apply:** After any `.jsx` change, navigate to the affected route in the browser and confirm no console errors before declaring the task complete.
