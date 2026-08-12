import { Checkbox, Number, Select, TextInput, Link, Color, Image } from '@makeswift/runtime/controls';

import { runtime } from '~/lib/makeswift/runtime';

import { DemoWidget } from './index';

// =================================================================================
// 🎓 MAKESWIFT WIDGET TUTORIAL (The CMS Registration)
// =================================================================================
// This file registers your React component with the Makeswift visual editor.
// We define `type: 'demo-widget'`, which is how Makeswift identifies it under the hood.
// The `props` object maps directly to the sidebar controls in the CMS!
runtime.registerComponent(DemoWidget, {
  type: 'demo-widget',
  label: 'Demo Widget',
  props: {
    // 1. TextInput: A standard text box
    heading: TextInput({ 
      label: 'Heading', 
      defaultValue: 'Mastering Tailwind CSS' 
    }),
    
    // 2. Select: Choosing a font size (Small, Medium, Large)
    headingSize: Select({
      label: 'Heading Size',
      options: [
        { label: 'Medium', value: 'md' },
        { label: 'Large (Default)', value: 'lg' },
        { label: 'Massive', value: 'xl' },
      ],
      defaultValue: 'lg',
    }),

    // 3. Color: A full color picker for the user!
    headingColor: Color({
      label: 'Custom Heading Color (Optional)',
    }),

    subheading: TextInput({ 
      label: 'Subheading', 
      defaultValue: 'Learn how to build stunning, responsive layouts without writing a single line of custom CSS.' 
    }),
    
    // 4. Image: Allows the user to upload or select an image from the CMS media library
    heroImage: Image({
      label: 'Hero Image (Optional)',
    }),
    
    // 5. Link: Allows the user to select an internal page or external URL
    buttonLink: Link({
      label: 'Button Link',
    }),
    buttonText: TextInput({ 
      label: 'Button Text', 
      defaultValue: 'Get Started' 
    }),
    
    // 6. Select: A dropdown menu for the theme
    themeColor: Select({
      label: 'Theme Color',
      options: [
        { label: 'Cyan', value: 'cyan' },
        { label: 'Pink', value: 'pink' },
        { label: 'Emerald', value: 'emerald' },
      ],
      defaultValue: 'cyan',
    }),

    // 7. Checkbox: A simple boolean toggle (true/false)
    showFeatures: Checkbox({
      label: 'Show Feature Cards',
      defaultValue: true,
    }),

    // 8. Number: A numeric input field
    gridColumns: Number({
      label: 'Feature Columns (Desktop)',
      defaultValue: 3,
      min: 1,
      max: 4,
      step: 1,
    }),
  },
});
