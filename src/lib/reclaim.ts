import type { PublicData } from './types';

/**
 * Reclaim Protocol Integration
 * 
 * This file contains utilities for integrating with Reclaim Protocol
 * to fetch Swiggy address data for Mallu Card verification.
 */

export interface ReclaimProof {
  publicData: PublicData;
  [key: string]: any;
}

/**
 * Validates that the data from Reclaim Protocol has the correct structure
 */
export function validateReclaimData(data: any): data is ReclaimProof {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  if (!data.publicData || typeof data.publicData !== 'object') {
    return false;
  }
  
  if (!Array.isArray(data.publicData.address)) {
    return false;
  }
  
  return true;
}

/**
 * Extracts PublicData from Reclaim proof
 */
export function extractPublicData(proof: ReclaimProof): PublicData {
  return proof.publicData;
}

/**
 * Example: How to integrate with Reclaim Protocol
 * 
 * 1. Install @reclaimprotocol/js-sdk
 * 2. Initialize Reclaim client
 * 3. Request proof for Swiggy addresses
 * 4. Pass the proof data to handleVerify()
 * 
 * Example code:
 * 
 * import { Reclaim } from '@reclaimprotocol/js-sdk';
 * 
 * const reclaim = new Reclaim({
 *   appId: 'YOUR_APP_ID',
 *   appSecret: 'YOUR_APP_SECRET'
 * });
 * 
 * const proof = await reclaim.requestProof({
 *   provider: 'swiggy',
 *   // Add other required parameters
 * });
 * 
 * if (validateReclaimData(proof)) {
 *   const publicData = extractPublicData(proof);
 *   handleVerify(publicData);
 * }
 */

