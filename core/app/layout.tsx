// =========================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =========================================================================
// 1. In BigCommerce Stencil, `base.html` wrapped every single page in your store.
//    It contained the <html> and <body> tags, global stylesheets, and the header/footer.
// 
//    In Next.js (Catalyst), this is called the "Root Layout" (layout.tsx).
//    Any page rendered in this directory will automatically be wrapped by this layout.
//    Since Catalyst supports multiple languages (locales), the actual <html> and <body> 
//    tags are defined deeper in `app/[locale]/layout.tsx`, but this file serves as the 
//    absolute top-level wrapper.

import { PropsWithChildren } from 'react';

// =================================================================================
// 2. TYPESCRIPT TIP: `PropsWithChildren`
// =================================================================================
//    In JavaScript, you can pass any variables into a function. TypeScript forces us 
//    to declare exactly what variables (Props) a component expects.
//    `PropsWithChildren` is a built-in React type that says: "This component will 
//    receive a `children` variable (which is a chunk of HTML/React code)."
//    Since we have a `not-found.tsx` at the root, a layout file is required even if
//    it just passes children through. 
export default function RootLayout({ children }: PropsWithChildren) {
  // =================================================================================
  // 3. THE ROOT COMPONENT
  // =================================================================================
  //    In Stencil, `base.html` contained literal HTML like `<html>`, `<head>`, and `<body>`.
  //    It also contained `<head>` tags like `<title>` and `<link>` for stylesheets.
  //
  //    In Next.js App Router, the layout at `app/layout.tsx` is the equivalent of `base.html`.
  //    However, because Catalyst supports multiple languages (locales) and the `<html>` tag 
  //    needs a `lang="en"` attribute, the actual `<html>` and `<body>` tags are defined 
  //    one folder deeper in `app/[locale]/layout.tsx`.
  //
  //    This file right here is the absolute top-level wrapper. Because it sits at the very 
  //    root of the `app/` folder, Next.js will take whatever page the user visits 
  //    (e.g. the homepage) and pass it into this function as the `children` variable.
  //
  // 4. `children` is exactly like `{{{body}}}` in Stencil's base.html.
  //    We just return it directly so Next.js can continue rendering downwards to the 
  //    next layout (`app/[locale]/layout.tsx`).
  return children;
}
