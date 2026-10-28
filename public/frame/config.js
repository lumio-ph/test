/*
 * Frame Studio settings. Edit this file to brand the generator for a campaign;
 * no build step is needed.
 *
 * overlays: ready-made frame designs (PNG, WebP or SVG with a transparent
 * window where the photo shows through). Put the files in frames/ and list
 * them here; they appear first in "Choose a frame". Design them at
 * 1080 × 1080 (they are stretched to fit Portrait and Story sizes, so give
 * those their own file with `format` if the stretch shows).
 *   textY: where the name sits, as a percentage of the height (default 84)
 *   textColor: colour of the name and designation (default white)
 *   showText: false if the frame artwork has no room for text
 *   format: 'square' | 'portrait' | 'story' to show the frame only at that size
 */
window.FRAME_STUDIO_CONFIG = {
  title: 'Frame Studio',
  defaults: {
    headline: 'Proud Fellow · Investment Cohort',
    tag: '#IncludedVCAfrica',
    name: '',
    designation: '',
    frame: 'halo',
    format: 'square',
    theme: 'included',
    font: 'Archivo',
    logoPos: 'tr',
  },
  // Shown until the person uploads their own logo; set to null for none.
  defaultLogo: 'img/included-vc-logo.png',
  overlays: [
    { id: 'sample-ribbon', name: 'Ribbon', src: 'frames/sample-ribbon.svg', textY: 85, textColor: '#ffffff', format: 'square' },
  ],
};
