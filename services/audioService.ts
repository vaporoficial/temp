
import { GoogleGenAI, Modality } from "@google/genai";

// Implementação manual de decode base64 conforme orientações
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Decodificador de PCM 16-bit assinado (formato do Gemini TTS)
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Conversão de Int16 para Float32 (exigido pelo Web Audio API)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Singleton para o AudioContext
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return sharedAudioCtx;
};

export const playTTSService = async (phrase: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: phrase }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Nenhum dado de áudio recebido da API");

    const ctx = getAudioContext();
    
    // Essencial para navegadores: retomar o contexto após interação
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioBuffer = await decodeAudioData(
      decodeBase64(base64Audio),
      ctx,
      24000,
      1,
    );

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  } catch (error) {
    console.error("Erro no TTS do Gemini:", error);
    // Fallback para o sintetizador nativo do navegador
    const msg = new SpeechSynthesisUtterance(phrase);
    msg.lang = 'pt-BR';
    window.speechSynthesis.speak(msg);
  }
};

export const playLocalAudio = async (url: string) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    
    const audio = new Audio(url);
    await audio.play();
  } catch (e) {
    console.error("Falha ao tocar áudio local:", e);
  }
};
