// =========================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =========================================================================
// 1. In Stencil, `product.html` handled all product pages.
//    In Next.js, the folder `[slug]` creates a "Dynamic Route". 
//    The brackets `[]` mean this folder catches any URL like `/product/my-shirt`.
//    The word inside, `slug`, becomes a variable available in `params.slug`.

import { removeEdgesAndNodes } from '@bigcommerce/catalyst-client';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchParams } from 'nuqs/server';

import { Stream, Streamable } from '@/vibes/soul/lib/streamable';
import { FeaturedProductCarousel } from '@/vibes/soul/sections/featured-product-carousel';
import { auth, getSessionCustomerAccessToken } from '~/auth';
import { pricesTransformer } from '~/data-transformers/prices-transformer';
import { productCardTransformer } from '~/data-transformers/product-card-transformer';
import { productOptionsTransformer } from '~/data-transformers/product-options-transformer';
import { getPreferredCurrencyCode } from '~/lib/currency';
import { getMakeswiftPageMetadata } from '~/lib/makeswift';
import { ProductDetail } from '~/lib/makeswift/components/product-detail';
import { getRecaptchaSiteKey } from '~/lib/recaptcha';
import { getMetadataAlternates } from '~/lib/seo/canonical';

import { addToCart } from './_actions/add-to-cart';
import { getMoreProductImages } from './_actions/get-more-images';
import { submitReview } from './_actions/submit-review';
import { ProductAnalyticsProvider } from './_components/product-analytics-provider';
import { ProductSchema } from './_components/product-schema';
import { ProductViewed } from './_components/product-viewed';
import { Reviews } from './_components/reviews';
import { WishlistButton } from './_components/wishlist-button';
import { WishlistButtonForm } from './_components/wishlist-button/form';
import {
  getProduct,
  getProductPageMetadata,
  getProductPricingAndRelatedProducts,
  getStreamableInventorySettingsQuery,
  getStreamableProduct,
  getStreamableProductInventory,
  getStreamableProductVariantInventory,
} from './page-data';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<SearchParams>;
}

// =========================================================================
// 2. SEO METADATA (The Frontmatter Equivalent)
// =========================================================================
//    In Stencil, you requested product data in the frontmatter (`product: true`).
//    Next.js runs this function first to build the <head> tags for SEO before rendering the page.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const customerAccessToken = await getSessionCustomerAccessToken();

  const productId = Number(slug);

  const product = await getProductPageMetadata(productId, customerAccessToken);

  if (!product) {
    return notFound();
  }

  const makeswiftMetadata = await getMakeswiftPageMetadata({ path: product.path, locale });

  const { pageTitle, metaDescription, metaKeywords } = product.seo;
  const { url, altText: alt } = product.defaultImage || {};

  return {
    title: makeswiftMetadata?.title || pageTitle || product.name,
    description:
      makeswiftMetadata?.description ||
      metaDescription ||
      `${product.plainTextDescription.replaceAll(/\s+/g, ' ').trim().slice(0, 150)}...`,
    ...(metaKeywords && { keywords: metaKeywords.split(',') }),
    alternates: await getMetadataAlternates({ path: product.path, locale }),
    ...(url && { openGraph: { images: [{ url, alt }] } }),
  };
}

