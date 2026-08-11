import React from 'react';

// =========================================================================
// 1. THE "FRONTMATTER" / SCHEMA EQUIVALENT (TypeScript Interface)
// =========================================================================
// In Stencil, you didn't explicitly declare what variables a template expected.
// In React/TypeScript, we use an "interface" to define exactly what data
// this component needs. Think of this as the list of variables that 
// Handlebars would normally pull from the {{context}}.
interface TestMakeswiftProps {
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
}

// =========================================================================
// 2. THE COMPONENT FUNCTION (The Stencil Template Equivalent)
// =========================================================================
// In Stencil, this entire file would be an HTML file (e.g. widget.html).
// In React, everything is a JavaScript/TypeScript function that returns HTML.
// The data passed into the function (title, description, etc.) is called "props".
export function TestMakeswift({ 
  title, 
  description, 
  backgroundColor, 
  textColor 
}: TestMakeswiftProps) {
  
  // =======================================================================
  // 3. THE UI (JSX)
  // =======================================================================
  // What is returned here is called "JSX" (JavaScript XML). 
  // It looks like HTML, but it's inside JavaScript.
  // Instead of Handlebars syntax like {{title}}, you use single curly braces {title}.
  return (
    <div 
      // Instead of writing static inline styles, we can pass JavaScript variables 
      // directly into the style object.
      style={{ backgroundColor: backgroundColor, color: textColor }} 
      // 'className' is exactly the same as 'class' in regular HTML.
      // We use it here to add Tailwind CSS utility classes.
      className="p-10 rounded-xl shadow-md text-center my-4 border border-gray-200"
    >
      {/* Notice how we inject the 'title' variable using {title} instead of {{title}} */}
      <h2 className="text-3xl font-bold mb-4">{title}</h2>
      
      {/* Same for description */}
      <p className="text-lg">{description}</p>
    </div>
  );
}
