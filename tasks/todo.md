# Meals Page - Mobile Native Redesign

## Goal
Redesign `/meals` page to feel more like a native mobile app, fitting properly on mobile screen while preserving all current features.

## Current Issues
1. Greeting card ("DISCOVER / Choose Your Next Meal") wastes ~100px of vertical space on mobile
2. Search bar is in the scrollable content - scrolls away when browsing
3. Cuisine filter uses pill-shaped buttons (web-style), not circular icon style (native app style)
4. Two separate filter rows (cuisine + sort chips) take up too much space
5. Header doesn't have search integrated (not sticky)

## Features to Preserve
- Search restaurants/meals
- Cuisine type filters (All, Healthy, Vegetarian, Vegan, Keto, Protein, Low Carb, Breakfast)
- Sort chips (Top Rated, Fastest, Favorites)
- Advanced filter sheet (bottom sheet with sort, calorie range, favorites toggle)
- Favorite toggle on each restaurant/meal card
- Restaurant list cards (image, name, cuisine, rating, delivery time, meal count)
- Meal list cards (shown when calorie filter active)
- Empty state
- Skeleton loading
- Guest login prompt for non-logged-in users
- Bottom navigation bar

## Redesign Plan

### Change 1: Integrate search into sticky header
- Move the search bar from scrollable `<main>` into the sticky `<header>`
- Header will have 2 rows: title row + search row
- This keeps search always accessible while scrolling results

### Change 2: Remove greeting card
- Delete the "DISCOVER / Choose Your Next Meal" banner card
- Saves ~100px of precious mobile screen space

### Change 3: Redesign CuisineScroller to circular icons
- Change from horizontal pill buttons ? vertical stack (image circle + label)
- Use the existing cuisine images as circular badges
- More native app look (like Uber Eats, DoorDash)

### Change 4: Tighten filter chips row
- Keep the 4 filter chips (Filters, Top Rated, Fastest, Favorites) 
- Make them more compact with tighter spacing

### Change 5: Minor card polish
- Keep list cards mostly the same (already good)
- Tighten spacing slightly

## Todo Items
- [ ] 1. Update header: add search bar as second row in sticky header
- [ ] 2. Remove greeting card from main
- [ ] 3. Remove standalone search bar from main
- [ ] 4. Redesign CuisineScroller to use circular images + labels below
- [ ] 5. Adjust spacing in main (remove top padding gaps left by removed elements)
- [ ] 6. Test all filter features still work

## Review
(will be filled after implementation)
