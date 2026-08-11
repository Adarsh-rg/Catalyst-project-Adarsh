// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, if you wanted a Compare Drawer that remembered products as the user 
//    navigated across different pages, you likely wrote custom Javascript to read/write 
//    to `localStorage` or attached global variables to the `window` object.
//
//    In React, we use the Context API (`createContext`) to create "Global State".
//    It allows any component, anywhere in the app, to read and update the list of 
//    compared items without having to pass data down through a hundred different files.
'use client';

import * as Portal from '@radix-ui/react-portal';
import { ArrowRight, X } from 'lucide-react';
import { useQueryState } from 'nuqs';
import {
  createContext,
  ReactNode,
  startTransition,
  useContext,
  useEffect,
  useOptimistic,
} from 'react';

import { ButtonLink } from '@/vibes/soul/primitives/button-link';
import { toast } from '@/vibes/soul/primitives/toaster';
import { Image } from '~/components/image';
import { Link } from '~/components/link';

import { compareParser } from './loader';

// =================================================================================
// 🎓 TYPESCRIPT TIP: Custom Types (`type` vs `interface`)
// =================================================================================
// 2. In TypeScript, an `interface` is best used for Objects (like `CompareDrawerItem`).
//    A `type` is best used for specific distinct values (like saying `type` can ONLY be 
//    the string "add" or "remove").
interface OptimisticAction {
  type: 'add' | 'remove';
  item: CompareDrawerItem;
}

interface CompareDrawerContext {
  optimisticItems: CompareDrawerItem[];
  setOptimisticItems: (action: OptimisticAction) => void;
  maxItems?: number;
}

// =================================================================================
// 3. CREATING THE CONTEXT
// =================================================================================
//    This creates the global "bucket" where our data will live. It defines that this bucket 
//    will hold `optimisticItems` (the products), and a function `setOptimisticItems` to update them.
export const CompareDrawerContext = createContext<CompareDrawerContext>({
  optimisticItems: [],
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setOptimisticItems: () => {},
  maxItems: 0,
});

// =================================================================================
// 4. THE PROVIDER COMPONENT
// =================================================================================
//    The "Provider" wraps around your entire app (or part of it). It actually holds the 
//    state (using hooks like `useOptimistic`). Any component inside this Provider can 
//    reach up and grab the data out of the Context.
export function CompareDrawerProvider({
  children,
  items,
  maxItems,
  maxCompareLimitMessage = "You've reached the maximum number of products for comparison. Remove a product to add a new one.",
}: {
  children: ReactNode;
  items: CompareDrawerItem[];
  maxItems?: number;
  maxCompareLimitMessage?: string;
}) {
  useEffect(() => {
    if (maxItems !== undefined && items.length >= maxItems) {
      toast.warning(maxCompareLimitMessage);
    }
  }, [items.length, maxItems, maxCompareLimitMessage]);

  // 5. `useOptimistic` allows us to update the UI instantly before the server confirms the change
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items, // The initial state passed from the server
    (state: CompareDrawerItem[], { type, item }: OptimisticAction) => {
      // Depending on the action type, we update the list
      switch (type) {
        case 'add':
          // Add the new item and sort the array by ID so it's deterministic
          return [...state, item].sort((a, b) => {
            const numA = Number(a.id);
            const numB = Number(b.id);

            // Sort numerically if IDs are numbers
            if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
              return numA - numB;
            }

            // Put numbers first
            if (!Number.isNaN(numA)) return -1;
            if (!Number.isNaN(numB)) return 1;

            // Alphabetical fallback
            return a.id < b.id ? -1 : 1;
          });

        case 'remove':
          // Filter out the item that is being removed
          return state.filter((i) => i.id !== item.id);

        default:
          return state;
      }
    },
  );

  return (
    <CompareDrawerContext value={{ optimisticItems, setOptimisticItems, maxItems }}>
      {children}
    </CompareDrawerContext>
  );
}

