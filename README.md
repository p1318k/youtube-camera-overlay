# YouTube Camera Overlay Project

This project is designed to capture video from a PC camera, segment the person from the video feed, and overlay the segmented video onto a YouTube live stream in real-time.

## Project Structure

```
youtube-camera-overlay
├── src
│   ├── main.py                # Entry point of the application
│   ├── video_processor.py      # Manages video capture and processing
│   ├── person_segmentation.py   # Segments the person from video frames
│   ├── youtube_integration.py   # Handles YouTube streaming integration
│   └── utils
│       └── image_utils.py      # Utility functions for image processing
├── models
│   └── README.md               # Documentation for machine learning models
├── static
│   └── styles.css              # CSS styles for the web application
├── templates
│   ├── index.html              # Main HTML template for the web app
│   └── stream.html             # HTML template for live video stream
├── requirements.txt            # Python dependencies for the project
├── config.yaml                 # Configuration settings for the application
└── README.md                   # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone https://github.com/yourusername/youtube-camera-overlay.git
   cd youtube-camera-overlay
   ```

2. **Install dependencies:**
   Ensure you have Python installed, then run:
   ```
   pip install -r requirements.txt
   ```

3. **Configure the application:**
   Edit `config.yaml` to set your video source and YouTube API keys.

4. **Run the application:**
   Execute the following command to start the web server:
   ```
   python src/main.py
   ```

5. **Access the web interface:**
   Open your web browser and navigate to `http://localhost:5000` to start the video stream.

## Usage Guidelines

- Use the web interface to start and stop the video stream.
- Ensure your camera is connected and accessible by the application.
- Follow the instructions on the web interface to integrate with your YouTube account for live streaming.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.