// =========================================================================
// 3. THE PAGE COMPONENT (Data Fetching)
// =========================================================================
//    In Stencil, BigCommerce magically fetched product data and injected it into `{{page}}` context.
//    In Next.js Server Components (like this one), YOU have to fetch the data yourself.
//    This is done by writing GraphQL queries (seen in `./page-data.ts`) and calling them here.
export default async function Product({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const customerAccessToken = await getSessionCustomerAccessToken();
  const detachedWishlistFormId = 'product-add-to-wishlist-form';

  setRequestLocale(locale);

  const t = await getTranslations('Product');
  const format = await getFormatter();

  const productId = Number(slug);

  const [{ product: baseProduct, settings }, recaptchaSiteKey] = await Promise.all([
    getProduct(productId, customerAccessToken),
    getRecaptchaSiteKey(),
  ]);

  const reviewsEnabled = Boolean(settings?.reviews.enabled && !settings.display.showProductRating);
  const showRating = Boolean(settings?.reviews.enabled && settings.display.showProductRating);

  if (!baseProduct) {
    return notFound();
  }

  // =================================================================================
  // 4. REACT SUSPENSE & "STREAMABLE" VARIABLES
  // =================================================================================
  // This is the most confusing part of Catalyst if you are coming from Stencil.
  // In Stencil, the server WAITS for all data (images, reviews, stock) to load 
  // from the database before it sends the HTML to the browser.
  // 
  // Next.js uses "React Suspense". It says: "Don't wait for everything! Send the 
  // basic HTML layout to the browser IMMEDIATELY so the user isn't staring at a white screen."
  // 
  // `Streamable.from()` takes a network request (like getting inventory) and wraps it 
  // in a Promise. We pass these Streamable objects down to the UI components. 
  // The UI components will render a gray "skeleton loader" instantly, and when BigCommerce 
  // finally responds with the data half a second later, the skeleton is instantly swapped 
  // out for the real data. This is called "Streaming UI".
  const streamableProduct = Streamable.from(async () => {
    const options = await searchParams;

    const optionValueIds = Object.keys(options)
      .map((option) => ({
        optionEntityId: Number(option),
        valueEntityId: Number(options[option]),
      }))
      .filter(
        (option) => !Number.isNaN(option.optionEntityId) && !Number.isNaN(option.valueEntityId),
      );

    const variables = {
      entityId: Number(productId),
      optionValueIds,
      useDefaultOptionSelections: true,
    };

    const product = await getStreamableProduct(variables, customerAccessToken);

    if (!product) {
      return notFound();
    }

    return product;
  });

  const streamableProductSku = Streamable.from(async () => (await streamableProduct).sku);

  const streamableProductInventory = Streamable.from(async () => {
    const variables = {
      entityId: Number(productId),
    };

    const product = await getStreamableProductInventory(variables, customerAccessToken);

    if (!product) {
      return notFound();
    }

    return product;
  });

  const streamableProductVariantInventory = Streamable.from(async () => {
    const product = await streamableProductInventory;

    if (!product.inventory.hasVariantInventory) {
      return undefined;
    }

    const variables = {
      productId,
      sku: product.sku,
    };

    const variants = await getStreamableProductVariantInventory(variables, customerAccessToken);

    if (!variants) {
      return undefined;
    }

    return removeEdgesAndNodes(variants).find((v) => v.sku === product.sku);
  });

  const streamableProductPricingAndRelatedProducts = Streamable.from(async () => {
    const options = await searchParams;

    const optionValueIds = Object.keys(options)
      .map((option) => ({
        optionEntityId: Number(option),
        valueEntityId: Number(options[option]),
      }))
      .filter(
        (option) => !Number.isNaN(option.optionEntityId) && !Number.isNaN(option.valueEntityId),
      );

    const currencyCode = await getPreferredCurrencyCode();

    const variables = {
      entityId: Number(productId),
      optionValueIds,
      useDefaultOptionSelections: true,
      currencyCode,
    };

    return await getProductPricingAndRelatedProducts(variables, customerAccessToken);
  });

  const streamablePrices = Streamable.from(async () => {
    const product = await streamableProductPricingAndRelatedProducts;

    if (!product) {
      return null;
    }

    return pricesTransformer(product.prices, format) ?? null;
  });

  const streamableImages = Streamable.from(async () => {
    const product = await streamableProduct;

    const images = removeEdgesAndNodes(product.images)
      .filter((image) => image.url !== product.defaultImage?.url)
      .map((image) => ({
        src: image.url,
        alt: image.altText,
      }));

    return {
      images: product.defaultImage
        ? [{ src: product.defaultImage.url, alt: product.defaultImage.altText }, ...images]
        : images,
      pageInfo: product.images.pageInfo,
    };
  });

  const streameableCtaLabel = Streamable.from(async () => {
    const product = await streamableProductInventory;

    if (product.availabilityV2.status === 'Unavailable') {
      return t('ProductDetails.Submit.unavailable');
    }

    if (product.availabilityV2.status === 'Preorder') {
      return t('ProductDetails.Submit.preorder');
    }

    if (!product.inventory.isInStock) {
      return t('ProductDetails.Submit.outOfStock');
    }

    return t('ProductDetails.Submit.addToCart');
  });

  const streameableCtaDisabled = Streamable.from(async () => {
    const product = await streamableProductInventory;

    if (product.availabilityV2.status === 'Unavailable') {
      return true;
    }

    if (product.availabilityV2.status === 'Preorder') {
      return false;
    }

    if (!product.inventory.isInStock) {
      return true;
    }

    return false;
  });

  const streamableInventorySettings = Streamable.from(async () => {
    return await getStreamableInventorySettingsQuery(customerAccessToken);
  });

  const getBackorderAvailabilityPrompt = ({
    showBackorderAvailabilityPrompt,
    backorderAvailabilityPrompt,
    availableForBackorder,
    unlimitedBackorder,
  }: {
    showBackorderAvailabilityPrompt: boolean;
    backorderAvailabilityPrompt: string | null;
    availableForBackorder?: number | null;
    unlimitedBackorder?: boolean;
  }) => {
    if (!showBackorderAvailabilityPrompt || !backorderAvailabilityPrompt) {
      return null;
    }

    const hasBackorderAvailablity = !!availableForBackorder || unlimitedBackorder;

    if (!hasBackorderAvailablity) {
      return null;
    }

    return backorderAvailabilityPrompt;
  };

  const streamableStockDisplayData = Streamable.from(async () => {
    const [product, variant, inventorySetting] = await Streamable.all([
      streamableProductInventory,
      streamableProductVariantInventory,
      streamableInventorySettings,
    ]);

    if (!inventorySetting) {
      return null;
    }

    let inventory;

    if (product.inventory.hasVariantInventory) {
      inventory = variant?.inventory;
    } else {
      inventory = product.inventory;
    }

    if (!inventory) {
      return null;
    }

    const {
      showOutOfStockMessage,
      stockLevelDisplay,
      defaultOutOfStockMessage,
      showBackorderAvailabilityPrompt,
      showBackorderMessage,
      showQuantityOnBackorder,
      backorderAvailabilityPrompt,
    } = inventorySetting;

    if (!inventory.isInStock) {
      return showOutOfStockMessage
        ? { stockLevelMessage: defaultOutOfStockMessage, backorderAvailabilityPrompt: null }
        : null;
    }

    const {
      availableToSell,
      warningLevel,
      availableOnHand,
      availableForBackorder,
      unlimitedBackorder,
    } = inventory.aggregated ?? {};

    if (stockLevelDisplay === 'DONT_SHOW') {
      return null;
    }

    const showsBackorderInfo =
      showBackorderAvailabilityPrompt || showBackorderMessage || showQuantityOnBackorder;

    // if no backorder info is to be displayed, then availableToSell is the stock quantity to be used
    const stockQuantity = showsBackorderInfo ? availableOnHand : availableToSell;

    if (!showsBackorderInfo && !stockQuantity) {
      return null;
    }

    if (stockLevelDisplay === 'SHOW_WHEN_LOW') {
      if (!warningLevel) {
        return null;
      }

      if (stockQuantity && stockQuantity > warningLevel) {
        return null;
      }
    }

    const availabilityMessage = getBackorderAvailabilityPrompt({
      showBackorderAvailabilityPrompt,
      backorderAvailabilityPrompt,
      availableForBackorder,
      unlimitedBackorder,
    });

    if (!availabilityMessage && stockQuantity === undefined) {
      return null;
    }

    return {
      stockLevelMessage: t('ProductDetails.currentStock', {
        quantity: stockQuantity ?? 0,
      }),
      backorderAvailabilityPrompt: availabilityMessage,
    };
  });

  const streamableBackorderDisplayData = Streamable.from(async () => {
    const [product, variant, inventorySetting] = await Streamable.all([
      streamableProductInventory,
      streamableProductVariantInventory,
      streamableInventorySettings,
    ]);

    let inventory;

    if (!product.inventory.hasVariantInventory) {
      inventory = product.inventory;
    } else {
      inventory = variant?.inventory;
    }

    if (!inventory?.aggregated || !inventorySetting) {
      return {
        availableOnHand: 0,
        availableForBackorder: 0,
        unlimitedBackorder: false,
        showQuantityOnBackorder: false,
        backorderMessage: null,
      };
    }

    const inventoryData = {
      availableOnHand: inventory.aggregated.availableOnHand,
      availableForBackorder: inventory.aggregated.availableForBackorder ?? 0,
      unlimitedBackorder: inventory.aggregated.unlimitedBackorder,
    };

    const { showQuantityOnBackorder, showBackorderMessage } = inventorySetting;

    const hasBackorderAvailablity =
      inventoryData.availableForBackorder > 0 || inventoryData.unlimitedBackorder;

    if (!hasBackorderAvailablity || !showBackorderMessage) {
      return {
        ...inventoryData,
        showQuantityOnBackorder: showQuantityOnBackorder && hasBackorderAvailablity,
        backorderMessage: null,
      };
    }

    let variantLocations;

    if (product.inventory.hasVariantInventory) {
      variantLocations = variant?.inventory?.byLocation;
    } else {
      const variants = removeEdgesAndNodes(product.variants);
      const baseVariant = variants.find((v) => v.sku === product.sku);

      variantLocations = baseVariant?.inventory?.byLocation;
    }

    if (!variantLocations) {
      return {
        ...inventoryData,
        showQuantityOnBackorder,
        backorderMessage: null,
      };
    }

    const inventoryByLocation = removeEdgesAndNodes(variantLocations).at(0);

    return {
      ...inventoryData,
      showQuantityOnBackorder,
      backorderMessage: inventoryByLocation?.backorderMessage || null,
    };
  });

  const streameableAccordions = Streamable.from(async () => {
    const product = await streamableProduct;

    const customFields = removeEdgesAndNodes(product.customFields);

    const specifications = [
      {
        name: t('ProductDetails.Accordions.sku'),
        value: product.sku,
      },
      {
        name: t('ProductDetails.Accordions.weight'),
        value: `${product.weight?.value} ${product.weight?.unit}`,
      },
      {
        name: t('ProductDetails.Accordions.condition'),
        value: product.condition,
      },
      ...customFields.map((field) => ({
        name: field.name,
        value: field.value,
      })),
    ];

    return [
      ...(specifications.length
        ? [
            {
              title: t('ProductDetails.Accordions.specifications'),
              content: (
                <div className="prose @container">
                  <dl className="flex flex-col gap-4">
                    {/* 
                      =================================================================================
                      🎓 JAVASCRIPT TIP: ARRAY `.map()`
                      =================================================================================
                      In Stencil, to loop over a list of items and print HTML, you used `{{#each specifications}}`.
                      In React, we use the standard Javascript array function `.map()`.
                      It says: "For every `field` in the `specifications` array, return this chunk of JSX."
                    */}
                    {specifications.map((field, index) => (
                      <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2" key={index}>
                        <dt>
                          <strong>{field.name}</strong>
                        </dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ),
            },
          ]
        : []),
      ...(product.warranty
        ? [
            {
              title: t('ProductDetails.Accordions.warranty'),
              content: (
                <div className="prose" dangerouslySetInnerHTML={{ __html: product.warranty }} />
              ),
            },
          ]
        : []),
    ];
  });

  const streameableRelatedProducts = Streamable.from(async () => {
    const product = await streamableProductPricingAndRelatedProducts;

    if (!product) {
      return [];
    }

    const relatedProducts = removeEdgesAndNodes(product.relatedProducts);

    return productCardTransformer(relatedProducts, format);
  });

  const streamableMinQuantity = Streamable.from(async () => {
    const product = await streamableProduct;

    return product.minPurchaseQuantity;
  });

  const streamableMaxQuantity = Streamable.from(async () => {
    const product = await streamableProduct;

    return product.maxPurchaseQuantity;
  });

  const streamableAnalyticsData = Streamable.from(async () => {
    const [extendedProduct, pricingProduct] = await Streamable.all([
      streamableProduct,
      streamableProductPricingAndRelatedProducts,
    ]);

    return {
      id: extendedProduct.entityId,
      name: extendedProduct.name,
      sku: extendedProduct.sku,
      brand: extendedProduct.brand?.name ?? '',
      price: pricingProduct?.prices?.price.value ?? 0,
      currency: pricingProduct?.prices?.price.currencyCode ?? '',
    };
  });

  const streamableUser = Streamable.from(async () => {
    const session = await auth();
    const firstName = session?.user?.firstName ?? '';
    const lastName = session?.user?.lastName ?? '';

    if (!firstName || !lastName) {
      return { email: session?.user?.email ?? '', name: '' };
    }

    const lastInitial = lastName.charAt(0).toUpperCase();
    const obfuscatedName = `${firstName} ${lastInitial}.`;

    return { email: session?.user?.email ?? '', name: obfuscatedName };
  });

  // =======================================================================
  // 5. RENDERING THE UI (Passing data as Props)
  // =======================================================================
  //    We don't write the actual HTML in this file. 
  //    Instead, we pass this data as "props" into the `<ProductDetail>` React component.
  //    Look closely below: `price: streamablePrices`. We are handing the UI component
  //    the Promise, NOT the final price text. The UI component knows how to handle the stream.
  return (
    // =======================================================================
    // 🎓 REACT TIP: FRAGMENTS (`<>`)
    // =======================================================================
    //    In React, a component must return exactly ONE "parent" HTML tag. 
    //    If we want to return `<ProductDetail>`, `<FeaturedProductCarousel>`, 
    //    and `<WishlistButtonForm>` side-by-side, we would normally have to wrap 
    //    them all in a giant `<div>`. 
    //    To avoid adding useless `<div>`s to our HTML, React gives us Fragments (`<>...</>`).
    //    It groups the elements together for React, but disappears in the final HTML!
    <>
      <ProductAnalyticsProvider data={streamableAnalyticsData}>
        <ProductDetail
          action={addToCart}
          additionalActions={
            <WishlistButton
              formId={detachedWishlistFormId}
              productId={productId}
              productSku={streamableProductSku}
            />
          }
          additionalInformationTitle={t('ProductDetails.additionalInformation')}
          ctaDisabled={streameableCtaDisabled}
          ctaLabel={streameableCtaLabel}
          decrementLabel={t('ProductDetails.decreaseQuantity')}
          emptySelectPlaceholder={t('ProductDetails.emptySelectPlaceholder')}
          fields={productOptionsTransformer(baseProduct.productOptions)}
          incrementLabel={t('ProductDetails.increaseQuantity')}
          loadMoreImagesAction={getMoreProductImages}
          prefetch={true}
          product={{
            id: baseProduct.entityId.toString(),
            title: baseProduct.name,
            description: <div dangerouslySetInnerHTML={{ __html: baseProduct.description }} />,
            href: baseProduct.path,
            images: streamableImages,
            price: streamablePrices,
            reviewsEnabled,
            showRating,
            numberOfReviews: baseProduct.reviewSummary.numberOfReviews,
            subtitle: baseProduct.brand?.name,
            rating: baseProduct.reviewSummary.averageRating,
            accordions: streameableAccordions,
            minQuantity: streamableMinQuantity,
            maxQuantity: streamableMaxQuantity,
            stockDisplayData: streamableStockDisplayData,
            backorderDisplayData: streamableBackorderDisplayData,
          }}
          productId={baseProduct.entityId}
          quantityLabel={t('ProductDetails.quantity')}
          recaptchaSiteKey={recaptchaSiteKey}
          reviewFormAction={submitReview}
          thumbnailLabel={t('ProductDetails.thumbnail')}
          user={streamableUser}
        />
      </ProductAnalyticsProvider>

      <FeaturedProductCarousel
        cta={{ label: t('RelatedProducts.cta'), href: '/shop-all' }}
        emptyStateSubtitle={t('RelatedProducts.browseCatalog')}
        emptyStateTitle={t('RelatedProducts.noRelatedProducts')}
        nextLabel={t('RelatedProducts.nextProducts')}
        previousLabel={t('RelatedProducts.previousProducts')}
        products={streameableRelatedProducts}
        scrollbarLabel={t('RelatedProducts.scrollbar')}
        title={t('RelatedProducts.title')}
      />

      {showRating && (
        <div id="reviews">
          <Reviews
            productId={productId}
            recaptchaSiteKey={recaptchaSiteKey}
            searchParams={searchParams}
            streamableImages={streamableImages}
            streamableProduct={streamableProduct}
          />
        </div>
      )}

      <Stream
        fallback={null}
        value={Streamable.from(async () =>
          Streamable.all([streamableProduct, streamableProductPricingAndRelatedProducts]),
        )}
      >
        {([extendedProduct, pricingProduct]) => (
          <>
            <ProductSchema
              product={{ ...extendedProduct, prices: pricingProduct?.prices ?? null }}
            />
            <ProductViewed
              product={{ ...extendedProduct, prices: pricingProduct?.prices ?? null }}
            />
          </>
        )}
      </Stream>

      <WishlistButtonForm
        formId={detachedWishlistFormId}
        productId={productId}
        productSku={streamableProductSku}
        searchParams={searchParams}
      />
    </>
  );
}
