// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, `base.html` contained the `<html>` and `<body>` tags, and it 
//    wrapped every page in your store. You injected the body using `{{{body}}}`.
// 
//    In Next.js App Router, this file (`app/[locale]/layout.tsx`) does the exact same thing.
//    The `<RootLayout>` component receives a `children` prop (which represents the 
//    specific page being loaded, like the Home page or Product page), and wraps it 
//    in the `<html>` and `<body>` tags. 

import { getSiteVersion } from '@makeswift/runtime/next/server';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { clsx } from 'clsx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
// Next-intl provides internationalization, replacing Stencil's lang JSON files
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
// nuqs manages URL query state, replacing manual URL parsing in JS
import { NuqsAdapter } from 'nuqs/adapters/next/app';
// React's cache deduplicates data fetching, similar to how Stencil might cache API calls but automatic
import { cache, PropsWithChildren } from 'react';

import '../../globals.css';

import { fonts } from '~/app/fonts';
import { CookieNotifications } from '~/app/notifications';
import { Providers } from '~/app/providers';
import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import { WebAnalyticsFragment } from '~/components/analytics/fragment';
import { AnalyticsProvider } from '~/components/analytics/provider';
import { ConsentManager } from '~/components/consent-manager';
import { ScriptsFragment } from '~/components/consent-manager/scripts-fragment';
import { ContainerQueryPolyfill } from '~/components/polyfills/container-query';
import { scriptsTransformer } from '~/data-transformers/scripts-transformer';
import { routing } from '~/i18n/routing';
import { SiteTheme } from '~/lib/makeswift/components/site-theme';
import { MakeswiftProvider } from '~/lib/makeswift/provider';
import { getToastNotification } from '~/lib/server-toast';

import '~/lib/makeswift/components';

// =================================================================================
// 2. GLOBAL DATA FETCHING (GraphQL)
// =================================================================================
//    In Stencil, `theme_settings` were just magically available everywhere.
//    In Catalyst, even the root layout must fetch its own data. This GraphQL query 
//    asks BigCommerce for the global store name, SEO settings, and privacy/analytics scripts.
// Define a GraphQL query document using the `graphql` utility function.
const RootLayoutMetadataQuery = graphql(
  `
    query RootLayoutMetadataQuery {
      site {
        settings {
          url {
            vanityUrl # The base URL of the store
          }
          privacy {
            cookieConsentEnabled # Whether to show cookie consent banner
            privacyPolicyUrl # URL to the store's privacy policy
          }
          storeName # The name of the store
          seo {
            pageTitle # Default SEO title
            metaDescription # Default SEO description
            metaKeywords # Default SEO keywords
          }
          ...WebAnalyticsFragment # Include analytics fields
        }
        content {
          ...ScriptsFragment # Include script manager scripts
        }
      }
      channel {
        entityId # The BigCommerce channel ID
      }
    }
  `,
  [WebAnalyticsFragment, ScriptsFragment], // Pass fragments used in the query
);

// Wrap the fetch call in React's `cache` to deduplicate identical requests during a render pass
const fetchRootLayoutMetadata = cache(async () => {
  // Execute the GraphQL query against the BigCommerce Storefront API
  return await client.fetch({
    document: RootLayoutMetadataQuery,
    // Specify caching behavior: use Next.js data cache and revalidate on demand
    fetchOptions: { next: { revalidate } },
  });
});

// =================================================================================
// 3. DYNAMIC SEO (Replacing Stencil's <title> tags)
// =================================================================================
//    Next.js uses this magic function `generateMetadata()` to automatically build the 
//    `<head>` of your HTML document. We take the data fetched from GraphQL above and 
//    map it to the Next.js Metadata object.
export async function generateMetadata(): Promise<Metadata> {
  // Fetch the global site settings using the cached function we defined above
  const { data } = await fetchRootLayoutMetadata();

  // =================================================================================
  // 4. TYPESCRIPT TIP: Optional Chaining (`?.`) and Nullish Coalescing (`??`)
  // =================================================================================
  //    In Stencil, if a variable was missing, Handlebars just printed nothing.
  //    In JS, reading `data.site.settings.storeName` will crash the whole page if `settings` is missing!
  //    To fix this, we use Optional Chaining (`?.`). It says: "If settings exists, get the storeName. 
  //    Otherwise, just stop and return undefined instead of crashing."
  //    Then, the `??` (Nullish Coalescing) says: "If the left side was undefined, use the right side ('')."
  const storeName = data.site.settings?.storeName ?? '';

  // Extract SEO fields (title, description, keywords)
  const { pageTitle, metaDescription, metaKeywords } = data.site.settings?.seo || {};

  // Extract the canonical store URL (vanity URL)
  const vanityUrl = data.site.settings?.url.vanityUrl;

  // Initialize a variable to hold the base URL for SEO canonicals
  let baseUrl: URL | undefined;
  
  // Check if we are running in a Vercel Preview environment
  const previewUrl =
    process.env.VERCEL_ENV === 'preview' ? `https://${process.env.VERCEL_URL}` : undefined;

  // Use the preview URL if available and valid
  if (previewUrl && URL.canParse(previewUrl)) {
    baseUrl = new URL(previewUrl);
  } else if (vanityUrl && URL.canParse(vanityUrl)) {
    // Otherwise use the production vanity URL
    baseUrl = new URL(vanityUrl);
  }

  // Return the constructed Metadata object which Next.js will convert to HTML meta tags
  return {
    metadataBase: baseUrl, // Base URL for relative links
    title: {
      template: `%s - ${storeName}`, // Format for sub-page titles
      default: pageTitle || storeName, // Fallback title
    },
    icons: {
      icon: '/favicon.ico', // Path to the favicon
    },
    description: metaDescription, // SEO meta description
    keywords: metaKeywords ? metaKeywords.split(',') : null, // Convert comma-separated string to array
    other: {
      platform: 'bigcommerce.catalyst', // Custom meta tag
      build_sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '', // Commit hash
      store_hash: process.env.BIGCOMMERCE_STORE_HASH ?? '', // Store hash identifier
    },
  };
}

