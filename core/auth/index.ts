// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, BigCommerce automatically set a cookie when a user logged in, 
//    and that cookie kept them logged in across all pages automatically.
// 
//    In Catalyst, we use an open-source library called `next-auth` (also known as Auth.js).
//    When a user logs in, we get a Customer Access Token (JWT) from the GraphQL API.
//    We then tell `next-auth` to store that token securely in an encrypted session cookie.
//    Every time a page loads, Next.js decrypts the cookie and uses the token to fetch
//    customer-specific pricing or profile data.

import { decodeJwt } from 'jose';
import NextAuth, { type NextAuthConfig, User } from 'next-auth';
import 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { anonymousSignIn, clearAnonymousSession } from '~/auth/anonymous-session';
import { client } from '~/client';
import { graphql } from '~/client/graphql';
import { clearCartId, setCartId } from '~/lib/cart';
import { serverToast } from '~/lib/server-toast';

const LoginMutation = graphql(`
  mutation LoginMutation($email: String!, $password: String!, $cartEntityId: String) {
    login(email: $email, password: $password, guestCartEntityId: $cartEntityId) {
      customerAccessToken {
        value
      }
      customer {
        entityId
        firstName
        lastName
        email
      }
      cart {
        entityId
      }
    }
  }
`);

const LoginWithTokenMutation = graphql(`
  mutation LoginWithCustomerLoginJwtMutation($jwt: String!, $cartEntityId: String) {
    loginWithCustomerLoginJwt(jwt: $jwt, guestCartEntityId: $cartEntityId) {
      customerAccessToken {
        value
      }
      customer {
        entityId
        firstName
        lastName
        email
      }
      cart {
        entityId
      }
    }
  }
`);

const LogoutMutation = graphql(`
  mutation LogoutMutation($cartEntityId: String) {
    logout(cartEntityId: $cartEntityId) {
      result
      cartUnassignResult {
        cart {
          entityId
        }
      }
    }
  }
`);

// =================================================================================
// 🎓 TYPESCRIPT TIP: ZOD & DATA VALIDATION
// =================================================================================
// In JavaScript, you can't be sure what data is inside an object until you run the code.
// TypeScript helps catch errors while you type, but it doesn't run in the browser.
// `zod` (imported as `z`) bridges this gap. It's a library that lets us define strict 
// "Schemas" (blueprints) for our data. When someone submits a login form, we use `zod` 
// to instantly check: "Is this actually an email? Is the password at least 1 character?"
// If the data doesn't match the schema, `zod` throws an error and protects our backend.
const cartIdSchema = z
  .string()
  .uuid()
  .or(z.literal('undefined')) // auth.js seems to pass the cart id as a string literal 'undefined' when not set.
  .optional()
  .transform((val) => (val === 'undefined' ? undefined : val));

const PasswordCredentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  cartId: cartIdSchema,
});

const JwtCredentials = z.object({
  jwt: z.string(),
  cartId: cartIdSchema,
});

const SessionUpdate = z.object({
  user: z.object({
    cartId: cartIdSchema,
  }),
});

async function handleLoginCart(guestCartId?: string, loginResultCartId?: string) {
  const t = await getTranslations('Cart');

  if (guestCartId === undefined && loginResultCartId !== undefined) {
    await serverToast.info(t('cartRestored'), { position: 'top-center' });
  }

  if (loginResultCartId && guestCartId && loginResultCartId !== guestCartId) {
    await serverToast.info(t('cartCombined'), { position: 'top-center' });
  }

  if (loginResultCartId) {
    await setCartId(loginResultCartId);
  }
}

