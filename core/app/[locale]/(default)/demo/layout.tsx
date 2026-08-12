import { ReactNode } from 'react';

// =================================================================================
// 🎓 ULTIMATE TAILWIND CSS TUTORIAL SECTION (NEXT.JS LAYOUT)
// =================================================================================
// This layout wraps your Makeswift page. Instead of building the UI in the CMS,
// you are hardcoding the structure using Next.js and Tailwind CSS!

interface Props {
  children: ReactNode;
}

export default function DemoLayout({ children }: Props) {
  return (
    // 🎓 SECTION 1: THE WRAPPER
    // `min-h-[80vh]`: Ensures the layout is at least 80% of the screen height.
    // `bg-gradient-to-br`: A diagonal gradient.
    <div className="min-h-[80vh] bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 text-white p-8 md:p-16 flex flex-col items-center w-full">

      {/* 
        🎓 SECTION 2: TYPOGRAPHY
        `text-5xl md:text-7xl`: Responsive font sizes.
        `bg-clip-text text-transparent`: The secret to making gradient text!
      */}
      <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 text-center">
        Tailwind Page Sandbox
      </h1>

      <p className="text-xl md:text-2xl text-emerald-200 mb-12 max-w-2xl text-center font-light leading-relaxed">
        This is a hardcoded Next.js Layout. The area below is injected dynamically by Makeswift!
      </p>

      {/* 
        🎓 SECTION 3: CSS GRID & CARDS
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mb-12">
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-2xl font-bold mb-3 text-emerald-400">Hardcoded Next.js</h3>
          <p className="text-emerald-100/70">This entire section is written in code using Tailwind CSS. You cannot edit this text in Makeswift.</p>
        </div>
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="text-2xl font-bold mb-3 text-cyan-400">Makeswift Injection</h3>
          <p className="text-cyan-100/70">The dashed box below is the `{`children`}` prop. Makeswift will inject its drag-and-drop canvas right there!</p>
        </div>
      </div>

      {/* 
        🎓 SECTION 4: THE MAKESWIFT CANVAS (Dropzone)
      */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-6xl p-8 md:p-12">
        <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          Makeswift Canvas Area
        </h2>

        <div className="border-2 border-dashed border-emerald-500/30 rounded-2xl bg-black/20 min-h-[400px]">
          {/* 
            This is where the `/demo` Makeswift Page will be injected!
          */}
          {children}
        </div>
      </div>

    </div>
  );
}
