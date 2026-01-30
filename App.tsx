
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TimerPreset, AlertType, AppSettings, TimerState } from './types';
import { playTTSService, playLocalAudio, unlockAudio } from './services/audioService';
import { COLORS, STORAGE_KEYS } from './constants';

const DEFAULT_PRESETS: TimerPreset[] = [
  { id: '1', name: 'Ovo Perfeito', durationSeconds: 420 },
  { id: '2', name: 'Foco Total', durationSeconds: 1500 },
  { id: '3', name: 'Café Brew', durationSeconds: 240 },
  { id: '4', name: 'Alongamento', durationSeconds: 600 },
];

const VOICES = [
  { id: 'Kore', name: 'Kore (Vibrante)', description: 'Energia e clareza' },
  { id: 'Fenrir', name: 'Fenrir (Forte)', description: 'Autoridade e impacto' },
  { id: 'Puck', name: 'Puck (Amigável)', description: 'Suave e acolhedor' },
  { id: 'Charon', name: 'Charon (Sério)', description: 'Profissional e direto' }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timer' | 'voice' | 'presets'>('timer');
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [aiVibe, setAiVibe] = useState('');
  const [isGeneratingVibe, setIsGeneratingVibe] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetTime, setNewPresetTime] = useState('');
  
  const [showAlarmRing, setShowAlarmRing] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  
  const timerInterval = useRef<number | null>(null);

  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    label: '',
  });

  const [presets, setPresets] = useState<TimerPreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRESETS);
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : {
      alertType: AlertType.TTS,
      ttsPhrase: "Ei! O tempo de {label} acabou.",
      voiceName: 'Kore',
      localAudioUrl: null,
      localAudioName: null,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [presets, settings]);

  const speak = useCallback((text: string) => {
    playTTSService(text, settings.voiceName);
  }, [settings.voiceName]);

  const generateAIPhrase = async () => {
    if (!aiVibe) return;
    setIsGeneratingVibe(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere uma frase curta e criativa em português para o fim de um timer. A "vibe" da frase deve ser: ${aiVibe}. Use a tag {label} onde o nome do timer deve aparecer. Seja original e mantenha o texto curto (máximo 15 palavras).`,
      });
      const text = response.text || "Tempo esgotado para {label}!";
      setSettings(prev => ({ ...prev, ttsPhrase: text }));
      speak(text.replace('{label}', 'teste personalizado'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingVibe(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSettings(prev => ({ ...prev, localAudioUrl: url, localAudioName: file.name, alertType: AlertType.LOCAL_FILE }));
    }
  };

  const handleAlert = useCallback((label: string) => {
    setShowAlarmRing(true);
    if (settings.alertType === AlertType.TTS) {
      speak(settings.ttsPhrase.replace('{label}', label || 'seu timer'));
    } else if (settings.alertType === AlertType.LOCAL_FILE && settings.localAudioUrl) {
      playLocalAudio(settings.localAudioUrl);
    }
    if (Notification.permission === 'granted') {
      new Notification("Vivid Alert!", { body: label || "Tempo esgotado!" });
    }
  }, [settings, speak]);

  useEffect(() => {
    if (timer.isActive && timer.remainingSeconds > 0) {
      timerInterval.current = window.setInterval(() => {
        setTimer(prev => {
          const nextSeconds = prev.remainingSeconds - 1;
          
          if (isGuidedMode && nextSeconds > 0 && nextSeconds % 60 === 0) {
            speak(`Faltam ${nextSeconds / 60} minutos`);
          }

          if (nextSeconds <= 0) {
            clearInterval(timerInterval.current!);
            handleAlert(prev.label);
            return { ...prev, isActive: false, remainingSeconds: 0 };
          }
          return { ...prev, remainingSeconds: nextSeconds };
        });
      }, 1000);
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, [timer.isActive, handleAlert, isGuidedMode, speak]);

  const onStart = (seconds: number, label: string, guided: boolean = false) => {
    unlockAudio().then(() => setAudioReady(true));
    setIsGuidedMode(guided);
    setTimer({ isActive: true, remainingSeconds: seconds, totalSeconds: seconds, label });
    setShowAlarmRing(false);
    setActiveTab('timer');
    if (guided) {
      speak(`Timer de ${Math.floor(seconds/60)} minutos iniciado com guia ativa.`);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const progressPercent = timer.totalSeconds > 0 ? (timer.remainingSeconds / timer.totalSeconds) : 1;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-6 bg-[#020617] text-white overflow-y-auto custom-scrollbar">
      
      {/* Header Branding */}
      <header className="w-full flex justify-between items-center mb-12 mt-4 max-w-lg">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white">VIVID <span className="text-cyan-400">AI</span></h1>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Precision & Audio</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${audioReady ? 'bg-lime-400 vivid-glow' : 'bg-orange-500'}`} />
      </header>

      {/* Main Timer Display Section */}
      <main className="w-full max-w-lg mb-12 flex flex-col items-center">
        <div className={`relative w-72 h-72 rounded-full flex items-center justify-center transition-all duration-700 ${timer.isActive ? 'scale-105' : 'scale-100'}`}>
          
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="144" cy="144" r="130"
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            <circle
              cx="144" cy="144" r="130"
              fill="transparent"
              stroke={timer.isActive ? (isGuidedMode ? "#ccff00" : "#00f2ff") : "rgba(255,255,255,0.1)"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="816"
              strokeDashoffset={816 - (816 * progressPercent)}
              className="transition-all duration-1000 ease-linear drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]"
            />
          </svg>

          {/* Central Time */}
          <div className="flex flex-col items-center z-10">
            <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 ${timer.isActive ? 'text-cyan-400' : 'text-white/20'}`}>
              {timer.isActive ? timer.label : 'Aguardando'}
            </span>
            <div className={`text-7xl font-black font-mono tracking-tighter ${showAlarmRing ? 'animate-bounce text-cyan-400' : 'text-white'}`}>
              {formatTime(timer.remainingSeconds)}
            </div>
            {isGuidedMode && timer.isActive && (
              <div className="flex items-center gap-1.5 mt-4 bg-lime-400/20 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-lime-400 uppercase tracking-widest">Guia Ativo</span>
              </div>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex gap-4 mt-12 w-full px-8">
          {timer.isActive ? (
            <>
              <button 
                onClick={() => setTimer(t => ({...t, isActive: !t.isActive}))}
                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all"
              >
                {timer.isActive ? 'Pausar' : 'Resumir'}
              </button>
              <button 
                onClick={() => setTimer({isActive:false, remainingSeconds:0, totalSeconds:0, label:''})}
                className="flex-1 py-4 bg-orange-600 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-orange-600/20 active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </>
          ) : (
             <div className="w-full flex flex-col items-center">
                <button 
                  onClick={() => onStart(300, 'Foco Rápido', true)}
                  className="w-full py-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-cyan-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" /></svg>
                  Quick Start 5m
                </button>
                <p className="mt-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">Inicia instantaneamente com voz IA</p>
             </div>
          )}
        </div>
      </main>

      {/* Feature Navigation Tabs */}
      <div className="w-full max-w-lg flex flex-col items-center glass-card rounded-[40px] p-8 mb-12">
        <nav className="flex w-full bg-white/5 p-1 rounded-2xl mb-8">
          {[
            { id: 'timer', label: 'Modos' },
            { id: 'voice', label: 'Voz IA' },
            { id: 'presets', label: 'Presets' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-white/30 hover:text-white/60'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content: Timer Modos */}
        {activeTab === 'timer' && (
          <div className="w-full grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
            {[
              { t: 60, l: 'Quick' },
              { t: 600, l: 'Meditar' },
              { t: 1500, l: 'Pomodoro' },
              { t: 3600, l: 'Trabalho' }
            ].map(m => (
              <button 
                key={m.l}
                onClick={() => onStart(m.t, m.l)}
                className="p-6 bg-white/5 border border-white/5 rounded-3xl flex flex-col items-center justify-center hover:bg-white/10 active:scale-95 transition-all group"
              >
                <span className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors">{m.t/60}m</span>
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">{m.l}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab Content: IA Voice Personalization */}
        {activeTab === 'voice' && (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <section>
              <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Selecione a Voz</h4>
              <div className="grid grid-cols-2 gap-3">
                {VOICES.map(v => (
                  <button 
                    key={v.id}
                    onClick={() => setSettings(s => ({...s, voiceName: v.id}))}
                    className={`p-4 rounded-2xl border text-left transition-all ${settings.voiceName === v.id ? 'bg-cyan-500/10 border-cyan-500' : 'bg-white/5 border-white/5'}`}
                  >
                    <span className="block text-xs font-black">{v.name}</span>
                    <span className="text-[9px] text-white/30">{v.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Vibe Personalizada (Gemini IA)</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ex: Sargento, Calmo, Futurista..."
                  value={aiVibe}
                  onChange={e => setAiVibe(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
                />
                <button 
                  onClick={generateAIPhrase}
                  disabled={isGeneratingVibe || !aiVibe}
                  className="w-12 h-12 bg-lime-500 rounded-xl flex items-center justify-center shadow-lg shadow-lime-500/20 active:scale-90 transition-all disabled:opacity-50"
                >
                  {isGeneratingVibe ? (
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-slate-900"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 1 0-1.449-.39Zm1.23-5.038a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39 5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5H16.01a.75.75 0 0 0 .75-.75V2.759a.75.75 0 0 0-1.5 0v2.43l-.31-.31Z" clipRule="evenodd" /></svg>
                  )}
                </button>
              </div>
              <div className="mt-4 p-5 bg-white/5 rounded-2xl border border-white/5 italic text-[11px] text-white/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-lime-400 opacity-50" />
                "{settings.ttsPhrase}"
              </div>
            </section>
          </div>
        )}

        {/* Tab Content: Custom Presets Management */}
        {activeTab === 'presets' && (
          <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {isAddingPreset ? (
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                <input type="text" placeholder="Nome do Alerta" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} />
                <input type="number" placeholder="Minutos" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none" value={newPresetTime} onChange={e => setNewPresetTime(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setIsAddingPreset(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase">Cancelar</button>
                  <button 
                    onClick={() => {
                      if(newPresetName && newPresetTime) {
                        setPresets([...presets, { id: Date.now().toString(), name: newPresetName, durationSeconds: parseInt(newPresetTime)*60 }]);
                        setIsAddingPreset(false); setNewPresetName(''); setNewPresetTime('');
                      }
                    }}
                    className="flex-1 py-3 bg-cyan-500 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-cyan-500/20"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Meus Atalhos</h4>
                  <button onClick={() => setIsAddingPreset(true)} className="text-[9px] font-black uppercase text-lime-400 bg-lime-400/10 px-3 py-1.5 rounded-full hover:bg-lime-400/20 transition-all">+ Novo</button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                  {presets.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 group">
                      <div onClick={() => onStart(p.durationSeconds, p.name)} className="flex-1 flex flex-col cursor-pointer">
                        <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">{p.name}</span>
                        <span className="text-[10px] font-mono text-white/30">{formatTime(p.durationSeconds)}</span>
                      </div>
                      <button onClick={() => setPresets(prev => prev.filter(x => x.id !== p.id))} className="p-2 text-white/10 hover:text-orange-500 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Persistent Audio Settings Footer */}
      <footer className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between p-6 bg-white/5 rounded-[32px] border border-white/5">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Alert Audio</span>
            <span className="text-[11px] font-bold text-white/70">{settings.alertType === AlertType.TTS ? 'Gemini AI Voice' : (settings.localAudioName || 'Local File')}</span>
          </div>
          <div className="flex gap-2">
            <label className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer">
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-400"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
            </label>
            <button 
              onClick={() => setSettings(s => ({...s, alertType: s.alertType === AlertType.TTS ? AlertType.LOCAL_FILE : AlertType.TTS}))}
              className={`p-3 rounded-xl transition-all ${settings.alertType === AlertType.TTS ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/30'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 1 0-1.449-.39Zm1.23-5.038a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39 5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5H16.01a.75.75 0 0 0 .75-.75V2.759a.75.75 0 0 0-1.5 0v2.43l-.31-.31Z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
