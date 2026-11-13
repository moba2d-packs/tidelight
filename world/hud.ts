import { BLUE, GATE_S, RAIL_HALF, RED, type Court } from './layout';
import { INK, css } from './palette';
import { LIGHTS_TO_WIN, formatClock, type Score, type TideState } from './rules';

/**
 * The objective strip: tide clock, lantern track, lights — and the end card.
 *
 * DOM rather than canvas, on purpose. It has to sit inside the notch on a
 * phone (`env(safe-area-inset-*)`), stay crisp at any device pixel ratio, and
 * cost nothing per frame: the director writes to it a few times a second and
 * the browser composites it for free. Core's own HUD is DOM for the same
 * reasons; this is the one piece of it that is about *this* pack's rules.
 *
 * Everything is `pointer-events: none` except the end card's buttons, so the
 * strip can never eat a tap meant for the joystick or the minimap.
 */
export interface HudState {
  tide: TideState;
  score: Score;
  /** Lantern position on the rail, -RAIL_HALF…+RAIL_HALF. */
  lanternS: number;
  /** Net push this moment: >0 blue is moving it, <0 red, 0 still. */
  push: number;
  blueGateShut: boolean;
  redGateShut: boolean;
  /** The court the local player fights for. */
  playerCourt: Court;
  matchMs: number;
  winner: Court | null;
  /** A one-line callout ("The tide turns"), or null. */
  flash: string | null;
}

const ROOT_ID = 'tidelight-hud';
const END_ID = 'tidelight-end';
const STYLE_ID = 'tidelight-hud-style';

const STYLE = `
#${ROOT_ID}{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);
  z-index:40;pointer-events:none;font-family:"Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)};
  display:flex;flex-direction:row-reverse;align-items:center;gap:8px;white-space:nowrap;user-select:none;-webkit-user-select:none}
#${ROOT_ID} .tl-strip{display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:999px;
  background:${css(INK.ABYSS, 0.82)};border:1.5px solid ${css(INK.CREAM, 0.22)};box-shadow:0 3px 0 ${css(INK.SHADOW, 0.6)}}
#${ROOT_ID} .tl-lights{display:flex;gap:5px}
#${ROOT_ID} .tl-light{width:13px;height:16px;border-radius:5px 5px 7px 7px;border:1.5px solid currentColor;opacity:.45}
#${ROOT_ID} .tl-light.on{background:currentColor;opacity:1;box-shadow:0 0 10px currentColor}
#${ROOT_ID} .tl-blue{color:${css(INK.TIDE)}} #${ROOT_ID} .tl-red{color:${css(INK.EMBER)}}
#${ROOT_ID} .tl-track{position:relative;width:min(34vw,300px);height:12px;border-radius:6px;
  background:linear-gradient(90deg,${css(INK.TIDE, 0.35)},${css(INK.DEEP, 0.9)} 50%,${css(INK.EMBER, 0.35)})}
#${ROOT_ID} .tl-gate{position:absolute;top:-4px;width:3px;height:20px;border-radius:2px;background:${css(INK.CREAM, 0.9)}}
#${ROOT_ID} .tl-gate.open{opacity:.2}
#${ROOT_ID} .tl-lantern{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:6px;
  background:${css(INK.LANTERN)};box-shadow:0 0 12px ${css(INK.LANTERN)},0 0 0 2px ${css(INK.ABYSS)};transition:left .25s linear}
#${ROOT_ID} .tl-lantern::after{content:"";position:absolute;top:4px;font-size:0;border:5px solid transparent}
#${ROOT_ID} .tl-lantern.to-red::after{left:20px;border-left-color:${css(INK.TIDE)}}
#${ROOT_ID} .tl-lantern.to-blue::after{left:-12px;border-right-color:${css(INK.EMBER)}}
#${ROOT_ID} .tl-tide{display:flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;background:${css(INK.ABYSS, 0.78)};border:1.5px solid currentColor}
#${ROOT_ID} .tl-tide.turning{animation:tl-pulse .5s ease-in-out infinite alternate}
#${ROOT_ID} .tl-tide .tl-clock{font-variant-numeric:tabular-nums;color:${css(INK.CREAM)}}
#${ROOT_ID} .tl-flash{font-size:15px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:2px 12px;
  position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:34px;
  text-shadow:0 2px 0 ${css(INK.SHADOW)};opacity:0;transition:opacity .3s}
#${ROOT_ID} .tl-flash.show{opacity:1}
#${END_ID}{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;
  background:${css(INK.ABYSS, 0.78)};pointer-events:auto;z-index:60;font-family:"Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)}}
#${END_ID}.show{display:flex}
#${END_ID} h1{margin:0;font-size:clamp(34px,9vh,72px);letter-spacing:.12em;text-transform:uppercase;
  text-shadow:0 4px 0 ${css(INK.SHADOW)}}
#${END_ID} p{margin:0;font-size:15px;opacity:.85}
#${END_ID} .tl-buttons{display:flex;gap:12px}
#${END_ID} button{font:inherit;font-weight:800;font-size:16px;min-width:132px;min-height:48px;border-radius:14px;
  border:2px solid ${css(INK.CREAM)};background:${css(INK.LANTERN)};color:${css(INK.ABYSS)};cursor:pointer;touch-action:manipulation}
#${END_ID} button.ghost{background:transparent;color:${css(INK.CREAM)}}
@keyframes tl-pulse{from{transform:scale(1)}to{transform:scale(1.08)}}
@media (max-height:480px){
  #${ROOT_ID}{gap:5px;top:calc(env(safe-area-inset-top,0px) + 3px)}
  #${ROOT_ID} .tl-strip{padding:4px 10px;gap:7px}
  #${ROOT_ID} .tl-track{width:min(24vw,200px);height:9px}
  #${ROOT_ID} .tl-wide{display:none}
  #${ROOT_ID} .tl-light{width:10px;height:12px}
  #${ROOT_ID} .tl-tide{font-size:10px;padding:2px 9px}
  #${ROOT_ID} .tl-flash{font-size:12px}
}
`;

