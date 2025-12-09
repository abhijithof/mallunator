'use client';

import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'react-qr-code';
import MalluCard from '@/components/MalluCard';
import type { VerificationResult, PublicData } from '@/lib/types';
import { validateReclaimData, extractPublicData } from '@/lib/reclaim';
import { ReclaimProofRequest, isMobileDevice } from '@reclaimprotocol/js-sdk';

export default function Home() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Check if device is mobile
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Check for Reclaim data in URL parameters or localStorage
  useEffect(() => {
    // Check URL parameters for Reclaim callback data
    const urlParams = new URLSearchParams(window.location.search);
    const reclaimData = urlParams.get('reclaimData');
    
    if (reclaimData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(reclaimData));
        if (validateReclaimData(parsed)) {
          const publicData = extractPublicData(parsed);
          // Clean up URL first
          window.history.replaceState({}, document.title, window.location.pathname);
          // Then verify
          handleVerify(publicData);
        }
      } catch (err) {
        console.error('Error parsing Reclaim data:', err);
      }
    }
    
    // Check localStorage for Reclaim data (optional - commented out to avoid auto-verification)
    // const storedData = localStorage.getItem('reclaimProof');
    // if (storedData && !result) {
    //   try {
    //     const parsed = JSON.parse(storedData);
    //     if (validateReclaimData(parsed)) {
    //       const publicData = extractPublicData(parsed);
    //       handleVerify(publicData);
    //     }
    //   } catch (err) {
    //     console.error('Error parsing stored Reclaim data:', err);
    //     localStorage.removeItem('reclaimProof');
    //   }
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (publicData?: PublicData) => {
    setLoading(true);
    setError('');
    
    try {
      if (!publicData) {
        setError('No data provided. Please connect via Reclaim Protocol to verify your addresses.');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicData })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Verification failed' }));
        throw new Error(errorData.error || 'Verification failed');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReclaimConnect = async () => {
    setLoading(true);
    setError('');
    
    try {
      const appId = process.env.NEXT_PUBLIC_RECLAIM_APP_ID || '0x75eB50ecbb8227fD024cd1e0B4ad0060AE844625';
      const appSecret = process.env.NEXT_PUBLIC_RECLAIM_APP_SECRET || '0x769cbe8cd32f3e57bb114061251d6ac72e9488e526f625a48d485ce6848fbe9e';
      // Provider ID for Swiggy
      const providerId = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_ID || '50fccb9e-d81c-4894-b4d1-111f6d33c7a0';
      
      if (!appId || !appSecret) {
        throw new Error('Reclaim Protocol credentials not configured. Please set NEXT_PUBLIC_RECLAIM_APP_ID and NEXT_PUBLIC_RECLAIM_APP_SECRET.');
      }
      
      // Initialize Reclaim Proof Request
      const proofRequest = await ReclaimProofRequest.init(appId, appSecret, providerId);
      
      // Get the request URL (QR code or deep link)
      const requestUrl = await proofRequest.getRequestUrl();
      const statusUrl = proofRequest.getStatusUrl();
      
      // Store status URL for polling
      if (statusUrl) {
        localStorage.setItem('reclaimStatusUrl', statusUrl);
      }
      
      // Start the verification session
      await proofRequest.startSession({
        onSuccess: async (proofs) => {
          try {
            // Close QR modal if open
            setShowQRCode(false);
            setQrCodeUrl('');
            
            // Handle different proof formats
            let proofData: any = null;
            
            if (typeof proofs === 'string') {
              // Custom callback URL - proof is returned to callback
              console.log('SDK Message:', proofs);
              // Try to parse if it's JSON
              try {
                proofData = JSON.parse(proofs);
              } catch {
                proofData = { message: proofs };
              }
            } else if (Array.isArray(proofs)) {
              // Multiple proofs (cascading providers)
              proofData = proofs[0]; // Use first proof
            } else {
              // Single proof object
              proofData = proofs;
            }
            
            // Extract publicData from proof
            if (proofData?.publicData) {
              if (validateReclaimData(proofData)) {
                const publicData = extractPublicData(proofData);
                await handleVerify(publicData);
              } else {
                // Try to extract from claimData context
                const context = proofData.claimData?.context;
                if (context) {
                  try {
                    const parsedContext = JSON.parse(context);
                    if (parsedContext.publicData) {
                      const publicData = parsedContext.publicData;
                      await handleVerify(publicData);
                      return;
                    }
                  } catch (e) {
                    console.error('Error parsing context:', e);
                  }
                }
                throw new Error('Proof received but publicData format is invalid.');
              }
            } else {
              // Try to get publicData from proof structure
              if (proofData && typeof proofData === 'object') {
                // Check if publicData is at root level
                if (validateReclaimData(proofData)) {
                  const publicData = extractPublicData(proofData);
                  await handleVerify(publicData);
                } else {
                  throw new Error('Proof received but could not extract address data.');
                }
              } else {
                throw new Error('Invalid proof format received.');
              }
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to process proof.';
            setError(errorMsg);
            console.error('Error processing proof:', err);
          } finally {
            setLoading(false);
          }
        },
        onError: (error) => {
          // Close QR modal on error
          setShowQRCode(false);
          setQrCodeUrl('');
          
          const errorMessage = error instanceof Error ? error.message : 'Verification failed. Please try again.';
          setError(errorMessage);
          console.error('Verification failed:', error);
          setLoading(false);
        }
      });
      
      // Handle request URL based on device type
      if (requestUrl) {
        console.log('Reclaim request URL:', requestUrl);
        if (isMobile) {
          // On mobile, open the URL directly
          window.location.href = requestUrl;
          // Keep loading true as we're redirecting
        } else {
          // On desktop/web, show QR code for scanning
          console.log('Setting QR code URL for desktop:', requestUrl);
          setQrCodeUrl(requestUrl);
          setShowQRCode(true);
          setLoading(false); // Don't show loading overlay, show QR code immediately
        }
      } else {
        throw new Error('Failed to get verification URL from Reclaim.');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Reclaim Protocol.';
      setError(errorMessage);
      console.error('Error connecting to Reclaim:', err);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // Wait for card image to be ready
      const waitForReady = async () => {
        const maxWait = 10000; // 10 seconds max
        const checkInterval = 100;
        let waited = 0;
        
        while (waited < maxWait) {
          if (cardRef.current?.getAttribute('data-ready') === 'true') {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }
        return false;
      };
      
      const isReady = await waitForReady();
      if (!isReady) {
        console.warn('Card image may not be fully loaded');
      }
      
      // Additional delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(cardRef.current, { 
        quality: 1,
        pixelRatio: 1, // Keep original size
        cacheBust: true,
        skipAutoScale: true,
        width: 1920,
        height: 1080,
      });
      
      const link = document.createElement('a');
      link.download = 'mallu-card.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading card:', err);
    }
  };

  const handleShare = async () => {
    if (!result || !cardRef.current) return;
    
    try {
      // Wait for card image to be ready
      const waitForReady = async () => {
        const maxWait = 10000;
        const checkInterval = 100;
        let waited = 0;
        
        while (waited < maxWait) {
          if (cardRef.current?.getAttribute('data-ready') === 'true') {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }
        return false;
      };
      
      await waitForReady();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate the image
      const dataUrl = await toPng(cardRef.current, { 
        quality: 1,
        pixelRatio: 1,
        cacheBust: true,
        skipAutoScale: true,
        width: 1920,
        height: 1080,
      });
      
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'mallu-card.png', { type: 'image/png' });
      
      // Get fun tweet text based on tier
      const getTweetText = (tier: string) => {
        switch (tier) {
          case 'PURE_BRED_MALLU':
            return "100% Pure-Bred Malayali™ certified! 🥥\n\nAll my addresses are in God's Own Country. Coconut oil runs through my veins. I eat beef fry for breakfast.\n\n@proofofmallu #MalluCard";
          case 'MALLU_EXPLORER':
            return "70% Mallu Explorer unlocked! ✈️🌴\n\nI've left Kerala but Kerala hasn't left me. Still coming home for every Onam and Vishu. \n\n@proofofmallu #MalluCard";
          case 'WEEKEND_MALLU':
            return "40% Weekend Mallu detected! 🏖️\n\nI visit Kerala for weddings, funerals, and emotional resets. My Malayalam is broken but my love for porotta is not.\n\n@proofofmallu #MalluCard";
          case 'NON_MALLU':
            return "0% Mallu - Non-Mallu Civilian! 😢\n\nNo Kerala addresses found. Please consume kappa and meen curry immediately and try again.\n\n@proofofmallu #MalluCard";
          default:
            return "Check out my Mallu Card! @proofofmallu #MalluCard";
        }
      };

      // Try to use Web Share API with file (if supported)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        const tweetText = getTweetText(result.tierCode);
        
        try {
          await navigator.share({
            title: 'My Mallu Card',
            text: tweetText,
            files: [file]
          });
          return;
        } catch (shareError) {
          // If share fails, fall through to download + Twitter method
          console.log('Web Share failed, using fallback method');
        }
      }
      
      // Fallback: Download image and open Twitter
      const link = document.createElement('a');
      link.download = 'mallu-card.png';
      link.href = dataUrl;
      link.click();
      
      // Small delay before opening Twitter
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const tweetText = getTweetText(result.tierCode);
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      window.open(twitterUrl, '_blank');
      
    } catch (err) {
      console.error('Error sharing card:', err);
      // Fallback to just opening Twitter if image generation fails
      const fallbackText = `Check out my Mallu Card! @proofofmallu #MalluCard`;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fallbackText)}`;
      window.open(twitterUrl, '_blank');
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${result ? 'bg-[#0A0A0A]' : 'bg-gradient-to-br from-[#FFFDF6] via-white to-green-50'}`}>
      {/* Decorative Background Elements - Only show when no result */}
      {!result && (
        <>
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full opacity-30 -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-amber-100 to-yellow-100 rounded-full opacity-30 -ml-48 -mb-48" />
        </>
      )}
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className={`text-5xl font-bold mb-3 ${result ? 'text-white' : 'text-gray-800'}`}>
            🌴 Mallu Card
          </h1>
          <p className={`text-lg ${result ? 'text-gray-400' : 'text-gray-600'}`}>
            Verify how Mallu you really are, using your Swiggy vibes.
          </p>
        </header>

        {/* Action Section */}
        {!result && (
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <p className="text-gray-600 mb-6 text-center">
                Connect via Reclaim Protocol to verify your Swiggy addresses and generate your Mallu Card. 
                We'll analyze your saved addresses to determine your true Mallu percentage!
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleReclaimConnect}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Connecting...' : '🔗 Connect via Reclaim Protocol'}
                </button>
                
                <p className="text-xs text-center text-gray-500 mt-2">
                  Powered by Reclaim Protocol • Your data stays private
                </p>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="flex flex-col items-center px-4">
            {/* Card Container - responsive scaling */}
            <div className="w-full max-w-[600px] mb-6 overflow-hidden rounded-2xl">
              <div 
                style={{ 
                  position: 'relative',
                  paddingBottom: '56.25%', // 16:9 aspect ratio
                  width: '100%',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1920px',
                    height: '1080px',
                    transform: 'scale(var(--card-scale))',
                    transformOrigin: 'top left',
                  }}
                  className="card-scale-container"
                >
                  <MalluCard ref={cardRef} result={result} />
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3 w-full max-w-[420px] px-4">
              <button
                onClick={handleDownload}
                className="w-full bg-white text-black font-bold py-4 px-6 rounded-2xl hover:bg-gray-100 transition-all duration-200"
              >
                Download Card
              </button>
              
              <button
                onClick={handleShare}
                className="w-full bg-black text-white font-bold py-4 px-6 rounded-2xl border-2 border-white/20 hover:bg-white/10 transition-all duration-200"
              >
                Share on X
              </button>
              
              <button
                onClick={() => setResult(null)}
                className="w-full text-gray-400 font-medium py-2 hover:text-white transition-all duration-200"
              >
                ← Start Over
              </button>
            </div>
          </div>
        )}

        {/* Placeholder when no result */}
        {!result && !loading && (
          <div className="max-w-md mx-auto">
            <div className="bg-white/50 backdrop-blur rounded-xl p-8 text-center">
              <p className="text-gray-500">
                Your Mallu Card will appear here after verification.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-16">
          <p className={`text-xs ${result ? 'text-gray-600' : 'text-gray-500'}`}>
            Powered by Reclaim Protocol • Made with 🥥 in Kerala
          </p>
        </footer>
        </div>

      {/* QR Code Modal for Web/Desktop */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowQRCode(false);
                setQrCodeUrl('');
                setLoading(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Scan to Verify</h3>
              <p className="text-gray-600 mb-6">
                Scan this QR code with your mobile device to complete verification
              </p>
              
              <div className="bg-white p-6 rounded-xl border-4 border-gray-200 inline-block mb-6 flex items-center justify-center">
                {qrCodeUrl ? (
                  <div className="flex items-center justify-center">
                    <QRCode
                      value={qrCodeUrl}
                      size={256}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                      <p className="text-sm text-gray-600 font-medium">Generating QR code...</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">📱 Instructions:</p>
                  <ol className="text-sm text-blue-700 text-left space-y-1 list-decimal list-inside">
                    <li>Scan this QR code</li>
                    <li>Complete the verification</li>
                    <li>Your Mallu Card will appear automatically</li>
                  </ol>
                </div>
                
                {loading && qrCodeUrl && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700 font-medium">
                      ⏳ Waiting for verification on your device...
                    </p>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setShowQRCode(false);
                    setQrCodeUrl('');
                    setLoading(false);
                  }}
                  className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
