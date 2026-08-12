import { Metadata } from 'next';
import { getMakeswiftPageMetadata, Page as MakeswiftPage } from '~/lib/makeswift';

interface Params {
  locale: string;
}

interface Props {
  params: Promise<Params>;
}

// Generates the <title> and <meta> tags for SEO based on Makeswift CMS data!
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const metadata = await getMakeswiftPageMetadata({ path: '/demo', locale });

  return {
    ...(metadata?.title != null && { title: metadata.title }),
    ...(metadata?.description != null && { description: metadata.description }),
  };
}

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;

  // Since you have already created the `/demo` page in the Makeswift backend,
  // this will fetch the drag-and-drop canvas data from the CMS and inject it
  // directly into our beautiful Tailwind Layout!
  return <MakeswiftPage locale={locale} path="/demo" />;
}
