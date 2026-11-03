// backend/services/pdfService.js
//
// Renders a tailored resume document as a clean, single-column, ATS-friendly
// PDF with pdfkit. Built-in Helvetica only (no font files, real selectable
// text), so parsers read it top-to-bottom. No LLM involved.
const PDFDocument = require('pdfkit');

const MARGIN = 54;
const INK = '#111111';
const MUTED = '#555555';

// Helvetica (WinAnsi) can't draw arbitrary Unicode. Keep Latin-1 plus the common
// typographic characters WinAnsi does have; replace anything else so a stray
// emoji or CJK character can't produce garbage glyphs.
const WINANSI_EXTRAS = new Set('‘’“”–—•…€™'.split(''));
const safe = (value) =>
  String(value == null ? '' : value)
    .replace(/[​-‍﻿]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '?') // astral code points (emoji) -> one '?', not two
    .split('')
    .map((ch) => (ch.charCodeAt(0) <= 255 || WINANSI_EXTRAS.has(ch) ? ch : '?'))
    .join('');

/**
 * @param {object} doc - a tailored document (see tailorService.normalizeTailored)
 * @returns {Promise<Buffer>}
 */
const renderResumePdf = (doc) =>
  new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: { Title: `${safe(doc.contact.name) || 'Resume'} - Resume`, Author: safe(doc.contact.name) || undefined },
    });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const width = pdf.page.width - MARGIN * 2;
    const ensureRoom = (needed) => {
      if (pdf.y + needed > pdf.page.height - MARGIN) pdf.addPage();
      pdf.x = MARGIN; // positioned text (bullets) can leave the cursor indented
    };
    const heading = (label) => {
      ensureRoom(60); // never strand a heading at the bottom of a page
      pdf.moveDown(0.8).font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(label.toUpperCase(), { characterSpacing: 0.8 });
      const y = pdf.y + 1;
      pdf.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.6).strokeColor('#999999').stroke();
      pdf.moveDown(0.4);
    };
    const bullet = (text) => {
      ensureRoom(28);
      const top = pdf.y;
      pdf.font('Helvetica').fontSize(10).fillColor(INK).text('•', MARGIN + 4, top, { width: 10, lineBreak: false });
      pdf.text(safe(text), MARGIN + 16, top, { width: width - 16, lineGap: 1.5 });
      pdf.x = MARGIN;
      pdf.moveDown(0.25);
    };

    // Header
    pdf.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(safe(doc.contact.name) || 'Your Name', MARGIN, MARGIN);
    if (doc.headline) pdf.font('Helvetica').fontSize(11).fillColor(MUTED).text(safe(doc.headline));
    const contactLine = [doc.contact.email, doc.contact.phone, doc.contact.linkedin, doc.contact.portfolio].filter(Boolean).map(safe).join('  |  ');
    if (contactLine) pdf.moveDown(0.3).font('Helvetica').fontSize(9.5).fillColor(MUTED).text(contactLine);

    if (doc.summary) {
      heading('Summary');
      pdf.font('Helvetica').fontSize(10).fillColor(INK).text(safe(doc.summary), { width, lineGap: 1.5 });
    }

    if (doc.work_experience.length) {
      heading('Experience');
      doc.work_experience.forEach((job, index) => {
        ensureRoom(48);
        if (index > 0) pdf.moveDown(0.5);
        pdf.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(safe([job.role, job.company].filter(Boolean).join(' - ')));
        if (job.duration) pdf.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(safe(job.duration));
        pdf.moveDown(0.25);
        job.bullets.forEach(bullet);
      });
    }

    if (doc.projects.length) {
      heading('Projects');
      doc.projects.forEach((p) => {
        ensureRoom(40);
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(safe(p.name), { continued: Boolean(p.technologies.length) });
        if (p.technologies.length) pdf.font('Helvetica').fillColor(MUTED).text(safe(`  (${p.technologies.join(', ')})`));
        if (p.description) pdf.font('Helvetica').fontSize(10).fillColor(INK).text(safe(p.description), { width, lineGap: 1.5 });
        pdf.moveDown(0.3);
      });
    }

    if (doc.education.length) {
      heading('Education');
      doc.education.forEach((e) => {
        ensureRoom(24);
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(safe(e.degree), { continued: true });
        pdf.font('Helvetica').fillColor(MUTED).text(safe([e.institution, e.year].filter(Boolean).length ? `  -  ${[e.institution, e.year].filter(Boolean).join(', ')}` : ''));
      });
    }

    if (doc.skills.length) {
      heading('Skills');
      pdf.font('Helvetica').fontSize(10).fillColor(INK).text(safe(doc.skills.join(', ')), { width, lineGap: 1.5 });
    }

    if (doc.certifications.length) {
      heading('Certifications');
      doc.certifications.forEach(bullet);
    }

    pdf.end();
  });

module.exports = { renderResumePdf, safe };
