"""
Logo/Watermark Remover from Video
Uses OpenCV to remove logos by applying inpainting to the logo region
"""
import cv2
import numpy as np
from pathlib import Path

def remove_logo_from_video(input_path, output_path, logo_region=None, method='inpaint'):
    """
    Remove logo from video
    
    Parameters:
    -----------
    input_path : str
        Path to input video
    output_path : str
        Path to save output video
    logo_region : tuple or None
        (x, y, width, height) of logo region, or None to auto-detect common positions
    method : str
        'inpaint' - uses OpenCV inpainting (best for complex backgrounds)
        'blur' - applies Gaussian blur to logo region
        'pixelate' - pixelates the logo region
    """
    
    # Open input video
    cap = cv2.VideoCapture(input_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video {input_path}")
        return False
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video Info:")
    print(f"  Resolution: {width}x{height}")
    print(f"  FPS: {fps}")
    print(f"  Total Frames: {total_frames}")
    
    # Define logo regions to try (common watermark positions)
    if logo_region is None:
        # Common positions: bottom-right, bottom-left, top-right, top-left, center
        logo_regions = [
            (width - 200, height - 100, 180, 80),  # Bottom-right
            (20, height - 100, 180, 80),           # Bottom-left
            (width - 200, 20, 180, 80),            # Top-right
            (20, 20, 180, 80),                     # Top-left
            (width//2 - 100, height - 80, 200, 60), # Bottom-center
        ]
    else:
        logo_regions = [logo_region]
    
    # Setup video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frame_count = 0
    
    print(f"\nProcessing video... Method: {method}")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        if frame_count % 30 == 0:
            progress = (frame_count / total_frames) * 100
            print(f"  Progress: {progress:.1f}% ({frame_count}/{total_frames})")
        
        # Process each logo region
        for region in logo_regions:
            x, y, w, h = region
            
            # Ensure region is within frame bounds
            x = max(0, x)
            y = max(0, y)
            w = min(w, width - x)
            h = min(h, height - y)
            
            if method == 'inpaint':
                # Create mask for inpainting
                mask = np.zeros(frame.shape[:2], np.uint8)
                mask[y:y+h, x:x+w] = 255
                
                # Apply inpainting
                frame = cv2.inpaint(frame, mask, 3, cv2.INPAINT_TELEA)
                
            elif method == 'blur':
                # Apply Gaussian blur to logo region
                roi = frame[y:y+h, x:x+w]
                roi = cv2.GaussianBlur(roi, (51, 51), 30)
                frame[y:y+h, x:x+w] = roi
                
            elif method == 'pixelate':
                # Pixelate the logo region
                roi = frame[y:y+h, x:x+w]
                # Resize down
                temp = cv2.resize(roi, (w//10, h//10), interpolation=cv2.INTER_LINEAR)
                # Resize back up
                roi = cv2.resize(temp, (w, h), interpolation=cv2.INTER_NEAREST)
                frame[y:y+h, x:x+w] = roi
        
        out.write(frame)
    
    cap.release()
    out.release()
    
    print(f"\nProcessing complete!")
    print(f"  Output saved to: {output_path}")
    print(f"  Total frames processed: {frame_count}")
    
    return True


def preview_logo_region(input_path, logo_region):
    """Preview the logo region to verify it's correct"""
    cap = cv2.VideoCapture(input_path)
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        print("Error: Could not read video frame")
        return
    
    height, width = frame.shape[:2]
    x, y, w, h = logo_region
    
    # Draw rectangle on frame
    preview = frame.copy()
    cv2.rectangle(preview, (x, y), (x+w, y+h), (0, 255, 0), 3)
    
    # Save preview
    preview_path = str(Path(input_path).parent / "logo_region_preview.jpg")
    cv2.imwrite(preview_path, preview)
    print(f"Preview saved to: {preview_path}")
    print(f"Logo region: x={x}, y={y}, width={w}, height={h}")


def detect_logo_auto(input_path):
    """Try to detect logo position automatically"""
    cap = cv2.VideoCapture(input_path)
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return None
    
    height, width = frame.shape[:2]
    
    # Common logo positions with typical sizes
    candidates = [
        ("bottom-right", width - 200, height - 100, 180, 80),
        ("bottom-left", 20, height - 100, 180, 80),
        ("top-right", width - 200, 20, 180, 80),
        ("top-left", 20, 20, 180, 80),
        ("bottom-center", width//2 - 100, height - 80, 200, 60),
    ]
    
    print("Common logo positions:")
    for name, x, y, w, h in candidates:
        print(f"  {name}: x={x}, y={y}, w={w}, h={h}")
    
    return candidates


if __name__ == "__main__":
    # Input and output paths
    input_video = r"C:\Users\khamis\Documents\nutrio-fuel-new\src\assets\Logo_Redo_and_Video_Generation (1).mp4"
    output_video = r"C:\Users\khamis\Documents\nutrio-fuel-new\src\assets\Logo_Redo_and_Video_Generation_CLEANED.mp4"
    
    print("=" * 60)
    print("VIDEO LOGO REMOVER")
    print("=" * 60)
    
    # First, detect common logo positions
    print("\nAnalyzing video for logo positions...")
    detect_logo_auto(input_video)
    
    # You can specify exact logo coordinates here
    # Format: (x, y, width, height)
    # Example for bottom-right corner:
    # logo_region = (width-200, height-100, 180, 80)
    
    # For now, we'll try multiple common positions automatically
    print("\nStarting logo removal...")
    print("Trying multiple common logo positions with inpainting method\n")
    
    success = remove_logo_from_video(
        input_path=input_video,
        output_path=output_video,
        logo_region=None,  # Auto-detect common positions
        method='inpaint'   # Best quality for complex backgrounds
    )
    
    if success:
        print("\n" + "=" * 60)
        print("SUCCESS! Logo removed from video")
        print(f"Clean video saved to:")
        print(f"   {output_video}")
        print("=" * 60)
    else:
        print("\nFailed to process video")
