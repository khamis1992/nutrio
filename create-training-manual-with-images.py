from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus.flowables import HRFlowable

# Create PDF
doc = SimpleDocTemplate(
    "C:/Users/khamis/Documents/nutrio-fuel/docs/plans/Partner-Training-Manual-with-Screenshots.pdf",
    pagesize=letter,
    rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
)

styles = getSampleStyleSheet()

# Define styles
title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=28, textColor=HexColor('#1E3A5F'), spaceAfter=15, alignment=TA_CENTER, fontName='Helvetica-Bold')
subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, textColor=HexColor('#666666'), alignment=TA_CENTER, spaceAfter=30)
h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=20, textColor=HexColor('#1E3A5F'), spaceBefore=25, spaceAfter=15, fontName='Helvetica-Bold')
h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=16, textColor=HexColor('#2E5077'), spaceBefore=20, spaceAfter=12, fontName='Helvetica-Bold')
h3_style = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=13, textColor=HexColor('#3D6A99'), spaceBefore=18, spaceAfter=10, fontName='Helvetica-Bold')
body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, spaceAfter=12, leading=18)
step_style = ParagraphStyle('Step', parent=body_style, leftIndent=25, spaceAfter=8, bulletIndent=15)
screenshot_caption = ParagraphStyle('Caption', parent=styles['Normal'], fontSize=10, textColor=HexColor('#666666'), alignment=TA_CENTER, spaceBefore=8, spaceAfter=20)
tip_box = ParagraphStyle('TipBox', parent=body_style, leftIndent=15, rightIndent=15, backColor=HexColor('#F0F9FF'), borderPadding=12, spaceBefore=15, spaceAfter=15)
warning_box = ParagraphStyle('WarningBox', parent=body_style, leftIndent=15, rightIndent=15, backColor=HexColor('#FEF3C7'), borderPadding=12, spaceBefore=15, spaceAfter=15)

screenshots_dir = "C:/Users/khamis/Documents/nutrio-fuel/docs/plans/training-screenshots"

story = []

# Cover Page
story.append(Spacer(1, 1.5*inch))
story.append(Paragraph("NUTRIO FUEL", title_style))
story.append(Paragraph("Partner Training Manual", ParagraphStyle('Subtitle2', parent=subtitle_style, fontSize=18, textColor=HexColor('#2E5077'))))
story.append(HRFlowable(width="80%", thickness=3, color=HexColor('#1E3A5F'), spaceBefore=20, spaceAfter=30, hAlign='CENTER'))
story.append(Paragraph("A Step-by-Step Visual Guide to Using Your Restaurant Dashboard", subtitle_style))
story.append(Spacer(1, 0.5*inch))

# Features box
features_data = [
    [Paragraph("<b>What's Inside:</b>", ParagraphStyle('FeatureTitle', parent=body_style, fontSize=12, alignment=TA_CENTER))],
    [Paragraph("✓ Logging into your dashboard", body_style)],
    [Paragraph("✓ Managing incoming orders", body_style)],
    [Paragraph("✓ Updating your menu", body_style)],
    [Paragraph("✓ Tracking your earnings", body_style)],
    [Paragraph("✓ Managing your profile", body_style)],
]
features_table = Table(features_data, colWidths=[5*inch])
features_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F0F9FF')),
    ('BOX', (0, 0), (-1, -1), 2, HexColor('#1E3A5F')),
    ('TOPPADDING', (0, 0), (-1, -1), 15),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(features_table)

story.append(PageBreak())

