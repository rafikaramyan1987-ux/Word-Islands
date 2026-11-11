import { normalizeWord, type Lang, LANGS } from '../core/alphabet';
import { cellKey, cellsOf, type Level, type LevelPack, type PlacedWord } from '../core/level';
import { ISLANDS } from '../data/islands';
import { LANG_NAMES, pickLang, setLang, t, getLang } from '../i18n';
import type { AdSlot, Platform } from '../platform/types';
import { audio } from '../audio/audio';
import type { World } from '../scene/world';
import { SPROUTS } from '../scene/island';
import { Board } from '../ui/board';
import { el, flyTo, iconSpan, sparkBurst, toast, wait } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { Tutorial } from '../ui/tutorial';
import { Wheel } from '../ui/wheel';
import { islandStart, levelPack } from './levels';
import { emptyProgress, SaveStore, type LevelProgress } from './save';
import { ACHIEVEMENT_COINS, ACHIEVEMENTS, checkAchievements, dayNumber, nextStreak, today } from './achievements';
import { later } from '../core/timescale';

const HINT_COST = 25;
const REVEAL_COST = 60;
const BONUS_COINS = 2;
const LEVEL_COINS = 5;
const AD_COINS = 25;
const DAILY_COINS = 25;
const INTERSTITIAL_GAP_MS = 120_000;

/** Y8 build only: an interstitial break is running (a second click meanwhile does nothing) */
let y8BreakOn = false;
/**
 * Y8 build only: an interstitial at a natural break after a click (`start`: the first Play, `next`: Next / Menu of a
 * level-complete screen). The SDK alone paces them (no cap of the game's own); resolves false if a break is already
 * running, true once the game may go on (at once if no ad is shown).
 */
async function y8Break(platform: Platform, slot: AdSlot): Promise<boolean> {
  if (y8BreakOn) return false;
  y8BreakOn = true;
  try {
    await platform.showInterstitial(slot);
  } finally {
    y8BreakOn = false;
  }
  return true;
}

type Layout = 'portrait' | 'landscape' | 'short';
type ScreenName = 'menu' | 'game' | 'view' | 'sail' | 'end';

export class App {
  private root = document.getElementById('app')!;
  private save: SaveStore;
  private pack!: LevelPack;
  private screen: ScreenName = 'menu';
  private layoutMode: Layout = 'portrait';
  // game screen
  private gameEl: HTMLDivElement | null = null;
  private level: Level | null = null;
  private board: Board | null = null;
  private wheel: Wheel | null = null;
  private tutorial: Tutorial | null = null;
  private coinPill: HTMLElement | null = null;
  private jarBtn: HTMLElement | null = null;
  private hintBtn: HTMLElement | null = null;
  private goalEl: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private busy = false;
  private lastInterstitial = performance.now();
  private viewIsland = -1;
  private mode: 'campaign' | 'daily' = 'campaign';

