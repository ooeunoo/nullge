/** Grab a first-frame JPEG from a video data URL in the browser so feeds can show a poster without server-side video tools. */
export function capturePoster(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = src;
    const done = (poster?: string) => {
      v.removeAttribute('src');
      v.load();
      resolve(poster);
    };
    const timer = setTimeout(() => done(), 8000);
    v.onerror = () => {
      clearTimeout(timer);
      done();
    };
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.2, (v.duration || 1) / 2);
      } catch {
        clearTimeout(timer);
        done();
      }
    };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, 720 / (v.videoWidth || 720));
        const c = document.createElement('canvas');
        c.width = Math.round((v.videoWidth || 720) * scale);
        c.height = Math.round((v.videoHeight || 1280) * scale);
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.85));
      } catch {
        done();
      }
    };
  });
}
