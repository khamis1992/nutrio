# NutriFuel Documentation - Printing Guide

## How to Print to A4 PDF

### Option 1: Print from Browser (Recommended)

1. **Open the file:**
   - Double-click `NUTRIOFUEL_PRINT_READY.html`
   - File will open in your default web browser

2. **Open Print Dialog:**
   - Press `Ctrl + P` (Windows) or `Cmd + P` (Mac)
   - Or right-click → Print

3. **Configure Print Settings:**
   - **Destination:** Save as PDF / Microsoft Print to PDF
   - **Paper Size:** A4 (210mm × 297mm)
   - **Margins:** Default (or 15mm for best results)
   - **Scale:** 100% (default)
   - **Background Graphics:** ENABLE this checkbox (important for headers/colors)
   - **Headers and Footers:** DISABLE (document has its own)

4. **Save the PDF:**
   - Click "Save" or "Print"
   - Choose location: `NUTRIOFUEL_DOCUMENTATION.pdf`
   - Click "Save"

### Option 2: Using Command Line (Windows)

```powershell
# Open in Chrome and trigger print
start chrome NUTRIOFUEL_PRINT_READY.html
# Then press Ctrl+P and follow steps above
```

## Document Structure

The print-ready document includes:

1. **Cover Page** - Professional title page
2. **Table of Contents** - With page numbers
3. **Executive Summary** - Business overview and investment highlights
4. **Financial Analysis** - Comprehensive 300+ page analysis
5. **Action Plan** - 24-month implementation roadmap
6. **Architecture Diagrams** - System architecture in ASCII art
7. **Product Strategy** - 5-year strategic roadmap
8. **Codebase Documentation** - Complete technical documentation
9. **Technology Stack** - All dependencies and tools
10. **Architecture Details** - System design patterns
11. **Project Structure** - File organization
12. **Coding Conventions** - Style guide and patterns
13. **Testing Approach** - Testing methodology
14. **Technical Concerns** - Known issues and debt
15. **Integrations** - External services

## Print Specifications

- **Paper Size:** A4 (210mm × 297mm)
- **Margins:** 20mm top, 15mm sides, 20mm bottom
- **Font:** Times New Roman, 11pt body text
- **Page Breaks:** Automatic section breaks
- **Total Pages:** ~80-100 pages (depending on content)
- **Color:** Color (headers, tables, callouts)
- **Orientation:** Portrait

## Tips for Best Results

### For Physical Printing:
1. Use duplex printing (double-sided) to save paper
2. Choose color printing for tables and diagrams
3. Use paper weight 80-100gsm for professional quality
4. Consider binding (spiral or comb binding) for the complete document

### For Digital Distribution:
1. Save as PDF with "Background Graphics" enabled
2. Keep file size under 20MB for email sharing
3. Add a bookmark table of contents in PDF editor
4. Consider splitting into sections for easier reading

### Quick Reference Sections:
- **Executive Summary** (Pages 1-2) - For investors/stakeholders
- **Financial Analysis** (Pages 3-14) - For financial planning
- **Action Plan** (Pages 15-24) - For project management
- **Architecture** (Pages 25-34) - For technical team
- **Codebase Docs** (Pages 35-50) - For developers

## File Locations

```
C:\Users\khamis\Documents\nutrio-fuel\
├── NUTRIOFUEL_PRINT_READY.html (Source HTML file)
├── NUTRIOFUEL_DOCUMENTATION.pdf (Generate this)
├── NUTRIOFUEL_ULTIMATE_WIKI.html (Interactive web version)
└── PRINTING_GUIDE.md (This file)
```

## Troubleshooting

**Issue: Tables are cut off across pages**
- Solution: The document uses `page-break-inside: avoid` for most tables
- If still cutting off, try scaling to 95% in print dialog

**Issue: Text is too small/large**
- Solution: Adjust scale in print dialog (95% or 105%)
- For larger text, open HTML in browser and use browser zoom (Ctrl + +)

**Issue: Missing colors or backgrounds**
- Solution: Enable "Background graphics" checkbox in print settings
- This is required for table headers and callout boxes

**Issue: Page numbers not showing**
- Solution: The document doesn't have automatic page numbers
- Add them in PDF editor after printing, or use browser's print headers

**Issue: Large file size**
- Solution: Print as "Black and White" instead of color
- Or consider splitting document into sections

## Alternative: Professional PDF Generation

For publication-quality PDFs, consider using:

1. **Adobe Acrobat** - Full-featured PDF editor
2. **Nitro PDF** - PDF creation and editing
3. **PDFsam** - Split and merge PDFs
4. **Online tools:**
   - https://www.ilovepdf.com/html-to-pdf
   - https://cloudconvert.com/html-to-pdf

## Support

For issues or questions about the documentation:
- Check the original markdown files in `.planning/codebase/`
- Refer to the interactive wiki: `NUTRIOFUEL_ULTIMATE_WIKI.html`
- Contact the documentation team

---

**Document Info:**
- **Generated:** February 14, 2026
- **Version:** 1.0 (Print Ready)
- **Total Files Integrated:** 14
- **Analysis Tokens:** 494K+
- **Specialist Agents:** 6
- **Confidentiality:** CONFIDENTIAL & PROPRIETARY
