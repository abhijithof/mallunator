# 🌴 Mallu Card

A Next.js application that verifies how "Mallu" (Malayali) you really are by analyzing your Swiggy addresses using Reclaim Protocol.

## Features

- ✅ **Reclaim Protocol Integration** - Securely verify Swiggy addresses
- ✅ **4-Tier Classification System** - Pure-Bred, Explorer, Weekend, or Non-Mallu
- ✅ **Beautiful Card Generation** - Generate and download your Mallu Card
- ✅ **Social Sharing** - Share your card on X (Twitter) with @proofofmallu
- ✅ **Responsive Design** - Works on all devices

## Getting Started

### Prerequisites

- Node.js 18+ 
- Reclaim Protocol App ID and Secret
- Swiggy provider configured in Reclaim Developer Portal

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [RECLAIM_SETUP.md](./RECLAIM_SETUP.md))

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Reclaim Protocol Setup

See [RECLAIM_SETUP.md](./RECLAIM_SETUP.md) for detailed instructions on configuring Reclaim Protocol integration.

## How It Works

1. User connects via Reclaim Protocol
2. Reclaim verifies Swiggy account and extracts address data
3. Addresses are analyzed for Kerala locations
4. User is classified into one of 4 tiers:
   - **Pure-Bred Malayali™** (100%) - Primary address in Kerala, all addresses in Kerala
   - **Mallu Explorer** (70%) - Primary address in Kerala, but has other addresses
   - **Weekend Mallu** (20%) - Has Kerala addresses but primary is elsewhere
   - **Non-Mallu Civilian** (0%) - No Kerala addresses detected
5. Beautiful Mallu Card is generated
6. User can download and share their card

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Reclaim Protocol** - Proof verification
- **html-to-image** - Card image generation

## Project Structure

```
mallu-card/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── verify-proof/    # API route for classification
│   │   ├── page.tsx              # Main page
│   │   └── layout.tsx
│   ├── components/
│   │   └── MalluCard.tsx         # Card component
│   └── lib/
│       ├── types.ts              # TypeScript types
│       └── reclaim.ts            # Reclaim utilities
└── public/
    └── memes/                    # Tier-specific memes
```

## Deploy on Vercel

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Made with 🥥 in Kerala
