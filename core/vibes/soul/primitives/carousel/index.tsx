/* eslint-disable valid-jsdoc */
// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, to make a carousel work, you loaded a jQuery plugin (like Slick Carousel)
//    in your `theme.js` file.
// 
//    In React, components are rendered on the SERVER by default (no javascript in the browser).
//    But a carousel NEEDS javascript to handle drag events and button clicks!
//    The `'use client'` directive tells Next.js: "Send this component's Javascript to the 
//    browser so it can be interactive."
'use client';

import { clsx } from 'clsx';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

// =================================================================================
// 🎓 TYPESCRIPT TIP: Advanced Utility Types (`Parameters`, `ReturnType`)
// =================================================================================
// 2. What if a third-party library (like `useEmblaCarousel`) doesn't export its Types? 
//    TypeScript can extract them automatically! 
//    `Parameters<typeof fn>` grabs the argument types the function expects.
//    `ReturnType<typeof fn>` grabs the shape of whatever the function returns!
type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

interface CarouselProps extends React.ComponentPropsWithoutRef<'div'> {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  setApi?: (api: CarouselApi) => void;
  carouselScrollbarLabel?: string;
  hideOverflow?: boolean;
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }

  return context;
}

function Carousel({
  opts,
  setApi,
  plugins,
  className,
  children,
  hideOverflow = true,
  ...rest
}: CarouselProps) {
  // =================================================================================
  // 3. REACT HOOKS: useState (Replacing global variables)
  // =================================================================================
  //    In jQuery, you might track the carousel state by reading the DOM (`$('.slide').hasClass('active')`).
  //    In React, you store state in Javascript using `useState`. 
  //    Whenever `setCanScrollPrev` is called, React automatically re-renders the UI to update the button!
  const [carouselRef, api] = useEmblaCarousel(opts, plugins);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return;

    setCanScrollPrev(api.canGoToPrev());
    setCanScrollNext(api.canGoToNext());
  }, []);

  const scrollPrev = useCallback(() => api?.goToPrev(), [api]);

  const scrollNext = useCallback(() => api?.goToNext(), [api]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  useEffect(() => {
    if (!api || !setApi) return;

    setApi(api);
  }, [api, setApi]);

  // =================================================================================
  // 4. REACT HOOKS: useEffect (Replacing Document.Ready / Event Listeners)
  // =================================================================================
  //    In jQuery, you used `$(document).ready()` to attach event listeners.
  //    In React, you use `useEffect`. This code block runs when the component mounts.
  //    The `return () => { ... }` part is the cleanup function (it removes the event listener
  //    when the user leaves the page to prevent memory leaks).
  useEffect(() => {
    if (!api) return;

    onSelect(api);
    api.on('reinit', onSelect);
    api.on('select', onSelect);

    return () => {
      api.off('select', onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        opts,
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        {...rest}
        aria-roledescription="carousel"
        className={clsx('relative @container', hideOverflow && 'overflow-hidden', className)}
        onKeyDownCapture={handleKeyDown}
        role="region"
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

// The container that holds all the carousel slides
function CarouselContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  // Grab the embla carousel ref from the Context
  const { carouselRef } = useCarousel();

  return (
    // Attach the ref here so Embla knows what to scroll
    <div className="w-full" ref={carouselRef}>
      <div {...rest} className={clsx('-ml-4 flex @2xl:-ml-5', className)} />
    </div>
  );
}

// An individual slide inside the carousel
function CarouselItem({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      aria-roledescription="slide"
      // shrink-0 and grow-0 ensure the slide doesn't stretch or compress oddly
      className={clsx('min-w-0 shrink-0 grow-0 pl-4 @2xl:pl-5', className)}
      role="group"
    />
  );
}

/**
 * This component supports various CSS variables for theming. Here's a comprehensive list, along
 * with their default values:
 *
 * ```css
 * :root {
    --carousel-focus: hsl(var(--primary));
    --carousel-light-button: hsl(var(--foreground));
    --carousel-dark-button: hsl(var(--background));
 * }
 * ```
 */
// The Next/Previous arrow buttons for the carousel
function CarouselButtons({
  className,
  colorScheme = 'light',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  colorScheme?: 'light' | 'dark';
  previousLabel?: string;
  nextLabel?: string;
}) {
  // Pull the scroll functions and disable states from our global Context
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();

  return (
    <div
      {...rest}
      className={clsx(
        'flex gap-2',
        {
          light: 'text-[var(--carousel-light-button,hsl(var(--foreground)))]',
          dark: 'text-[var(--carousel-dark-button,hsl(var(--background)))]',
        }[colorScheme],
        className,
      )}
    >
      <button
        className="rounded-lg ring-[var(--carousel-focus,hsl(var(--primary)))] transition-colors duration-300 focus-visible:outline-0 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-25"
        // Button is disabled when we reach the first slide
        disabled={!canScrollPrev}
        // Calls the Embla API to scroll left
        onClick={scrollPrev}
        title={previousLabel}
      >
        <ArrowLeft strokeWidth={1.5} />
      </button>
      <button
        className="rounded-lg ring-[var(--carousel-focus,hsl(var(--primary)))] transition-colors duration-300 focus-visible:outline-0 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-25"
        // Button is disabled when we reach the last slide
        disabled={!canScrollNext}
        // Calls the Embla API to scroll right
        onClick={scrollNext}
        title={nextLabel}
      >
        <ArrowRight strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * This component supports various CSS variables for theming. Here's a comprehensive list, along
 * with their default values:
 *
 * ```css
 * :root {
    --carousel-light-scrollbar: hsl(var(--foreground));
    --carousel-dark-scrollbar: hsl(var(--background));
 * }
 * ```
 */
// =================================================================================
// 5. CAROUSEL SCROLLBAR (Replaces custom drag math)
// =================================================================================
//    In Stencil, implementing a custom scrollbar for a carousel often meant writing 
//    complex math to track mouse drag distance and update the scrollbar width.
//    Here, we tie an HTML `<input type="range">` directly to the Embla API's `progress`.
function CarouselScrollbar({
  className,
  colorScheme = 'light',
  label = 'Carousel scrollbar',
}: React.HTMLAttributes<HTMLDivElement> & { label?: string; colorScheme?: 'light' | 'dark' }) {
  const { api, canScrollPrev, canScrollNext } = useCarousel();
  const [progress, setProgress] = useState(0);
  const [scrollbarPosition, setScrollbarPosition] = useState({ width: 0, left: 0 });

  const findClosestSnap = useCallback(
    (nextProgress: number) => {
      if (!api) return 0;

      const point = nextProgress / 100;
      const snapList = api.snapList();

      if (snapList.length === 0) return -1;

      const closestSnap = snapList.reduce((prev, curr) =>
        Math.abs(curr - point) < Math.abs(prev - point) ? curr : prev,
      );

      return snapList.findIndex((snap) => snap === closestSnap);
    },
    [api],
  );

  useEffect(() => {
    if (!api) return;

    const snapList = api.snapList();
    const closestSnapIndex = findClosestSnap(progress);
    const scrollbarWidth = 100 / snapList.length;
    const scrollbarLeft = (closestSnapIndex / snapList.length) * 100;

    setScrollbarPosition({ width: scrollbarWidth, left: scrollbarLeft });

    api.goTo(closestSnapIndex);
  }, [progress, api, findClosestSnap]);

  useEffect(() => {
    if (!api) return;

    function onScroll() {
      if (!api) return;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setProgress(api.snapList()[api.selectedSnap()]! * 100);
    }

    api.on('select', onScroll);
    api.on('scroll', onScroll);
    api.on('reinit', onScroll);

    return () => {
      api.off('select', onScroll);
      api.off('scroll', onScroll);
      api.off('reinit', onScroll);
    };
  }, [api]);

  return (
    <div
      className={clsx(
        'relative flex h-6 w-full max-w-56 items-center overflow-hidden',
        !canScrollPrev && !canScrollNext && 'pointer-events-none invisible',
        className,
      )}
    >
      <input
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuenow={progress}
        aria-valuetext={`${Math.round(progress)}%`}
        className="absolute h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
        max={100}
        min={0}
        onChange={(e) => setProgress(e.currentTarget.valueAsNumber)}
        type="range"
        value={progress}
      />
      {/* Track */}
      <div
        className={clsx(
          'pointer-events-none absolute h-1 w-full rounded-full opacity-10',
          {
            light: 'bg-[var(--carousel-light-scrollbar,hsl(var(--foreground)))]',
            dark: 'bg-[var(--carousel-dark-scrollbar,hsl(var(--background)))]',
          }[colorScheme],
        )}
      />

      {/* Bar */}
      <div
        className={clsx(
          'pointer-events-none absolute h-1 rounded-full transition-all ease-out',
          {
            light: 'bg-[var(--carousel-light-scrollbar,hsl(var(--foreground)))]',
            dark: 'bg-[var(--carousel-dark-scrollbar,hsl(var(--background)))]',
          }[colorScheme],
        )}
        style={{
          width: `${scrollbarPosition.width}%`,
          left: `${scrollbarPosition.left}%`,
        }}
      />
    </div>
  );
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselButtons,
  CarouselScrollbar,
};
