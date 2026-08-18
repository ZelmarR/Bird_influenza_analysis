import os
import tempfile
from datetime import datetime

import pandas as pd
import streamlit as st

from detection import process_video_with_unique_bird_counting
from github_utils import download_csv, upload_csv


def append_result(result: dict) -> None:
    df, sha = download_csv()

    new_row = {
        "video_name": result["video_name"],
        "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "unique_flying_birds": result["unique_flying_birds"],
        "max_concurrent_birds": result["max_concurrent_birds"],
        "duration_seconds": round(result["duration_seconds"], 1),
        "processing_time": round(result["processing_time"], 1),
    }

    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    upload_csv(df, sha)


def tab_process():
    st.header("Upload a Video")
    st.caption(
        "Upload a video to count unique flying birds. "
        "Results are saved permanently; videos are discarded after processing."
    )

    uploaded_file = st.file_uploader(
        "Choose a video file",
        type=["mp4", "avi", "mov", "mkv", "webm"],
    )

    if uploaded_file is None:
        return

    threshold = st.slider(
        "Detection threshold — lower = more sensitive, higher = less noise",
        min_value=50, max_value=220, value=127, step=5,
    )

    if st.button("Run Detection", type="primary"):
        suffix = os.path.splitext(uploaded_file.name)[1] or ".mp4"

        with st.spinner("Processing video — this may take several minutes..."):
            # delete=False required: cv2.VideoCapture re-opens the file by path
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            try:
                tmp.write(uploaded_file.read())
                tmp.flush()
                tmp.close()

                result = process_video_with_unique_bird_counting(
                    tmp.name, show_display=False, threshold=threshold
                )
            finally:
                os.unlink(tmp.name)

        if result is None:
            st.error("Detection failed. Check the video file and try again.")
            return

        result["video_name"] = uploaded_file.name

        with st.spinner("Saving results..."):
            append_result(result)

        st.success("Done — results saved.")

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Unique Flying Birds", result["unique_flying_birds"])
        col2.metric("Max Concurrent", result["max_concurrent_birds"])
        col3.metric("Video Duration", f"{result['duration_seconds']:.1f}s")
        col4.metric("Processing Time", f"{result['processing_time']:.1f}s")


def tab_analysis():
    st.header("All Results")

    if st.button("Refresh"):
        st.cache_data.clear()

    df, _ = download_csv()

    if df.empty:
        st.info("No results yet. Process a video in the 'Process Video' tab.")
        return

    st.dataframe(df, use_container_width=True)

    st.subheader("Unique Flying Birds Over Time")
    st.line_chart(
        df.rename(columns={"unique_flying_birds": "Unique Flying Birds"}).set_index("upload_date")[
            ["Unique Flying Birds"]
        ]
    )

    st.subheader("Max Concurrent Birds Over Time")
    st.line_chart(
        df.rename(columns={"max_concurrent_birds": "Max Concurrent Birds"}).set_index("upload_date")[
            ["Max Concurrent Birds"]
        ]
    )


def main():
    st.set_page_config(page_title="Bird Counter", layout="wide")
    st.title("Bird Counter")

    tab1, tab2 = st.tabs(["Process Video", "Analysis"])

    with tab1:
        tab_process()

    with tab2:
        tab_analysis()


if __name__ == "__main__":
    main()
