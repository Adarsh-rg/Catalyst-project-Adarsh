import React from 'react';
import Link from 'next/link';

interface LogoItem {
  image?: string | null;
  altText?: string;
}

// 🎓 TUTORIAL: Props Interface
// This defines the shape of the data that Makeswift will pass into our component.
// Every control we register in `register.ts` must have a corresponding prop here.
interface Props {
  heading: string;
  headingColor?: string | null;
  headingSize?: 'sm' | 'md' | 'lg' | 'xl';
  linkText: string;
  linkColor?: string | null;
  linkUrl?: { href: string; target?: string } | null;
  backgroundColor?: string | null;
  logos: LogoItem[];
  logoHeight?: number;
  logoGap?: number;
  animationSpeed: number;
}

export function FeaturedBrandsWidget({
  heading = 'Featured Brands',
  headingColor,
  headingSize = 'lg',
  linkText = 'VIEW ALL BRANDS \u2192',
  linkColor,
  linkUrl,
  backgroundColor,
  logos = [],
  logoHeight = 64, // Default to 64px (h-16)
  logoGap = 56, // Default to 56px (mx-14 is 56px on each side)
  animationSpeed = 30,
}: Props) {
  // 🎓 DYNAMIC TAILWIND CLASSES
  // Instead of fixed classes, we can map options from the CMS to specific Tailwind utility classes.
  const headingSizeClass = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-[42px]',
    xl: 'text-5xl md:text-6xl',
  }[headingSize] || 'text-4xl md:text-[42px]';

  // Use user-provided logos or fall back to placeholders
  const displayLogos = logos.length > 0 ? logos : [
    { image: 'https://via.placeholder.com/200x80?text=Brand+1', altText: 'Brand 1' },
    { image: 'https://via.placeholder.com/200x80?text=Brand+2', altText: 'Brand 2' },
    { image: 'https://via.placeholder.com/200x80?text=Brand+3', altText: 'Brand 3' },
    { image: 'https://via.placeholder.com/200x80?text=Brand+4', altText: 'Brand 4' },
    { image: 'https://via.placeholder.com/200x80?text=Brand+5', altText: 'Brand 5' },
    { image: 'https://via.placeholder.com/200x80?text=Brand+6', altText: 'Brand 6' },
  ];

  // Duplicate the array so we can scroll it seamlessly. The CSS animation translates it by -50%.
  const marqueeLogos = [...displayLogos, ...displayLogos];

  return (
    // 🎓 DYNAMIC INLINE STYLES: 
    // We use `style={{ backgroundColor }}` so the user's custom color from the CMS overrides the default `bg-white`.
    <section
      className="w-full py-16 md:py-20 bg-white overflow-hidden flex flex-col"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {/* 
        🎓 CUSTOM CSS ANIMATION:
        Tailwind makes standard animations easy, but for a perfect infinite marquee 
        based on a dynamic speed, injecting a scoped style tag is a very powerful trick! 
      */}
      <style>{`
        @keyframes infinite-scroll-half {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-infinite-scroll-half {
          animation: infinite-scroll-half var(--marquee-speed, 30s) linear infinite;
        }
      `}</style>

      {/* Header Area */}
      <div
        className="max-w-7xl mx-auto w-full px-6 flex flex-col md:flex-row md:items-end mb-14 gap-6"
        style={{ justifyContent: "space-between" }}
      >
        <h2
          className={`${headingSizeClass} font-bold text-[#1f2937] tracking-tight leading-none transition-colors duration-300`}
          style={headingColor ? { color: headingColor } : undefined}
        >
          {heading}
        </h2>

        {/* 
          🎓 CONDITIONAL RENDERING FOR LINKS:
          If the user provided a link in the CMS, render a Next.js <Link>.
          Otherwise, render a standard <span> tag.
        */}
        {linkUrl?.href ? (
          <Link
            href={linkUrl.href}
            target={linkUrl.target}
            className="text-[13px] font-bold text-[#1f2937] hover:opacity-70 transition-all uppercase tracking-[0.08em] flex items-center mb-1"
            style={linkColor ? { color: linkColor } : undefined}
          >
            {linkText}
          </Link>
        ) : (
          <span
            className="text-[13px] font-bold text-[#1f2937] uppercase tracking-[0.08em] flex items-center mb-1 cursor-pointer hover:opacity-70 transition-all"
            style={linkColor ? { color: linkColor } : undefined}
          >
            {linkText}
          </span>
        )}
      </div>

      {/* Marquee Area */}
      <div
        className="w-full overflow-hidden flex"
        // 🎓 CSS VARIABLES VIA REACT: We pass the speed down to our custom CSS via a variable!
        style={{ '--marquee-speed': `${animationSpeed}s` } as React.CSSProperties}
      >
        <div className="flex animate-infinite-scroll-half w-max items-center hover:[animation-play-state:paused]">
          {marqueeLogos.map((logo, index) => (
            <div
              key={index}
              // 🎓 INLINE GAP CONTROL: Overriding the default mx-14 using the user's custom gap choice
              className="flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 duration-300"
              style={{ paddingLeft: `${logoGap}px`, paddingRight: `${logoGap}px` }}
            >
              {logo.image ? (
                <img
                  src={logo.image}
                  alt={logo.altText || `Brand ${index + 1}`}
                  // 🎓 DYNAMIC IMAGE SIZING: The height is controlled by CMS, width auto-scales!
                  style={{ height: `${logoHeight}px`, width: 'auto' }}
                  className="object-contain"
                />
              ) : (
                <div
                  className="bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-medium rounded"
                  style={{ height: `${logoHeight}px`, width: `${logoHeight * 2.5}px` }}
                >
                  {logo.altText || 'Logo'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
