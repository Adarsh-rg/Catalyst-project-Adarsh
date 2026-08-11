// =================================================================================
// 🎓 DEEP REACT: DYNAMIC ROUTING & SERVER PAGES
// =================================================================================
// In Stencil, a file like `pages/category.html` automatically handled all categories.
// In Next.js App Router, the folder name itself defines the route!
// Because this file lives in a folder called `[slug]`, it is a "Dynamic Route".
// It will intercept ANY URL that matches `/category/*` (e.g. `/category/mens-shoes`).
// The string "mens-shoes" will be passed into this component as `props.params.slug`.

// =================================================================================
// 2. 🎓 HOW FILES CONNECT (Imports / Exports)
// =================================================================================
//    In Stencil, `home.html` would pull in a component by writing `{{> components/products/grid}}`.
//    The server would combine them before sending it to the browser.
//    
//    In React, we use `import` and `export`. 
//    Notice below how we `import` standard React functions like `cache`, 
//    but we ALSO import custom UI components like `ProductsListSection` from other files.
//    By doing `import { ProductsListSection } from '...'`, we are grabbing the exact 
//    function exported from that file so we can run it here!
import { removeEdgesAndNodes } from '@bigcommerce/catalyst-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { createLoader, SearchParams } from 'nuqs/server';
import { cache } from 'react';

import { Stream, Streamable } from '@/vibes/soul/lib/streamable';
import { createCompareLoader } from '@/vibes/soul/primitives/compare-drawer/loader';
import { ProductsListSection } from '@/vibes/soul/sections/products-list-section';
import { getFilterParsers } from '@/vibes/soul/sections/products-list-section/filter-parsers';
import { getSessionCustomerAccessToken } from '~/auth';
import { facetsTransformer } from '~/data-transformers/facets-transformer';
import { pageInfoTransformer } from '~/data-transformers/page-info-transformer';
import { productCardTransformer } from '~/data-transformers/product-card-transformer';
import { getPreferredCurrencyCode } from '~/lib/currency';
import { getMakeswiftPageMetadata } from '~/lib/makeswift';
import { Slot } from '~/lib/makeswift/slot';
import { getMetadataAlternates } from '~/lib/seo/canonical';

import { MAX_COMPARE_LIMIT } from '../../../compare/page-data';
import { getCompareProducts } from '../../fetch-compare-products';
import { fetchFacetedSearch } from '../../fetch-faceted-search';

import { CategoryViewed } from './_components/category-viewed';
import { getCategoryPageData } from './page-data';

const getCachedCategory = cache((categoryId: number) => {
  return {
    category: categoryId,
  };
});

const compareLoader = createCompareLoader();

const createCategorySearchParamsLoader = cache(
  async (categoryId: number, customerAccessToken?: string) => {
    const cachedCategory = getCachedCategory(categoryId);
    const categorySearch = await fetchFacetedSearch(cachedCategory, undefined, customerAccessToken);
    const categoryFacets = categorySearch.facets.items.filter(
      (facet) => facet.__typename !== 'CategorySearchFilter',
    );
    const transformedCategoryFacets = await facetsTransformer({
      refinedFacets: categoryFacets,
      allFacets: categoryFacets,
      searchParams: {},
    });
    const categoryFilters = transformedCategoryFacets.filter((facet) => facet != null);
    const filterParsers = getFilterParsers(categoryFilters);

    // If there are no filters, return `null`, since calling `createLoader` with an empty
    // object will throw the following cryptic error:
    //
    // ```
    // Error: [nuqs] Empty search params cache. Search params can't be accessed in Layouts.
    //   See https://err.47ng.com/NUQS-500
    // ```
    if (Object.keys(filterParsers).length === 0) {
      return null;
    }

    return createLoader(filterParsers);
  },
);

// =================================================================================
// 🎓 TYPESCRIPT TIP: Server Component Props
// =================================================================================
// In Next.js, page components automatically receive `params` (the URL parts, like `slug`) 
// and `searchParams` (the query string, like `?sort=price`).
// Because these might take a tiny fraction of a millisecond to resolve, Next.js types 
// them as `Promise<...>`, meaning we have to `await` them inside our component before using them.
interface Props {
  params: Promise<{
    slug: string;
    locale: string;
  }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  // =================================================================================
  // 1. DYNAMIC CATEGORY SEO
  // =================================================================================
  // Unlike the root layout which fetches global store SEO, this function dynamically 
  // generates the `<title>` and `<meta>` tags for the specific category the user is viewing.
  // It reads the `slug` from the URL, fetches the category data, and returns the SEO tags.
  // Await the route parameters to extract slug (category ID) and locale
  const { slug, locale } = await props.params;
  // Retrieve the current user's session token if logged in
  const customerAccessToken = await getSessionCustomerAccessToken();

