import { Sliders } from 'lucide-react';
import { Suspense } from 'react';

import { Stream, Streamable } from '@/vibes/soul/lib/streamable';
import { Button } from '@/vibes/soul/primitives/button';
import { CursorPagination, CursorPaginationInfo } from '@/vibes/soul/primitives/cursor-pagination';
import { Product } from '@/vibes/soul/primitives/product-card';
import * as SidePanel from '@/vibes/soul/primitives/side-panel';
import { Breadcrumb, Breadcrumbs, BreadcrumbsSkeleton } from '@/vibes/soul/sections/breadcrumbs';
import { ProductList } from '@/vibes/soul/sections/product-list';
import { Filter, FiltersPanel } from '@/vibes/soul/sections/products-list-section/filters-panel';
import {
  Sorting,
  SortingSkeleton,
  Option as SortOption,
} from '@/vibes/soul/sections/products-list-section/sorting';

// =================================================================================
// 🎓 TYPESCRIPT TIP: OPTIONAL PROPERTIES (`?`)
// =================================================================================
// Notice how some properties in this `interface` have a question mark `?` (like `breadcrumbs?:`).
// This tells TypeScript: "This property is OPTIONAL. If the parent doesn't pass it, 
// that's perfectly fine, it will just be `undefined`."
// If a property doesn't have a `?` (like `totalCount:`), TypeScript will throw a hard error 
// if you ever forget to pass it to the `<ProductsListSection>`. This guarantees we never 
// ship a broken page because we forgot to pass critical data!
interface Props {
  breadcrumbs?: Streamable<Breadcrumb[]>;
  title?: Streamable<string | null>;
  totalCount: Streamable<string>;
  products: Streamable<Product[]>;
  filters: Streamable<Filter[]>;
  sortOptions: Streamable<SortOption[]>;
  compareProducts?: Streamable<Product[]>;
  paginationInfo?: Streamable<CursorPaginationInfo>;
  compareHref?: string;
  compareLabel?: Streamable<string>;
  showCompare?: Streamable<boolean>;
  filterLabel?: string;
  filtersPanelTitle?: Streamable<string>;
  resetFiltersLabel?: Streamable<string>;
  showRating?: boolean;
  rangeFilterApplyLabel?: Streamable<string>;
  sortLabel?: Streamable<string | null>;
  sortPlaceholder?: Streamable<string | null>;
  sortParamName?: string;
  sortDefaultValue?: string;
  compareParamName?: string;
  emptyStateSubtitle?: Streamable<string>;
  emptyStateTitle?: Streamable<string>;
  placeholderCount?: number;
  removeLabel?: Streamable<string>;
  maxItems?: number;
  maxCompareLimitMessage?: Streamable<string>;
}