// =================================================================================
// 6. THE CONSUMER HOOK
// =================================================================================
//    We export this custom hook (`useCompareDrawer`). 
//    Any component in the app can just call `const { optimisticItems } = useCompareDrawer()` 
//    to instantly get access to the global list of compared products!
export function useCompareDrawer() {
  return useContext(CompareDrawerContext);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface CompareDrawerItem {
  id: string;
  image?: { src: string; alt: string };
  href: string;
  title: string;
}

export interface CompareDrawerProps {
  href?: string;
  paramName?: string;
  submitLabel?: string;
  removeLabel?: string;
}

// eslint-disable-next-line valid-jsdoc
/**
 * This component supports various CSS variables for theming. Here's a comprehensive list, along
 * with their default values:
 *
 * ```css
 * :root {
 *   --compare-drawer-background: hsl(var(--background));
 *   --compare-drawer-font-family: var(--font-family-body);
 *   --compare-drawer-card-focus: hsl(var(--primary));
 *   --compare-drawer-card-border: hsl(var(--contrast-100));
 *   --compare-drawer-card-background: hsl(var(--background));
 *   --compare-drawer-card-background-hover: hsl(var(--contrast-100));
 *   --compare-drawer-card-image-background: hsl(var(--contrast-100));
 *   --compare-drawer-empty-image-text: hsl(var(--primary-shadow));
 *   --compare-drawer-card-text: hsl(var(--foreground));
 *   --compare-drawer-dismiss-border: hsl(var(--contast-100));
 *   --compare-drawer-dismiss-border-hover: hsl(var(--contast-200));
 *   --compare-drawer-dismiss-background: hsl(var(--background));
 *   --compare-drawer-dismiss-background-hover: hsl(var(--contrast-100));
 *   --compare-drawer-dismiss-icon: hsl(var(--contrast-400));
 *   --compare-drawer-dismiss-icon-hover: hsl(var(--foreground));
 * }
 * ```
 */
export function CompareDrawer({
  href = '/compare',
  paramName = 'compare',
  submitLabel = 'Compare',
  removeLabel = 'Remove',
}: CompareDrawerProps) {
  const [params, setParam] = useQueryState(paramName, compareParser);

  const { optimisticItems, setOptimisticItems } = useCompareDrawer();

  return (
    optimisticItems.length > 0 && (
      <Portal.Root asChild>
        <div className="sticky bottom-0 z-10 w-full border-t border-[var(--compare-drawer-card-border,hsl(var(--contrast-100)))] bg-[var(--compare-drawer-background,hsl(var(--background)))] px-3 py-4 @container @md:py-5 @xl:px-6 @5xl:px-10">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-end gap-x-3 gap-y-4 @md:flex-row">
            <div className="flex flex-1 flex-wrap justify-end gap-4">
              {optimisticItems.map((item) => (
                <div className="relative" key={item.id}>
                  <Link
                    className="group relative flex max-w-56 items-center overflow-hidden whitespace-nowrap rounded-xl border border-[var(--compare-drawer-link-border,hsl(var(--contrast-100)))] bg-[var(--compare-drawer-card-background,hsl(var(--background)))] font-semibold ring-[var(--compare-drawer-card-focus,hsl(var(--primary)))] transition-all duration-150 hover:bg-[var(--compare-drawer-card-background-hover,hsl(var(--contrast-100)))] focus:outline-none focus:ring-2"
                    href={item.href}
                  >
                    <div className="relative aspect-square w-12 shrink-0 bg-[var(--compare-drawer-card-image-background,hsl(var(--contrast-100)))]">
                      {item.image?.src != null ? (
                        <Image
                          alt={item.image.alt}
                          className="rounded-lg object-cover @4xl:rounded-r-none"
                          fill
                          sizes="3rem"
                          src={item.image.src}
                        />
                      ) : (
                        <span className="max-w-full break-all p-1 text-xs text-[var(--compare-drawer-empty-image-text,color-mix(in_oklab,hsl(var(--primary)),black_75%))] opacity-20">
                          {getInitials(item.title)}
                        </span>
                      )}
                    </div>
                    <span className="hidden truncate pl-3 pr-5 text-[var(--compare-drawer-card-text,hsl(var(--foreground)))] @4xl:block">
                      {item.title}
                    </span>
                  </Link>
                  <button
                    aria-label={`${removeLabel} ${item.title}`}
                    className="hover:text-[var(--compare-drawer-dismiss-icon-hover,hsl(var(--foreground))] absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--compare-drawer-dismiss-border,hsl(var(--contrast-100)))] bg-[var(--compare-drawer-dismiss-background,hsl(var(--background)))] text-[var(--compare-drawer-dismiss-icon,hsl(var(--contrast-400)))] transition-colors duration-150 hover:border-[var(--compare-drawer-dismiss-border-hover,hsl(var(--contrast-200)))] hover:bg-[var(--compare-drawer-dismiss-background-hover,hsl(var(--contrast-100)))]"
                    onClick={() => {
                      // Using startTransition to tell React this state update is a lower priority.
                      // In Stencil, you would have manually updated `localStorage` or a global variable here.
                      startTransition(async () => {
                        // 1. Instantly remove from UI using Context
                        setOptimisticItems({ type: 'remove', item });

                        // 2. Update the URL parameters so the state is shareable/refreshable
                        await setParam((prev) => {
                          const next = prev?.filter((v) => v !== item.id) ?? [];

                          // If the array is empty, we return null to remove the query param entirely
                          return next.length > 0 ? next : null;
                        });
                      });
                    }}
                    type="button"
                  >
                    <X absoluteStrokeWidth size={16} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <ButtonLink
              className="hidden @md:block"
              href={`${href}?ids=${params?.toString()}`}
              size="medium"
              variant="primary"
            >
              <span className="inline-flex items-center gap-1">
                {submitLabel} <ArrowRight absoluteStrokeWidth size={20} strokeWidth={1} />
              </span>
            </ButtonLink>
            <ButtonLink className="w-full @md:hidden" href={href} size="small" variant="primary">
              <span className="inline-flex items-center gap-1">
                {submitLabel} <ArrowRight absoluteStrokeWidth size={16} strokeWidth={1} />
              </span>
            </ButtonLink>
          </div>
        </div>
      </Portal.Root>
    )
  );
}
