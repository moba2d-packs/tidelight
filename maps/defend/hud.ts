import { INK, css } from '../../world/palette';
import { WAVES_TO_WIN, type Outcome } from './waves';

/**
 * The defence banner: "Sóng 3/10" and the lantern's health bar, in one DOM
 * strip that is written to only when a visible number changes. Same placement
 * rules as `world/hud.ts` (below core's score strip, pointer-events none).
 */
export interface DefenceHudState {
  wave: number;
  nextWaveInS: number;
  lanternHp: number;
  lanternMax: number;
  raiders: number;
  outcome: Outcome;
  flash: string | null;
}

const ROOT = 'tidelight-defend-hud';
const END = 'tidelight-defend-end';
const STYLE_ID = 'tidelight-defend-style';
const STYLE = `
#${ROOT}{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 39px);transform:translateX(-50%);z-index:40;pointer-events:none;
  display:flex;align-items:center;gap:12px;padding:6px 14px;border-radius:999px;white-space:nowrap;user-select:none;
  font:700 13px "Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)};
  background:${css(INK.ABYSS, 0.82)};border:1.5px solid ${css(INK.CREAM, 0.22)}}
#${ROOT} .td-bar{position:relative;width:min(30vw,240px);height:12px;border-radius:6px;background:${css(INK.DEEP, 0.9)};overflow:hidden}
#${ROOT} .td-fill{position:absolute;inset:0 auto 0 0;background:${css(INK.LANTERN)};box-shadow:0 0 10px ${css(INK.LANTERN)}}
#${ROOT}.low .td-fill{background:${css(INK.CORAL)}}
#${ROOT} .td-flash{color:${css(INK.LANTERN)};letter-spacing:.06em;text-transform:uppercase}
@media (max-height:480px),(max-width:520px){#${ROOT}{font-size:11px;gap:8px;padding:4px 10px}#${ROOT} .td-bar{height:9px}}
#${END}{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;z-index:60;
  background:${css(INK.ABYSS, 0.78)};pointer-events:auto;color:${css(INK.CREAM)};font-family:"Avenir Next","Segoe UI",system-ui,sans-serif}
#${END}.show{display:flex}
#${END} h1{margin:0;font-size:clamp(34px,9vh,72px);letter-spacing:.12em;text-transform:uppercase}
#${END} button{font:inherit;font-weight:800;font-size:16px;min-width:132px;min-height:48px;border-radius:14px;margin:0 6px;
  border:2px solid ${css(INK.CREAM)};background:${css(INK.LANTERN)};color:${css(INK.ABYSS)};cursor:pointer}
#${END} button.ghost{background:transparent;color:${css(INK.CREAM)}}
`;

export class DefenceHud {
  private root: HTMLElement | null = null;
  private label!: HTMLElement;
  private fill!: HTMLElement;
  private hp!: HTMLElement;
  private flash!: HTMLElement;
  private end!: HTMLElement;
  private title!: HTMLElement;
  private dismissed = false;
  private last = '';

  constructor(onRematch: () => void) {
    if (typeof document === 'undefined') return;
    document.getElementById(ROOT)?.remove();
    document.getElementById(END)?.remove();
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    const el = (tag: string, cls: string, parent: HTMLElement, text = ''): HTMLElement => {
      const node = document.createElement(tag);
      node.className = cls;
      node.textContent = text;
      parent.appendChild(node);
      return node;
    };
    const root = document.createElement('div');
    root.id = ROOT;
    this.label = el('span', '', root);
    const bar = el('div', 'td-bar', root);
    this.fill = el('i', 'td-fill', bar);
    this.hp = el('span', '', root);
    this.flash = el('span', 'td-flash', root);
    this.end = el('div', '', document.body);
    this.end.id = END;
    this.title = el('h1', '', this.end);
    const buttons = el('div', '', this.end);
    // Gone before the restart: a card left up over the next match eats every click.
    el('button', '', buttons, 'Trận mới').addEventListener('click', () => {
      this.destroy();
      onRematch();
    });
    el('button', 'ghost', buttons, 'Xem tiếp').addEventListener('click', () => {
      this.dismissed = true;
      this.end.classList.remove('show');
    });
    (document.getElementById('game-scene') ?? document.body).appendChild(root);
    this.root = root;
  }

  render(s: DefenceHudState): void {
    if (!this.root) return;
    const pct = s.lanternMax > 0 ? Math.max(0, Math.min(1, s.lanternHp / s.lanternMax)) : 0;
    const key = [s.wave, s.nextWaveInS, Math.round(pct * 100), s.raiders, s.outcome, s.flash].join('|');
    if (key === this.last) return;
    this.last = key;
    const next = s.wave >= WAVES_TO_WIN ? 'Sóng cuối' : `sóng sau ${s.nextWaveInS}s`;
    this.label.textContent = `Sóng ${Math.max(1, s.wave)}/${WAVES_TO_WIN} · ${next} · ${s.raiders} quái`;
    this.fill.style.width = `${pct * 100}%`;
    this.hp.textContent = `Đèn ${Math.ceil(s.lanternHp)}/${s.lanternMax}`;
    this.root.classList.toggle('low', pct < 0.3);
    this.flash.textContent = s.flash ?? '';
    if (s.outcome !== 'play' && !this.dismissed) {
      const won = s.outcome === 'won';
      this.title.textContent = won ? 'Giữ Được Đèn!' : 'Đèn Đã Vỡ';
      this.title.style.color = css(won ? INK.LANTERN : INK.CORAL);
      this.end.dataset.result = won ? 'win' : 'lose';
      this.end.classList.add('show');
    }
  }

  destroy(): void {
    this.root?.remove();
    this.end?.remove();
    this.root = null;
  }
}
