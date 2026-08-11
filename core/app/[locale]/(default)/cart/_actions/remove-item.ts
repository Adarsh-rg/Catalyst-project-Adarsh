'use server';

// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, mutations like removing a cart item were done via front-end JS 
//    calling BigCommerce APIs (`utils.api.cart.itemRemove(itemId, callback)`).
//
//    This file runs entirely on the Node.js server. When a user clicks "Trash" on a 
//    cart item, React securely sends a message to this Server Action (`'use server'`).
//
//    Why we use this: Instead of writing a custom Express or Next.js `/api/remove-cart-item` 
//    route that you have to maintain and fetch() from the client, Server Actions allow you 
//    to call backend functions directly from your React components!

import { revalidateTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { getSessionCustomerAccessToken } from '~/auth';
import { client } from '~/client';
import { graphql, VariablesOf } from '~/client/graphql';
import { TAGS } from '~/client/tags';
import { clearCartId, getCartId } from '~/lib/cart';

// 2. Define the GraphQL Mutation to delete a line item from the cart.
const DeleteCartLineItemMutation = graphql(`
  mutation DeleteCartLineItemMutation($input: DeleteCartLineItemInput!) {
    cart {
      deleteCartLineItem(input: $input) {
        cart {
          entityId
        }
      }
    }
  }
`);

// =================================================================================
// 🎓 TYPESCRIPT TIP: Utility Types (`VariablesOf`, `Omit`)
// =================================================================================
// 3. `VariablesOf` asks the GraphQL codegen: "What variables does this mutation require?"
//    It sees `DeleteCartLineItemInput!`, and creates a type for it!
//
//    In the function below, we use `Omit<DeleteCartLineItemInput, 'cartEntityId'>`.
//    This tells TypeScript: "I expect an object that looks exactly like DeleteCartLineItemInput, 
//    EXCEPT it shouldn't have the `cartEntityId` property (because we'll fetch that securely from the cookie!)."
type Variables = VariablesOf<typeof DeleteCartLineItemMutation>;
type DeleteCartLineItemInput = Variables['input'];

export async function removeItem({
  lineItemEntityId,
}: Omit<DeleteCartLineItemInput, 'cartEntityId'>) {
  // 4. Load translations for the 'Cart.Errors' namespace to display localized errors.
  const t = await getTranslations('Cart.Errors');

  // 5. Retrieve the current user's session token if logged in.
  const customerAccessToken = await getSessionCustomerAccessToken();

  // 6. Retrieve the Cart ID from the secure HttpOnly cookie.
  const cartId = await getCartId();

  // 7. If there's no Cart ID, we can't delete anything, so throw an error.
  if (!cartId) {
    throw new Error(t('cartNotFound'));
  }

  // 8. If the frontend didn't provide a line item ID to delete, throw an error.
  if (!lineItemEntityId) {
    throw new Error(t('lineItemNotFound'));
  }

  // =================================================================================
  // 9. EXECUTING THE MUTATION (Replaces `utils.api.cart.itemRemove`)
  // =================================================================================
  // Execute the GraphQL mutation to delete the item from the cart directly from our server.
  const response = await client.fetch({
    document: DeleteCartLineItemMutation,
    variables: {
      input: {
        cartEntityId: cartId,
        lineItemEntityId,
      },
    },
    customerAccessToken,
    fetchOptions: { cache: 'no-store' }, // Never cache this mutation
  });

  // Extract the updated cart from the GraphQL response
  const cart = response.data.cart.deleteCartLineItem?.cart;

  // 10. If we remove the last item in a cart the cart is deleted by BigCommerce,
  //     so we need to remove the cartId cookie on our end.
  //     In Stencil this was handled magically by BigCommerce cookies, but we manage it explicitly here.
  if (!cart) {
    await clearCartId(); // Clears the secure cookie, basically starting a fresh session.
  }

  // =================================================================================
  // 11. REVALIDATING THE CACHE
  // =================================================================================
  //     After we successfully tell BigCommerce to delete the item, we MUST tell Next.js 
  //     that its cached version of the cart is now stale.
  //
  //     `revalidateTag(TAGS.cart)` instantly purges the old cart data from Next.js memory. 
  //     This forces all components listening to the cart (like the Cart page and the Header cart badge) 
  //     to instantly refetch the fresh data from the server.
  revalidateTag(TAGS.cart, { expire: 0 });

  return cart;
}
