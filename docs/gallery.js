"use strict";
(() => {
  const examples = window.DRAMAVQA_EXAMPLES;
  if (!Array.isArray(examples) || !examples.length) return;
  const $ = (id) => document.getElementById(id);
  const video = $("scene");
  const tabs = $("categories");
  const playPath = '<path d="m9 5 11 7-11 7Z"/>';
  const pausePath = '<path d="M7 5h4v14H7zm7 0h4v14h-4z"/>';
  let index = 0;
  let selected = null;
  let revealed = false;
  let ready = false;
  let atEnd = false;
  let pendingPosition = 0;
  let wantsPlayback = false;
  let generation = 0;
  const current = () => examples[index];
  const length = () => current().end_seconds - current().start_seconds;
  const clock = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
  const validSource = () => video.getAttribute("src") === current().video_fragment_url;

  function message(text = "") {
    $("video-message").textContent = text;
    $("video-message").hidden = !text;
  }
  function updateProgress() {
    const elapsed = atEnd ? length() : ready ? Math.min(length(), Math.max(0, video.currentTime - current().start_seconds)) : pendingPosition;
    $("elapsed").textContent = clock(elapsed);
    $("seek").value = elapsed;
    $("seek").style.setProperty("--played", `${(elapsed / length()) * 100}%`);
    $("seek").setAttribute("aria-valuetext", `${clock(elapsed)} of ${clock(length())}`);
  }
  function playbackUI() {
    const playing = !video.paused && !video.ended;
    $("play-icon").innerHTML = playing ? pausePath : playPath;
    $("play").setAttribute("aria-label", playing ? "Pause scene" : atEnd ? "Replay scene" : "Play scene");
    $("big-play").setAttribute("aria-label", atEnd ? "Replay scene" : "Play scene");
    $("big-play").hidden = playing;
  }
  function renderOptions() {
    const entry = current();
    $("options").replaceChildren();
    for (const [letter, answer] of Object.entries(entry.options)) {
      const button = document.createElement("button");
      button.className = "option";
      button.dataset.letter = letter;
      button.setAttribute("aria-pressed", String(selected === letter));
      const badge = document.createElement("span");
      badge.className = "option-letter";
      badge.textContent = letter;
      const text = document.createElement("span");
      text.textContent = answer;
      button.append(badge, text);
      if (revealed && letter === entry.answer) {
        button.classList.add("correct");
        const check = document.createElement("span");
        check.className = "option-check";
        check.textContent = "✓";
        check.setAttribute("aria-label", "Correct answer");
        button.append(check);
      } else if (revealed && letter === selected) button.classList.add("incorrect");
      button.addEventListener("click", () => {
        selected = letter;
        renderOptions();
        $("options").querySelector(`[data-letter="${letter}"]`).focus({ preventScroll: true });
      });
      $("options").append(button);
    }
    $("reveal").setAttribute("aria-expanded", String(revealed));
    $("reveal").innerHTML = revealed ? 'Hide answer <span aria-hidden="true">−</span>' : 'Show answer <span aria-hidden="true">↗</span>';
    $("answer-feedback").hidden = !revealed;
    const prefix = selected ? selected === entry.answer ? "Correct. " : "The annotated answer is " : "Answer: ";
    $("answer-feedback").textContent = `${prefix}${entry.answer}. ${entry.options[entry.answer]}`;
  }
  function showExample(nextIndex, updateHash = true) {
    generation += 1;
    wantsPlayback = false;
    video.pause();
    video.removeAttribute("src");
    video.load();
    index = (nextIndex + examples.length) % examples.length;
    selected = null;
    revealed = false;
    ready = false;
    atEnd = false;
    pendingPosition = 0;
    const entry = current();
    video.poster = `posters/${entry.id}.jpg`;
    video.setAttribute("aria-label", `${entry.drama_title}, episode ${Number(entry.episode)}, ${entry.category} question scene`);
    $("drama-name").textContent = entry.drama_title;
    $("episode-name").textContent = `Episode ${Number(entry.episode)}`;
    $("subcategory").textContent = entry.subcategory;
    $("question").textContent = entry.question;
    $("duration").textContent = clock(length());
    $("seek").max = length();
    $("clip-range").textContent = `${entry.start_time.split(".")[0]} – ${entry.end_time.split(".")[0]} · ${length().toFixed(1)} s`;
    $("source-video").href = entry.video_fragment_url;
    $("annotation").href = entry.annotation_url;
    $("annotation").title = `Record ${entry.source_record_key}, question ${entry.qa_index + 1}`;
    $("progress").innerHTML = `${String(index + 1).padStart(2, "0")} <span>/ ${String(examples.length).padStart(2, "0")}</span>`;
    $("announcement").textContent = `Example ${index + 1} of ${examples.length}: ${entry.category}`;
    $("example-panel").setAttribute("aria-labelledby", `category-${entry.id}`);
    $("example-panel").dataset.example = entry.id;
    document.documentElement.style.setProperty("--accent", entry.color);
    for (const [tabIndex, tab] of [...tabs.children].entries()) {
      tab.setAttribute("aria-selected", String(tabIndex === index));
      tab.tabIndex = tabIndex === index ? 0 : -1;
    }
    message();
    renderOptions();
    updateProgress();
    playbackUI();
    if (updateHash) history.replaceState(null, "", `#${entry.id}`);
  }
  function ensureSource() {
    if (validSource() && !video.error) return;
    ready = false;
    video.src = current().video_fragment_url;
    video.load();
  }
  async function togglePlay() {
    if (!video.paused && !video.ended) {
      wantsPlayback = false;
      video.pause();
      message();
      return;
    }
    const requestGeneration = generation;
    wantsPlayback = true;
    if (atEnd) {
      atEnd = false;
      pendingPosition = 0;
      if (ready) video.currentTime = current().start_seconds;
    }
    ensureSource();
    message("Loading scene…");
    try {
      await video.play();
      if (requestGeneration !== generation) return;
      message();
    } catch (error) {
      if (requestGeneration !== generation || error.name === "AbortError") return;
      wantsPlayback = false;
      message("Could not load this scene. Try again, or open the source video below.");
      playbackUI();
    }
  }
  function stopAtEnd() {
    atEnd = true;
    wantsPlayback = false;
    video.pause();
    updateProgress();
    playbackUI();
  }

  examples.forEach((entry, tabIndex) => {
    const tab = document.createElement("button");
    tab.className = "category-tab";
    tab.id = `category-${entry.id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "example-panel");
    tab.style.setProperty("--category-color", entry.color);
    const dot = document.createElement("span");
    dot.className = "category-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = entry.category;
    tab.append(dot, label);
    tab.addEventListener("click", () => showExample(tabIndex));
    tabs.append(tab);
  });
  $("previous").addEventListener("click", () => showExample(index - 1));
  $("next").addEventListener("click", () => showExample(index + 1));
  $("reveal").addEventListener("click", () => { revealed = !revealed; renderOptions(); });
  $("play").addEventListener("click", togglePlay);
  $("big-play").addEventListener("click", togglePlay);
  video.addEventListener("click", togglePlay);
  $("mute").addEventListener("click", () => { video.muted = !video.muted; });
  video.addEventListener("volumechange", () => {
    $("mute").setAttribute("aria-label", video.muted ? "Unmute audio" : "Mute audio");
    $("mute").setAttribute("aria-pressed", String(video.muted));
    $("mute").querySelector(".sound-wave").style.opacity = video.muted ? "0.2" : "1";
  });
  $("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($("player").requestFullscreen) await $("player").requestFullscreen();
      else if (video.webkitEnterFullscreen) { ensureSource(); video.webkitEnterFullscreen(); }
    } catch { message("Full screen is unavailable in this browser."); }
  });
  $("seek").addEventListener("input", () => {
    pendingPosition = Number($("seek").value);
    atEnd = pendingPosition >= length();
    if (atEnd) wantsPlayback = false;
    ensureSource();
    if (ready) video.currentTime = Math.min(current().end_seconds - 0.04, current().start_seconds + pendingPosition);
    if (atEnd) video.pause();
    updateProgress();
  });
  video.addEventListener("loadedmetadata", () => {
    if (!validSource()) return;
    ready = true;
    if (current().end_seconds > video.duration + 0.2) {
      message("The source video has changed. Please use the annotation link to check this scene.");
      video.pause();
      return;
    }
    video.currentTime = Math.min(current().end_seconds - 0.04, current().start_seconds + pendingPosition);
    updateProgress();
  });
  video.addEventListener("seeking", () => {
    if (!ready || !validSource()) return;
    if (video.currentTime < current().start_seconds - 0.05) video.currentTime = current().start_seconds;
    else if (video.currentTime > current().end_seconds) { video.currentTime = current().end_seconds - 0.04; stopAtEnd(); }
  });
  video.addEventListener("timeupdate", () => {
    if (!ready || !validSource()) return;
    if (video.currentTime >= current().end_seconds - 0.045) stopAtEnd();
    else updateProgress();
  });
  video.addEventListener("ended", stopAtEnd);
  video.addEventListener("play", playbackUI);
  video.addEventListener("pause", playbackUI);
  video.addEventListener("playing", () => { message(); playbackUI(); });
  video.addEventListener("waiting", () => { if (wantsPlayback) message("Loading scene…"); });
  video.addEventListener("error", () => {
    if (!validSource()) return;
    wantsPlayback = false;
    message("Could not load this scene. Try again, or open the source video below.");
    playbackUI();
  });
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const tabFocused = tabs.contains(document.activeElement);
      showExample(index + (event.key === "ArrowRight" ? 1 : -1));
      if (tabFocused) tabs.children[index].focus();
    } else if (tabs.contains(event.target) && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      showExample(event.key === "Home" ? 0 : examples.length - 1);
      tabs.children[index].focus();
    }
  });
  let touchStart = null;
  $("example-panel").addEventListener("touchstart", (event) => {
    if (event.target.closest("button,a,input,.player")) { touchStart = null; return; }
    touchStart = [event.touches[0].clientX, event.touches[0].clientY];
  }, { passive: true });
  $("example-panel").addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart[0];
    const dy = event.changedTouches[0].clientY - touchStart[1];
    touchStart = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) showExample(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
  window.addEventListener("hashchange", () => {
    const requested = examples.findIndex((entry) => `#${entry.id}` === location.hash);
    if (requested >= 0) showExample(requested, false);
  });
  const initial = examples.findIndex((entry) => `#${entry.id}` === location.hash);
  showExample(initial >= 0 ? initial : 0, false);
})();
