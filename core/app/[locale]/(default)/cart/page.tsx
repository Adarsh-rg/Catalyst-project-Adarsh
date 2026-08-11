// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, BigCommerce automatically managed the Cart session.
//    In Catalyst, this is a Server Component, so it runs on our Node.js server.
//    To know whose cart to show, we read the `cartId` from a secure cookie!
import { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { Streamable } from '@/vibes/soul/lib/streamable';
import { Cart as CartComponent, CartEmptyState } from '@/vibes/soul/sections/cart';
import { CartAnalyticsProvider } from '~/app/[locale]/(default)/cart/_components/cart-analytics-provider';
import { getCartId } from '~/lib/cart';
import { getPreferredCurrencyCode } from '~/lib/currency';
import { getMakeswiftPageMetadata } from '~/lib/makeswift';
import { Slot } from '~/lib/makeswift/slot';
import { exists } from '~/lib/utils';

import { updateCouponCode } from './_actions/update-coupon-code';
import { updateGiftCertificate } from './_actions/update-gift-certificate';
import { updateLineItem } from './_actions/update-line-item';
import { updateShippingInfo } from './_actions/update-shipping-info';
import { CartViewed } from './_components/cart-viewed';
import { CheckoutPreconnect } from './_components/checkout-preconnect';
import { getCart, getShippingCountries } from './page-data';

interface Props {
  params: Promise<{ locale: string }>;
}

const CHECKOUT_URL = process.env.TRAILING_SLASH !== 'false' ? '/checkout/' : '/checkout';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: 'Cart' });
  const makeswiftMetadata = await getMakeswiftPageMetadata({ path: '/cart', locale });

  return {
    title: makeswiftMetadata?.title || t('title'),
    description: makeswiftMetadata?.description || undefined,
  };
}

// Helper function to extract analytics-friendly data from the cart
const getAnalyticsData = async (cartId: string) => {
  // Fetch the cart details using the provided cart ID
  const data = await getCart({ cartId });

  // Extract the cart object from the site response
  const cart = data.site.cart;

  // Return empty array if cart doesn't exist
  if (!cart) {
    return [];
  }

  // =========================================================================
  // 🎓 JAVASCRIPT TIP: ARRAY SPREADING (`...`) AND `.filter()`
  // =========================================================================
  //    `[...array1, ...array2]` takes all items out of both arrays and puts them into one big array.
  //    `.filter()` then loops over every item. If the arrow function returns `true`, it keeps the item.
  //    If it returns `false`, it deletes it from the new list.
  const lineItems = [...cart.lineItems.physicalItems, ...cart.lineItems.digitalItems].filter(
    (item) => !item.parentEntityId, // Only include top-level items
  );

  // Map the line items into a standard analytics event format
  return lineItems.map((item) => {
    return {
      entityId: item.entityId, // The unique ID of the line item in the cart
      id: item.productEntityId, // The catalog product ID
      name: item.name, // The product name
      brand: item.brand ?? '', // The product brand (if available)
      sku: item.sku ?? '', // The product SKU
      price: item.listPrice.value, // The price before discounts
      quantity: item.quantity, // How many of this item are in the cart
      currency: item.listPrice.currencyCode, // The currency used
    };
  });
};

