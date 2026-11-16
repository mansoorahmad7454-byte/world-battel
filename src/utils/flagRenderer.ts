const bitmapCache = new Map<string, HTMLCanvasElement>();
const rectBitmapCache = new Map<string, HTMLCanvasElement>();
const dataUrlCache = new Map<string, string>();

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points = 5,
  rotation = -Math.PI / 2,
  color = '#FFFFFF'
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawUnionJack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#012169';
  ctx.fillRect(x, y, w, h);

  // White diagonals
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = h * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();

  // Red diagonals
  ctx.strokeStyle = '#C8102E';
  ctx.lineWidth = h * 0.1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();

  // White cross
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w * 0.4, y, w * 0.2, h);
  ctx.fillRect(x, y + h * 0.36, w, h * 0.28);

  // Red cross
  ctx.fillStyle = '#C8102E';
  ctx.fillRect(x + w * 0.44, y, w * 0.12, h);
  ctx.fillRect(x, y + h * 0.42, w, h * 0.16);

  ctx.restore();
}

function hStripes(ctx: CanvasRenderingContext2D, s: number, colors: string[], weights?: number[]) {
  const total = weights ? weights.reduce((a, b) => a + b, 0) : colors.length;
  let y = 0;
  for (let i = 0; i < colors.length; i++) {
    const h = (s * (weights ? weights[i] : 1)) / total;
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, y, s, h + 0.6);
    y += h;
  }
}

function vStripes(ctx: CanvasRenderingContext2D, s: number, colors: string[], weights?: number[]) {
  const total = weights ? weights.reduce((a, b) => a + b, 0) : colors.length;
  let x = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = (s * (weights ? weights[i] : 1)) / total;
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, 0, w + 0.6, s);
    x += w;
  }
}

function drawCrescent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  offsetX: number,
  bgColor: string,
  fgColor = '#FFFFFF'
) {
  ctx.fillStyle = fgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx + offsetX, cy, rInner, 0, Math.PI * 2);
  ctx.fill();
}

function drawNordic(
  ctx: CanvasRenderingContext2D,
  s: number,
  bg: string,
  cross: string,
  innerCross?: string
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  const cx = s * 0.38;
  const cy = s * 0.5;
  const thick = s * 0.22;
  ctx.fillStyle = cross;
  ctx.fillRect(cx - thick / 2, 0, thick, s);
  ctx.fillRect(0, cy - thick / 2, s, thick);
  if (innerCross) {
    const t2 = s * 0.11;
    ctx.fillStyle = innerCross;
    ctx.fillRect(cx - t2 / 2, 0, t2, s);
    ctx.fillRect(0, cy - t2 / 2, s, t2);
  }
}

