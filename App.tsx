import React, { useState, useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import { GameState, Question, CityStats } from './types';
import { generateQuestionData } from './services/geminiService';
import { Button } from './components/Button';
import { LoadingView } from './components/LoadingView';

// --- Sub-component for Leaflet Map ---
const WorldMap: React.FC<{ stats: Record<string, CityStats> }> = ({ stats }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      scrollWheelZoom: true,
      worldCopyJump: true, // Enables wraparound
      zoomControl: false,
    });

    // Dark Matter Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    Object.values(stats).forEach(stat => {
      const color = stat.correct > 0 ? '#10b981' : '#f43f5e';
      
      const tooltipContent = `
        <div class="p-4 text-center min-w-[160px]">
           <h3 class="font-bold text-lg text-white mb-1 leading-none">${stat.city}</h3>
           <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3 border-b border-slate-600 pb-2">${stat.country}</p>
           <div class="flex justify-center gap-4">
              <div class="flex flex-col items-center bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20">
                 <span class="text-[9px] uppercase font-bold text-emerald-400">Visited</span>
                 <span class="text-xl font-bold text-white">${stat.correct}</span>
              </div>
              <div class="flex flex-col items-center bg-rose-900/30 p-2 rounded-lg border border-rose-500/20">
                 <span class="text-[9px] uppercase font-bold text-rose-400">Missed</span>
                 <span class="text-xl font-bold text-white">${stat.wrong}</span>
              </div>
           </div>
        </div>
      `;

      L.circleMarker([stat.lat, stat.lng], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      })
      .bindTooltip(tooltipContent, {
        direction: 'top',
        className: 'custom-tooltip', // Defined in index.html
        opacity: 1,
        offset: [0, -10]
      })
      .addTo(markersLayer.current!);
    });
  }, [stats]);

  return <div ref={mapContainer} className="w-full h-full bg-slate-900" />;
};