# Section 1: Getting Started
story.append(Paragraph("1. Getting Started", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("Welcome to Nutrio Fuel! This manual will guide you through using your partner dashboard to manage orders, update your menu, and grow your business with us.", body_style))

story.append(Paragraph("1.1 Logging Into Your Dashboard", h2_style))
story.append(Paragraph("To access your partner dashboard:", body_style))
story.append(Paragraph("Step 1: Open your web browser (Chrome, Safari, or Firefox)", step_style))
story.append(Paragraph("Step 2: Go to: <b>your-website.com/partner</b>", step_style))
story.append(Paragraph("Step 3: Enter your email address and password", step_style))
story.append(Paragraph("Step 4: Click the 'Sign In' button", step_style))
story.append(Paragraph("Step 5: You'll be taken to your dashboard", step_style))

# Add login screenshot
try:
    img = Image(f"{screenshots_dir}/01_partner_login.png", width=6*inch, height=3.75*inch)
    story.append(Spacer(1, 0.2*inch))
    story.append(img)
    story.append(Paragraph("Figure 1: Partner Login Page", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Login Page]", screenshot_caption))

story.append(Paragraph("<b>Pro Tip:</b> Bookmark this page on your phone or tablet for quick access during service hours. You can also save it to your home screen for one-tap access.", tip_box))

story.append(Paragraph("1.2 Dashboard Overview", h2_style))
story.append(Paragraph("Once logged in, you'll see your dashboard. This is your command center for managing everything:", body_style))

# Add dashboard screenshot
try:
    img = Image(f"{screenshots_dir}/02_partner_dashboard.png", width=6*inch, height=3.75*inch)
    story.append(img)
    story.append(Paragraph("Figure 2: Partner Dashboard Overview", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Dashboard Overview]", screenshot_caption))

story.append(Paragraph("Your dashboard shows:", body_style))
story.append(Paragraph("<b>Today's Orders:</b> Number of orders received today", step_style))
story.append(Paragraph("<b>Today's Earnings:</b> Revenue from today's orders", step_style))
story.append(Paragraph("<b>Weekly Total:</b> Your earnings this week", step_style))
story.append(Paragraph("<b>Average Rating:</b> Customer satisfaction score", step_style))
story.append(Paragraph("<b>Quick Actions:</b> Buttons for common tasks", step_style))

story.append(PageBreak())

# Section 2: Managing Orders
story.append(Paragraph("2. Managing Orders", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("This is the most important part of your dashboard. Here's how to handle orders efficiently:", body_style))

story.append(Paragraph("2.1 Viewing Orders", h2_style))
story.append(Paragraph("To see all your orders:", body_style))
story.append(Paragraph("Step 1: Click 'Orders' in the left sidebar', step_style))
story.append(Paragraph("Step 2: You'll see two tabs:", step_style))
story.append(Paragraph("   • <b>Active:</b> Orders being prepared or ready for pickup", step_style))
story.append(Paragraph("   • <b>History:</b> Completed orders from previous days", step_style))

# Add orders page screenshot
try:
    img = Image(f"{screenshots_dir}/03_orders_page.png", width=6*inch, height=3.75*inch)
    story.append(img)
    story.append(Paragraph("Figure 3: Orders Management Page", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Orders Page]", screenshot_caption))

story.append(Paragraph("2.2 Receiving and Accepting Orders", h2_style))
story.append(Paragraph("When a customer places an order:", body_style))
story.append(Paragraph("1. You'll hear a notification sound", step_style))
story.append(Paragraph("2. You'll receive a WhatsApp message", step_style))
story.append(Paragraph("3. The order appears in your 'Active' tab", step_style))
story.append(Paragraph("4. You have 5 minutes to accept it (or it auto-accepts)", step_style))

story.append(Paragraph("2.3 Updating Order Status", h3_style))
story.append(Paragraph("Keep customers informed by updating the order status:", body_style))
story.append(Paragraph("<b>Step 1:</b> Click on the order to open details", step_style))
story.append(Paragraph("<b>Step 2:</b> Click "Mark as Preparing" when you start cooking", step_style))
story.append(Paragraph("<b>Step 3:</b> Click "Mark as Ready" when food is packaged and ready", step_style))
story.append(Paragraph("<b>Step 4:</b> The driver will pick it up and mark as "Picked Up"", step_style))

story.append(Paragraph("<b>Why this matters:</b> Updating status keeps customers happy and reduces order inquiry calls.", tip_box))

story.append(Paragraph("2.4 Viewing Order Details", h3_style))
story.append(Paragraph("Click any order to see:", body_style))
story.append(Paragraph("• Customer name and phone", step_style))
story.append(Paragraph("• All items ordered with quantities", step_style))
story.append(Paragraph("• Special instructions (e.g., "no onions")", step_style))
story.append(Paragraph("• Delivery address", step_style))
story.append(Paragraph("• Order total and your payout", step_style))
story.append(Paragraph("• Preparation time remaining", step_style))

story.append(PageBreak())

# Section 3: Menu Management
story.append(Paragraph("3. Managing Your Menu", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("Your menu is what customers see. Keep it updated and appealing!", body_style))

story.append(Paragraph("3.1 Viewing Your Current Menu", h2_style))
story.append(Paragraph("To see all your menu items:", body_style))
story.append(Paragraph("Step 1: Click 'Menu' in the left sidebar', step_style))
story.append(Paragraph("Step 2: You'll see all your meals with photos and status", step_style))

# Add menu page screenshot
try:
    img = Image(f"{screenshots_dir}/04_menu_page.png", width=6*inch, height=3.75*inch)
    story.append(img)
    story.append(Paragraph("Figure 4: Menu Management Page", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Menu Page]", screenshot_caption))

story.append(Paragraph("3.2 Making Items Available/Unavailable", h3_style))
story.append(Paragraph("When you run out of an ingredient:", body_style))
story.append(Paragraph("1. Find the item in your menu", step_style))
story.append(Paragraph("2. Toggle the 'Available' switch to OFF", step_style))
story.append(Paragraph("3. The item disappears from customer view", step_style))
story.append(Paragraph("4. Toggle back ON when you have ingredients again", step_style))

story.append(Paragraph("<b>Important:</b> Always mark items unavailable immediately when out of stock to prevent cancelled orders.", warning_box))

story.append(Paragraph("3.3 Adding a New Menu Item", h3_style))
story.append(Paragraph("To add a new meal to your menu:", body_style))
story.append(Paragraph("Step 1: Click 'Add New Meal' button", step_style))
story.append(Paragraph("Step 2: Fill in the form:", step_style))
story.append(Paragraph("   • <b>Meal Name:</b> Keep it clear and appetizing", step_style))
story.append(Paragraph("   • <b>Description:</b> List main ingredients and cooking method", step_style))
story.append(Paragraph("   • <b>Calories:</b> Per serving amount", step_style))
story.append(Paragraph("   • <b>Protein/Carbs/Fat:</b> In grams", step_style))
story.append(Paragraph("   • <b>Prep Time:</b> How long to prepare", step_style))
story.append(Paragraph("   • <b>Dietary Tags:</b> Keto, Vegan, Gluten-Free, etc.", step_style))
story.append(Paragraph("   • <b>Photo:</b> Upload high-quality image", step_style))
story.append(Paragraph("Step 3: Click "Save"", step_style))

story.append(Paragraph("<b>Photo Tips:</b>", tip_box))
story.append(Paragraph("• Use natural lighting", step_style))
story.append(Paragraph("• Show the actual dish (not stock photos)", step_style))
story.append(Paragraph("• Use a clean background", step_style))
story.append(Paragraph("• Take photos from above (flat lay) or 45-degree angle", step_style))

story.append(PageBreak())

# Section 4: Earnings
story.append(Paragraph("4. Tracking Your Earnings", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("See exactly how much you're earning and when you'll be paid.", body_style))

story.append(Paragraph("4.1 Earnings Dashboard", h2_style))
story.append(Paragraph("To view your earnings:", body_style))
story.append(Paragraph("Step 1: Click 'Earnings' or 'Payouts' in the sidebar", step_style))
story.append(Paragraph("Step 2: See your earnings summary", step_style))

# Add earnings screenshot
try:
    img = Image(f"{screenshots_dir}/06_earnings_page.png", width=6*inch, height=3.75*inch)
    story.append(img)
    story.append(Paragraph("Figure 5: Earnings Dashboard", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Earnings Page]", screenshot_caption))

story.append(Paragraph("Your earnings page shows:", body_style))
story.append(Paragraph("<b>Today's Earnings:</b> What you've made today", step_style))
story.append(Paragraph("<b>This Week:</b> Earnings from Monday to today", step_style))
story.append(Paragraph("<b>This Month:</b> Monthly total", step_style))
story.append(Paragraph("<b>Total Meals Served:</b> Lifetime count", step_style))
story.append(Paragraph("<b>Average Rating:</b> Customer satisfaction", step_style))

story.append(Paragraph("4.2 Understanding Payouts", h2_style))
story.append(Paragraph("<b>When do I get paid?</b>", h3_style))
story.append(Paragraph("Every Monday! We transfer money for the previous week (Monday-Sunday).", body_style))

story.append(Paragraph("<b>How do I get paid?</b>", h3_style))
story.append(Paragraph("Automatic bank transfer to the account you provided during setup. No invoices needed - it's all automatic!", body_style))

story.append(Paragraph("<b>How much do I get per meal?</b>", h3_style))
story.append(Paragraph("Your agreed payout rate (usually 20-30 QAR per meal). This was set during your approval.", body_style))

story.append(Paragraph("4.3 Viewing Payout History", h3_style))
story.append(Paragraph("To see past payments:", body_style))
story.append(Paragraph("1. Go to Earnings page", step_style))
story.append(Paragraph("2. Click 'Payout History' tab", step_style))
story.append(Paragraph("3. See all past weekly payouts", step_style))
story.append(Paragraph("4. Click any payout to see daily breakdown", step_style))

story.append(PageBreak())

# Section 5: Profile Management
story.append(Paragraph("5. Managing Your Profile", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("Keep your restaurant information current.", body_style))

story.append(Paragraph("5.1 Profile Settings", h2_style))
story.append(Paragraph("To update your information:", body_style))
story.append(Paragraph("Step 1: Click 'Profile' in the sidebar", step_style))
story.append(Paragraph("Step 2: View and edit your information", step_style))

# Add profile screenshot
try:
    img = Image(f"{screenshots_dir}/07_profile_page.png", width=6*inch, height=3.75*inch)
    story.append(img)
    story.append(Paragraph("Figure 6: Profile Settings Page", screenshot_caption))
except:
    story.append(Paragraph("[Screenshot: Profile Page]", screenshot_caption))

story.append(Paragraph("You can update:", body_style))
story.append(Paragraph("• Restaurant name and description", step_style))
story.append(Paragraph("• Operating hours", step_style))
story.append(Paragraph("• Contact information", step_style))
story.append(Paragraph("• Logo and photos", step_style))
story.append(Paragraph("• Bank account details", step_style))
story.append(Paragraph("• Daily capacity limits", step_style))

story.append(Paragraph("5.2 Setting Your Daily Capacity", h3_style))
story.append(Paragraph("Control how many orders you accept per day:", body_style))
story.append(Paragraph("1. Go to Profile", step_style))
story.append(Paragraph("2. Find 'Daily Capacity' setting", step_style))
story.append(Paragraph("3. Enter your maximum meals per day (e.g., 20)", step_style))
story.append(Paragraph("4. Save changes", step_style))

story.append(Paragraph("<b>What happens:</b> Once you hit this number, you stop receiving orders for the day. This prevents overwhelming your kitchen.", tip_box))

story.append(Paragraph("5.3 Pausing Orders", h3_style))
story.append(Paragraph("Need a break? Temporary pause:", body_style))
story.append(Paragraph("1. Go to Profile", step_style))
story.append(Paragraph("2. Toggle 'Accepting Orders' to OFF", step_style))
story.append(Paragraph("3. Customers won't see your restaurant", step_style))
story.append(Paragraph("4. Toggle back ON when ready", step_style))

story.append(PageBreak())

# Section 6: Best Practices
story.append(Paragraph("6. Best Practices for Success", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("Follow these tips to maximize your success on Nutrio Fuel:", body_style))

story.append(Paragraph("✓ <b>Update Status Promptly</b>", h2_style))
story.append(Paragraph("Always mark orders as 'Preparing' and 'Ready' as soon as possible. Customers love knowing their food status, and it improves your ratings.", body_style))

story.append(Paragraph("✓ <b>Maintain Quality</b>", h2_style))
story.append(Paragraph("Every meal represents your brand. Use the same quality ingredients and presentation you would serve dine-in customers. Good ratings equals more orders.", body_style))

story.append(Paragraph("✓ <b>Keep Menu Updated</b>", h2_style))
story.append(Paragraph("Mark items unavailable immediately when out of stock. Update photos seasonally. Remove poorly performing items.", body_style))

story.append(Paragraph("✓ <b>Respond to Issues Fast</b>", h2_style))
story.append(Paragraph("If you have a delay or problem, tell us immediately via WhatsApp. We can communicate with the customer and manage expectations. Never ignore problems!", body_style))

story.append(Paragraph("✓ <b>Monitor Your Dashboard</b>", h2_style))
story.append(Paragraph("Check your earnings and ratings weekly. Look for patterns - which items sell best? What times are busiest? Use this data to improve.", body_style))

story.append(Paragraph("✓ <b>Use Good Photos</b>", h2_style))
story.append(Paragraph("Restaurants with professional photos get 40% more orders. Take photos in good lighting, show the actual dish, and update them seasonally.", body_style))

story.append(PageBreak())

# Section 7: Getting Help
story.append(Paragraph("7. Getting Help", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("We're here to support you! Contact us anytime:", body_style))

help_data = [
    [Paragraph("<b>Support Channel</b>", body_style), Paragraph("<b>When to Use</b>", body_style), Paragraph("<b>Response Time</b>", body_style)],
    [Paragraph("WhatsApp", body_style), Paragraph("Quick questions, urgent issues", body_style), Paragraph("< 15 minutes", body_style)],
    [Paragraph("Email", body_style), Paragraph("Non-urgent issues, detailed questions", body_style), Paragraph("< 4 hours", body_style)],
    [Paragraph("Dashboard Chat", body_style), Paragraph("While using the dashboard", body_style), Paragraph("< 30 minutes", body_style)],
]
help_table = Table(help_data, colWidths=[1.5*inch, 3*inch, 1.5*inch])
help_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1E3A5F')),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#CCCCCC')),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))
story.append(help_table)

story.append(Spacer(1, 0.3*inch))

story.append(Paragraph("<b>Contact Information:</b>", h2_style))
story.append(Paragraph("📱 WhatsApp: [Your WhatsApp Number]", step_style))
story.append(Paragraph("📧 Email: [Your Support Email]", step_style))
story.append(Paragraph("⏰ Hours: 8 AM - 10 PM, 7 days a week", step_style))

story.append(Paragraph("<b>Common Issues & Quick Solutions:</b>", h2_style))
story.append(Paragraph("<b>Problem:</b> Can't log in", step_style))
story.append(Paragraph("<b>Solution:</b> Click 'Forgot Password' on login page", step_style))
story.append(Paragraph("<b>Problem:</b> Photo won't upload", step_style))
story.append(Paragraph("<b>Solution:</b> Check file size (max 5MB), use JPG format", step_style))
story.append(Paragraph("<b>Problem:</b> Order not showing", step_style))
story.append(Paragraph("<b>Solution:</b> Refresh page, check internet connection", step_style))
story.append(Paragraph("<b>Problem:</b> Payment not received", step_style))
story.append(Paragraph("<b>Solution:</b> Check bank details in profile, contact support", step_style))

story.append(PageBreak())

# Final Section
story.append(Paragraph("Congratulations!", h1_style))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#1E3A5F'), spaceBefore=0, spaceAfter=20))

story.append(Paragraph("You now know everything you need to successfully use your Nutrio Fuel partner dashboard. Remember:", body_style))

story.append(Spacer(1, 0.1*inch))
final_box = [
    [Paragraph("<b>Key Takeaways:</b>", ParagraphStyle('FinalTitle', parent=body_style, fontSize=12, alignment=TA_CENTER))],
    [Paragraph("1. Check your dashboard daily", body_style)],
    [Paragraph("2. Update order statuses promptly", body_style)],
    [Paragraph("3. Keep your menu accurate and appealing", body_style)],
    [Paragraph("4. Monitor your earnings weekly", body_style)],
    [Paragraph("5. Contact us anytime you need help", body_style)],
]
final_table = Table(final_box, colWidths=[5.5*inch])
final_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F0FDF4')),
    ('BOX', (0, 0), (-1, -1), 2, HexColor('#22C55E')),
    ('TOPPADDING', (0, 0), (-1, -1), 20),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
]))
story.append(final_table)

story.append(Spacer(1, 0.3*inch))
story.append(Paragraph("Welcome to the Nutrio Fuel family! We're excited to help you grow your business and reach more customers. Here's to your success! 🚀", ParagraphStyle('Closing', parent=body_style, fontSize=12, textColor=HexColor('#2E5077'), alignment=TA_CENTER)))

story.append(Spacer(1, 0.5*inch))
story.append(HRFlowable(width="60%", thickness=1, color=HexColor('#CCCCCC'), spaceBefore=20, spaceAfter=20, hAlign='CENTER'))
story.append(Paragraph("Version 1.0 | For questions, contact us anytime", ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=HexColor('#666666'), alignment=TA_CENTER)))

# Build PDF
doc.build(story)
print("Partner Training Manual with Screenshots created successfully!")
print(f"File saved: docs/plans/Partner-Training-Manual-with-Screenshots.pdf")
