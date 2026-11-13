import { INK, css } from '../world/palette';

/**
 * One cheap DOM banner for the two small maps: a strip at the top, a big
 * centre word (countdown, round result) and an end card with a restart button.
 * It only writes to the DOM when the text changed, so calling `render` every
 * frame costs nothing.
 */
export interface BannerView {
  top: string;
  center: string;
  end: { title: string; line: string } | null;
}

const FONT = '"Avenir Next","Segoe UI",system-ui,sans-serif';

const el = (tag: string, style: string, parent: HTMLElement): HTMLElement => {
  const node = document.createElement(tag);
  node.style.cssText = style;
  parent.appendChild(node);
  return node;
};

export class Banner {
  private root: HTMLElement | null = null;
  private top!: HTMLElement;
  private center!: HTMLElement;
  private end!: HTMLElement;
  private endTitle!: HTMLElement;
  private endLine!: HTMLElement;
  private last = '';

  constructor(
    id: string,
    private readonly onRestart: () => void
  ) {
    if (typeof document === 'undefined') return;
    const root = document.createElement('div');
    root.id = id;
    root.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:40;font-family:${FONT};color:${css(INK.CREAM)}`;
    this.top = el(
      'div',
      `position:absolute;left:50%;top:calc(var(--safe-top,0px) + 39px);transform:translateX(-50%);padding:5px 16px;border-radius:999px;` +
        `background:${css(INK.ABYSS, 0.82)};border:1.5px solid ${css(INK.CREAM, 0.22)};font-weight:700;font-size:14px;white-space:nowrap;display:none`,
      root
    );
    this.center = el(
      'div',
      `position:absolute;left:0;right:0;top:30%;text-align:center;font-weight:800;font-size:clamp(28px,8vh,64px);` +
        `letter-spacing:.1em;text-transform:uppercase;text-shadow:0 4px 0 ${css(INK.SHADOW)};display:none`,
      root
    );
    this.end = el(
      'div',
      `position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;` +
        `background:${css(INK.ABYSS, 0.78)};pointer-events:auto`,
      root
    );
    this.endTitle = el(
      'h1',
      `margin:0;font-size:clamp(30px,8vh,64px);letter-spacing:.1em;text-transform:uppercase;text-shadow:0 4px 0 ${css(INK.SHADOW)}`,
      this.end
    );
    this.endLine = el('p', 'margin:0;font-size:15px;opacity:.85', this.end);
    const button = el(
      'button',
      `font:inherit;font-weight:800;font-size:16px;min-width:132px;min-height:48px;border-radius:14px;` +
        `border:2px solid ${css(INK.CREAM)};background:${css(INK.LANTERN)};color:${css(INK.ABYSS)};cursor:pointer`,
      this.end
    );
    button.textContent = 'Chơi lại';
    // Gone before the restart: a card left up over the next match eats every click.
    button.addEventListener('click', () => {
      this.destroy();
      this.onRestart();
    });
    document.body.appendChild(root);
    this.root = root;
  }

  render(view: BannerView): void {
    if (!this.root) return;
    const key = `${view.top}|${view.center}|${view.end?.title ?? ''}|${view.end?.line ?? ''}`;
    if (key === this.last) return;
    this.last = key;
    this.top.textContent = view.top;
    this.top.style.display = view.top ? 'block' : 'none';
    this.center.textContent = view.center;
    this.center.style.display = view.center && !view.end ? 'block' : 'none';
    this.end.style.display = view.end ? 'flex' : 'none';
    if (view.end) {
      this.endTitle.textContent = view.end.title;
      this.endLine.textContent = view.end.line;
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }
}

/** Ask the host to restart the match, the way the Heart's end card does. */
export const restartOf = (game: any) => (): void => {
  if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
  else if (typeof location !== 'undefined') location.reload();
};
