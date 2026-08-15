import { TextInput, Link, Image, List, Group, Number, Color, Select } from '@makeswift/runtime/controls';

import { runtime } from '~/lib/makeswift/runtime';

import { FeaturedBrandsWidget } from './index';

// 🎓 TUTORIAL: Makeswift Component Registration
// This file bridges the gap between your Next.js React component and the visual builder.
// The `props` object here defines exactly what inputs will appear in the right-hand sidebar.
runtime.registerComponent(FeaturedBrandsWidget, {
  type: 'featured-brands-widget',
  label: 'Featured Brands',
  props: {
    // 🎨 SECTION: Heading & Typography
    heading: TextInput({
      label: 'Heading Text',
      defaultValue: 'Featured Brands'
    }),
    headingSize: Select({
      label: 'Heading Size',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large (Default)', value: 'lg' },
        { label: 'Extra Large', value: 'xl' },
      ],
      defaultValue: 'lg',
    }),
    headingColor: Color({
      label: 'Heading Color (Optional)',
    }),

    // 🔗 SECTION: Link
    linkText: TextInput({
      label: 'Link Text',
      defaultValue: 'VIEW ALL BRANDS \u2192'
    }),
    linkColor: Color({
      label: 'Link Color (Optional)',
    }),
    linkUrl: Link({
      label: 'Link URL',
    }),

    // ⚙️ SECTION: Widget Settings (Background & Animation)
    backgroundColor: Color({
      label: 'Background Color (Optional)',
    }),
    animationSpeed: Number({
      label: 'Animation Speed (seconds)',
      defaultValue: 30, // Higher is slower
      min: 5,
      max: 120,
      step: 1,
    }),

    // 📏 SECTION: Logo Dimensions & Spacing
    logoHeight: Number({
      label: 'Logo Max Height (px)',
      defaultValue: 120, // 64px is standard for elegant logos
      min: 24,
      max: 200,
      step: 4,
    }),
    logoGap: Number({
      label: 'Gap Between Logos (px)',
      defaultValue: 56, // Large padding for a professional feel
      min: 16,
      max: 120,
      step: 4,
    }),

    // 🖼️ SECTION: The List of Logos
    // The `List` control allows editors to add, remove, and reorder an infinite number of items!
    logos: List({
      label: 'Brand Logos',
      type: Group({
        label: 'Logo',
        props: {
          image: Image({
            label: 'Image',
          }),
          altText: TextInput({
            label: 'Alt Text (For accessibility)',
            defaultValue: 'Brand Logo'
          }),
        },
      }),
      // This defines what text shows up on the collapsed item in the sidebar list
      getItemLabel(item) {
        return item?.altText || 'Logo';
      },
    }),
  },
});