// =================================================================================
// 🎓 HOW FILES CONNECT (Exporting Components)
// =================================================================================
//    In Stencil, you made a reusable UI chunk by creating a `.html` file in the `components/` folder.
//    In React, a reusable UI chunk is just a function that returns JSX (HTML)!
//    By writing `export function ProductsListSection`, we are allowing `page.tsx` 
//    to `import { ProductsListSection }` and use it like an HTML tag: `<ProductsListSection />`.
export function ProductsListSection({
  // =================================================================================
  // 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
  // =================================================================================
  // 1. PROPS (Replacing {{context}})
  //    In Stencil, you accessed data inside HTML like `{{category.name}}`.
  //    In React, data is passed down explicitly as "Props" from the parent component.
  //    Below, we destructure all the props passed into `ProductsListSection`.
  breadcrumbs: streamableBreadcrumbs,
  title = 'Products',
  totalCount,
  products,
  showRating,
  compareProducts,
  sortOptions: streamableSortOptions,
  sortDefaultValue,
  filters,
  compareHref,
  compareLabel,
  showCompare,
  paginationInfo,
  filterLabel = 'Filters',
  filtersPanelTitle: streamableFiltersPanelTitle = 'Filters',
  resetFiltersLabel,
  rangeFilterApplyLabel,
  sortLabel: streamableSortLabel,
  sortPlaceholder: streamableSortPlaceholder,
  sortParamName,
  compareParamName,
  emptyStateSubtitle,
  emptyStateTitle,
  placeholderCount = 8,
  removeLabel,
  maxItems,
  maxCompareLimitMessage,
}: Props) {
  // =================================================================================
  // 2. JSX (Replacing Handlebars)
  // =================================================================================
  //    We return JSX, which looks like HTML but is actually JavaScript!
  //    Instead of Handlebars `{{#if}}`, we use simple JavaScript logic like `&&` or ternary `? :`.
  return (
    <div className="group/products-list-section @container">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 @xl:px-6 @xl:py-14 @4xl:px-8 @4xl:py-12">
        <div>
          {/* 
            `<Stream>` is a special Catalyst wrapper around React `<Suspense>`.
            It shows the `fallback` (a UI skeleton) WHILE the `streamableBreadcrumbs` promise is fetching.
            Once it finishes, it renders the actual Breadcrumbs component.
          */}
          <Stream fallback={<BreadcrumbsSkeleton />} value={streamableBreadcrumbs}>
            {(breadcrumbs) =>
              breadcrumbs && breadcrumbs.length > 1 && <Breadcrumbs breadcrumbs={breadcrumbs} />
            }
          </Stream>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-8 pt-6 text-foreground">
            <h1 className="flex items-center gap-2 font-heading text-3xl font-medium leading-none @lg:text-4xl @2xl:text-5xl">
              <Suspense
                fallback={
                  <span className="inline-flex h-[1lh] w-[6ch] animate-pulse rounded-lg bg-contrast-100" />
                }
              >
                {title}
              </Suspense>
              <Suspense
                fallback={
                  <span className="inline-flex h-[1lh] w-[2ch] animate-pulse rounded-lg bg-contrast-100" />
                }
              >
                <span className="text-contrast-300">{totalCount}</span>
              </Suspense>
            </h1>
            <div className="flex gap-2">
              <Stream
                fallback={<SortingSkeleton />}
                value={Streamable.all([
                  streamableSortLabel,
                  streamableSortOptions,
                  streamableSortPlaceholder,
                ])}
              >
                {([label, options, placeholder]) => (
                  <Sorting
                    defaultValue={sortDefaultValue}
                    label={label}
                    options={options}
                    paramName={sortParamName}
                    placeholder={placeholder}
                  />
                )}
              </Stream>
              <div className="block @3xl:hidden">
                <SidePanel.Root>
                  <SidePanel.Trigger asChild>
                    <Button size="medium" variant="secondary">
                      {filterLabel}
                      <span className="hidden @xl:block">
                        <Sliders size={20} />
                      </span>
                    </Button>
                  </SidePanel.Trigger>
                  <Stream value={streamableFiltersPanelTitle}>
                    {(filtersPanelTitle) => (
                      <SidePanel.Content title={filtersPanelTitle}>
                        <FiltersPanel
                          filters={filters}
                          paginationInfo={paginationInfo}
                          rangeFilterApplyLabel={rangeFilterApplyLabel}
                          resetFiltersLabel={resetFiltersLabel}
                        />
                      </SidePanel.Content>
                    )}
                  </Stream>
                </SidePanel.Root>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-stretch gap-8 @4xl:gap-10">
          <aside className="hidden w-52 @3xl:block @4xl:w-60">
            <Stream value={streamableFiltersPanelTitle}>
              {(filtersPanelTitle) => <h2 className="sr-only">{filtersPanelTitle}</h2>}
            </Stream>
            <FiltersPanel
              className="sticky top-4"
              filters={filters}
              paginationInfo={paginationInfo}
              rangeFilterApplyLabel={rangeFilterApplyLabel}
              resetFiltersLabel={resetFiltersLabel}
            />
          </aside>

          <div className="group-has-data-pending/products-list-section:animate-pulse flex-1">
            {/* 
              This is Component Composition! 
              Instead of one massive HTML file, we import `<ProductList>` and pass our `products` to it.
              Inside `<ProductList>`, it maps over the data to render `<ProductCard>` for each item. 
            */}
            <ProductList
              compareHref={compareHref}
              compareLabel={compareLabel}
              compareParamName={compareParamName}
              compareProducts={compareProducts}
              emptyStateSubtitle={emptyStateSubtitle}
              emptyStateTitle={emptyStateTitle}
              maxCompareLimitMessage={maxCompareLimitMessage}
              maxItems={maxItems}
              placeholderCount={placeholderCount}
              products={products}
              removeLabel={removeLabel}
              showCompare={showCompare}
              showRating={showRating}
            />

            {paginationInfo && <CursorPagination info={paginationInfo} />}
          </div>
        </div>
      </div>
    </div>
  );
}
