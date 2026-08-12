import React from 'react';
import Link from 'next/link';

// =================================================================================
// 🎓 ULTIMATE TAILWIND CSS TUTORIAL SECTION
// =================================================================================
// This component is designed as a full "Hero & Features" section to teach you Tailwind.
// Tailwind uses "utility classes" instead of separate CSS files. You build designs 
// by combining small, single-purpose classes directly in your JSX!

interface Props {
  heading: string;
  headingSize: 'md' | 'lg' | 'xl';
  headingColor?: string | null;
  subheading: string;
  heroImage?: string | null;
  buttonText: string;
  buttonLink?: { href: string; target?: string } | null;
  themeColor: 'cyan' | 'pink' | 'emerald';
  showFeatures: boolean;
  gridColumns: number;
}

export function DemoWidget({ 
  heading = 'Mastering Tailwind CSS', 
  headingSize = 'lg',
  headingColor,
  subheading = 'Learn how to build stunning, responsive layouts without writing a single line of custom CSS.', 
  heroImage,
  buttonText = 'Get Started',
  buttonLink,
  themeColor = 'cyan',
  showFeatures = true,
  gridColumns = 3,
}: Props) {
  
  // 🎓 DYNAMIC CLASSES: 
  // You can use standard Javascript objects to swap out Tailwind colors based on props!
  const themeClasses = {
    cyan: {
      gradient: 'from-slate-900 via-cyan-950 to-slate-900',
      text: 'text-cyan-400',
      button: 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/25',
      iconBg: 'bg-cyan-500/10 text-cyan-400',
    },
    pink: {
      gradient: 'from-slate-900 via-fuchsia-950 to-slate-900',
      text: 'text-fuchsia-400',
      button: 'bg-fuchsia-500 hover:bg-fuchsia-400 shadow-fuchsia-500/25',
      iconBg: 'bg-fuchsia-500/10 text-fuchsia-400',
    },
    emerald: {
      gradient: 'from-slate-900 via-emerald-950 to-slate-900',
      text: 'text-emerald-400',
      button: 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
    }
  };

  const theme = themeClasses[themeColor] || themeClasses.cyan;

  // 🎓 DYNAMIC TAILWIND LOGIC (Font Sizes):
  const headingSizeClass = {
    md: 'text-4xl md:text-5xl',
    lg: 'text-5xl md:text-7xl',
    xl: 'text-7xl md:text-9xl',
  }[headingSize] || 'text-5xl md:text-7xl';

  // 🎓 DYNAMIC TAILWIND LOGIC (Grid Columns):
  const gridColumnClass = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[gridColumns] || 'md:grid-cols-3';

  return (
    // 🎓 SECTION 1: THE WRAPPER (Spacing & Backgrounds)
    <section className={`w-full py-20 md:py-32 bg-gradient-to-b ${theme.gradient} text-white`}>
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col items-center text-center gap-8 mb-24">
          
          {/* 
            🎓 CUSTOM IMAGE UPLOAD:
            If the user uploaded an image in the CMS, we render it here!
            `object-cover`: Ensures the image fills the 120x120 box without stretching.
            `rounded-2xl`: Extra large rounded corners.
          */}
          {heroImage && (
            <img 
              src={heroImage} 
              alt="Hero image" 
              className="w-32 h-32 md:w-48 md:h-48 rounded-3xl object-cover shadow-2xl mb-4 border-4 border-white/10"
            />
          )}

          {/* 
            🎓 CUSTOM COLOR OVERRIDE:
            We use the `style` prop to apply the user's custom color from the CMS picker!
            If they didn't pick a color, we fall back to the Tailwind theme color.
          */}
          <h1 
            className={`${headingSizeClass} font-black tracking-tight max-w-4xl leading-[1.1]`}
            style={headingColor ? { color: headingColor } : undefined}
          >
            {heading}
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl font-light leading-relaxed">
            {subheading}
          </p>
          
          {/* 
            🎓 LINK COMPONENT:
            Here we check if the user selected a link in the CMS. If so, we wrap the button 
            in a Next.js <Link> tag. Otherwise, we just render a standard <button>.
          */}
          {buttonLink?.href ? (
            <Link 
              className={`px-10 py-4 mt-4 rounded-full font-bold text-lg text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${theme.button}`}
              href={buttonLink.href}
              target={buttonLink.target}
            >
              {buttonText}
            </Link>
          ) : (
            <button className={`px-10 py-4 mt-4 rounded-full font-bold text-lg text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${theme.button}`}>
              {buttonText}
            </button>
          )}
        </div>

        {/* 
          🎓 CONDITIONAL RENDERING:
          If the `showFeatures` checkbox in the CMS is checked, we render this block!
        */}
        {showFeatures && (
          <div className={`grid grid-cols-1 ${gridColumnClass} gap-8`}>
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
              <div className={`w-12 h-12 rounded-xl mb-6 flex items-center justify-center ${theme.iconBg}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Lightning Fast</h3>
              <p className="text-slate-400 leading-relaxed">Never leave your HTML again. Tailwind's compiler generates exactly the CSS you need.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
              <div className={`w-12 h-12 rounded-xl mb-6 flex items-center justify-center ${theme.iconBg}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">CSS Grid</h3>
              <p className="text-slate-400 leading-relaxed">Notice how these three cards perfectly align side-by-side on desktop, but stack on mobile.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
              <div className={`w-12 h-12 rounded-xl mb-6 flex items-center justify-center ${theme.iconBg}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Themeable</h3>
              <p className="text-slate-400 leading-relaxed">Using dynamic Javascript objects, you can completely change the color palette instantly.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