function renderFlagArtwork(ctx: CanvasRenderingContext2D, code: string, s: number) {
  switch (code) {
    case 'TH':
      hStripes(ctx, s, ['#A51931', '#F4F5F8', '#2D2A4A', '#F4F5F8', '#A51931'], [1, 1, 2, 1, 1]);
      break;
    case 'TR':
      ctx.fillStyle = '#E30A17';
      ctx.fillRect(0, 0, s, s);
      drawCrescent(ctx, s * 0.43, s * 0.5, s * 0.23, s * 0.185, s * 0.06, '#E30A17', '#FFFFFF');
      drawStar(ctx, s * 0.65, s * 0.5, s * 0.095, s * 0.038, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'FR':
      vStripes(ctx, s, ['#0055A4', '#FFFFFF', '#EF4135']);
      break;
    case 'DE':
      hStripes(ctx, s, ['#141414', '#DD0000', '#FFCE00']);
      break;
    case 'CN':
      ctx.fillStyle = '#DE2910';
      ctx.fillRect(0, 0, s, s);
      drawStar(ctx, s * 0.28, s * 0.34, s * 0.14, s * 0.055, 5, -Math.PI / 2, '#FFDE00');
      drawStar(ctx, s * 0.48, s * 0.2, s * 0.045, s * 0.018, 5, 0, '#FFDE00');
      drawStar(ctx, s * 0.54, s * 0.3, s * 0.045, s * 0.018, 5, 0.3, '#FFDE00');
      drawStar(ctx, s * 0.54, s * 0.43, s * 0.045, s * 0.018, 5, 0, '#FFDE00');
      drawStar(ctx, s * 0.47, s * 0.53, s * 0.045, s * 0.018, 5, 0.2, '#FFDE00');
      break;
    case 'CO':
      hStripes(ctx, s, ['#FCD116', '#003893', '#CE1126'], [2, 1, 1]);
      break;
    case 'IN':
      hStripes(ctx, s, ['#FF9933', '#FFFFFF', '#138808']);
      ctx.strokeStyle = '#000080';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000080';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'AR':
      hStripes(ctx, s, ['#74ACDF', '#FFFFFF', '#74ACDF']);
      ctx.fillStyle = '#F6B40E';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ES':
      hStripes(ctx, s, ['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]);
      ctx.fillStyle = '#AA151B';
      ctx.fillRect(s * 0.25, s * 0.38, s * 0.14, s * 0.24);
      ctx.fillStyle = '#F1BF00';
      ctx.fillRect(s * 0.28, s * 0.42, s * 0.08, s * 0.14);
      break;
    case 'SG':
      hStripes(ctx, s, ['#EF3340', '#FFFFFF']);
      drawCrescent(ctx, s * 0.32, s * 0.27, s * 0.14, s * 0.125, s * 0.045, '#EF3340', '#FFFFFF');
      drawStar(ctx, s * 0.45, s * 0.19, s * 0.035, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.53, s * 0.25, s * 0.035, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.5, s * 0.34, s * 0.035, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.4, s * 0.34, s * 0.035, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.37, s * 0.25, s * 0.035, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'DK':
      drawNordic(ctx, s, '#C60C30', '#FFFFFF');
      break;
    case 'ZA':
      ctx.fillStyle = '#007749';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#E03C31';
      ctx.fillRect(0, 0, s, s * 0.36);
      ctx.fillStyle = '#001489';
      ctx.fillRect(0, s * 0.64, s, s * 0.36);
      // White Y border
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.48, s * 0.38);
      ctx.lineTo(s, s * 0.38);
      ctx.lineTo(s, s * 0.62);
      ctx.lineTo(s * 0.48, s * 0.62);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      // Green Y
      ctx.fillStyle = '#007749';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.08);
      ctx.lineTo(s * 0.46, s * 0.43);
      ctx.lineTo(s, s * 0.43);
      ctx.lineTo(s, s * 0.57);
      ctx.lineTo(s * 0.46, s * 0.57);
      ctx.lineTo(0, s * 0.92);
      ctx.closePath();
      ctx.fill();
      // Gold triangle + Black
      ctx.fillStyle = '#FFB81C';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.14);
      ctx.lineTo(s * 0.36, s * 0.5);
      ctx.lineTo(0, s * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.22);
      ctx.lineTo(s * 0.28, s * 0.5);
      ctx.lineTo(0, s * 0.78);
      ctx.closePath();
      ctx.fill();
      break;
    case 'NG':
      vStripes(ctx, s, ['#008751', '#FFFFFF', '#008751']);
      break;
    case 'UA':
      hStripes(ctx, s, ['#0057B7', '#FFD700']);
      break;
    case 'ID':
      hStripes(ctx, s, ['#CE1126', '#FFFFFF']);
      break;
    case 'MX':
      vStripes(ctx, s, ['#006847', '#FFFFFF', '#CE1126']);
      ctx.fillStyle = '#8B5A2B';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.085, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'PE':
      vStripes(ctx, s, ['#D91023', '#FFFFFF', '#D91023']);
      ctx.fillStyle = '#C8A200';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.085, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'RU':
      hStripes(ctx, s, ['#FFFFFF', '#0039A6', '#D52B1E']);
      break;
    case 'BD':
      ctx.fillStyle = '#006A4E';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#F42A41';
      ctx.beginPath();
      ctx.arc(s * 0.45, s * 0.5, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'EG':
      hStripes(ctx, s, ['#CE1126', '#FFFFFF', '#111111']);
      ctx.fillStyle = '#C09300';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.075, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'CU':
      hStripes(ctx, s, ['#002A8F', '#FFFFFF', '#002A8F', '#FFFFFF', '#002A8F']);
      ctx.fillStyle = '#CF142B';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.52, s * 0.5);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      drawStar(ctx, s * 0.22, s * 0.5, s * 0.1, s * 0.04, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'GR':
      hStripes(
        ctx,
        s,
        ['#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF']
      );
      ctx.fillStyle = '#0D5EAF';
      ctx.fillRect(0, 0, s * 0.52, s * 0.56);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s * 0.21, 0, s * 0.1, s * 0.56);
      ctx.fillRect(0, s * 0.23, s * 0.52, s * 0.1);
      break;
    case 'IT':
      vStripes(ctx, s, ['#009246', '#FFFFFF', '#CE2B37']);
      break;
    case 'SE':
      drawNordic(ctx, s, '#006AA7', '#FECC00');
      break;
    case 'NL':
      hStripes(ctx, s, ['#AE1C28', '#FFFFFF', '#21468B']);
      break;
    case 'KR':
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, s, s);
      // Taegeuk
      ctx.save();
      ctx.translate(s * 0.5, s * 0.5);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = '#CD2E3A';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#0047A0';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#CD2E3A';
      ctx.beginPath();
      ctx.arc(-s * 0.1, 0, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0047A0';
      ctx.beginPath();
      ctx.arc(s * 0.1, 0, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Trigrams
      ctx.fillStyle = '#111111';
      ctx.fillRect(s * 0.15, s * 0.22, s * 0.14, s * 0.05);
      ctx.fillRect(s * 0.71, s * 0.22, s * 0.14, s * 0.05);
      ctx.fillRect(s * 0.15, s * 0.73, s * 0.14, s * 0.05);
      ctx.fillRect(s * 0.71, s * 0.73, s * 0.14, s * 0.05);
      break;
    case 'US':
      hStripes(
        ctx,
        s,
        ['#B22234', '#FFFFFF', '#B22234', '#FFFFFF', '#B22234', '#FFFFFF', '#B22234', '#FFFFFF', '#B22234', '#FFFFFF', '#B22234']
      );
      ctx.fillStyle = '#3C3B6E';
      ctx.fillRect(0, 0, s * 0.52, s * 0.54);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          drawStar(ctx, s * (0.1 + c * 0.11), s * (0.12 + r * 0.15), s * 0.032, s * 0.014, 5, -Math.PI / 2, '#FFFFFF');
        }
      }
      break;
    case 'AU':
      ctx.fillStyle = '#00008B';
      ctx.fillRect(0, 0, s, s);
      drawUnionJack(ctx, 0, 0, s * 0.54, s * 0.5);
      drawStar(ctx, s * 0.28, s * 0.72, s * 0.09, s * 0.04, 7, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.76, s * 0.3, s * 0.055, s * 0.025, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.82, s * 0.55, s * 0.055, s * 0.025, 5, -Math.PI / 2, '#FFFFFF');
      drawStar(ctx, s * 0.68, s * 0.74, s * 0.055, s * 0.025, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'CL':
      hStripes(ctx, s, ['#FFFFFF', '#D52B1E']);
      ctx.fillStyle = '#0039A6';
      ctx.fillRect(0, 0, s * 0.5, s * 0.5);
      drawStar(ctx, s * 0.28, s * 0.28, s * 0.1, s * 0.04, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'PK':
      vStripes(ctx, s, ['#FFFFFF', '#01411C'], [1, 3]);
      drawCrescent(ctx, s * 0.62, s * 0.5, s * 0.22, s * 0.18, s * 0.06, '#01411C', '#FFFFFF');
      drawStar(ctx, s * 0.74, s * 0.4, s * 0.075, s * 0.03, 5, -Math.PI / 2, '#FFFFFF');
      break;
    case 'RO':
      vStripes(ctx, s, ['#002B7F', '#FCD116', '#CE1126']);
      break;
    case 'IR':
      hStripes(ctx, s, ['#239F40', '#FFFFFF', '#DA0000']);
      ctx.fillStyle = '#DA0000';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.075, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'IL':
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#0038B8';
      ctx.fillRect(0, s * 0.16, s, s * 0.14);
      ctx.fillRect(0, s * 0.7, s, s * 0.14);
      ctx.strokeStyle = '#0038B8';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.35);
      ctx.lineTo(s * 0.63, s * 0.58);
      ctx.lineTo(s * 0.37, s * 0.58);
      ctx.closePath();
      ctx.moveTo(s * 0.5, s * 0.65);
      ctx.lineTo(s * 0.63, s * 0.42);
      ctx.lineTo(s * 0.37, s * 0.42);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'PS':
      hStripes(ctx, s, ['#141414', '#FFFFFF', '#007A3D']);
      ctx.fillStyle = '#CE1126';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.48, s * 0.5);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'MY':
      hStripes(ctx, s, ['#CC0001', '#FFFFFF', '#CC0001', '#FFFFFF', '#CC0001', '#FFFFFF', '#CC0001', '#FFFFFF', '#CC0001']);
      ctx.fillStyle = '#010066';
      ctx.fillRect(0, 0, s * 0.54, s * 0.55);
      drawCrescent(ctx, s * 0.25, s * 0.28, s * 0.13, s * 0.11, s * 0.04, '#010066', '#FFCC00');
      drawStar(ctx, s * 0.39, s * 0.28, s * 0.085, s * 0.035, 8, -Math.PI / 2, '#FFCC00');
      break;
    case 'CH':
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s * 0.41, s * 0.2, s * 0.18, s * 0.6);
      ctx.fillRect(s * 0.2, s * 0.41, s * 0.6, s * 0.18);
      break;
    case 'BN':
      ctx.fillStyle = '#F7E017';
      ctx.fillRect(0, 0, s, s);
      ctx.save();
      ctx.translate(s * 0.5, s * 0.5);
      ctx.rotate(0.45);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-s, -s * 0.16, s * 2, s * 0.16);
      ctx.fillStyle = '#111111';
      ctx.fillRect(-s, 0, s * 2, s * 0.16);
      ctx.restore();
      ctx.fillStyle = '#CF1126';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'GB':
      drawUnionJack(ctx, 0, 0, s, s);
      break;
    case 'SA':
      ctx.fillStyle = '#006C35';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s * 0.22, s * 0.36, s * 0.56, s * 0.12);
      ctx.fillRect(s * 0.24, s * 0.58, s * 0.52, s * 0.055);
      break;
    case 'NO':
      drawNordic(ctx, s, '#BA0C2F', '#FFFFFF', '#00205B');
      break;
    case 'MA':
      ctx.fillStyle = '#C1272D';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#006233';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
        const x = s * 0.5 + Math.cos(a) * s * 0.22;
        const y = s * 0.5 + Math.sin(a) * s * 0.22;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    case 'PT':
      vStripes(ctx, s, ['#006600', '#FF0000'], [2, 3]);
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.arc(s * 0.4, s * 0.5, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s * 0.34, s * 0.43, s * 0.12, s * 0.14);
      break;
    case 'PL':
      hStripes(ctx, s, ['#FFFFFF', '#DC143C']);
      break;
    case 'NZ':
      ctx.fillStyle = '#00247D';
      ctx.fillRect(0, 0, s, s);
      drawUnionJack(ctx, 0, 0, s * 0.54, s * 0.5);
      drawStar(ctx, s * 0.74, s * 0.26, s * 0.06, s * 0.025, 5, -Math.PI / 2, '#CC142B');
      drawStar(ctx, s * 0.84, s * 0.48, s * 0.06, s * 0.025, 5, -Math.PI / 2, '#CC142B');
      drawStar(ctx, s * 0.66, s * 0.52, s * 0.06, s * 0.025, 5, -Math.PI / 2, '#CC142B');
      drawStar(ctx, s * 0.74, s * 0.74, s * 0.07, s * 0.03, 5, -Math.PI / 2, '#CC142B');
      break;
    case 'JP':
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#BC002D';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'VN':
      ctx.fillStyle = '#DA251D';
      ctx.fillRect(0, 0, s, s);
      drawStar(ctx, s * 0.5, s * 0.5, s * 0.24, s * 0.095, 5, -Math.PI / 2, '#FFFF00');
      break;
    case 'PH':
      hStripes(ctx, s, ['#0038A8', '#CE1126']);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.52, s * 0.5);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FCD116';
      ctx.beginPath();
      ctx.arc(s * 0.2, s * 0.5, s * 0.095, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'BR':
      ctx.fillStyle = '#009C3B';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#FFDF00';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.14);
      ctx.lineTo(s * 0.88, s * 0.5);
      ctx.lineTo(s * 0.5, s * 0.86);
      ctx.lineTo(s * 0.12, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#002776';
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.5, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(s * 0.33, s * 0.47);
      ctx.lineTo(s * 0.67, s * 0.54);
      ctx.stroke();
      break;
    case 'CA':
      vStripes(ctx, s, ['#FF0000', '#FFFFFF', '#FF0000'], [1, 2, 1]);
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.24);
      ctx.lineTo(s * 0.57, s * 0.44);
      ctx.lineTo(s * 0.72, s * 0.42);
      ctx.lineTo(s * 0.6, s * 0.56);
      ctx.lineTo(s * 0.65, s * 0.72);
      ctx.lineTo(s * 0.52, s * 0.65);
      ctx.lineTo(s * 0.52, s * 0.78);
      ctx.lineTo(s * 0.48, s * 0.78);
      ctx.lineTo(s * 0.48, s * 0.65);
      ctx.lineTo(s * 0.35, s * 0.72);
      ctx.lineTo(s * 0.4, s * 0.56);
      ctx.lineTo(s * 0.28, s * 0.42);
      ctx.lineTo(s * 0.43, s * 0.44);
      ctx.closePath();
      ctx.fill();
      break;
    case 'AE':
      hStripes(ctx, s, ['#00732F', '#FFFFFF', '#111111']);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, s * 0.3, s);
      break;
    case 'BE':
      vStripes(ctx, s, ['#141414', '#FAE042', '#ED2939']);
      break;
    case 'FI':
      drawNordic(ctx, s, '#FFFFFF', '#003580');
      break;
    case 'AT':
      hStripes(ctx, s, ['#ED2939', '#FFFFFF', '#ED2939']);
      break;
    case 'IE':
      vStripes(ctx, s, ['#169B62', '#FFFFFF', '#FF883E']);
      break;
    case 'HU':
      hStripes(ctx, s, ['#CD2A3E', '#FFFFFF', '#436F4D']);
      break;
    case 'CZ':
      hStripes(ctx, s, ['#FFFFFF', '#D7141A']);
      ctx.fillStyle = '#11457E';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'UA2':
      hStripes(ctx, s, ['#FFFFFF', '#0038A8', '#FFFFFF', '#0038A8', '#FFFFFF', '#0038A8', '#FFFFFF']);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, s * 0.45, s * 0.45);
      ctx.fillStyle = '#FCD116';
      ctx.beginPath();
      ctx.arc(s * 0.25, s * 0.25, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'QA':
      ctx.fillStyle = '#8D1B3D';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.35, 0);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(s * 0.42, s * ((i + 0.5) / 6));
        ctx.lineTo(s * 0.35, s * ((i + 1) / 6));
      }
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'KZ':
      ctx.fillStyle = '#00AFCA';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#FEC50C';
      ctx.beginPath();
      ctx.arc(s * 0.52, s * 0.45, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(s * 0.12, s * 0.15, s * 0.08, s * 0.7);
      break;
    case 'KE':
      hStripes(ctx, s, ['#141414', '#FFFFFF', '#BB0000', '#FFFFFF', '#006600'], [3, 0.7, 3, 0.7, 3]);
      ctx.fillStyle = '#BB0000';
      ctx.beginPath();
      ctx.ellipse(s * 0.5, s * 0.5, s * 0.11, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'GH':
      hStripes(ctx, s, ['#CE1126', '#FCD116', '#006B3F']);
      drawStar(ctx, s * 0.5, s * 0.5, s * 0.12, s * 0.05, 5, -Math.PI / 2, '#111111');
      break;
    case 'JM':
      ctx.fillStyle = '#009B3A';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.lineTo(s, s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FED100';
      ctx.lineWidth = s * 0.13;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s, s);
      ctx.moveTo(s, 0);
      ctx.lineTo(0, s);
      ctx.stroke();
      break;
    case 'HR':
      hStripes(ctx, s, ['#FF0000', '#FFFFFF', '#171796']);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(s * 0.4, s * 0.34, s * 0.2, s * 0.26);
      break;
    case 'LK':
      ctx.fillStyle = '#FFBE29';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#00534E';
      ctx.fillRect(s * 0.08, s * 0.12, s * 0.14, s * 0.76);
      ctx.fillStyle = '#EB7400';
      ctx.fillRect(s * 0.22, s * 0.12, s * 0.14, s * 0.76);
      ctx.fillStyle = '#8D153A';
      ctx.fillRect(s * 0.38, s * 0.12, s * 0.54, s * 0.76);
      break;
    case 'TZ':
      ctx.fillStyle = '#1EB53A';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#00A3DD';
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s, s);
      ctx.lineTo(0, s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FCD116';
      ctx.lineWidth = s * 0.26;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.lineTo(s, 0);
      ctx.stroke();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.lineTo(s, 0);
      ctx.stroke();
      break;
    default:
      hStripes(ctx, s, ['#3B82F6', '#FFFFFF', '#EF4444']);
  }
}

export function getFlagBitmap(code: string): HTMLCanvasElement {
  const cached = bitmapCache.get(code);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  renderFlagArtwork(ctx, code, size);
  ctx.restore();

  // Subtle rim for clean contrast against dark arena
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;
  ctx.stroke();

  bitmapCache.set(code, canvas);
  return canvas;
}

export function getRectFlagBitmap(code: string): HTMLCanvasElement {
  const cached = rectBitmapCache.get(code);
  if (cached) return cached;

  const w = 120;
  const h = 80;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.scale(w / 128, h / 128);
  renderFlagArtwork(ctx, code, 128);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  rectBitmapCache.set(code, canvas);
  return canvas;
}

export function getFlagDataUrl(code: string): string {
  const cached = dataUrlCache.get(code);
  if (cached) return cached;
  const bmp = getFlagBitmap(code);
  const url = bmp.toDataURL('image/png');
  dataUrlCache.set(code, url);
  return url;
}
