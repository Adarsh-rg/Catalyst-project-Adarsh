'use client';

// =================================================================================
// 🎓 DEEP REACT: OPTIMISTIC UI UPDATES
// =================================================================================
// In Stencil, when someone clicked "Increase Quantity" in the cart, you had two choices:
// 1. Show a loading spinner, wait for the server, then re-render the page (Slow).
// 2. Write complex jQuery to manually change the "1" to a "2" while the server worked in the background.
//
// In React, we use `useOptimistic`. We tell React: "When the user clicks plus, instantly 
// show the quantity increasing. I promise the server action will catch up in a millisecond."
// If the server fails, React automatically rolls the UI back to the true state!

import { getFormProps, getInputProps, SubmissionResult, useForm } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
import { clsx } from 'clsx';
import { ArrowRight, GiftIcon, Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ComponentPropsWithoutRef,
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useOptimistic,
} from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/vibes/soul/primitives/button';
import * as Skeleton from '@/vibes/soul/primitives/skeleton';
import { toast } from '@/vibes/soul/primitives/toaster';
import {
  GiftCertificateCodeForm,
  GiftCertificateCodeFormState,
} from '@/vibes/soul/sections/cart/gift-certificate-code-form';
import { StickySidebarLayout } from '@/vibes/soul/sections/sticky-sidebar-layout';
import { useEvents } from '~/components/analytics/events';
import { Image } from '~/components/image';

import { CouponCodeForm, CouponCodeFormState } from './coupon-code-form';
import { cartLineItemActionFormDataSchema } from './schema';
import { ShippingForm, ShippingFormState } from './shipping-form';

import { CartEmptyState } from '.';

// =================================================================================
// 🎓 TYPESCRIPT TIP: Utility Types (`Awaited`)
// =================================================================================
// `Awaited<State>` is a built-in TypeScript utility. 
// If `State` is a Promise (e.g. `Promise<string>`), `Awaited` unwraps it and 
// tells TypeScript that the actual value is just a `string`. 
// This makes sure our Server Action payload types match perfectly!
type Action<State, Payload> = (state: Awaited<State>, payload: Payload) => State | Promise<State>;

interface CartLineIteminventoryMessages {
  outOfStockMessage?: string;
  quantityReadyToShipMessage?: string;
  quantityBackorderedMessage?: string;
  quantityOutOfStockMessage?: string;
  backorderMessage?: string;
}

export interface CartLineItem {
  typename: string;
  id: string;
  title: string;
  image?: { alt: string; src: string };
  subtitle: string;
  quantity: number;
  price: string;
  salePrice?: string;
  href?: string;
  inventoryMessages?: CartLineIteminventoryMessages;
}

export interface CartGiftCertificateLineItem extends CartLineItem {
  sender: {
    name: string;
    email: string;
  };
  recipient: {
    name: string;
    email: string;
  };
  message?: string;
}

export interface CartSummaryItem {
  label: string;
  value: string;
}

export interface CartState<LineItem extends CartLineItem> {
  lineItems: LineItem[];
  lastResult: SubmissionResult | null;
}

export interface Cart<LineItem extends CartLineItem> {
  lineItems: LineItem[];
  summaryItems: CartSummaryItem[];
  total: string;
  totalLabel?: string;
}

interface CouponCode {
  action: Action<CouponCodeFormState, FormData>;
  couponCodes?: string[];
  ctaLabel?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  removeLabel?: string;
}

interface GiftCertificate {
  action: Action<GiftCertificateCodeFormState, FormData>;
  giftCertificateCodes?: string[];
  ctaLabel?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  removeLabel?: string;
}

interface ShippingOption {
  label: string;
  value: string;
  price: string;
}

interface Country {
  label: string;
  value: string;
}

interface States {
  country: string;
  states: Array<{
    label: string;
    value: string;
  }>;
}

