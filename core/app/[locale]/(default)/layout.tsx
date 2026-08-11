// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. Next.js allows you to have *multiple* layouts. 
//    This file lives in the `(default)` folder, which means it wraps any pages inside 
//    the `(default)` group (like Home, Product, Category, etc). 
// 
//    If you created an `(account)` folder group, you could give it a totally different 
//    layout without the global Header and Footer!

import { setRequestLocale } from 'next-intl/server';
import { PropsWithChildren } from 'react';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';

// =================================================================================
// 2. TYPESCRIPT TIP: `interface` and `Promise`
// =================================================================================
//    Think of an `interface` like a strict contract. It tells TypeScript exactly what 
//    shape an object must have. 
//    Here, we define that `Props` extends `PropsWithChildren` (meaning it gets `children`), 
//    and it ALSO requires a `params` object.
// 
//    `Promise<{ locale: string }>` means that `params` isn't available instantly. 
//    It's a "Promise" that Next.js will eventually give us an object containing the `locale` 
//    (e.g. "en" or "es") once the route finishes loading.
interface Props extends PropsWithChildren {
  params: Promise<{ locale: string }>; // The dynamic route params containing the locale
}

// The DefaultLayout component is an async Server Component
export default async function DefaultLayout({ params, children }: Props) {
  // =================================================================================
  // 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
  // =================================================================================
  // 1. In Next.js, layout parameters (like `[locale]`) are treated as Promises 
  //    because they might be computed dynamically on the server at edge locations.
  //    We must `await` them before we can use the actual `locale` string (e.g. 'en-US').
  const { locale } = await params;

  // 2. We pass the `locale` into `setRequestLocale`. This tells the server-side translation 
  //    library (next-intl) which language file to use for all Server Components inside this layout.
  setRequestLocale(locale);

  // =================================================================================
  // 3. COMPOSING THE LAYOUT (Replacing Handlebars `{{> components/common/header }}`)
  // =================================================================================
  //    In Stencil's `base.html`, you used `{{> components/common/header }}` to inject the header,
  //    and `{{{body}}}` to inject the specific page content.
  //
  //    In React, we use "Component Composition". 
  //    `<Header />` is a fully self-contained React component. We just render it like an HTML tag!
  //    `{children}` is the exact equivalent of `{{{body}}}`. If the user is on the Homepage, 
  //    Next.js will take the Homepage component and plop it right where `{children}` is.
  //
  //    Notice how simple this is! Because `<Header />` and `<Footer />` fetch their own 
  //    data internally (like fetching the navigation tree or store logo), we don't 
  //    have to pass massive data objects down to them from this layout file!
  return (
    <>
      {/* 4. Render the global Header (navigation, search, logo) */}
      <Header />

      {/* 5. Render the specific page content (Home, Category, Product) */}
      <main>{children}</main>

      {/* 6. Render the global Footer (links, newsletter signup) */}
      <Footer />
    </>
  );
}
