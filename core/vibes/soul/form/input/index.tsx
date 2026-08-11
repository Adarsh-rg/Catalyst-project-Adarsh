// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, you wrote standard HTML `<input>` tags. 
//    In modern React, we wrap every native HTML element in a custom Component so we 
//    can automatically inject accessibility attributes, standardize the styling with 
//    Tailwind, and automatically render error messages right below the input!
import { clsx } from 'clsx';
import * as React from 'react';

import { FieldError } from '@/vibes/soul/form/field-error';
import { Label } from '@/vibes/soul/form/label';

// =================================================================================
// 2. REACT FORWARD REF
// =================================================================================
//    Notice `React.forwardRef`. When you build a custom `<Input>` component, standard 
//    HTML properties (like `ref`) don't automatically attach to the actual `<input>` tag 
//    inside it. `forwardRef` grabs that reference from the parent and forwards it down 
//    to the raw `<input>` element so libraries (like our Form state manager) can focus it!
//
// =================================================================================
// 🎓 TYPESCRIPT TIP: Intersection Types (`&`)
// =================================================================================
// 3. Notice the `&` symbol below. This tells TypeScript: "This component accepts all 
//    standard HTML input props (like `onChange`, `value`, `disabled`) AND it ALSO 
//    accepts these 4 custom props (`prepend`, `label`, `errors`, `colorScheme`)."
//    This is how we extend standard HTML elements safely in React!
export const Input = React.forwardRef<
  React.ComponentRef<'input'>,
  React.ComponentPropsWithoutRef<'input'> & {
    prepend?: React.ReactNode;
    label?: string;
    errors?: string[];
    colorScheme?: 'light' | 'dark';
  }
>(({ prepend, label, className, required, errors, colorScheme = 'light', id, ...rest }, ref) => {
  // `useId()` generates a perfectly unique ID string so we can link the `<label>` to the `<input>`
  // for screen readers, even if you render 5 identical inputs on the page!
  const generatedId = React.useId();

  return (
    <div className={clsx('w-full space-y-2', className)}>
      {/* Conditionally render the Label component only if a label string was passed */}
      {label != null && label !== '' && (
        <Label colorScheme={colorScheme} htmlFor={id ?? generatedId} required={required}>
          {label}
        </Label>
      )}
      {/* 
        // =================================================================================
        // TAILWIND CSS STYLING (Replaces SCSS / CSS Modules)
        // =================================================================================
        // In Stencil, you would write SCSS in a separate file and target this input with a class.
        // Here, we use Tailwind CSS utility classes directly on the element (e.g. `rounded-lg`).
        // We use `clsx` to conditionally apply classes based on colorScheme or error state!
      */}
      <div
        className={clsx(
          'relative overflow-hidden rounded-lg border transition-colors duration-200 focus:outline-none',
          {
            light:
              'bg-[var(--input-light-background,hsl(var(--background)))] focus-within:border-[var(--input-light-focus,hsl(var(--foreground)))]',
            dark: 'bg-[var(--input-dark-background,hsl(var(--foreground)))] focus-within:border-[var(--input-dark-focus,hsl(var(--background)))]',
          }[colorScheme],
          {
            light:
              errors && errors.length > 0
                ? 'border-[var(--input-light-border-error,hsl(var(--error)))]'
                : 'border-[var(--input-light-border,hsl(var(--contrast-100)))]',
            dark:
              errors && errors.length > 0
                ? 'border-[var(--input-dark-border-error,hsl(var(--error)))]'
                : 'border-[var(--input-dark-border,hsl(var(--contrast-500)))]',
          }[colorScheme],
        )}
      >
        {prepend != null && prepend !== '' && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            {prepend}
          </span>
        )}
        <input
          {...rest}
          className={clsx(
            'w-full px-6 py-3 text-sm [appearance:textfield] placeholder:font-normal focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            {
              light:
                'bg-[var(--input-light-background,hsl(var(--background)))] text-[var(--input-light-text,hsl(var(--foreground)))] placeholder:text-[var(--input-light-placeholder,hsl(var(--contrast-500)))]',
              dark: 'bg-[var(--input-dark-background,hsl(var(--foreground)))] text-[var(--input-dark-text,hsl(var(--background)))] placeholder:text-[var(--input-dark-placeholder,hsl(var(--contrast-100)))]',
            }[colorScheme],
            { 'py-2.5 pe-4 ps-12': prepend },
          )}
          id={id ?? generatedId}
          ref={ref}
          required={required}
        />
      </div>
      {/* 
        // =================================================================================
        // 2. DYNAMIC ERROR RENDERING
        // =================================================================================
        // If the Zod validation schema (from the Server Action) fails, the errors array 
        // is passed into this Prop. We loop over it and instantly render red error messages! 
      */}
      {errors?.map((error) => (
        <FieldError key={error}>{error}</FieldError>
      ))}
    </div>
  );
});

Input.displayName = 'Input';
