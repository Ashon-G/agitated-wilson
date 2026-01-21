# Tava - Reddit AI Lead Generation Agent

A mobile app that helps businesses find and engage with potential leads on Reddit using AI-powered automation.

## Features

- **AI Lead Generation** - Automatically finds relevant Reddit posts matching your business
- **Smart Comment Generation** - AI writes natural, contextual comments to engage leads
- **Lead Quality Control** - AI filters and scores leads before engagement
- **Manual Approval Workflow** - Review and approve comments before posting
- **HubSpot CRM Integration** - Sync leads directly to your CRM
- **Email Collection** - Capture lead emails through intelligent workflows
- **Push Notifications** - Get notified when new leads are found
- **3D Agent Avatar** - Personalized AI agent (Tava, Marcus, or Sophia)

## Design System

The app uses a **premium minimal** design language:

- **Color Palette**: Neutral dark base (#0C0C0E, #141416, #1A1A1D) with accent colors used sparingly
- **Glass Effects**: Subtle, elegant glassmorphism with reduced opacity
- **Typography**: Clean, well-spaced text with subtle letter-spacing
- **Shadows**: Soft, minimal shadows for subtle depth
- **Animations**: Smooth, understated micro-interactions

### Key Design Principles
1. Less is more - reduce visual clutter
2. Neutral backgrounds let content and 3D models pop
3. Use accent colors only for emphasis
4. Subtle glass effects over heavy blur
5. Clean typography with proper hierarchy

## Tech Stack

- **Framework**: Expo SDK 53 + React Native 0.76.7
- **Navigation**: React Navigation 7
- **Styling**: NativeWind (TailwindCSS for React Native)
- **State**: Zustand
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Payments**: RevenueCat
- **3D**: React Three Fiber / Expo Three

## Project Structure

```
src/
├── components/       # Reusable UI components
├── screens/          # App screens
├── services/         # Business logic services
├── stores/           # Zustand state stores
├── hooks/            # Custom React hooks
├── lib/              # Library configurations
├── navigation/       # Navigation configuration
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Getting Started

1. Install dependencies: `bun install`
2. Configure `.env` file with your API keys
3. Run the app: `bun start`

## Environment Variables

Copy `env.example` to `.env` and configure:
- Firebase credentials
- Reddit API keys
- HubSpot API key
- OpenAI API key
