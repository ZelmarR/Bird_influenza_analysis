# Bird Counting Document v2 - Required Corrections

This document lists all corrections needed for `bird_counting_v2.docx`. Changes are organized by section with exact text to copy-paste.

---

## TABLE OF CONTENTS
1. [Formatting Issues](#1-formatting-issues)
2. [Technical Corrections - Overview Section](#2-technical-corrections---overview-section)
3. [Technical Corrections - ROI Section](#3-technical-corrections---roi-section)
4. [Technical Corrections - Appearance-Based Filtering](#4-technical-corrections---appearance-based-filtering)
5. [Technical Corrections - Motion-Based Discrimination](#5-technical-corrections---motion-based-discrimination)
6. [Technical Corrections - Temporal Confirmation](#6-technical-corrections---temporal-confirmation)
7. [Results Section Corrections](#7-results-section-corrections)
8. [Discussion Section Corrections](#8-discussion-section-corrections)

---

## 1. FORMATTING ISSUES

### 1.1 Typo: "Srategies" → "Strategies"

**Location:** After "Fig 1" caption, there is a section header

**Current Text:**
```
Srategies:
```

**Change To:**
```
Strategies:
```

---

### 1.2 Inconsistent Figure Numbering

**Issue:** Figure references are inconsistent (Fig 1, Fig1, Fig 4, Fig2)

**Locations & Fixes:**

| Current | Should Be | Location Context |
|---------|-----------|------------------|
| `Fig 1)` | `(Fig. 1)` | After "...decision criteria applied at each stage are indicated" |
| `Fig1).` | `(Fig. 1).` | After "...rather than ground objects" |
| `Fig1 motion-based` | `Fig. 1, motion-based` | In Effects of Motion-Based section |
| `Fig 4Location` | `Fig. 4. Location` | Missing space and period |
| `Fig2)` | `(Fig. 2)` | In Location-Specific section |

**Recommended Standard Format:** Use `Fig. X` with period after "Fig" and proper spacing.

---

### 1.3 Inconsistent Location Naming

**Issue:** Document uses Location A, B, C, and E inconsistently

**Current Usage:**
- Results section: Location A, Location B
- Discussion section: Location C, Location E

**Fix:** Standardize to either A/B or keep all consistent. If A/B are the two locations, replace:
- "Location C" → "Location A"
- "Location E" → "Location B"

**Locations to fix in DISCUSSION:**

**Current:**
```
Location C exhibited higher overall counts...
```
**Change To:**
```
Location A exhibited higher overall counts...
```

**Current:**
```
At Location B, which exhibited lower baseline background motion...Location E...
```
**Change To:**
```
At Location B, which exhibited lower baseline background motion...
```

**Current:**
```
...particularly at Location E where intermittent cloud motion...
```
**Change To:**
```
...particularly at Location B where intermittent cloud motion...
```

---

### 1.4 Missing Figure References

**Issue:** Fig. 2 and Fig. 3 are referenced but captions are missing or unclear

**Add proper captions for:**
- Fig. 2 - Detection outputs comparison
- Fig. 3 - Temporal patterns (if exists)
- Fig. 4 - Location-specific variability

---

### 1.5 Table Formatting Issue

**Issue:** Table 1 data appears run together without proper column separation

**Current (appears as):**
```
StrategyVideoFrames (N)FPFNTPPrecisionRecall (SE)F1Fixed-threshold...
```

**Ensure proper table formatting in Word with clear column headers:**
| Strategy | Video | Frames (N) | FP | FN | TP | Precision | Recall (SE) | F1 |

---

## 2. TECHNICAL CORRECTIONS - OVERVIEW SECTION

### 2.1 Add Explicit Notebook Mapping

**Location:** In "Overview of Evaluated Detection Strategies" section, AFTER the paragraph:
> "Four design strategies were assessed..."

**ADD THIS NEW PARAGRAPH:**

```
Three Python-based Jupyter notebooks were developed to implement and evaluate these detection strategies:

1. **video_counter_sky_background.ipynb** - Implements fixed ROI boundaries with enhanced sky-background HSV filtering, optical flow-based motion discrimination, and cloud rejection using texture analysis. Uses FRAME_SKIP=2 to process every second frame.

2. **video_counter_frame_percent.ipynb** - Implements a fixed frame coverage percentage approach (60% of frame height) with adaptive thresholding, background subtraction using MOG2, and simplified motion detection via frame differencing. Uses FRAME_SKIP=1 with RESIZE_FACTOR=0.9.

3. **video_counter_auto_threshold.ipynb** - Implements dynamic ROI adjustment using Sobel-based horizon detection that automatically adapts the analysis region to scene changes (e.g., vehicles entering frame). Combines sky-background filtering with optical flow analysis. Uses FRAME_SKIP=1 with automatic ROI updates every 12 frames.

Each notebook represents a distinct detection configuration, enabling comparative evaluation of parameter choices and filtering strategies under field conditions.
```

---

## 3. TECHNICAL CORRECTIONS - ROI SECTION

### 3.1 Update ROI Parameters Description

**Location:** In "Region of Interest (ROI) Processing" section

**Current Text:**
```
The default configuration processes only a restricted portion of the frame – 50% of the entire frame (ROI_TOP_PERCENTAGE = 0, ROI_BOTTOM_PERCENTAGE = 50)
```

**Change To:**
```
The default configuration varies by implementation strategy:
- **video_counter_sky_background**: Fixed ROI processing the top 50% of the frame (ROI_TOP_PERCENTAGE = 0, ROI_BOTTOM_PERCENTAGE = 50)
- **video_counter_frame_percent**: Fixed frame coverage of 60% (FRAME_COVERAGE_PERCENTAGE = 0.6)
- **video_counter_auto_threshold**: Dynamic ROI with initial bottom boundary at 60% (INITIAL_ROI_BOTTOM_PERCENTAGE = 60), automatically adjusted based on scene analysis
```

---

### 3.2 Add Dynamic ROI Algorithm Description

**Location:** AFTER the ROI section paragraph ending with "...improving downstream precision without any penalty in sensitivity for bird detections out of the sky region."

**ADD THIS NEW PARAGRAPH:**

```
**Dynamic ROI Adjustment (video_counter_auto_threshold)**

The dynamic ROI strategy automatically adjusts the analysis region based on scene content to handle situations where ground-level objects (such as vehicles or equipment) temporarily enter the frame. The implementation uses the following approach:

1. **Horizon Detection**: A Sobel operator (ksize=5) is applied to a heavily blurred frame (21×21 Gaussian kernel) to detect horizontal edges. The vertical projection (row-wise sum of edge magnitudes) is computed to identify the horizon line.

2. **Boundary Calculation**: The algorithm identifies the peak edge density (typically corresponding to ground features) and searches upward until edge density drops below the 10th percentile threshold, indicating the sky-ground boundary.

3. **Temporal Smoothing**: To prevent abrupt ROI changes, a smoothing factor of 0.5 is applied:
   ```
   smoothed_roi = current_roi × 0.5 + new_roi × 0.5
   ```

4. **Update Frequency**: ROI boundaries are recalculated every 12 frames (ROI_UPDATE_INTERVAL = 12) and clamped to the range 20%–95% of frame height.

This adaptive approach maintains detection sensitivity in the sky region while automatically excluding transient ground-level interference.
```

---

## 4. TECHNICAL CORRECTIONS - APPEARANCE-BASED FILTERING

### 4.1 Update Pre-processing Parameters

**Location:** In "Appearance-Based Filtering" section

**Current Text:**
```
Before thresholding, the image is resized with a scale factor of 0.8 for efficiency, converted to grayscale, and filtered with a 5×5 Gaussian kernel to reduce sensor noise. The adaptive thresholding is done using a Gaussian-weighted kernel for the block size of 11 and the constant offset of 2.
```

**Change To:**
```
Before thresholding, the image is resized for efficiency and filtered with a Gaussian kernel to reduce sensor noise. Parameters vary by implementation:

| Parameter | sky_background | frame_percent | auto_threshold |
|-----------|----------------|---------------|----------------|
| Resize Factor | 0.8 | 0.9 | 0.8 |
| Gaussian Kernel | 5×5 | 3×3 | 5×5 |
| Adaptive Threshold Block Size | 11 | 15 | 11 |
| Constant Offset | 2 | 2 | 2 |

The adaptive thresholding uses a Gaussian-weighted kernel, selecting the optimal binarization threshold for each pixel neighborhood to handle spatially varying illumination.
```

---

### 4.2 Update Contour Area Thresholds

**Location:** In "Appearance-Based Filtering" section, after contour extraction description

**Current Text (if exists, or ADD if missing):**

**ADD/MODIFY:**
```
Contour area thresholds for candidate filtering vary by implementation to accommodate different resize factors and detection sensitivities:

| Parameter | sky_background | frame_percent | auto_threshold |
|-----------|----------------|---------------|----------------|
| MIN_BIRD_AREA | 15 | 10 | 15 |
| MAX_BIRD_AREA | 800 | 1000 | 800 |
| MIN_ASPECT_RATIO | 0.4 | 0.3 | 0.4 |
| MAX_ASPECT_RATIO | 3.0 | 4.0 | 3.0 |
```

---

## 5. TECHNICAL CORRECTIONS - MOTION-BASED DISCRIMINATION

### 5.1 Update Motion Parameters

**Location:** In "Motion-Based Discrimination Using Optical Flow" section

**Current Text:**
```
The motion pixel count requires at least 5 pixels showing motion above a pixel-level threshold of 25 (MIN_MOTION_PIXELS, MOTION_THRESHOLD).
```

**Change To:**
```
Motion detection parameters vary by implementation strategy:

| Parameter | sky_background | frame_percent | auto_threshold |
|-----------|----------------|---------------|----------------|
| MOTION_THRESHOLD | 25 | 30 | 10 |
| MIN_MOTION_PIXELS | 5 | N/A* | 5 |
| MIN_BIRD_SPEED | 3 | N/A* | 3 |
| MAX_BIRD_SPEED | 100 | N/A* | 100 |

*frame_percent uses simplified frame differencing with mean motion score rather than optical flow parameters.

The sky_background and auto_threshold implementations use Farneback optical flow for detailed motion analysis, while frame_percent uses computationally lighter frame differencing suitable for faster processing.
```

---

### 5.2 Update Frame Skip Parameter

**Location:** In Methods section or Motion-Based section

**ADD/MODIFY:**
```
Frame processing rate varies by implementation to balance detection accuracy against computational efficiency and double-counting prevention:

| Implementation | FRAME_SKIP | Effect |
|----------------|------------|--------|
| sky_background | 2 | Processes every 2nd frame |
| frame_percent | 1 | Processes every frame |
| auto_threshold | 1 | Processes every frame |

The sky_background implementation uses FRAME_SKIP=2 to reduce double-counting of the same bird across consecutive frames, while other implementations rely on tracking-based deduplication.
```

---

## 6. TECHNICAL CORRECTIONS - TEMPORAL CONFIRMATION

### 6.1 Update Tracking Parameters

**Location:** In "Temporal Confirmation Through Flight Pattern Recognition and Tracking" section

**Current Text:**
```
An object is confirmed as a flying bird when it meets four criteria: it has been tracked for at least 3 consecutive frames (MIN_FLIGHT_DURATION)
```

**Change To:**
```
An object is confirmed as a flying bird when it meets persistence and movement criteria. Parameter values vary by implementation:

| Parameter | sky_background | frame_percent | auto_threshold |
|-----------|----------------|---------------|----------------|
| MIN_FLIGHT_DURATION | 3 frames | 5 frames* | 3 frames |
| MIN_MOVEMENT_DISTANCE | 15 pixels | 25 pixels† | 15 pixels |
| MAX_STATIONARY_FRAMES | 10 | 20* | 10 |
| MAX_MATCHING_DISTANCE | 80 pixels | 100 pixels | 80 pixels |

*frame_percent uses min_flight_duration=8 which is adjusted to 5 based on FRAME_SKIP
†frame_percent adjusts movement distance based on RESIZE_FACTOR (25 × 0.9 ≈ 22.5 pixels)
```

---

## 7. RESULTS SECTION CORRECTIONS

### 7.1 Clarify Strategy-to-Notebook Mapping in Table 1

**Location:** Before or after Table 1

**ADD THIS CLARIFICATION:**
```
Table 1 presents detection performance for three filtering strategies evaluated using the corresponding notebook implementations:
- "Fixed-threshold (frame-based)" corresponds to baseline thresholding in video_counter_frame_percent
- "Sky + background filtering" corresponds to video_counter_sky_background
- "Adaptive threshold" corresponds to video_counter_auto_threshold with dynamic ROI

All strategies were evaluated following application of ROI filtering appropriate to each implementation.
```

---

### 7.2 Fix Incomplete Sentence

**Location:** In "Performance of Appearance-Based Detection Strategies" section

**Current Text:**
```
Sky background filtering generally yielded higher precision values across both locations (precision range: 35% to 83%), indicating fewer false detections relative to manual image counts. , reflecting missed detections under variable lighting and background conditions.
```

**Change To:**
```
Sky background filtering generally yielded higher precision values across both locations (precision range: 35% to 83%), indicating fewer false detections relative to manual image counts. However, this came at the cost of reduced recall in some conditions, reflecting missed detections under variable lighting and background conditions.
```

---

## 8. DISCUSSION SECTION CORRECTIONS

### 8.1 Fix Location References

**Location:** Discussion section, multiple instances

**Change 1:**
```
Current: "Location C exhibited higher overall counts"
Change to: "Location A exhibited higher overall counts"
```

**Change 2:**
```
Current: "particularly at Location E where intermittent cloud motion"
Change to: "particularly at Location B where intermittent cloud motion"
```

**Change 3:**
```
Current: "than Location E"
Change to: "than Location B"
```

---

## 9. SUMMARY CHECKLIST

### Formatting Fixes:
- [ ] Fix "Srategies" → "Strategies" typo
- [ ] Standardize figure numbering (Fig. 1, Fig. 2, etc.)
- [ ] Fix location naming consistency (A/B throughout)
- [ ] Ensure Table 1 has proper column formatting
- [ ] Add missing figure captions

### Technical Fixes:
- [ ] Add notebook mapping paragraph in Overview section
- [ ] Update ROI parameters to show per-notebook values
- [ ] Add Dynamic ROI algorithm description
- [ ] Update pre-processing parameters table
- [ ] Add contour area thresholds table
- [ ] Update motion parameters table
- [ ] Add FRAME_SKIP explanation table
- [ ] Update temporal confirmation parameters table
- [ ] Add strategy-to-notebook mapping for Table 1
- [ ] Fix incomplete sentence in Results

### Content Consistency:
- [ ] Verify all parameter values match notebook code
- [ ] Ensure location references are consistent
- [ ] Check all figure references exist and are numbered correctly

---

## 10. QUICK REFERENCE - PARAMETER VALUES FROM NOTEBOOKS

### video_counter_sky_background.ipynb
```python
FRAME_SKIP = 2
RESIZE_FACTOR = 0.8
ROI_TOP_PERCENTAGE = 0
ROI_BOTTOM_PERCENTAGE = 50
MIN_BIRD_AREA = 15
MAX_BIRD_AREA = 800
MIN_ASPECT_RATIO = 0.4
MAX_ASPECT_RATIO = 3.0
MOTION_THRESHOLD = 25
MIN_MOTION_PIXELS = 5
MAX_STATIONARY_FRAMES = 10
MIN_MOVEMENT_DISTANCE = 15
MIN_FLIGHT_DURATION = 3
MAX_MATCHING_DISTANCE = 80
CLOUD_TEXTURE_THRESHOLD = 20
MIN_BIRD_SOLIDITY = 0.6
MIN_BIRD_SPEED = 3
MAX_BIRD_SPEED = 100
DIRECTIONAL_CHANGE_THRESHOLD = 0.7
TEXTURE_NEIGHBORHOOD = 7
Gaussian Kernel = (5,5)
Adaptive Threshold Block Size = 11
```

### video_counter_frame_percent.ipynb
```python
FRAME_COVERAGE_PERCENTAGE = 0.6
FRAME_SKIP = 1
RESIZE_FACTOR = 0.9
motion_threshold = 30
MIN_BIRD_AREA = 10 (implicit)
MAX_BIRD_AREA = 1000 (implicit)
MIN_ASPECT_RATIO = 0.3
MAX_ASPECT_RATIO = 4.0
max_stationary_frames = 20
min_movement_distance = 25
min_flight_duration = 5 (adjusted from 8)
MAX_MATCHING_DISTANCE = 100
Gaussian Kernel = (3,3)
Adaptive Threshold Block Size = 15
```

### video_counter_auto_threshold.ipynb
```python
FRAME_SKIP = 1
RESIZE_FACTOR = 0.8
ROI_UPDATE_INTERVAL = 12
ROI_SMOOTHING_FACTOR = 0.5
INITIAL_ROI_BOTTOM_PERCENTAGE = 60
ROI_TOP_PERCENTAGE = 0
MIN_BIRD_AREA = 15
MAX_BIRD_AREA = 800
MIN_ASPECT_RATIO = 0.4
MAX_ASPECT_RATIO = 3.0
MOTION_THRESHOLD = 10
MIN_MOTION_PIXELS = 5
MAX_STATIONARY_FRAMES = 10
MIN_MOVEMENT_DISTANCE = 15
MIN_FLIGHT_DURATION = 3
MAX_MATCHING_DISTANCE = 80
CLOUD_TEXTURE_THRESHOLD = 20
MIN_BIRD_SOLIDITY = 0.6
MIN_BIRD_SPEED = 3
MAX_BIRD_SPEED = 100
DIRECTIONAL_CHANGE_THRESHOLD = 0.7
TEXTURE_NEIGHBORHOOD = 7
Gaussian Kernel = (5,5)
Adaptive Threshold Block Size = 11

# Unique to this notebook:
analyze_and_set_roi() function for dynamic ROI
Sobel operator with ksize=5
Gaussian blur (21,21) for horizon detection
```

---

*Document generated for bird_counting_v2.docx corrections*
*Based on analysis of: video_counter_auto_threshold.ipynb, video_counter_frame_percent.ipynb, video_counter_sky_background.ipynb*
