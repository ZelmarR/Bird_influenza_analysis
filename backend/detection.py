import cv2
import numpy as np
import math
import logging
import os
import time

log = logging.getLogger("bird_counter")

FRAME_SKIP                    = 1
RESIZE_FACTOR                 = 0.8
MIN_BIRD_AREA                 = 15
MAX_BIRD_AREA                 = 800
MIN_ASPECT_RATIO              = 0.4
MAX_ASPECT_RATIO              = 3.0
MIN_BIRD_SOLIDITY             = 0.6
MOTION_THRESHOLD              = 10
MIN_MOTION_PIXELS             = 5
MAX_STATIONARY_FRAMES         = 10
MIN_MOVEMENT_DISTANCE         = 15
MIN_FLIGHT_DURATION           = 3
MAX_MATCHING_DISTANCE         = 80
MIN_BIRD_SPEED                = 3
MAX_BIRD_SPEED                = 100
DIRECTIONAL_CHANGE_THRESHOLD  = 0.7
ROI_UPDATE_INTERVAL           = 12
ROI_SMOOTHING_FACTOR          = 0.5
INITIAL_ROI_BOTTOM_PERCENTAGE = 60
CLOUD_TEXTURE_THRESHOLD       = 20
TEXTURE_NEIGHBORHOOD          = 7


def calculate_object_solidity(contour):
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    return float(area) / hull_area if hull_area > 0 else 0.0


def analyze_and_set_roi(frame, current_roi_bottom_pct):
    height, width = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (21, 21), 0)
    sobel_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=5)
    sobel_y = cv2.convertScaleAbs(sobel_y)
    vertical_projection = np.sum(sobel_y, axis=1)

    try:
        peak_density_y = np.argmax(vertical_projection)
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
        smoothed = (current_roi_bottom_pct * (1 - ROI_SMOOTHING_FACTOR) +
                    new_roi_bottom_pct * ROI_SMOOTHING_FACTOR)
        return max(20.0, min(95.0, smoothed))
    except Exception:
        return current_roi_bottom_pct


def is_sky_color(frame, bbox, roi_bottom_pct):
    x, y, w, h = bbox
    frame_height, frame_width = frame.shape[:2]
    roi_bottom = int(frame_height * roi_bottom_pct / 100)
    if y > roi_bottom:
        return False
    border = 10
    x1 = max(0, x - border)
    y1 = max(0, y - border)
    x2 = min(frame_width, x + w + border)
    y2 = min(frame_height, y + h + border)
    region = frame[y1:y2, x1:x2]
    if region.size == 0:
        return False
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    avg_sat = np.mean(hsv[:, :, 1])
    avg_val = np.mean(hsv[:, :, 2])
    avg_hue = np.mean(hsv[:, :, 0])
    if avg_sat < 60 and avg_val > 140:
        return True
    if 85 < avg_hue < 135 and avg_sat < 160 and avg_val > 80:
        return True
    if 75 < avg_hue < 105 and avg_sat < 120 and avg_val > 100:
        return True
    if avg_sat < 30 and 80 < avg_val < 190:
        return True
    return False


def is_likely_cloud(frame, bbox):
    x, y, w, h = bbox
    if w < 10 or h < 10:
        return False
    fh, fw = frame.shape[:2]
    x = max(0, x)
    y = max(0, y)
    x2 = min(fw, x + w)
    y2 = min(fh, y + h)
    if x2 <= x or y2 <= y:
        return False
    region = frame[y:y2, x:x2]
    if region.size == 0:
        return False
    gray_r = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    k = np.ones((TEXTURE_NEIGHBORHOOD, TEXTURE_NEIGHBORHOOD), np.float32) / (TEXTURE_NEIGHBORHOOD ** 2)
    gf = gray_r.astype(np.float32)
    local_mean = cv2.filter2D(gf, -1, k)
    local_sqr_mean = cv2.filter2D(gf ** 2, -1, k)
    variance = np.clip(local_sqr_mean - local_mean ** 2, 0, None)
    avg_texture = np.mean(np.sqrt(variance))
    hsv_r = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    color_std = np.std(hsv_r[:, :, 1])
    edges = cv2.Canny(gray_r, 50, 150)
    edge_density = np.count_nonzero(edges) / max(1, gray_r.size)
    return avg_texture < CLOUD_TEXTURE_THRESHOLD and color_std < 25 and edge_density < 0.05


