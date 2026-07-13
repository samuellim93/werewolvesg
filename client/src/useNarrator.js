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
        role: '獵人', 
        opening: '獵人請睜眼。請確認你目前的狀態。', 
        closing: '獵人請閉眼。' 
    },
    'NIGHT_WOLF_KING': { 
        type: 'ACTION', 
        role: '狼王', 
        opening: '狼王請睜眼。請確認你目前的狀態。', 
        closing: '狼王請閉眼。' 
    },
    'NIGHT_GUARD': { 
        type: 'ACTION', 
        role: '守衛', 
        opening: '守衛請睜眼。請問你今晚要守護誰？', 
        closing: '守衛請閉眼。' 
    },
    'NIGHT_MAGICIAN': { 
        type: 'ACTION', 
        role: '魔術師', 
        opening: '魔術師請睜眼。請問你今晚要交換哪兩位玩家的狀態？', 
        closing: '魔術師請閉眼。' 
    },
    'NIGHT_DREAMCATCHER': { 
        type: 'ACTION', 
        role: '攝夢人', 
        opening: '攝夢人請睜眼。請問你今晚要攝入誰的夢境？', 
        closing: '攝夢人請閉眼。' 
    },
    'NIGHT_PSYCHIC': { 
        type: 'ACTION', 
        role: '通靈師', 
        opening: '通靈師請睜眼。請問你今晚要查驗誰的具體身份？', 
        closing: '通靈師請閉眼。' 
    },
    'NIGHT_GARGOYLE': { 
        type: 'ACTION', 
        role: '石像鬼', 
        opening: '石像鬼請睜眼。請問你今晚要查驗誰的底牌？', 
        closing: '石像鬼請閉眼。' 
    },
    'NIGHT_NIGHTMARE': { 
        type: 'ACTION', 
        role: '夢魘', 
        opening: '夢魘請睜眼。請問你今晚要恐懼誰？', 
        closing: '夢魘請閉眼。' 
    },
    'NIGHT_MECHANICAL_WOLF': { 
        type: 'ACTION', 
        role: '機械狼', 
        opening: '機械狼請睜眼。請問你今晚要學習誰的技能？', 
        closing: '機械狼請閉眼。' 
    },
    'NIGHT_DEMON_HUNTER': { 
        type: 'ACTION', 
        role: '獵魔人', 
        opening: '獵魔人請睜眼。請問你今晚要狩獵誰？', 
        closing: '獵魔人請閉眼。' 
    },
    'NIGHT_GRAVEDIGGER': { 
        type: 'ACTION', 
        role: '守墓人', 
        opening: '守墓人請睜眼。請確認昨晚出局玩家的陣營。', 
        closing: '守墓人請閉眼。' 
    },
    'RESULTS': { 
      type: 'AUTO', 
      text: '天亮了，所有人请睁眼。' 
    },
    'SHERIFF': {
      type: 'AUTO',
      text: '想要上警的玩家，请举手。天亮请睁眼。'
    }
  };

  return { stopSpeech, speak, NARRATION_SEQUENCE };
};

export default useNarrator;