interface Address {
  country: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface Shipping {
  action: Action<ShippingFormState, FormData>;
  countries?: Country[];
  states?: States[];
  address?: Address;
  shippingOptions?: ShippingOption[];
  shippingOption?: ShippingOption;
  shippingLabel?: string;
  addLabel?: string;
  changeLabel?: string;
  countryLabel?: string;
  cityLabel?: string;
  stateLabel?: string;
  postalCodeLabel?: string;
  updateShippingOptionsLabel?: string;
  viewShippingOptionsLabel?: string;
  cancelLabel?: string;
  editAddressLabel?: string;
  shippingOptionsLabel?: string;
  updateShippingLabel?: string;
  addShippingLabel?: string;
  showShippingForm?: boolean;
  noShippingOptionsLabel?: string;
}

export interface CartProps<LineItem extends CartLineItem> {
  title?: string;
  summaryTitle?: string;
  emptyState?: CartEmptyState;
  lineItemAction: Action<CartState<LineItem>, FormData>;
  checkoutAction: Action<SubmissionResult | null, FormData> | string;
  checkoutLabel?: string;
  deleteLineItemLabel?: string;
  decrementLineItemLabel?: string;
  incrementLineItemLabel?: string;
  cart: Cart<LineItem>;
  couponCode?: CouponCode;
  giftCertificate?: GiftCertificate;
  shipping?: Shipping;
  lineItemActionPendingLabel?: string;
}

const defaultEmptyState = {
  title: 'Your cart is empty',
  subtitle: 'Add some products to get started.',
  cta: { label: 'Continue shopping', href: '#' },
};

// eslint-disable-next-line valid-jsdoc
/**
 * This component supports various CSS variables for theming. Here's a comprehensive list, along
 * with their default values:
 *
 * ```css
 * :root {
 *   --cart-focus: hsl(var(--primary));
 *   --cart-font-family: var(--font-family-body);
 *   --cart-title-font-family: var(--font-family-heading);
 *   --cart-text: hsl(var(--foreground));
 *   --cart-subtitle-text: hsl(var(--contrast-500));
 *   --cart-subtext-text: hsl(var(--contrast-300));
 *   --cart-icon: hsl(var(--contrast-300));
 *   --cart-icon-hover: hsl(var(--foreground));
 *   --cart-border: hsl(var(--contrast-100));
 *   --cart-image-background: hsl(var(--contrast-100));
 *   --cart-button-background: hsl(var(--contrast-100));
 *   --cart-counter-icon: hsl(var(--contrast-300));
 *   --cart-counter-icon-hover: hsl(var(--foreground));
 *   --cart-counter-background: hsl(var(--background));
 *   --cart-counter-background-hover: hsl(var(--contast-100) / 50%);
 * }
 * ```
 */
export function CartClient<LineItem extends CartLineItem>({
  title,
  cart,
  couponCode,
  giftCertificate,
  decrementLineItemLabel,
  incrementLineItemLabel,
  deleteLineItemLabel,
  lineItemAction,
  lineItemActionPendingLabel = 'You have a cart update in progress. Are you sure you want to leave this page? Your changes may be lost.',
  checkoutAction,
  checkoutLabel = 'Checkout',
  emptyState = defaultEmptyState,
  summaryTitle,
  shipping,
}: CartProps<LineItem>) {
  // =================================================================================
  // 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
  // =================================================================================
  const events = useEvents();

  // 1. In Stencil, managing the cart required manual AJAX calls and handling the response.
  //    Here, we use `useActionState`. We pass it our server-side `lineItemAction` function,
  //    and the initial state (the cart data from the server). 
  //    React handles the rest: tracking if it's pending (`isLineItemActionPending`),
  //    running the action (`formAction`), and storing the response (`state`).
  const [state, formAction, isLineItemActionPending] = useActionState(lineItemAction, {
    lineItems: cart.lineItems,
    lastResult: null,
  });

  // 2. We hook `@conform-to/react` into the form to handle any error messages returned 
  //    from the server action (e.g. "Only 5 items left in stock").
  const [form] = useForm({ lastResult: state.lastResult });

  // 3. If the server action returns an error, display it via a toast popup instantly.
  useEffect(() => {
    if (form.errors) {
      form.errors.forEach((error) => {
        toast.error(error);
      });
    }
  }, [form.errors]);

  // Prevent page unload when line item action is pending
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isLineItemActionPending) {
        event.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        event.returnValue = ''; // Chrome requires returnValue to be set

        return ''; // For older browsers
      }
    };

    if (isLineItemActionPending) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLineItemActionPending]);

  // Prevent client-side navigation when line item action is pending
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (isLineItemActionPending && event.target instanceof HTMLElement) {
        const link = event.target.closest('a[href]');

        if (
          link instanceof HTMLAnchorElement &&
          link.href &&
          !link.href.startsWith('mailto:') &&
          !link.href.startsWith('tel:')
        ) {
          // eslint-disable-next-line no-alert
          const shouldNavigate = window.confirm(lineItemActionPendingLabel);

          if (!shouldNavigate) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isLineItemActionPending &&
        (event.key === 'Enter' || event.key === ' ') &&
        event.target instanceof HTMLElement
      ) {
        const link = event.target.closest('a[href]');

        if (
          link instanceof HTMLAnchorElement &&
          link.href &&
          !link.href.startsWith('mailto:') &&
          !link.href.startsWith('tel:')
        ) {
          // eslint-disable-next-line no-alert
          const shouldNavigate = window.confirm(lineItemActionPendingLabel);

          if (!shouldNavigate) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    };

    if (isLineItemActionPending) {
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isLineItemActionPending, lineItemActionPendingLabel]);

  // =================================================================================
  // 4. SETTING UP OPTIMISTIC UI STATE
  // =================================================================================
  //    In Stencil, when someone clicked "Increase Quantity" in the cart, you had two choices:
  //    1. Show a loading spinner, wait for the server, then re-render the page (Slow).
  //    2. Write complex jQuery to manually change the "1" to a "2" while the server worked.
  //
  //    In React, we use `useOptimistic`. We tell React: "When the user clicks plus, instantly 
  //    show the quantity increasing. I promise the server action will catch up in a millisecond."
  //    If the server fails, React automatically rolls the UI back to the true state!
  const [optimisticLineItems, setOptimisticLineItems] = useOptimistic<CartLineItem[], FormData>(
    state.lineItems, // The source of truth from the server (e.g. { quantity: 1 })
    (prevState, formData) => {
      // 5. Parse the incoming form data using Zod to understand what the user just clicked
      const submission = parseWithZod(formData, { schema: cartLineItemActionFormDataSchema });

      if (submission.status !== 'success') return prevState;

      // 6. Instantly return a fake, updated version of the cart based on their intent
      switch (submission.value.intent) {
        case 'increment': {
          const { id } = submission.value;
          // Find the item by ID and instantly increase its quantity in the UI
          return prevState.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }

        case 'decrement': {
          const { id } = submission.value;
          // Find the item by ID and instantly decrease its quantity in the UI
          return prevState.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
          );
        }

        case 'delete': {
          const { id } = submission.value;
          // Instantly remove the item from the list entirely
          return prevState.filter((item) => item.id !== id);
        }

        default:
          return prevState;
      }
    },
  );

  // =================================================================================
  // 🎓 JAVASCRIPT TIP: ARRAY `.reduce()`
  // =================================================================================
  //    `reduce()` loops over an array and "reduces" it down to a single value.
  //    Here, it starts a running `total` at 0. For every `item` in the cart, it adds 
  //    that item's `quantity` to the total. The result is the total number of items in the cart!
  const optimisticQuantity = useMemo(
    () => optimisticLineItems.reduce((total, item) => total + item.quantity, 0),
    [optimisticLineItems],
  );

  if (optimisticQuantity === 0) {
    return <CartEmptyState {...emptyState} />;
  }

  return (
    <StickySidebarLayout
      className="font-[family-name:var(--cart-font-family,var(--font-family-body))] text-[var(--cart-text,hsl(var(--foreground)))]"
      sidebar={
        <div>
          <h2 className="mb-10 font-[family-name:var(--cart-title-font-family,var(--font-family-heading))] text-4xl font-medium leading-none @xl:text-5xl">
            {summaryTitle}
          </h2>
          <dl aria-label="Receipt Summary" className="w-full">
            <div className="divide-y divide-[var(--cart-border,hsl(var(--contrast-100)))]">
              {cart.summaryItems.map((summaryItem, index) => (
                <div className="flex justify-between py-4" key={index}>
                  <dt>{summaryItem.label}</dt>
                  {isLineItemActionPending ? (
                    <Skeleton.Text characterCount={8} className="animate-pulse rounded-md" />
                  ) : (
                    <dd>{summaryItem.value}</dd>
                  )}
                </div>
              ))}

              {shipping && <ShippingForm {...shipping} />}
            </div>
            {couponCode && (
              <CouponCodeForm
                action={couponCode.action}
                couponCodes={couponCode.couponCodes}
                ctaLabel={couponCode.ctaLabel}
                disabled={couponCode.disabled}
                label={couponCode.label}
                placeholder={couponCode.placeholder}
                removeLabel={couponCode.removeLabel}
              />
            )}
            {giftCertificate && (
              <GiftCertificateCodeForm
                action={giftCertificate.action}
                ctaLabel={giftCertificate.ctaLabel}
                disabled={giftCertificate.disabled}
                giftCertificateCodes={giftCertificate.giftCertificateCodes}
                label={giftCertificate.label}
                placeholder={giftCertificate.placeholder}
                removeLabel={giftCertificate.removeLabel}
              />
            )}
            <div className="flex justify-between border-t border-[var(--cart-border,hsl(var(--contrast-100)))] py-6 text-xl font-bold">
              <dt>{cart.totalLabel ?? 'Total'}</dt>
              {isLineItemActionPending ? (
                <Skeleton.Text characterCount={8} className="animate-pulse rounded-md" />
              ) : (
                <dd>{cart.total}</dd>
              )}
            </div>
          </dl>
          <CheckoutButton
            action={checkoutAction}
            className="mt-4 w-full"
            isCartUpdatePending={isLineItemActionPending}
          >
            {checkoutLabel}
            <ArrowRight size={20} strokeWidth={1} />
          </CheckoutButton>
        </div>
      }
      sidebarPosition="after"
      sidebarSize="1/3"
    >
      <div className="w-full">
        <h1 className="mb-10 font-[family-name:var(--cart-title-font-family,var(--font-family-heading))] text-4xl font-medium leading-none @xl:text-5xl">
          {title}
          <span className="ml-4 text-[var(--cart-subtext-text,hsl(var(--contrast-300)))] contrast-more:text-[var(--cart-subtitle-text,hsl(var(--contrast-500)))]">
            {optimisticQuantity}
          </span>
        </h1>
        {/* Cart Items */}
        <ul className="flex flex-col gap-5">
          {optimisticLineItems.map((lineItem) => (
            <li
              className="flex flex-col items-start gap-x-5 gap-y-4 @container @sm:flex-row"
              key={lineItem.id}
            >
              <div className="relative aspect-square w-full max-w-24 overflow-hidden rounded-xl bg-[var(--cart-image-background,hsl(var(--contrast-100)))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))] focus-visible:ring-offset-4">
                {lineItem.typename === 'CartGiftCertificate' ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                    <GiftIcon className="h-full w-full text-[var(--cart-icon,hsl(var(--contrast-300)))]" />
                  </div>
                ) : (
                  lineItem.image != null && (
                    <Image
                      alt={lineItem.image.alt}
                      className="object-cover"
                      fill
                      sizes="(min-width: 28rem) 9rem, (min-width: 24rem) 6rem, 100vw"
                      src={lineItem.image.src}
                    />
                  )
                )}
              </div>
              <div className="flex grow flex-col flex-wrap justify-between gap-y-2 @xl:flex-row">
                <div className="flex w-full flex-1 flex-col @xl:w-1/2 @xl:pr-4">
                  <span className="font-medium">{lineItem.title}</span>
                  <span className="text-[var(--cart-subtext-text,hsl(var(--contrast-400)))] contrast-more:text-[var(--cart-subtitle-text,hsl(var(--contrast-500)))]">
                    {lineItem.subtitle}
                  </span>
                </div>
                  <CounterForm
                    action={formAction}
                    decrementLabel={decrementLineItemLabel}
                    deleteLabel={deleteLineItemLabel}
                    incrementLabel={incrementLineItemLabel}
                    lineItem={lineItem}
                    onSubmit={(formData) => {
                      // =================================================================================
                      // 2. TRIGGERING THE OPTIMISTIC UPDATE
                      // =================================================================================
                      // When the user clicks + / - / Trash, we wrap the form submission in `startTransition`.
                      // 1. We fire the real server action: `formAction(formData)`.
                      // 2. We instantly update the UI: `setOptimisticLineItems(formData)`.
                      startTransition(() => {
                        formAction(formData);
                        setOptimisticLineItems(formData);

                        const intent = formData.get('intent');

                        if (intent === 'increment') {
                          formData.set('quantity', '1');

                          events.onAddToCart?.(formData);
                        }

                        if (intent === 'decrement') {
                          formData.set('quantity', '1');

                          events.onRemoveFromCart?.(formData);
                        }

                        if (intent === 'delete') {
                          formData.set('quantity', lineItem.quantity.toString());

                          events.onRemoveFromCart?.(formData);
                        }
                      });
                    }}
                  />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </StickySidebarLayout>
  );
}

// =================================================================================
// THE COUNTER FORM (Replaces jQuery cart updates)
// =================================================================================
// In Stencil, the Plus/Minus buttons in the cart required custom JS event listeners 
// bound to the DOM elements, which fired AJAX requests.
// Here, each item in the cart is its own `<form>`. The buttons act as submit buttons 
// with different `value` props (increment, decrement, delete).
function CounterForm({
  lineItem,
  action,
  onSubmit,
  incrementLabel = 'Increase count',
  decrementLabel = 'Decrease count',
  deleteLabel = 'Remove item',
}: {
  lineItem: CartLineItem;
  incrementLabel?: string;
  decrementLabel?: string;
  deleteLabel?: string;
  action: (payload: FormData) => void;
  onSubmit: (formData: FormData) => void;
}) {
  const t = useTranslations('Cart');

  const [form, fields] = useForm({
    defaultValue: { id: lineItem.id },
    shouldValidate: 'onBlur',
    shouldRevalidate: 'onInput',
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: cartLineItemActionFormDataSchema });
    },
    onSubmit(event, { formData }) {
      event.preventDefault();

      onSubmit(formData);
    },
  });

  if (lineItem.typename === 'CartGiftCertificate') {
    return (
      <form {...getFormProps(form)} action={action}>
        <input {...getInputProps(fields.id, { type: 'hidden' })} key={fields.id.id} />
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-medium @xl:ml-auto">{lineItem.price}</span>

          <span className="flex flex-1 select-none justify-center px-14 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))]">
            {lineItem.quantity}
          </span>

          <button
            aria-label={deleteLabel}
            className="group -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 hover:bg-[var(--cart-button-background,hsl(var(--contrast-100)))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))] focus-visible:ring-offset-4"
            name="intent"
            type="submit"
            value="delete"
          >
            <Trash2
              className="text-[var(--cart-icon,hsl(var(--contrast-300)))] group-hover:text-[var(--cart-icon-hover,hsl(var(--foreground)))]"
              size={20}
              strokeWidth={1}
            />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form {...getFormProps(form)} action={action}>
      <input {...getInputProps(fields.id, { type: 'hidden' })} key={fields.id.id} />
      <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
        {lineItem.salePrice && lineItem.salePrice !== lineItem.price ? (
          <span className="mt-3 self-start font-medium @xl:ml-auto">
            <span className="sr-only">{t('originalPrice', { price: lineItem.price })}</span>
            <span aria-hidden="true" className="line-through">
              {lineItem.price}
            </span>{' '}
            <span className="sr-only">{t('currentPrice', { price: lineItem.salePrice })}</span>
            <span aria-hidden="true">{lineItem.salePrice}</span>
          </span>
        ) : (
          <span className="mt-3 self-start font-medium @xl:ml-auto">{lineItem.price}</span>
        )}
        <div className="flex size-min flex-col gap-y-0">
          <div className="mb-1 mt-1 flex items-center gap-x-5">
            {/* Counter */}
            <div
              className={clsx(
                'flex items-center rounded-lg border border-[var(--cart-counter-border,hsl(var(--contrast-100)))]',
                (lineItem.inventoryMessages?.outOfStockMessage != null ||
                  lineItem.inventoryMessages?.quantityOutOfStockMessage != null) &&
                  'border-red-500',
              )}
            >
              <button
                aria-label={decrementLabel}
                className={clsx(
                  'group rounded-l-lg bg-[var(--cart-counter-background,hsl(var(--background)))] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))] disabled:cursor-not-allowed',
                  lineItem.quantity === 1
                    ? 'opacity-50'
                    : 'hover:bg-[var(--cart-counter-background-hover,hsl(var(--contrast-100)/50%))]',
                )}
                disabled={lineItem.quantity === 1}
                name="intent"
                type="submit"
                value="decrement"
              >
                <Minus
                  className={clsx(
                    'text-[var(--cart-counter-icon,hsl(var(--contrast-300)))] transition-colors duration-300',
                    lineItem.quantity !== 1 &&
                      'group-hover:text-[var(--cart-counter-icon-hover,hsl(var(--foreground)))]',
                  )}
                  size={18}
                  strokeWidth={1.5}
                />
              </button>
              <span className="flex w-8 select-none justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))]">
                {lineItem.quantity}
              </span>
              <button
                aria-label={incrementLabel}
                className={clsx(
                  'group rounded-r-lg bg-[var(--cart-counter-background,hsl(var(--background)))] p-3 transition-colors duration-300 hover:bg-[var(--cart-counter-background-hover,hsl(var(--contrast-100)/50%))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))] disabled:cursor-not-allowed',
                )}
                name="intent"
                type="submit"
                value="increment"
              >
                <Plus
                  className="text-[var(--cart-counter-icon,hsl(var(--contrast-300)))] transition-colors duration-300 group-hover:text-[var(--cart-counter-icon-hover,hsl(var(--foreground)))]"
                  size={18}
                  strokeWidth={1.5}
                />
              </button>
            </div>
            <button
              aria-label={deleteLabel}
              className="group -ml-1 mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full transition-colors duration-300 hover:bg-[var(--cart-button-background,hsl(var(--contrast-100)))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cart-focus,hsl(var(--primary)))] focus-visible:ring-offset-4"
              name="intent"
              type="submit"
              value="delete"
            >
              <Trash2
                className="text-[var(--cart-icon,hsl(var(--contrast-300)))] group-hover:text-[var(--cart-icon-hover,hsl(var(--foreground)))]"
                size={20}
                strokeWidth={1}
              />
            </button>
          </div>
          {lineItem.inventoryMessages?.outOfStockMessage != null && (
            <span className="text-xs/5 font-light text-red-500">
              {lineItem.inventoryMessages.outOfStockMessage}
            </span>
          )}
          {lineItem.inventoryMessages?.quantityOutOfStockMessage != null && (
            <span className="mb-3 text-xs/5 font-light text-red-500">
              {lineItem.inventoryMessages.quantityOutOfStockMessage}
            </span>
          )}
          {lineItem.inventoryMessages?.quantityReadyToShipMessage != null && (
            <span className="text-xs/5 font-light">
              {lineItem.inventoryMessages.quantityReadyToShipMessage}
            </span>
          )}
          {lineItem.inventoryMessages?.quantityBackorderedMessage != null && (
            <span className="text-xs/5 font-light">
              {lineItem.inventoryMessages.quantityBackorderedMessage}
            </span>
          )}
          {lineItem.inventoryMessages?.backorderMessage != null && (
            <span className="text-xs/5 font-light">
              {lineItem.inventoryMessages.backorderMessage}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

// =================================================================================
// THE CHECKOUT BUTTON
// =================================================================================
// Handles redirecting to the BigCommerce checkout URL.
function CheckoutButton({
  action,
  isCartUpdatePending,
  ...props
}: {
  action: Action<SubmissionResult | null, FormData> | string;
  isCartUpdatePending: boolean;
} & ComponentPropsWithoutRef<typeof Button>) {
  const [lastResult, formAction] = useActionState(
    async (state: SubmissionResult | null, formData: FormData) => {
      if (typeof action === 'string') {
        await new Promise<void>(() => {
          window.location.assign(action);
        });

        return null;
      }

      return action(state, formData);
    },
    null,
  );

  const [form] = useForm({ lastResult });

  useEffect(() => {
    if (form.errors) {
      form.errors.forEach((error) => {
        toast.error(error);
      });
    }
  }, [form.errors]);

  return (
    <form action={formAction}>
      <SubmitButton {...props} isCartUpdatePending={isCartUpdatePending} />
    </form>
  );
}

function SubmitButton({
  isCartUpdatePending,
  ...props
}: { isCartUpdatePending: boolean } & ComponentPropsWithoutRef<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      disabled={pending || isCartUpdatePending}
      loading={pending || isCartUpdatePending}
      type="submit"
    />
  );
}