def detect_birds_in_frame(frame, frame_height=None, detection_boundary=None, threshold=None):
    if frame_height is None:
        frame_height = frame.shape[0]
    if detection_boundary is None:
        detection_boundary = int(frame_height * INITIAL_ROI_BOTTOM_PERCENTAGE / 100)

    roi = frame[:detection_boundary, :]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    if threshold is not None:
        _, thresh = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY_INV)
    else:
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            11, 2,
        )

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detections = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if not (MIN_BIRD_AREA < area < MAX_BIRD_AREA):
            continue
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = w / h if h > 0 else 0
        if not (MIN_ASPECT_RATIO < aspect_ratio < MAX_ASPECT_RATIO):
            continue
        if calculate_object_solidity(contour) < MIN_BIRD_SOLIDITY:
            continue
        if is_likely_cloud(roi, (x, y, w, h)):
            continue
        detections.append({
            'bbox': (x, y, w, h),
            'center': (x + w // 2, y + h // 2),
            'area': area,
            'aspect_ratio': aspect_ratio,
            'confidence': min(1.0, area / 100.0),
        })

    return detections, gray


def detect_moving_birds(current_detections, current_gray_roi, prev_gray_roi, roi_bgr):
    if prev_gray_roi is None:
        return [], current_gray_roi

    # ROI height can change when dynamic ROI updates; skip flow for that frame
    if prev_gray_roi.shape != current_gray_roi.shape:
        return [], current_gray_roi

    # Optical flow on ROI only (not full frame) for speed.
    # levels=2 and winsize=11 instead of notebook's 3/15 — ~4x faster, adequate for small birds.
    flow = cv2.calcOpticalFlowFarneback(
        prev_gray_roi, current_gray_roi, None,
        0.5, 2, 11, 3, 5, 1.2, 0,
    )
    frame_diff = cv2.absdiff(prev_gray_roi, current_gray_roi)
    fh, fw = current_gray_roi.shape[:2]
    moving_birds = []

    for detection in current_detections:
        x, y, w, h = detection['bbox']
        if x < 0 or y < 0 or x + w > fw or y + h > fh:
            continue

        roi_diff = frame_diff[y:y+h, x:x+w]
        if roi_diff.size == 0:
            continue
        motion_pixels = np.count_nonzero(roi_diff > MOTION_THRESHOLD)

        roi_flow = flow[y:y+h, x:x+w]
        if roi_flow.size == 0:
            continue
        mag, _ = cv2.cartToPolar(roi_flow[..., 0], roi_flow[..., 1])
        avg_magnitude = np.mean(mag)

        if np.count_nonzero(mag > 0.5) > 10:
            flow_x = np.mean(roi_flow[..., 0])
            flow_y = np.mean(roi_flow[..., 1])
            flow_consistency = math.sqrt(flow_x**2 + flow_y**2) / (avg_magnitude + 1e-5)
        else:
            flow_consistency = 1.0

        if (motion_pixels >= MIN_MOTION_PIXELS
                and MIN_BIRD_SPEED < avg_magnitude < MAX_BIRD_SPEED
                and (flow_consistency < DIRECTIONAL_CHANGE_THRESHOLD
                     or not is_likely_cloud(roi_bgr, (x, y, w, h)))):
            detection['motion_score'] = avg_magnitude
            detection['motion_pixels'] = motion_pixels
            detection['flow_consistency'] = flow_consistency
            moving_birds.append(detection)

    return moving_birds, current_gray_roi


class ImprovedBirdTracker:
    def __init__(self):
        self.tracks = {}
        self.track_id = 0
        self.confirmed_flying_birds = set()

    def update_tracks(self, detections):
        matched_tracks = {}
        current_frame_birds = []

        for detection in detections:
            x, y = detection['center']
            best_match, min_dist = None, float('inf')
            for tid, tdata in self.tracks.items():
                if tid not in matched_tracks and tdata['positions']:
                    lx, ly = tdata['positions'][-1]
                    d = math.sqrt((x - lx)**2 + (y - ly)**2)
                    if d < min_dist and d < MAX_MATCHING_DISTANCE:
                        min_dist, best_match = d, tid
            if best_match is not None:
                self.tracks[best_match]['positions'].append((x, y))
                self.tracks[best_match]['stationary_count'] = 0
                self.tracks[best_match]['detections'].append(detection)
                matched_tracks[best_match] = detection
                if self.is_flying_improved(best_match):
                    self.confirmed_flying_birds.add(best_match)
                    current_frame_birds.append(detection)
            else:
                self.tracks[self.track_id] = {
                    'positions': [(x, y)],
                    'stationary_count': 0,
                    'detections': [detection],
                }
                self.track_id += 1

        for tid in list(self.tracks):
            if tid not in matched_tracks:
                self.tracks[tid]['stationary_count'] += 1
                if self.tracks[tid]['stationary_count'] >= MAX_STATIONARY_FRAMES:
                    del self.tracks[tid]

        return current_frame_birds

    def is_flying_improved(self, track_id):
        positions = self.tracks[track_id]['positions']
        if len(positions) < MIN_FLIGHT_DURATION:
            return False

        total_distance = 0
        directions = []
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i-1][0]
            dy = positions[i][1] - positions[i-1][1]
            total_distance += math.sqrt(dx**2 + dy**2)
            if dx != 0 or dy != 0:
                directions.append(math.atan2(dy, dx))

        direction_changes = 0
        for i in range(1, len(directions)):
            diff = abs(directions[i] - directions[i-1])
            if diff > math.pi:
                diff = 2 * math.pi - diff
            if diff > 0.3:
                direction_changes += 1

        good_bird_features = 0
        dets = self.tracks[track_id]['detections']
        scores = [d['motion_score'] for d in dets if 'motion_score' in d]
        if scores and np.mean(scores) > MIN_BIRD_SPEED:
            good_bird_features += 1
        flows = [d['flow_consistency'] for d in dets if 'flow_consistency' in d]
        if flows and np.mean(flows) < DIRECTIONAL_CHANGE_THRESHOLD:
            good_bird_features += 1
        ratios = [d['aspect_ratio'] for d in dets if 'aspect_ratio' in d]
        if ratios and np.std(ratios) > 0.1:
            good_bird_features += 1

        return total_distance > MIN_MOVEMENT_DISTANCE and (direction_changes > 0 or good_bird_features >= 1)

    def get_unique_flying_birds_count(self):
        return len(self.confirmed_flying_birds)

    def get_currently_active_birds(self):
        return len(self.confirmed_flying_birds & self.tracks.keys())