export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [useRealImage, setUseRealImage] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<string[]>([]); 
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, CityStats>>({});
  const [imageError, setImageError] = useState<boolean>(false);

  // Load stats from local storage on mount
  useEffect(() => {
    const savedStats = localStorage.getItem('skyline_stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    }
  }, []);

  // Save stats whenever they change
  useEffect(() => {
    localStorage.setItem('skyline_stats', JSON.stringify(stats));
  }, [stats]);

  const startGame = () => {
    setScore(0);
    setStreak(0);
    setHistory([]);
    loadNewQuestion([]);
  };

  const loadNewQuestion = async (currentHistory: string[]) => {
    setGameState(GameState.LOADING);
    setErrorMsg(null);
    setImageError(false);
    try {
      const question = await generateQuestionData(currentHistory, useRealImage);
      setCurrentQuestion(question);
      setGameState(GameState.PLAYING);
      setHistory(prev => [...prev, question.cityName]);
    } catch (e) {
      console.error(e);
      setErrorMsg("Signal lost. We couldn't find a clear view of this city.");
      setGameState(GameState.ERROR);
    }
  };

  const handleGuess = useCallback((guess: string) => {
    if (!currentQuestion) return;

    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedAnswer = currentQuestion.cityName.trim().toLowerCase();
    
    // Check if guess is correct
    const correct = normalizedGuess === normalizedAnswer;

    setIsCorrect(correct);
    if (correct) {
      setScore(s => s + 100 + (streak * 10)); // Bonus for streak
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }

    // Update Stats
    setStats(prev => {
      const key = currentQuestion.cityName;
      const existing = prev[key] || {
        city: currentQuestion.cityName,
        country: currentQuestion.country,
        lat: currentQuestion.lat,
        lng: currentQuestion.lng,
        correct: 0,
        wrong: 0
      };
      
      return {
        ...prev,
        [key]: {
          ...existing,
          correct: existing.correct + (correct ? 1 : 0),
          wrong: existing.wrong + (!correct ? 1 : 0),
          lat: currentQuestion.lat,
          lng: currentQuestion.lng
        }
      };
    });

    setGameState(GameState.RESULT);
  }, [currentQuestion, streak]);

  const handleNextRound = () => {
    loadNewQuestion(history);
  };

  const handleReturnToMenu = () => {
    setGameState(GameState.MENU);
  };

  // --- RENDER HELPERS ---

  const renderMenu = () => (
    <div className="max-w-md w-full mx-auto text-center space-y-8 animate-fade-in relative z-10">
      <div className="space-y-2">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-lg">
          Skyline
        </h1>
        <p className="text-xl text-slate-300 font-light tracking-wide">World Traveler Trivia</p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 p-8 rounded-3xl shadow-2xl space-y-6">
        
        {/* Toggle Image Source */}
        <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
           <span className="text-slate-400 text-sm font-semibold ml-2">Image Source</span>
           <div className="flex bg-slate-800 rounded-lg p-1">
              <button 
                onClick={() => setUseRealImage(false)}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${!useRealImage ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                AI Generated
              </button>
              <button 
                onClick={() => setUseRealImage(true)}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${useRealImage ? 'bg-green-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Real Photos
              </button>
           </div>
        </div>

        <Button 
            fullWidth 
            onClick={startGame}
            className="h-16 text-xl group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Start Journey
            </span>
          </Button>

          <Button 
            fullWidth 
            variant="secondary"
            onClick={() => setGameState(GameState.MAP)}
            className="h-14 text-lg"
          >
            <span className="flex items-center justify-center gap-2">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             My Map
            </span>
          </Button>
      </div>
      
      <p className="text-xs text-slate-500">Powered by Google Gemini & Unsplash</p>
    </div>
  );

  const renderPlaying = () => {
    if (!currentQuestion) return null;

    return (
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative z-10">
        {/* Header Bar */}
        <div className="lg:col-span-3 flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl backdrop-blur-md border border-slate-700/50 shadow-xl">
           <Button variant="ghost" onClick={handleReturnToMenu} className="!px-3 !py-2 text-sm">
             <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             Menu
           </Button>
           
           <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Streak</span>
                 <div className="flex items-center gap-1">
                   <span className={`text-xl font-bold ${streak > 2 ? 'text-orange-500 animate-pulse' : 'text-white'}`}>{streak}</span>
                   <svg className={`w-4 h-4 ${streak > 0 ? 'text-orange-500' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.298-2.26a1 1 0 00-1.64-.991 12.016 12.016 0 00-2.228 3.502c-.934 2.196-.713 4.887.68 6.78A8.025 8.025 0 008.24 19a8.016 8.016 0 006.56-3.41c1.378-1.936 1.547-4.63.497-6.81a11.96 11.96 0 00-2.902-3.227z" clipRule="evenodd" /></svg>
                 </div>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Score</span>
                 <span className="text-xl font-bold text-blue-400">{score}</span>
              </div>
           </div>
        </div>

        {/* Image Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800 group">
             {imageError ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 bg-slate-900">
                  <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p>Image signal lost.</p>
                  <p className="text-xs">The file could not be retrieved from Unsplash.</p>
               </div>
             ) : (
                <img 
                  src={currentQuestion.imageUrl} 
                  alt="Mystery Skyline" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
             )}
             
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none opacity-60"></div>
             
             {/* Hint/Attribution Badge */}
             <div className="absolute top-4 right-4 flex gap-2">
                 {useRealImage && currentQuestion.imageCredit ? (
                     <a 
                       href={currentQuestion.imageCredit.url} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="bg-black/60 backdrop-blur-md text-white/80 text-[10px] px-3 py-1 rounded-full border border-white/10 hover:bg-black/80 transition-colors"
                     >
                       Photo by {currentQuestion.imageCredit.name} / Unsplash
                     </a>
                 ) : (
                    <span className="bg-blue-600/80 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full shadow-lg border border-blue-400/30">
                        {useRealImage ? "Unsplash" : "AI Generated"}
                    </span>
                 )}
             </div>
          </div>
        </div>

        {/* Interaction Area */}
        <div className="lg:col-span-1 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-6 flex flex-col justify-center shadow-xl">
           <h2 className="text-xl font-bold mb-6 text-center text-white">Where in the world is this?</h2>
           
           <div className="space-y-3">
             {currentQuestion.options.map((option, idx) => (
               <Button 
                 key={idx} 
                 fullWidth 
                 variant="secondary"
                 className="justify-start text-left h-auto py-4 group hover:border-blue-500/50 transition-all"
                 onClick={() => handleGuess(option)}
               >
                 <span className="bg-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors w-8 h-8 rounded-lg flex items-center justify-center text-sm mr-3 border border-slate-600 text-slate-400 font-bold shadow-inner">
                   {String.fromCharCode(65 + idx)}
                 </span>
                 <span className="text-lg">{option}</span>
               </Button>
             ))}
           </div>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!currentQuestion) return null;

    return (
      <div className="max-w-md w-full mx-auto bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up relative z-10">
        <div className={`h-40 flex items-center justify-center ${isCorrect ? 'bg-gradient-to-br from-green-500 to-emerald-700' : 'bg-gradient-to-br from-red-500 to-rose-700'}`}>
           <div className="text-center">
             {isCorrect ? (
                <div className="bg-white/20 p-4 rounded-full mb-2 mx-auto w-fit backdrop-blur-sm">
                   <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
             ) : (
                <div className="bg-white/20 p-4 rounded-full mb-2 mx-auto w-fit backdrop-blur-sm">
                   <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
             )}
             <h2 className="text-3xl font-bold text-white drop-shadow-md">{isCorrect ? 'Correct!' : 'Incorrect'}</h2>
           </div>
        </div>
        
        <div className="p-8 text-center space-y-6">
          <div>
            <p className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-1">Destination</p>
            <p className="text-2xl text-white font-bold">{currentQuestion.cityName}, {currentQuestion.country}</p>
          </div>

          <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50 text-left">
            <p className="text-xs text-blue-400 font-bold uppercase mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Did you know?
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{currentQuestion.funFact}</p>
          </div>

          <div className="flex gap-3 pt-2">
             <Button fullWidth variant="secondary" onClick={handleReturnToMenu}>Menu</Button>
             <Button fullWidth onClick={handleNextRound}>
               Next City 
               <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
             </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderError = () => (
    <div className="max-w-md w-full mx-auto text-center p-8 bg-slate-800 rounded-2xl border border-slate-700 relative z-10 shadow-2xl">
      <div className="text-red-500 mb-4 bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h3 className="text-xl font-bold mb-2 text-white">Transmission Lost</h3>
      <p className="text-slate-400 mb-6">{errorMsg || "Something went wrong."}</p>
      <Button onClick={() => startGame()}>Reconnect</Button>
      <div className="mt-4">
          <Button variant="ghost" onClick={handleReturnToMenu} className="text-sm">Back to Menu</Button>
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="max-w-6xl w-full mx-auto animate-fade-in space-y-6 relative z-10">
        <div className="flex justify-between items-center bg-slate-900/80 p-6 rounded-2xl backdrop-blur-md border border-slate-700/50 shadow-xl">
            <div>
                <h2 className="text-3xl font-bold text-white">Travel Passport</h2>
                <p className="text-slate-400 text-sm">Your collection of visited cities</p>
            </div>
            <Button variant="secondary" onClick={handleReturnToMenu}>Back to Menu</Button>
        </div>
        
        <div className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl h-[600px] w-full relative">
            <WorldMap stats={stats} />
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2613&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat bg-fixed">
      {/* Overlay to darken background */}
      <div className="min-h-screen w-full bg-slate-900/90 backdrop-blur-sm flex flex-col p-4 md:p-8 overflow-y-auto">
        
        {/* Main Content Area */}
        <div className="flex-grow flex items-center justify-center">
          {gameState === GameState.MENU && renderMenu()}
          {gameState === GameState.LOADING && <LoadingView useRealImage={useRealImage} />}
          {gameState === GameState.PLAYING && renderPlaying()}
          {gameState === GameState.RESULT && renderResult()}
          {gameState === GameState.ERROR && renderError()}
          {gameState === GameState.MAP && renderMap()}
        </div>

      </div>
    </div>
  );
};