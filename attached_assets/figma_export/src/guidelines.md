# The Side Door - Design System Guidelines

## Brand Identity

### Product Name
- **Primary**: The Side Door
- **Short**: Side Door
- **Tagline**: Bypass the application black hole and land directly in hiring managers' inboxes

### Logo
- **Icon**: Key icon (from lucide-react)
- **Style**: Purple gradient background (#6B46C1 to #9F7AEA)
- **Size**: 28px × 28px (w-7 h-7)
- **Border radius**: 6px (rounded-md)
- **Icon size**: 16px (w-4 h-4)
- **Icon color**: White

---

## Color System

### Primary Colors
```
Primary Purple: #6B46C1
  - Hover state: #5a3ba1
  - Light variant: #9F7AEA
  - Lightest: #F7F5FF
  - Border: #E9E3FF

Background Purple (gradient):
  - from-[#6B46C1] to-[#8B5CF6]
  - or from-[#6B46C1] to-[#9F7AEA]
```

### Neutral Colors
```
Text Colors:
  - Heading/Primary: #1A202C or #0F172A
  - Body/Secondary: #718096 or #64748B
  - Tertiary/Muted: #A0AEC0

Background Colors:
  - Page background: #FAFBFC or #F8FAFC
  - Card background: #FFFFFF
  - Hover background: #F8FAFC or #F7FAFC

Border Colors:
  - Default: #E2E8F0
  - Light: #F1F5F9
  - Subtle: #CBD5E1
```

### Status Colors
```
Success/Verified:
  - Green: #48BB78 or #10B981
  - Background: #F0FFF4 or green-50
  - Border: green-200

Warning/Risky:
  - Yellow/Orange: #F59E0B or #ECC94B
  - Background: orange-50 or yellow-50
  - Border: orange-200 or yellow-200

Error/Invalid:
  - Red: #F56565 or #EF4444
  - Background: red-50
  - Border: red-200

Info:
  - Blue: #3B82F6 or #4299E1
  - Background: blue-50
  - Border: blue-200
```

### Email Verification Status Colors
```
Verified: Green (#48BB78)
Risky: Yellow/Orange (#F59E0B)
Invalid: Red (#F56565)
Unknown: Gray (#A0AEC0)
```

---

## Typography

### Font Family
- **Default**: System font stack (inherited from globals.css)
- **Monospace**: Used for code/resume text inputs

### Font Sizes
**DO NOT use Tailwind font size classes** (text-xs, text-sm, text-lg, etc.) unless specifically requested, as we have default typography setup in `/styles/globals.css`.

When text sizes ARE specified:
```
- text-xs: 12px
- text-sm: 14px
- text-[13px]: 13px
- text-[14px]: 14px
- text-[15px]: 15px
- text-base: 16px
```

### Font Weights
**DO NOT use Tailwind font weight classes** (font-bold, font-semibold, etc.) unless specifically requested.

When weights ARE specified:
```
- font-medium: 500
- font-semibold: 600
- font-bold: 700
```

### Headings
```
h1: Default styling from globals.css
h2: Default styling from globals.css
h3: Default styling from globals.css

Explicit overrides when needed:
- text-[#1A202C] or text-[#0F172A]
- mb-1, mb-1.5, mb-2 for spacing
```

---

## Spacing System

### Grid System
- **Base unit**: 8px
- Use multiples of 8px for consistency (8, 16, 24, 32, 40, 48, etc.)

### Common Spacing Values
```
Padding:
  - Card padding: p-6 (24px)
  - Section padding: p-4 sm:p-6 lg:p-8
  - Page padding: px-4 sm:px-6 lg:px-8 py-8

Gaps:
  - Small gap: gap-2 (8px)
  - Medium gap: gap-3 or gap-4 (12-16px)
  - Large gap: gap-6 (24px)

Margins:
  - Section bottom: mb-8 or mb-10
  - Element bottom: mb-2, mb-3, mb-4
```

---

## Component Patterns

### Buttons

#### Primary CTA
```jsx
<button className="bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-2.5 rounded-lg transition-all font-medium text-[14px] shadow-sm">
  Button Text
</button>
```

#### Secondary Button
```jsx
<button className="bg-white border border-[#E2E8F0] text-[#718096] px-4 py-2.5 rounded-lg hover:border-[#6B46C1] hover:text-[#6B46C1] transition-colors font-medium text-[14px]">
  Button Text
</button>
```

#### Outline Button (Hover State)
```jsx
<button className="border border-[#E2E8F0] text-[#718096] px-4 py-2.5 rounded-lg hover:bg-[#6B46C1] hover:text-white hover:border-[#6B46C1] transition-all font-medium text-[14px]">
  Button Text
</button>
```

#### Icon Button
```jsx
<button className="w-8 h-8 rounded-lg hover:bg-[#F7FAFC] flex items-center justify-center transition-colors">
  <Icon className="w-4 h-4 text-[#718096]" />
</button>
```

### Cards

#### Standard Card
```jsx
<div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
  {/* Content */}
</div>
```

#### Hoverable Card
```jsx
<div className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
  {/* Content */}
</div>
```

#### Section Card with Header
```jsx
<div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
  <div className="px-6 py-5 border-b border-[#E2E8F0]">
    <h2>Section Title</h2>
  </div>
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

### Form Inputs

#### Text Input
```jsx
<input
  type="text"
  placeholder="Placeholder text"
  className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
/>
```

#### Textarea
```jsx
<textarea
  placeholder="Placeholder text"
  className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
  rows={5}
/>
```

#### Select Dropdown
```jsx
<select className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] bg-white">
  <option>Option 1</option>