// =================================================================================
// 2. THE LOGIN MUTATION
// =================================================================================
//    This function runs when the user submits the login form. 
//    It fires a GraphQL mutation to BigCommerce to verify the email and password.
async function loginWithPassword(credentials: unknown): Promise<User | null> {
  // Validate the incoming credentials object using Zod to ensure it has email and password
  const { email, password, cartId } = PasswordCredentials.parse(credentials);

  // Send a GraphQL mutation to BigCommerce to attempt the login
  const response = await client.fetch({
    document: LoginMutation,
    variables: { email, password, cartEntityId: cartId },
    fetchOptions: {
      cache: 'no-store', // Never cache login requests
    },
  });

  // If BigCommerce returns errors (e.g., wrong password), return null (login failed)
  if (response.errors && response.errors.length > 0) {
    return null;
  }

  // Extract the login result payload
  const result = response.data.login;

  // If the payload is missing the customer or token, it's an invalid state, return null
  if (!result.customer || !result.customerAccessToken) {
    return null;
  }

  // Handle cart merging if they had a guest cart before logging in
  await handleLoginCart(cartId, result.cart?.entityId);
  // Clear any anonymous session since they are now a logged-in user
  await clearAnonymousSession();

  // Return the NextAuth `User` object, which will be saved into the session cookie
  return {
    firstName: result.customer.firstName,
    lastName: result.customer.lastName,
    email: result.customer.email,
    customerAccessToken: result.customerAccessToken.value,
    cartId: result.cart?.entityId,
  };
}

// This function handles login via JWT (used when coming from an external identity provider or email link)
async function loginWithJwt(credentials: unknown): Promise<User | null> {
  // Validate the incoming JWT and optional cartId
  const { jwt, cartId } = JwtCredentials.parse(credentials);

  // Decode the JWT to inspect its claims without verifying the signature (BigCommerce does the verification)
  const claims = decodeJwt(jwt);
  // Determine the channel ID from the token, fallback to environment variable
  const channelId = claims.channel_id?.toString() ?? process.env.BIGCOMMERCE_CHANNEL_ID;
  // Check if someone is impersonating the user (like customer support)
  const impersonatorId = claims.impersonator_id?.toString() ?? null;
  
  // Send the GraphQL mutation to log in using the JWT
  const response = await client.fetch({
    document: LoginWithTokenMutation,
    variables: { jwt, cartEntityId: cartId },
    channelId,
    fetchOptions: {
      cache: 'no-store', // Never cache
    },
  });

  // If BigCommerce rejects the token, return null
  if (response.errors && response.errors.length > 0) {
    return null;
  }

  // Extract the login result
  const result = response.data.loginWithCustomerLoginJwt;

  // If customer or token is missing, fail the login
  if (!result.customer || !result.customerAccessToken) {
    return null;
  }

  // Handle cart merging
  await handleLoginCart(cartId, result.cart?.entityId);
  // Clear anonymous session
  await clearAnonymousSession();

  // Return the NextAuth `User` object
  return {
    firstName: result.customer.firstName,
    lastName: result.customer.lastName,
    email: result.customer.email,
    customerAccessToken: result.customerAccessToken.value,
    impersonatorId,
    cartId: result.cart?.entityId,
  };
}

const partitionedCookie = (name?: string) =>
  ({
    ...(name !== undefined ? { name } : {}),
    options: {
      partitioned: true,
      secure: true,
      sameSite: 'none',
    },
  }) as const;

