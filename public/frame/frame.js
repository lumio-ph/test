/*
 * Frame Studio — puts a photo, logo, name and designation into a frame and
 * exports the result as an image. Everything runs in the browser on a
 * <canvas>; files never leave the device.
 *
 * Each frame is a function render(ctx, W, H, opts) that draws the whole image
 * at full size (1080 wide). The preview, the frame thumbnails and the
 * download all go through the same functions, so what you see is what you get.
 */
(function () {
  'use strict';

  const CONFIG = window.FRAME_STUDIO_CONFIG || {};
  const DEFAULTS = Object.assign(
    { headline: '', tag: '', name: '', designation: '', frame: 'halo', format: 'square', theme: 'included', font: 'Archivo', logoPos: 'tr' },
    CONFIG.defaults,
  );
  const STORAGE_KEY = 'frame-studio:v1';

  const FORMATS = {
    square: { w: 1080, h: 1080 },
    portrait: { w: 1080, h: 1350 },
    story: { w: 1080, h: 1920 },
  };

  const THEMES = [
    { id: 'included', name: 'Included', primary: '#128a38', secondary: '#7ed321', accent: '#ffc400', ink: '#111111', paper: '#fafaf8' },
    { id: 'midnight', name: 'Midnight', primary: '#1d2b7a', secondary: '#4f7cff', accent: '#7ef0ff', ink: '#0b1020', paper: '#f4f6fb' },
    { id: 'sunset', name: 'Sunset', primary: '#b3134f', secondary: '#ff6f61', accent: '#ffc15e', ink: '#1d0f18', paper: '#fff8f3' },
    { id: 'royal', name: 'Royal', primary: '#4b1fa6', secondary: '#9b5de5', accent: '#f6c445', ink: '#140a2a', paper: '#f8f5ff' },
    { id: 'ocean', name: 'Ocean', primary: '#00546b', secondary: '#0aa3a3', accent: '#c6f36b', ink: '#04161c', paper: '#f2f8f8' },
    { id: 'graphite', name: 'Graphite', primary: '#1f1f1f', secondary: '#5a5a5a', accent: '#d4af37', ink: '#111111', paper: '#f5f5f2' },
  ];

  // Display fonts and the weight each one looks right at.
  const FONT_WEIGHTS = { Archivo: 800, Poppins: 700, 'Space Grotesk': 700, 'Playfair Display': 800, 'DM Serif Display': 400 };
  const BODY = 'Manrope';
  const MONO = 'IBM Plex Mono';

  /* ------------------------------------------------------------------ */
  /* State                                                                */
  /* ------------------------------------------------------------------ */

  const startTheme = THEMES.find((t) => t.id === DEFAULTS.theme) || THEMES[0];

  const state = {
    frame: DEFAULTS.frame,
    format: FORMATS[DEFAULTS.format] ? DEFAULTS.format : 'square',
    themeId: startTheme.id,
    colors: pickColors(startTheme),
    font: FONT_WEIGHTS[DEFAULTS.font] ? DEFAULTS.font : 'Archivo',
    text: { name: DEFAULTS.name, designation: DEFAULTS.designation, headline: DEFAULTS.headline, tag: DEFAULTS.tag },
    photo: { original: null, src: null, small: null, name: '', zoom: 1, px: 0, py: 0, brightness: 100, mono: false },
    logo: { original: null, src: null, name: '', pos: DEFAULTS.logoPos, size: 1, chip: true, knockout: false },
    overlayText: { y: 84, color: '#ffffff', show: true },
    overlays: [], // { id, name, img, textY, textColor, showText, format }
  };

  // Geometry of the photo in the last preview render, for dragging.
  let geom = null;

  function pickColors(t) {
    return { primary: t.primary, secondary: t.secondary, accent: t.accent, ink: t.ink, paper: t.paper };
  }

  /* ------------------------------------------------------------------ */
  /* Drawing helpers                                                      */
  /* ------------------------------------------------------------------ */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function fontStr(weight, size, family) {
    return `${weight} ${Math.round(size * 10) / 10}px "${family}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  }
  function displayFont(size) {
    return fontStr(FONT_WEIGHTS[state.font] || 800, size, state.font);
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function brandGradient(ctx, x0, y0, x1, y1, c) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c.primary);
    g.addColorStop(0.55, c.secondary);
    g.addColorStop(1, c.accent);
    return g;
  }

  // Width of text drawn with extra space between letters.
  function spacedWidth(ctx, text, spacing) {
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width;
    return w + spacing * Math.max(0, [...text].length - 1);
  }
  function fillSpaced(ctx, text, x, y, spacing, align) {
    const total = spacedWidth(ctx, text, spacing);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prev = ctx.textAlign;
    ctx.textAlign = 'left';
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
    ctx.textAlign = prev;
    return total;
  }

  function wrapWords(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function ellipsize(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text.replace(/…$/, '');
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }

  // Largest size (down to minSize) at which `text` fits in maxLines lines.
  function fitLines(ctx, text, o) {
    const step = Math.max(1, o.size * 0.03);
    for (let s = o.size; s >= o.minSize; s -= step) {
      ctx.font = o.font(s);
      const lines = wrapWords(ctx, text, o.maxWidth);
      if (lines.length <= o.maxLines && lines.every((l) => ctx.measureText(l).width <= o.maxWidth)) {
        return { lines, size: s, font: o.font(s) };
      }
    }
    ctx.font = o.font(o.minSize);
    const all = wrapWords(ctx, text, o.maxWidth);
    const lines = all.slice(0, o.maxLines);
    if (all.length > o.maxLines) lines[lines.length - 1] += '…';
    return { lines: lines.map((l) => ellipsize(ctx, l, o.maxWidth)), size: o.minSize, font: o.font(o.minSize) };
  }

  // Text along a circle. bottom=true reads left to right along the lower arc.
  function arcText(ctx, text, cx, cy, radius, centerAngle, maxAngle, o) {
    let size = o.size;
    let chars = [...text];
    let widths;
    let total;
    const measure = () => {
      ctx.font = o.font(size);
      widths = chars.map((ch) => ctx.measureText(ch).width);
      total = widths.reduce((a, b) => a + b, 0) + size * o.spacing * Math.max(0, chars.length - 1);
    };
    measure();
    while (total / radius > maxAngle && size > o.minSize) {
      size = Math.max(o.minSize, size * 0.95);
      measure();
    }
    if (total / radius > maxAngle) {
      while (chars.length > 2 && total / radius > maxAngle) {
        chars = chars.slice(0, -2).concat('…');
        measure();
      }
    }
    const sp = size * o.spacing;
    ctx.save();
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.shadow) {
      ctx.shadowColor = o.shadow;
      ctx.shadowBlur = size * 0.3;
    }
    let acc = 0;
    chars.forEach((ch, i) => {
      const w = widths[i];
      const a = o.bottom ? centerAngle + (total / 2 - acc - w / 2) / radius : centerAngle - total / 2 / radius + (acc + w / 2) / radius;
      ctx.save();
      ctx.translate(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
      ctx.rotate(o.bottom ? a - Math.PI / 2 : a + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      acc += w + sp;
    });
    ctx.restore();
  }

  /*
   * Vertical stacks of text, used by most frames. Items:
   *   { text: fitted (from fitLines), lh, color, spacing?, highlight? }
   *   { gap: px }
   *   { bar: { w, h, fill } }
   */
  function stackHeight(items) {
    return items.reduce((h, it) => {
      if (it.gap) return h + it.gap;
      if (it.bar) return h + it.bar.h;
      if (it.text) return h + it.text.lines.length * it.text.size * it.lh;
      return h;
    }, 0);
  }
  function drawStack(ctx, items, x, top, align) {
    let y = top;
    ctx.textBaseline = 'middle';
    for (const it of items) {
      if (it.gap) {
        y += it.gap;
      } else if (it.bar) {
        const bx = align === 'center' ? x - it.bar.w / 2 : x;
        ctx.fillStyle = typeof it.bar.fill === 'function' ? it.bar.fill(bx, y, it.bar.w) : it.bar.fill;
        roundRect(ctx, bx, y, it.bar.w, it.bar.h, it.bar.h / 2);
        ctx.fill();
        y += it.bar.h;
      } else if (it.text) {
        const { lines, size, font } = it.text;
        const lineH = size * it.lh;
        for (const line of lines) {
          const cy = y + lineH / 2;
          ctx.font = font;
          const w = it.spacing ? spacedWidth(ctx, line, it.spacing) : ctx.measureText(line).width;
          const lx = align === 'center' ? x - w / 2 : x;
          if (it.highlight) {
            ctx.fillStyle = it.highlight;
            const hh = size * 0.42;
            ctx.fillRect(lx - size * 0.12, cy + size * 0.02, w + size * 0.24, hh);
          }
          ctx.fillStyle = it.color;
          if (it.shadow) {
            ctx.save();
            ctx.shadowColor = it.shadow;
            ctx.shadowBlur = size * 0.35;
            ctx.shadowOffsetY = size * 0.04;
          }
          if (it.spacing) fillSpaced(ctx, line, lx, cy, it.spacing, 'left');
          else {
            ctx.textAlign = 'left';
            ctx.fillText(line, lx, cy);
          }
          if (it.shadow) ctx.restore();
          y += lineH;
        }
      }
    }
    return y;
  }

  /* ------------------------------------------------------------------ */
  /* Photo and logo                                                       */
  /* ------------------------------------------------------------------ */

  // area: { x, y, w, h, path(ctx) } — the photo covers the area and is clipped to path.
  function drawPhoto(ctx, area, opts) {
    const p = state.photo;
    const c = state.colors;
    ctx.save();
    area.path(ctx);
    ctx.clip();
    if (!p.src) {
      // Placeholder silhouette until a photo is chosen.
      const g = ctx.createLinearGradient(area.x, area.y, area.x, area.y + area.h);
      g.addColorStop(0, mix(c.paper, c.primary, 0.1));
      g.addColorStop(1, mix(c.paper, c.primary, 0.24));
      ctx.fillStyle = g;
      ctx.fillRect(area.x, area.y, area.w, area.h);
      const s = Math.min(area.w, area.h);
      const cx = area.x + area.w / 2;
      const hy = area.y + area.h * 0.5 - s * 0.1;
      ctx.fillStyle = rgba(c.primary, 0.22);
      ctx.beginPath();
      ctx.arc(cx, hy, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, hy + s * 0.42, s * 0.32, s * 0.24, 0, Math.PI, 0);
      ctx.lineTo(cx + s * 0.32, area.y + area.h);
      ctx.lineTo(cx - s * 0.32, area.y + area.h);
      ctx.fill();
      ctx.restore();
      if (opts.main) geom = null;
      return;
    }
    const img = opts.thumb && p.small ? p.small : p.src;
    const scale = Math.max(area.w / img.width, area.h / img.height) * p.zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const ox = clamp(p.px * dw, -(dw - area.w) / 2, (dw - area.w) / 2);
    const oy = clamp(p.py * dh, -(dh - area.h) / 2, (dh - area.h) / 2);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, area.x + (area.w - dw) / 2 + ox, area.y + (area.h - dh) / 2 + oy, dw, dh);
    ctx.restore();
    if (opts.main) geom = { area, dw, dh };
  }

  // Size of the logo box: logo height `base`, capped at maxW wide.
  function logoBox(base, maxW) {
    const img = state.logo.src;
    if (!img) return null;
    const ar = img.width / img.height;
    let h = base * state.logo.size;
    let w = h * ar;
    const cap = maxW * state.logo.size;
    if (w > cap) {
      w = cap;
      h = w / ar;
    }
    const pad = state.logo.chip ? Math.max(h * 0.32, base * 0.22) : 0;
    return { w: w + pad * 2.4, h: h + pad * 2, lw: w, lh: h, padX: pad * 1.2, padY: pad };
  }

  function drawLogoAt(ctx, box, x, y) {
    const img = state.logo.src;
    if (!img || !box) return;
    if (state.logo.chip) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.16)';
      ctx.shadowBlur = box.h * 0.25;
      ctx.shadowOffsetY = box.h * 0.06;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, y, box.w, box.h, Math.min(box.h * 0.28, 28));
      ctx.fill();
      ctx.restore();
    }
    ctx.drawImage(img, x + box.padX, y + box.padY, box.lw, box.lh);
  }

  function drawLogoInCircle(ctx, cx, cy, r) {
    const img = state.logo.src;
    if (!img) return;
    if (state.logo.chip) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = r * 0.35;
      ctx.shadowOffsetY = r * 0.08;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const inner = r * (state.logo.chip ? 1.32 : 1.9);
    const ar = img.width / img.height;
    const w = ar >= 1 ? inner : inner * ar;
    const h = ar >= 1 ? inner / ar : inner;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  function corner(pos, W, H, w, h, mx, my) {
    return {
      x: pos[1] === 'l' ? mx : W - mx - w,
      y: pos[0] === 't' ? my : H - my - h,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Frames                                                               */
  /* ------------------------------------------------------------------ */

  // Halo — round profile frame: gradient ring, curved headline, name badge.
  function renderHalo(ctx, W, H, opts) {
    const c = state.colors;
    const t = state.text;
    const tall = H / W > 1.1;

    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const R = tall ? (H / W > 1.5 ? W * 0.41 : W * 0.37) : W * 0.48;
    // Tall sizes: centre the circle and the text under it as one group.
    let below = null;
    if (tall) {
      const maxW = W * 0.84;
      const avail = H - R * 2 - W * 0.22;
      for (let k = 1; k >= 0.55; k -= 0.05) {
        below = [
          { text: fitLines(ctx, t.name || 'Your Name', { font: displayFont, size: W * 0.085 * k, minSize: W * 0.045 * k, maxWidth: maxW, maxLines: 2 }), lh: 1.08, color: c.ink },
          { gap: W * 0.03 * k },
          { bar: { w: W * 0.14, h: W * 0.012, fill: (x, y, w) => brandGradient(ctx, x, 0, x + w, 0, c) } },
        ];
        if (t.designation) {
          below.push({ gap: W * 0.028 * k }, { text: fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.036 * k, minSize: W * 0.026 * k, maxWidth: maxW, maxLines: 2 }), lh: 1.3, color: rgba(c.ink, 0.72) });
        }
        if (stackHeight(below) <= avail) break;
      }
    }
    const groupH = tall ? R * 2 + W * 0.07 + stackHeight(below) : 0;
    const cy = tall ? (H - groupH) / 2 - W * 0.01 + R : H / 2;
    const ring = R * 0.17;
    const r = R - ring;

    if (tall) {
      // Soft glow and a gradient footer so the extra space feels designed.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.6);
      glow.addColorStop(0, rgba(c.secondary, 0.22));
      glow.addColorStop(1, rgba(c.secondary, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = brandGradient(ctx, 0, 0, W, 0, c);
      ctx.fillRect(0, H - W * 0.022, W, W * 0.022);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = W * 0.03;
    ctx.shadowOffsetY = W * 0.01;
    ctx.fillStyle = brandGradient(ctx, cx - R, cy - R, cx + R, cy + R, c);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPhoto(ctx, { x: cx - r, y: cy - r, w: r * 2, h: r * 2, path: (k) => { k.beginPath(); k.arc(cx, cy, r, 0, Math.PI * 2); } }, opts);

    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = W * 0.007;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const mid = R - ring / 2;
    const arcOpts = (size) => ({ font: (s) => displayFont(s), size, minSize: size * 0.6, spacing: 0.12, color: '#ffffff', shadow: 'rgba(0,0,0,0.28)' });
    if (t.headline) arcText(ctx, t.headline.toUpperCase(), cx, cy, mid, -Math.PI / 2, (88 * Math.PI) / 180, arcOpts(ring * 0.4));
    if (t.tag) arcText(ctx, t.tag, cx, cy, mid, Math.PI / 2, (84 * Math.PI) / 180, Object.assign(arcOpts(ring * 0.32), { bottom: true, spacing: 0.06 }));

    if (!tall) {
      // Name badge over the lower part of the photo.
      const name = t.name || 'Your Name';
      const nameFit = fitLines(ctx, name, { font: displayFont, size: W * 0.05, minSize: W * 0.03, maxWidth: W * 0.5, maxLines: 1 });
      const desFit = t.designation
        ? fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.026, minSize: W * 0.019, maxWidth: W * 0.5, maxLines: 1 })
        : null;
      ctx.font = nameFit.font;
      let w = ctx.measureText(nameFit.lines[0]).width;
      if (desFit) {
        ctx.font = desFit.font;
        w = Math.max(w, ctx.measureText(desFit.lines[0]).width);
      }
      const padX = W * 0.04;
      const padY = W * 0.022;
      const items = [{ text: nameFit, lh: 1.12, color: '#ffffff' }];
      if (desFit) items.push({ gap: W * 0.004 }, { text: desFit, lh: 1.3, color: c.accent });
      const bh = stackHeight(items) + padY * 2;
      const bw = w + padX * 2;
      const by = cy + r * 0.78 - bh / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetY = W * 0.006;
      ctx.fillStyle = c.ink;
      roundRect(ctx, cx - bw / 2, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = brandGradient(ctx, cx - bw / 2, 0, cx + bw / 2, 0, c);
      ctx.lineWidth = W * 0.005;
      roundRect(ctx, cx - bw / 2, by, bw, bh, bh / 2);
      ctx.stroke();
      drawStack(ctx, items, cx, by + padY, 'center');
    } else {
      drawStack(ctx, below, cx, cy + R + W * 0.07, 'center');
    }

    // Logo badge sits on the ring, clear of the curved text.
    const angles = { tl: -156, tr: -24, bl: 150, br: 30 };
    const a = ((angles[state.logo.pos] ?? -28) * Math.PI) / 180;
    drawLogoInCircle(ctx, cx + mid * Math.cos(a), cy + mid * Math.sin(a), R * 0.19 * state.logo.size);
  }

  // Spotlight — full-bleed photo, dark fade, big name.
  function renderSpotlight(ctx, W, H, opts) {
    const c = state.colors;
    const t = state.text;
    const m = W * 0.07;

    drawPhoto(ctx, { x: 0, y: 0, w: W, h: H, path: (k) => { k.beginPath(); k.rect(0, 0, W, H); } }, opts);

    let g = ctx.createLinearGradient(0, 0, 0, H * 0.24);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.24);
    g = ctx.createLinearGradient(0, H * 0.4, 0, H);
    g.addColorStop(0, rgba(c.ink, 0));
    g.addColorStop(0.55, rgba(c.ink, 0.62));
    g.addColorStop(1, rgba(c.ink, 0.94));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.4, W, H * 0.6);

    const stripH = W * 0.018;
    ctx.fillStyle = brandGradient(ctx, 0, 0, W, 0, c);
    ctx.fillRect(0, H - stripH, W, stripH);

    const pos = state.logo.pos;
    const box = logoBox(W * 0.07, W * 0.3);

    // Headline chip at the top, on the side without the logo.
    if (t.headline) {
      const size = W * 0.026;
      ctx.font = displayFont(size);
      const sp = size * 0.12;
      const room = box && pos[0] === 't' ? W - m * 2 - box.w - W * 0.04 - size * 1.8 : W * 0.7;
      let label = t.headline.toUpperCase();
      while (label.length > 1 && spacedWidth(ctx, label, sp) > Math.min(W * 0.7, room)) label = label.replace(/…$/, '').slice(0, -1).trimEnd() + '…';
      const tw = spacedWidth(ctx, label, sp);
      const ch = size * 2.3;
      const cw = tw + size * 1.8;
      const onRight = box && pos === 'tl';
      const x = onRight ? W - m - cw : m;
      ctx.fillStyle = c.accent;
      roundRect(ctx, x, m, cw, ch, ch / 2);
      ctx.fill();
      ctx.fillStyle = c.ink;
      ctx.textBaseline = 'middle';
      fillSpaced(ctx, label, x + size * 0.9, m + ch / 2 + size * 0.04, sp, 'left');
    }

    const bottom = H - stripH - m * 0.9;
    let maxW = W - m * 2;
    if (box && pos === 'br') maxW -= box.w + W * 0.04;
    let items;
    for (let k = 1; k >= 0.6; k -= 0.05) {
      items = [];
      if (box && pos === 'bl') items.push({ logo: true }, { gap: W * 0.04 });
      items.push(
        { bar: { w: W * 0.11, h: W * 0.012, fill: (x, y, w) => brandGradient(ctx, x, 0, x + w, 0, Object.assign({}, c, { primary: c.secondary })) } },
        { gap: W * 0.03 },
        { text: fitLines(ctx, t.name || 'Your Name', { font: displayFont, size: W * 0.095 * k, minSize: W * 0.05, maxWidth: maxW, maxLines: 2 }), lh: 1.04, color: '#ffffff', shadow: 'rgba(0,0,0,0.25)' },
      );
      if (t.designation) {
        items.push({ gap: W * 0.016 }, { text: fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.036 * k, minSize: W * 0.026, maxWidth: maxW, maxLines: 2 }), lh: 1.3, color: 'rgba(255,255,255,0.88)' });
      }
      if (t.tag) {
        items.push({ gap: W * 0.022 }, { text: fitLines(ctx, t.tag, { font: (s) => fontStr(600, s, MONO), size: W * 0.026, minSize: W * 0.02, maxWidth: maxW, maxLines: 1 }), lh: 1.3, color: c.accent });
      }
      if (stackHeight(items.filter((i) => !i.logo)) + (box && pos === 'bl' ? box.h : 0) <= H * 0.5) break;
    }
    const logoH = box && pos === 'bl' ? box.h : 0;
    const top = bottom - stackHeight(items.filter((i) => !i.logo)) - logoH;
    if (box && pos === 'bl') drawLogoAt(ctx, box, m, top);
    drawStack(ctx, items.filter((i) => !i.logo), m, top + logoH, 'left');

    if (box && pos !== 'bl') {
      if (pos === 'br') drawLogoAt(ctx, box, W - m - box.w, bottom - box.h);
      else drawLogoAt(ctx, box, pos === 'tl' ? m : W - m - box.w, m);
    }
  }

  // Editorial — magazine layout on paper, highlighter name.
  function renderEditorial(ctx, W, H, opts) {
    const c = state.colors;
    const t = state.text;
    const m = W * 0.065;
    const pos = state.logo.pos;

    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, W, H);
    const rule = W * 0.014;
    ctx.fillStyle = brandGradient(ctx, 0, 0, W, 0, c);
    ctx.fillRect(0, H - rule, W, rule);

    const box = logoBox(W * 0.052, W * 0.26);
    const barH = W * 0.075;
    const logoTop = box && pos[0] === 't';
    const headTop = Math.max(barH, logoTop ? box.h : 0);

    // Top line: headline (and the logo, when it is at the top).
    if (t.headline) {
      const size = W * 0.024;
      ctx.font = fontStr(600, size, MONO);
      ctx.fillStyle = c.ink;
      ctx.textBaseline = 'middle';
      const maxW = W - m * 2 - (logoTop ? box.w + W * 0.04 : 0);
      const label = ellipsize(ctx, t.headline.toUpperCase(), maxW);
      const right = logoTop && pos === 'tl';
      ctx.fillStyle = c.primary;
      const dot = size * 0.32;
      const lx = right ? W - m : m;
      if (right) {
        ctx.fillStyle = c.ink;
        const w = fillSpaced(ctx, label, lx, m + headTop / 2, size * 0.1, 'right');
        ctx.fillStyle = c.primary;
        ctx.beginPath();
        ctx.arc(lx - w - dot * 2.6, m + headTop / 2, dot, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(lx + dot, m + headTop / 2, dot, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.ink;
        fillSpaced(ctx, label, lx + dot * 4, m + headTop / 2, size * 0.1, 'left');
      }
    }
    if (logoTop) drawLogoAt(ctx, box, pos === 'tl' ? m : W - m - box.w, m + (headTop - box.h) / 2);

    // Photo with an offset gradient block behind it.
    const py = m + headTop + W * 0.03;
    const ph = H * (H / W > 1.5 ? 0.62 : H / W > 1.1 ? 0.56 : 0.5);
    const pw = W - m * 2;
    const rad = W * 0.03;
    const off = W * 0.022;
    ctx.fillStyle = brandGradient(ctx, m, py, m + pw, py + ph, c);
    roundRect(ctx, m + off, py + off, pw, ph, rad);
    ctx.fill();
    drawPhoto(ctx, { x: m, y: py, w: pw, h: ph, path: (k) => roundRect(k, m, py, pw, ph, rad) }, opts);

    // Bottom row: tag (and the logo, when it is at the bottom).
    const logoBottom = box && pos[0] === 'b';
    const rowH = Math.max(t.tag ? W * 0.05 : 0, logoBottom ? box.h : 0);
    const rowY = H - rule - m * 0.8 - rowH;
    if (t.tag) {
      ctx.font = fontStr(600, W * 0.026, MONO);
      ctx.fillStyle = c.primary;
      ctx.textBaseline = 'middle';
      const left = !(logoBottom && pos === 'bl');
      ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(ellipsize(ctx, t.tag, W * 0.5), left ? m : W - m, rowY + rowH / 2);
      ctx.textAlign = 'left';
    }
    if (logoBottom) drawLogoAt(ctx, box, pos === 'bl' ? m : W - m - box.w, rowY + (rowH - box.h) / 2);

    // Name and designation between the photo and the bottom row.
    const top = py + ph + off + W * 0.05;
    const avail = rowY - W * 0.03 - top;
    const maxW = W - m * 2;
    let items;
    for (let k = 1; k >= 0.5; k -= 0.05) {
      items = [{ text: fitLines(ctx, t.name || 'Your Name', { font: displayFont, size: W * 0.085 * k, minSize: W * 0.04, maxWidth: maxW - W * 0.02, maxLines: 2 }), lh: 1.1, color: c.ink, highlight: rgba(c.accent, 0.85) }];
      if (t.designation) {
        items.push({ gap: W * 0.014 * k }, { text: fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.034 * k, minSize: W * 0.022, maxWidth: maxW, maxLines: 2 }), lh: 1.3, color: rgba(c.ink, 0.7) });
      }
      if (stackHeight(items) <= avail) break;
    }
    drawStack(ctx, items, m + W * 0.01, top, 'left');
  }

  // Split — colour panel with the text, photo cut on a diagonal.
  function renderSplit(ctx, W, H, opts) {
    const c = state.colors;
    const t = state.text;
    const tall = H / W > 1.5;
    const m = W * 0.065;
    const deep = mix(c.primary, c.ink, 0.45);

    const g = ctx.createLinearGradient(0, 0, tall ? 0 : W * 0.5, tall ? H : H);
    g.addColorStop(0, c.primary);
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Photo polygon and the text panel, by orientation.
    let poly;
    let panel;
    if (tall) {
      poly = [[0, 0], [W, 0], [W, H * 0.56], [0, H * 0.62]];
      panel = { x: m, y: H * 0.62 + m * 0.6, w: W - m * 2, h: H - H * 0.62 - m * 1.6 };
    } else {
      poly = [[W * 0.45, 0], [W, 0], [W, H], [W * 0.37, H]];
      panel = { x: m, y: m, w: W * 0.37 - m * 1.5, h: H - m * 2 };
    }
    const path = (k) => {
      k.beginPath();
      poly.forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
      k.closePath();
    };
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const area = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), path };
    drawPhoto(ctx, area, opts);

    // Accent edge along the cut.
    ctx.strokeStyle = brandGradient(ctx, 0, 0, W, H, Object.assign({}, c, { primary: c.secondary }));
    ctx.lineWidth = W * 0.014;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (tall) {
      ctx.moveTo(0, H * 0.62);
      ctx.lineTo(W, H * 0.56);
    } else {
      ctx.moveTo(W * 0.45, 0);
      ctx.lineTo(W * 0.37, H);
    }
    ctx.stroke();

    const pos = state.logo.pos;
    const box = logoBox(W * 0.06, tall ? W * 0.3 : panel.w * 0.8);
    // In the wide layout, left-side logo positions sit in the panel; right-side ones on the photo.
    const inPanel = box && (tall ? pos[0] === 'b' : pos[1] === 'l');
    let reserveTop = 0;
    let reserveBottom = 0;
    if (inPanel) {
      if (tall) reserveBottom = box.h + W * 0.04;
      else if (pos[0] === 't') reserveTop = box.h + W * 0.05;
      else reserveBottom = box.h + W * 0.05;
    }
    if (box) {
      if (inPanel) {
        const y = pos[0] === 't' && !tall ? panel.y : panel.y + panel.h - box.h;
        const x = tall && pos[1] === 'r' ? panel.x + panel.w - box.w : panel.x;
        drawLogoAt(ctx, box, x, y);
      } else {
        const p = corner(pos, W, H, box.w, box.h, m * 0.7, m * 0.7);
        drawLogoAt(ctx, box, p.x, p.y);
      }
    }

    const maxW = panel.w;
    const avail = panel.h - reserveTop - reserveBottom;
    let items;
    for (let k = 1; k >= 0.5; k -= 0.05) {
      items = [];
      if (t.headline) {
        items.push({ text: fitLines(ctx, t.headline.toUpperCase(), { font: (s) => fontStr(600, s, MONO), size: W * 0.024 * k, minSize: W * 0.018, maxWidth: maxW, maxLines: 2 }), lh: 1.45, color: c.accent }, { gap: W * 0.035 * k });
      }
      items.push(
        { text: fitLines(ctx, t.name || 'Your Name', { font: displayFont, size: (tall ? W * 0.1 : W * 0.072) * k, minSize: W * 0.036, maxWidth: maxW, maxLines: 3 }), lh: 1.06, color: '#ffffff' },
        { gap: W * 0.03 * k },
        { bar: { w: W * 0.1, h: W * 0.011, fill: (x, y, w) => brandGradient(ctx, x, 0, x + w, 0, Object.assign({}, c, { primary: c.secondary })) } },
      );
      if (t.designation) {
        items.push({ gap: W * 0.028 * k }, { text: fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.032 * k, minSize: W * 0.021, maxWidth: maxW, maxLines: 3 }), lh: 1.32, color: 'rgba(255,255,255,0.86)' });
      }
      if (t.tag) {
        items.push({ gap: W * 0.03 * k }, { text: fitLines(ctx, t.tag, { font: (s) => fontStr(600, s, MONO), size: W * 0.024 * k, minSize: W * 0.018, maxWidth: maxW, maxLines: 1 }), lh: 1.3, color: c.secondary });
      }
      if (stackHeight(items) <= avail) break;
    }
    const top = panel.y + reserveTop + Math.max(0, (avail - stackHeight(items)) / 2);
    drawStack(ctx, items, panel.x, top, 'left');
  }

  // Ready-made artwork: photo underneath, PNG/SVG frame on top, optional text.
  function renderOverlay(overlay) {
    return function (ctx, W, H, opts) {
      const m = W * 0.065;
      drawPhoto(ctx, { x: 0, y: 0, w: W, h: H, path: (k) => { k.beginPath(); k.rect(0, 0, W, H); } }, opts);
      if (overlay.img) ctx.drawImage(overlay.img, 0, 0, W, H);

      const ot = state.overlayText;
      const t = state.text;
      if (ot.show) {
        const items = [{ text: fitLines(ctx, t.name || 'Your Name', { font: displayFont, size: W * 0.068, minSize: W * 0.036, maxWidth: W - m * 3, maxLines: 1 }), lh: 1.12, color: ot.color, shadow: 'rgba(0,0,0,0.35)' }];
        if (t.designation) {
          items.push({ gap: W * 0.006 }, { text: fitLines(ctx, t.designation, { font: (s) => fontStr(600, s, BODY), size: W * 0.032, minSize: W * 0.022, maxWidth: W - m * 3, maxLines: 2 }), lh: 1.3, color: ot.color, shadow: 'rgba(0,0,0,0.35)' });
        }
        const h = stackHeight(items);
        const cy = clamp((H * ot.y) / 100, h / 2 + m * 0.5, H - h / 2 - m * 0.5);
        drawStack(ctx, items, W / 2, cy - h / 2, 'center');
      }
      const box = logoBox(W * 0.06, W * 0.28);
      if (box) {
        const p = corner(state.logo.pos, W, H, box.w, box.h, m * 1.15, m * 1.15);
        drawLogoAt(ctx, box, p.x, p.y);
      }
    };
  }

  const BUILT_IN = [
    { id: 'halo', name: 'Halo', render: renderHalo },
    { id: 'spotlight', name: 'Spotlight', render: renderSpotlight },
    { id: 'editorial', name: 'Editorial', render: renderEditorial },
    { id: 'split', name: 'Split', render: renderSplit },
  ];

  function framesForFormat() {
    const overlays = state.overlays
      .filter((o) => !o.format || o.format === state.format)
      .map((o) => ({ id: 'overlay:' + o.id, name: o.name, render: renderOverlay(o), overlay: o }));
    return overlays.filter((o) => !o.overlay.custom).concat(BUILT_IN, overlays.filter((o) => o.overlay.custom));
  }
  function currentFrame() {
    const list = framesForFormat();
    return list.find((f) => f.id === state.frame) || list.find((f) => f.id === 'halo');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const canvas = $('preview');
  const ctx = canvas.getContext('2d');

  function size() {
    return FORMATS[state.format];
  }

  let frameRequested = false;
  function requestRender() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      renderMain();
    });
  }

  function renderMain() {
    const { w, h } = size();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const frame = currentFrame();
    frame.render(ctx, w, h, { main: true });
    document.body.classList.toggle('is-overlay', !!frame.overlay);
    canvas.classList.toggle('no-photo', !state.photo.src);
    $('stage-hint').textContent = state.photo.src
      ? 'Drag the photo to reposition · scroll or pinch to zoom'
      : 'Tap the preview or step 2 to add your photo';
    scheduleThumbs();
  }

  let thumbTimer = 0;
  let dragging = false;
  function scheduleThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(renderThumbs, dragging ? 400 : 120);
  }

  /* ------------------------------------------------------------------ */
  /* Frame picker                                                         */
  /* ------------------------------------------------------------------ */

  const frameList = $('frame-list');

  function buildFramePicker() {
    frameList.textContent = '';
    for (const f of framesForFormat()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame-card';
      b.setAttribute('role', 'radio');
      b.dataset.frame = f.id;
      const cv = document.createElement('canvas');
      b.append(cv);
      const label = document.createElement('span');
      label.textContent = f.name;
      b.append(label);
      b.addEventListener('click', () => selectFrame(f.id));
      frameList.append(b);
    }
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'frame-card';
    up.title = 'Upload a PNG frame with a transparent window for the photo';
    up.innerHTML = '<div class="upload-tile" aria-hidden="true">+</div><span>Upload frame</span>';
    up.addEventListener('click', () => $('overlay-input').click());
    frameList.append(up);
    markFrame();
    renderThumbs();
  }

  function markFrame() {
    const id = currentFrame().id;
    for (const b of frameList.querySelectorAll('[data-frame]')) b.setAttribute('aria-checked', String(b.dataset.frame === id));
  }

  function renderThumbs() {
    const { w, h } = size();
    const tw = 216;
    const th = Math.round((tw * h) / w);
    const frames = framesForFormat();
    for (const b of frameList.querySelectorAll('[data-frame]')) {
      const f = frames.find((x) => x.id === b.dataset.frame);
      const cv = b.querySelector('canvas');
      if (!f || !cv) continue;
      if (cv.width !== tw || cv.height !== th) {
        cv.width = tw;
        cv.height = th;
      }
      const k = cv.getContext('2d');
      k.setTransform(tw / w, 0, 0, th / h, 0, 0);
      k.clearRect(0, 0, w, h);
      f.render(k, w, h, { thumb: true });
    }
  }

  function selectFrame(id) {
    state.frame = id;
    markFrame();
    save();
    requestRender();
  }

  /* ------------------------------------------------------------------ */
  /* Images                                                               */
  /* ------------------------------------------------------------------ */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not open that image'));
      img.src = src;
    });
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  async function imageFromFile(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Please choose an image file');
    try {
      return await loadImage(await readFile(file));
    } catch {
      throw new Error("This image format isn't supported here. Try a JPG or PNG.");
    }
  }

  // Copy into a canvas no larger than maxSide (keeps dragging smooth).
  function toCanvas(img, maxSide) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s = Math.min(1, maxSide / Math.max(iw, ih));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw * s));
    c.height = Math.max(1, Math.round(ih * s));
    const k = c.getContext('2d');
    k.imageSmoothingQuality = 'high';
    k.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function setThumb(el, source, cover) {
    if (!source) {
      el.style.backgroundImage = '';
      el.classList.remove('has-image');
      return;
    }
    try {
      el.style.backgroundImage = `url(${toCanvas(source, 160).toDataURL('image/png')})`;
      el.style.backgroundSize = cover ? 'cover' : 'contain';
      el.classList.add('has-image');
    } catch {
      // A local (file://) default logo can't be read back; the preview still works.
    }
  }

  // Brightness / black & white are baked into a copy so every frame and the export match.
  function processPhoto() {
    const p = state.photo;
    if (!p.original) return;
    const c = document.createElement('canvas');
    c.width = p.original.width;
    c.height = p.original.height;
    const k = c.getContext('2d');
    const plain = p.brightness === 100 && !p.mono;
    if (!plain && 'filter' in k) {
      k.filter = `brightness(${p.brightness}%)${p.mono ? ' grayscale(1)' : ''}`;
      k.drawImage(p.original, 0, 0);
      k.filter = 'none';
    } else {
      k.drawImage(p.original, 0, 0);
      if (!plain) {
        const d = k.getImageData(0, 0, c.width, c.height);
        const a = d.data;
        const f = p.brightness / 100;
        for (let i = 0; i < a.length; i += 4) {
          let r = a[i] * f;
          let g = a[i + 1] * f;
          let b = a[i + 2] * f;
          if (p.mono) r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          a[i] = r;
          a[i + 1] = g;
          a[i + 2] = b;
        }
        k.putImageData(d, 0, 0);
      }
    }
    p.src = c;
    p.small = toCanvas(c, 480);
  }

  // Turn near-white pixels transparent, with a soft edge.
  function processLogo() {
    const l = state.logo;
    if (!l.original) return;
    if (!l.knockout) {
      l.src = l.original;
      return;
    }
    const c = document.createElement('canvas');
    c.width = l.original.width;
    c.height = l.original.height;
    const k = c.getContext('2d');
    k.drawImage(l.original, 0, 0);
    try {
      const d = k.getImageData(0, 0, c.width, c.height);
      const a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        const min = Math.min(a[i], a[i + 1], a[i + 2]);
        if (min > 242) a[i + 3] = 0;
        else if (min > 212) a[i + 3] = Math.round(a[i + 3] * ((242 - min) / 30));
      }
      k.putImageData(d, 0, 0);
      l.src = c;
    } catch {
      l.src = l.original;
      toast('Background removal needs the page to be opened from a web server.');
    }
  }

  async function setPhotoFile(file) {
    try {
      const img = await imageFromFile(file);
      const p = state.photo;
      p.original = toCanvas(img, 2400);
      p.name = file.name;
      p.zoom = 1;
      p.px = 0;
      p.py = 0.08; // most portraits have the face in the upper half
      $('photo-zoom').value = '1';
      processPhoto();
      $('photo-label').textContent = file.name;
      setThumb($('photo-thumb'), p.small, true);
      requestRender();
    } catch (e) {
      toast(e.message);
    }
  }

  async function setLogoImage(img, name) {
    state.logo.original = toCanvas(img, 900);
    state.logo.name = name;
    processLogo();
    $('logo-label').textContent = name;
    setThumb($('logo-thumb'), state.logo.src, false);
    requestRender();
  }

  async function setLogoFile(file) {
    try {
      await setLogoImage(await imageFromFile(file), file.name);
    } catch (e) {
      toast(e.message);
    }
  }

  async function addOverlayFile(file) {
    try {
      const img = await imageFromFile(file);
      state.overlays = state.overlays.filter((o) => !o.custom);
      const ratio = img.height / img.width;
      const fmt = Object.keys(FORMATS).reduce((a, b) =>
        Math.abs(Math.log(FORMATS[b].h / FORMATS[b].w / ratio)) < Math.abs(Math.log(FORMATS[a].h / FORMATS[a].w / ratio)) ? b : a,
      );
      state.overlays.push({ id: 'custom', name: 'Your frame', img: toCanvas(img, 2160), custom: true, format: fmt });
      state.format = fmt;
      markFormat();
      updateExportInfo();
      buildFramePicker();
      selectFrame('overlay:custom');
      toast('Frame added. Your photo shows through its transparent areas.');
    } catch (e) {
      toast(e.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Moving and zooming the photo                                         */
  /* ------------------------------------------------------------------ */

  function clampPhoto() {
    const p = state.photo;
    p.zoom = clamp(p.zoom, 1, 4);
    if (!geom || !p.src) return;
    const { area } = geom;
    const scale = Math.max(area.w / p.src.width, area.h / p.src.height) * p.zoom;
    const dw = p.src.width * scale;
    const dh = p.src.height * scale;
    const mx = (dw - area.w) / 2 / dw;
    const my = (dh - area.h) / 2 / dh;
    p.px = clamp(p.px, -mx, mx);
    p.py = clamp(p.py, -my, my);
  }

  function pan(dx, dy) {
    if (!geom) return;
    state.photo.px += dx / geom.dw;
    state.photo.py += dy / geom.dh;
    clampPhoto();
    requestRender();
  }

  function setZoom(z) {
    state.photo.zoom = clamp(z, 1, 4);
    $('photo-zoom').value = String(state.photo.zoom);
    clampPhoto();
    requestRender();
  }

  const pointers = new Map();
  let pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.photo.src) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true;
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: state.photo.zoom };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      const s = canvas.width / canvas.getBoundingClientRect().width;
      pan((e.clientX - prev.x) * s, (e.clientY - prev.y) * s);
    } else if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragging = false;
      canvas.classList.remove('dragging');
      scheduleThumbs();
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('click', () => {
    if (!state.photo.src) $('photo-input').click();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!state.photo.src) return;
      e.preventDefault();
      setZoom(state.photo.zoom * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  canvas.addEventListener('keydown', (e) => {
    if (!state.photo.src) return;
    const step = e.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      pan(...moves[e.key]);
    } else if (e.key === '+' || e.key === '=') {
      setZoom(state.photo.zoom * 1.08);
    } else if (e.key === '-') {
      setZoom(state.photo.zoom / 1.08);
    }
  });

  // Drop a photo straight onto the preview.
  const wrap = $('canvas-wrap');
  wrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    wrap.classList.add('drag-over');
  });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over'));
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    wrap.classList.remove('drag-over');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) setPhotoFile(file);
  });
  for (const id of ['photo-drop', 'logo-drop']) {
    const el = $(id);
    el.addEventListener('dragenter', () => el.classList.add('drag-over'));
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', () => el.classList.remove('drag-over'));
  }

  /* ------------------------------------------------------------------ */
  /* Controls                                                             */
  /* ------------------------------------------------------------------ */

  function bindSegmented(groupId, attr, get, set) {
    const group = $(groupId);
    const mark = () => {
      for (const b of group.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset[attr] === get()));
    };
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset[attr]);
      mark();
    });
    mark();
    return mark;
  }

  const markFormat = bindSegmented('format-group', 'format', () => state.format, (v) => {
    state.format = v;
    if (!framesForFormat().some((f) => f.id === state.frame)) state.frame = 'halo';
    geom = null;
    buildFramePicker();
    updateExportInfo();
    save();
    requestRender();
  });
  const markLogoPos = bindSegmented('logo-pos', 'pos', () => state.logo.pos, (v) => {
    state.logo.pos = v;
    save();
    requestRender();
  });

  const textFields = { 't-name': 'name', 't-designation': 'designation', 't-headline': 'headline', 't-tag': 'tag' };
  for (const [id, key] of Object.entries(textFields)) {
    const el = $(id);
    el.value = state.text[key];
    el.addEventListener('input', () => {
      state.text[key] = el.value.trim();
      save();
      requestRender();
    });
  }

  $('photo-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) setPhotoFile(f);
    e.target.value = '';
  });
  $('logo-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) setLogoFile(f);
    e.target.value = '';
  });
  $('overlay-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) addOverlayFile(f);
    e.target.value = '';
  });

  $('photo-zoom').addEventListener('input', (e) => setZoom(parseFloat(e.target.value)));
  $('photo-reset').addEventListener('click', () => {
    state.photo.px = 0;
    state.photo.py = 0.08;
    setZoom(1);
  });

  let photoTimer = 0;
  const reprocess = () => {
    clearTimeout(photoTimer);
    photoTimer = setTimeout(() => {
      processPhoto();
      if (state.photo.small) setThumb($('photo-thumb'), state.photo.small, true);
      requestRender();
    }, 30);
  };
  $('photo-brightness').addEventListener('input', (e) => {
    state.photo.brightness = parseInt(e.target.value, 10);
    reprocess();
  });
  $('photo-mono').addEventListener('change', (e) => {
    state.photo.mono = e.target.checked;
    reprocess();
  });

  $('logo-size').addEventListener('input', (e) => {
    state.logo.size = parseFloat(e.target.value);
    save();
    requestRender();
  });
  $('logo-chip').addEventListener('change', (e) => {
    state.logo.chip = e.target.checked;
    save();
    requestRender();
  });
  $('logo-knockout').addEventListener('change', (e) => {
    state.logo.knockout = e.target.checked;
    processLogo();
    setThumb($('logo-thumb'), state.logo.src, false);
    requestRender();
  });
  $('logo-remove').addEventListener('click', () => {
    Object.assign(state.logo, { original: null, src: null, name: '' });
    $('logo-label').textContent = 'Upload a logo';
    setThumb($('logo-thumb'), null);
    requestRender();
  });

  $('overlay-text-y').addEventListener('input', (e) => {
    state.overlayText.y = parseInt(e.target.value, 10);
    requestRender();
  });
  $('overlay-text-color').addEventListener('input', (e) => {
    state.overlayText.color = e.target.value;
    requestRender();
  });
  $('overlay-text-show').addEventListener('change', (e) => {
    state.overlayText.show = e.target.checked;
    requestRender();
  });

  // Overlay frames carry their own text placement.
  const applyOverlayDefaults = () => {
    const f = currentFrame();
    if (!f.overlay || f.overlay.custom) return;
    const o = f.overlay;
    state.overlayText = { y: o.textY ?? 84, color: o.textColor || '#ffffff', show: o.showText !== false };
    $('overlay-text-y').value = String(state.overlayText.y);
    $('overlay-text-color').value = state.overlayText.color;
    $('overlay-text-show').checked = state.overlayText.show;
  };
  frameList.addEventListener('click', applyOverlayDefaults);

  // Themes
  const themeList = $('theme-list');
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.dataset.theme = t.id;
    b.title = t.name;
    b.setAttribute('aria-label', t.name);
    b.style.background = `conic-gradient(from 200deg, ${t.primary} 0 45%, ${t.secondary} 45% 75%, ${t.accent} 75% 100%)`;
    b.addEventListener('click', () => {
      state.themeId = t.id;
      state.colors = pickColors(t);
      syncColors();
      save();
      requestRender();
    });
    themeList.append(b);
  }
  const colorInputs = { 'c-primary': 'primary', 'c-secondary': 'secondary', 'c-accent': 'accent' };
  function syncColors() {
    for (const [id, key] of Object.entries(colorInputs)) $(id).value = state.colors[key];
    for (const b of themeList.children) b.setAttribute('aria-checked', String(b.dataset.theme === state.themeId));
  }
  for (const [id, key] of Object.entries(colorInputs)) {
    $(id).addEventListener('input', (e) => {
      state.colors[key] = e.target.value;
      state.themeId = 'custom';
      syncColors();
      save();
      requestRender();
    });
  }

  $('font-select').addEventListener('change', (e) => {
    state.font = e.target.value;
    save();
    loadFont(state.font).then(requestRender);
    requestRender();
  });

  /* ------------------------------------------------------------------ */
  /* Export                                                               */
  /* ------------------------------------------------------------------ */

  function updateExportInfo() {
    const { w, h } = size();
    $('export-info').textContent = `${w} × ${h} px · ready for LinkedIn, Instagram, X and WhatsApp`;
  }

  function fileName(ext) {
    const base = (state.text.name || 'my-frame')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base || 'my-frame'}-${state.format}.${ext}`;
  }

  function makeBlob(type) {
    renderMain();
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), type, 0.92);
      } catch (e) {
        reject(e);
      }
    });
  }

  function explain(e) {
    if (e && e.name === 'SecurityError') return 'Your browser blocks downloads for pages opened as a local file. Open it from a web server, or remove the default logo.';
    return (e && e.message) || 'Something went wrong';
  }

  $('download').addEventListener('click', async () => {
    const type = $('export-type').value;
    if (!state.photo.src && !confirm('You haven’t added a photo yet. Download anyway?')) return;
    try {
      const blob = await makeBlob('image/' + type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(type === 'jpeg' ? 'jpg' : 'png');
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Downloaded ' + a.download);
    } catch (e) {
      toast(explain(e));
    }
  });

  const shareBtn = $('share');
  try {
    const probe = new File([new Blob()], 'x.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) shareBtn.hidden = false;
  } catch {
    /* sharing files isn't supported */
  }
  shareBtn.addEventListener('click', async () => {
    try {
      const type = $('export-type').value;
      const blob = await makeBlob('image/' + type);
      const file = new File([blob], fileName(type === 'jpeg' ? 'jpg' : 'png'), { type: blob.type });
      await navigator.share({ files: [file], title: state.text.headline || CONFIG.title || 'My frame' });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast(explain(e));
    }
  });

  /* ------------------------------------------------------------------ */
  /* Misc                                                                 */
  /* ------------------------------------------------------------------ */

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          frame: state.frame,
          format: state.format,
          themeId: state.themeId,
          colors: state.colors,
          font: state.font,
          text: state.text,
          logo: { pos: state.logo.pos, size: state.logo.size, chip: state.logo.chip },
        }),
      );
    } catch {
      /* storage unavailable: settings just won't be remembered */
    }
  }

  function restore() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved) return;
    if (FORMATS[saved.format]) state.format = saved.format;
    if (typeof saved.frame === 'string') state.frame = saved.frame;
    if (FONT_WEIGHTS[saved.font]) state.font = saved.font;
    if (saved.colors && /^#/.test(saved.colors.primary || '')) {
      state.colors = Object.assign(pickColors(startTheme), saved.colors);
      state.themeId = saved.themeId || 'custom';
    }
    if (saved.text) for (const k of Object.keys(state.text)) if (typeof saved.text[k] === 'string') state.text[k] = saved.text[k];
    if (saved.logo) {
      if (/^[tb][lr]$/.test(saved.logo.pos)) state.logo.pos = saved.logo.pos;
      if (typeof saved.logo.size === 'number') state.logo.size = clamp(saved.logo.size, 0.6, 1.6);
      if (typeof saved.logo.chip === 'boolean') state.logo.chip = saved.logo.chip;
    }
  }

  function loadFont(family) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const w = FONT_WEIGHTS[family] || 800;
    return document.fonts.load(`${w} 40px "${family}"`).catch(() => {});
  }

  async function init() {
    restore();
    if (CONFIG.title) {
      document.title = CONFIG.title;
      $('studio-title').textContent = CONFIG.title;
    }
    $('font-select').value = state.font;
    $('logo-size').value = String(state.logo.size);
    $('logo-chip').checked = state.logo.chip;
    for (const [id, key] of Object.entries(textFields)) $(id).value = state.text[key];
    markLogoPos();
    syncColors();
    updateExportInfo();

    // Ready-made overlay frames from config.js.
    const overlays = Array.isArray(CONFIG.overlays) ? CONFIG.overlays : [];
    const loaded = await Promise.all(
      overlays.map((o) =>
        loadImage(o.src).then(
          (img) => Object.assign({}, o, { img }),
          () => null,
        ),
      ),
    );
    state.overlays = loaded.filter(Boolean);

    buildFramePicker();
    markFormat();
    applyOverlayDefaults();
    renderMain();

    if (CONFIG.defaultLogo) {
      loadImage(CONFIG.defaultLogo).then(
        (img) => {
          if (!state.logo.original) setLogoImage(img, 'Default logo');
        },
        () => {},
      );
    }

    await Promise.all([loadFont(state.font), loadFont(BODY), document.fonts && document.fonts.load(`600 20px "${MONO}"`).catch(() => {})]);
    requestRender();
    if (document.fonts) document.fonts.addEventListener('loadingdone', requestRender);
  }

  init();
})();
