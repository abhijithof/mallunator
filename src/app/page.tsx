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
      const providerId = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_ID || '50fccb9e-d81c-4894-b4d1-111f6d33c7a0';
      
      if (!appId || !appSecret) {
        throw new Error('Reclaim Protocol credentials not configured.');
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
              try {
                proofData = JSON.parse(proofs);
              } catch {
                proofData = { message: proofs };
              }
            } else if (Array.isArray(proofs)) {
              proofData = proofs[0];
            } else {
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
              if (proofData && typeof proofData === 'object') {
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
        } else {
          // On desktop/web, show QR code for scanning
          setQrCodeUrl(requestUrl);
          setShowQRCode(true);
          setLoading(false); 
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
        pixelRatio: 1,
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
      const fallbackText = `Check out my Mallu Card! @proofofmallu #MalluCard`;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fallbackText)}`;
      window.open(twitterUrl, '_blank');
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-700 ${result ? 'bg-[#0A0A0A]' : 'bg-[#FFFDF6]'}`}>
      
      {/* Decorative Background Elements */}
      {!result && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Subtle Kerala Pattern Overlay */}
          <div className="absolute inset-0 bg-kerala-pattern z-0" />
          
          {/* Animated Blobs */}
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-200/30 rounded-full blur-[100px] animate-float" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-[100px] animate-float-delayed" />
          
          {/* Floating Emojis */}
          <div className="absolute top-[15%] left-[10%] text-6xl animate-float opacity-80 select-none">🥥</div>
          <div className="absolute bottom-[20%] right-[15%] text-6xl animate-float-delayed opacity-80 select-none">🍌</div>
          <div className="absolute top-[40%] right-[5%] text-5xl animate-float opacity-60 select-none rotate-12">🛺</div>
          <div className="absolute bottom-[30%] left-[8%] text-5xl animate-float-delayed opacity-60 select-none -rotate-12">🐘</div>
        </div>
      )}
      
      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col items-center justify-center">
        
        {/* Hero Header - Only show big when no result */}
        {!result && (
          <header className="text-center mb-12 max-w-2xl mx-auto relative">
            <div className="inline-block bg-white/50 backdrop-blur-sm border border-white/60 rounded-full px-4 py-1.5 mb-6 shadow-sm">
              <span className="text-sm font-semibold text-green-800 tracking-wide uppercase">Official Certification</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
              Are you a <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-800">True Mallu?</span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed font-medium">
              We analyze your <span className="font-bold text-orange-500">Swiggy</span> history to scientifically prove your Malayali heritage. No paperwork required.
            </p>
          </header>
        )}

        {/* Action Section - Main Landing */}
        {!result && (
          <div className="w-full max-w-md mx-auto relative z-20">
            {/* Main Card */}
            <div className="glass-panel rounded-3xl p-8 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
              <div className="space-y-6">
                <button
                  onClick={handleReclaimConnect}
                  disabled={loading}
                  className="w-full group relative overflow-hidden bg-black text-white font-bold text-lg py-5 px-8 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-green-900/20 active:scale-[0.98]"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Analyzing Vibes...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">🔗</span>
                        <span>Connect Swiggy</span>
                      </>
                    )}
                  </div>
                </button>
                
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  Powered by Reclaim Protocol • 100% Privacy Preserved
                </div>
              </div>
            </div>
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
                <p className="text-red-600 text-sm text-center font-medium flex items-center justify-center gap-2">
                  <span>⚠️</span> {error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="flex flex-col items-center w-full max-w-6xl animate-in zoom-in-95 duration-500">
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Your Mallu Card is Ready!</h2>
              <p className="text-gray-400">Download or share it with the world</p>
            </div>

            {/* Card Container - responsive scaling */}
            <div className="w-full max-w-[600px] mb-8 overflow-hidden rounded-3xl shadow-2xl shadow-black/50 border border-white/10 ring-4 ring-white/5">
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
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-[500px] px-4">
              <button
                onClick={handleDownload}
                className="flex-1 bg-white text-black font-bold py-4 px-6 rounded-2xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <span>⬇️</span> Download
              </button>
              
              <button
                onClick={handleShare}
                className="flex-1 bg-[#1DA1F2] text-white font-bold py-4 px-6 rounded-2xl hover:bg-[#1a91da] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                <span>🐦</span> Share
              </button>
            </div>
            
            <button
              onClick={() => setResult(null)}
              className="mt-8 text-gray-500 font-medium py-2 px-6 rounded-full hover:text-white hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
            >
              <span>←</span> Check Another
            </button>
          </div>
        )}

        {/* Footer */}
        {!result && (
          <footer className="absolute bottom-6 w-full text-center">
            <p className="text-xs text-gray-400 font-medium tracking-wide opacity-70 hover:opacity-100 transition-opacity">
              MADE WITH 🥥 IN KERALA
            </p>
          </footer>
        )}
      </div>

      {/* QR Code Modal for Web/Desktop */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 relative transform transition-all animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowQRCode(false);
                setQrCodeUrl('');
                setLoading(false);
              }}
              className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                📱
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Scan to Verify</h3>
              <p className="text-gray-500 mb-8 font-medium">
                Open your camera & scan to continue
              </p>
              
              <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-inner inline-block mb-6">
                {qrCodeUrl ? (
                  <div className="flex items-center justify-center">
                    <QRCode
                      value={qrCodeUrl}
                      size={240}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  </div>
                ) : (
                  <div className="w-60 h-60 flex items-center justify-center bg-gray-50 rounded-xl">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Generating QR...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {loading && qrCodeUrl && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 animate-pulse">
                  <p className="text-sm text-green-700 font-bold flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Waiting for scan...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
