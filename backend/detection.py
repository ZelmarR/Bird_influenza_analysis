import cv2
import numpy as np
from collections import defaultdict
import math
from datetime import datetime
import logging
import os
import time
from scipy.optimize import linear_sum_assignment

log = logging.getLogger("bird_counter")

FRAME_COVERAGE_PERCENTAGE = 0.6
FRAME_SKIP = 1
RESIZE_FACTOR = 0.7
BINARY_THRESHOLD = 127
motion_threshold = 10
MIN_BIRD_AREA = 15
MAX_BIRD_AREA = 800
MIN_ASPECT_RATIO = 0.4
MAX_ASPECT_RATIO = 3.0
MIN_BIRD_SOLIDITY = 0.6
MIN_MOTION_PIXELS = 5
ROI_UPDATE_INTERVAL = 12
ROI_SMOOTHING_FACTOR = 0.5
INITIAL_ROI_BOTTOM_PERCENTAGE = 60
CLOUD_TEXTURE_THRESHOLD = 20
TEXTURE_NEIGHBORHOOD = 7


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


def detect_moving_birds(current_detections, current_gray_roi, prev_gray_roi):
    if prev_gray_roi is None:
        return [], current_gray_roi

    # ROI height can change when dynamic ROI updates; skip diff for that frame
    if prev_gray_roi.shape != current_gray_roi.shape:
        return [], current_gray_roi

    frame_diff = cv2.absdiff(prev_gray_roi, current_gray_roi)
    moving_birds = []

    for detection in current_detections:
        x, y, w, h = detection['bbox']
        y2 = min(y + h, frame_diff.shape[0])
        x2 = min(x + w, frame_diff.shape[1])
        if y >= y2 or x >= x2:
            continue
        roi_diff = frame_diff[y:y2, x:x2]
        if roi_diff.size == 0:
            continue
        motion_pixels = np.count_nonzero(roi_diff > motion_threshold)
        if motion_pixels >= MIN_MOTION_PIXELS and np.mean(roi_diff) > motion_threshold:
            moving_birds.append(detection)

    return moving_birds, current_gray_roi


class EnhancedBirdTracker:
    def __init__(self, max_stationary_frames=20, min_movement_distance=15, min_flight_duration=5):
        self.tracks = {}
        self.track_id = 0
        self.max_stationary_frames = max_stationary_frames
        self.min_movement_distance = min_movement_distance
        self.min_flight_duration = min_flight_duration
        self.confirmed_flying_birds = set()
        self.bird_flight_status = {}

    # Maximum pixel distance to link a detection to an existing track.
    # Kept tight (50px at 0.7 resize) so flock birds don't steal each other's tracks.
    MAX_MATCH_DIST = 50

    def update_tracks(self, detections):
        matched_tracks = {}   # track_id -> detection
        current_frame_birds = []

        track_ids = list(self.tracks.keys())

        if track_ids and detections:
            # Build cost matrix: rows = tracks, cols = detections
            track_positions = np.array([self.tracks[tid]['positions'][-1] for tid in track_ids],
                                       dtype=np.float32)
            det_centers = np.array([d['center'] for d in detections], dtype=np.float32)

            # Euclidean distance matrix (n_tracks × n_detections)
            diff = track_positions[:, np.newaxis, :] - det_centers[np.newaxis, :, :]
            cost = np.sqrt(np.sum(diff ** 2, axis=2))

            # Hungarian optimal assignment
            row_idx, col_idx = linear_sum_assignment(cost)

            for r, c in zip(row_idx, col_idx):
                if cost[r, c] <= self.MAX_MATCH_DIST:
                    tid = track_ids[r]
                    det = detections[c]
                    x, y = det['center']
                    self.tracks[tid]['positions'].append((x, y))
                    self.tracks[tid]['stationary_count'] = 0
                    self.tracks[tid]['last_seen'] = len(self.tracks[tid]['positions'])
                    matched_tracks[tid] = det

                    if self.is_bird_flying(tid):
                        self.confirmed_flying_birds.add(tid)
                        self.bird_flight_status[tid] = 'flying'
                        current_frame_birds.append(det)

        # Unmatched detections → new tracks
        matched_det_indices = {id(matched_tracks[tid]) for tid in matched_tracks}
        for det in detections:
            if id(det) not in matched_det_indices:
                self.tracks[self.track_id] = {
                    'positions': [det['center']],
                    'stationary_count': 0,
                    'last_seen': 1,
                    'created_frame': self.track_id,
                }
                self.bird_flight_status[self.track_id] = 'new'
                self.track_id += 1

        # Age unmatched tracks; remove stale ones
        tracks_to_remove = []
        for tid in list(self.tracks.keys()):
            if tid not in matched_tracks:
                self.tracks[tid]['stationary_count'] += 1
                if self.tracks[tid]['stationary_count'] >= self.max_stationary_frames:
                    tracks_to_remove.append(tid)
        for tid in tracks_to_remove:
            del self.tracks[tid]
            self.bird_flight_status.pop(tid, None)

        return current_frame_birds

    def is_bird_flying(self, track_id):
        positions = self.tracks[track_id]['positions']
        if len(positions) < self.min_flight_duration:
            return False

        pos_array = np.array(positions[-10:])
        if len(pos_array) < 2:
            return False

        diffs = np.diff(pos_array, axis=0)
        distances = np.sqrt(np.sum(diffs ** 2, axis=1))
        total_distance = np.sum(distances)
        avg_movement = total_distance / len(distances) if len(distances) > 0 else 0

        movement_consistency = 0
        if len(diffs) >= 2:
            valid_idx = distances > 0
            if np.sum(valid_idx) >= 2:
                norm_diffs = diffs[valid_idx] / distances[valid_idx, np.newaxis]
                dot_products = np.abs(np.dot(norm_diffs, norm_diffs.T))
                mask = ~np.eye(len(norm_diffs), dtype=bool)
                movement_consistency = np.mean(dot_products[mask]) if np.sum(mask) > 0 else 0

        return (
            total_distance > self.min_movement_distance
            and avg_movement > 2.0
            and movement_consistency > 0.3
        )

    def get_unique_flying_birds_count(self):
        return len(self.confirmed_flying_birds)

    def get_currently_active_birds(self):
        return len(self.confirmed_flying_birds & self.tracks.keys())


