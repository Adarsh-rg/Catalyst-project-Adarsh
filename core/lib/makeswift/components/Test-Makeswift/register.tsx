import { runtime } from '~/lib/makeswift/runtime';
import { TextInput, Color } from '@makeswift/runtime/controls';
import { TestMakeswift } from '~/components/Test-makeswift';

// =========================================================================
// THE "schema.json" EQUIVALENT
// =========================================================================
// In Stencil, to make a custom widget for Page Builder, you created a schema.json
// file that defined the UI controls (text inputs, color pickers, etc.).
// In Catalyst/Makeswift, this file does that exact job!

runtime.registerComponent(TestMakeswift, {
  // 'type' is a unique ID for this widget, similar to widget template ID in Stencil.
  type: 'test-makeswift',
  // 'label' is what the merchant sees in the Makeswift sidebar tray.
  label: 'Custom / Test Component',
  
  // =======================================================================
  // MAPPING CONTROLS TO REACT PROPS
  // =======================================================================
  // This 'props' object is where you define the controls.
  // The keys here (title, description, backgroundColor) MUST exactly match 
  // the variable names you defined in your React component's interface!
  props: {
    // TextInput is equivalent to: { "type": "string", "label": "Title" } in Stencil
    title: TextInput({
      label: 'Title',
      defaultValue: 'Hello Makeswift',
    }),
    
    description: TextInput({
      label: 'Description',
      defaultValue: 'This is a custom component we built together!',
    }),
    
    // Color is equivalent to: { "type": "color", "label": "Background Color" } in Stencil
    backgroundColor: Color({
      label: 'Background Color',
      defaultValue: '#f3f4f6',
    }),
    
    textColor: Color({
      label: 'Text Color',
      defaultValue: '#111827',
    }),
  },
});