// =================================================================================
// 3. NEXT-AUTH CONFIGURATION
// =================================================================================
//    This config object replaces all the automatic session handling that Stencil did.
//    We configure it to use encrypted JWTs (JSON Web Tokens) stored in cookies, and we 
//    set up our custom "Providers" (the login functions we wrote above).
const config = {
  // Explicitly setting this value to be undefined. We want the library to handle CSRF checks when taking sensitive actions.
  // When handling sensitive actions like sign in, sign out, etc., the library will automatically check for CSRF tokens.
  // If you need to implement your own sensitive actions, you will need to implement CSRF checks yourself.
  skipCSRFCheck: undefined,
  // Set this environment variable if you want to trust the host when using `next build` & `next start`.
  // Otherwise, this will be controlled by process.env.NODE_ENV within the library.
  trustHost: process.env.AUTH_TRUST_HOST === 'true' ? true : undefined,
  session: {
    strategy: 'jwt', // Store the session data in an encrypted JWT cookie
  },
  pages: {
    signIn: '/login', // Redirect here if auth fails
    signOut: '/logout',
  },
  callbacks: {
    // This runs whenever NextAuth encrypts the session cookie.
    // We inject our BigCommerce customer token and cart ID into the cookie here.
    jwt: ({ token, user, session, trigger }) => {
      // user can actually be undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user?.customerAccessToken) {
        token.user = {
          ...token.user,
          customerAccessToken: user.customerAccessToken,
        };
      }

      // user can actually be undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user?.cartId) {
        token.user = {
          ...token.user,
          cartId: user.cartId,
        };
      }

      // user can actually be undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user?.firstName !== undefined) {
        token.user = {
          ...token.user,
          firstName: user.firstName,
        };
      }

      // user can actually be undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user?.lastName !== undefined) {
        token.user = {
          ...token.user,
          lastName: user.lastName,
        };
      }

      if (trigger === 'update') {
        const parsedSession = SessionUpdate.safeParse(session);

        if (parsedSession.success) {
          token.user = {
            ...token.user,
            cartId: parsedSession.data.user.cartId,
          };
        }
      }

      return token;
    },
    // This runs whenever our React components call `await auth()` to read the session.
    // We extract the fields from the encrypted token and expose them to the app.
    session({ session, token }) {
      if (token.user?.customerAccessToken) {
        session.user.customerAccessToken = token.user.customerAccessToken;
      }

      if (token.user?.cartId !== undefined) {
        session.user.cartId = token.user.cartId;
      }

      if (token.user?.firstName !== undefined) {
        session.user.firstName = token.user.firstName;
      }

      if (token.user?.lastName !== undefined) {
        session.user.lastName = token.user.lastName;
      }

      return session;
    },
  },
  events: {
    // When a user logs out, we need to explicitly tell BigCommerce to destroy the session.
    // In Stencil, redirecting to /login.php?action=logout did this automatically.
    async signOut(message) {
      const cartEntityId = 'token' in message ? message.token?.user?.cartId : null;
      const customerAccessToken =
        'token' in message ? message.token?.user?.customerAccessToken : null;

      if (customerAccessToken) {
        try {
          const logoutResponse = await client.fetch({
            document: LogoutMutation,
            variables: {
              cartEntityId,
            },
            customerAccessToken,
            fetchOptions: {
              cache: 'no-store',
            },
          });

          // If the logout is successful, we want to establish a new anonymous session.
          // This will allow us to restore the cart if persistent cart is disabled.
          await anonymousSignIn();

          // If persistent cart is disabled, we can restore the cart back to the anonymous session.
          if (logoutResponse.data.logout.cartUnassignResult.cart) {
            await setCartId(logoutResponse.data.logout.cartUnassignResult.cart.entityId);

            return;
          }

          await clearCartId();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }
    },
  },
  providers: [
    CredentialsProvider({
      id: 'password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        cartId: { type: 'text' },
      },
      authorize: loginWithPassword,
    }),
    CredentialsProvider({
      id: 'jwt',
      credentials: {
        jwt: { type: 'text' },
        cartId: { type: 'text' },
      },
      authorize: loginWithJwt,
    }),
  ],
  // configure NextAuth cookies to work inside of the Makeswift Builder's canvas
  cookies: {
    sessionToken: partitionedCookie(),
    callbackUrl: partitionedCookie(),
    csrfToken: partitionedCookie(),
    pkceCodeVerifier: partitionedCookie(),
    state: partitionedCookie(),
    nonce: partitionedCookie(),
    webauthnChallenge: partitionedCookie(),
  },
} satisfies NextAuthConfig;

// =================================================================================
// 4. INITIALIZING AUTH.JS
// =================================================================================
//    We export the `auth()` function. You will see `await auth()` called across the app 
//    to grab the current user's session token securely on the server!
export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth(config);

export const getSessionCustomerAccessToken = async () => {
  try {
    const session = await auth();

    return session?.user?.customerAccessToken;
  } catch {
    // No empty
  }
};

export const isLoggedIn = async () => {
  const cat = await getSessionCustomerAccessToken();

  return Boolean(cat);
};

export {
  anonymousSignIn,
  clearAnonymousSession,
  getAnonymousSession,
  updateAnonymousSession,
} from './anonymous-session';