const TIDE_NAME: Record<Court, string> = { [BLUE]: 'Triều Lam', [RED]: 'Triều Lửa' };

export class TideHud {
  private root: HTMLElement | null = null;
  private lights: Record<Court, HTMLElement[]> = { [BLUE]: [], [RED]: [] };
  private lantern!: HTMLElement;
  private gates!: Record<Court, HTMLElement>;
  private tide!: HTMLElement;
  private tideLabel!: HTMLElement;
  private clock!: HTMLElement;
  private flash!: HTMLElement;
  private end!: HTMLElement;
  private tideHint!: HTMLElement;
  private endTitle!: HTMLElement;
  private endLine!: HTMLElement;
  private dismissed = false;
  private last = '';

  constructor(private readonly onRematch: () => void) {
    if (typeof document === 'undefined') return;
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(END_ID)?.remove();
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    const el = (tag: string, cls: string, parent: HTMLElement, text = ''): HTMLElement => {
      const node = document.createElement(tag);
      node.className = cls;
      if (text) node.textContent = text;
      parent.appendChild(node);
      return node;
    };

    const root = document.createElement('div');
    root.id = ROOT_ID;
    const strip = el('div', 'tl-strip', root);
    const lightRow = (court: Court, cls: string): void => {
      const row = el('div', `tl-lights ${cls}`, strip);
      for (let i = 0; i < LIGHTS_TO_WIN; i++) this.lights[court].push(el('i', 'tl-light', row));
    };
    lightRow(BLUE, 'tl-blue');
    const track = el('div', 'tl-track', strip);
    const pct = (s: number): string => `${((s + RAIL_HALF) / (RAIL_HALF * 2)) * 100}%`;
    this.gates = { [BLUE]: el('i', 'tl-gate', track), [RED]: el('i', 'tl-gate', track) };
    this.gates[BLUE].style.left = pct(-GATE_S);
    this.gates[RED].style.left = pct(GATE_S);
    this.lantern = el('i', 'tl-lantern', track);
    lightRow(RED, 'tl-red');

    this.tide = el('div', 'tl-tide', root);
    this.tideLabel = el('span', '', this.tide);
    this.tideHint = el('span', 'tl-wide', this.tide);
    this.clock = el('span', 'tl-clock', this.tide);
    this.flash = el('div', 'tl-flash', root);

    this.end = el('div', 'tl-end', document.body);
    this.end.id = END_ID;
    this.endTitle = el('h1', '', this.end);
    this.endLine = el('p', '', this.end);
    const buttons = el('div', 'tl-buttons', this.end);
    const again = el('button', '', buttons, 'Trận mới');
    again.id = 'tidelight-rematch';
    again.addEventListener('click', () => this.onRematch());
    const stay = el('button', 'ghost', buttons, 'Xem tiếp');
    stay.id = 'tidelight-dismiss';
    stay.addEventListener('click', () => {
      this.dismissed = true;
      this.end.classList.remove('show');
    });

    document.body.appendChild(root);
    this.root = root;
  }

  render(state: HudState): void {
    if (!this.root) return;
    const { tide, score } = state;
    // One string compare instead of a dozen DOM writes when nothing moved.
    const key = [
      tide.favoured,
      Math.ceil(tide.msLeft / 1000),
      tide.turning,
      score.blue,
      score.red,
      Math.round(state.lanternS / 4),
      Math.sign(state.push),
      state.blueGateShut,
      state.redGateShut,
      state.winner,
      state.flash,
    ].join('|');
    if (key === this.last) return;
    this.last = key;

    this.lights[BLUE].forEach((node, i) => node.classList.toggle('on', i < score.blue));
    this.lights[RED].forEach((node, i) => node.classList.toggle('on', i < score.red));
    this.lantern.style.left = `${((state.lanternS + RAIL_HALF) / (RAIL_HALF * 2)) * 100}%`;
    this.lantern.classList.toggle('to-red', state.push > 0);
    this.lantern.classList.toggle('to-blue', state.push < 0);
    this.gates[BLUE].classList.toggle('open', !state.blueGateShut);
    this.gates[RED].classList.toggle('open', !state.redGateShut);

    const favoured = tide.favoured;
    this.tide.style.color = css(favoured === BLUE ? INK.TIDE : favoured === RED ? INK.EMBER : INK.CREAM);
    this.tide.classList.toggle('turning', tide.turning);
    const mine = favoured !== null && favoured === state.playerCourt;
    this.tideLabel.textContent =
      favoured === null
        ? 'Nước đứng'
        : `${favoured === BLUE ? '▶' : '◀'} ${TIDE_NAME[favoured]}`;
    this.tideHint.textContent = favoured === null ? '' : mine ? '· thuận' : '· nghịch';
    this.clock.textContent = formatClock(tide.msLeft);

    this.flash.textContent = state.flash ?? '';
    this.flash.classList.toggle('show', state.flash !== null);

    if (state.winner && !this.dismissed) {
      const won = state.winner === state.playerCourt;
      this.endTitle.textContent = won ? 'Thắp Sáng!' : 'Tắt Đèn';
      this.endTitle.style.color = css(won ? INK.LANTERN : INK.CORAL);
      this.endLine.textContent = `${won ? 'Đội bạn đã đưa đèn về bến' : 'Đối thủ đã đưa đèn về bến'} · ${score.blue} – ${score.red} · ${formatClock(state.matchMs)}`;
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
