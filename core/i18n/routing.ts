// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, language translations were handled via simple JSON files (e.g. `en.json`),
//    and the store could only ever have one URL structure.
//
//    In Catalyst, we use `next-intl` to handle languages. Not only does it translate 
//    text, but it also automatically rewrites your URLs! 
//    If your default locale is `/en`, visiting `/es/products` will automatically serve 
//    the Spanish translation of the products page.
//
//    Why we use this: In Stencil, if someone searched your Spanish store on Google, 
//    Google would index the English URL because the URL didn't change. Here, `next-intl` 
//    gives every single language its own dedicated URL path (e.g. `/es/carrito`), 
//    which massively boosts SEO!
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

import { defaultLocale, locales } from './locales';

// =================================================================================
// 🎓 TYPESCRIPT TIP: `enum`
// =================================================================================
// 2. In JavaScript, you might use strings like `"always"` or `"never"` to configure things, 
//    but you could easily misspell them (e.g. `"alwys"`). 
//    TypeScript introduces `enum` (enumerations), which creates a strict list of allowed 
//    options. Now, if you try to use `LocalePrefixes.SOMETIMES`, TypeScript will throw an 
//    error before your code even runs!
enum LocalePrefixes {
  ALWAYS = 'always', // URLs will ALWAYS have a prefix (e.g. /en/cart, /es/cart)
  // NEVER = 'never', (Commented out due to a known bug in next-intl caching)
  ASNEEDED = 'as-needed', // removes prefix on default locale (e.g. /cart for EN, /es/cart for ES)
}

// 3. We choose ASNEEDED so the default language URLs stay clean
const localePrefix = LocalePrefixes.ASNEEDED;

// 4. `defineRouting` is the core configuration for next-intl's middleware.
//    In Stencil, there was no middleware, routing was hardcoded. Here we intercept
//    requests before they hit the page to inject the correct locale.
export const routing = defineRouting({
  locales, // The array of supported locales (e.g. ['en', 'es'])
  defaultLocale, // The fallback locale if none is specified
  localePrefix, // The prefix strategy defined above
  
  // 5. This configures the `NEXT_LOCALE` cookie to work inside of the Makeswift Builder's canvas.
  //    In Stencil, you didn't have to worry about iframe security for Page Builder, 
  //    but because Catalyst can be hosted anywhere, we must set these secure cookie flags.
  localeCookie: {
    partitioned: true, 
    secure: true, 
    sameSite: 'none', 
  },
});

// =================================================================================
// 🎓 REACT COMPONENTS (Replacing raw <a> tags)
// =================================================================================
// 6. In Stencil, you wrote standard HTML `<a href="/cart">Cart</a>`.
//    Standard Next.js has a `<Link>` component for navigating between pages without 
//    reloading the browser tab.
//
//    But because we want our links to automatically include the language prefix 
//    (e.g. `/es/cart` instead of just `/cart`), we use `createNavigation()`.
// 
//    When you build UI in Catalyst, ALWAYS import `Link` and `useRouter` from THIS 
//    file (`~/i18n/routing`), NOT from `next/navigation`!
export const { Link, redirect, usePathname, useRouter, permanentRedirect } =
  createNavigation(routing);
