// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, the server automatically injected all store data into a global `{{context}}` object.
//    You had no control over what was fetched. If a category had 10,000 products, Stencil 
//    loaded everything it thought you might need, which often made pages slow and heavy.
// 
//    In React / Catalyst, we use Explicit GraphQL Fetching. 
//    We only ask for EXACTLY the fields we need to render the UI, and nothing more!
//    This file is responsible for fetching exactly the data the `Category` page needs.
import { cache } from 'react';

import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import { BreadcrumbsCategoryFragment } from '~/components/breadcrumbs/fragment';

// =================================================================================
// 🎓 DEFINING THE QUERY (Replacing Stencil's automatic data injection)
// =================================================================================
// 2. We write a GraphQL query string to declare what data we need from BigCommerce.
//    The `graphql()` function (from `graphql-tada`) parses this string and ensures 
//    our TypeScript types are automatically generated! If you typo a field name, 
//    TypeScript will yell at you before you even run the code.
const CategoryPageQuery = graphql(
  `
    query CategoryPageQuery($entityId: Int!) {
      site {
        category(entityId: $entityId) {
          entityId
          name
          path
          # 3. We use a Fragment here (...BreadcrumbsFragment).
          #    In Stencil, you might use a partial like '{{> components/common/breadcrumbs}}'.
          #    In React/GraphQL, Fragments let UI components define their own data needs, 
          #    which we just "spread" in here so we don't have to write the fields out manually!
          ...BreadcrumbsFragment
          seo {
            pageTitle
            metaDescription
            metaKeywords
          }
        }
        categoryTree(rootEntityId: $entityId) {
          entityId
          name
          path
          children {
            entityId
            name
            path
            children {
              entityId
              name
              path
            }
          }
        }
        settings {
          inventory {
            defaultOutOfStockMessage
            showOutOfStockMessage
            showBackorderMessage
          }
          storefront {
            catalog {
              productComparisonsEnabled
            }
          }
          display {
            showProductRating
          }
          reviews {
            enabled
          }
        }
      }
    }
  `,
  [BreadcrumbsCategoryFragment],
);

// =================================================================================
// 🎓 FETCHING THE DATA (Server-Side)
// =================================================================================
// 4. We wrap our fetch function in React's `cache()`.
//    This guarantees that even if 5 different components call `getCategoryPageData(123)` 
//    during the same render cycle, we only make ONE single network request to BigCommerce!
//
// =================================================================================
// 🎓 TYPESCRIPT TIP: Optional Parameters (`?:`)
// =================================================================================
// 5. In `customerAccessToken?: string`, the `?` means this variable is optional.
//    If the user isn't logged in, we don't have a token, so it will be `undefined`.
//    TypeScript ensures we handle both the logged-in and guest states properly!
export const getCategoryPageData = cache(async (entityId: number, customerAccessToken?: string) => {
  const response = await client.fetch({
    document: CategoryPageQuery,
    variables: { entityId },
    customerAccessToken,
    // 6. If a user is logged in (has an access token), we bypass the Next.js cache 
    //    to ensure they see their personalized pricing (`cache: 'no-store'`).
    //    Otherwise, we leverage Next.js static caching for ultra-fast page loads (`next: { revalidate }`).
    fetchOptions: customerAccessToken ? { cache: 'no-store' } : { next: { revalidate } },
  });

  return response.data.site;
});