def process_video_with_unique_bird_counting(video_path, show_display=False, threshold=None):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return None

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    new_width = int(width * RESIZE_FACTOR)
    new_height = int(height * RESIZE_FACTOR)

    print(f"Processing: {os.path.basename(video_path)}")
    print(f"- Resolution: {width}x{height} → {new_width}x{new_height}")
    print(f"- FPS: {fps}, Frames: {total_frames}, Skip: every {FRAME_SKIP}")

    bird_tracker = ImprovedBirdTracker()

    roi_bottom_pct = float(INITIAL_ROI_BOTTOM_PERCENTAGE)
    detection_boundary = int(new_height * roi_bottom_pct / 100.0)
    prev_frame_cache = None
    frame_count = 0
    max_concurrent_birds = 0
    start_time = time.time()

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
                roi_bottom_pct = analyze_and_set_roi(frame, roi_bottom_pct)
                detection_boundary = int(new_height * roi_bottom_pct / 100.0)

            roi_bgr = frame[:detection_boundary, :]
            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache, roi_bgr
            )

            bird_tracker.update_tracks(moving_detections)

            unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
            currently_active = bird_tracker.get_currently_active_birds()
            max_concurrent_birds = max(max_concurrent_birds, currently_active)

            if frame_count % (100 * FRAME_SKIP) == 0:
                progress = frame_count / total_frames if total_frames > 0 else 0
                elapsed = time.time() - start_time
                remaining = (elapsed / progress - elapsed) if progress > 0 else 0
                print(
                    f"  {frame_count}/{total_frames} ({progress*100:.1f}%) — "
                    f"unique birds: {unique_flying_birds} — "
                    f"~{remaining:.0f}s remaining"
                )

        unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
        total_time = time.time() - start_time
        frames_per_second = frame_count / total_time if total_time > 0 else 0

        print(f"  DONE — {unique_flying_birds} unique flying birds in {total_time:.2f}s")

        return {
            'video_path': video_path,
            'video_name': os.path.basename(video_path),
            'frames_processed': frame_count,
            'unique_flying_birds': unique_flying_birds,
            'max_concurrent_birds': max_concurrent_birds,
            'total_tracks': bird_tracker.track_id,
            'fps': fps,
            'total_frames': total_frames,
            'duration_seconds': total_frames / fps if fps > 0 else 0,
            'processing_time': total_time,
            'processing_speed': frames_per_second,
        }

    except Exception as e:
        print(f"  Error: {e}")
        return None

    finally:
        cap.release()
        if show_display:
            cv2.destroyAllWindows()


