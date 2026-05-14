---
name: Aether Intelligence
colors:
  surface: '#141218'
  surface-dim: '#141218'
  surface-bright: '#3b383e'
  surface-container-lowest: '#0f0d13'
  surface-container-low: '#1d1b20'
  surface-container: '#211f24'
  surface-container-high: '#2b292f'
  surface-container-highest: '#36343a'
  on-surface: '#e6e0e9'
  on-surface-variant: '#cbc4d2'
  inverse-surface: '#e6e0e9'
  inverse-on-surface: '#322f35'
  outline: '#948e9c'
  outline-variant: '#494551'
  surface-tint: '#cfbcff'
  primary: '#cfbcff'
  on-primary: '#381e72'
  primary-container: '#6750a4'
  on-primary-container: '#e0d2ff'
  inverse-primary: '#6750a4'
  secondary: '#cdc0e9'
  on-secondary: '#342b4b'
  secondary-container: '#4d4465'
  on-secondary-container: '#bfb2da'
  tertiary: '#e7c365'
  on-tertiary: '#3e2e00'
  tertiary-container: '#c9a74d'
  on-tertiary-container: '#503d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#cfbcff'
  on-primary-fixed: '#22005d'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffdf93'
  tertiary-fixed-dim: '#e7c365'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#141218'
  on-background: '#e6e0e9'
  surface-variant: '#36343a'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  max-width: 1440px
---

## Brand & Style

The design system is engineered for the high-stakes world of AI-driven finance, blending the ultra-utilitarian density of a Bloomberg Terminal with the serene, focused minimalism of modern AI interfaces. It targets sophisticated investors and institutional users who require rapid data interpretation without cognitive overload.

The visual style is defined by **Glassmorphic-Minimalism**. This approach uses deep-layered translucency to represent the "transparency" of AI logic, while maintaining a strict, grid-based precision inspired by developer tools like Linear. The emotional response is one of calm confidence; the interface feels like a high-end cockpit—advanced, powerful, yet remarkably quiet.

## Colors

The palette is anchored in a "Deep Space" navy background to reduce eye strain during long sessions. The primary Emerald Green is used surgically: it is reserved for financial growth, successful AI confirmations, and primary action calls. 

To maintain a premium feel, secondary actions use Slate Gray, while borders utilize a slightly higher-contrast Slate to define structure without breaking the dark aesthetic. Backgrounds for cards and modals should leverage a translucent alpha channel to enable the glassmorphism effect, ensuring that the #0B0F19 base remains the visual foundation.

## Typography

This design system utilizes a trio of typefaces to achieve its data-driven vibe. **Hanken Grotesk** provides a sharp, contemporary feel for headlines. **Inter** handles the bulk of the UI for its legendary legibility in dark mode. **JetBrains Mono** is introduced for data points, ticker symbols, and AI confidence scores, lending a "terminal" precision to the numerical values.

High contrast is non-negotiable. Body text should stick to off-whites (#F9FAFB) to prevent the "vibrating" effect of pure white on black, while metadata should use the muted Slate Gray.

## Layout & Spacing

The system follows a strict **12-column fluid grid** for data dashboards, transitioning to a focused single-column layout for AI chat interactions. Spacing is governed by a 4px baseline grid, ensuring consistent vertical rhythm. 

Content should be grouped in logic-based modules with 24px gutters. For data-heavy views, density can be increased by reducing internal padding, but the outer margins must remain generous to prevent the "Bloomberg clutter" while retaining the "Bloomberg power."

## Elevation & Depth

Depth is not achieved through heavy shadows, but through **Backdrop Blurs** and **Tonal Layering**. 

1.  **Level 0 (Base):** The #0B0F19 background.
2.  **Level 1 (Surface):** Translucent Slate Gray (rgba(31, 41, 55, 0.6)) with a 12px backdrop blur. This is for secondary containers and sidebars.
3.  **Level 2 (Cards/Modals):** A slightly lighter fill with a 1px inner border of #374151.
4.  **Level 3 (Active/Hover):** For interactive elements, a subtle 10px-20px spread Emerald glow (rgba(16, 185, 129, 0.1)) replaces traditional shadows to simulate an emissive digital screen.

## Shapes

The design system utilizes **Rounded** (Type 2) corners. Base components (inputs, buttons) use a 12px radius, while larger containers (cards, dashboard sections) scale up to 16px. 

This specific radius balance prevents the UI from looking too "bubbly" or consumer-grade, while avoiding the aggressive sharpness of legacy financial software. Every container should feature a crisp 1px border to define its boundaries against the dark background.

## Components

### Buttons
Primary buttons use a solid Emerald Green fill with JetBlack text for maximum contrast. Secondary buttons are "Ghost" style: transparent backgrounds with a #374151 border, transitioning to a subtle Emerald glow on hover.

### Input Fields
Inputs are dark-filled containers with a 1px border. Upon focus, the border transitions to Emerald Green, and a soft outer glow (2px) is applied to signify AI "readiness."

### Cards
Cards are the primary container. They must use the glassmorphism effect: `backdrop-filter: blur(12px)`. Headlines inside cards should be followed by a subtle horizontal rule using the soft border color.

### AI Indicators
A unique "Spark" component—a small, pulsating emerald dot or a 2px gradient line—should appear next to any data point that has been generated or influenced by AI.

### Hover States
Interactions should feel "emissive." Instead of shifting the background color significantly, elements should "light up." Use a transition speed of 200ms for all hover effects to ensure the UI feels responsive yet fluid.