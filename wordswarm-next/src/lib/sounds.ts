'use client';

class GameSound {
  private audio: HTMLAudioElement | null = null;
  private src: string;

  constructor(src: string) {
    this.src = src;
  }

  private getAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio(this.src);
    }
    return this.audio;
  }

  play() {
    try {
      const a = this.getAudio();
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  }

  stop() {
    try {
      const a = this.getAudio();
      if (!a.paused) a.pause();
    } catch {}
  }
}

export const sounds = {
  wordSwarmVoice: new GameSound('/audio/Intro_Vo_WordSwarm_R2_Shortened_02.wav'),
  themeMusic: new GameSound('/audio/ThemeMusic.wav'),
  beesAppear: new GameSound('/audio/BeesAppear.wav'),
  chooseWord: new GameSound('/audio/ChooseWord.wav'),
  negativeBuzzer: new GameSound('/audio/NegativeBuzzer.wav'),
  gameOver: new GameSound('/audio/WinGame.wav'),
  uncoverHoneyComb: new GameSound('/audio/UncoverHoneyComb.wav'),
  honeyDrip: new GameSound('/audio/HoneyDrip.wav'),
};
