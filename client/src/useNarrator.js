import { useCallback, useRef } from 'react';

const useNarrator = () => {
  const currentUtteranceRef = useRef(null);

  const stopSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
    }
  }, []);

  const speak = useCallback((text, onEnded) => {
    if (!window.speechSynthesis) return;

    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    utterance.pitch = 0.75;

    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh'));
    if (chineseVoice) utterance.voice = chineseVoice;

    if (onEnded) {
      utterance.onend = () => {
        onEnded();
        currentUtteranceRef.current = null;
      };
    }

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [stopSpeech]);

  const NARRATION_SEQUENCE = {
    'NIGHT_DUSK': { type: 'AUTO', text: '天黑请闭眼。' },
    'NIGHT_WEREWOLVES': { 
      type: 'ACTION', 
      role: '狼人', 
      opening: '狼人请睁眼。狼人请确认同伴。狼人请杀人。', 
      closing: '狼人请闭眼。' 
    },
    'NIGHT_WITCH': { 
      type: 'ACTION', 
      role: '女巫', 
      opening: '女巫请睁眼。今晚死的是这位玩家，你要用救药吗？你要用毒药吗？', 
      closing: '女巫请闭眼。' 
    },
    'NIGHT_SEER': { 
      type: 'ACTION', 
      role: '预言家', 
      opening: '预言家请睁眼。请问你今晚要查验谁的身份？', 
      closing: '预言家请闭眼。' 
    },
    'NIGHT_HUNTER': { 
        type: 'ACTION', 
        role: '猎人', 
        opening: '猎人请睁眼。请确认你目前的状态。', 
        closing: '猎人请闭眼。' 
    },
    'DAY_START': { 
      type: 'AUTO', 
      text: '天亮了，所有人请睁眼。' 
    }
  };

  return { stopSpeech, speak, NARRATION_SEQUENCE };
};

export default useNarrator;