# Colour constants for box drawing
_YELLOW = (0, 255, 255)   # candidate detections
_RED = (0, 0, 255)        # confirmed flying birds
_FRAME_SEND_INTERVAL = 5  # send every Nth frame to browser


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

    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    new_width = int(width * RESIZE_FACTOR)
    new_height = int(height * RESIZE_FACTOR)

    log.info("[detection] video: %dx%d @ %dfps, %d frames, processing at %dx%d FRAME_SKIP=%d threshold=%s",
             width, height, fps, total_frames, new_width, new_height, FRAME_SKIP, threshold)

    bird_tracker = ImprovedBirdTracker()

    roi_bottom_pct = float(INITIAL_ROI_BOTTOM_PERCENTAGE)
    detection_boundary = int(new_height * roi_bottom_pct / 100.0)
    prev_frame_cache = None
    frame_count = 0
    max_concurrent_birds = 0
    start_time = time.time()

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
                roi_bottom_pct = analyze_and_set_roi(frame, roi_bottom_pct)
                detection_boundary = int(new_height * roi_bottom_pct / 100.0)

            roi_bgr = frame[:detection_boundary, :]
            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache, roi_bgr
            )

            bird_tracker.update_tracks(moving_detections)

            unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
            currently_active = bird_tracker.get_currently_active_birds()
            max_concurrent_birds = max(max_concurrent_birds, currently_active)

            if frame_count == FRAME_SKIP:
                log.info("[detection] Frame 1 processed: detections=%d sky=%d moving=%d",
                         len(current_detections), len(sky_detections), len(moving_detections))

            if frame_count % _FRAME_SEND_INTERVAL == 0:
                display = frame.copy()

                for det in moving_detections:
                    x, y, w, h = det['bbox']
                    cv2.rectangle(display, (x, y), (x + w, y + h), _YELLOW, 2)

                for det in moving_detections:
                    cx, cy = det['center']
                    for tid, tdata in bird_tracker.tracks.items():
                        if tid in bird_tracker.confirmed_flying_birds:
                            tx, ty = tdata['positions'][-1]
                            if abs(tx - cx) < 5 and abs(ty - cy) < 5:
                                x, y, w, h = det['bbox']
                                cv2.rectangle(display, (x, y), (x + w, y + h), _RED, 2)
                                break

                cv2.putText(
                    display,
                    f"Unique birds: {unique_flying_birds}  Active: {currently_active}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2,
                )
                yield {"kind": "frame", "frame": display}

            if frame_count % (100 * FRAME_SKIP) == 0:
                elapsed = time.time() - start_time
                progress = frame_count / total_frames if total_frames > 0 else 0
                yield {
                    "kind": "progress",
                    "progress": round(progress, 4),
                    "unique_birds": unique_flying_birds,
                    "elapsed": round(elapsed, 1),
                }

        unique_flying_birds = bird_tracker.get_unique_flying_birds_count()
        total_time = time.time() - start_time
        log.info("[detection] DONE: %d unique birds, %d frames in %.1fs (%.1f fps processed)",
                 unique_flying_birds, frame_count, total_time,
                 frame_count / total_time if total_time > 0 else 0)

        yield {
            "kind": "result",
            "data": {
                "unique_flying_birds": unique_flying_birds,
                "max_concurrent_birds": max_concurrent_birds,
                "frames_processed": frame_count,
                "total_tracks": bird_tracker.track_id,
                "fps": fps,
                "total_frames": total_frames,
                "duration_seconds": total_frames / fps if fps > 0 else 0,
                "processing_time": round(total_time, 1),
                "processing_speed": round(frame_count / total_time, 2) if total_time > 0 else 0,
            },
        }

    except Exception as e:
        log.exception("[detection] Streaming error at frame %d: %s", frame_count, e)

    finally:
        cap.release()
        log.info("[detection] process_video_streaming END")
