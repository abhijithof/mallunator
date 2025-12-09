# Reclaim Protocol Setup Guide

## Environment Variables

Create a `.env.local` file in the root of the project with the following:

```env
NEXT_PUBLIC_RECLAIM_APP_ID=0x75eB50ecbb8227fD024cd1e0B4ad0060AE844625
NEXT_PUBLIC_RECLAIM_APP_SECRET=0x769cbe8cd32f3e57bb114061251d6ac72e9488e526f625a48d485ce6848fbe9e
NEXT_PUBLIC_RECLAIM_PROVIDER_ID=50fccb9e-d81c-4894-b4d1-111f6d33c7a0
```

**Note:** The credentials are currently hardcoded as fallbacks in the code, but for production, you should use environment variables.

## Provider ID

The Swiggy Provider ID is: `50fccb9e-d81c-4894-b4d1-111f6d33c7a0`

This is already configured in the code, but you can override it with the `NEXT_PUBLIC_RECLAIM_PROVIDER_ID` environment variable if needed.

## How It Works

1. User clicks "Connect via Reclaim Protocol"
2. Reclaim SDK initializes with your app credentials
3. User is redirected to Reclaim verification flow
4. User completes verification in Reclaim app/extension
5. Proof is returned with Swiggy address data
6. Address data is analyzed to determine Mallu tier
7. Mallu Card is generated and displayed

## Testing

The app will work with the hardcoded credentials, but make sure:
- You have the Swiggy provider configured in your Reclaim app
- The Provider ID matches the one in Reclaim Developer Portal
- Your app is properly configured in Reclaim Developer Portal

