// =================================================================================
// 🎓 DEEP DIVE: COMPARING STENCIL TO REACT (Line-by-Line)
// =================================================================================
// 1. In Stencil, the URL mapping was handled by BigCommerce automatically.
//    In Next.js, the URL is determined by the folder structure ("File-Based Routing").
//    Because this file is located at `app/[locale]/(default)/page.tsx`, 
//    it represents the absolute root (Home page) of your storefront.

import { Metadata } from 'next';

import { locales } from '~/i18n/locales';
import { getMakeswiftPageMetadata, Page as MakeswiftPage } from '~/lib/makeswift';
import { getMetadataAlternates } from '~/lib/seo/canonical';

// =================================================================================
// 🎓 TYPESCRIPT TIP: INTERFACES (Data Blueprints)
// =================================================================================
//    In Javascript, an object can hold anything: `const user = { name: "Bob", age: 5 }`.
//    If you try to read `user.email`, it just silently fails and returns `undefined`.
//    TypeScript fixes this by forcing us to create an `interface` (a blueprint).
//    Below, we say: "The Params object MUST have a `locale` field that is a string."
//    If we try to read `params.somethingElse`, TypeScript will throw a hard error!
interface Params {
  locale: string;
}

interface Props {
  // 🎓 TYPESCRIPT TIP: PROMISES
  // A `Promise` means "This data isn't here yet, but it will be soon."
  // Next.js passes URL parameters as a Promise because reading them from the URL takes a split second.
  params: Promise<Params>;
}

// =========================================================================
// 2. SEO METADATA (The Frontmatter Equivalent)
// =========================================================================
//    In Stencil, you requested frontmatter at the top of a template.
//    Next.js uses the `generateMetadata` function to set <title> and <meta> tags dynamically.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // =========================================================================
  // 🎓 JAVASCRIPT TIP: DESTRUCTURING (`{ }`)
  // =========================================================================
  //    Instead of writing `const locale = await params.locale;`, Javascript lets us 
  //    "unpack" variables from an object directly into their own constants.
  //    `const { locale }` literally just means: "find a field named `locale` inside 
  //    the object on the right, and make a new variable out of it."
  const { locale } = await params;
  const metadata = await getMakeswiftPageMetadata({ path: '/', locale });

  return {
    ...(metadata?.title != null && { title: metadata.title }),
    ...(metadata?.description != null && { description: metadata.description }),
    alternates: await getMetadataAlternates({ path: '/', locale }),
  };
}

export function generateStaticParams(): Params[] {
  return locales.map((locale) => ({ locale }));
}

// =========================================================================
// 3. THE PAGE COMPONENT
// =========================================================================
export default async function Home({ params }: Props) {
  const { locale } = await params;

  // 4. Instead of hardcoding components here, we return a <MakeswiftPage />.
  //    This tells Makeswift: "Take over the rendering of this page entirely,
  //    and load whatever the merchant drags-and-drops in the visual editor for the path '/'."
  return <MakeswiftPage locale={locale} path="/" />;
}
