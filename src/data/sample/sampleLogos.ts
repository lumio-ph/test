/**
 * Placeholder wordmarks for the fictional demo firms. Real firms supply a
 * logo file (see Firm.logoUrl); firms without one fall back to a typographic
 * wordmark rendered by <FirmMark>.
 */
const svg = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

export const exampleCapitalLogo = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 64">
  <rect x="2" y="10" width="44" height="44" rx="4" fill="#111"/>
  <path d="M14 22h20v5H20v5h12v5H20v5h14v5H14z" fill="#fff"/>
  <text x="58" y="40" font-family="Georgia, 'Times New Roman', serif" font-size="25" fill="#111" textLength="94" lengthAdjust="spacingAndGlyphs">Example</text>
  <text x="162" y="40" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-style="italic" fill="#5C5C5C" textLength="80" lengthAdjust="spacingAndGlyphs">Capital</text>
</svg>`);

export const horizonVenturesLogo = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 64">
  <circle cx="26" cy="38" r="18" fill="#1D3B5C"/>
  <rect x="2" y="38" width="48" height="22" fill="#fff"/>
  <rect x="4" y="40" width="44" height="3" fill="#1D3B5C"/>
  <rect x="10" y="46" width="32" height="3" fill="#1D3B5C"/>
  <text x="62" y="42" font-family="'Helvetica Neue', Arial, sans-serif" font-size="21" font-weight="700" fill="#1D3B5C" textLength="112" lengthAdjust="spacingAndGlyphs">HORIZON</text>
  <text x="184" y="42" font-family="'Helvetica Neue', Arial, sans-serif" font-size="21" font-weight="300" fill="#1D3B5C" textLength="118" lengthAdjust="spacingAndGlyphs">VENTURES</text>
</svg>`);
