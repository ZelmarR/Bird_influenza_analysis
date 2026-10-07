import cv2
import json
import numpy as np
import math
import logging
import os
import time

log = logging.getLogger("bird_counter")

# ── Processing efficiency ──────────────────────────────────────────────────────
FRAME_SKIP                       = 1     # process every frame — tiny distant birds appear briefly
RESIZE_FACTOR                    = 1.0   # no downscale — preserves single-pixel distant birds

# ── Appearance filter ──────────────────────────────────────────────────────────
MIN_BIRD_AREA                    = 0      # 1px dots (very distant) pass
MAX_BIRD_AREA                    = 80000  # large nearby birds (e.g. 300×250px) pass
MIN_ASPECT_RATIO                 = 0.08   # elongated distant shapes allowed
MAX_ASPECT_RATIO                 = 12.0
MIN_BIRD_SOLIDITY                = 0.1    # tiny blobs have unreliable solidity

# Adaptive threshold — two-pass: small block for distant dots, larger for close birds
ADAPTIVE_BLOCK_SIZE              = 5      # fine-grained; catches 1-3px blobs
ADAPTIVE_C                       = 2
ADAPTIVE_BLOCK_SIZE_LARGE        = 21     # coarser; merges fragmented large-bird contours
ADAPTIVE_C_LARGE                 = 4

# ── Bird colour filter ────────────────────────────────────────────────────────
# Birds are dark (grey/black) silhouettes. The contrast check pad scales with
# blob size so large birds aren't self-cancelling.
BIRD_MAX_BLOB_VALUE              = 200   # raised — large birds have feather highlights
BIRD_MIN_CONTRAST                = 15    # reduced — large birds fill more of the sky patch
# Minimum blob side-length (px) above which we use the large-block threshold pass
LARGE_BIRD_MIN_SIDE              = 20

# ── Cloud rejection ────────────────────────────────────────────────────────────
CLOUD_TEXTURE_THRESHOLD          = 18    # avg std-dev of local intensity
CLOUD_EDGE_DENSITY_THRESHOLD     = 0.04  # fraction of edge pixels
CLOUD_COLOR_UNIFORMITY_THRESHOLD = 22    # std-dev of HSV saturation
TEXTURE_NEIGHBORHOOD             = 7

# ── Motion (optical flow) ──────────────────────────────────────────────────────
MOTION_THRESHOLD                 = 2     # very low — catches 1px shift between frames
MIN_MOTION_PIXELS                = 1
# Farneback params tuned for tiny/distant targets
_FB_PYR_SCALE                    = 0.5
_FB_LEVELS                       = 5     # more pyramid levels → catches slow distant birds
_FB_WIN_SIZE                     = 7     # small window → fine-grained local motion
_FB_ITERATIONS                   = 3
_FB_POLY_N                       = 5
_FB_POLY_SIGMA                   = 1.1
MIN_BIRD_SPEED                   = 0.1   # near-zero: distant birds barely move in px/frame
MAX_BIRD_SPEED                   = 300
# Birds change direction; clouds drift uniformly
DIRECTIONAL_CHANGE_THRESHOLD     = 0.90  # relaxed — allow more uniform movers (distant birds)

# ── Background subtraction ─────────────────────────────────────────────────────
# MOG2 background subtractor catches any pixel-level movement in the sky.
_MOG2_HISTORY                    = 300
_MOG2_VAR_THRESHOLD              = 25    # higher = less sensitive, avoids static texture noise
_MOG2_DETECT_SHADOWS             = False # shadow pixels would inflate counts

# ── ROI — hard sky zone: top 60% of frame (= above 40% from ground) ───────────
ROI_UPDATE_INTERVAL              = 10    # frames between horizon recalculations
ROI_SMOOTHING_FACTOR             = 0.5   # blend weight for new ROI estimate
INITIAL_ROI_BOTTOM_PERCENTAGE   = 60    # start at 60% from top
ROI_MIN_PCT                      = 20.0
ROI_MAX_PCT                      = 60.0  # never detect below 40% from ground

# ── Temporal confirmation (tracker) ───────────────────────────────────────────
MIN_MOVEMENT_DISTANCE            = 8     # total px moved across track — filters static objects
MIN_FLIGHT_DURATION              = 4     # frames of consistent motion required
MAX_MATCHING_DISTANCE            = 60    # px; large nearby birds move fast between frames
MAX_MATCHING_DISTANCE_CONFIRMED  = 120   # wider re-match for confirmed birds that briefly disappear
MAX_STATIONARY_FRAMES            = 5     # drop unconfirmed tracks quickly
MAX_STATIONARY_FRAMES_CONFIRMED  = 20