</select>
```

### Tags

#### Purple Tag (Achievements)
```jsx
<div className="bg-[#F7F5FF] border border-[#E9E3FF] text-[#6B46C1] px-3 py-2 rounded-lg text-[14px] flex items-center gap-2">
  Tag content
</div>
```

#### Status Tags
```jsx
// Verified
<span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
  Verified
</span>

// Risky
<span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium">
  Risky
</span>

// Invalid
<span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
  Invalid
</span>
```

### Icon Containers

#### Colored Icon Box
```jsx
// Purple variant
<div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
  <Icon className="w-5 h-5 text-[#6B46C1]" />
</div>

// Blue variant
<div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
  <Icon className="w-5 h-5 text-blue-600" />
</div>

// Green variant
<div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
  <Icon className="w-5 h-5 text-green-600" />
</div>
```

### Progress Indicators

#### Progress Bar
```jsx
<div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
  <div className="bg-[#6B46C1] h-1.5 rounded-full" style={{ width: "65%" }}></div>
</div>
```

### Empty States
```jsx
<div className="text-center py-12">
  <div className="w-12 h-12 bg-[#F7FAFC] rounded-full flex items-center justify-center mx-auto mb-4">
    <Icon className="w-6 h-6 text-[#A0AEC0]" />
  </div>
  <h3 className="text-[#1A202C] mb-2">Empty State Title</h3>
  <p className="text-[#718096] text-sm mb-6">Description text</p>
  <button className="bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-2.5 rounded-lg">
    Primary Action
  </button>
</div>
```

---

## Layout Patterns

### Page Container
```jsx
<div className="min-h-screen bg-[#FAFBFC]">
  {/* Page content */}
</div>
```

### Content Container
```jsx
<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {/* Content */}
</div>
```

### Sticky Header
```jsx
<div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {/* Header content */}
  </div>
</div>
```

### Grid Layouts
```jsx
// 2 columns
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Items */}
</div>

// 3 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>
```

---

## Navigation

### Sidebar Navigation

#### Logo Section
```jsx
<div className="h-16 flex items-center px-6 border-b border-[#E2E8F0]">
  <div className="flex items-center gap-2.5">
    <div className="w-7 h-7 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-md flex items-center justify-center">
      <Key className="w-4 h-4 text-white" />
    </div>
    <span className="font-semibold text-[#1A202C] text-[15px]">The Side Door</span>
  </div>
</div>
```

#### Primary CTA (New Search)
```jsx
<div className="px-3 pt-4 pb-3">
  <button className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-2.5 rounded-lg transition-all font-medium text-[14px] flex items-center justify-center gap-2 shadow-sm">
    <Plus className="w-4 h-4" />
    New Search
  </button>
</div>
```

#### Navigation Item (Active State)
```jsx
// Active
<button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#F7F5FF] text-[#6B46C1] transition-colors">
  <Icon className="w-5 h-5" />
  <span className="font-medium text-[14px]">Label</span>
</button>

// Inactive
<button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#718096] hover:bg-[#F7FAFC] transition-colors">
  <Icon className="w-5 h-5" />
  <span className="font-medium text-[14px]">Label</span>
