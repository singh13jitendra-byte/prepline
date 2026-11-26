/**
 * The three Night Desk SVG filters. Mount once per page (StoryRoot), before any drawing.
 * Parameters are exactly those in brand/night-desk/art-list.md section 2.
 *
 *  #nd-hand    scenes: slow wobble, then a slight blur to re-antialias the displaced edge
 *  #nd-hand-s  marks under 64px: tighter, smaller wobble
 *  #nd-riso    fills: flat ink with about 12% of pixels dropped out (grain)
 *
 * Regions are objectBoundingBox, so apply them to the <g> that holds a drawing,
 * never to a lone horizontal or vertical segment (zero-size box).
 */
export function RisoFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="nd-hand" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.45" />
        </filter>
        <filter id="nd-hand-s" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="8" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="0.3" />
        </filter>
        <filter id="nd-riso" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.0" result="g" />
          <feComposite in="SourceGraphic" in2="g" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/** Name used in scroll-adaptation.md 2.4. Same component. */
export const ArtDefs = RisoFilters;