# ── Helpers ────────────────────────────────────────────────────────────────────

def calculate_object_solidity(contour):
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    return float(area) / hull_area if hull_area > 0 else 0.0


def analyze_and_set_roi(frame, current_roi_bottom_pct):
    """
    Estimate the sky-ground horizon using Sobel edge projection and return a
    smoothed ROI bottom percentage.  This is the adaptive ROI strategy from
    the paper: Sobel gradient → vertical projection → search upward until
    edge density drops, then temporally smooth.
    """
    height, width = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (21, 21), 0)
    sobel_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=5)
    sobel_y = cv2.convertScaleAbs(sobel_y)
    vertical_projection = np.sum(sobel_y, axis=1)

    try:
        peak_density_y = int(np.argmax(vertical_projection))
        if peak_density_y >= len(vertical_projection) - 1:
            return current_roi_bottom_pct
        remaining = vertical_projection[peak_density_y:]
        if len(remaining) == 0:
            return current_roi_bottom_pct
        threshold = np.percentile(remaining, 10)
        horizon_y = peak_density_y
        for y in range(peak_density_y, 0, -1):
            if vertical_projection[y] < threshold:
                horizon_y = y
                break
        new_roi_bottom_pct = (horizon_y / height) * 100
        smoothed = (current_roi_bottom_pct * (1.0 - ROI_SMOOTHING_FACTOR) +
                    new_roi_bottom_pct * ROI_SMOOTHING_FACTOR)
        return max(ROI_MIN_PCT, min(ROI_MAX_PCT, smoothed))
    except Exception:
        return current_roi_bottom_pct


def is_sky_color(frame, bbox, roi_bottom_pct):
    """
    Multi-condition HSV sky classifier matching the four atmospheric states
    described in the paper: clear blue, white/light-grey, light-blue/cyan,
    and grey/overcast.  The HSV colour space is used because its Value channel
    decouples luminance from chromaticity, making sky criteria stable across
    illumination changes.
    """
    x, y, w, h = bbox
    frame_height, frame_width = frame.shape[:2]
    roi_bottom = int(frame_height * roi_bottom_pct / 100)
    if y > roi_bottom:
        return False

    border = 8
    x1 = max(0, x - border)
    y1 = max(0, y - border)
    x2 = min(frame_width, x + w + border)
    y2 = min(frame_height, y + h + border)
    region = frame[y1:y2, x1:x2]
    if region.size == 0:
        return False

    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    avg_sat = float(np.mean(hsv[:, :, 1]))
    avg_val = float(np.mean(hsv[:, :, 2]))
    avg_hue = float(np.mean(hsv[:, :, 0]))

    # 1. White / light-grey sky (overcast or hazy) — low sat, high val
    if avg_sat < 55 and avg_val > 150:
        return True
    # 2. Clear blue sky — hue in blue range, moderate sat
    if 85 < avg_hue < 135 and avg_sat < 170 and avg_val > 75:
        return True
    # 3. Light blue / cyan sky
    if 75 < avg_hue < 110 and avg_sat < 130 and avg_val > 95:
        return True
    # 4. Grey / overcast — very low sat, mid-range val
    if avg_sat < 28 and 70 < avg_val < 200:
        return True

    return False


def is_likely_cloud(frame, bbox):
    """
    Multi-feature cloud rejection from the paper: simultaneously checks low
    texture variation, low edge density, and high colour uniformity — all
    characteristic of diffuse cloud surfaces rather than bird silhouettes.
    """
    x, y, w, h = bbox
    # Only run for regions large enough to be clouds; tiny blobs are never clouds
    if w < 8 or h < 8:
        return False
    fh, fw = frame.shape[:2]
    x  = max(0, x)
    y  = max(0, y)
    x2 = min(fw, x + w)
    y2 = min(fh, y + h)
    if x2 <= x or y2 <= y:
        return False
    region = frame[y:y2, x:x2]
    if region.size == 0:
        return False

    gray_r = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

    # Texture: average local standard deviation
    k = np.ones((TEXTURE_NEIGHBORHOOD, TEXTURE_NEIGHBORHOOD), np.float32) / (TEXTURE_NEIGHBORHOOD ** 2)
    gf = gray_r.astype(np.float32)
    local_mean     = cv2.filter2D(gf, -1, k)
    local_sqr_mean = cv2.filter2D(gf ** 2, -1, k)
    variance       = np.clip(local_sqr_mean - local_mean ** 2, 0, None)
    avg_texture    = float(np.mean(np.sqrt(variance)))

    # Colour uniformity: std-dev of HSV saturation
    hsv_r      = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    color_std  = float(np.std(hsv_r[:, :, 1]))

    # Edge density
    edges       = cv2.Canny(gray_r, 50, 150)
    edge_density = np.count_nonzero(edges) / max(1, gray_r.size)

    return (avg_texture < CLOUD_TEXTURE_THRESHOLD
            and color_std < CLOUD_COLOR_UNIFORMITY_THRESHOLD
            and edge_density < CLOUD_EDGE_DENSITY_THRESHOLD)


