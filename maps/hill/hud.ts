import { INK, css } from '../../world/palette';
import { WIN_SCORE, type HillScore, type Side } from './rules';

export interface HillHudState {
  score: HillScore;
  holder: Side | null;
  /** True when the ring has people of both courts, or nobody, in it. */
  contested: boolean;
  /** Seconds until the ring moves. */
  secondsLeft: number;
  announcing: boolean;
  secondsToLimit: number;
  winner: Side | null;
  playerSide: Side;
}

const ROOT_ID = 'tidelight-hill-hud';
const STYLE_ID = 'tidelight-hill-style';
const STYLE = `
#${ROOT_ID}{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 39px);transform:translateX(-50%);z-index:40;
  pointer-events:none;display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:999px;white-space:nowrap;
  font:700 14px "Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)};
  background:${css(INK.ABYSS, 0.82)};border:1.5px solid ${css(INK.CREAM, 0.22)}}
#${ROOT_ID} .b{color:${css(INK.TIDE)}} #${ROOT_ID} .r{color:${css(INK.EMBER)}}
#${ROOT_ID} .s{min-width:2.2em;text-align:center;font-size:18px}
#${ROOT_ID} .m{opacity:.85;font-weight:600}
#${ROOT_ID}.warn .m{color:${css(INK.LANTERN)}}
#${ROOT_ID}.end{background:${css(INK.LANTERN, 0.92)};color:${css(INK.SHADOW)}}
body.tidelight-on .kill-callouts{top:calc(var(--safe-top,0px) + 76px)}
`;

/** One DOM strip, written a few times a second only when its text changes. */
export class HillHud {
  private root: HTMLElement | null = null;
  private blue!: HTMLElement;
  private red!: HTMLElement;
  private info!: HTMLElement;
  private last = '';

  constructor() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    const root = document.createElement('div');
    root.id = ROOT_ID;
    const part = (cls: string): HTMLElement => {
      const node = document.createElement('span');
      node.className = cls;
      root.appendChild(node);
      return node;
    };
    this.blue = part('s b');
    this.info = part('m');
    this.red = part('s r');
    (document.getElementById('game-scene') ?? document.body).appendChild(root);
    document.body.classList.add('tidelight-on');
    this.root = root;
  }

  render(state: HillHudState): void {
    if (!this.root) return;
    const blue = Math.min(WIN_SCORE, Math.floor(state.score.blue));
    const red = Math.min(WIN_SCORE, Math.floor(state.score.red));
    const status = state.winner
      ? `${state.winner === state.playerSide ? 'Thắng' : 'Thua'}! ${state.winner === 'blue' ? 'Đội Lam' : 'Đội Lửa'} lên ngôi`
      : state.announcing
        ? `Vòng sắp dời · ${state.secondsLeft}s`
        : state.contested
          ? 'Tranh chấp'
          : state.holder === 'blue'
            ? 'Lam giữ đảo'
            : 'Lửa giữ đảo';
    const mins = Math.floor(state.secondsToLimit / 60);
    const secs = String(state.secondsToLimit % 60).padStart(2, '0');
    const text = `${blue}|${red}|${status}|${mins}:${secs}|${state.announcing}|${state.winner}`;
    if (text === this.last) return;
    this.last = text;
    this.blue.textContent = `${blue}`;
    this.red.textContent = `${red}`;
    this.info.textContent = state.winner ? status : `${status} · ${mins}:${secs}`;
    this.root.classList.toggle('warn', state.announcing && !state.winner);
    this.root.classList.toggle('end', state.winner !== null);
  }

  destroy(): void {
    this.root?.remove();
    if (this.root) document.body.classList.remove('tidelight-on');
    this.root = null;
  }
}