  constructor(private platform: Platform, private world: World) {
    this.save = new SaveStore(platform);
    const lang = this.save.data.lang ?? pickLang(platform.locale(), navigator.language);
    this.applyLang(lang);
    audio.musicOn = this.save.data.music;
    audio.soundOn = this.save.data.sound;
    world.onPop = () => audio.play('grow', Math.floor(Math.random() * 5));
    window.addEventListener('resize', () => this.relayout());
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      const hidden = document.hidden;
      audio.setPaused(hidden);
      world.setRunning(!hidden);
    });
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    platform.onPause((p) => { audio.setPaused(p); world.setRunning(!p); });
    platform.onMute?.((m) => audio.setMuted(m));
  }

  /** Current level index for the active language. */
  private get progress(): LevelProgress {
    return this.mode === 'daily' ? this.save.data.daily.progress : this.save.progress(getLang());
  }

  /** Campaign progress (independent of the daily puzzle). */
  private get campaign(): LevelProgress {
    return this.save.progress(getLang());
  }

  private dailyLevel(): Level | null {
    const list = this.pack.daily ?? [];
    if (!list.length) return null;
    return list[dayNumber(today()) % list.length];
  }

  private islandsDone(): number {
    let n = 0;
    this.pack.islands.forEach((size, i) => { if (islandStart(this.pack, i) + size <= this.campaign.level) n++; });
    return n;
  }

  /** Unlock achievements, reward coins and tell the player. */
  private checkAch() {
    const got = checkAchievements(this.save.data, this.islandsDone());
    if (!got.length) return;
    this.save.data.coins += ACHIEVEMENT_COINS * got.length;
    this.save.save();
    this.updateHud();
    got.forEach((a, i) => later(() => {
      toast(`🏆 ${t('achUnlocked')} ${t(a.name)} +${ACHIEVEMENT_COINS}`, 2600);
      audio.play('coin');
      this.platform.achievement?.(a.id);
    }, 900 + i * 2800));
  }

  private applyLang(lang: Lang) {
    setLang(lang);
    this.pack = levelPack(lang).pack;
  }

  start() {
    const fresh = !this.save.data.tutorialDone && this.progress.level === 0 && this.progress.found.length === 0;
    this.world.showIsland(this.campaignIsland());
    this.syncIslandVisual(false);
    if (fresh) this.startLevel();
    else this.showMenu();
  }

  /** Island of the current campaign level (the last island once everything is done). */
  private campaignIsland(): number {
    return Math.min(this.levelAt(this.campaign.level)?.island ?? ISLANDS.length - 1, ISLANDS.length - 1);
  }

  private showDaily() {
    const d = this.save.data.daily;
    const now = today();
    if (d.lastSolved === now) {
      const p = this.panel(t('daily'));
      const big = el('p', 'streak-big');
      big.textContent = `🔥 ${t('streak', { n: d.streak })}`;
      const msg = el('p');
      msg.textContent = t('dailyDone');
      const st = el('div', 'stack');
      st.appendChild(this.button(t('close'), 'btn green', ICONS.check, () => this.closeOverlay()));
      p.append(big, msg, st);
      this.openOverlay(p, () => this.closeOverlay());
      return;
    }
    if (d.date !== now) {
      d.date = now;
      d.progress = emptyProgress();
      this.save.save();
    }
    this.startLevel('daily');
  }

  private completeDaily() {
    const d = this.save.data.daily;
    const now = today();
    d.streak = nextStreak(d.lastSolved, d.streak, now);
    d.best = Math.max(d.best, d.streak);
    d.lastSolved = now;
    const reward = DAILY_COINS + Math.min(d.streak, 7) * 5;
    this.save.data.coins += reward;
    this.save.data.stats.dailies++;
    this.save.save();
    if (__PLATFORM__ === 'playgama') this.platform.levelCompleted?.(0);
    audio.play('complete');
    this.world.celebrate(2);
    this.updateHud();
    this.checkAch();
    this.gameEl?.querySelectorAll<HTMLElement>('.slot.s-grid, .slot.s-wheel, .goal').forEach((e) => (e.style.visibility = 'hidden'));
    const c = el('div', 'complete' + (this.layoutMode !== 'portrait' ? ' side-panel' : ''));
    const h = el('h2');
    h.textContent = t('dailySolved');
    const msg = el('p');
    msg.textContent = `🔥 ${t('streak', { n: d.streak })}`;
    const rw = el('div', 'reward');
    rw.append(iconSpan(ICONS.coin), document.createTextNode(`+${reward}`));
    const next = this.button(t('mainMenu'), 'btn big green', ICONS.home, () => {
      if (__PLATFORM__ === 'y8') {
        void y8Break(this.platform, 'next').then((go) => { if (go) { this.mode = 'campaign'; this.showMenu(); } });
        return;
      }
      this.mode = 'campaign';
      this.showMenu();
    });
    next.dataset.testid = 'next';
    c.append(h, msg, rw, next);
    this.root.appendChild(c);
  }

  private showAchievements() {
    const p = this.panel(t('achievements'));
    const list = el('div', 'islands');
    for (const a of ACHIEVEMENTS) {
      const got = this.save.data.achievements.includes(a.id);
      const row = el('div', 'isl' + (got ? '' : ' locked'));
      row.innerHTML = `<span class="pic ach">${got ? '🏆' : '🔒'}</span><span class="meta"><b></b><small></small></span>`;
      row.querySelector('b')!.textContent = t(a.name);
      row.querySelector('small')!.textContent = t(a.desc);
      list.appendChild(row);
    }
    p.appendChild(list);
    const st = el('div', 'stack');
    st.appendChild(this.button(t('back'), 'btn white', ICONS.back, () => this.closeOverlay()));
    p.appendChild(st);
    this.openOverlay(p, () => this.closeOverlay());
  }

  private watchAdButton(after?: () => void) {
    return this.button(t('watchAd'), 'btn yellow', ICONS.tv, async () => {
      this.closeOverlay();
      this.platform.gameplayStop();
      audio.setPaused(true);
      const ok = await this.platform.showRewarded();
      audio.setPaused(false);
      if (ok) {
        this.save.data.coins += AD_COINS;
        this.save.save();
        this.updateHud();
        audio.play('coin');
        toast(`+${AD_COINS}`);
      } else toast(t('noAd'), 2500);
      if (this.screen === 'game') this.platform.gameplayStart();
      after?.();
    });
  }

  private levelAt(i: number): Level | null {
    return this.pack.levels[i] ?? null;
  }

  // ------------------------------------------------------------------ layout
  private computeLayout(): Layout {
    const w = window.innerWidth, h = window.innerHeight;
    if (w / h < 0.95) return 'portrait';
    if (h < 560) return 'short';
    return 'landscape';
  }

  private relayout() {
    this.layoutMode = this.computeLayout();
    const W = window.innerWidth, H = window.innerHeight;
    if (this.screen === 'game' && this.gameEl) {
      this.gameEl.className = `screen game ${this.layoutMode}`;
      const sceneR = this.gameEl.querySelector('.slot.s-scene')!.getBoundingClientRect();
      this.world.setViewRect({ x: sceneR.left, y: sceneR.top, w: sceneR.width, h: sceneR.height });
      const gridSlot = this.gameEl.querySelector('.slot.s-grid') as HTMLElement;
      const gr = gridSlot.getBoundingClientRect();
      this.board?.layout(gr.width - 24, gr.height - 18);
      const wheelSlot = this.gameEl.querySelector('.slot.s-wheel') as HTMLElement;
      const wr = wheelSlot.getBoundingClientRect();
      const big = window.innerWidth >= 1200 && window.innerHeight >= 860;
      const side = this.layoutMode === 'short' ? 58 : big ? 96 : 74;
      const previewSpace = this.layoutMode === 'short' ? 46 : 62;
      const size = Math.max(140, Math.min(wr.width - side * 2 - 8, wr.height - previewSpace - 16, 420));
      if (this.wheel) {
        this.wheel.layout(size);
        const wrap = wheelSlot.querySelector('.wheel-wrap') as HTMLElement;
        wrap.style.paddingTop = `${previewSpace}px`;
        const top = (wr.height - previewSpace - size) / 2 + previewSpace;
        this.wheel.preview.style.top = `${Math.max(0, top - previewSpace + 4)}px`;
        const sides = wheelSlot.querySelectorAll<HTMLElement>('.side');
        const cx = wr.width / 2;
        sides[0].style.left = `${Math.max(6, cx - size / 2 - side - 4)}px`;
        const bw = big ? 74 : 54;
        sides[1].style.left = `${Math.min(wr.width - bw - 6, cx + size / 2 + side - bw)}px`;
        for (const s of sides) s.style.top = `${top + size / 2}px`;
        for (const s of sides) s.style.transform = 'translateY(-50%)';
      }
      this.tutorial?.relayout();
    } else if (this.screen === 'menu') {
      const wide = W / H >= 0.95;
      this.world.setViewRect(wide ? { x: W * 0.44, y: H * 0.12, w: W * 0.56, h: H * 0.82 } : { x: 0, y: H * 0.27, w: W, h: H * 0.4 });
      this.root.querySelector('.menu')?.classList.toggle('landscape-menu', wide);
    } else if (this.screen === 'view' || this.screen === 'sail' || this.screen === 'end') {
      this.world.setViewRect({ x: 0, y: H * 0.12, w: W, h: H * 0.78 });
    }
  }

  private clear() {
    this.tutorial?.destroy();
    this.tutorial = null;
    this.wheel?.destroy();
    this.wheel = null;
    this.board = null;
    this.gameEl = null;
    this.overlay = null;
    this.root.innerHTML = '';
  }

  // ------------------------------------------------------------------ menu
  showMenu() {
    this.platform.gameplayStop();
    this.world.setFocus(false);
    this.clear();
    this.screen = 'menu';
    const island = this.levelAt(this.progress.level)?.island ?? ISLANDS.length - 1;
    if (this.viewIsland >= 0 || this.world.island()?.index !== island) {
      this.viewIsland = -1;
      this.world.showIsland(Math.min(island, ISLANDS.length - 1));
      this.syncIslandVisual(false);
    }
    audio.playMusic(trackFor(Math.min(island, ISLANDS.length - 1)));
    const m = el('div', 'screen menu');
    m.innerHTML = `<div class="logo"><div class="sail">${ICONS.sail}</div><span class="w1">Word</span><span class="w2">Islands</span><div class="tag"></div></div>`;
    (m.querySelector('.tag') as HTMLElement).textContent = t('tagline');
    const buttons = el('div', 'buttons');
    const started = this.progress.level > 0 || this.progress.found.length > 0;
    const finished = !this.levelAt(this.progress.level);
    const play = this.button(started && !finished ? t('continue') : t('play'), 'btn big green', ICONS.play, () => {
      if (finished) this.showEnd();
      else if (__PLATFORM__ === 'y8') void y8Break(this.platform, 'start').then((go) => go && this.startLevel());
      else this.startLevel();
    });
    play.dataset.testid = 'play';
    buttons.append(
      play,
      this.button(t('islands'), 'btn', ICONS.map, () => this.showIslands()),
      this.dailyButton(),
      this.button(t('settings'), 'btn white', ICONS.gear, () => this.showSettings()),
    );
    m.appendChild(buttons);
    const trophy = el('button', 'round yellow corner');
    trophy.appendChild(iconSpan(ICONS.trophy));
    trophy.setAttribute('aria-label', t('achievements'));
    trophy.title = t('achievements');
    trophy.dataset.testid = 'achievements';
    trophy.addEventListener('click', () => { audio.play('click'); this.showAchievements(); });
    m.appendChild(trophy);
    this.root.appendChild(m);
    this.relayout();
  }

  private dailyButton() {
    const d = this.save.data.daily;
    const b = this.button(t('daily'), 'btn orange', ICONS.calendar, () => this.showDaily());
    b.dataset.testid = 'daily';
    if (d.streak > 0) {
      const badge = el('span', 'btn-badge');
      badge.textContent = `🔥${d.streak}`;
      b.appendChild(badge);
    }
    return b;
  }

  private button(label: string, cls: string, icon: string | null, onClick: () => void) {
    const b = el('button', cls);
    if (icon) b.appendChild(iconSpan(icon));
    const s = el('span');
    s.textContent = label;
    b.appendChild(s);
    b.addEventListener('click', () => {
      audio.unlock();
      audio.play('click');
      onClick();
    });
    return b;
  }

  // ------------------------------------------------------------------ overlays
  private openOverlay(content: HTMLElement, onClose?: () => void, clear = false) {
    this.closeOverlay();
    const o = el('div', 'overlay' + (clear ? ' clear' : ''));
    o.appendChild(content);
    o.addEventListener('pointerdown', (e) => {
      if (e.target === o && onClose) onClose();
    });
    this.root.appendChild(o);
    this.overlay = o;
    return o;
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  private panel(title: string) {
    const p = el('div', 'panel');
    const h = el('h2');
    h.textContent = title;
    p.appendChild(h);
    return p;
  }

  showSettings(onDone?: () => void) {
    const back = () => { this.closeOverlay(); onDone?.(); };
    const p = this.panel(t('settings'));
    const toggleRow = (label: string, icon: string, on: boolean, set: (v: boolean) => void) => {
      const r = el('div', 'row');
      const l = el('span', 'lbl');
      l.append(iconSpan(icon), document.createTextNode(label));
      const tg = el('button', 'toggle' + (on ? ' on' : ''));
      tg.setAttribute('role', 'switch');
      tg.setAttribute('aria-checked', String(on));
      tg.setAttribute('aria-label', label);
      tg.addEventListener('click', () => {
        const v = !tg.classList.contains('on');
        tg.classList.toggle('on', v);
        tg.setAttribute('aria-checked', String(v));
        set(v);
        audio.play('click');
      });
      r.append(l, tg);
      return r;
    };
    p.append(
      toggleRow(t('music'), ICONS.music, this.save.data.music, (v) => { this.save.data.music = v; audio.setMusic(v); this.save.save(); }),
      toggleRow(t('sound'), ICONS.sound, this.save.data.sound, (v) => { this.save.data.sound = v; audio.setSound(v); this.save.save(); }),
    );
    const lr = el('div', 'row');
    const ll = el('span', 'lbl');
    ll.append(iconSpan(ICONS.globe), document.createTextNode(t('language')));
    lr.appendChild(ll);
    p.appendChild(lr);
    const langs = el('div', 'langs');
    for (const l of LANGS) {
      const b = el('button', l === getLang() ? 'on' : '');
      b.textContent = LANG_NAMES[l];
      b.lang = l;
      b.addEventListener('click', () => {
        audio.play('click');
        this.save.data.lang = l;
        this.save.save();
        this.applyLang(l);
        if (levelPack(l).fallback) toast(t('langFallback'));
        // rebuild everything in the new language
        const wasGame = this.screen === 'game';
        this.closeOverlay();
        if (wasGame) this.startLevel();
        else this.showMenu();
        this.showSettings(onDone);
      });
      langs.appendChild(b);
    }
    p.appendChild(langs);
    const st = el('div', 'stack');
    st.append(
      this.button(t('resetProgress'), 'btn red', null, () => this.confirmReset(() => this.showSettings(onDone))),
      this.button(t('close'), 'btn green', ICONS.check, back),
    );
    p.appendChild(st);
    this.openOverlay(p, back);
  }

  private confirmReset(back: () => void) {
    const p = this.panel(t('resetProgress'));
    const msg = el('p');
    msg.textContent = t('resetConfirm');
    p.appendChild(msg);
    const st = el('div', 'stack');
    st.append(
      this.button(t('reset'), 'btn red', null, () => {
        this.save.reset();
        this.closeOverlay();
        this.world.showIsland(0);
        this.syncIslandVisual(false);
        this.showMenu();
      }),
      this.button(t('cancel'), 'btn white', null, back),
    );
    p.appendChild(st);
    this.openOverlay(p, back);
  }

  private showIslands() {
    const p = this.panel(t('islands'));
    const list = el('div', 'islands');
    const cur = this.levelAt(this.progress.level)?.island ?? this.pack.islands.length;
    this.pack.islands.forEach((count, i) => {
      const def = ISLANDS[i];
      const done = i < cur ? count : i === cur ? this.progress.level - islandStart(this.pack, i) : 0;
      const locked = i > cur;
      const b = el('button', 'isl' + (locked ? ' locked' : ''));
      b.innerHTML = `<span class="pic ${def.theme}">${THEME_ICON[def.theme]}</span><span class="meta"><b></b><small></small><span class="bar"><i style="width:${(done / count) * 100}%"></i></span></span><span class="state">${locked ? ICONS.lock : done >= count ? ICONS.check : ICONS.play}</span>`;
      (b.querySelector('b') as HTMLElement).textContent = t(def.name);
      (b.querySelector('small') as HTMLElement).textContent = locked ? t('locked') : t('progress', { done, total: count });
      b.disabled = locked;
      b.addEventListener('click', () => {
        audio.play('click');
        this.closeOverlay();
        if (i === cur) this.startLevel('campaign');
        else this.viewCompletedIsland(i);
      });
      list.appendChild(b);
    });
    p.appendChild(list);
    const st = el('div', 'stack');
    st.appendChild(this.button(t('back'), 'btn white', ICONS.back, () => this.closeOverlay()));
    p.appendChild(st);
    this.openOverlay(p, () => this.closeOverlay());
  }

  private viewCompletedIsland(i: number) {
    this.clear();
    this.screen = 'view';
    this.viewIsland = i;
    this.world.showIsland(i);
    const def = ISLANDS[i];
    this.world.setProgress(def.pieces.length, 999, 1, false);
    audio.playMusic(trackFor(i));
    const s = el('div', 'screen');
    const hud = el('div', 'hud');
    const back = el('button', 'round', '');
    back.appendChild(iconSpan(ICONS.back));
    back.setAttribute('aria-label', t('back'));
    back.addEventListener('click', () => { audio.play('click'); this.showMenu(); });
    const title = el('div', 'title');
    title.textContent = t(def.name);
    hud.append(back, title, el('span', '', '<span style="display:inline-block;width:54px"></span>'));
    s.appendChild(hud);
    this.root.appendChild(s);
    this.relayout();
  }

  // ------------------------------------------------------------------ island visuals
  /** Show the right decorations for the current island given progress. */
  private syncIslandVisual(animate: boolean) {
    const v = this.world.island();
    if (!v) return;
    const i = v.index;
    if (i >= this.pack.islands.length) return;
    const start = islandStart(this.pack, i);
    const count = this.pack.islands[i];
    const cp = this.campaign;
    const doneLevels = Math.max(0, Math.min(count, cp.level - start));
    let words = 0;
    for (let k = start; k < start + doneLevels; k++) words += this.pack.levels[k].words.length;
    let frac = 0;
    const cur = this.levelAt(cp.level);
    if (cur && cur.island === i) {
      words += cp.found.length;
      frac = cp.found.length / cur.words.length;
    }
    const def = ISLANDS[i];
    let totalWords = 0;
    for (let k = start; k < start + count; k++) totalWords += this.pack.levels[k]?.words.length ?? 0;
    words = Math.round((words / Math.max(1, totalWords)) * SPROUTS);
    const pieces = doneLevels >= count ? def.pieces.length : Math.floor((def.pieces.length * doneLevels) / count);
    const lush = Math.min(1, (doneLevels + frac * 0.6) / count) * 0.85 + (doneLevels >= count ? 0.15 : 0);
    this.world.setProgress(pieces, words, lush, animate);
  }

  // ------------------------------------------------------------------ game
  startLevel(mode: 'campaign' | 'daily' = 'campaign') {
    this.mode = mode;
    const level = mode === 'daily' ? this.dailyLevel() : this.levelAt(this.progress.level);
    if (!level) { if (mode === 'daily') this.showMenu(); else this.showEnd(); return; }
    this.clear();
    this.screen = 'game';
    this.level = level;
    this.busy = false;
    // drop stale entries (e.g. after a level-data update)
    const p = this.progress;
    p.found = p.found.filter((w) => level.words.some((x) => x.word === w));
    p.bonus = p.bonus.filter((w) => level.bonus.includes(w));
    const islandIdx = mode === 'daily' ? this.campaignIsland() : level.island;
    if (this.world.island()?.index !== islandIdx || this.viewIsland >= 0) {
      this.viewIsland = -1;
      this.world.showIsland(islandIdx);
    }
    this.world.setFocus(false);
    this.syncIslandVisual(false);
    audio.playMusic(trackFor(islandIdx));
    this.platform.gameplayStart();

    const g = el('div', `screen game ${this.computeLayout()}`);
    this.gameEl = g;
    // HUD
    const hud = el('div', 'hud');
    const pause = el('button', 'round');
    pause.appendChild(iconSpan(ICONS.pause));
    pause.setAttribute('aria-label', t('paused'));
    pause.dataset.testid = 'pause';
    pause.addEventListener('click', () => { audio.play('click'); this.pause(); });
    const title = el('div', 'title');
    title.innerHTML = '<span></span><small></small>';
    title.querySelector('span')!.textContent = mode === 'daily' ? t('daily') : t(ISLANDS[level.island].name);
    title.querySelector('small')!.textContent = mode === 'daily' ? t('streak', { n: this.save.data.daily.streak }) : t('level', { n: this.progress.level + 1 });
    const coins = el('div', 'pill');
    coins.append(iconSpan(ICONS.coin), el('b'));
    this.coinPill = coins;
    hud.append(pause, title, coins);
    // slots
    const sceneSlot = el('div', 'slot s-scene');
    const goal = el('div', 'goal');
    this.goalEl = goal;
    sceneSlot.appendChild(goal);
    const gridSlot = el('div', 'slot s-grid');
    this.board = new Board(level);
    gridSlot.appendChild(this.board.root);
    const wheelSlot = el('div', 'slot s-wheel');
    const wrap = el('div', 'wheel-wrap');
    this.wheel = new Wheel(level.letters, {
      onChange: () => {},
      onSubmit: (w) => this.submit(w),
    });
    wrap.appendChild(this.wheel.root);
    wheelSlot.append(wrap, this.wheel.preview);
    // side buttons
    const left = el('div', 'side');
    const right = el('div', 'side');
    const shuffle = this.roundBtn(ICONS.shuffle, 'blue', t('shuffle'), () => { this.wheel?.shuffle(); audio.play('shuffle'); this.tutorial?.relayout(); });
    shuffle.dataset.testid = 'shuffle';
    const jar = this.roundBtn(ICONS.jar, 'yellow', t('bonusJar'), () => this.showJar());
    this.jarBtn = jar;
    const hint = this.roundBtn(ICONS.bulb, 'yellow', t('hint'), () => this.useHint());
    hint.dataset.testid = 'hint';
    this.hintBtn = hint;
    const reveal = this.roundBtn(ICONS.reveal, 'green', t('reveal'), () => this.useReveal());
    reveal.dataset.testid = 'reveal';
    left.append(shuffle, jar);
    right.append(hint, reveal);
    wheelSlot.append(left, right);
    g.append(hud, sceneSlot, gridSlot, wheelSlot);
    this.root.appendChild(g);
    this.updateHud();
    // restore progress
    for (const w of level.words) if (this.progress.found.includes(w.word)) for (const [r, c] of cellsOf(w)) this.board.fill(r, c, false);
    for (const k of this.progress.revealed) {
      const [r, c] = k.split(',').map(Number);
      this.board.hint(r, c);
    }
    this.relayout();
    requestAnimationFrame(() => this.relayout());
    // tutorial on the very first level
    if (mode === 'campaign' && !this.save.data.tutorialDone && this.progress.level === 0) this.startTutorial();
  }

  private roundBtn(icon: string, color: string, label: string, onClick: () => void) {
    const b = el('button', `round ${color}`);
    b.appendChild(iconSpan(icon));
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', () => { audio.unlock(); audio.play('click'); onClick(); });
    return b;
  }

  private startTutorial() {
    if (!this.level || !this.wheel || !this.gameEl) return;
    const target = [...this.level.words].sort((a, b) => a.word.length - b.word.length)[0];
    const used: number[] = [];
    const idx = [...target.word].map((ch) => {
      const i = this.level!.letters.findIndex((l, k) => l === ch && !used.includes(k));
      used.push(i);
      return i;
    });
    const host = this.gameEl.querySelector('.slot.s-wheel') as HTMLElement;
    this.tutorial = new Tutorial(host, this.wheel, idx, t('tutorialDrag'), t('tutorialSkip'), () => this.finishTutorial());
  }

  private finishTutorial() {
    this.save.data.tutorialDone = true;
    this.save.save();
    this.tutorial?.destroy();
    this.tutorial = null;
  }

  private updateHud() {
    if (this.coinPill) this.coinPill.querySelector('b')!.textContent = String(this.save.data.coins);
    if (this.level && this.goalEl) {
      const total = this.level.words.length;
      const found = this.progress.found.length;
      const left = total - found;
      this.goalEl.innerHTML = '<span></span><span class="dots"></span>';
      this.goalEl.firstElementChild!.textContent = found === 0 ? t('goal', { n: total }) : left === 1 ? t('wordLeftOne') : left === 0 ? '✓' : t('wordsLeft', { n: left });
      const dots = this.goalEl.querySelector('.dots')!;
      for (let i = 0; i < total; i++) dots.appendChild(el('i', i < found ? 'on' : ''));
    }
    if (this.hintBtn) {
      this.hintBtn.querySelector('.badge')?.remove();
      const badge = el('span', 'badge' + (this.progress.freeHintUsed ? '' : ' free'));
      if (this.progress.freeHintUsed) badge.append(iconSpan(ICONS.coin), document.createTextNode(String(HINT_COST)));
      else badge.textContent = t('freeShort');
      this.hintBtn.appendChild(badge);
    }
    const reveal = this.gameEl?.querySelector('[data-testid="reveal"]');
    if (reveal && !reveal.querySelector('.badge')) {
      const badge = el('span', 'badge');
      badge.append(iconSpan(ICONS.coin), document.createTextNode(String(REVEAL_COST)));
      reveal.appendChild(badge);
    }
    if (this.jarBtn) {
      this.jarBtn.querySelector('.badge')?.remove();
      const badge = el('span', 'badge');
      badge.textContent = String(this.progress.bonus.length);
      this.jarBtn.appendChild(badge);
    }
  }

  private wordFound(w: PlacedWord) {
    return this.progress.found.includes(w.word);
  }

  private submit(word: string) {
    const level = this.level, wheel = this.wheel, board = this.board;
    if (!level || !wheel || !board || this.busy) return;
    if (word.length < 3) { wheel.clear(); return; }
    const target = level.words.find((w) => w.word === word);
    if (target) {
      if (this.wordFound(target)) {
        wheel.feedback('dup');
        board.flash(target);
        audio.play('already');
        toast(t('alreadyFound'));
        return;
      }
      wheel.feedback('ok');
      void this.solveWord(target, true);
      return;
    }
    if (level.bonus.includes(word)) {
      if (this.progress.bonus.includes(word)) {
        wheel.feedback('dup');
        audio.play('already');
        toast(t('alreadyFound'));
        return;
      }
      wheel.feedback('bonus');
      this.progress.bonus.push(word);
      this.save.data.coins += BONUS_COINS;
      this.save.data.stats.bonus++;
      this.checkAch();
      this.save.save();
      audio.play('bonus');
      toast(t('bonusWord', { n: BONUS_COINS }));
      this.flyToJar();
      return;
    }
    wheel.feedback('wrong');
    audio.play('wrong');
  }

  private flyToJar() {
    const jar = this.jarBtn?.getBoundingClientRect();
    const rects = this.wheel?.previewRects() ?? [];
    if (!jar) return;
    rects.forEach((r, i) => {
      const f = el('div', 'fly');
      f.textContent = this.wheel!.preview.querySelectorAll('span')[i]?.textContent ?? '';
      f.style.fontSize = `${r.height * 0.7}px`;
      document.body.appendChild(f);
      void flyTo(f, r, new DOMRect(jar.left + jar.width / 4, jar.top + jar.height / 4, jar.width / 2, jar.height / 2), 520, i * 50).then(() => {
        f.remove();
        if (i === rects.length - 1) {
          sparkBurst(jar.left + jar.width / 2, jar.top + jar.height / 2, 10, '#ffd24a');
          this.updateHud();
          this.coinPill?.classList.remove('bump');
          void this.coinPill?.offsetWidth;
          this.coinPill?.classList.add('bump');
        }
      });
    });
  }

  /** Mark a word as found; letters fly from the preview (or appear in place). */
  private async solveWord(w: PlacedWord, fly: boolean) {
    const board = this.board!;
    if (!this.progress.found.includes(w.word)) {
      this.progress.found.push(w.word);
      this.save.data.stats.words++;
      this.checkAch();
    }
    this.save.save();
    const cells = cellsOf(w);
    if (this.tutorial) {
      this.tutorial.hideHand();
      this.tutorial.setLine(t('tutorialFill'), false);
      later(() => this.finishTutorial(), 2600);
    }
    if (fly) {
      audio.play('correct');
      const from = this.wheel!.previewRects();
      await Promise.all(
        cells.map(([r, c], i) => {
          const cell = board.cell(r, c);
          const to = cell.getBoundingClientRect();
          const src = from[i] ?? to;
          const f = el('div', 'fly');
          f.textContent = w.word[i];
          f.style.fontSize = `${src.height * 0.62}px`;
          document.body.appendChild(f);
          return flyTo(f, src, to, 480, i * 70).then(() => {
            f.remove();
            board.fill(r, c, true);
            audio.play('land', i);
            sparkBurst(to.left + to.width / 2, to.top + to.height / 2, 6);
          });
        }),
      );
    } else {
      cells.forEach(([r, c], i) => later(() => { board.fill(r, c, true); audio.play('land', i); }, i * 80));
      await wait(cells.length * 80 + 100);
    }
    this.world.celebrate();
    this.autoSolveCrossings();
    this.syncIslandVisual(true);
    this.updateHud();
    if (this.level && this.progress.found.length >= this.level.words.length) void this.completeLevel();
  }

  /** Words whose every cell became visible through crossings/hints count as found. */
  private autoSolveCrossings() {
    const level = this.level!;
    const visible = new Set<string>(this.progress.revealed);
    for (const w of level.words) if (this.wordFound(w)) for (const [r, c] of cellsOf(w)) visible.add(cellKey(r, c));
    for (const w of level.words) {
      if (this.wordFound(w)) continue;
      if (cellsOf(w).every(([r, c]) => visible.has(cellKey(r, c)))) {
        this.progress.found.push(w.word);
        for (const [r, c] of cellsOf(w)) this.board!.fill(r, c, true);
      }
    }
  }

  private spend(cost: number): boolean {
    if (this.save.data.coins < cost) {
      toast(t('notEnoughCoins'));
      if (this.platform.hasRewarded()) this.offerAd();
      return false;
    }
    this.save.data.coins -= cost;
    return true;
  }

  private offerAd() {
    const p = this.panel(t('notEnoughCoins'));
    const st = el('div', 'stack');
    const w = this.watchAdButton();
    w.dataset.testid = 'watch-ad';
    st.append(w, this.button(t('close'), 'btn white', null, () => this.closeOverlay()));
    p.appendChild(st);
    this.openOverlay(p, () => this.closeOverlay());
  }

  private useHint() {
    const level = this.level, board = this.board;
    if (!level || !board || this.busy) return;
    const visible = new Set<string>(this.progress.revealed);
    for (const w of level.words) if (this.wordFound(w)) for (const [r, c] of cellsOf(w)) visible.add(cellKey(r, c));
    const target = level.words.filter((w) => !this.wordFound(w)).sort((a, b) => a.word.length - b.word.length)[0];
    if (!target) return;
    const cell = cellsOf(target).find(([r, c]) => !visible.has(cellKey(r, c)));
    if (!cell) return;
    const free = !this.progress.freeHintUsed;
    if (!free && !this.spend(HINT_COST)) return;
    if (free) this.progress.freeHintUsed = true;
    this.progress.helped = true;
    this.progress.revealed.push(cellKey(cell[0], cell[1]));
    board.hint(cell[0], cell[1]);
    const rr = board.cell(cell[0], cell[1]).getBoundingClientRect();
    sparkBurst(rr.left + rr.width / 2, rr.top + rr.height / 2, 10, '#9fe3ff');
    audio.play('hint');
    this.save.save();
    this.updateHud();
    const before = this.progress.found.length;
    this.autoSolveCrossings();
    if (this.progress.found.length !== before) {
      this.syncIslandVisual(true);
      this.updateHud();
      if (this.progress.found.length >= level.words.length) void this.completeLevel();
    }
  }

  private useReveal() {
    const level = this.level;
    if (!level || this.busy) return;
    const target = level.words.filter((w) => !this.wordFound(w)).sort((a, b) => b.word.length - a.word.length)[0];
    if (!target) return;
    if (!this.spend(REVEAL_COST)) return;
    this.progress.helped = true;
    this.save.save();
    this.updateHud();
    audio.play('hint');
    void this.solveWord(target, false);
  }

  private showJar() {
    const p = this.panel(t('bonusJar'));
    const msg = el('p');
    msg.textContent = this.progress.bonus.length ? t('bonusJarText') : t('bonusNone');
    p.appendChild(msg);
    if (this.progress.bonus.length) {
      const list = el('div', 'jar-list');
      for (const b of this.progress.bonus) {
        const s = el('span');
        s.textContent = b;
        list.appendChild(s);
      }
      p.appendChild(list);
    }
    const st = el('div', 'stack');
    st.appendChild(this.button(t('close'), 'btn green', ICONS.check, () => this.closeOverlay()));
    p.appendChild(st);
    this.openOverlay(p, () => this.closeOverlay());
  }

  private pause() {
    this.platform.gameplayStop();
    const resume = () => { this.closeOverlay(); this.platform.gameplayStart(); };
    const p = this.panel(t('paused'));
    const st = el('div', 'stack');
    const r = this.button(t('resume'), 'btn big green', ICONS.play, resume);
    r.dataset.testid = 'resume';
    st.append(r);
    if (this.platform.hasRewarded()) st.append(this.watchAdButton(() => this.pause()));
    st.append(
      this.button(t('settings'), 'btn white', ICONS.gear, () => this.showSettings(() => this.pause())),
      this.button(t('mainMenu'), 'btn', ICONS.home, () => this.showMenu()),
    );
    p.appendChild(st);
    this.openOverlay(p, resume);
  }

  private async completeLevel() {
    if (this.busy || !this.level) return;
    this.busy = true;
    const level = this.level;
    if (this.wheel) this.wheel.enabled = false;
    await wait(500);
    this.platform.gameplayStop();
    const p = this.progress;
    if (this.mode === 'daily') { this.completeDaily(); return; }
    const islandCount = this.pack.islands[level.island];
    const lastOfIsland = level.stage === islandCount - 1;
    const st = this.save.data.stats;
    st.levels++;
    if (!p.helped) st.noHelpLevels++;
    Object.assign(p, emptyProgress(p.level + 1));
    this.save.data.coins += LEVEL_COINS;
    this.save.save();
    this.platform.levelCompleted?.(p.level);
    this.checkAch();
    audio.play('complete');
    this.world.setFocus(true);
    this.syncIslandVisual(true);
    this.updateHud();
    // hide the playfield, keep the HUD
    this.gameEl?.querySelectorAll<HTMLElement>('.slot.s-grid, .slot.s-wheel, .goal').forEach((e) => (e.style.visibility = 'hidden'));
    this.tutorial?.destroy();
    this.tutorial = null;
    const titles = [t('complete0'), t('complete1'), t('complete2')];
    const c = el('div', 'complete' + (this.layoutMode !== 'portrait' ? ' side-panel' : ''));
    const h = el('h2');
    h.textContent = titles[(p.level - 1) % titles.length];
    const msg = el('p');
    msg.textContent = lastOfIsland ? t('islandRestored') : t('islandGrows');
    const reward = el('div', 'reward');
    reward.append(iconSpan(ICONS.coin), document.createTextNode(`+${LEVEL_COINS}`));
    const next = this.button(t('next'), 'btn big green', ICONS.play, () => void this.afterComplete(level, lastOfIsland));
    next.dataset.testid = 'next';
    c.append(h, msg, reward, next);
    this.root.appendChild(c);
    // full screen view of the island while celebrating
    const W = window.innerWidth, H = window.innerHeight;
    if (this.layoutMode === 'portrait') this.world.setViewRect({ x: 0, y: H * 0.1, w: W, h: H * 0.55 });
    else this.world.setViewRect({ x: 0, y: H * 0.08, w: W * 0.58, h: H * 0.9 });
  }

  private async afterComplete(level: Level, lastOfIsland: boolean) {
    this.world.setFocus(false);
    const nextLevel = this.levelAt(this.progress.level);
    // interstitials only between levels, at most every 2 minutes (no-op on the web build)
    if (__PLATFORM__ === 'playgama') {
      // Playgama: ask at every natural break between levels; Bridge alone decides (its own defaults, no game timer)
      await this.platform.showInterstitial();
    } else if (__PLATFORM__ === 'y8') {
      // Y8: `next` at every Next click; the SDK alone paces them, nothing shown = go on at once
      if (!(await y8Break(this.platform, 'next'))) return;
    } else if (performance.now() - this.lastInterstitial > INTERSTITIAL_GAP_MS && this.platform.id !== 'web') {
      this.lastInterstitial = performance.now();
      audio.setPaused(true);
      await this.platform.showInterstitial();
      audio.setPaused(false);
    }
    if (lastOfIsland && nextLevel && nextLevel.island !== level.island && nextLevel.island < ISLANDS.length) {
      await this.sail(nextLevel.island);
      this.startLevel();
    } else if (!nextLevel) {
      this.showEnd();
    } else this.startLevel();
  }

  private async sail(to: number) {
    this.clear();
    this.screen = 'sail';
    this.relayout();
    const s = el('div', 'sailing');
    s.innerHTML = '<b></b><small></small>';
    s.querySelector('b')!.textContent = t('sailingTo', { name: t(ISLANDS[to].name) });
    s.querySelector('small')!.textContent = t('tapToSkip');
    const skip = el('div', 'skiplayer');
    skip.addEventListener('pointerdown', () => this.world.skipSail());
    this.root.append(skip, s);
    audio.play('sail');
    audio.playMusic(trackFor(to));
    await this.world.sailTo(to);
    this.syncIslandVisual(false);
  }

  private showEnd() {
    this.clear();
    this.screen = 'end';
    this.platform.gameplayStop();
    this.relayout();
    const p = this.panel(t('allIslandsTitle'));
    const msg = el('p');
    msg.textContent = t('allIslandsText');
    p.appendChild(msg);
    const st = el('div', 'stack');
    st.append(
      this.button(t('playAgain'), 'btn green', ICONS.play, () => {
        this.save.data.progress[getLang()] = emptyProgress();
        this.save.save();
        this.world.showIsland(0);
        this.syncIslandVisual(false);
        this.startLevel();
      }),
      this.button(t('mainMenu'), 'btn', ICONS.home, () => this.showMenu()),
    );
    p.appendChild(st);
    this.openOverlay(p, undefined, true);
  }

  // ------------------------------------------------------------------ keyboard
  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') return; // never used for game actions
    if (this.screen === 'sail' && (e.key === 'Enter' || e.key === ' ')) { this.world.skipSail(); return; }
    if (this.screen !== 'game' || this.overlay || !this.wheel || this.busy) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); this.wheel.submit(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); this.wheel.backspace(); return; }
    if ([...e.key].length !== 1) return;
    const norm = normalizeWord(e.key, getLang());
    let any = false;
    for (const ch of norm) any = this.wheel.typeLetter(ch) || any;
    if (any) e.preventDefault();
  }
}

/** Night-time islands use the music-box lullaby, the others the bright day track. */
function trackFor(island: number): 'day' | 'night' {
  const time = ISLANDS[Math.max(0, Math.min(island, ISLANDS.length - 1))].time;
  return time === 'night' || time === 'dusk' ? 'night' : 'day';
}

const THEME_ICON: Record<string, string> = {
  tropical: '🌴', winter: '❄️', meadow: '🌾', desert: '🌵', autumn: '🍁', firefly: '✨', blossom: '🌸', volcano: '🌋',
};
