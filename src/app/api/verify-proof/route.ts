import { NextRequest, NextResponse } from 'next/server';
import type { Address, PublicData, VerificationResult, TierCode } from '@/lib/types';

// Kerala cities/locations to check
const KERALA_KEYWORDS = [
  'kerala', 'kochi', 'ernakulam', 'kozhikode', 'thrissur',
  'trivandrum', 'thiruvananthapuram', 'kottayam', 'idukki',
  'pathanamthitta', 'palakkad', 'malappuram', 'kollam', 'alappuzha'
];

function isKeralaAddress(address: Address): boolean {
  const addressLower = address.address?.toLowerCase() || '';
  const cityLower = address.city?.toLowerCase() || '';
  
  return KERALA_KEYWORDS.some(keyword => 
    addressLower.includes(keyword) || cityLower.includes(keyword)
  );
}

function classifyUser(publicData: PublicData): VerificationResult {
  const addresses = publicData.address || [];
  
  // Find primary address (addressCategory === 1)
  const primaryAddress = addresses.find(addr => addr.addressCategory === 1);
  const hasPrimaryKerala = primaryAddress ? isKeralaAddress(primaryAddress) : false;
  
  // Count Kerala addresses
  const keralaAddresses = addresses.filter(isKeralaAddress);
  const keralaAddressCount = keralaAddresses.length;
  const totalAddressCount = addresses.length;
  const allKerala = totalAddressCount > 0 && keralaAddressCount === totalAddressCount;
  
  // Determine tier
  let tierCode: TierCode;
  let tierLabel: string;
  let score: number;
  let isMallu: boolean;
  
  if (hasPrimaryKerala && allKerala) {
    // Pure-Bred Malayali™
    tierCode = 'PURE_BRED_MALLU';
    tierLabel = 'Pure-Bred Malayali™';
    score = 100;
    isMallu = true;
  } else if (hasPrimaryKerala && keralaAddressCount < totalAddressCount) {
    // Mallu Explorer
    tierCode = 'MALLU_EXPLORER';
    tierLabel = 'Mallu Explorer';
    score = 70;
    isMallu = true;
  } else if (!hasPrimaryKerala && keralaAddressCount > 0) {
    // Weekend Mallu
    tierCode = 'WEEKEND_MALLU';
    tierLabel = 'Weekend Mallu';
    score = 20;
    isMallu = true;
  } else {
    // Non-Mallu Civilian
    tierCode = 'NON_MALLU';
    tierLabel = 'Non-Mallu Civilian';
    score = 0;
    isMallu = false;
  }
  
  // Get display name
  let displayName = 'Unknown Mallu';
  if (hasPrimaryKerala && primaryAddress?.name) {
    displayName = primaryAddress.name;
  } else if (keralaAddresses.length > 0 && keralaAddresses[0].name) {
    displayName = keralaAddresses[0].name;
  } else if (addresses.length > 0 && addresses[0].name) {
    displayName = addresses[0].name;
  }
  
  return {
    isMallu,
    score,
    tierCode,
    tierLabel,
    displayName,
    keralaAddressCount,
    totalAddressCount
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const publicData: PublicData = body.publicData;
    
    // Validate that publicData exists and has the required structure
    if (!publicData || !publicData.address || !Array.isArray(publicData.address)) {
      return NextResponse.json(
        { error: 'Invalid request: publicData with address array is required' },
        { status: 400 }
      );
    }
    
    // Validate that we have at least one address
    if (publicData.address.length === 0) {
      return NextResponse.json(
        { error: 'No addresses found in the provided data' },
        { status: 400 }
      );
    }
    
    const result = classifyUser(publicData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in verify-proof:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process verification' },
      { status: 500 }
    );
  }
}