def detect_birds_in_frame(frame, frame_height=None, detection_boundary=None, threshold=None):
    if frame_height is None:
        frame_height = frame.shape[0]
    if detection_boundary is None:
        detection_boundary = int(frame_height * FRAME_COVERAGE_PERCENTAGE)

    roi = frame[:detection_boundary, :]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    t = threshold if threshold is not None else BINARY_THRESHOLD
    _, thresh = cv2.threshold(gray, t, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detections = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if MIN_BIRD_AREA < area < MAX_BIRD_AREA:
            if calculate_object_solidity(contour) < MIN_BIRD_SOLIDITY:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / h if h > 0 else 0
            if MIN_ASPECT_RATIO < aspect_ratio < MAX_ASPECT_RATIO:
                if is_likely_cloud(frame, (x, y, w, h)):
                    continue
                detections.append({
                    'bbox': (x, y, w, h),
                    'center': (x + w // 2, y + h // 2),
                    'area': area,
                    'confidence': min(1.0, area / 100.0),
                })

    return detections, gray


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

    bird_tracker = EnhancedBirdTracker(
        max_stationary_frames=15,          # ~0.5s at 30fps before a track is dropped
        min_movement_distance=18 * RESIZE_FACTOR,  # lower threshold catches slower flock birds
        min_flight_duration=6,             # 6 consecutive frames to confirm a flying bird
    )

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

            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache
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

    bird_tracker = EnhancedBirdTracker(
        max_stationary_frames=15,          # ~0.5s at 30fps before a track is dropped
        min_movement_distance=18 * RESIZE_FACTOR,  # lower threshold catches slower flock birds
        min_flight_duration=6,             # 6 consecutive frames to confirm a flying bird
    )

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

            current_detections, current_gray_roi = detect_birds_in_frame(
                frame, new_height, detection_boundary, threshold=threshold
            )

            sky_detections = [
                d for d in current_detections
                if is_sky_color(frame, d['bbox'], roi_bottom_pct)
            ]

            moving_detections, prev_frame_cache = detect_moving_birds(
                sky_detections, current_gray_roi, prev_frame_cache
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
