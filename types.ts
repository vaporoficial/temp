
export interface TimerPreset {
  id: string;
  name: string;
  durationSeconds: number;
}

export enum AlertType {
  TTS = 'TTS',
  LOCAL_FILE = 'LOCAL_FILE'
}

export interface AppSettings {
  alertType: AlertType;
  ttsPhrase: string;
  localAudioUrl: string | null;
  localAudioName: string | null;
}

export interface TimerState {
  isActive: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  label: string;
}
