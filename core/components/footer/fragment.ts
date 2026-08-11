// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, when you included a partial like `{{> components/common/footer}}`, 
//    you had to assume the global `{{context}}` had the data you needed.
// 
//    In Catalyst, the `<Footer>` component explicitly declares exactly what data it 
//    needs to function using "Fragments". 
//    A Fragment is just a chunk of a GraphQL query. By defining it here, the Footer 
//    component guarantees that the parent page (which runs the main query) will fetch 
//    this exact data and pass it down as Props.

import { graphql } from '~/client/graphql';

// =================================================================================
// 🎓 TYPESCRIPT TIP: GraphQL Type Generation
// =================================================================================
// 2. You might wonder, "How does TypeScript know what data is inside `FooterFragment`?"
//    The `graphql()` function triggers a background process (graphql-tada) that reads 
//    this string and automatically creates TypeScript Interfaces for it! 
//    This means if you misspell `storeName` in your React component, TypeScript will catch it.
export const FooterFragment = graphql(`
  # The fragment is named FooterFragment and applies to the Site type
  fragment FooterFragment on Site {
    settings {
      # 3. We need the store name for copyright text
      storeName 
      contact {
        # 4. Store address and phone number
        address 
        phone 
      }
      socialMediaLinks {
        # 5. Fetch social profiles (e.g., "Facebook", "Twitter")
        name 
        url 
      }
      logoV2 {
        # 6. Used by Apollo/Relay to know what kind of logo it is
        __typename 
        ... on StoreTextLogo {
          # 7. If it's a text logo, get the text
          text 
        }
        ... on StoreImageLogo {
          image {
            # 8. If it's an image logo, get the URL and alt text
            url: urlTemplate(lossy: true) 
            altText 
          }
        }
      }
    }
  }
`);

// =================================================================================
// THE FOOTER SECTIONS FRAGMENT
// =================================================================================
// 9. This fragment asks for the data needed to build the navigation links in the footer.
//    In Stencil, this data was magically available in `{{pages}}`, `{{categories}}`, and `{{brands}}`.
//    Here, we have to explicitly query for it using GraphQL.
export const FooterSectionsFragment = graphql(`
  fragment FooterSectionsFragment on Site {
    settings {
      # 10. Check if gift certificates are enabled for this store
      giftCertificates(currencyCode: $currencyCode) {
        currencyCode
        isEnabled
      }
    }
    content {
      # 11. Fetch the top-level web pages (About Us, Contact, etc)
      pages(filters: { parentEntityIds: [0] }) {
        edges {
          node {
            __typename
            name
            ... on RawHtmlPage {
              path
            }
            ... on ContactPage {
              path
            }
            ... on NormalPage {
              path
            }
            ... on BlogIndexPage {
              path
            }
            ... on ExternalLinkPage {
              link
            }
          }
        }
      }
    }
    # 12. Fetch up to 5 brands to list in the footer
    brands(first: 5) {
      edges {
        node {
          entityId
          name
          path
        }
      }
    }
    # 13. Fetch the category tree to list product categories in the footer
    categoryTree {
      name
      path
    }
  }
`);