</button>
```

#### Credits Card in Sidebar
```jsx
<div className="mx-3 my-3 p-4 bg-gradient-to-br from-[#F7F5FF] to-white border border-[#E9E3FF] rounded-lg">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-[#6B46C1] font-medium">Credits</span>
    <Zap className="w-3.5 h-3.5 text-[#6B46C1]" />
  </div>
  <div className="text-2xl font-bold text-[#1A202C] mb-1">847</div>
  <p className="text-xs text-[#718096]">Available searches</p>
</div>
```

---

## Responsive Design

### Breakpoints
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### Mobile-First Approach
- Always design mobile-first
- Use responsive utilities: `class="mobile md:desktop"`
- Hide on mobile: `hidden md:block`
- Show on mobile only: `md:hidden`

### Common Responsive Patterns
```jsx
// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">

// Full width on mobile, fixed width on desktop
<div className="w-full md:w-64">

// Different padding
<div className="px-4 md:px-6 lg:px-8">

// Different grid columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

---

## Icon System

### Library
- **Package**: lucide-react
- **Import**: `import { IconName } from "lucide-react";`

### Common Icons
```
Navigation: Home, Clock, Users, Settings, CreditCard, UserCircle
Actions: Search, Plus, X, ChevronRight, ArrowRight, Save
Status: CheckCircle, AlertCircle, XCircle, Zap
Content: FileText, MessageSquare, Trophy, Heart, Sparkles, Key
UI: Menu, Filter, ChevronDown, Copy, Mail
```

### Icon Sizes
```
Small: w-3 h-3 or w-3.5 h-3.5
Default: w-4 h-4
Medium: w-5 h-5
Large: w-6 h-6
```

---

## Animation & Transitions

### Standard Transitions
```jsx
// All properties
transition-all

// Specific properties
transition-colors
transition-opacity
transition-shadow
```

### Hover States
```jsx
// Button hover
hover:bg-[#5a3ba1]

// Card hover
hover:shadow-md

// Icon hover
hover:text-[#6B46C1]

// Background hover
hover:bg-[#F7FAFC]
```

### Group Hover
```jsx
<div className="group">
  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
    Hidden until parent hover
  </button>
</div>
```

---

## Shadows

### Shadow Scale
```
- shadow-sm: Subtle shadow for buttons
- shadow-md: Card hover state
- shadow-lg: Modal/dropdown shadow
- shadow-xl: Elevated elements
```

### Custom Shadows
```jsx
// CTA button shadow
className="shadow-lg shadow-black/10"
```

---

## Z-Index Layers

```
Sticky header: z-10
Dropdown menus: z-20
Modals/overlays: z-30
Tooltips: z-40
Mobile menu: z-50
```

---

## Best Practices

### DO
✅ Use consistent 8px spacing grid
✅ Stick to defined color palette
✅ Use purple (#6B46C1) for all primary CTAs
✅ Maintain hover states on interactive elements
✅ Include focus states for accessibility
✅ Use semantic color coding (green=verified, red=error, etc.)
✅ Keep mobile-responsive design in mind
✅ Use icons from lucide-react consistently
✅ Apply rounded-lg (8px) or rounded-xl (12px) for modern feel

### DON'T
❌ Don't add font size/weight classes unless requested (we have global defaults)
❌ Don't mix color systems (stick to defined palette)
❌ Don't use arbitrary spacing values outside 8px grid
❌ Don't forget hover/focus states on interactive elements
❌ Don't use different icon libraries
❌ Don't override typography without good reason
❌ Don't create inconsistent border radiuses
❌ Don't forget mobile breakpoints

---

## File Organization

```
/components
  /ui (Shadcn components - don't modify)
  /Layout.tsx
  /Dashboard.tsx
  /SearchPage.tsx
  /JobHistory.tsx
  /JobDetails.tsx
  /AllContacts.tsx
  /ContactDetail.tsx
  /OutreachProfile.tsx
  /Subscription.tsx
  /Credits.tsx
  /Settings.tsx
  /BillingHistory.tsx

/styles
  /globals.css (Typography defaults)

/App.tsx (Main router)
```

---

## Component Library (Shadcn)

### Available Components
Located in `/components/ui/`:
- accordion, alert-dialog, alert, aspect-ratio, avatar
- badge, breadcrumb, button
- calendar, card, carousel, chart, checkbox, collapsible, command, context-menu
- dialog, drawer, dropdown-menu
- form, hover-card
- input-otp, input, label
- menubar, navigation-menu
- pagination, popover, progress
- radio-group, resizable
- scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch
- table, tabs, textarea, toggle-group, toggle, tooltip

### Import Pattern
```jsx
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
```

---

## Notes

- This design system prioritizes consistency and professional polish
- Purple (#6B46C1) is the hero color - use it strategically for primary actions
- The 8px grid system creates visual harmony
- Mobile-first responsive design ensures great experience on all devices
- Subtle animations and hover states create polish without distraction
