interface PdfTableOptions {
  title: string;
  period: string;
  generatedBy: string;
  generatedAt?: Date;
  summary: string[];
  headers: string[];
  rows: string[][];
  widths: number[];
  logoSvg?: string;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsv(headers: string[], rows: unknown[][]) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  return Buffer.from(`\uFEFF${content}`, 'utf8');
}

function pdfSafe(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function fitText(value: string, width: number, fontSize: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const maxCharacters = Math.max(1, Math.floor((width - 10) / (fontSize * 0.5)));
  if (normalized.length <= maxCharacters) return normalized;
  if (maxCharacters <= 3) return normalized.slice(0, maxCharacters);
  return `${normalized.slice(0, maxCharacters - 3)}...`;
}

function textCommand(value: string, x: number, y: number, font: 'F1' | 'F2', size: number) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfSafe(value)}) Tj ET`;
}

function rightTextCommand(value: string, right: number, y: number, font: 'F1' | 'F2', size: number) {
  const estimatedWidth = value.length * size * 0.51;
  return textCommand(value, Math.max(420, right - estimatedWidth), y, font, size);
}

function hexColor(value: string) {
  const color = value.replace('#', '');
  return [0, 2, 4]
    .map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255)
    .map((channel) => channel.toFixed(3))
    .join(' ');
}

function svgPathCommands(path: string) {
  const tokens = path.match(/[MCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const commands: string[] = [];
  let index = 0;
  let command = '';
  let firstMove = true;

  while (index < tokens.length) {
    if (/^[MCZ]$/i.test(tokens[index])) {
      command = tokens[index].toUpperCase();
      index += 1;
      if (command === 'Z') {
        commands.push('h');
        continue;
      }
      if (command === 'M') firstMove = true;
    }
    if (command === 'M' && index + 1 < tokens.length) {
      commands.push(`${tokens[index]} ${tokens[index + 1]} ${firstMove ? 'm' : 'l'}`);
      firstMove = false;
      index += 2;
      continue;
    }
    if (command === 'C' && index + 5 < tokens.length) {
      commands.push(`${tokens.slice(index, index + 6).join(' ')} c`);
      index += 6;
      continue;
    }
    index += 1;
  }
  return commands.join('\n');
}

function logoCommands(svg: string | undefined, x: number, y: number, size: number) {
  if (!svg) {
    return [
      `q ${hexColor('#060644')} rg ${x} ${y} ${size} ${size} re f Q`,
      `q 1 1 1 rg ${textCommand('LK', x + 8, y + 13, 'F1', 10)} Q`,
    ].join('\n');
  }

  const scale = size / 522;
  const commands = [`q ${scale} 0 0 ${-scale} ${x} ${y + size} cm`];
  for (const match of svg.matchAll(/<path\b([^>]*)\/?\s*>/gi)) {
    const attributes = match[1];
    const path = attributes.match(/\bd="([^"]+)"/i)?.[1];
    const fill = attributes.match(/\bfill="([^"]+)"/i)?.[1] ?? '#000000';
    const transform = attributes.match(/\btransform="translate\(([-\d.]+)[ ,]+([-\d.]+)\)"/i);
    if (!path) continue;
    commands.push('q');
    if (transform) commands.push(`1 0 0 1 ${transform[1]} ${transform[2]} cm`);
    commands.push(`${hexColor(fill)} rg`, svgPathCommands(path), 'f', 'Q');
  }
  commands.push('Q');
  return commands.join('\n');
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    timeZoneName: 'short',
  }).format(value);
}

function buildPdfObjects(pageContents: string[]) {
  const pageObjectIds = pageContents.map((_, index) => 5 + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageContents.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  pageContents.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

export function createTablePdf(options: PdfTableOptions) {
  if (options.headers.length !== options.widths.length) {
    throw new Error('Jumlah header dan lebar kolom laporan tidak sesuai.');
  }
  const generatedAt = options.generatedAt ?? new Date();
  const pageSize = 17;
  const pages: string[][][] = [];
  if (options.rows.length === 0) {
    pages.push([]);
  } else {
    for (let index = 0; index < options.rows.length; index += pageSize) {
      pages.push(options.rows.slice(index, index + pageSize));
    }
  }

  const left = 36;
  const tableTop = 410;
  const headerHeight = 24;
  const rowHeight = 20;
  const tableWidth = options.widths.reduce((total, width) => total + width, 0);
  const contents = pages.map((pageRows, pageIndex) => {
    const commands: string[] = [
      logoCommands(options.logoSvg, left, 521, 38),
      textCommand('LaKarya', 84, 548, 'F1', 15),
      textCommand('Layanan Karyawan Terpadu', 84, 533, 'F2', 8),
      rightTextCommand(options.title, 806, 548, 'F1', 15),
      rightTextCommand(options.period, 806, 533, 'F2', 9),
      `q ${hexColor('#060644')} RG 0.8 w ${left} 511 m 806 511 l S Q`,
      textCommand(`Diekspor oleh ${options.generatedBy}`, left, 493, 'F2', 8),
      `q ${hexColor('#f5f7f9')} rg ${hexColor('#d5dbe2')} RG 0.5 w ${left} 430 ${tableWidth} 54 re B Q`,
      textCommand('Ringkasan Laporan', left + 12, 469, 'F1', 8.5),
    ];
    options.summary.forEach((summary, index) => {
      commands.push(textCommand(summary, left + 12, 455 - index * 11, 'F2', 8));
    });

    commands.push(`q ${hexColor('#060644')} rg ${left} ${tableTop - headerHeight} ${tableWidth} ${headerHeight} re f Q`);
    let columnX = left;
    options.headers.forEach((header, index) => {
      commands.push(
        `q 1 1 1 rg`,
        textCommand(fitText(header, options.widths[index], 7.5), columnX + 5, tableTop - 15.5, 'F1', 7.5),
        'Q',
      );
      columnX += options.widths[index];
    });

    pageRows.forEach((row, rowIndex) => {
      const rowTop = tableTop - headerHeight - rowIndex * rowHeight;
      const rowBottom = rowTop - rowHeight;
      if (rowIndex % 2 === 1) {
        commands.push(`q ${hexColor('#f5f7f9')} rg ${left} ${rowBottom} ${tableWidth} ${rowHeight} re f Q`);
      }
      let cellX = left;
      row.forEach((cell, columnIndex) => {
        commands.push(textCommand(fitText(cell, options.widths[columnIndex], 7.2), cellX + 5, rowBottom + 7, 'F2', 7.2));
        cellX += options.widths[columnIndex];
      });
    });

    const tableBottom = tableTop - headerHeight - pageRows.length * rowHeight;
    commands.push(`q ${hexColor('#d5dbe2')} RG 0.45 w`);
    for (let rowIndex = 0; rowIndex <= pageRows.length; rowIndex += 1) {
      const y = tableTop - headerHeight - rowIndex * rowHeight;
      commands.push(`${left} ${y} m ${left + tableWidth} ${y} l S`);
    }
    columnX = left;
    options.widths.forEach((width, index) => {
      commands.push(`${columnX} ${tableTop} m ${columnX} ${tableBottom} l S`);
      columnX += width;
      if (index === options.widths.length - 1) commands.push(`${columnX} ${tableTop} m ${columnX} ${tableBottom} l S`);
    });
    commands.push(`${left} ${tableTop} m ${left + tableWidth} ${tableTop} l S Q`);

    if (pageRows.length === 0) {
      commands.push(textCommand('Tidak ada data yang memenuhi kriteria laporan pada periode ini.', left + 12, tableTop - 54, 'F2', 9));
    }

    commands.push(
      `q ${hexColor('#d5dbe2')} RG 0.5 w ${left} 44 m 806 44 l S Q`,
      textCommand(`Digenerate oleh sistem LaKarya pada tanggal ${formatGeneratedAt(generatedAt)}`, left, 27, 'F2', 7.5),
      textCommand(`Halaman ${pageIndex + 1} dari ${pages.length}`, 716, 27, 'F2', 7.5),
    );
    return commands.join('\n');
  });

  return buildPdfObjects(contents);
}
