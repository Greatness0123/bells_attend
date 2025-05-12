// exportHelpers.ts
import jsPDF from 'jspdf';

export function convertToXML(data: any[]) {
  let xml = '<?xml version="1.0"?><students>';
  data.forEach(d => {
    xml += `<student><name>${d.name}</name><email>${d.email}</email></student>`;
  });
  xml += '</students>';
  return xml;
}

export async function exportToPDF(data: any[]) {
  const doc = new jsPDF();
  data.forEach((d, i) => {
    doc.text(`${i + 1}. ${d.name} (${d.email})`, 10, 10 + i * 10);
  });
  return doc.output('datauristring');
}
