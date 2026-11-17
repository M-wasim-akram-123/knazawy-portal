import type { CSSProperties } from 'react';

/**
 * The loading sign: the Karam cloche filling with water from the bottom up, a wave drifting on
 * the surface. The logo's own shape is the mask, so the water never spills outside it.
 * With reduced motion the logo is shown half full and still.
 */
export function KaramLoader({
  label,
  logoSrc = '/karam-dome-mark.png',
  size = 88,
  fullPage = false,
}: {
  /** Spoken to screen readers and shown under the logo, in the page language. */
  label: string;
  logoSrc?: string;
  size?: number;
  /** Centre in the whole window, for the first load of an app. */
  fullPage?: boolean;
}) {
  const style = {
    '--kz-logo': `url(${logoSrc})`,
    '--kz-loader-size': `${size}px`,
  } as CSSProperties;
  return (
    <div
      className={`kz-loader${fullPage ? ' kz-loader-page' : ''}`}
      role="status"
      aria-live="polite"
      style={style}
    >
      <span className="kz-loader-mark" aria-hidden="true">
        <span className="kz-loader-shape kz-loader-empty" />
        <span className="kz-loader-shape kz-loader-water">
          <span className="kz-loader-rise">
            <span className="kz-loader-wave" />
          </span>
        </span>
      </span>
      <span className="kz-loader-label">{label}</span>
    </div>
  );
}
