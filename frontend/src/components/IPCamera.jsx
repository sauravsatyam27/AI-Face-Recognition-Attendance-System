import React, { useRef } from "react";

export default function IPCamera({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ⭐ CHANGE THIS TO YOUR PHONE IP
  const streamUrl = "http://192.168.1.5:8080/video";

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg");
    onCapture(image);
  };

  return (
    <div className="space-y-3">
      <img
        ref={videoRef}
        src={streamUrl}
        alt="IP Camera"
        className="rounded-lg w-full"
      />

      <button
        onClick={capturePhoto}
        className="btn-primary w-full"
      >
        📸 Capture Photo
      </button>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}