// eslint-disable-next-line complexity
export default async function Cart({ params }: Props) {
  // Await params to extract the locale string
  const { locale } = await params;

  // Set the locale for static rendering (required by next-intl)
  setRequestLocale(locale);

  // Load translations for Cart and Gift Certificates namespaces
  const t = await getTranslations('Cart');
  const tGiftCertificates = await getTranslations('GiftCertificates');
  // Get the locale-aware number and date formatter
  const format = await getFormatter();
  // =================================================================================
  // 1. GETTING THE CART ID FROM COOKIES
  // =================================================================================
  // `getCartId()` securely reads the cookies sent by the browser. 
  // If the user hasn't added anything to their cart yet, `cartId` will be undefined, 
  // and we immediately return the `emptyState` UI below.
  //
  // 💡 WHY WE USE THIS:
  // In Stencil, the server magically knew who the user was, and you just used `{{cart}}`. 
  // In a Headless setup, the frontend and backend are completely separate servers! 
  // We MUST read the secure `cartId` cookie on every request so Next.js knows which 
  // cart to ask BigCommerce for.
  const cartId = await getCartId();

  // Define the UI for an empty cart state
  const emptyState = (
    <>
      <Slot label="Cart top content" snapshotId="cart-top-content" />
      <CartEmptyState
        cta={{ label: t('Empty.cta'), href: '/shop-all' }} // Button to start shopping
        subtitle={t('Empty.subtitle')} // "Looks like you haven't added anything yet"
        title={t('Empty.title')} // "Your cart is empty"
      />
      <Slot label="Cart bottom content" snapshotId="cart-bottom-content" />
    </>
  );

  // If there's no cart ID in the cookie, the cart is guaranteed to be empty
  if (!cartId) {
    return emptyState;
  }

  // =================================================================================
  // 3. FETCHING THE CART DATA (Replacing {{cart}})
  // =================================================================================
  //    Instead of relying on `{{cart.grand_total}}` in Handlebars, we explicitly fetch
  //    the cart using our GraphQL API based on the Cart ID we found in the cookie.
  //
  //    💡 WHY WE USE THIS:
  //    Explicit fetching gives us infinite flexibility. If we want to fetch the cart 
  //    AND a list of "Recommended Products based on your cart" in a single query, we can! 
  //    Stencil's implicit `{{cart}}` object couldn't be customized or expanded.
  
  // Determine preferred currency
  const currencyCode = await getPreferredCurrencyCode();
  // Fetch cart data from BigCommerce
  const data = await getCart({ cartId, currencyCode });

  // Extract cart and checkout objects from the response
  const cart = data.site.cart;
  const checkout = data.site.checkout;
  // Check if store allows gift certificates
  const giftCertificatesEnabled = data.site.settings?.giftCertificates?.isEnabled ?? false;

  // If the cart doesn't exist (e.g., was deleted or expired on the backend), show empty state
  if (!cart) {
    return emptyState;
  }

  // Combine all types of cart items (gift certificates, physical, digital) into a flat array.
  // In Stencil, Handlebars did this looping for you with `{{#each cart.items}}`. Here we do it in JS.
  // We also filter out child items (like options) so we only show the top-level product.
  const lineItems = [
    ...cart.lineItems.giftCertificates,
    ...cart.lineItems.physicalItems,
    ...cart.lineItems.digitalItems,
  ].filter((item) => !('parentEntityId' in item) || !item.parentEntityId);

  // Map the raw GraphQL items into a format our `CartComponent` UI expects.
  // This replaces having massive blocks of logic inside `cart.html`.
  const formattedLineItems = lineItems.map((item) => {
    // Formatting a Gift Certificate item
    if (item.__typename === 'CartGiftCertificate') {
      return {
        typename: item.__typename,
        id: item.entityId,
        title: t('GiftCertificate.giftCertificate'),
        subtitle: `${t('GiftCertificate.to')}: ${item.recipient.name} (${item.recipient.email})${item.message ? `, ${t('GiftCertificate.message')}: ${item.message}` : ''}`,
        quantity: 1, // Gift certificates always have a quantity of 1
        price: format.number(item.amount.value, {
          style: 'currency',
          currency: item.amount.currencyCode,
        }),
        sender: item.sender,
        recipient: item.recipient,
        message: item.message,
        href: undefined, // No product detail page for a gift certificate
        selectedOptions: [],
        productEntityId: 0,
        variantEntityId: 0,
      };
    }

    let inventoryMessages;

    // Formatting physical products (checking stock levels)
    // In Stencil this was just `{{#if out_of_stock_message}}`
    if (item.__typename === 'CartPhysicalItem') {
      if (item.stockPosition?.quantityOutOfStock === item.quantity) {
        inventoryMessages = {
          outOfStockMessage: data.site.settings?.inventory?.showOutOfStockMessage
            ? data.site.settings.inventory.defaultOutOfStockMessage
            : undefined,
        };
      } else {
        inventoryMessages = {
          quantityReadyToShipMessage:
            data.site.settings?.inventory?.showQuantityOnHand &&
            !!item.stockPosition?.quantityOnHand
              ? t('quantityReadyToShip', {
                  quantity: Number(item.stockPosition.quantityOnHand),
                })
              : undefined,
          quantityBackorderedMessage:
            data.site.settings?.inventory?.showQuantityOnBackorder &&
            !!item.stockPosition?.quantityBackordered
              ? t('quantityOnBackorder', {
                  quantity: Number(item.stockPosition.quantityBackordered),
                })
              : undefined,
          quantityOutOfStockMessage:
            data.site.settings?.inventory?.showOutOfStockMessage &&
            !!item.stockPosition?.quantityOutOfStock
              ? t('partiallyAvailable', {
                  quantity: item.quantity - Number(item.stockPosition.quantityOutOfStock),
                })
              : undefined,
          backorderMessage:
            data.site.settings?.inventory?.showBackorderMessage &&
            !!item.stockPosition?.quantityBackordered
              ? (item.stockPosition.backorderMessage ?? undefined)
              : undefined,
        };
      }
    }

    // Return the final formatted object for normal products
    return {
      typename: item.__typename,
      id: item.entityId,
      quantity: item.quantity,
      price: format.number(item.listPrice.value, {
        style: 'currency',
        currency: item.listPrice.currencyCode,
      }),
      salePrice: format.number(item.salePrice.value, {
        style: 'currency',
        currency: item.salePrice.currencyCode,
      }),
      // Map custom product options (text fields, checkboxes, dates) into a single subtitle string
      subtitle: item.selectedOptions
        .map((option) => {
          switch (option.__typename) {
            case 'CartSelectedMultipleChoiceOption':
            case 'CartSelectedCheckboxOption':
              return `${option.name}: ${option.value}`;

            case 'CartSelectedNumberFieldOption':
              return `${option.name}: ${option.number}`;

            case 'CartSelectedMultiLineTextFieldOption':
            case 'CartSelectedTextFieldOption':
              return `${option.name}: ${option.text}`;

            case 'CartSelectedDateFieldOption':
              return `${option.name}: ${format.dateTime(new Date(option.date.utc))}`;

            default:
              return '';
          }
        })
        .join(', '),
      title: item.name,
      image: item.image?.url ? { src: item.image.url, alt: item.name } : undefined,
      href: new URL(item.url).pathname,
      selectedOptions: item.selectedOptions,
      productEntityId: item.productEntityId,
      variantEntityId: item.variantEntityId,
      inventoryMessages,
    };
  });

  // Calculate total discounts by summing up coupon discounts and line item level discounts
  const totalCouponDiscount =
    checkout?.coupons.reduce((sum, coupon) => sum + coupon.discountedAmount.value, 0) ?? 0;

  const totalLineItemDiscount = [
    ...cart.lineItems.physicalItems,
    ...cart.lineItems.digitalItems,
  ].reduce((sum, item) => sum + item.discountedAmount.value, 0);

  const totalDiscount = cart.discountedAmount.value + totalLineItemDiscount;

  // Formatting Gift certificates applied to the order
  const giftCertificatesSummary =
    checkout?.giftCertificates.reduce<Array<{ code: string; used: number }>>((acc, c) => {
      acc.push({
        code: c.code,
        used: c.used.value,
      });

      return acc;
    }, []) ?? [];

  // Extract the current shipping selection (if any) from the checkout object
  const shippingConsignment =
    checkout?.shippingConsignments?.find((consignment) => consignment.selectedShippingOption) ||
    checkout?.shippingConsignments?.[0];

  // Fetch the list of available shipping countries from the server
  const shippingCountries = await getShippingCountries();

  // Map the countries into the {value, label} format required by the Select dropdown UI
  const countries = shippingCountries.map((country) => ({
    value: country.code,
    label: country.name,
  }));

  // These US states share the same abbreviation (AE), which causes issues:
  // 1. The shipping API uses abbreviations, so it can't distinguish between them
  // 2. React select dropdowns require unique keys, causing duplicate key warnings
  const blacklistedUSStates = new Set([
    'Armed Forces Africa',
    'Armed Forces Canada',
    'Armed Forces Middle East',
  ]);

  // Map states for the state dropdown UI, filtering out the duplicates above
  const statesOrProvinces = shippingCountries.map((country) => ({
    country: country.code,
    states: country.statesOrProvinces
      .filter((state) => country.code !== 'US' || !blacklistedUSStates.has(state.name))
      .map((state) => ({
        value: state.abbreviation,
        label: state.name,
      })),
  }));

  // Show the shipping form if we have an address but haven't selected a shipping option yet
  const showShippingForm =
    shippingConsignment?.address && !shippingConsignment.selectedShippingOption;

  // Retrieve the checkout URL (where we redirect the user to finish checkout)
  const checkoutUrl = data.site.settings?.url.checkoutUrl;

  // =================================================================================
  // 4. RENDERING THE CART COMPONENT
  // =================================================================================
  //    Rather than writing out massive HTML loops like `{{#each cart.items}}` directly on the page, 
  //    we pass all our formatted JS objects down into a reusable `<CartComponent>`. 
  //    We also pass the Server Actions (like `updateLineItem`) so the UI knows what 
  //    function to call when a user clicks the plus or minus buttons.
  return (
    <>
      {/* Makeswift dynamic slot for injecting CMS content above the cart */}
      <Slot label="Cart top content" snapshotId="cart-top-content" />
      {/* Provider for sending cart analytics events like view_cart */}
      <CartAnalyticsProvider data={Streamable.from(() => getAnalyticsData(cartId))}>
        {/* Preconnect to the checkout domain early to speed up DNS resolution when clicking checkout */}
        {checkoutUrl ? <CheckoutPreconnect url={checkoutUrl} /> : null}
        
        {/* The main Cart UI component */}
        <CartComponent
          cart={{
            lineItems: formattedLineItems,
            total: format.number(checkout?.grandTotal?.value || 0, {
              style: 'currency',
              currency: cart.currencyCode,
            }),
            totalLabel: t('CheckoutSummary.total'),
            summaryItems: [
              {
                label: t('CheckoutSummary.subTotal'),
                value: format.number(checkout?.subtotal?.value ?? 0, {
                  style: 'currency',
                  currency: cart.currencyCode,
                }),
              },
              totalDiscount > 0
                ? {
                    label: t('CheckoutSummary.discounts'),
                    value: `-${format.number(totalDiscount, {
                      style: 'currency',
                      currency: cart.currencyCode,
                    })}`,
                  }
                : null,
              totalCouponDiscount > 0
                ? {
                    label: t('CheckoutSummary.CouponCode.couponCode'),
                    value: `-${format.number(totalCouponDiscount, {
                      style: 'currency',
                      currency: cart.currencyCode,
                    })}`,
                  }
                : null,
              ...giftCertificatesSummary.map((gc) => ({
                label: `${t('GiftCertificate.giftCertificate')} (${gc.code})`,
                value: `-${format.number(gc.used, {
                  style: 'currency',
                  currency: cart.currencyCode,
                })}`,
              })),
              checkout?.taxTotal && {
                label: t('CheckoutSummary.tax'),
                value: format.number(checkout.taxTotal.value, {
                  style: 'currency',
                  currency: cart.currencyCode,
                }),
              },
            ].filter(exists),
          }}
          checkoutAction={CHECKOUT_URL}
          checkoutLabel={t('proceedToCheckout')}
          couponCode={{
            action: updateCouponCode, // Server Action for coupons
            couponCodes: checkout?.coupons.map((coupon) => coupon.code) ?? [],
            ctaLabel: t('CheckoutSummary.CouponCode.apply'),
            label: t('CheckoutSummary.CouponCode.couponCode'),
            removeLabel: t('CheckoutSummary.CouponCode.removeCouponCode'),
          }}
          decrementLineItemLabel={t('decrement')}
          deleteLineItemLabel={t('removeItem')}
          emptyState={{
            title: t('Empty.title'),
            subtitle: t('Empty.subtitle'),
            cta: { label: t('Empty.cta'), href: '/shop-all' },
          }}
          giftCertificate={
            giftCertificatesEnabled
              ? {
                  action: updateGiftCertificate, // Server Action for gift certificates
                  giftCertificateCodes: checkout?.giftCertificates.map((gc) => gc.code) ?? [],
                  ctaLabel: t('GiftCertificate.apply'),
                  label: t('GiftCertificate.giftCertificateCode'),
                  placeholder: tGiftCertificates('CheckBalance.inputPlaceholder'),
                  removeLabel: t('GiftCertificate.removeGiftCertificate'),
                }
              : undefined
          }
          incrementLineItemLabel={t('increment')}
          // Force a re-render if the cart entity ID or version changes
          key={`${cart.entityId}-${cart.version}`}
          lineItemAction={updateLineItem} // Server Action to update quantity (calls the API securely)
          lineItemActionPendingLabel={t('cartUpdateInProgress')}
          shipping={{
            action: updateShippingInfo, // Server Action to fetch shipping rates based on ZIP
            countries,
            states: statesOrProvinces,
            address: shippingConsignment?.address
              ? {
                  country: shippingConsignment.address.countryCode,
                  city:
                    shippingConsignment.address.city !== ''
                      ? (shippingConsignment.address.city ?? undefined)
                      : undefined,
                  state:
                    shippingConsignment.address.stateOrProvince !== ''
                      ? (shippingConsignment.address.stateOrProvince ?? undefined)
                      : undefined,
                  postalCode:
                    shippingConsignment.address.postalCode !== ''
                      ? (shippingConsignment.address.postalCode ?? undefined)
                      : undefined,
                }
              : undefined,
            shippingOptions: shippingConsignment?.availableShippingOptions
              ? shippingConsignment.availableShippingOptions.map((option) => ({
                  label: option.description,
                  value: option.entityId,
                  price: format.number(option.cost.value, {
                    style: 'currency',
                    currency: checkout?.cart?.currencyCode,
                  }),
                }))
              : undefined,
            shippingOption: shippingConsignment?.selectedShippingOption
              ? {
                  value: shippingConsignment.selectedShippingOption.entityId,
                  label: shippingConsignment.selectedShippingOption.description,
                  price: format.number(shippingConsignment.selectedShippingOption.cost.value, {
                    style: 'currency',
                    currency: checkout?.cart?.currencyCode,
                  }),
                }
              : undefined,
            showShippingForm,
            shippingLabel: t('CheckoutSummary.Shipping.shipping'),
            addLabel: t('CheckoutSummary.Shipping.add'),
            changeLabel: t('CheckoutSummary.Shipping.change'),
            countryLabel: t('CheckoutSummary.Shipping.country'),
            cityLabel: t('CheckoutSummary.Shipping.city'),
            stateLabel: t('CheckoutSummary.Shipping.state'),
            postalCodeLabel: t('CheckoutSummary.Shipping.postalCode'),
            updateShippingOptionsLabel: t('CheckoutSummary.Shipping.updatedShippingOptions'),
            viewShippingOptionsLabel: t('CheckoutSummary.Shipping.viewShippingOptions'),
            cancelLabel: t('CheckoutSummary.Shipping.cancel'),
            editAddressLabel: t('CheckoutSummary.Shipping.editAddress'),
            shippingOptionsLabel: t('CheckoutSummary.Shipping.shippingOptions'),
            updateShippingLabel: t('CheckoutSummary.Shipping.updateShipping'),
            addShippingLabel: t('CheckoutSummary.Shipping.addShipping'),
            noShippingOptionsLabel: t('CheckoutSummary.Shipping.noShippingOptions'),
          }}
          summaryTitle={t('CheckoutSummary.title')}
          title={t('title')}
        />
      </CartAnalyticsProvider>
      {/* Makeswift dynamic slot for injecting CMS content below the cart */}
      <Slot label="Cart bottom content" snapshotId="cart-bottom-content" />
      {/* Component to send a view_cart event to analytics platforms */}
      <CartViewed
        currencyCode={cart.currencyCode}
        lineItems={lineItems}
        subtotal={checkout?.subtotal?.value}
      />
    </>
  );
}
