// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, authentication happened entirely on BigCommerce's servers via form POSTs.
//    Here, we define a Server Action (`'use server'`). This is a backend Node.js function 
//    that can be called directly from our React frontend forms.
'use server';

import { BigCommerceGQLError } from '@bigcommerce/catalyst-client';
import { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
import { AuthError } from 'next-auth';
import { getLocale, getTranslations } from 'next-intl/server';

import { schema } from '@/vibes/soul/sections/sign-in-section/schema';
import { signIn } from '~/auth';
import { redirect } from '~/i18n/routing';
import { getCartId } from '~/lib/cart';

export const login = async (
  { redirectTo }: { redirectTo: string },
  _lastResult: SubmissionResult | null,
  formData: FormData,
) => {
  const locale = await getLocale();
  const t = await getTranslations('Auth.Login');
  
  // We read the secure cookie to see if they have a cart already. 
  // We pass this into the signIn function so BigCommerce can merge their guest cart with their account!
  const cartId = await getCartId();

  // =================================================================================
  // 2. FORM VALIDATION
  // =================================================================================
  //    Instead of manual `if (email === '')` checks, we use Zod to validate the incoming form data.
  //    This automatically returns exact error messages back to the React UI if validation fails!
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  // =================================================================================
  // 3. AUTHENTICATING WITH BIGCOMMERCE
  // =================================================================================
  //    We use `NextAuth.js` to handle secure authentication. It sends the credentials
  //    to BigCommerce, and if valid, it sets a secure, encrypted HTTP-only session cookie 
  //    on our Next.js server so the user remains logged in.
  try {
    await signIn('password', {
      email: submission.value.email,
      password: submission.value.password,
      cartId,
      redirect: false, // We handle redirection manually below
    });
  } catch (error) {
    // =================================================================================
    // 4. SECURE ERROR HANDLING
    // =================================================================================
    //    If login fails (wrong password, etc.), we catch the error securely on the server 
    //    and send a sanitized `submission.reply({ formErrors: [...] })` back to the UI.
    // eslint-disable-next-line no-console
    console.error(error);

    // =================================================================================
    // 5. TYPESCRIPT TIP: `instanceof` and Error Handling
    // =================================================================================
    //    In plain JavaScript, an `error` could be anything (a string, a number, an object).
    //    TypeScript forces us to be safe. By checking `if (error instanceof BigCommerceGQLError)`,
    //    we tell TypeScript: "Only run this code if the error is specifically a BigCommerce 
    //    GraphQL error." Once inside the `if` block, TypeScript knows for a fact that `error.errors` 
    //    exists, so it gives us autocomplete and safety!
    if (error instanceof BigCommerceGQLError) {
      return submission.reply({
        formErrors: error.errors.map(({ message }) => message),
      });
    }

    if (
      error instanceof AuthError &&
      error.type === 'CallbackRouteError' &&
      error.cause &&
      error.cause.err instanceof BigCommerceGQLError &&
      error.cause.err.message.includes('Reset password"')
    ) {
      return submission.reply({ formErrors: [t('passwordResetRequired')] });
    }

    if (
      error instanceof AuthError &&
      error.type === 'CallbackRouteError' &&
      error.cause &&
      error.cause.err instanceof BigCommerceGQLError &&
      error.cause.err.message.includes('Invalid credentials')
    ) {
      return submission.reply({ formErrors: [t('invalidCredentials')] });
    }

    return submission.reply({ formErrors: [t('somethingWentWrong')] });
  }

  // If login succeeds, we trigger a fast server-side redirect to the requested page (like /account).
  return redirect({ href: redirectTo, locale });
};
