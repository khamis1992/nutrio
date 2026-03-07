#!/usr/bin/env python3
"""
Nutrio Fuel - Restaurant Value Proposition PDF
Premium, high-end design for restaurant partners in Qatar
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import os

# Output path
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PDF = os.path.join(OUTPUT_DIR, "Nutrio_Restaurant_Value_Proposition.pdf")

# Color palette - Premium dark theme
PRIMARY = colors.HexColor("#1a1a2e")        # Deep navy
ACCENT = colors.HexColor("#e94560")          # Coral red
GOLD = colors.HexColor("#d4af37")            # Gold accent
LIGHT = colors.HexColor("#fafafa")           # Off-white
MUTED = colors.HexColor("#6b7280")           # Gray text
DARK = colors.HexColor("#0f0f1a")           # Near black

# Document setup
doc = SimpleDocTemplate(
    OUTPUT_PDF,
    pagesize=A4,
    rightMargin=50*mm,
    leftMargin=50*mm,
    topMargin=40*mm,
    bottomMargin=40*mm
)

# Custom styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Title'],
    fontSize=42,
    textColor=colors.white,
    spaceAfter=20,
    leading=48,
    fontName='Helvetica-Bold'
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading1'],
    fontSize=24,
    textColor=ACCENT,
    spaceAfter=15,
    leading=28,
    fontName='Helvetica-Bold'
)

subheading_style = ParagraphStyle(
    'CustomSubheading',
    parent=styles['Heading2'],
    fontSize=18,
    textColor=PRIMARY,
    spaceAfter=10,
    leading=22,
    fontName='Helvetica-Bold'
)

body_style = ParagraphStyle(
    'CustomBody',
    parent=styles['Normal'],
    fontSize=12,
    textColor=MUTED,
    spaceAfter=12,
    leading=18,
    alignment=TA_LEFT
)

bullet_style = ParagraphStyle(
    'BulletBody',
    parent=styles['Normal'],
    fontSize=11,
    textColor=colors.HexColor("#374151"),
    spaceAfter=8,
    leading=16,
    alignment=TA_LEFT
)

highlight_style = ParagraphStyle(
    'Highlight',
    parent=styles['Normal'],
    fontSize=14,
    textColor=colors.white,
    spaceAfter=10,
    leading=18,
    alignment=TA_LEFT
)

cta_style = ParagraphStyle(
    'CTA',
    parent=styles['Normal'],
    fontSize=16,
    textColor=colors.white,
    spaceAfter=20,
    leading=20,
    alignment=TA_CENTER
)

# Story elements
story = []

# ============================================
# PAGE 1: COVER
# ============================================

# Cover background
def create_cover_page(canvas, doc):
    canvas.saveState()
    
    # Background gradient effect - deep navy
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1)
    
    # Subtle pattern overlay
    canvas.setFillColor(colors.HexColor("#16162a"))
    for i in range(0, int(A4[0]), 40):
        for j in range(0, int(A4[1]), 40):
            canvas.circle(i, j, 1, fill=1)
    
    # Gold accent line top
    canvas.setFillColor(GOLD)
    canvas.rect(0, A4[1]-8, A4[0], 8, fill=1)
    
    # Gold accent line bottom
    canvas.rect(0, 0, A4[0], 8, fill=1)
    
    # Logo area placeholder - "NUTRIO FUEL" text
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawCentredString(A4[0]/2, A4[1]-60, "NUTRIO FUEL")
    
    canvas.restoreState()

# Title on cover
cover_title = Paragraph(
    "<b>Grow Your Restaurant</b><br/>with Healthy Meal Delivery",
    title_style
)
story.append(Spacer(1, 80*mm))
story.append(cover_title)

cover_subtitle = Paragraph(
    "Partner with Qatar's fastest-growing nutrition platform",
    ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontSize=18,
        textColor=colors.HexColor("#a0aec0"),
        spaceAfter=40,
        leading=24,
        alignment=TA_CENTER
    )
)
story.append(cover_subtitle)

# CTA Button area
cta_box = Table(
    [[Paragraph("Join 200+ Restaurant Partners", ParagraphStyle(
        'CTAText',
        parent=styles['Normal'],
        fontSize=16,
        textColor=colors.white,
        alignment=TA_CENTER
    ))]],
    colWidths=[220],
    rowHeights=[50]
)
cta_box.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), ACCENT),
    ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
    ('ROUNDEDRECT', (0, 0), (0, 0), 10),
]))

story.append(Spacer(1, 30*mm))
story.append(cta_box)

# Contact info
story.append(Spacer(1, 25*mm))
contact_text = Paragraph(
    "📧 partners@nutrio.fuel &nbsp;&nbsp;|&nbsp;&nbsp; 📱 +974 4000 4000",
    ParagraphStyle(
        'Contact',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor("#718096"),
        alignment=TA_CENTER
    )
)
story.append(contact_text)

story.append(PageBreak())


# ============================================
# PAGE 2: THE OPPORTUNITY
# ============================================

# Header bar
def create_header(canvas, doc):
    canvas.saveState()
    # Gold accent top
    canvas.setFillColor(GOLD)
    canvas.rect(0, A4[1]-6, A4[0], 6, fill=1)
    # Logo
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(50*mm, A4[1]-20, "NUTRIO FUEL")
    canvas.restoreState()

# Section title
section_title = Paragraph("The Opportunity", heading_style)
story.append(section_title)
story.append(Spacer(1, 8*mm))

# Stats row
stats_data = [
    [Paragraph("<b>Qatar's #1</b><br/>Nutrition Platform", ParagraphStyle('Stat', parent=styles['Normal'], fontSize=12, textColor=PRIMARY, alignment=TA_CENTER)),
     Paragraph("<b>50,000+</b><br/>Active Users", ParagraphStyle('Stat', parent=styles['Normal'], fontSize=12, textColor=PRIMARY, alignment=TA_CENTER)),
     Paragraph("<b>85%</b><br/>Repeat Order Rate", ParagraphStyle('Stat', parent=styles['Normal'], fontSize=12, textColor=PRIMARY, alignment=TA_CENTER)),
     Paragraph("<b>QR 2M+</b><br/>Partner Revenue", ParagraphStyle('Stat', parent=styles['Normal'], fontSize=12, textColor=PRIMARY, alignment=TA_CENTER))]
]

stats_table = Table(stats_data, colWidths=[65*mm, 65*mm, 65*mm, 65*mm])
stats_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f7fafc")),
    ('TEXTCOLOR', (0, 0), (-1, -1), PRIMARY),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 12),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
    ('ROUNDEDRECT', (0, 0), (-1, -1), 8),
]))
story.append(stats_table)

story.append(Spacer(1, 15*mm))

# Main content
opp_text = Paragraph(
    "Qatar is experiencing unprecedented demand for healthy, balanced meals. "
    "Nutrio Fuel connects health-conscious customers with premium restaurants "
    "offering nutritious options—creating a thriving ecosystem for partners.",
    body_style
)
story.append(opp_text)

story.append(Spacer(1, 10*mm))

# Key points
key_points = [
    "📈 Rapid market growth - 40% YoY increase in healthy eating",
    "🏠 Strong home delivery demand post-pandemic",
    "💪 Health-conscious professionals and families",
    "🌙 Evening and weekend ordering peaks",
    "🎯 High-value customers with disposable income"
]

for point in key_points:
    bullet = Paragraph(f"• {point}", bullet_style)
    story.append(bullet)

story.append(PageBreak())


# ============================================
# PAGE 3: WHY PARTNER WITH US
# ============================================

section_title2 = Paragraph("Why Partner With Nutrio?", heading_style)
story.append(section_title2)
story.append(Spacer(1, 8*mm))

# Benefits as cards
benefits = [
    ("🚀 Increased Revenue", "Average partner sees 25% revenue boost within 6 months. Reach thousands of new customers without marketing spend."),
    ("📊 Smart Analytics", "Real-time insights on orders, popular dishes, peak hours, and customer preferences. Data-driven decisions made easy."),
    ("🍽️ Menu Optimization", "AI-powered recommendations to optimize your menu for nutrition, profitability, and customer demand."),
    ("⚡ Fast Payments", "Weekly direct deposits to your bank. No waiting 30+ days for payments."),
    ("🎁 Marketing Support", "Featured placement, social media promotion, and seasonal campaigns at no extra cost."),
    ("👥 Dedicated Support", "Personal account manager, 24/7 support team, and partner success resources.")
]

for title, desc in benefits:
    # Card background
    card = Table(
        [[
            Paragraph(f"<b>{title}</b><br/><br/>{desc}", 
                ParagraphStyle('CardBody', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor("#1a202c"), leading=16))
        ]],
        colWidths=[155*mm]
    )
    card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.white),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.HexColor("#1a202c")),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
        ('TOPPADDING', (0, 0), (0, 0), 15),
        ('BOTTOMPADDING', (0, 0), (0, 0), 15),
        ('LEFTPADDING', (0, 0), (0, 0), 15),
        ('RIGHTPADDING', (0, 0), (0, 0), 15),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
        ('ROUNDEDRECT', (0, 0), (0, 0), 8),
    ]))
    story.append(card)
    story.append(Spacer(1, 10*mm))

story.append(PageBreak())


# ============================================
# PAGE 4: HOW IT WORKS
# ============================================

section_title3 = Paragraph("How It Works", heading_style)
story.append(section_title3)
story.append(Spacer(1, 8*mm))

# Steps
steps = [
    ("01", "Apply", "Fill out our simple partner application. We'll get back to you within 24 hours."),
    ("02", "Onboard", "Our team helps set up your menu, pricing, and delivery zones. Training provided."),
    ("03", "Launch", "Go live and start receiving orders. We'll promote your restaurant to our user base."),
    ("04", "Grow", "Monitor performance, optimize with AI insights, and scale your business.")
]

for num, title, desc in steps:
    step_row = Table(
        [[
            Paragraph(f"<b>{num}</b>", 
                ParagraphStyle('StepNum', parent=styles['Normal'], fontSize=24, textColor=ACCENT, alignment=TA_CENTER)),
            Paragraph(f"<b>{title}</b><br/>{desc}", 
                ParagraphStyle('StepDesc', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor("#1a202c"), leading=16))
        ]],
        colWidths=[25*mm, 165*mm]
    )
    step_row.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#fff5f5")),
        ('BACKGROUND', (1, 0), (1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('LEFTPADDING', (0, 0), (0, 0), 10),
        ('LEFTPADDING', (1, 0), (1, 0), 20),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('ROUNDEDRECT', (0, 0), (-1, -1), 8),
    ]))
    story.append(step_row)
    story.append(Spacer(1, 12*mm))

story.append(PageBreak())


# ============================================
# PAGE 5: PRICING & TESTIMONIALS
# ============================================

section_title4 = Paragraph("Simple, Transparent Pricing", heading_style)
story.append(section_title4)
story.append(Spacer(1, 8*mm))

# Pricing table
pricing_data = [
    ["", "Starter", "Growth", "Enterprise"],
    ["Commission", "15%", "12%", "10%"],
    ["Setup Fee", "Free", "Free", "Free"],
    ["Marketing", "Basic", "Featured", "Priority"],
    ["Analytics", "Standard", "Advanced", "Full"],
    ["Support", "Email", "Phone", "Dedicated"],
    ["", "Start Now", "Start Now", "Contact Us"]
]

pricing_table = Table(pricing_data, colWidths=[45*mm, 50*mm, 50*mm, 50*mm])
pricing_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 11),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 12),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ('BACKGROUND', (0, 1), (-1, -2), colors.white),
    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
    ('ROUNDEDRECT', (0, 0), (-1, -1), 8),
    ('BACKGROUND', (1, 1), (1, -1), colors.HexColor("#f0fff4")),
    ('BACKGROUND', (2, 1), (2, -1), colors.HexColor("#ebf8ff")),
    ('BACKGROUND', (3, 1), (3, -1), colors.HexColor("#fffaf0")),
]))
story.append(pricing_table)

story.append(Spacer(1, 20*mm))

# Testimonials
section_title5 = Paragraph("What Our Partners Say", heading_style)
story.append(section_title5)
story.append(Spacer(1, 8*mm))

testimonials = [
    ("Salwa Kitchen", "⭐⭐⭐⭐⭐", "Nutrio brought us 200+ new regular customers. The analytics helped us perfect our healthy menu."),
    ("Green Bowl Qatar", "⭐⭐⭐⭐⭐", "Best decision we made. Revenue up 40% in just 3 months. Support team is fantastic!"),
]

for name, stars, quote in testimonials:
    test_card = Table(
        [[
            Paragraph(f"<b>{name}</b>", 
                ParagraphStyle('TestName', parent=styles['Normal'], fontSize=13, textColor=PRIMARY, alignment=TA_LEFT)),
            Paragraph(stars, 
                ParagraphStyle('TestStars', parent=styles['Normal'], fontSize=12, textColor=GOLD, alignment=TA_RIGHT)),
            Paragraph(f"<i>\"{quote}\"</i>", 
                ParagraphStyle('TestQuote', parent=styles['Normal'], fontSize=11, textColor=MUTED, leading=15, alignment=TA_LEFT))
        ]],
        colWidths=[170*mm]
    )
    test_card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#f7fafc")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (0, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (0, 0), 15),
        ('RIGHTPADDING', (0, 0), (0, 0), 15),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
        ('ROUNDEDRECT', (0, 0), (0, 0), 8),
    ]))
    story.append(test_card)
    story.append(Spacer(1, 10*mm))

story.append(PageBreak())


# ============================================
# PAGE 6: CTA & CONTACT
# ============================================

# Final CTA section
cta_title = Paragraph("Ready to Grow Your Restaurant?", heading_style)
story.append(cta_title)
story.append(Spacer(1, 10*mm))

cta_text = Paragraph(
    "Join 200+ successful restaurant partners in Qatar. "
    "Take your business to the next level with Nutrio Fuel.",
    body_style
)
story.append(cta_text)

story.append(Spacer(1, 15*mm))

# Big CTA button
big_cta = Table(
    [[Paragraph("🚀 Start Your Application", 
        ParagraphStyle('BigCTA', parent=styles['Normal'], fontSize=18, textColor=colors.white, alignment=TA_CENTER))]],
    colWidths=[180*mm],
    rowHeights=[55]
)
big_cta.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), ACCENT),
    ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
    ('ROUNDEDRECT', (0, 0), (0, 0), 12),
]))
story.append(big_cta)

story.append(Spacer(1, 25*mm))

# Contact details
contact_box = Table(
    [[
        Paragraph("<b>📧 Email</b><br/>partners@nutrio.fuel", 
            ParagraphStyle('ContactDetail', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor("#1a202c"))),
        Paragraph("<b>📞 Phone</b><br/>+974 4000 4000", 
            ParagraphStyle('ContactDetail', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor("#1a202c"))),
        Paragraph("<b>🌐 Web</b><br/>partners.nutrio.fuel", 
            ParagraphStyle('ContactDetail', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor("#1a202c"))),
    ]],
    colWidths=[60*mm, 60*mm, 60*mm]
)
contact_box.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f7fafc")),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 15),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
    ('ROUNDEDRECT', (0, 0), (-1, -1), 8),
]))
story.append(contact_box)

story.append(Spacer(1, 30*mm))

# Footer note
footer = Paragraph(
    "© 2026 Nutrio Fuel. All rights reserved.<br/>"
    "Qatar | Saudi Arabia | UAE | Bahrain",
    ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=MUTED, alignment=TA_CENTER)
)
story.append(footer)

# Build PDF
doc.build(story, onFirstPage=create_cover_page, onLaterPages=create_header)

print(f"PDF created successfully: {OUTPUT_PDF}")
