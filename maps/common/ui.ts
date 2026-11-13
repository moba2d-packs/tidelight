import { INK, css } from '../../world/palette';

/**
 * A one-line announcer and an end card, as two DOM nodes.
 *
 * DOM, not canvas, for the same reason `world/hud.ts` is: free compositing,
 * crisp at any pixel ratio, and it costs nothing per frame. Shared by the
 * maps under `maps/` so each one's object stays about its rules.
 */
const STYLE_ID = 'tidelight-maps-style';
const STYLE = `
.tlm-say{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 78px);transform:translateX(-50%);z-index:40;
  pointer-events:none;padding:6px 16px;border-radius:999px;font:700 15px "Avenir Next","Segoe UI",system-ui,sans-serif;
  color:${css(INK.CREAM)};background:${css(INK.ABYSS, 0.85)};border:1.5px solid ${css(INK.LANTERN, 0.6)};
  opacity:0;transition:opacity .25s;white-space:nowrap}
.tlm-say.on{opacity:1}
.tlm-end{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;
  background:${css(INK.ABYSS, 0.78)};color:${css(INK.CREAM)};font-family:"Avenir Next","Segoe UI",system-ui,sans-serif}
.tlm-end.show{display:flex}
.tlm-end h1{margin:0;font-size:44px}
.tlm-end button{pointer-events:auto;font:700 16px inherit;padding:8px 22px;border-radius:999px;border:0;cursor:pointer;
  background:${css(INK.LANTERN)};color:${css(INK.ABYSS)}}
`;

export interface ArenaHud {
  say(text: string, ms?: number): void;
  end(won: boolean, line: string): void;
  destroy(): void;
}

export function createArenaHud(onRestart: () => void): ArenaHud {
  if (typeof document === 'undefined') return { say() {}, end() {}, destroy() {} };
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }
  const say = document.createElement('div');
  say.className = 'tlm-say';
  const end = document.createElement('div');
  end.className = 'tlm-end';
  end.innerHTML = '<h1></h1><div class="line"></div><button type="button">Chơi lại</button>';
  // Gone before the restart: a card left up over the next match eats every click.
  end.querySelector('button')!.addEventListener('click', () => {
    say.remove();
    end.remove();
    onRestart();
  });
  document.body.append(say, end);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    say(text, ms = 2600) {
      say.textContent = text;
      say.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => say.classList.remove('on'), ms);
    },
    end(won, line) {
      const title = end.querySelector('h1') as HTMLElement;
      title.textContent = won ? 'Chiến Thắng!' : 'Thất Bại';
      title.style.color = css(won ? INK.LANTERN : INK.CORAL);
      (end.querySelector('.line') as HTMLElement).textContent = line;
      end.classList.add('show');
    },
    destroy() {
      clearTimeout(timer);
      say.remove();
      end.remove();
    },
  };
}
