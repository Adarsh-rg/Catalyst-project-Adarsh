// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, BigCommerce automatically fetched data and passed it to your templates.
//    You simply accessed it via `{{page}}` or `{{product}}`.
//    In Catalyst, YOU must explicitly ask BigCommerce for exactly what you need.
// This is done using GraphQL queries. This file (`page-data.ts`) is the dedicated 
// "data layer" for the `(default)` route group. 
// Any page in this folder (Home, Category, Checkout) can use these queries.

import { cache } from 'react';

import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import { FeaturedProductsCarouselFragment } from '~/components/featured-products-carousel/fragment';
import { FeaturedProductsListFragment } from '~/components/featured-products-list/fragment';
import { FooterFragment, FooterSectionsFragment } from '~/components/footer/fragment';
import { CurrencyCode, HeaderFragment, HeaderLinksFragment } from '~/components/header/fragment';

// =================================================================================
// 2. GRAPHQL QUERIES & FRAGMENTS
// =================================================================================
//    Notice the `graphql()` wrapper. This takes a raw GraphQL string and turns it into 
//    a strongly typed request that our API client can understand.
// 
//    What are "...HeaderFragment" and "...FooterFragment"?
//    These are GraphQL "Fragments". Think of them like Handlebars Partials but for data!
//    Instead of writing out every single field the header needs (logo, links, cart id) 
//    inside this main query, the `<Header>` component defines its own fragment.
//    This ensures that the query only asks for the exact data the UI actually uses.
//
//    💡 WHY WE USE THIS:
//    In Stencil, `{{context}}` contained EVERYTHING. It was massive, slow, and 
//    often full of data you didn't even use. GraphQL Fragments solve "Over-fetching".
//    We only download the exact bytes the browser needs to render the page, making 
//    Catalyst stores incredibly fast.
export const LayoutQuery = graphql(
  `
    query LayoutQuery {
      site {
        ...HeaderFragment
        ...FooterFragment
      }
    }
  `,
  [HeaderFragment, FooterFragment],
);

const GiftCertificatesEnabledFragment = graphql(`
  fragment GiftCertificatesEnabledFragment on Settings {
    giftCertificates(currencyCode: $currencyCode) {
      isEnabled
    }
  }
`);

export const GetLinksAndSectionsQuery = graphql(
  `
    query GetLinksAndSectionsQuery($currencyCode: currencyCode) {
      site {
        settings {
          ...GiftCertificatesEnabledFragment
        }
        ...HeaderLinksFragment
        ...FooterSectionsFragment
      }
    }
  `,
  [HeaderLinksFragment, FooterSectionsFragment, GiftCertificatesEnabledFragment],
);

const HomePageQuery = graphql(
  `
    query HomePageQuery($currencyCode: currencyCode) {
      site {
        featuredProducts(first: 12) {
          edges {
            node {
              ...FeaturedProductsListFragment
            }
          }
        }
        newestProducts(first: 12) {
          edges {
            node {
              ...FeaturedProductsCarouselFragment
            }
          }
        }
        settings {
          inventory {
            defaultOutOfStockMessage
            showOutOfStockMessage
            showBackorderMessage
          }
          newsletter {
            showNewsletterSignup
          }
        }
      }
    }
  `,
  [FeaturedProductsCarouselFragment, FeaturedProductsListFragment],
);

// =================================================================================
// 3. THE FETCH FUNCTION & CACHING
// =================================================================================
//    This is the actual function that `page.tsx` will call to get the home page data.
//    Note the `cache()` wrapper around the async function.
//    Next.js uses this to deduplicate requests. If you call `getPageData()` 5 times 
//    on the same page load, Next.js intercepts it and only hits BigCommerce ONCE.
//
//    💡 WHY WE USE THIS:
//    In Stencil, the server generated the HTML and sent it down. Caching was a black box.
//    In Next.js, YOU control the caching. We wrap the fetch in `cache()` so that no matter 
//    how many React Components ask for this data, we only make one network request to BigCommerce.
// =================================================================================
// 4. TYPESCRIPT TIP: `async` and `await`
// =================================================================================
//    Network requests take time. In Stencil, the server handled this secretly. 
//    In React/TypeScript, we use `async` to mark a function as "this will take some time", 
//    and `await` to say "pause here until BigCommerce returns the data".
export const getPageData = cache(
  async (currencyCode?: CurrencyCode, customerAccessToken?: string) => {
    
    // `client.fetch` is the core network request. It takes your GraphQL `HomePageQuery`
    // and sends it to the BigCommerce Storefront API.
    const { data } = await client.fetch({
      document: HomePageQuery,
      customerAccessToken,
      variables: { currencyCode },
      
      // `fetchOptions`: If the user is logged in (has a token), we DO NOT cache the data 
      // because prices might be custom to them. If they are logged out, we cache it 
      // heavily (`revalidate`) so the site stays lightning fast for anonymous traffic.
      fetchOptions: customerAccessToken ? { cache: 'no-store' } : { next: { revalidate } },
    });

    return data;
  },
);