def is_dark_against_sky(roi_bgr, bbox):
    """
    Return True only if the blob is a dark (grey/black) object against a brighter sky.
    The surround pad scales with blob size so large nearby birds don't self-cancel.
    """
    x, y, w, h = bbox
    fh, fw = roi_bgr.shape[:2]
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(fw, x + max(1, w))
    y2 = min(fh, y + max(1, h))
    if x2 <= x1 or y2 <= y1:
        return False

    blob_region = roi_bgr[y1:y2, x1:x2]
    if blob_region.size == 0:
        return False

    blob_val = float(np.mean(cv2.cvtColor(blob_region, cv2.COLOR_BGR2HSV)[:, :, 2]))

    if blob_val > BIRD_MAX_BLOB_VALUE:
        return False

    # Pad = 20% of the larger side, minimum 6px — ensures surround is outside the bird
    pad = max(6, int(max(w, h) * 0.20))
    sx1 = max(0, x1 - pad)
    sy1 = max(0, y1 - pad)
    sx2 = min(fw, x2 + pad)
    sy2 = min(fh, y2 + pad)

    # Sample only the outer ring, not the blob itself
    full_patch  = roi_bgr[sy1:sy2, sx1:sx2]
    inner_mask  = np.zeros(full_patch.shape[:2], dtype=np.uint8)
    iy1 = y1 - sy1
    ix1 = x1 - sx1
    iy2 = iy1 + (y2 - y1)
    ix2 = ix1 + (x2 - x1)
    inner_mask[iy1:iy2, ix1:ix2] = 1
    outer_pixels = full_patch[inner_mask == 0]

    if outer_pixels.size == 0:
        return blob_val < BIRD_MAX_BLOB_VALUE

    outer_bgr    = outer_pixels.reshape(-1, 1, 3).astype(np.uint8)
    outer_hsv    = cv2.cvtColor(outer_bgr, cv2.COLOR_BGR2HSV)
    surround_val = float(np.mean(outer_hsv[:, :, 2]))

    return (surround_val - blob_val) >= BIRD_MIN_CONTRAST


# ── MOG2 foreground mask → detections ─────────────────────────────────────────

