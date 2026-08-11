// =========================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =========================================================================
// 1. In Stencil, you extracted repeating UI elements into components (e.g. `{{> components/common/header}}`).
//    In Catalyst, you extract them into React Functional Components.
//    This Header file is responsible for fetching menu and cart data via GraphQL 
//    and passing it down to the actual visual `<HeaderSection>` component.

import { getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';

import { Streamable } from '@/vibes/soul/lib/streamable';
import { GetLinksAndSectionsQuery, LayoutQuery } from '~/app/[locale]/(default)/page-data';
import { getSessionCustomerAccessToken } from '~/auth';
import { client } from '~/client';
import { graphql, readFragment } from '~/client/graphql';
import { revalidate } from '~/client/revalidate-target';
import { TAGS } from '~/client/tags';
import { logoTransformer } from '~/data-transformers/logo-transformer';
import { routing } from '~/i18n/routing';
import { getCartId } from '~/lib/cart';
import { getPreferredCurrencyCode } from '~/lib/currency';
import { SiteHeader as HeaderSection } from '~/lib/makeswift/components/site-header';

import { search } from './_actions/search';
import { switchCurrency } from './_actions/switch-currency';
import { CurrencyCode, HeaderFragment, HeaderLinksFragment } from './fragment';

const GetCartCountQuery = graphql(`
  query GetCartCountQuery($cartId: String) {
    site {
      cart(entityId: $cartId) {
        entityId
        lineItems {
          totalQuantity
        }
      }
    }
  }
`);

const getCartCount = cache(async (cartId: string, customerAccessToken?: string) => {
  const response = await client.fetch({
    document: GetCartCountQuery,
    variables: { cartId },
    customerAccessToken,
    fetchOptions: {
      cache: 'no-store',
      next: {
        tags: [TAGS.cart],
      },
    },
  });

  // =========================================================================
  // 🎓 JAVASCRIPT TIP: OPTIONAL CHAINING (`?.`)
  // =========================================================================
  //    What happens if `response.data.site.cart` is undefined (they have no cart)?
  //    Normally, trying to read `.lineItems` on `undefined` causes a fatal app crash.
  //    The question mark (`?.`) says: "If cart is null/undefined, STOP here and just return undefined. Don't crash!"
  //    The `?? null` at the end says: "If the final result was undefined, return `null` instead."
  return response.data.site.cart?.lineItems.totalQuantity ?? null;
});

const getHeaderLinks = cache(async (customerAccessToken?: string, currencyCode?: CurrencyCode) => {
  const { data: response } = await client.fetch({
    document: GetLinksAndSectionsQuery,
    customerAccessToken,
    variables: { currencyCode },
    // Since this query is needed on every page, it's a good idea not to validate the customer access token.
    // The 'cache' function also caches errors, so we might get caught in a redirect loop if the cache saves an invalid token error response.
    validateCustomerAccessToken: false,
    fetchOptions: customerAccessToken ? { cache: 'no-store' } : { next: { revalidate } },
  });

  return readFragment(HeaderLinksFragment, response).site;
});

const getHeaderData = cache(async () => {
  const { data: response } = await client.fetch({
    document: LayoutQuery,
    fetchOptions: { next: { revalidate } },
  });

  return readFragment(HeaderFragment, response).site;
});

// =========================================================================
// 2. THE COMPONENT FUNCTION & DATA FETCHING
// =========================================================================
//    Notice how we are fetching data directly inside this Component using `await`.
//    In Stencil, you couldn't do this inside a partial; you had to rely on the page context.
export const Header = async () => {
  const t = await getTranslations('Components.Header');
  const locale = await getLocale();

  const data = await getHeaderData();

  const logo = data.settings ? logoTransformer(data.settings) : '';

  const locales = routing.locales.map((enabledLocales) => ({
    id: enabledLocales,
    label: enabledLocales.toLocaleUpperCase(),
  }));

  const currencies = data.currencies.edges
    ? data.currencies.edges
      // only show transactional currencies for now until cart prices can be rendered in display currencies
      .filter(({ node }) => node.isTransactional)
      .map(({ node }) => ({
        id: node.code,
        label: node.code,
        isDefault: node.isDefault,
      }))
    : [];

  const streamableLinks = Streamable.from(async () => {
    const [customerAccessToken, currencyCode] = await Promise.all([
      getSessionCustomerAccessToken(),
      getPreferredCurrencyCode(),
    ]);
    // const customerAccessToken = await getSessionCustomerAccessToken();
    // const currencyCode = await getPreferredCurrencyCode();
    const categoryTree = (await getHeaderLinks(customerAccessToken, currencyCode)).categoryTree;

    /**  To prevent the navigation menu from overflowing, we limit the number of categories to 6.
   To show a full list of categories, modify the `slice` method to remove the limit.
   Will require modification of navigation menu styles to accommodate the additional categories.
   */
    const slicedTree = categoryTree.slice(0, 6);

    return slicedTree.map(({ name, path, children }) => ({
      label: name,
      href: path,
      groups: children.map((firstChild) => ({
        label: firstChild.name,
        href: firstChild.path,
        links: firstChild.children.map((secondChild) => ({
          label: secondChild.name,
          href: secondChild.path,
        })),
      })),
    }));
  });

  const streamableGiftCertificatesEnabled = Streamable.from(async () => {
    const [customerAccessToken, currencyCode] = await Promise.all([
      getSessionCustomerAccessToken(),
      getPreferredCurrencyCode(),
    ]);
    const giftCertificateSettings = (await getHeaderLinks(customerAccessToken, currencyCode))
      .settings?.giftCertificates;

    return giftCertificateSettings?.isEnabled ?? false;
  });

  const streamableCartCount = Streamable.from(async () => {
    const cartId = await getCartId();
    const customerAccessToken = await getSessionCustomerAccessToken();

    if (!cartId) {
      return null;
    }

    return getCartCount(cartId, customerAccessToken);
  });

  const streamableActiveCurrencyId = Streamable.from(async (): Promise<string | undefined> => {
    const currencyCode = await getPreferredCurrencyCode();

    const defaultCurrency = currencies.find(({ isDefault }) => isDefault);

    return currencyCode ?? defaultCurrency?.id;
  });

  // =======================================================================
  // 3. REACT PROPS (Replacing Handlebars Variables)
  // =======================================================================
  // In Stencil, to pass a logo to a component, you'd do:
  // `{{> components/common/header logo=theme_settings.logo}}`
  // 
  // In React, you use "Props". The `<HeaderSection>` component is a standalone piece 
  // of UI (like a partial). We pass data into it just like HTML attributes.
  // Notice below how `logo`, `cartCount`, and `links` are passed explicitly into the 
  // `navigation` Prop object. This makes it impossible to "accidentally" miss data.
  return (
    <HeaderSection
      navigation={{
        accountHref: '/login',
        accountLabel: t('Icons.account'),
        cartHref: '/cart',
        cartLabel: t('Icons.cart'),
        giftCertificatesLabel: t('Icons.giftCertificates'),
        giftCertificatesHref: '/gift-certificates',
        giftCertificatesEnabled: streamableGiftCertificatesEnabled,
        searchHref: '/search',
        searchParamName: 'term',
        searchAction: search,
        searchInputPlaceholder: t('Search.inputPlaceholder'),
        searchSubmitLabel: t('Search.submitLabel'),
        links: streamableLinks,
        logo,
        mobileMenuTriggerLabel: t('toggleNavigation'),
        openSearchPopupLabel: t('Icons.search'),
        logoLabel: t('home'),
        cartCount: streamableCartCount,
        activeLocaleId: locale,
        locales,
        currencies,
        activeCurrencyId: streamableActiveCurrencyId,
        currencyAction: switchCurrency,
        switchCurrencyLabel: t('SwitchCurrency.label'),
      }}
    />
  );
};
