// Feed only current, authorized dashboard tasks; never delivery history.
export function createAdminAlertSound() {
  let audio,
    timer,
    enabled = false,
    tasks = [];
  const acknowledged = new Set();
  function stop() {
    clearInterval(timer);
    timer = undefined;
  }
  function tone() {
    if (!audio || audio.state !== "running") return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, audio.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.6);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.65);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  function refresh() {
    if (
      !enabled ||
      document.visibilityState !== "visible" ||
      !tasks.some((task) => !acknowledged.has(task.key))
    ) {
      stop();
      return;
    }
    if (timer !== undefined) return;
    tone();
    timer = setInterval(tone, 10000);
  }
  const visibility = () => refresh();
  document.addEventListener("visibilitychange", visibility);
  return {
    // Must be called directly from the "Aktifkan suara" button.
    async enable() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error("Perangkat belum mendukung suara pengingat.");
      audio ??= new Audio();
      await audio.resume();
      if (audio.state !== "running")
        throw new Error("Suara belum aktif. Coba tekan tombol lagi.");
      enabled = true;
      refresh();
    },
    // key must include booking/proposal ID + current proof/deadline version.
    // Call after every fresh dashboard query; clear tasks on query error/logout.
    update(currentTasks) {
      tasks = currentTasks;
      const keys = new Set(tasks.map((task) => task.key));
      for (const key of acknowledged)
        if (!keys.has(key)) acknowledged.delete(key);
      refresh();
    },
    acknowledge(key) {
      acknowledged.add(key);
      refresh();
    },
    disable() {
      enabled = false;
      stop();
    },
    async dispose() {
      enabled = false;
      stop();
      tasks = [];
      document.removeEventListener("visibilitychange", visibility);
      await audio?.close();
    },
  };
}
