
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimerPreset, AlertType, AppSettings, TimerState } from './types';
import { playTTSService, playLocalAudio } from './services/audioService';

const DEFAULT_PRESETS: TimerPreset[] = [
  { id: '1', name: 'Ovo Cozido', durationSeconds: 420 },
  { id: '2', name: 'Foco Pomodoro', durationSeconds: 1500 },
  { id: '3', name: 'Pausa Curta', durationSeconds: 300 },
];

const App: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetTime, setNewPresetTime] = useState('');
  const [bubblePos, setBubblePos] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAlarmRing, setShowAlarmRing] = useState(false);
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const timerInterval = useRef<number | null>(null);

  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    label: '',
  });

  const [presets, setPresets] = useState<TimerPreset[]>(() => {
    const saved = localStorage.getItem('bubble_presets');
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('bubble_settings');
    return saved ? JSON.parse(saved) : {
      alertType: AlertType.TTS,
      ttsPhrase: "O tempo de {label} acabou!",
      localAudioUrl: null,
      localAudioName: null,
    };
  });

  useEffect(() => {
    localStorage.setItem('bubble_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('bubble_settings', JSON.stringify(settings));
  }, [settings]);

  // Função de alerta refatorada para aceitar o label atual e evitar closure antigo
  const triggerAlert = useCallback((currentLabel: string) => {
    setShowAlarmRing(true);
    const phrase = settings.ttsPhrase.replace('{label}', currentLabel || 'temporizador');
    
    if (settings.alertType === AlertType.TTS) {
      playTTSService(phrase);
    } else if (settings.alertType === AlertType.LOCAL_FILE && settings.localAudioUrl) {
      playLocalAudio(settings.localAudioUrl);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("Bubble Timer", {
        body: currentLabel ? `${currentLabel} finalizado!` : "Tempo esgotado!",
        icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png'
      });
    }
  }, [settings]);

  useEffect(() => {
    if (timer.isActive && timer.remainingSeconds > 0) {
      timerInterval.current = window.setInterval(() => {
        setTimer(prev => {
          if (prev.remainingSeconds <= 1) {
            if (timerInterval.current) clearInterval(timerInterval.current);
            triggerAlert(prev.label); // Passa o label atual
            return { ...prev, isActive: false, remainingSeconds: 0 };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, [timer.isActive, triggerAlert]);

  const startTimer = (seconds: number, label: string = "Timer") => {
    // Ao clicar em iniciar, o AudioContext será retomado pelo serviço
    setTimer({
      isActive: true,
      remainingSeconds: seconds,
      totalSeconds: seconds,
      label: label
    });
    setIsExpanded(false);
    setShowAlarmRing(false);
  };

  const stopTimer = () => setTimer(prev => ({ ...prev, isActive: false }));
  const resetTimer = () => {
    setTimer({ isActive: false, remainingSeconds: 0, totalSeconds: 0, label: '' });
    setShowAlarmRing(false);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragOffset.current = { x: clientX - bubblePos.x, y: clientY - bubblePos.y };
    setShowAlarmRing(false);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setBubblePos({
        x: Math.max(0, Math.min(window.innerWidth - 64, clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 64, clientY - dragOffset.current.y))
      });
    };
    const onMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isDragging]);

  const handleAddPreset = () => {
    if (newPresetName && newPresetTime) {
      const seconds = parseInt(newPresetTime) * 60;
      if (!isNaN(seconds)) {
        setPresets(prev => [...prev, { id: Date.now().toString(), name: newPresetName, durationSeconds: seconds }]);
        setNewPresetName(''); setNewPresetTime(''); setIsAddingPreset(false);
      }
    }
  };

  const testSound = () => {
    const phrase = settings.ttsPhrase.replace('{label}', 'teste');
    if (settings.alertType === AlertType.TTS) {
      playTTSService(phrase);
    } else if (settings.alertType === AlertType.LOCAL_FILE && settings.localAudioUrl) {
      playLocalAudio(settings.localAudioUrl);
    }
  };

  const progress = timer.totalSeconds > 0 ? (timer.remainingSeconds / timer.totalSeconds) * 100 : 0;

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-6 text-white">
      <div className="absolute top-10 text-center">
        <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Bubble Timer Pro</h1>
        <p className="max-w-md text-slate-400 mx-auto">Temporizador flutuante com IA.</p>
      </div>

      <div className="fixed z-50" style={{ left: bubblePos.x, top: bubblePos.y }}>
        {showAlarmRing && <div className="absolute inset-0 -m-4 rounded-full bg-red-500 animate-ping opacity-75 z-0" />}

        <div 
          onMouseDown={onMouseDown}
          onTouchStart={onMouseDown}
          onClick={() => !isDragging && setIsExpanded(!isExpanded)}
          className={`relative w-16 h-16 rounded-full cursor-pointer bubble-shadow flex items-center justify-center border-4 border-slate-700 bg-slate-800 transition-all z-10 ${
            timer.isActive ? 'border-indigo-500' : showAlarmRing ? 'border-red-500 animate-bounce' : 'hover:scale-105'
          }`}
        >
          <div className="absolute bottom-0 left-0 w-full bg-indigo-500 opacity-40 transition-all duration-1000" style={{ height: `${progress}%` }} />
          <div className="z-10 text-white font-bold text-sm">
            {timer.isActive ? formatTime(timer.remainingSeconds) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-indigo-400">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="absolute top-20 left-0 w-80 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in duration-200">
            <div className="p-5">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                   <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                   Controle
                </h2>
                <button onClick={() => setIsExpanded(false)} className="text-slate-500 hover:text-white">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {timer.isActive ? (
                <div className="mb-6 bg-slate-700/50 p-4 rounded-xl border border-indigo-500/30 text-center">
                  <div className="text-indigo-400 text-xs font-bold uppercase mb-1">{timer.label}</div>
                  <div className="text-4xl font-mono font-bold mb-4">{formatTime(timer.remainingSeconds)}</div>
                  <div className="flex gap-2">
                    <button onClick={stopTimer} className="flex-1 bg-slate-600 py-2 rounded-lg font-bold">Pausar</button>
                    <button onClick={resetTimer} className="flex-1 bg-indigo-600 py-2 rounded-lg font-bold">Parar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 5, 10].map(m => (
                      <button key={m} onClick={() => startTimer(m * 60, `${m} min`)} className="bg-slate-700 py-2 rounded-lg font-bold hover:bg-slate-600 transition-colors">{m}m</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Minutos" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => {
                        const val = parseInt((document.querySelector('input[type="number"]') as HTMLInputElement).value);
                        if (val > 0) startTimer(val * 60, "Personalizado");
                    }} className="bg-indigo-600 px-5 py-2 rounded-lg font-bold text-sm">Ok</button>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Favoritos</h3>
                  <button onClick={() => setIsAddingPreset(!isAddingPreset)} className="text-indigo-400 text-xs font-bold">{isAddingPreset ? 'Fechar' : '+ Novo'}</button>
                </div>
                {isAddingPreset ? (
                  <div className="p-3 bg-slate-900 rounded-xl border border-indigo-500/20 space-y-3 mb-2">
                    <input type="text" placeholder="Nome" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} />
                    <input type="number" placeholder="Minutos" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" value={newPresetTime} onChange={e => setNewPresetTime(e.target.value)} />
                    <button onClick={handleAddPreset} className="w-full bg-indigo-600 py-1.5 rounded-lg text-xs font-bold">Salvar Preset</button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {presets.map(p => (
                      <div key={p.id} onClick={() => startTimer(p.durationSeconds, p.name)} className="group flex items-center justify-between p-2 rounded-lg bg-slate-700/30 hover:bg-indigo-900/40 border border-slate-700 cursor-pointer">
                        <div className="text-sm font-bold">{p.name} <span className="text-[10px] text-slate-500 ml-2">{formatTime(p.durationSeconds)}</span></div>
                        <button onClick={(e) => { e.stopPropagation(); setPresets(prev => prev.filter(x => x.id !== p.id)); }} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-700 pt-5">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Alertas</h3>
                    <button onClick={testSound} className="text-indigo-400 text-[10px] font-bold border border-indigo-400/30 px-2 py-0.5 rounded-full hover:bg-indigo-400/10">TESTAR SOM</button>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-700">
                    <button onClick={() => setSettings(s => ({ ...s, alertType: AlertType.TTS }))} className={`flex-1 py-1 text-[10px] font-black rounded-lg ${settings.alertType === AlertType.TTS ? 'bg-indigo-600' : 'text-slate-500'}`}>VOZ IA</button>
                    <button onClick={() => setSettings(s => ({ ...s, alertType: AlertType.LOCAL_FILE }))} className={`flex-1 py-1 text-[10px] font-black rounded-lg ${settings.alertType === AlertType.LOCAL_FILE ? 'bg-indigo-600' : 'text-slate-500'}`}>ARQUIVO</button>
                  </div>
                  <input type="text" value={settings.ttsPhrase} onChange={(e) => setSettings(s => ({ ...s, ttsPhrase: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