// Vercel components for analytics and speed insights
// In Stencil, you might have added these via the Script Manager
const VercelComponents = () => {
  if (process.env.VERCEL !== '1') {
    return null;
  }

  return (
    <>
      {process.env.DISABLE_VERCEL_ANALYTICS !== 'true' && <Analytics />}
      {process.env.DISABLE_VERCEL_SPEED_INSIGHTS !== 'true' && <SpeedInsights />}
    </>
  );
};

// Define the TypeScript interface for the layout component props
interface Props extends PropsWithChildren {
  params: Promise<{ locale: string }>; // The dynamic route params (like /en/ or /es/)
}

// The main layout component, which is an async Server Component
export default async function RootLayout({ params, children }: Props) {
  // Await the params to extract the requested locale string
  const { locale } = await params;

  // Fetch the global data we need for the layout (SEO, settings, scripts)
  const rootData = await fetchRootLayoutMetadata();
  // Fetch any pending toast notifications stored in cookies
  const toastNotificationCookieData = await getToastNotification();
  // Fetch the current Makeswift builder version (for visual editing)
  const siteVersion = await getSiteVersion();

  // Validate the requested locale against the allowed locales
  if (!routing.locales.includes(locale)) {
    notFound(); // Return a 404 response if the locale is invalid
  }

  // Set the locale for static rendering (required by next-intl)
  setRequestLocale(locale);

  // Transform raw BigCommerce scripts into React-friendly script objects
  const scripts = scriptsTransformer(rootData.data.site.content.scripts);
  // Check if the cookie consent banner is enabled in settings
  const isCookieConsentEnabled =
    rootData.data.site.settings?.privacy?.cookieConsentEnabled ?? false;
  // Get the URL to the privacy policy page
  const privacyPolicyUrl = rootData.data.site.settings?.privacy?.privacyPolicyUrl;

  // =================================================================================
  // 5. RENDERING THE HTML SHELL
  // =================================================================================
  //    Notice how this returns standard JSX that looks like HTML.
  //    We wrap everything in `<Providers>` (which initializes React Contexts like the Cart),
  //    and the `{children}` down inside is exactly equivalent to `{{{body}}}`.
  return (
    // Provides Makeswift visual editor context down the tree
    <MakeswiftProvider locale={locale} siteVersion={siteVersion}>
      {/* Render the core HTML tag, applying font variables and setting language */}
      <html className={clsx(fonts.map((f) => f.variable))} lang={locale}>
        <head>
          {/* Inject dynamic CSS variables from Makeswift theme */}
          <SiteTheme />
        </head>
        {/* Render the body, ensuring it takes up at least the full viewport height */}
        <body className="flex min-h-screen flex-col">
          {/* Initialize internationalization on the client-side */}
          <NextIntlClientProvider>
            {/* Manage GDPR/Cookie consent state and script injection */}
            <ConsentManager
              isCookieConsentEnabled={isCookieConsentEnabled}
              privacyPolicyUrl={privacyPolicyUrl}
              scripts={scripts}
            >
              {/* Adapter for nuqs (Next Use Query State) for URL state management */}
              <NuqsAdapter>
                {/* Provide Vercel/custom analytics context */}
                <AnalyticsProvider
                  channelId={rootData.data.channel.entityId}
                  isCookieConsentEnabled={isCookieConsentEnabled}
                  settings={rootData.data.site.settings}
                >
                  {/* Provide global state like Cart Context and Customer Session */}
                  <Providers>
                    {/* Render any pending toast notifications */}
                    {toastNotificationCookieData && (
                      <CookieNotifications {...toastNotificationCookieData} />
                    )}
                    {/* Render the actual page content inside the layout */}
                    {children}
                  </Providers>
                </AnalyticsProvider>
              </NuqsAdapter>
            </ConsentManager>
          </NextIntlClientProvider>
          {/* Render Vercel Speed Insights and Analytics if configured */}
          <VercelComponents />
          {/* Add polyfills for CSS container queries if needed in older browsers */}
          <ContainerQueryPolyfill />
        </body>
      </html>
    </MakeswiftProvider>
  );
}

// generateStaticParams tells Next.js which locales to pre-build pages for at build time.
// This is like generating multiple language versions of a Stencil theme statically.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const fetchCache = 'default-cache';