  // Convert the URL slug to a numeric category ID
  const categoryId = Number(slug);

  // Fetch the category data using the ID and customer token
  const { category } = await getCategoryPageData(categoryId, customerAccessToken);

  // If the category does not exist, throw a 404 Not Found error
  if (!category) {
    return notFound();
  }

  // Fetch any custom SEO metadata set in Makeswift visual editor
  const makeswiftMetadata = await getMakeswiftPageMetadata({ path: category.path, locale });

  // Extract the standard SEO metadata from BigCommerce
  const { pageTitle, metaDescription, metaKeywords } = category.seo;

  // Process the breadcrumbs to find the canonical path
  const breadcrumbs = removeEdgesAndNodes(category.breadcrumbs);
  const categoryPath = breadcrumbs[breadcrumbs.length - 1]?.path;

  // Construct and return the Metadata object for Next.js to render
  return {
    // Use Makeswift title if available, otherwise BigCommerce SEO title, otherwise category name
    title: makeswiftMetadata?.title || pageTitle || category.name,
    // =================================================================================
    // 🎓 TYPESCRIPT TIP: SPREAD SYNTAX (`...`)
    // =================================================================================
    //    We only want to add a `description` field to this SEO object IF a description exists.
    //    Instead of writing a clunky `if` statement, we use the Spread Syntax (`...`).
    //    It says: "If the right side is an object, unpack all its fields and put them here."
    ...((makeswiftMetadata?.description || metaDescription) && {
      description: makeswiftMetadata?.description || metaDescription,
    }),
    // Convert comma-separated keywords into an array if present
    ...(metaKeywords && { keywords: metaKeywords.split(',') }),
    // Generate alternate locale links for SEO canonicals if path is available
    ...(categoryPath && {
      alternates: await getMetadataAlternates({ path: categoryPath, locale }),
    }),
  };
}