def _extract_mog_detections(fg_mask, roi_bgr):
    """
    Convert a MOG2 foreground mask into bird-candidate detections.
    Any pixel that changed against the learned background is a candidate.
    Tiny 1px blobs are allowed; only obvious clouds (large, low-texture) are rejected.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    cleaned = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    detections = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if not (area >= MIN_BIRD_AREA and area < MAX_BIRD_AREA):
            continue
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = (w / h) if h > 0 else 1.0
        if not (MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO):
            continue
        if is_likely_cloud(roi_bgr, (x, y, w, h)):
            continue
        if not is_dark_against_sky(roi_bgr, (x, y, w, h)):
            continue
        detections.append({
            'bbox':         (x, y, max(1, w), max(1, h)),
            'center':       (x + max(1, w) // 2, y + max(1, h) // 2),
            'area':         float(area),
            'aspect_ratio': aspect_ratio,
            'confidence':   min(1.0, float(area) / 80.0),
        })
    return detections


# ── Appearance-based detection ─────────────────────────────────────────────────

def detect_birds_in_frame(frame, frame_height=None, detection_boundary=None, threshold=None):
    """
    Adaptive-threshold pipeline (best strategy per paper).
    1. Crop to ROI (sky region).
    2. Gaussian blur → adaptive Gaussian threshold (or fixed if supplied).
    3. Contour extraction with size / aspect-ratio / solidity / cloud filters.

    A second pass at 1.5× and a third pass at 2.0× upscale are run to catch
    birds that are too small to survive contour extraction at normal scale.
    """
    if frame_height is None:
        frame_height = frame.shape[0]
    if detection_boundary is None:
        detection_boundary = int(frame_height * INITIAL_ROI_BOTTOM_PERCENTAGE / 100)

    roi = frame[:detection_boundary, :]

    def _detect_at_scale(roi_bgr, scale=1.0, block_size=ADAPTIVE_BLOCK_SIZE, c_val=ADAPTIVE_C):
        if scale != 1.0:
            h0, w0 = roi_bgr.shape[:2]
            roi_bgr = cv2.resize(roi_bgr, (int(w0 * scale), int(h0 * scale)),
                                 interpolation=cv2.INTER_LINEAR)
        gray    = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
        # Blur kernel scales with block size so large-block pass smooths coarser structure
        ksize   = max(3, (block_size // 3) | 1)
        blurred = cv2.GaussianBlur(gray, (ksize, ksize), 0)

        if threshold is not None:
            _, thresh = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY_INV)
        else:
            thresh = cv2.adaptiveThreshold(
                blurred, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV,
                block_size, c_val,
            )

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        detections = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if not (area >= MIN_BIRD_AREA and area < MAX_BIRD_AREA):
                continue
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = (w / h) if h > 0 else 0
            if not (MIN_ASPECT_RATIO < aspect_ratio < MAX_ASPECT_RATIO):
                continue
            if calculate_object_solidity(contour) < MIN_BIRD_SOLIDITY:
                continue
            if is_likely_cloud(roi_bgr, (x, y, w, h)):
                continue
            inv = 1.0 / scale
            ox, oy = int(x * inv), int(y * inv)
            ow, oh = max(1, int(w * inv)), max(1, int(h * inv))
            if not is_dark_against_sky(roi, (ox, oy, ow, oh)):
                continue
            detections.append({
                'bbox':         (ox, oy, ow, oh),
                'center':       (ox + ow // 2, oy + oh // 2),
                'area':         area * (inv ** 2),
                'aspect_ratio': aspect_ratio,
                'confidence':   min(1.0, area / 80.0),
            })
        return detections, gray if scale == 1.0 else None

    def _merge(base, extras, tol=8):
        centres = [(d['center'][0], d['center'][1]) for d in base]
        for d in extras:
            cx, cy = d['center']
            if not any(abs(cx - ex) < tol and abs(cy - ey) < tol for ex, ey in centres):
                base.append(d)
                centres.append((cx, cy))

    # Pass A — fine block (catches distant 1-3px dots)
    detections_all, gray_roi = _detect_at_scale(roi, scale=1.0,
                                                 block_size=ADAPTIVE_BLOCK_SIZE,
                                                 c_val=ADAPTIVE_C)

    # Pass B — coarse block (merges fragmented large nearby birds into one contour)
    detections_large, _ = _detect_at_scale(roi, scale=1.0,
                                            block_size=ADAPTIVE_BLOCK_SIZE_LARGE,
                                            c_val=ADAPTIVE_C_LARGE)
    _merge(detections_all, detections_large, tol=12)

    # Pass C/D — upscale passes for very small distant birds
    for scale in (1.5, 2.0):
        detections_up, _ = _detect_at_scale(roi, scale=scale,
                                             block_size=ADAPTIVE_BLOCK_SIZE,
                                             c_val=ADAPTIVE_C)
        _merge(detections_all, detections_up, tol=6)

    return detections_all, gray_roi


# ── Motion-based discrimination ────────────────────────────────────────────────

def detect_moving_birds(current_detections, current_gray_roi, prev_gray_roi, roi_bgr):
    """
    Farneback dense optical flow + frame differencing, as in the adaptive
    threshold pipeline from the paper.  Per-candidate checks:
      - flow magnitude within [MIN_BIRD_SPEED, MAX_BIRD_SPEED]
      - directional consistency below DIRECTIONAL_CHANGE_THRESHOLD  OR
        the region is not cloud-like (so genuine birds that happen to fly
        in a straight line are not discarded)
      - at least MIN_MOTION_PIXELS changed above MOTION_THRESHOLD
    """
    if prev_gray_roi is None:
        return [], current_gray_roi

    if prev_gray_roi.shape != current_gray_roi.shape:
        return [], current_gray_roi

    flow = cv2.calcOpticalFlowFarneback(
        prev_gray_roi, current_gray_roi, None,
        _FB_PYR_SCALE, _FB_LEVELS, _FB_WIN_SIZE,
        _FB_ITERATIONS, _FB_POLY_N, _FB_POLY_SIGMA, 0,
    )
    frame_diff = cv2.absdiff(prev_gray_roi, current_gray_roi)
    fh, fw    = current_gray_roi.shape[:2]
    moving_birds = []

    for detection in current_detections:
        x, y, w, h = detection['bbox']
        # Clamp to ROI bounds
        x  = max(0, x)
        y  = max(0, y)
        x2 = min(fw, x + w)
        y2 = min(fh, y + h)
        if x2 <= x or y2 <= y:
            continue

        roi_diff = frame_diff[y:y2, x:x2]
        if roi_diff.size == 0:
            continue
        motion_pixels = int(np.count_nonzero(roi_diff > MOTION_THRESHOLD))

        roi_flow = flow[y:y2, x:x2]
        if roi_flow.size == 0:
            continue
        mag, _ = cv2.cartToPolar(roi_flow[..., 0], roi_flow[..., 1])
        avg_magnitude = float(np.mean(mag))

        # Directional consistency: ratio of mean-vector magnitude to mean scalar magnitude.
        # Low value → direction changes frequently (bird); high value → uniform drift (cloud).
        significant = np.count_nonzero(mag > 0.05)
        if significant > 4:
            flow_x = float(np.mean(roi_flow[..., 0]))
            flow_y = float(np.mean(roi_flow[..., 1]))
            flow_consistency = math.sqrt(flow_x ** 2 + flow_y ** 2) / (avg_magnitude + 1e-5)
        else:
            flow_consistency = 1.0

        passes_motion = (
            motion_pixels >= MIN_MOTION_PIXELS
            and MIN_BIRD_SPEED < avg_magnitude < MAX_BIRD_SPEED
            and (
                flow_consistency < DIRECTIONAL_CHANGE_THRESHOLD
                or not is_likely_cloud(roi_bgr, (x, y, w, h))
            )
        )

        if passes_motion:
            detection['motion_score']    = avg_magnitude
            detection['motion_pixels']   = motion_pixels
            detection['flow_consistency'] = flow_consistency
            moving_birds.append(detection)

    return moving_birds, current_gray_roi


# ── Temporal confirmation tracker ─────────────────────────────────────────────

class ImprovedBirdTracker:
    def __init__(self):
        self.tracks               = {}
        self.track_id             = 0
        self.confirmed_flying_birds = set()

    def _near_confirmed_track(self, x, y, exclude_tid=None):
        for tid in self.confirmed_flying_birds:
            if tid == exclude_tid or tid not in self.tracks:
                continue
            lx, ly = self.tracks[tid]['positions'][-1]
            if math.sqrt((x - lx) ** 2 + (y - ly) ** 2) < MAX_MATCHING_DISTANCE:
                return True
        return False

    def update_tracks(self, detections):
        matched_tracks     = {}
        current_frame_birds = []

        for detection in detections:
            x, y = detection['center']
            best_match, min_dist = None, float('inf')

            for tid, tdata in self.tracks.items():
                if tid in matched_tracks or not tdata['positions']:
                    continue
                positions = tdata['positions']
                lx, ly    = positions[-1]

                # Velocity extrapolation for confirmed tracks that have been missing
                if (tid in self.confirmed_flying_birds
                        and tdata['stationary_count'] > 0
                        and len(positions) >= 2):
                    vx = positions[-1][0] - positions[-2][0]
                    vy = positions[-1][1] - positions[-2][1]
                    frames_missing = tdata['stationary_count']
                    lx = lx + vx * frames_missing
                    ly = ly + vy * frames_missing

                d      = math.sqrt((x - lx) ** 2 + (y - ly) ** 2)
                radius = (MAX_MATCHING_DISTANCE_CONFIRMED
                          if tid in self.confirmed_flying_birds
                          else MAX_MATCHING_DISTANCE)
                if d < min_dist and d < radius:
                    min_dist, best_match = d, tid

            if best_match is not None:
                self.tracks[best_match]['positions'].append((x, y))
                self.tracks[best_match]['stationary_count'] = 0
                self.tracks[best_match]['detections'].append(detection)
                self.tracks[best_match]['last_bbox'] = detection['bbox']
                matched_tracks[best_match] = detection
                if (best_match not in self.confirmed_flying_birds
                        and self.is_flying_improved(best_match)):
                    if not self._near_confirmed_track(x, y, exclude_tid=best_match):
                        self.confirmed_flying_birds.add(best_match)
                        current_frame_birds.append(detection)
            else:
                if not self._near_confirmed_track(x, y):
                    self.tracks[self.track_id] = {
                        'positions':       [(x, y)],
                        'stationary_count': 0,
                        'detections':      [detection],
                        'last_bbox':       detection['bbox'],
                    }
                    self.track_id += 1

        for tid in list(self.tracks):
            if tid not in matched_tracks:
                self.tracks[tid]['stationary_count'] += 1
                limit = (MAX_STATIONARY_FRAMES_CONFIRMED
                         if tid in self.confirmed_flying_birds
                         else MAX_STATIONARY_FRAMES)
                if self.tracks[tid]['stationary_count'] >= limit:
                    del self.tracks[tid]

        return current_frame_birds

    def is_flying_improved(self, track_id):
        positions = self.tracks[track_id]['positions']
        if len(positions) < MIN_FLIGHT_DURATION:
            return False

        total_distance = 0.0
        directions = []
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i - 1][0]
            dy = positions[i][1] - positions[i - 1][1]
            total_distance += math.sqrt(dx ** 2 + dy ** 2)
            if dx != 0 or dy != 0:
                directions.append(math.atan2(dy, dx))

        direction_changes = 0
        for i in range(1, len(directions)):
            diff = abs(directions[i] - directions[i - 1])
            if diff > math.pi:
                diff = 2 * math.pi - diff
            if diff > 0.3:
                direction_changes += 1

        good_bird_features = 0
        dets   = self.tracks[track_id]['detections']
        scores = [d['motion_score'] for d in dets if 'motion_score' in d]
        if scores and np.mean(scores) > MIN_BIRD_SPEED:
            good_bird_features += 1
        flows = [d['flow_consistency'] for d in dets if 'flow_consistency' in d]
        if flows and np.mean(flows) < DIRECTIONAL_CHANGE_THRESHOLD:
            good_bird_features += 1
        ratios = [d['aspect_ratio'] for d in dets if 'aspect_ratio' in d]
        if ratios and np.std(ratios) > 0.1:
            good_bird_features += 1

        return (total_distance > MIN_MOVEMENT_DISTANCE
                and (direction_changes > 0 or good_bird_features >= 1))

    def get_unique_flying_birds_count(self):
        return len(self.confirmed_flying_birds)

    def get_currently_active_birds(self):
        return len(self.confirmed_flying_birds & self.tracks.keys())

    def get_active_confirmed_bboxes(self):
        """Return one bbox per currently active confirmed track (no duplicates)."""
        result = []
        for tid in self.confirmed_flying_birds:
            if tid in self.tracks:
                bbox = self.tracks[tid].get('last_bbox')
                if bbox is not None:
                    result.append(bbox)
        return result


# ── Non-streaming entry point ──────────────────────────────────────────────────

def process_video_with_unique_bird_counting(video_path, show_display=False, threshold=None):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return None

    fps          = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    new_width    = int(width  * RESIZE_FACTOR)
    new_height   = int(height * RESIZE_FACTOR)

    print(f"Processing: {os.path.basename(video_path)}")
    print(f"- Resolution: {width}x{height} → {new_width}x{new_height}")
    print(f"- FPS: {fps}, Frames: {total_frames}, Skip: every {FRAME_SKIP}")

    bird_tracker      = ImprovedBirdTracker()
    bg_subtractor     = cv2.createBackgroundSubtractorMOG2(
        history=_MOG2_HISTORY,
        varThreshold=_MOG2_VAR_THRESHOLD,
        detectShadows=_MOG2_DETECT_SHADOWS,
    )
    roi_bottom_pct    = float(INITIAL_ROI_BOTTOM_PERCENTAGE)
    detection_boundary = int(new_height * roi_bottom_pct / 100.0)
    prev_frame_cache  = None
    frame_count       = 0
    max_concurrent_birds = 0
    start_time        = time.time()

    try:
        while True:
            for _ in range(FRAME_SKIP - 1):
                ret = cap.grab()
                if not ret:
                    break

            ret, frame = cap.read()
            if not ret:
                break

            frame_count += FRAME_SKIP

            if RESIZE_FACTOR != 1.0:
                frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

            if frame_count <= FRAME_SKIP or frame_count % (ROI_UPDATE_INTERVAL * FRAME_SKIP) == 0:
                roi_bottom_pct    = analyze_and_set_roi(frame, roi_bottom_pct)
                detection_boundary = int(new_height * roi_bottom_pct / 100.0)

            roi_bgr = frame[:detection_boundary, :]
            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            # MOG2 background subtraction: detect any pixel-level movement in the sky
            fg_mask = bg_subtractor.apply(roi_bgr)
            mog_detections = _extract_mog_detections(fg_mask, roi_bgr)
            existing = [(d['center'][0], d['center'][1]) for d in current_detections]
            for d in mog_detections:
                cx, cy = d['center']
                if not any(abs(cx - ex) < 6 and abs(cy - ey) < 6 for ex, ey in existing):
                    current_detections.append(d)
                    existing.append((cx, cy))

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache, roi_bgr
            )

            bird_tracker.update_tracks(moving_detections)

            unique_flying_birds  = bird_tracker.get_unique_flying_birds_count()
            currently_active     = bird_tracker.get_currently_active_birds()
            max_concurrent_birds = max(max_concurrent_birds, currently_active)

            if frame_count % (100 * FRAME_SKIP) == 0:
                progress  = frame_count / total_frames if total_frames > 0 else 0
                elapsed   = time.time() - start_time
                remaining = (elapsed / progress - elapsed) if progress > 0 else 0
                print(
                    f"  {frame_count}/{total_frames} ({progress*100:.1f}%) — "
                    f"unique birds: {unique_flying_birds} — "
                    f"~{remaining:.0f}s remaining"
                )

        unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
        total_time          = time.time() - start_time
        frames_per_second   = frame_count / total_time if total_time > 0 else 0

        print(f"  DONE — {unique_flying_birds} unique flying birds in {total_time:.2f}s")

        return {
            'video_path':          video_path,
            'video_name':          os.path.basename(video_path),
            'frames_processed':    frame_count,
            'unique_flying_birds': unique_flying_birds,
            'max_concurrent_birds': max_concurrent_birds,
            'total_tracks':        bird_tracker.track_id,
            'fps':                 fps,
            'total_frames':        total_frames,
            'duration_seconds':    total_frames / fps if fps > 0 else 0,
            'processing_time':     total_time,
            'processing_speed':    frames_per_second,
        }

    except Exception as e:
        print(f"  Error: {e}")
        return None

    finally:
        cap.release()
        if show_display:
            cv2.destroyAllWindows()


# ── Streaming entry point ──────────────────────────────────────────────────────

_YELLOW              = (0, 255, 255)
_RED                 = (0, 0, 255)
_FRAME_SEND_INTERVAL = 5


def process_video_streaming(video_path, threshold=None):
    """
    Generator version of process_video_with_unique_bird_counting.
    Yields dicts:
      {"kind": "frame",    "frame": <annotated BGR ndarray>}
      {"kind": "progress", "progress": float, "unique_birds": int, "elapsed": float}
      {"kind": "result",   "data": {...}}
    """
    log.info("[detection] process_video_streaming START path=%s threshold=%s", video_path, threshold)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        log.error("[detection] cv2.VideoCapture failed to open: %s", video_path)
        return

    fps          = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    new_width    = int(width  * RESIZE_FACTOR)
    new_height   = int(height * RESIZE_FACTOR)

    log.info(
        "[detection] video: %dx%d @ %dfps, %d frames, processing at %dx%d FRAME_SKIP=%d threshold=%s",
        width, height, fps, total_frames, new_width, new_height, FRAME_SKIP, threshold,
    )

    bird_tracker      = ImprovedBirdTracker()
    bg_subtractor     = cv2.createBackgroundSubtractorMOG2(
        history=_MOG2_HISTORY,
        varThreshold=_MOG2_VAR_THRESHOLD,
        detectShadows=_MOG2_DETECT_SHADOWS,
    )
    roi_bottom_pct    = float(INITIAL_ROI_BOTTOM_PERCENTAGE)
    detection_boundary = int(new_height * roi_bottom_pct / 100.0)
    prev_frame_cache  = None
    frame_count       = 0
    max_concurrent_birds = 0
    start_time        = time.time()

    first_detection_frame  = None
    peak_concurrent_frame  = 0
    birds_per_minute_counts: dict[int, int] = {}
    prev_unique            = 0
    total_motion_sum       = 0.0
    total_motion_count     = 0

    try:
        while True:
            for _ in range(FRAME_SKIP - 1):
                ret = cap.grab()
                if not ret:
                    break

            ret, frame = cap.read()
            if not ret:
                if frame_count == 0:
                    log.error("[detection] cap.read() failed on first frame — video unreadable")
                else:
                    log.info("[detection] End of video at frame %d", frame_count)
                break

            frame_count += FRAME_SKIP
            if frame_count == FRAME_SKIP:
                log.info("[detection] First frame read OK shape=%s", frame.shape)

            if RESIZE_FACTOR != 1.0:
                frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

            if frame_count <= FRAME_SKIP or frame_count % (ROI_UPDATE_INTERVAL * FRAME_SKIP) == 0:
                roi_bottom_pct    = analyze_and_set_roi(frame, roi_bottom_pct)
                detection_boundary = int(new_height * roi_bottom_pct / 100.0)

            roi_bgr = frame[:detection_boundary, :]
            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            # MOG2 background subtraction: detect any pixel-level movement in the sky
            fg_mask = bg_subtractor.apply(roi_bgr)
            mog_detections = _extract_mog_detections(fg_mask, roi_bgr)
            existing = [(d['center'][0], d['center'][1]) for d in current_detections]
            for d in mog_detections:
                cx, cy = d['center']
                if not any(abs(cx - ex) < 6 and abs(cy - ey) < 6 for ex, ey in existing):
                    current_detections.append(d)
                    existing.append((cx, cy))

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache, roi_bgr
            )

            bird_tracker.update_tracks(moving_detections)

            unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
            currently_active    = bird_tracker.get_currently_active_birds()

            if first_detection_frame is None and unique_flying_birds > 0:
                first_detection_frame = frame_count

            if currently_active > max_concurrent_birds:
                max_concurrent_birds  = currently_active
                peak_concurrent_frame = frame_count

            if unique_flying_birds > prev_unique:
                if fps > 0:
                    minute_idx = int(frame_count / fps / 60)
                    new_birds  = unique_flying_birds - prev_unique
                    birds_per_minute_counts[minute_idx] = (
                        birds_per_minute_counts.get(minute_idx, 0) + new_birds
                    )
                prev_unique = unique_flying_birds

            for det in moving_detections:
                if 'motion_score' in det:
                    total_motion_sum   += det['motion_score']
                    total_motion_count += 1

            if frame_count == FRAME_SKIP:
                log.info(
                    "[detection] Frame 1 processed: detections=%d sky=%d moving=%d",
                    len(current_detections), len(sky_detections), len(moving_detections),
                )

            if frame_count % _FRAME_SEND_INTERVAL == 0:
                display = frame.copy()

                # Draw confirmed active tracks — box follows the bird each frame
                confirmed_bboxes = bird_tracker.get_active_confirmed_bboxes()
                confirmed_centers = []
                for (x, y, w, h) in confirmed_bboxes:
                    cv2.rectangle(display, (x, y), (x + w, y + h), _RED, 2)
                    confirmed_centers.append((x + w // 2, y + h // 2))

                # Draw unconfirmed candidates only if not overlapping a confirmed track
                for det in moving_detections:
                    cx, cy = det['center']
                    near_confirmed = any(
                        abs(cx - ex) < MAX_MATCHING_DISTANCE and abs(cy - ey) < MAX_MATCHING_DISTANCE
                        for ex, ey in confirmed_centers
                    )
                    if not near_confirmed:
                        x, y, w, h = det['bbox']
                        cv2.rectangle(display, (x, y), (x + w, y + h), _YELLOW, 1)

                cv2.putText(
                    display,
                    f"Unique birds: {unique_flying_birds}  Active: {currently_active}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2,
                )
                yield {"kind": "frame", "frame": display}

            if frame_count % (100 * FRAME_SKIP) == 0:
                elapsed = time.time() - start_time
                if total_frames > 0:
                    progress = frame_count / total_frames
                elif elapsed > 0:
                    progress = min(0.99, frame_count / max(1, frame_count + 500))
                else:
                    progress = 0
                yield {
                    "kind":         "progress",
                    "progress":     round(progress, 4),
                    "unique_birds": unique_flying_birds,
                    "elapsed":      round(elapsed, 1),
                }

        unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
        total_time          = time.time() - start_time
        log.info(
            "[detection] DONE: %d unique birds, %d frames in %.1fs (%.1f fps processed)",
            unique_flying_birds, frame_count, total_time,
            frame_count / total_time if total_time > 0 else 0,
        )

        total_minutes = (int(frame_count / fps / 60) + 1) if fps > 0 else 0
        minute_counts = [birds_per_minute_counts.get(m, 0) for m in range(total_minutes)]

        yield {
            "kind": "result",
            "data": {
                "unique_flying_birds":    unique_flying_birds,
                "max_concurrent_birds":   max_concurrent_birds,
                "frames_processed":       frame_count,
                "total_tracks":           bird_tracker.track_id,
                "fps":                    fps,
                "total_frames":           total_frames,
                "duration_seconds":       (
                    (total_frames / fps) if (fps > 0 and total_frames > 0)
                    else round(total_time, 1)
                ),
                "processing_time":        round(total_time, 1),
                "processing_speed":       round(frame_count / total_time, 2) if total_time > 0 else 0,
                "first_detection_second": (
                    round(first_detection_frame / fps, 1)
                    if first_detection_frame and fps > 0 else None
                ),
                "peak_concurrent_second": round(peak_concurrent_frame / fps, 1) if fps > 0 else 0,
                "birds_per_minute":       json.dumps(minute_counts),
                "track_noise_ratio":      round(unique_flying_birds / max(1, bird_tracker.track_id), 3),
                "avg_motion_score":       round(total_motion_sum / max(1, total_motion_count), 2),
            },
        }

    except Exception as e:
        log.exception("[detection] Streaming error at frame %d: %s", frame_count, e)

    finally:
        cap.release()
        log.info("[detection] process_video_streaming END")
