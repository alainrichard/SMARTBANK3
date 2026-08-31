// Report export utilities
export async function exportToExcel(data: any[], filename: string, sheetName = 'Report') {
  const XLSX = (await import('xlsx')).default;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // Auto-size columns
  const cols = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
  ws['!cols'] = cols;
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(title: string, columns: string[], rows: any[][], filename: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  // Header
  doc.setFillColor(10, 15, 30);
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('SmartBank AI', 14, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 22);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.width - 80, 22);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 36,
    headStyles: { fillColor: [10, 15, 30], textColor: [201, 168, 76], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount} — SmartBank AI — Kigali, Rwanda`, 14, doc.internal.pageSize.height - 8);
  }
  doc.save(`${filename}.pdf`);
}

export async function exportToWord(title: string, content: any[], filename: string) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = await import('docx');

  const headerPara = new Paragraph({
    children: [new TextRun({ text: 'SmartBank AI', bold: true, size: 32, color: 'C9A84C' })],
    heading: HeadingLevel.TITLE,
  });
  const titlePara = new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 24, color: '0A0F1E' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  });
  const datePara = new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 16, color: '7B88A8' })],
    spacing: { after: 400 },
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [headerPara, titlePara, datePara, ...content],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.docx`; a.click();
  URL.revokeObjectURL(url);
}