export default async function Category(props: Props) {
  // =================================================================================
  // 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
  // =================================================================================
  //
  // 1. In Stencil, the URL is handled automatically by the BigCommerce backend.
  //    If a user visited `/shoes`, the backend magically populated the `{{category}}` object.
  //    In Next.js App Router, WE handle the URL. 
  //    The `props.params` object contains the dynamic parts of the URL.
  //    Because this file is in a folder named `[slug]`, visiting `/shoes` means `slug` = 'shoes'.
  //
  //    Why `await`? Next.js treats URL parameters as Promises because they might be 
  //    calculated asynchronously on the edge.
  const { slug, locale } = await props.params;

  // 2. In Stencil, customer specific data (like customer groups or personalized pricing)
  //    was automatically injected into the page via the backend session.
  //    In Catalyst, we are fully Headless. We have to manually ask our Next.js server 
  //    if there is a secure HTTP-Only cookie containing the user's session token.
  //    If they are logged in, we get the token; if not, this returns undefined.
  const customerAccessToken = await getSessionCustomerAccessToken();

  // 3. This tells the `next-intl` translation library which language dictionary to load 
  //    for this specific render (e.g. English vs Spanish).
  setRequestLocale(locale);

  // 4. In Stencil, you used `{{lang 'category.empty'}}` to translate text.
  //    In React, we use the `getTranslations` hook. We pass it the 'Faceted' namespace,
  //    which loads the specific JSON file containing translations for the faceted search UI.
  const t = await getTranslations('Faceted');

  // 5. We must convert the URL `slug` (which is a string like "123") into a true Number
  //    because the BigCommerce GraphQL API strictly requires an Integer for the Category ID.
  const categoryId = Number(slug);

  // =================================================================================
  // 🎓 DATA FETCHING (Replacing Stencil's automatic data injection)
  // =================================================================================
  // 6. In Stencil, you never fetched the category data yourself. It was just *there*.
  //    Here, we explicitly call a function (defined in `page-data.ts`) to fetch EXACTLY
  //    the data we want from the BigCommerce GraphQL API.
  //    We pass the `categoryId` so it knows WHAT to fetch.
  //    We pass the `customerAccessToken` so it can return personalized prices if they are logged in!
  const { category, settings, categoryTree } = await getCategoryPageData(
    categoryId,
    customerAccessToken,
  );

  // 7. If the GraphQL query returns `null` for the category, it means the URL was invalid
  //    or the category was deleted. The `notFound()` function instantly halts this page
  //    and tells Next.js to render the `not-found.tsx` 404 page instead.
  if (!category) {
    return notFound();
  }

  // 8. Formatting Data for the UI
  //    GraphQL often returns data wrapped in "edges" and "nodes" (a graph structure).
  //    We use `removeEdgesAndNodes` to flatten it into a simple Javascript array.
  //    Then we `.map()` over it to rename the keys to exactly what our `<Breadcrumbs>` component expects!
  const breadcrumbs = removeEdgesAndNodes(category.breadcrumbs).map(({ name, path }) => ({
    label: name, // The text to display
    href: path ?? '#', // The URL to link to
  }));

  // 9. Checking Store Settings
  //    In Stencil, you might have written `{{#if theme_settings.show_product_rating}}`.
  //    Here, we literally fetch the store's settings via GraphQL and store the boolean result.
  const showRating = Boolean(settings?.reviews.enabled && settings.display.showProductRating);

  // 10. Checking if product comparisons are turned on in the BigCommerce control panel.
  const productComparisonsEnabled =
    settings?.storefront.catalog?.productComparisonsEnabled ?? false;

  // =================================================================================
  // 🎓 REACT SUSPENSE & STREAMING (The magic behind fast page loads)
  // =================================================================================
  // In Stencil, the server had to wait for ALL data (filters, products, prices) to finish 
  // loading from the database before it could send a single byte of HTML to the browser.
  // If the product query took 3 seconds, the user stared at a blank white screen for 3 seconds.
  //
  // In React 18, we use "Streaming". 
  // `Streamable.from()` says: "Start fetching this data right now in the background, but 
  // DO NOT WAIT for it to finish! Go ahead and render the page shell (Header, Footer, Sidebar) 
  // instantly, and show a loading skeleton where the products should be."
  const streamableFacetedSearch = Streamable.from(async () => {
    // We read the query string (e.g. `?sort=price&brand=nike`) from the URL.
    const searchParams = await props.searchParams;
    const currencyCode = await getPreferredCurrencyCode();

    // We parse the raw URL strings into typed objects for the GraphQL query.
    const loadSearchParams = await createCategorySearchParamsLoader(
      categoryId,
      customerAccessToken,
    );
    const parsedSearchParams = loadSearchParams?.(searchParams) ?? {};

    // We fire the actual GraphQL query to fetch the filtered products!
    const search = await fetchFacetedSearch(
      {
        ...searchParams,
        ...parsedSearchParams,
        category: categoryId,
      },
      currencyCode,
      customerAccessToken,
    );

    return search;
  });

  // Because the raw GraphQL data is ugly, we use transformers to format it.
  // Notice this is ALSO wrapped in `Streamable.from`. It waits for `streamableFacetedSearch` 
  // to finish, then transforms it.
  const streamableProducts = Streamable.from(async () => {
    const format = await getFormatter();
    const search = await streamableFacetedSearch;
    const products = search.products.items;

    const { defaultOutOfStockMessage, showOutOfStockMessage, showBackorderMessage } =
      settings?.inventory ?? {};

    // productCardTransformer maps the GraphQL object into { title, price, image } 
    // for our React components.
    return productCardTransformer(
      products,
      format,
      showOutOfStockMessage ? defaultOutOfStockMessage : undefined,
      showBackorderMessage,
    );
  });

  const streamableTotalCount = Streamable.from(async () => {
    const format = await getFormatter();
    const search = await streamableFacetedSearch;

    return format.number(search.products.collectionInfo?.totalItems ?? 0);
  });

  const streamablePagination = Streamable.from(async () => {
    const search = await streamableFacetedSearch;

    return pageInfoTransformer(search.products.pageInfo);
  });

  // =================================================================================
  // STREAMING FILTERS
  // =================================================================================
  // In Stencil, facets were pre-rendered on the server into Handlebars.
  // Here, we fetch them asynchronously and transform them into UI models.
  const streamableFilters = Streamable.from(async () => {
    // Read the current URL query params
    const searchParams = await props.searchParams;

    // Load and parse the URL params to know which filters are currently active
    const loadSearchParams = await createCategorySearchParamsLoader(
      categoryId,
      customerAccessToken,
    );
    const parsedSearchParams = loadSearchParams?.(searchParams) ?? {};
    
    // Fetch base category facets
    const cachedCategory = getCachedCategory(categoryId);
    const categorySearch = await fetchFacetedSearch(cachedCategory, undefined, customerAccessToken);
    
    // Wait for the filtered search data to resolve
    const refinedSearch = await streamableFacetedSearch;

    // Extract raw facets, filtering out the "Category" facet itself since we're already in it
    const allFacets = categorySearch.facets.items.filter(
      (facet) => facet.__typename !== 'CategorySearchFilter',
    );
    const refinedFacets = refinedSearch.facets.items.filter(
      (facet) => facet.__typename !== 'CategorySearchFilter',
    );

    // Transform raw GraphQL facets into our UI format (checkboxes, ranges, etc)
    const transformedFacets = await facetsTransformer({
      refinedFacets,
      allFacets,
      searchParams: { ...searchParams, ...parsedSearchParams },
    });

    const filters = transformedFacets.filter((facet) => facet != null);

    // Build the subcategory tree links to show at the top of the filters sidebar
    const tree = categoryTree[0];
    const subCategoriesFilters =
      tree == null || tree.children.length === 0
        ? []
        : [
          {
            type: 'link-group' as const,
            label: t('Category.subCategories'),
            links: tree.children.map((child) => ({
              label: child.name,
              href: child.path,
            })),
          },
        ];

    // Combine subcategory links and product facets
    return [...subCategoriesFilters, ...filters];
  });

  // =================================================================================
  // STREAMING COMPARED PRODUCTS
  // =================================================================================
  // If comparing is enabled, fetch the details of products currently in the compare drawer
  const streamableCompareProducts = Streamable.from(async () => {
    const searchParams = await props.searchParams;

    // Bail early if the store doesn't support comparing
    if (!productComparisonsEnabled) {
      return [];
    }

    // Parse the compare IDs from the URL query params
    const { compare } = compareLoader(searchParams);
    const compareIds = { entityIds: compare ? compare.map((id: string) => Number(id)) : [] };

    // Fetch the actual product data for those IDs
    const products = await getCompareProducts(compareIds, customerAccessToken);

    // Map to a simple format for the Compare Drawer UI
    return products.map((product) => ({
      id: product.entityId.toString(),
      title: product.name,
      image: product.defaultImage
        ? { src: product.defaultImage.url, alt: product.defaultImage.altText }
        : undefined,
      href: product.path,
    }));
  });

  // =================================================================================
  // 3. RENDERING THE UI (The React Component)
  // =================================================================================
  // We finally return standard JSX (React HTML). 
  // Notice how we pass all those `streamable` variables into the `<ProductsListSection>` as Props.
  // When the data finally arrives from BigCommerce, React will automatically "fill in" the products!
  return (
    <>
      {/* Makeswift visual editor slots - allows content injection above the product grid */}
      <Slot
        label={`${category.name} top content`}
        snapshotId={`category-${categoryId}-top-content`}
      />
      {/* 
        This is our main UI component. It's fully styled and interactive.
        We pass the streamable promises as props. React will automatically show a 
        loading skeleton until the promises resolve!
      */}
      <ProductsListSection
        breadcrumbs={breadcrumbs}
        compareLabel={t('Compare.compare')}
        compareProducts={streamableCompareProducts}
        emptyStateSubtitle={t('Category.Empty.subtitle')}
        emptyStateTitle={t('Category.Empty.title')}
        filterLabel={t('FacetedSearch.filters')}
        filters={streamableFilters}
        filtersPanelTitle={t('FacetedSearch.filters')}
        maxCompareLimitMessage={t('Compare.maxCompareLimit')}
        maxItems={MAX_COMPARE_LIMIT}
        paginationInfo={streamablePagination}
        products={streamableProducts}
        rangeFilterApplyLabel={t('FacetedSearch.Range.apply')}
        removeLabel={t('Compare.remove')}
        resetFiltersLabel={t('FacetedSearch.resetFilters')}
        showCompare={productComparisonsEnabled}
        showRating={showRating}
        sortDefaultValue="featured"
        sortLabel={t('SortBy.sortBy')}
        sortOptions={[
          { value: 'featured', label: t('SortBy.featuredItems') },
          { value: 'newest', label: t('SortBy.newestItems') },
          { value: 'best_selling', label: t('SortBy.bestSellingItems') },
          { value: 'a_to_z', label: t('SortBy.aToZ') },
          { value: 'z_to_a', label: t('SortBy.zToA') },
          { value: 'best_reviewed', label: t('SortBy.byReview') },
          { value: 'lowest_price', label: t('SortBy.priceAscending') },
          { value: 'highest_price', label: t('SortBy.priceDescending') },
          { value: 'relevance', label: t('SortBy.relevance') },
        ]}
        sortParamName="sort"
        title={category.name}
        totalCount={streamableTotalCount}
      />
      {/* Makeswift visual editor slots - allows content injection below the product grid */}
      <Slot
        label={`${category.name} bottom content`}
        snapshotId={`category-${categoryId}-bottom-content`}
      />
      {/* 
        Send analytics tracking event once the search resolves.
        Stream wrapper ensures this doesn't block the initial page render.
      */}
      <Stream value={streamableFacetedSearch}>
        {(search) => <CategoryViewed category={category} products={search.products.items} />}
      </Stream>
    </>
  );
}
