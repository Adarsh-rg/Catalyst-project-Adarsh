'use server';

// =================================================================================
// 🎓 DEEP REACT: SERVER ACTIONS (Replacing `utils.api.cart`)
// =================================================================================
// In Stencil, when a user clicked "Add to Cart", you wrote Javascript to intercept 
// the click and fire an AJAX request to `/api/storefront/carts`.
// 
// In React 18 / Next.js, we use "Server Actions". The `'use server'` directive below 
// tells Next.js: "Do not send this function to the browser. Run this securely on the server."
// When the user submits the form on the frontend, React securely calls this backend function.
//
// 💡 WHY WE USE THIS:
// In Stencil, anyone could open Chrome DevTools and see exactly how your AJAX calls worked. 
// They could tamper with the POST payload. With Server Actions, all logic, validation, 
// and API keys live safely on the server. The browser just says "run the add-to-cart action".

import { BigCommerceGQLError } from '@bigcommerce/catalyst-client';
import { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
import { getTranslations } from 'next-intl/server';
import { ReactNode } from 'react';

import { Field, schema } from '@/vibes/soul/sections/product-detail/schema';
import { graphql } from '~/client/graphql';
import { Link } from '~/components/link';
import { addToOrCreateCart } from '~/lib/cart';
import { MissingCartError } from '~/lib/cart/error';

// =================================================================================
// 🎓 TYPESCRIPT TIP: Utility Types (`ReturnType`)
// =================================================================================
// `ReturnType` is a TypeScript trick that says: "I don't want to type out this huge 
// object structure. Just look at what the `graphql.scalar` function returns, and use 
// THAT as the type here!"
type CartSelectedOptionsInput = ReturnType<typeof graphql.scalar<'CartSelectedOptionsInput'>>;

interface State {
  fields: Field[];
  lastResult: SubmissionResult | null;
  successMessage?: ReactNode;
}

export const addToCart = async (
  prevState: State, // The previous state of the form (used by useActionState)
  payload: FormData, // The raw FormData object submitted by the browser
): Promise<{
  fields: Field[]; // The schema fields to render the form
  lastResult: SubmissionResult | null; // The result of the validation (errors or success)
  successMessage?: ReactNode; // A React node to display upon successful add to cart
}> => {
  // Load translations for the product details namespace to translate error/success messages
  const t = await getTranslations('Product.ProductDetails');

  // =================================================================================
  // 1. SECURE SERVER VALIDATION (Zod)
  // =================================================================================
  // In Stencil, you had to write custom JS to validate inputs on the frontend, and hope 
  // the backend caught bad data. 
  // Here, we use Zod (`parseWithZod`) to strictly validate the incoming `FormData` 
  // against the exact same schema we used on the frontend. If a hacker tampers with 
  // the form, this will catch it securely on the backend.
  const submission = parseWithZod(payload, { schema: schema(prevState.fields) });

  if (submission.status !== 'success') {
    // If validation fails, we instantly return the errors back to the frontend 
    // (`useActionState` receives this) and the UI shows the errors without reloading!
    return { lastResult: submission.reply(), fields: prevState.fields };
  }

  // Extract the product ID and quantity from the validated payload
  const productEntityId = Number(submission.value.id);
  const quantity = Number(submission.value.quantity);

  // =================================================================================
  // 2. BUILDING THE GRAPHQL MUTATION PAYLOAD
  // =================================================================================
  // We validated the data, now we need to format it exactly how the BigCommerce 
  // GraphQL API expects it. This massive switch statement loops through every single 
  // form field (dropdowns, checkboxes, text fields) and packs it into `selectedOptions`.
  const selectedOptions = prevState.fields.reduce<CartSelectedOptionsInput>((accum, field) => {
    // Extract the submitted value for the current field
    const optionValueEntityId = submission.value[field.name];

    let multipleChoicesOptionInput;
    let checkboxOptionInput;
    let numberFieldOptionInput;
    let textFieldOptionInput;
    let multiLineTextFieldOptionInput;
    let dateFieldOptionInput;

    // Skip empty strings since option is empty
    if (!optionValueEntityId) return accum;

    // Check the type of the field and format the data appropriately for GraphQL
    switch (field.type) {
      case 'select':
      case 'radio-group':
      case 'swatch-radio-group':
      case 'card-radio-group':
      case 'button-radio-group':
        // For multiple choice inputs, construct an object with the option and value IDs
        multipleChoicesOptionInput = {
          optionEntityId: Number(field.name),
          optionValueEntityId: Number(optionValueEntityId),
        };

        // Append to existing multipleChoices array or create a new one
        if (accum.multipleChoices) {
          return {
            ...accum,
            multipleChoices: [...accum.multipleChoices, multipleChoicesOptionInput],
          };
        }

        return { ...accum, multipleChoices: [multipleChoicesOptionInput] };

      case 'checkbox':
        // For checkboxes, use the checked or unchecked value based on submission
        checkboxOptionInput = {
          optionEntityId: Number(field.name),
          optionValueEntityId:
            optionValueEntityId === 'true'
              ? Number(field.checkedValue)
              : Number(field.uncheckedValue),
        };

        if (accum.checkboxes) {
          return { ...accum, checkboxes: [...accum.checkboxes, checkboxOptionInput] };
        }

        return { ...accum, checkboxes: [checkboxOptionInput] };

      case 'number':
        // For number fields, parse the value to a Number
        numberFieldOptionInput = {
          optionEntityId: Number(field.name),
          number: Number(optionValueEntityId),
        };

        if (accum.numberFields) {
          return { ...accum, numberFields: [...accum.numberFields, numberFieldOptionInput] };
        }

        return { ...accum, numberFields: [numberFieldOptionInput] };

      case 'text':
        // For text inputs, format as a String
        textFieldOptionInput = {
          optionEntityId: Number(field.name),
          text: String(optionValueEntityId),
        };

        if (accum.textFields) {
          return {
            ...accum,
            textFields: [...accum.textFields, textFieldOptionInput],
          };
        }

        return { ...accum, textFields: [textFieldOptionInput] };

      case 'textarea':
        // Multi-line text fields also need to be a String
        multiLineTextFieldOptionInput = {
          optionEntityId: Number(field.name),
          text: String(optionValueEntityId),
        };

        if (accum.multiLineTextFields) {
          return {
            ...accum,
            multiLineTextFields: [...accum.multiLineTextFields, multiLineTextFieldOptionInput],
          };
        }

        return { ...accum, multiLineTextFields: [multiLineTextFieldOptionInput] };

      case 'date':
        // For date inputs, convert the string into a valid ISO string
        dateFieldOptionInput = {
          optionEntityId: Number(field.name),
          date: new Date(String(optionValueEntityId)).toISOString(),
        };

        if (accum.dateFields) {
          return {
            ...accum,
            dateFields: [...accum.dateFields, dateFieldOptionInput],
          };
        }

        return { ...accum, dateFields: [dateFieldOptionInput] };

      default:
        // Unknown field type, ignore and pass the accumulator along
        return { ...accum };
    }
  }, {});

  // =================================================================================
  // 3. EXECUTING THE MUTATION
  // =================================================================================
  // We have parsed the form data. Now we call the helper function `addToOrCreateCart`.
  // Behind the scenes, this will fire a GraphQL mutation to BigCommerce to update the cart.
  // In Stencil, this was just `$.post('/api/storefront/carts', data)`
  try {
    // Attempt to add the formatted items to the user's cart (or create a new cart)
    await addToOrCreateCart({
      lineItems: [
        {
          productEntityId, // The ID of the product
          selectedOptions, // The huge object of options we just built above
          quantity, // How many to add
        },
      ],
    });

    // If successful, we return a success message back to `useActionState` on the frontend, 
    // which triggers the green Toast popup!
    return {
      lastResult: submission.reply(),
      fields: prevState.fields,
      successMessage: t.rich('successMessage', {
        cartItems: quantity,
        cartLink: (chunks) => (
          <Link className="underline" href="/cart" prefetch="viewport" prefetchKind="full">
            {chunks}
          </Link>
        ),
      }),
    };
  } catch (error) {
    // =================================================================================
    // 4. ERROR HANDLING
    // =================================================================================
    // If the API throws an error (e.g. "Out of Stock"), we catch it here on the backend 
    // and safely pass the error message back to the frontend form.
    // eslint-disable-next-line no-console
    console.error(error);

    if (error instanceof BigCommerceGQLError) {
      // Extract the human-readable errors from the GraphQL response
      return {
        lastResult: submission.reply({
          formErrors: error.errors.map(({ message }) => {
            // Strip out technical error codes or extraneous context if possible
            if (message.includes('Not enough stock:')) {
              return message.replace('Not enough stock: ', '').replace(/\(\w.+\)\s{1}/, '');
            }

            return message;
          }),
        }),
        fields: prevState.fields,
      };
    }

    if (error instanceof MissingCartError) {
      // Send back a friendly "cart not found" message
      return {
        lastResult: submission.reply({ formErrors: [t('missingCart')] }),
        fields: prevState.fields,
      };
    }

    if (error instanceof Error) {
      // General error fallback
      return {
        lastResult: submission.reply({ formErrors: [error.message] }),
        fields: prevState.fields,
      };
    }

    // Ultimate fallback for unknown exceptions
    return {
      lastResult: submission.reply({ formErrors: [t('unknownError')] }),
      fields: prevState.fields,
    };
  }
};
